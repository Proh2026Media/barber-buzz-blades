-- Escopo: nenhum evento privado/desconhecido entra na classificação para grupos.
alter table public.whatsapp_send_attempts
 add column destination_kind text not null default 'unknown' check(destination_kind in ('groups','unknown')),
 add column activity_group_id uuid,
 add column activity_phone text,
 add column activity_identity_since timestamptz;
-- Sem FK: prova minimizada de destino sobrevive ao expurgo de OTP/grupo, sem JID ou conteúdo.
create function public.whatsapp_capture_activity_scope() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 new.destination_kind:='unknown';new.activity_group_id:=null;new.activity_phone:=null;new.activity_identity_since:=null;
 select i.phone,i.observed_since into new.activity_phone,new.activity_identity_since
 from public.whatsapp_activity_identity i join public.whatsapp_channels c on c.id=i.channel_id
 where c.instance_name=new.instance_name and i.phone=regexp_replace(c.display_phone,'[^0-9]','','g')
 and new.started_at>=i.observed_since;
 select r.group_id into new.activity_group_id from public.whatsapp_group_login_routes r
 join public.whatsapp_care_groups g on g.id=r.group_id
 where r.challenge_id=new.challenge_id and r.instance_name=new.instance_name
  and g.group_jid ~ '^[0-9-]+@g\.us$';
 if new.activity_group_id is not null then new.destination_kind:='groups';end if;
 return new;
end $$;
revoke all on function public.whatsapp_capture_activity_scope() from public,anon,authenticated,service_role;
create trigger whatsapp_capture_activity_scope before insert on public.whatsapp_send_attempts
 for each row execute function public.whatsapp_capture_activity_scope();

create or replace function public.platform_whatsapp_number_activity() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 -- São aceites pelo provedor, não comprovantes de entrega. O diário retém 30 dias.
 with metrics as (
  select c.id,
   count(a.id) filter(where a.state='accepted') as accepted,
   count(a.id) filter(where a.state='unknown' or (a.state='started' and a.started_at<now()-interval '2 minutes')) as uncertain,
   count(distinct (a.started_at at time zone 'UTC')::date) filter(where a.state='accepted') as active_days,
   least(30,coalesce((now() at time zone 'UTC')::date-min((a.started_at at time zone 'UTC')::date)+1,0)) as observed_days,
   public.whatsapp_sending_paused(c.instance_name,false) as paused
  from public.whatsapp_channels c left join public.whatsapp_activity_identity i on i.channel_id=c.id and i.phone=regexp_replace(c.display_phone,'[^0-9]','','g')
  left join public.whatsapp_send_attempts a
    on a.destination_kind='groups' and a.instance_name=c.instance_name and a.started_at>=i.observed_since and a.started_at>=(((now() at time zone 'UTC')::date-29)::timestamp at time zone 'UTC') and a.started_at<=now()
  group by c.id,c.instance_name
 ) select coalesce(jsonb_object_agg(id::text,jsonb_build_object('accepted',accepted,'uncertain',uncertain,
   'activeDays',active_days,'observedDays',observed_days,'sampledAt',now(),'source','dispatch','scope','groups','paused',paused)),'{}') into result from metrics;
 return result;
end $$;
revoke all on function public.platform_whatsapp_number_activity() from public,anon,service_role;
grant execute on function public.platform_whatsapp_number_activity() to authenticated;

