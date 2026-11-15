-- P-122: acompanhamento autenticado de primeiro acesso. Somente local; desligado por padrão.
-- Incremental sobre acolhimento + safeupdate já instalados. Não altera identidade ou diário Evolution.
create temporary table bc_assisted_read_identity on commit drop as
 select oid,proowner,proacl from pg_proc where oid='public.care_group_read(uuid,uuid)'::regprocedure;
do $$begin
 if (select md5(prosrc) from pg_proc where oid='public.care_group_read(uuid,uuid)'::regprocedure) is distinct from '4b358eb1adb5aadbda8f2ee0352831be'
  or (select md5(prosrc) from pg_proc where oid='public.record_care_cycle_observation(uuid,uuid,jsonb,jsonb,text)'::regprocedure) is distinct from '65d6e5973a2a64a1318f485c50243e68' then raise exception 'BC_ACESSO_BASE_DIVERGENTE';end if;
 if not exists(select 1 from public.whatsapp_send_controls where scope='global' and paused)
  or exists(select 1 from public.whatsapp_care_cycle_policy where enabled) then raise exception 'BC_PAUSAR_GRUPOS_ANTES_DO_AJUSTE';end if;
 if exists(select 1 from public.whatsapp_care_cycles where lease_until>clock_timestamp()) then raise exception 'BC_AGUARDAR_OPERACOES_EM_ANDAMENTO';end if;
end $$;
alter table public.whatsapp_care_cycle_policy add column assisted_access_enabled boolean not null default false;
create table public.whatsapp_care_access (
 barbershop_id uuid not null references public.barbershops(id) on delete cascade,
 customer_id uuid not null references public.profiles(id) on delete cascade,
 id uuid not null unique default gen_random_uuid(), phone text not null, numbers jsonb not null,
 profile_phone text, profile_verified_at timestamptz,
 group_id uuid references public.whatsapp_care_groups(id) on delete cascade,
 cycle_id uuid, admission_id uuid,
 requested_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '20 minutes',
 next_at timestamptz not null default clock_timestamp(),lease_token uuid,lease_until timestamptz,
 primary key(barbershop_id,customer_id)
);
alter table public.whatsapp_care_access enable row level security;
revoke all on public.whatsapp_care_access from public,anon,authenticated,service_role;

-- Não concede autorização de transmissão: verifica intenção/escopo, com provas live separadas.
create function public.care_access_valid(p_id uuid,p_user uuid) returns boolean
language sql volatile security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_care_access a
 join public.profiles p on p.id=a.customer_id join auth.users u on u.id=p.id
 left join public.whatsapp_care_groups g on g.id=a.group_id
 left join public.whatsapp_care_cycles c on c.id=a.cycle_id
 where a.id=p_id and a.customer_id=p_user and a.expires_at>clock_timestamp()
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp())
 and exists(select 1 from public.whatsapp_care_cycle_policy where singleton and assisted_access_enabled)
 and public.care_cycle_policy_allows(a.barbershop_id,a.customer_id)
 and not public.whatsapp_sending_paused('',false) and public.whatsapp_complete_shop(a.barbershop_id)
 and exists(select 1 from public.memberships where user_id=a.customer_id and barbershop_id=a.barbershop_id and role='customer')
 and p.whatsapp_e164 is not distinct from a.profile_phone and p.whatsapp_verified_at is not distinct from a.profile_verified_at
 and not exists(select 1 from public.profiles where id<>a.customer_id and whatsapp_e164=a.phone and whatsapp_verified_at is not null)
 and a.numbers=public.care_cycle_composition(a.barbershop_id,a.cycle_id)
 and public.care_cycle_composition_valid(a.numbers,false)
 and not exists(select 1 from jsonb_array_elements(a.numbers) n where n->>'phone'=a.phone or public.whatsapp_sending_paused(n->>'instance',false))
 and (a.group_id is null or (g.customer_id=a.customer_id and g.barbershop_id=a.barbershop_id and g.customer_phone=a.phone and g.revoked_at is null and g.reason<>'operator_pause'))
 and (a.cycle_id is null or (g.current_cycle_id=c.id and c.group_id=g.id and c.customer_phone=a.phone and c.admission_id=a.admission_id
  and c.state not in ('closing','closed','customer_left','creation_unknown') and (c.expires_at is null or c.expires_at>clock_timestamp())))
 );
