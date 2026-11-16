-- P-122: acompanhamento da intenção autenticada pelo servidor, desligado por padrão.
-- Não publica, não habilita envios, não confirma telefone e não altera grupos ao instalar.
do $$declare sig text;expected text;begin
 for sig,expected in select key,value from jsonb_each_text('{"care_group_begin(uuid,boolean,uuid[],text)":"364fd663fa2630f317530be38fbc7d5d","care_access_start(uuid,text,uuid[],boolean,uuid,bigint)":"46693a36d4020c343b5c0a39f6140dbd","resume_care_access(uuid,uuid)":"b0473f73430a53c79916247dbe597931","continue_care_phone_revision(uuid,uuid)":"7e3ef5437596ac88dca7292b57ef78a5"}'::jsonb) loop
  if (select md5(prosrc) from pg_proc where oid=('public.'||sig)::regprocedure) is distinct from expected then raise exception 'BC_ENTRADA_BASE_DIVERGENTE: %',sig;end if;
 end loop;
end $$;
alter table public.whatsapp_care_cycle_policy add column background_access_enabled boolean not null default false;
create table public.whatsapp_entry_progress (
 barbershop_id uuid not null references public.barbershops(id) on delete cascade,
 customer_id uuid not null references public.profiles(id) on delete cascade,
 state text not null, checked_at timestamptz not null default clock_timestamp(),
 primary key(barbershop_id,customer_id)
);
alter table public.whatsapp_entry_progress enable row level security;
revoke all on public.whatsapp_entry_progress from public,anon,authenticated,service_role;

-- Conserva o corpo exato dos contratos testados, com identidade explícita proveniente
-- da intenção persistida. Não define claims, não fabrica JWT e não concede essas
-- variantes internas a nenhum papel da API. O retorno do begin não lê perfil alheio.
do $$declare body text;begin
 select prosrc into body from pg_proc where oid='public.care_group_begin(uuid,boolean,uuid[],text)'::regprocedure;
 body:=replace(replace(body,'auth.uid()','p_user'),'return public.care_group_read(p_shop);','return ''{}''::jsonb;');
 if position('auth.uid()' in body)>0 or position('care_group_read(' in body)>0 then raise exception 'BC_ENTRADA_COPIA_INVALIDA';end if;
 execute 'create function public.care_entry_begin_internal(p_user uuid,p_shop uuid,p_accept boolean,p_accounts uuid[],p_phone text) returns jsonb language plpgsql security definer set search_path=public as '||quote_literal(body);
 select prosrc into body from pg_proc where oid='public.care_access_start(uuid,text,uuid[],boolean,uuid,bigint)'::regprocedure;
 execute 'create function public.care_entry_start_internal(p_user uuid,p_shop uuid,p_phone text,p_accounts uuid[],p_accept boolean,p_group uuid,p_version bigint) returns uuid language plpgsql security definer set search_path=public as '||quote_literal(replace(body,'auth.uid()','p_user'));
 select prosrc into body from pg_proc where oid='public.resume_care_access(uuid,uuid)'::regprocedure;
 body:=replace(replace(body,'auth.uid()','p_user'),'public.care_group_begin(a.barbershop_id','public.care_entry_begin_internal(p_user,a.barbershop_id');
 execute 'create function public.care_entry_resume_internal(p_user uuid,p_id uuid,p_token uuid) returns uuid language plpgsql security definer set search_path=public as '||quote_literal(body);
 select prosrc into body from pg_proc where oid='public.continue_care_phone_revision(uuid,uuid)'::regprocedure;
 body:=replace(replace(body,'auth.uid()','p_user'),'public.care_access_start(p_shop','public.care_entry_start_internal(p_user,p_shop');
 execute 'create function public.care_entry_continue_internal(p_user uuid,p_shop uuid,p_id uuid) returns void language plpgsql security definer set search_path=public as '||quote_literal(body);
