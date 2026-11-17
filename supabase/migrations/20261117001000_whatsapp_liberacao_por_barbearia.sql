-- Base funcional conferida com a instalação homologada; transação obrigatória.
do $$declare sig text;expected text;begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 for sig,expected in select key,value from jsonb_each_text('{"care_cycle_policy_allows(uuid,uuid)":"c2932556e48071dd7175378bed33ff2f","whatsapp_pilot_context_allows(uuid,uuid)":"420be1048c80c90d976d5d32753d4f5d","whatsapp_pilot_challenge_allows(uuid,uuid)":"fdf706a3ea940c947b3b40a9daac8d89","care_entry_background_allowed(uuid,uuid)":"31f89d62dc37f2708c27e197d8ee6978","care_entry_background_queue()":"8888d6777d382e26a7005354304c8351"}'::jsonb) loop
  if (select md5(prosrc) from pg_proc where oid=('public.'||sig)::regprocedure) is distinct from expected then raise exception 'BC_LIBERACAO_BASE_DIVERGENTE: %',sig;end if;
 end loop;
end $$;
-- P-122: liberações explícitas por loja e cliente. Instalar não amplia o piloto.
-- A primeira liberação migra o par anterior na mesma transação. Ausência é recusa.
alter table public.whatsapp_care_cycle_policy add column shop_release_mode boolean not null default false;
create table public.whatsapp_shop_releases (
 barbershop_id uuid primary key references public.barbershops(id) on delete cascade,
 enabled boolean not null default false, version bigint not null default 1,
 changed_by uuid references public.profiles(id) on delete set null,
 changed_at timestamptz not null default clock_timestamp()
);
create table public.whatsapp_shop_release_customers (
 barbershop_id uuid not null references public.whatsapp_shop_releases(barbershop_id) on delete cascade,
 customer_id uuid not null references public.profiles(id) on delete cascade,
 primary key(barbershop_id,customer_id)
);
create table public.whatsapp_shop_release_audit (
 id uuid primary key default gen_random_uuid(), barbershop_id uuid,
 actor uuid, action text not null, customer_id uuid, version bigint not null,
 occurred_at timestamptz not null default clock_timestamp()
);
alter table public.whatsapp_shop_releases enable row level security;
alter table public.whatsapp_shop_release_customers enable row level security;
alter table public.whatsapp_shop_release_audit enable row level security;
revoke all on public.whatsapp_shop_releases,public.whatsapp_shop_release_customers,public.whatsapp_shop_release_audit from public,anon,authenticated,service_role;
create function public.care_shop_scope_allows(p_shop uuid,p_customer uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_shop_releases r
 join public.whatsapp_shop_release_customers c using(barbershop_id)
 join public.memberships m on m.barbershop_id=r.barbershop_id and m.user_id=c.customer_id and m.role='customer'
 join auth.users u on u.id=c.customer_id and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp())
 where r.enabled and r.barbershop_id=p_shop and c.customer_id=p_customer and public.whatsapp_complete_shop(p_shop));
