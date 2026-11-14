-- D2 local: evidência de grupos, restrições por telefone e observação de conexão.
-- Não libera envios nem preenche provas retroativas de mensagens.
alter table public.whatsapp_channels add column connection_observed_at timestamptz;
create function public.whatsapp_connection_observation() returns trigger
language plpgsql security definer set search_path=public as $$
begin new.connection_observed_at:=clock_timestamp();return new;end $$;
revoke all on function public.whatsapp_connection_observation() from public,anon,authenticated,service_role;
create trigger whatsapp_connection_observation before insert or update of status on public.whatsapp_channels
 for each row execute function public.whatsapp_connection_observation();

create table public.whatsapp_phone_reviews (
 phone text primary key check(phone ~ '^[1-9][0-9]{7,14}$'),
 restricted boolean not null, version bigint not null default 1,
 changed_at timestamptz not null default now()
);
create table public.whatsapp_phone_review_history (
 id uuid primary key default gen_random_uuid(),phone text not null,
 version bigint not null,restricted boolean not null,actor uuid references auth.users(id) on delete set null,
 evidence text not null check(evidence in ('legacy','restriction_recorded','reviewed_in_app','provider_confirmed')),
 reference text,created_at timestamptz not null default now(),unique(phone,version)
);
alter table public.whatsapp_phone_reviews enable row level security;
alter table public.whatsapp_phone_review_history enable row level security;
revoke all on public.whatsapp_phone_reviews,public.whatsapp_phone_review_history from public,anon,authenticated,service_role;
insert into public.whatsapp_phone_reviews(phone,restricted)
 select phone,true from public.whatsapp_number_history where restricted
 union select regexp_replace(c.display_phone,'[^0-9]','','g'),true from public.whatsapp_channels c
 join public.whatsapp_send_controls s on s.scope=c.id::text where s.paused and s.reason='restriction' and c.display_phone ~ '^\+?[1-9][0-9]{7,14}$'
 on conflict do nothing;
insert into public.whatsapp_phone_review_history(phone,version,restricted,evidence)
 select phone,version,true,'legacy' from public.whatsapp_phone_reviews;
create function public.whatsapp_record_phone_restriction() returns trigger
language plpgsql security definer set search_path=public as $$
declare phone text;r public.whatsapp_phone_reviews%rowtype;
begin
 if not new.paused or new.reason<>'restriction' then return new;end if;
 -- A pausa administrativa já adquire egresso antes de atualizar a linha.
 -- Não tomar outra trava global dentro de gatilho de linha.
 select regexp_replace(c.display_phone,'[^0-9]','','g') into phone from public.whatsapp_channels c where c.id::text=new.scope and c.display_phone ~ '^\+?[1-9][0-9]{7,14}$';
 if phone is null then return new;end if;
 insert into public.whatsapp_phone_reviews(phone,restricted) values(phone,true)
 on conflict on constraint whatsapp_phone_reviews_pkey do update set restricted=true,version=whatsapp_phone_reviews.version+1,changed_at=clock_timestamp() returning * into r;
 insert into public.whatsapp_phone_review_history(phone,version,restricted,actor,evidence) values(r.phone,r.version,true,auth.uid(),'restriction_recorded');
 return new;
end $$;
revoke all on function public.whatsapp_record_phone_restriction() from public,anon,authenticated,service_role;
create trigger whatsapp_record_phone_restriction after insert or update on public.whatsapp_send_controls
 for each row execute function public.whatsapp_record_phone_restriction();