end $$;
revoke all on function public.care_entry_begin_internal(uuid,uuid,boolean,uuid[],text),public.care_entry_start_internal(uuid,uuid,text,uuid[],boolean,uuid,bigint),public.care_entry_resume_internal(uuid,uuid,uuid),public.care_entry_continue_internal(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.care_entry_background_allowed(p_user uuid,p_shop uuid) returns boolean
language sql volatile security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_care_cycle_policy where singleton and background_access_enabled and assisted_access_enabled and enabled and pilot_isolation_required and pilot_shop_id=p_shop and pilot_customer_id=p_user)
 and not public.whatsapp_sending_paused('',false) and public.whatsapp_pilot_context_allows(p_shop,p_user)
 and public.care_cycle_policy_allows(p_shop,p_user);
$$;
create function public.care_entry_background_queue() returns jsonb
language sql volatile security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(q)-'requested_at'),'[]'::jsonb) from (
  select r.customer_id as "user",r.barbershop_id shop,r.group_id as "group",'revision'::text kind,r.id intent,r.requested_at
  from public.whatsapp_phone_revisions r
  where public.care_entry_background_allowed(r.customer_id,r.barbershop_id)
   and public.care_phone_revision_valid(r.id,r.customer_id) and r.next_at<=clock_timestamp() and coalesce(r.lease_until,'-infinity')<=clock_timestamp()
  union all
  select r.customer_id,r.barbershop_id,r.group_id,'handoff',r.id,r.requested_at
  from public.whatsapp_phone_revisions r
  where public.care_entry_background_allowed(r.customer_id,r.barbershop_id) and r.phase='committed' and r.deadline>clock_timestamp() and r.verified_at is null
   and not exists(select 1 from public.whatsapp_care_access a where a.customer_id=r.customer_id and a.barbershop_id=r.barbershop_id and a.cycle_id=r.cycle_id and a.expires_at>clock_timestamp())
  union all
  select a.customer_id,a.barbershop_id,a.group_id,'access',a.id,a.requested_at
  from public.whatsapp_care_access a left join public.whatsapp_care_groups g on g.id=a.group_id
  where public.care_entry_background_allowed(a.customer_id,a.barbershop_id) and public.care_access_valid(a.id,a.customer_id)
   and a.next_at<=clock_timestamp() and coalesce(a.lease_until,'-infinity')<=clock_timestamp() and (g.state is null or g.state<>'active')
  order by requested_at limit 4
 ) q;
$$;
create function public.resume_care_access_background(p_id uuid,p_user uuid,p_token uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare a public.whatsapp_care_access%rowtype;begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 select * into a from public.whatsapp_care_access where id=p_id and customer_id=p_user and lease_token=p_token and lease_until>clock_timestamp() for update;
 if a.id is null or not public.care_entry_background_allowed(p_user,a.barbershop_id) or not public.care_access_valid(a.id,p_user) then raise exception 'GROUP_UNAVAILABLE';end if;
 return public.care_entry_resume_internal(p_user,p_id,p_token);
end $$;
create function public.continue_care_phone_revision_background(p_shop uuid,p_id uuid,p_user uuid) returns void
language plpgsql security definer set search_path=public as $$
declare r public.whatsapp_phone_revisions%rowtype;p public.profiles%rowtype;begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 select * into r from public.whatsapp_phone_revisions where id=p_id and customer_id=p_user and barbershop_id=p_shop and phase='committed' and deadline>clock_timestamp() for update;
 select * into p from public.profiles where id=p_user;
 if r.id is null or not public.care_entry_background_allowed(p_user,p_shop)
  or p.whatsapp_e164 is distinct from r.profile_phone or p.whatsapp_verified_at is distinct from r.profile_verified_at
  or not exists(select 1 from auth.users where id=p_user and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp())) then raise exception 'GROUP_UNAVAILABLE';end if;
 perform public.care_entry_continue_internal(p_user,p_shop,p_id);