$$;
create or replace function public.whatsapp_pilot_context_allows(p_shop uuid,p_customer uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce((select case when shop_release_mode then public.care_shop_scope_allows(p_shop,p_customer)
 when not pilot_isolation_required and pilot_shop_id is null and pilot_customer_id is null then true
 else pilot_shop_id=p_shop and pilot_customer_id=p_customer end from public.whatsapp_care_cycle_policy where singleton),false);
$$;
create or replace function public.whatsapp_pilot_challenge_allows(p_customer uuid,p_shop uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce((select case when shop_release_mode then case when p_shop is not null then public.care_shop_scope_allows(p_shop,p_customer)
 else exists(select 1 from public.whatsapp_shop_release_customers c where c.customer_id=p_customer and public.care_shop_scope_allows(c.barbershop_id,p_customer)) end
 when not pilot_isolation_required and pilot_shop_id is null and pilot_customer_id is null then true
 else pilot_customer_id=p_customer and (p_shop is null or pilot_shop_id=p_shop) end from public.whatsapp_care_cycle_policy where singleton),false);
$$;
create or replace function public.care_cycle_policy_allows(p_shop uuid,p_customer uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_care_cycle_policy where singleton and enabled)
 and public.whatsapp_pilot_context_allows(p_shop,p_customer);
$$;
create or replace function public.care_entry_background_allowed(p_user uuid,p_shop uuid) returns boolean
language sql volatile security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_care_cycle_policy where singleton and background_access_enabled and assisted_access_enabled and enabled
 and (shop_release_mode or (pilot_isolation_required and pilot_shop_id=p_shop and pilot_customer_id=p_user)))
 and not public.whatsapp_sending_paused('',false) and public.whatsapp_pilot_context_allows(p_shop,p_user)
 and public.care_cycle_policy_allows(p_shop,p_user);
$$;
create function public.care_shop_preparation_ready(p_shop uuid,p_customer uuid) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;numbers jsonb;
begin

 if p_shop is null or p_customer is null or not public.whatsapp_complete_shop(p_shop)
  or not exists(select 1 from public.memberships m join public.profiles f on f.id=m.user_id join auth.users u on u.id=f.id
   where m.barbershop_id=p_shop and m.user_id=p_customer and m.role='customer'
    and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp())) then return false;end if;
 select * into g from public.whatsapp_care_groups where barbershop_id=p_shop and customer_id=p_customer;
 numbers:=public.care_cycle_composition(p_shop,g.current_cycle_id);
 if not public.care_cycle_composition_valid(numbers,false) then return false;end if;
 return not exists(select 1 from jsonb_array_elements(numbers) n left join public.whatsapp_channels c on c.id=(n->>'id')::uuid
  where c.id is null or c.status<>'open' or c.connection_observed_at is null or c.connection_observed_at<=clock_timestamp()-interval '2 minutes'
   or not public.care_cycle_number_valid(c.id,n,false) or public.whatsapp_number_restricted(c.id)
   or exists(select 1 from public.whatsapp_send_controls s where s.paused and s.scope in('platform',c.id::text))
   or not exists(select 1 from public.whatsapp_care_registry r where r.instance_name=c.instance_name and r.enabled and r.acknowledged_version=r.source_version)
   or exists(select 1 from public.whatsapp_send_attempts a where a.state in('started','unknown') and (a.instance_name=c.instance_name or a.activity_phone=regexp_replace(c.display_phone,'[^0-9]','','g'))));
end $$;
-- Leitura e gravação usam a sessão administrativa real. Nunca liga o motor global.
create function public.care_shop_release_admin(p_action text default 'read',p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare shop uuid;person uuid;r public.whatsapp_shop_releases%rowtype;p public.whatsapp_care_cycle_policy%rowtype;s public.whatsapp_send_controls%rowtype;v bigint;result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_action is null or p_action not in('read','allow','pause','revoke') then raise exception 'GROUP_INVALID';end if;
 if p_action<>'read' then
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  shop:=(p_values->>'shop_id')::uuid;person:=(p_values->>'customer_id')::uuid;
  select * into p from public.whatsapp_care_cycle_policy where singleton for update;
  select * into s from public.whatsapp_send_controls where scope='global' for update;
  select * into r from public.whatsapp_shop_releases where barbershop_id=shop for update;
  if (p_values->>'version')::bigint is distinct from coalesce(r.version,0)
   or (p_values->>'policy_version')::bigint is distinct from p.version or (p_values->>'pause_version')::bigint is distinct from s.version then raise exception 'GROUP_STALE';end if;
  if shop is null or p_values->>'confirmed' is distinct from 'true' then raise exception 'GROUP_INVALID';end if;
  if p_action='allow' then
   if s.paused or not p.enabled or not p.assisted_access_enabled or not p.background_access_enabled then raise exception 'WA_SENDING_PAUSED';end if;
   if not public.care_shop_preparation_ready(shop,person) then raise exception 'GROUP_CAPABILITY_REQUIRED';end if;
   if exists(select 1 from public.whatsapp_distribution_policy where enabled)
    or exists(select 1 from public.whatsapp_care_cycles c join public.whatsapp_care_groups g on g.id=c.group_id where g.barbershop_id=shop and c.lease_until>clock_timestamp()) then raise exception 'GROUP_SEND_UNRESOLVED';end if;
  elsif r.barbershop_id is null and (p.shop_release_mode or shop is distinct from p.pilot_shop_id) then raise exception 'GROUP_INVALID';end if;
  -- Transição sem janela intermediária e sem fallback aberto após excluir IDs.
  if not p.shop_release_mode then
   if not p.pilot_isolation_required or p.pilot_shop_id is null or p.pilot_customer_id is null then raise exception 'PILOT_SCOPE_REQUIRED';end if;
   insert into public.whatsapp_shop_releases(barbershop_id,enabled,changed_by) values(p.pilot_shop_id,true,auth.uid()) on conflict do nothing;
   insert into public.whatsapp_shop_release_customers values(p.pilot_shop_id,p.pilot_customer_id) on conflict do nothing;
   update public.whatsapp_care_cycle_policy set shop_release_mode=true,version=version+1,changed_by=auth.uid(),changed_at=now() where singleton;
  end if;
  if p_action='allow' then
   insert into public.whatsapp_shop_releases(barbershop_id,enabled,changed_by) values(shop,true,auth.uid())
   on conflict(barbershop_id) do update set enabled=true,version=whatsapp_shop_releases.version+1,changed_by=auth.uid(),changed_at=clock_timestamp() returning version into v;
   insert into public.whatsapp_shop_release_customers values(shop,person) on conflict do nothing;
  else
   update public.whatsapp_shop_releases set enabled=case when p_action='pause' then false else enabled end,version=version+1,changed_by=auth.uid(),changed_at=clock_timestamp() where barbershop_id=shop returning version into v;
   if p_action='revoke' then
    if person is null then raise exception 'GROUP_INVALID';end if;
    delete from public.whatsapp_shop_release_customers where barbershop_id=shop and customer_id=person;
   end if;
  end if;
  insert into public.whatsapp_shop_release_audit(barbershop_id,actor,action,customer_id,version) values(shop,auth.uid(),p_action,person,v);
 end if;
 select jsonb_build_object('contract','bc-shop-release-v1','managed',pol.shop_release_mode,'policy_version',pol.version,'pause_version',ctl.version,
 'running',not ctl.paused and pol.enabled and pol.assisted_access_enabled and pol.background_access_enabled,
 'shops',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'version',coalesce(rel.version,0),'enabled',case when pol.shop_release_mode then coalesce(rel.enabled,false) else coalesce(pol.pilot_shop_id=b.id,false) end,
 'customers',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(nullif(f.full_name,''),'Cliente'),'allowed',case when pol.shop_release_mode then exists(select 1 from public.whatsapp_shop_release_customers c where c.barbershop_id=b.id and c.customer_id=m.user_id) else coalesce(pol.pilot_shop_id=b.id and pol.pilot_customer_id=m.user_id,false) end,'ready',public.care_shop_preparation_ready(b.id,m.user_id)) order by f.full_name,m.user_id)
 from public.memberships m join public.profiles f on f.id=m.user_id where m.barbershop_id=b.id and m.role='customer'),'[]'::jsonb)) order by b.name,b.id)
 from public.barbershops b left join public.whatsapp_shop_releases rel on rel.barbershop_id=b.id where public.whatsapp_complete_shop(b.id)),'[]'::jsonb)) into result
 from public.whatsapp_care_cycle_policy pol cross join public.whatsapp_send_controls ctl where pol.singleton and ctl.scope='global';
 return result;