$$;
create function public.care_access_start(p_shop uuid,p_phone text,p_accounts uuid[],p_accept boolean,p_group uuid default null,p_version bigint default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;p public.profiles%rowtype;a public.whatsapp_care_access%rowtype;c public.whatsapp_care_cycles%rowtype;phone text;numbers jsonb;expected uuid[];supplied uuid[];
begin
 if auth.uid() is null or not exists(select 1 from public.memberships where user_id=auth.uid() and barbershop_id=p_shop and role='customer') then raise exception 'Sem permissão' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 perform pg_advisory_xact_lock(hashtextextended('group-enrollment',120));
 if p_accept is distinct from true or not public.care_cycle_policy_allows(p_shop,auth.uid()) or public.whatsapp_sending_paused('',false)
  or not exists(select 1 from public.whatsapp_care_cycle_policy where singleton and assisted_access_enabled) then raise exception 'GROUP_UNAVAILABLE';end if;
 select * into p from public.profiles where id=auth.uid();phone:=public.normalize_br_whatsapp(p_phone);
 if phone is null or (p.whatsapp_verified_at is not null and p.whatsapp_e164 is distinct from phone)
  or exists(select 1 from public.profiles where id<>p.id and whatsapp_e164=phone and whatsapp_verified_at is not null) then raise exception 'GROUP_PHONE_UNAVAILABLE';end if;
 select * into g from public.whatsapp_care_groups where barbershop_id=p_shop and customer_id=p.id for update;
 if g.id is distinct from p_group or (g.id is not null and g.version is distinct from p_version) then raise exception 'GROUP_STALE';end if;
 if g.id is not null and g.customer_phone<>phone then raise exception 'GROUP_PHONE_UNAVAILABLE';end if;
 select * into c from public.whatsapp_care_cycles where id=g.current_cycle_id;
 if g.revoked_at is not null or g.reason='operator_pause' or c.state in ('closing','closed','customer_left','creation_unknown') then raise exception 'GROUP_REVIEW_REQUIRED';end if;
 if exists(select 1 from public.whatsapp_group_enrollments where group_id=g.id and (profile_phone is distinct from p.whatsapp_e164 or profile_verified_at is distinct from p.whatsapp_verified_at)) then raise exception 'GROUP_PHONE_UNAVAILABLE';end if;
 numbers:=public.care_cycle_composition(p_shop,g.current_cycle_id);
 select array_agg((n->>'id')::uuid order by (n->>'id')::uuid) into expected from jsonb_array_elements(numbers) n;
 select array_agg(x order by x) into supplied from unnest(p_accounts) x;
 if expected is distinct from supplied or not public.care_cycle_composition_valid(numbers,false)
  or (c.id is not null and c.consented_numbers<>numbers) then raise exception 'GROUP_PARTICIPANTS_CHANGED';end if;
 select * into a from public.whatsapp_care_access where barbershop_id=p_shop and customer_id=p.id for update;
 if a.id is not null and a.expires_at>clock_timestamp() and a.phone=phone and a.numbers=numbers and a.group_id is not distinct from g.id
  and a.cycle_id is not distinct from c.id and a.admission_id is not distinct from c.admission_id and a.profile_phone is not distinct from p.whatsapp_e164 and a.profile_verified_at is not distinct from p.whatsapp_verified_at then
  if not public.care_access_valid(a.id,p.id) then raise exception 'GROUP_UNAVAILABLE';end if;return a.id;
 end if;
 if a.lease_until>clock_timestamp() or a.requested_at>clock_timestamp()-interval '30 seconds' then raise exception 'WA_RATE_LIMIT';end if;
 insert into public.whatsapp_care_access(barbershop_id,customer_id,phone,numbers,profile_phone,profile_verified_at,group_id,cycle_id,admission_id)
 values(p_shop,p.id,phone,numbers,p.whatsapp_e164,p.whatsapp_verified_at,g.id,c.id,c.admission_id)
 on conflict(barbershop_id,customer_id) do update set id=gen_random_uuid(),phone=excluded.phone,numbers=excluded.numbers,profile_phone=excluded.profile_phone,profile_verified_at=excluded.profile_verified_at,
  group_id=excluded.group_id,cycle_id=excluded.cycle_id,admission_id=excluded.admission_id,requested_at=clock_timestamp(),expires_at=clock_timestamp()+interval '20 minutes',next_at=clock_timestamp(),lease_token=null,lease_until=null returning id into a.id;
 if not public.care_access_valid(a.id,p.id) then raise exception 'GROUP_UNAVAILABLE';end if;
 insert into public.whatsapp_care_audit(group_id,actor,action,detail) values(g.id,p.id,'assisted_access_requested',jsonb_build_object('access_id',a.id,'source','application'));
 return a.id;
end $$;

create function public.claim_care_access(p_user uuid,p_shop uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.whatsapp_care_access%rowtype;targets jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 select * into a from public.whatsapp_care_access where barbershop_id=p_shop and customer_id=p_user for update;
 if a.id is null or not public.care_access_valid(a.id,p_user) then return null;end if;
 if a.lease_until>clock_timestamp() or a.next_at>clock_timestamp() then return jsonb_build_object('waiting',true);end if;
 update public.whatsapp_care_access set lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',next_at=clock_timestamp()+interval '10 seconds' where id=a.id returning * into a;
 select jsonb_agg(n||jsonb_build_object('version',w.routing_version)) into targets from jsonb_array_elements(a.numbers) n join public.whatsapp_channels w on w.id=(n->>'id')::uuid;
 return jsonb_build_object('id',a.id,'token',a.lease_token,'targets',targets);
end $$;
create function public.record_care_access_connections(p_id uuid,p_user uuid,p_token uuid,p_observations jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare a public.whatsapp_care_access%rowtype;o jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into a from public.whatsapp_care_access where id=p_id and customer_id=p_user and lease_token=p_token and lease_until>clock_timestamp() for update;
 if a.id is null or not public.care_access_valid(a.id,p_user) then raise exception 'GROUP_STALE';end if;
 if jsonb_typeof(p_observations) is distinct from 'array' or jsonb_array_length(p_observations)<>jsonb_array_length(a.numbers)
  or (select count(distinct n->>'id') from jsonb_array_elements(p_observations) n)<>jsonb_array_length(a.numbers) then raise exception 'GROUP_STALE';end if;
 for o in select value from jsonb_array_elements(p_observations) loop
  if not exists(select 1 from jsonb_array_elements(a.numbers) n join public.whatsapp_channels w on w.id=(n->>'id')::uuid where n->>'id'=o->>'id' and n->>'phone'=o->>'phone' and n->>'instance'=o->>'instance' and w.routing_version=(o->>'version')::bigint) then raise exception 'GROUP_STALE';end if;
  perform public.record_whatsapp_distribution_connection((o->>'id')::uuid,o->>'instance',o->>'phone',(o->>'version')::bigint,o->>'status',o->>'observed_phone');
 end loop;
end $$;
-- Chamado com o JWT do titular: o contrato original conserva prova live, consentimento e matrícula.
create function public.resume_care_access(p_id uuid,p_token uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare a public.whatsapp_care_access%rowtype;g public.whatsapp_care_groups%rowtype;result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 perform pg_advisory_xact_lock(hashtextextended('group-enrollment',120));
 select * into a from public.whatsapp_care_access where id=p_id and customer_id=auth.uid() and lease_token=p_token and lease_until>clock_timestamp() for update;
 if a.id is null or not public.care_access_valid(a.id,auth.uid()) then raise exception 'GROUP_STALE';end if;
 if a.cycle_id is null or exists(select 1 from public.whatsapp_group_enrollments where group_id=a.group_id and expires_at<=clock_timestamp()) then
  -- A criação original usa a mesma identidade e tem diário idempotente; nunca recebe novo JID deste contrato.
  result:=public.care_group_begin(a.barbershop_id,true,array(select (n->>'id')::uuid from jsonb_array_elements(a.numbers) n),a.phone);
  select * into g from public.whatsapp_care_groups where barbershop_id=a.barbershop_id and customer_id=a.customer_id;
  update public.whatsapp_care_access set group_id=g.id,cycle_id=g.current_cycle_id,admission_id=(select admission_id from public.whatsapp_care_cycles where id=g.current_cycle_id) where id=a.id returning * into a;
 end if;
 return a.cycle_id;
end $$;
create function public.finish_care_access(p_id uuid,p_user uuid,p_token uuid,p_failed boolean default false) returns void
language sql security definer set search_path=public as $$
 update public.whatsapp_care_access set lease_token=null,lease_until=null,next_at=clock_timestamp()+case when p_failed then interval '30 seconds' else interval '10 seconds' end
 where id=p_id and customer_id=p_user and lease_token=p_token;
$$;

-- Mantém a leitura legada e os grants existentes; só acrescenta o contrato explícito da automação.
do $$declare definition text;copied text;begin
 definition:=pg_get_functiondef('public.care_group_read(uuid,uuid)'::regprocedure);
 copied:=replace(definition,'CREATE OR REPLACE FUNCTION public.care_group_read(','CREATE OR REPLACE FUNCTION public.care_group_read_before_assisted(');
 if copied=definition then raise exception 'BC_ACESSO_BASE_DIVERGENTE';end if;
 execute copied;
end $$;
revoke all on function public.care_group_read_before_assisted(uuid,uuid) from public,anon,authenticated,service_role;
create or replace function public.care_group_read(p_shop uuid,p_customer uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;a public.whatsapp_care_access%rowtype;available boolean;
begin
 result:=public.care_group_read_before_assisted(p_shop,p_customer);
 available:=coalesce((result->>'enabled')::boolean,false) and not public.whatsapp_sending_paused('',false);
 select * into a from public.whatsapp_care_access where barbershop_id=p_shop and customer_id=auth.uid();
 return result||jsonb_build_object('enabled',available,'access',jsonb_build_object('contract','bc-assisted-v1',
  'enabled',available and exists(select 1 from public.whatsapp_care_cycle_policy where singleton and assisted_access_enabled),
  'active',coalesce(public.care_access_valid(a.id,auth.uid()),false),'expires_at',a.expires_at,'next_check_at',a.next_at));
end $$;
create function public.care_access_admin(p_enabled boolean,p_version bigint) returns bigint
language plpgsql security definer set search_path=public as $$
declare version bigint;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 update public.whatsapp_care_cycle_policy set assisted_access_enabled=p_enabled,version=whatsapp_care_cycle_policy.version+1,changed_by=auth.uid(),changed_at=now() where singleton and whatsapp_care_cycle_policy.version=p_version returning whatsapp_care_cycle_policy.version into version;
 if version is null then raise exception 'GROUP_STALE';end if;
 return version;
end $$;
revoke all on function public.care_access_valid(uuid,uuid),public.care_access_start(uuid,text,uuid[],boolean,uuid,bigint),public.claim_care_access(uuid,uuid),public.record_care_access_connections(uuid,uuid,uuid,jsonb),public.resume_care_access(uuid,uuid),public.finish_care_access(uuid,uuid,uuid,boolean),public.care_access_admin(boolean,bigint) from public,anon,authenticated,service_role;
grant execute on function public.care_access_start(uuid,text,uuid[],boolean,uuid,bigint),public.resume_care_access(uuid,uuid),public.care_access_admin(boolean,bigint) to authenticated;
grant execute on function public.claim_care_access(uuid,uuid),public.record_care_access_connections(uuid,uuid,uuid,jsonb),public.finish_care_access(uuid,uuid,uuid,boolean) to service_role;

do $$begin
 if exists(select 1 from bc_assisted_read_identity old join pg_proc now on now.oid=old.oid where old.proowner is distinct from now.proowner or old.proacl is distinct from now.proacl)
  or not exists(select 1 from bc_assisted_read_identity where oid='public.care_group_read(uuid,uuid)'::regprocedure) then raise exception 'BC_ACESSO_IDENTIDADE_ALTERADA';end if;
end $$;