end $$;
create function public.care_entry_background_progress(p_user uuid,p_shop uuid,p_state text) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 if not public.care_entry_background_allowed(p_user,p_shop) then raise exception 'GROUP_UNAVAILABLE';end if;
 if p_state not in('waiting','phone_waiting','phone_request_unresolved','phone_review','phone_binding','phone_revised','phone_aborted','inactive','active','waiting_customer','waiting_first_receipt','preparing','review','busy') then p_state:='review';end if;
 if not exists(select 1 from public.whatsapp_phone_revisions where customer_id=p_user and barbershop_id=p_shop and (deadline>clock_timestamp() or phase in('binding','bound')))
  and not exists(select 1 from public.whatsapp_care_access where customer_id=p_user and barbershop_id=p_shop and expires_at>clock_timestamp()) then raise exception 'GROUP_UNAVAILABLE';end if;
 insert into public.whatsapp_entry_progress(barbershop_id,customer_id,state) values(p_shop,p_user,p_state)
 on conflict(barbershop_id,customer_id) do update set state=excluded.state,checked_at=clock_timestamp();
 -- Uma etapa comprovadamente avançada não precisa esperar mais dez segundos.
 update public.whatsapp_phone_revisions set next_at=clock_timestamp() where customer_id=p_user and barbershop_id=p_shop and phase in('binding','bound') and lease_until is null and p_state='phone_binding';
end $$;
revoke all on function public.care_entry_background_allowed(uuid,uuid),public.care_entry_background_queue(),public.resume_care_access_background(uuid,uuid,uuid),public.continue_care_phone_revision_background(uuid,uuid,uuid),public.care_entry_background_progress(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.care_entry_background_queue(),public.resume_care_access_background(uuid,uuid,uuid),public.continue_care_phone_revision_background(uuid,uuid,uuid),public.care_entry_background_progress(uuid,uuid,text) to service_role;
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.care_group_read(uuid,uuid)'::regprocedure);
 execute replace(definition,'CREATE OR REPLACE FUNCTION public.care_group_read(','CREATE FUNCTION public.care_group_read_before_background(');
end $$;
revoke all on function public.care_group_read_before_background(uuid,uuid) from public,anon,authenticated,service_role;
create or replace function public.care_group_read(p_shop uuid,p_customer uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;person uuid;active boolean;enabled boolean;progress public.whatsapp_entry_progress%rowtype;begin
 -- A leitura original valida a sessão e o escopo ANTES de qualquer dado novo.
 result:=public.care_group_read_before_background(p_shop,p_customer);
 person:=coalesce(p_customer,auth.uid());
 enabled:=coalesce((result->>'enabled')::boolean,false) and public.care_entry_background_allowed(person,p_shop);
 active:=enabled and (exists(select 1 from public.whatsapp_care_access a where a.barbershop_id=p_shop and a.customer_id=person and public.care_access_valid(a.id,person))
  or exists(select 1 from public.whatsapp_phone_revisions r where r.barbershop_id=p_shop and r.customer_id=person and public.care_phone_revision_valid(r.id,person)));
 select * into progress from public.whatsapp_entry_progress where barbershop_id=p_shop and customer_id=person;
 return result||jsonb_build_object('background',jsonb_build_object('enabled',enabled,'active',active,'state',case when active then progress.state end,'checked_at',case when active then progress.checked_at end));
end $$;
notify pgrst,'reload schema';

-- O evento é apenas um despertador: a decisão continua baseada em consulta/prova live.
create function public.care_entry_background_wake(p_instance text,p_group_jid text) returns void
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 select groups.* into g from public.whatsapp_care_groups groups join public.whatsapp_care_cycles c on c.id=groups.current_cycle_id
 where c.group_jid=p_group_jid and public.care_entry_background_allowed(groups.customer_id,groups.barbershop_id)
 and exists(select 1 from jsonb_array_elements(c.consented_numbers) n where n->>'instance'=p_instance);
 if g.id is null then return;end if;
 update public.whatsapp_care_access set next_at=least(next_at,clock_timestamp()) where group_id=g.id and public.care_access_valid(id,customer_id);
 update public.whatsapp_phone_revisions set next_at=least(next_at,clock_timestamp()) where group_id=g.id and public.care_phone_revision_valid(id,customer_id);
end $$;
revoke all on function public.care_entry_background_wake(text,text) from public,anon,authenticated,service_role;
grant execute on function public.care_entry_background_wake(text,text) to service_role;