alter table public.whatsapp_activity_daily_history add column scope text not null default 'unknown' check(scope in ('unknown','groups'));
alter table public.whatsapp_activity_daily_history drop constraint whatsapp_activity_daily_history_pkey;
alter table public.whatsapp_activity_daily_history add primary key(channel_id,phone,identity_since,day,scope);
-- Restrição e rótulo pertencem ao telefone observado, não a todos os telefones
-- que algum dia reutilizaram a mesma instância.
alter table public.whatsapp_number_history add column phone text;
update public.whatsapp_number_history set phone=regexp_replace(display_phone,'[^0-9]','','g');
alter table public.whatsapp_number_history alter column phone set not null;
alter table public.whatsapp_number_history drop constraint whatsapp_number_history_pkey;
alter table public.whatsapp_number_history add primary key(channel_id,phone);
create or replace function public.snapshot_whatsapp_activity_history(p_id uuid default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 insert into public.whatsapp_number_history(channel_id,phone,label,display_phone,instance_name,restricted)
 select c.id,regexp_replace(c.display_phone,'[^0-9]','','g'),c.label,c.display_phone,c.instance_name,exists(select 1 from public.whatsapp_send_controls s where s.scope=c.id::text and s.reason='restriction' and s.paused)
 from public.whatsapp_channels c where (p_id is null or c.id=p_id) and c.display_phone ~ '^\+?[1-9][0-9]{7,14}$'
 and exists(select 1 from public.whatsapp_activity_identity i where i.channel_id=c.id and i.phone=regexp_replace(c.display_phone,'[^0-9]','','g'))
 on conflict(channel_id,phone) do update set label=excluded.label,display_phone=excluded.display_phone,
  instance_name=excluded.instance_name,captured_at=now(),restricted=whatsapp_number_history.restricted or excluded.restricted;
 insert into public.whatsapp_activity_daily_history(channel_id,phone,identity_since,day,scope,accepted,uncertain)
 select c.id,i.phone,i.observed_since,(a.started_at at time zone 'UTC')::date,a.destination_kind,
  count(*) filter(where a.state='accepted'),
  count(*) filter(where a.state='unknown' or (a.state='started' and a.started_at<now()-interval '2 minutes'))
 from public.whatsapp_channels c join public.whatsapp_activity_identity i on i.channel_id=c.id
 join public.whatsapp_send_attempts a on a.instance_name=c.instance_name and a.started_at>=i.observed_since and a.started_at<=now()
 where (p_id is null or c.id=p_id) and a.destination_kind='unknown'
 group by c.id,i.phone,i.observed_since,(a.started_at at time zone 'UTC')::date,a.destination_kind
 on conflict(channel_id,phone,identity_since,day,scope) do update set accepted=greatest(whatsapp_activity_daily_history.accepted,excluded.accepted),uncertain=greatest(whatsapp_activity_daily_history.uncertain,excluded.uncertain);
end $$;
revoke all on function public.snapshot_whatsapp_activity_history(uuid) from public,anon,authenticated,service_role;
-- Os totais de grupos acumulam UMA vez por transição terminal. Expurgar parte
-- de um dia nunca substitui o total pelo pedaço restante do diário.
create function public.whatsapp_accumulate_group_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare channel uuid;
begin
 if new.destination_kind<>'groups' or new.activity_phone is null or new.activity_identity_since is null
  or new.state not in ('accepted','unknown') or new.started_at>now() then return new;end if;
 if tg_op='UPDATE' and old.state in ('accepted','unknown') then return new;end if;
 select id into channel from public.whatsapp_channels where instance_name=new.instance_name;
 if channel is null then return new;end if;
 insert into public.whatsapp_activity_daily_history(channel_id,phone,identity_since,day,scope,accepted,uncertain)
 values(channel,new.activity_phone,new.activity_identity_since,(new.started_at at time zone 'UTC')::date,'groups',
  case when new.state='accepted' then 1 else 0 end,case when new.state='unknown' then 1 else 0 end)
 on conflict(channel_id,phone,identity_since,day,scope) do update
  set accepted=whatsapp_activity_daily_history.accepted+excluded.accepted,
      uncertain=whatsapp_activity_daily_history.uncertain+excluded.uncertain;
 return new;
end $$;
revoke all on function public.whatsapp_accumulate_group_activity() from public,anon,authenticated,service_role;
create trigger whatsapp_accumulate_group_activity after insert or update of state on public.whatsapp_send_attempts
 for each row execute function public.whatsapp_accumulate_group_activity();

create or replace function public.platform_whatsapp_number_history() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 with historical as (
  select d.channel_id,d.phone,coalesce(sum(d.accepted) filter(where d.scope='groups'),0) accepted,coalesce(sum(d.uncertain) filter(where d.scope='groups'),0) uncertain
  from public.whatsapp_activity_daily_history d
  where not exists(select 1 from public.whatsapp_channels c where c.id=d.channel_id and regexp_replace(c.display_phone,'[^0-9]','','g')=d.phone)
  group by d.channel_id,d.phone
 ), entries as (
  select h.channel_id,h.label,d.phone,h.restricted,d.accepted,d.uncertain from historical d
  join public.whatsapp_number_history h on h.channel_id=d.channel_id and h.phone=d.phone
  union all
  select h.channel_id,h.label,regexp_replace(h.display_phone,'[^0-9]','','g'),h.restricted,0,0
  from public.whatsapp_number_history h where not exists(select 1 from public.whatsapp_channels c where c.id=h.channel_id and regexp_replace(c.display_phone,'[^0-9]','','g')=h.phone)
   and not exists(select 1 from historical d where d.channel_id=h.channel_id and d.phone=regexp_replace(h.display_phone,'[^0-9]','','g'))
 ) select coalesce(jsonb_agg(jsonb_build_object('id','history:'||channel_id||':'||phone,'label',label,'display_phone',phone,
  'status',case when restricted then 'restricted' else 'archived' end,
  'historyScope','groups','historyAccepted',accepted,'historyUncertain',uncertain)),'[]') into result from entries;
 return result;
end $$;
revoke all on function public.platform_whatsapp_number_history() from public,anon,service_role;
grant execute on function public.platform_whatsapp_number_history() to authenticated;