create function public.platform_review_whatsapp_phone(p_phone text,p_version bigint,p_evidence text,p_reference text,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.whatsapp_phone_reviews%rowtype;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_phone !~ '^[1-9][0-9]{7,14}$' or p_confirmed is distinct from true or p_evidence is null or p_evidence not in ('reviewed_in_app','provider_confirmed')
  or p_reference is null or p_reference !~ '^[A-Za-z0-9_.:-]{3,100}$' then raise exception 'WA_REVIEW_EVIDENCE_REQUIRED' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 select * into r from public.whatsapp_phone_reviews where phone=p_phone for update;
 if r.phone is null or r.version is distinct from p_version then raise exception 'WA_STALE' using errcode='40001';end if;
 if not r.restricted then return to_jsonb(r);end if;
 -- Revisão não reconecta, não altera pausas/rotas e não reenvia nada.
 update public.whatsapp_phone_reviews set restricted=false,version=version+1,changed_at=clock_timestamp() where phone=p_phone returning * into r;
 insert into public.whatsapp_phone_review_history(phone,version,restricted,actor,evidence,reference)
 values(r.phone,r.version,false,auth.uid(),p_evidence,p_reference);
 return to_jsonb(r);
end $$;
revoke all on function public.platform_review_whatsapp_phone(text,bigint,text,text,boolean) from public,anon,service_role;
grant execute on function public.platform_review_whatsapp_phone(text,bigint,text,text,boolean) to authenticated;
create or replace function public.whatsapp_number_restricted(p_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_channels c where c.id=p_id and (
  exists(select 1 from public.whatsapp_phone_reviews r where r.restricted and r.phone=regexp_replace(c.display_phone,'[^0-9]','','g'))
  or exists(select 1 from public.whatsapp_channels other join public.whatsapp_send_controls s on s.scope=other.id::text
   where s.paused and s.reason='restriction' and regexp_replace(other.display_phone,'[^0-9]','','g')=regexp_replace(c.display_phone,'[^0-9]','','g'))
  or exists(select 1 from public.whatsapp_number_history h where h.restricted and h.phone=regexp_replace(c.display_phone,'[^0-9]','','g')
    and not exists(select 1 from public.whatsapp_phone_reviews r where r.phone=h.phone))));
$$;

-- Prova de destino persistida pelo autorizador de avisos, não pelo navegador.
create table public.whatsapp_group_delivery_routes (
 outbox_id uuid primary key references public.whatsapp_outbox(id) on delete cascade,
 group_id uuid not null references public.whatsapp_care_groups(id) on delete cascade,
 group_version bigint not null,instance_name text not null,created_at timestamptz not null default now()
);
alter table public.whatsapp_group_delivery_routes enable row level security;
revoke all on public.whatsapp_group_delivery_routes from public,anon,authenticated,service_role;
alter table public.whatsapp_send_attempts add column care_operation_id uuid unique;
alter table public.whatsapp_send_attempts drop constraint whatsapp_send_attempts_check;
alter table public.whatsapp_send_attempts add constraint whatsapp_send_attempts_one_source check(num_nonnulls(challenge_id,outbox_id,care_operation_id)=1);
create or replace function public.whatsapp_capture_activity_scope() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 new.destination_kind:='unknown';new.activity_group_id:=null;new.activity_phone:=null;new.activity_identity_since:=null;
 select i.phone,i.observed_since into new.activity_phone,new.activity_identity_since
 from public.whatsapp_activity_identity i join public.whatsapp_channels c on c.id=i.channel_id
 where c.instance_name=new.instance_name and i.phone=regexp_replace(c.display_phone,'[^0-9]','','g') and new.started_at>=i.observed_since;
 if new.challenge_id is not null then
  select r.group_id into new.activity_group_id from public.whatsapp_group_login_routes r join public.whatsapp_care_groups g on g.id=r.group_id
  where r.challenge_id=new.challenge_id and r.instance_name=new.instance_name and g.group_jid ~ '^[0-9-]+@g\.us$';
 elsif new.outbox_id is not null then
  select r.group_id into new.activity_group_id from public.whatsapp_group_delivery_routes r
   join public.whatsapp_care_groups g on g.id=r.group_id and g.version=r.group_version
   join public.whatsapp_outbox o on o.id=r.outbox_id and o.barbershop_id=g.barbershop_id
  where r.outbox_id=new.outbox_id and r.instance_name=new.instance_name and g.group_jid ~ '^[0-9-]+@g\.us$';
 elsif new.care_operation_id is not null then
  select g.id into new.activity_group_id from public.whatsapp_care_operations op join public.whatsapp_care_groups g on g.id=op.group_id
   where op.id=new.care_operation_id and op.version=g.version and op.state='running' and g.group_jid ~ '^[0-9-]+@g\.us$'
   and exists(select 1 from public.whatsapp_group_accounts a join public.whatsapp_channels c on c.id=a.channel_id where a.id=any(g.approved_accounts) and c.instance_name=new.instance_name);
 end if;
 if new.activity_group_id is not null then new.destination_kind:='groups';end if;
 return new;
end $$;
create or replace function public.whatsapp_accumulate_group_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare channel uuid;da integer;du integer;
begin
 if new.destination_kind<>'groups' or new.activity_phone is null or new.activity_identity_since is null or new.started_at>now() then return new;end if;
 da:=case when new.state='accepted' then 1 else 0 end;du:=case when new.state='unknown' then 1 else 0 end;
 if tg_op='UPDATE' then
  da:=da-case when old.state='accepted' then 1 else 0 end;du:=du-case when old.state='unknown' then 1 else 0 end;
 end if;
 if da=0 and du=0 then return new;end if;
 select id into channel from public.whatsapp_channels where instance_name=new.instance_name;
 if channel is null then return new;end if;
 insert into public.whatsapp_activity_daily_history(channel_id,phone,identity_since,day,scope,accepted,uncertain)
 values(channel,new.activity_phone,new.activity_identity_since,(new.started_at at time zone 'UTC')::date,'groups',greatest(da,0),greatest(du,0))
 on conflict(channel_id,phone,identity_since,day,scope) do update set
  accepted=greatest(0,whatsapp_activity_daily_history.accepted+da),uncertain=greatest(0,whatsapp_activity_daily_history.uncertain+du);
 return new;
end $$;

-- Agrega por telefone físico, inclusive alias; histórico expurgado não vira zero.
create or replace function public.platform_whatsapp_number_activity() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 with phones as(select c.id,c.instance_name,regexp_replace(c.display_phone,'[^0-9]','','g') phone from public.whatsapp_channels c where public.whatsapp_operational_number(c.id)),
 days as(select h.phone,h.day,sum(h.accepted) accepted,sum(h.uncertain) uncertain from public.whatsapp_activity_daily_history h
  where h.scope='groups' and h.day>=(now() at time zone 'UTC')::date-29 and h.day<=(now() at time zone 'UTC')::date group by h.phone,h.day),
 stale as(select a.activity_phone phone,count(*) total from public.whatsapp_send_attempts a where a.destination_kind='groups' and a.state='started' and a.started_at<now()-interval '2 minutes'
  and a.started_at>=(((now() at time zone 'UTC')::date-29)::timestamp at time zone 'UTC') group by a.activity_phone),
 stats as(select p.id,p.instance_name,p.phone,coalesce(sum(d.accepted),0) accepted,coalesce(sum(d.uncertain),0) uncertain,
  count(d.day) filter(where d.accepted>0) active_days,coalesce((now() at time zone 'UTC')::date-min(d.day)+1,0) observed_days
  from phones p left join days d on d.phone=p.phone group by p.id,p.instance_name,p.phone)
 select coalesce(jsonb_object_agg(s.id::text,jsonb_build_object('accepted',s.accepted,'uncertain',s.uncertain+coalesce(st.total,0),
  'activeDays',s.active_days,'observedDays',least(30,s.observed_days),'sampledAt',now(),'source','dispatch','scope','groups',
  'paused',public.whatsapp_sending_paused(s.instance_name,false),'coverage','protected_group_sends')),'{}') into result from stats s left join stale st on st.phone=s.phone;
 return result;
end $$;
-- Expurgo só descarta início antigo depois de materializar incerteza no agregado.
create or replace function public.purge_whatsapp_send_audit() returns void
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 update public.whatsapp_send_attempts set state='unknown',finished_at=clock_timestamp() where state='started' and started_at<now()-interval '30 days';
 perform public.snapshot_whatsapp_activity_history();
 perform public.purge_whatsapp_send_audit_before_history();
end $$;
notify pgrst,'reload schema';
-- A evidência de restrição passada permanece, mas não é apresentada como bloqueio atual após revisão.
alter function public.platform_whatsapp_number_history() rename to platform_whatsapp_number_history_before_phone_reviews;
revoke all on function public.platform_whatsapp_number_history_before_phone_reviews() from public,anon,authenticated,service_role;
create function public.platform_whatsapp_number_history() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 select coalesce(jsonb_agg(item||jsonb_build_object('wasRestricted',item->>'status'='restricted','status',
  case when item->>'status'='restricted' and exists(select 1 from public.whatsapp_phone_reviews r where r.phone=item->>'display_phone' and not r.restricted) then 'archived' else item->>'status' end)),'[]') into result
 from jsonb_array_elements(public.platform_whatsapp_number_history_before_phone_reviews()) item;
 return result;
end $$;
revoke all on function public.platform_whatsapp_number_history() from public,anon,service_role;
grant execute on function public.platform_whatsapp_number_history() to authenticated;