end $$;

-- Plano de consulta para os números do cliente/loja selecionados. Não dá permissão.
create function public.care_shop_release_check(p_shop uuid,p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;numbers jsonb;targets jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 if not public.whatsapp_complete_shop(p_shop) or not exists(select 1 from public.memberships where barbershop_id=p_shop and user_id=p_customer and role='customer') then raise exception 'GROUP_INVALID';end if;
 select * into g from public.whatsapp_care_groups where barbershop_id=p_shop and customer_id=p_customer;
 numbers:=public.care_cycle_composition(p_shop,g.current_cycle_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'phone',n->>'phone','version',c.routing_version) order by n->>'id'),'[]') into targets
 from jsonb_array_elements(numbers) n join public.whatsapp_channels c on c.id=(n->>'id')::uuid;
 return jsonb_build_object('targets',targets,'fingerprint',md5(jsonb_build_object('shop',p_shop,'customer',p_customer,'cycle',g.current_cycle_id,'composition',numbers,'targets',targets)::text));
end $$;
revoke all on function public.care_shop_scope_allows(uuid,uuid),public.care_shop_preparation_ready(uuid,uuid),public.care_shop_release_admin(text,jsonb),public.care_shop_release_check(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.care_shop_release_admin(text,jsonb),public.care_shop_release_check(uuid,uuid) to authenticated;
notify pgrst,'reload schema';

-- Uma loja não ocupa todas as quatro vagas antes das outras. Mantém leases e prazos.
create or replace function public.care_entry_background_queue() returns jsonb
language sql volatile security definer set search_path=public as $$
 with candidates as (
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
 ), ranked as (
 select c.*,row_number() over(partition by c.shop order by coalesce(p.checked_at,'-infinity'),c.requested_at,c.intent) as position,
 coalesce(p.checked_at,'-infinity') as checked_at
 from candidates c left join public.whatsapp_entry_progress p on p.barbershop_id=c.shop and p.customer_id=c."user"
 ), picked as (select * from ranked order by position,checked_at,requested_at,shop,intent limit 4)
 select coalesce(jsonb_agg(jsonb_build_object('user',"user",'shop',shop,'group',"group",'kind',kind,'intent',intent) order by position,checked_at,requested_at,shop,intent),'[]'::jsonb) from picked;
$$;
