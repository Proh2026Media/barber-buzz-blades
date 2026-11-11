-- Nº 106. Preparação local: nenhuma criação ou mensagem real nesta migration.
-- A Evolution 2.3.7 não comprova todos os controles obrigatórios: nasce desativado.
create table public.whatsapp_group_settings (
  singleton boolean primary key default true check(singleton),
  enrollment_enabled boolean not null default false
);
insert into public.whatsapp_group_settings default values;
create table public.whatsapp_group_accounts (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  channel_id uuid not null references public.whatsapp_channels(id),
  authorized_by uuid references auth.users(id) on delete set null,
  authorized_at timestamptz not null default now(),
  enabled boolean not null default true,
  unique(barbershop_id,channel_id)
);
create table public.whatsapp_care_groups (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid references public.whatsapp_group_accounts(id),
  provider text not null default 'evolution',
  group_jid text unique check(group_jid ~ '^[0-9-]+@g\.us$'),
  approved_accounts uuid[] not null default '{}',
  approved_account_identities jsonb not null default '{}',
  customer_phone text not null check(customer_phone ~ '^\+[1-9][0-9]{7,14}$'),
  state text not null default 'requested' check(state in
    ('requested','creating','waiting_customer','active','paused_divergence','paused_unavailable','customer_left','closed','creation_unknown')),
  use_group boolean not null default false,
  version bigint not null default 1,
  consent_version text not null default 'grupos-2026-11-11',
  requested_at timestamptz not null default now(),
  revoked_at timestamptz,
  notifications boolean not null default false,
  review_invites boolean not null default false,
  return_on date,
  human_until timestamptz,
  observed_at timestamptz,
  controls_verified boolean not null default false,
  observed_participants jsonb not null default '[]' check(jsonb_typeof(observed_participants)='array'),
  reason text not null default 'capabilities_unavailable',
  unique(barbershop_id,customer_id)
);
create table public.whatsapp_care_participants (
  group_id uuid not null references public.whatsapp_care_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check(role in ('owner','associate','employee')),
  proposed_at timestamptz not null default now(),
  approved_at timestamptz,
  revoked_at timestamptz,
  primary key(group_id,user_id)
);
create table public.whatsapp_care_operations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.whatsapp_care_groups(id) on delete cascade,
  kind text not null check(kind in ('create','reconcile','remove','close')),
  version bigint not null,
  state text not null default 'pending' check(state in ('pending','running','accepted','unknown','blocked')),
  lease_token uuid, lease_until timestamptz, started_at timestamptz,
  created_at timestamptz not null default now(),
  unique(group_id,kind,version)
);
create table public.whatsapp_care_audit (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.whatsapp_care_groups(id) on delete cascade,
  actor uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
-- Convites não entram nos diretórios nem nas respostas para a equipe.
create table public.whatsapp_care_invites (
  group_id uuid primary key references public.whatsapp_care_groups(id) on delete cascade,
  invite_url text not null check(invite_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+$'),
  expires_at timestamptz not null,
  version bigint not null
);
create table public.whatsapp_customer_contact_preferences (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  monthly_marketing integer not null default 0 check(monthly_marketing in (0,1,3)),
  proactive_paused boolean not null default false,
  changed_at timestamptz not null default now(),
  consent_version text not null default 'grupos-2026-11-11'
);
create table public.whatsapp_care_events (
  event_key text primary key,
  group_id uuid not null references public.whatsapp_care_groups(id) on delete cascade,
  kind text not null,
  received_at timestamptz not null default now()
);
do $$ declare n text; begin
  foreach n in array array['whatsapp_group_settings','whatsapp_group_accounts','whatsapp_care_groups',
    'whatsapp_care_participants','whatsapp_care_operations','whatsapp_care_audit','whatsapp_care_invites',
    'whatsapp_customer_contact_preferences','whatsapp_care_events'] loop
    execute format('alter table public.%I enable row level security',n);
    execute format('revoke all on public.%I from public,anon,authenticated',n);
    execute format('grant select,insert,update,delete on public.%I to service_role',n);
  end loop;
end $$;

create function public.care_group_member_valid(p_group uuid,p_user uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.whatsapp_care_groups g join public.shop_members m on m.barbershop_id=g.barbershop_id
    join public.profiles p on p.id=m.user_id where g.id=p_group and m.user_id=p_user and m.active
    and m.role in ('owner','partner','associate','employee') and p.whatsapp_verified_at is not null);
$$;

create function public.care_group_read(p_shop uuid,p_customer uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare person uuid:=coalesce(p_customer,auth.uid()); g public.whatsapp_care_groups%rowtype; own boolean;
begin
  if auth.uid() is null then raise exception 'Sem permissão' using errcode='42501'; end if;
  own:=person=auth.uid();
  select * into g from public.whatsapp_care_groups where barbershop_id=p_shop and customer_id=person;
  if not own and not public.is_platform_admin() and not exists(
    select 1 from public.whatsapp_care_participants p where p.group_id=g.id and p.user_id=auth.uid()
      and p.approved_at is not null and p.revoked_at is null and public.care_group_member_valid(g.id,auth.uid())) then
    raise exception 'Sem permissão' using errcode='42501'; end if;
  return jsonb_build_object('enabled',(select enrollment_enabled from public.whatsapp_group_settings),
    'group',case when g.id is null then null else jsonb_build_object('id',g.id,'state',g.state,'version',g.version,
      'notifications',g.notifications,'review_invites',g.review_invites,'return_on',g.return_on,
      'reason',g.reason,'observed_at',g.observed_at) end,
    'preferences',case when own then (select to_jsonb(p)-'customer_id' from public.whatsapp_customer_contact_preferences p where customer_id=person) else null end,
    'participants',coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'name',u.full_name,'role',p.role,
      'approved',p.approved_at is not null,'revoked',p.revoked_at is not null)) from public.whatsapp_care_participants p
      join public.profiles u on u.id=p.user_id where p.group_id=g.id),'[]'::jsonb),
    'platform_participants',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',n.label,'phone',n.display_phone))
      from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id
      where a.barbershop_id=p_shop and a.enabled),'[]'::jsonb));
end $$;

create function public.care_group_request(p_shop uuid,p_accept boolean,p_accounts uuid[]) returns jsonb
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype; phone text; accounts uuid[];
begin
  if auth.uid() is null then raise exception 'Sem permissão' using errcode='42501'; end if;
  if p_accept is distinct from true or not (select enrollment_enabled from public.whatsapp_group_settings) then raise exception 'GROUP_UNAVAILABLE'; end if;
  if not exists(select 1 from public.barbershops where id=p_shop and status='active') then raise exception 'GROUP_UNAVAILABLE'; end if;
  select whatsapp_e164 into phone from public.profiles where id=auth.uid() and whatsapp_verified_at is not null;
  if phone is null then raise exception 'GROUP_PHONE_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_shop::text||auth.uid()::text,121));
  select * into g from public.whatsapp_care_groups where barbershop_id=p_shop and customer_id=auth.uid() for update;
  if g.id is not null then return public.care_group_read(p_shop); end if;
  select array_agg(id order by id) into accounts from public.whatsapp_group_accounts where barbershop_id=p_shop and enabled;
  if accounts is null or accounts is distinct from (select array_agg(x order by x) from unnest(p_accounts) x) then raise exception 'GROUP_PARTICIPANTS_CHANGED'; end if;
  insert into public.whatsapp_care_groups(barbershop_id,customer_id,customer_phone,approved_accounts) values(p_shop,auth.uid(),phone,accounts) returning * into g;
  update public.whatsapp_care_groups set approved_account_identities=(
    select jsonb_object_agg(a.id::text,jsonb_build_object('phone',n.display_phone,'instance',n.instance_name))
    from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.id=any(accounts)) where id=g.id;
  insert into public.whatsapp_care_operations(group_id,kind,version) values(g.id,'create',g.version);
  insert into public.whatsapp_care_audit(group_id,actor,action,detail) values(g.id,auth.uid(),'requested',jsonb_build_object('consent_version',g.consent_version,'platform_accounts',to_jsonb(accounts)));
  -- Adesão não cria consentimento de marketing nem substitui preferência anterior.
  insert into public.whatsapp_customer_contact_preferences(customer_id) values(auth.uid()) on conflict do nothing;
  return public.care_group_read(p_shop);
end $$;

create function public.care_group_customer_update(p_group uuid,p_version bigint,p_action text,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype; target uuid; cap integer; accounts uuid[]; phone text;
begin
  select * into g from public.whatsapp_care_groups where id=p_group and customer_id=auth.uid() for update;
  if g.id is null then raise exception 'Sem permissão' using errcode='42501'; end if;
  if g.version is distinct from p_version then raise exception 'GROUP_STALE'; end if;
  if p_action='preferences' then
    if g.state in ('closed','customer_left') then raise exception 'GROUP_INVALID'; end if;
    if (p_values->>'return_on')::date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'GROUP_INVALID'; end if;
    cap:=(p_values->>'monthly_marketing')::integer;
    if cap is null or cap not in (0,1,3) then raise exception 'GROUP_INVALID'; end if;
    update public.whatsapp_care_groups set notifications=coalesce((p_values->>'notifications')::boolean,false),
      review_invites=coalesce((p_values->>'review_invites')::boolean,false),return_on=(p_values->>'return_on')::date where id=g.id;
    insert into public.whatsapp_customer_contact_preferences(customer_id,monthly_marketing,proactive_paused)
      values(g.customer_id,cap,coalesce((p_values->>'proactive_paused')::boolean,false)) on conflict(customer_id) do update
      set monthly_marketing=excluded.monthly_marketing,proactive_paused=excluded.proactive_paused,changed_at=now();
    -- A escolha de ofertas é específica e explícita; as outras preferências não são alteradas.
    insert into public.customer_privacy(user_id,marketing) values(g.customer_id,cap>0)
      on conflict(user_id) do update set marketing=excluded.marketing;
  elsif p_action in ('approve_participant','remove_participant') then
    target:=(p_values->>'user_id')::uuid;
    if not exists(select 1 from public.whatsapp_care_participants where group_id=g.id and user_id=target)
      or (p_action='approve_participant' and not public.care_group_member_valid(g.id,target)) then raise exception 'GROUP_INVALID'; end if;
    update public.whatsapp_care_participants set approved_at=case when p_action='approve_participant' then now() else approved_at end,
      revoked_at=case when p_action='remove_participant' then now() else null end where group_id=g.id and user_id=target;
    update public.whatsapp_care_groups set state='paused_divergence',controls_verified=false,reason='participants_changed' where id=g.id;
    insert into public.whatsapp_care_operations(group_id,kind,version) values(g.id,case when p_action='remove_participant' then 'remove' else 'reconcile' end,g.version+1);
  elsif p_action='close' then
    update public.whatsapp_care_groups set state='closed',revoked_at=now(),notifications=false,review_invites=false,return_on=null,controls_verified=false,reason='customer_request' where id=g.id;
    delete from public.whatsapp_care_invites where group_id=g.id;
    insert into public.whatsapp_care_operations(group_id,kind,version) values(g.id,'close',g.version+1);
  elsif p_action='rejoin' then
    if g.state not in ('closed','customer_left') or (p_values->>'accept')::boolean is distinct from true then raise exception 'GROUP_INVALID'; end if;
    if not (select enrollment_enabled from public.whatsapp_group_settings) then raise exception 'GROUP_UNAVAILABLE'; end if;
    select array_agg(id order by id) into accounts from public.whatsapp_group_accounts where barbershop_id=g.barbershop_id and enabled;
    if accounts is null or accounts is distinct from (select array_agg(x::uuid order by x::uuid) from jsonb_array_elements_text(p_values->'accounts') x) then raise exception 'GROUP_PARTICIPANTS_CHANGED'; end if;
    select whatsapp_e164 into phone from public.profiles where id=g.customer_id and whatsapp_verified_at is not null;
    if phone is null then raise exception 'GROUP_PHONE_REQUIRED'; end if;
    update public.whatsapp_care_groups set approved_accounts=accounts,customer_phone=phone,
      approved_account_identities=(select jsonb_object_agg(a.id::text,jsonb_build_object('phone',n.display_phone,'instance',n.instance_name))
        from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.id=any(accounts)),
      state=case when group_jid is null then 'requested' else 'waiting_customer' end,
      revoked_at=null,notifications=false,review_invites=false,return_on=null,controls_verified=false,reason='review_required' where id=g.id;
    update public.whatsapp_customer_contact_preferences set monthly_marketing=0,changed_at=now() where customer_id=g.customer_id;
    update public.customer_privacy set marketing=false where user_id=g.customer_id;
    update public.whatsapp_care_participants set approved_at=null,revoked_at=now() where group_id=g.id;
    insert into public.whatsapp_care_operations(group_id,kind,version) values(g.id,'reconcile',g.version+1);
  else raise exception 'GROUP_INVALID'; end if;
  update public.whatsapp_care_groups set version=version+1 where id=g.id;
  if p_action='preferences' then
    insert into public.whatsapp_care_operations(group_id,kind,version) values(g.id,'reconcile',g.version+1);
  end if;
  insert into public.whatsapp_care_audit(group_id,actor,action,detail) values(g.id,auth.uid(),p_action,
    case when p_action='preferences' then jsonb_build_object('monthly_marketing',cap,'consent_version','grupos-2026-11-11') else jsonb_build_object('participant',target) end);
  return public.care_group_read(g.barbershop_id);
end $$;

create function public.care_group_admin(p_action text,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype; target uuid; role_name text;
begin
  -- Rejeição retorna normalmente para conservar auditoria da tentativa proibida.
  if not public.is_platform_admin() then
    if auth.uid() is not null then insert into public.whatsapp_care_audit(actor,action) values(auth.uid(),'denied_admin'); end if;
    return jsonb_build_object('denied',true);
  end if;
  if p_action='enrollment' then
    update public.whatsapp_group_settings set enrollment_enabled=coalesce((p_values->>'enabled')::boolean,false);
  elsif p_action='authorize_account' then
    if (p_values->>'platform_owned')::boolean is distinct from true or not exists(select 1 from public.whatsapp_channels
      where id=(p_values->>'channel_id')::uuid and display_phone is not null) then raise exception 'GROUP_INVALID'; end if;
    insert into public.whatsapp_group_accounts(barbershop_id,channel_id,authorized_by)
      values((p_values->>'shop_id')::uuid,(p_values->>'channel_id')::uuid,auth.uid()) on conflict(barbershop_id,channel_id)
      do update set enabled=true,authorized_by=auth.uid(),authorized_at=now();
  elsif p_action='revoke_account' then
    update public.whatsapp_group_accounts set enabled=false where id=(p_values->>'account_id')::uuid;
    update public.whatsapp_care_groups set state=case when state in ('closed','customer_left','creation_unknown') then state else 'paused_unavailable' end,controls_verified=false,reason='account_revoked',version=version+1
      where barbershop_id in(select barbershop_id from public.whatsapp_group_accounts where id=(p_values->>'account_id')::uuid);
  elsif p_action in ('propose_participant','pause','review') then
    select * into g from public.whatsapp_care_groups where id=(p_values->>'group_id')::uuid for update;
    if g.id is null or g.version is distinct from (p_values->>'version')::bigint then raise exception 'GROUP_STALE'; end if;
    if p_action='propose_participant' then
      target:=(p_values->>'user_id')::uuid;
      if target=g.customer_id or not public.care_group_member_valid(g.id,target) then raise exception 'GROUP_INVALID'; end if;
      select case when role in ('owner','partner') then 'owner' else role::text end into role_name
        from public.shop_members where barbershop_id=g.barbershop_id and user_id=target and active;
      insert into public.whatsapp_care_participants(group_id,user_id,role) values(g.id,target,role_name)
        on conflict(group_id,user_id) do update set role=excluded.role,approved_at=null,revoked_at=null,proposed_at=now();
    end if;
    update public.whatsapp_care_groups set controls_verified=false,reason=case when p_action='pause' then 'operator_pause' else 'review_required' end,
      state=case when state in ('closed','customer_left','creation_unknown') then state else 'paused_divergence' end,version=version+1 where id=g.id;
    if p_action='review' then insert into public.whatsapp_care_operations(group_id,kind,version) values(g.id,'reconcile',g.version+1); end if;
  elsif p_action<>'read' then raise exception 'GROUP_INVALID'; end if;
  if p_action<>'read' then insert into public.whatsapp_care_audit(group_id,actor,action) values(g.id,auth.uid(),p_action); end if;
  return jsonb_build_object('enabled',(select enrollment_enabled from public.whatsapp_group_settings),
    'capabilities_ready',false,'capability_reason','evolution_237_membership_controls',
    'accounts',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('shop_name',s.name,'number',n.display_phone))
      from public.whatsapp_group_accounts a join public.barbershops s on s.id=a.barbershop_id join public.whatsapp_channels n on n.id=a.channel_id),'[]'::jsonb),
    'groups',coalesce((select jsonb_agg(jsonb_build_object('id',cg.id,'shop_id',cg.barbershop_id,'shop_name',s.name,'customer_name',p.full_name,
      'customer_id',cg.customer_id,'state',cg.state,'version',cg.version,'reason',cg.reason,'observed_at',cg.observed_at))
      from public.whatsapp_care_groups cg join public.barbershops s on s.id=cg.barbershop_id join public.profiles p on p.id=cg.customer_id),'[]'::jsonb),
    'eligible_staff',coalesce((select jsonb_agg(jsonb_build_object('shop_id',m.barbershop_id,'user_id',m.user_id,'name',p.full_name)) from public.shop_members m join public.profiles p on p.id=m.user_id where m.active and p.whatsapp_verified_at is not null),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(a)) from(select id,group_id,actor,action,created_at from public.whatsapp_care_audit order by created_at desc limit 30) a),'[]'::jsonb));
end $$;

-- Mudança de equipe/telefone nunca aguarda um webhook para suspender a saída.
create function public.care_group_membership_changed() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' then
    if new.active is not distinct from old.active and new.role is not distinct from old.role and new.staff_id is not distinct from old.staff_id then return null; end if;
  end if;
  update public.whatsapp_care_groups g set controls_verified=false,state=case when state in ('closed','customer_left','creation_unknown') then state else 'paused_divergence' end,
    reason='membership_changed',version=version+1 where exists(select 1 from public.whatsapp_care_participants p where p.group_id=g.id
      and p.user_id=old.user_id and g.barbershop_id=old.barbershop_id and p.revoked_at is null);
  update public.whatsapp_care_participants p set revoked_at=now(),approved_at=null from public.whatsapp_care_groups g
    where p.group_id=g.id and p.user_id=old.user_id and g.barbershop_id=old.barbershop_id;
  insert into public.whatsapp_care_operations(group_id,kind,version)
    select g.id,'remove',g.version from public.whatsapp_care_groups g where g.barbershop_id=old.barbershop_id
      and exists(select 1 from public.whatsapp_care_participants p where p.group_id=g.id and p.user_id=old.user_id) on conflict do nothing;
  return null;
end $$;
create trigger care_group_membership_changed after update of active,role,staff_id or delete on public.shop_members
  for each row execute function public.care_group_membership_changed();

-- Provedor atual: não existe RPC para "marcar ativo" por mera decisão da interface.
-- O convite só pode ser liberado após uma reconciliação verificável pelo serviço.
create function public.care_group_invite(p_group uuid) returns text language plpgsql security definer set search_path=public as $$
declare url text;
begin
  select i.invite_url into url from public.whatsapp_care_invites i join public.whatsapp_care_groups g on g.id=i.group_id
    where g.id=p_group and g.customer_id=auth.uid() and g.state in ('waiting_customer','active')
      and g.revoked_at is null and g.controls_verified and g.observed_at>now()-interval '30 seconds'
      and i.version=g.version and i.expires_at>now()
      and (select enrollment_enabled from public.whatsapp_group_settings)
      and exists(select 1 from public.profiles p where p.id=g.customer_id and p.whatsapp_e164=g.customer_phone and p.whatsapp_verified_at is not null);
  if url is null then raise exception 'GROUP_INVITE_UNAVAILABLE'; end if;
  return url;
end $$;

-- Teto mensal global, independente de loja, grupo e remetente. Preserva consentimento existente.
create function public.care_marketing_allowed(p_customer uuid,p_event text default null) returns boolean
language plpgsql security definer set search_path=public as $$
declare cap integer; start_month timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_customer::text,116));
  select monthly_marketing into cap from public.whatsapp_customer_contact_preferences where customer_id=p_customer;
  cap:=coalesce(cap,3);
  start_month:=date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  return cap>0 and not exists(select 1 from public.whatsapp_customer_contact_preferences where customer_id=p_customer and proactive_paused)
    and (select count(*) from public.client_communication_budget where customer_id=p_customer and kind='marketing'
      and event_key is distinct from p_event and ((attempted_at>=start_month) or (attempted_at is null and expires_at>now())))<cap;
end $$;
alter function public.reserve_client_communication(uuid,uuid,text,text) rename to reserve_client_communication_before_groups;
create function public.reserve_client_communication(p_shop uuid,p_customer uuid,p_kind text,p_key text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if p_kind='marketing' and not public.care_marketing_allowed(p_customer,p_key) then return false; end if;
  if exists(select 1 from public.whatsapp_customer_contact_preferences where customer_id=p_customer and proactive_paused) then return false; end if;
  return public.reserve_client_communication_before_groups(p_shop,p_customer,p_kind,p_key);
end $$;
revoke all on function public.reserve_client_communication_before_groups(uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.reserve_client_communication(uuid,uuid,text,text),public.care_marketing_allowed(uuid,text),public.care_group_member_valid(uuid,uuid),public.care_group_membership_changed() from public,anon,authenticated;
grant execute on function public.reserve_client_communication(uuid,uuid,text,text),public.care_marketing_allowed(uuid,text) to service_role;

-- Conferência comum também alcança avisos individuais que já estavam na fila.
alter function public.authorize_whatsapp_send(text,uuid,uuid,uuid,text,text) rename to authorize_whatsapp_send_before_groups;
create function public.authorize_whatsapp_send(p_expected_instance text,p_outbox_id uuid default null,p_lease_token uuid default null,
  p_challenge_id uuid default null,p_instance text default null,p_code_hash text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_outbox%rowtype; person uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  if p_outbox_id is not null then
    select * into o from public.whatsapp_outbox where id=p_outbox_id;
    person:=public.whatsapp_recipient(o.barbershop_id,o.payload);
    if exists(select 1 from public.whatsapp_customer_contact_preferences where customer_id=person and proactive_paused)
      or (public.whatsapp_message_kind(o.template_key)='marketing' and not public.care_marketing_allowed(person,o.communication_key))
      or exists(select 1 from public.whatsapp_care_groups where customer_id=person and barbershop_id=o.barbershop_id and use_group) then
      -- Rota de grupo não é convertida silenciosamente em mensagem individual.
      return jsonb_build_object('reason','group_or_preference_blocked');
    end if;
  end if;
  return public.authorize_whatsapp_send_before_groups(p_expected_instance,p_outbox_id,p_lease_token,p_challenge_id,p_instance,p_code_hash);
end $$;
revoke all on function public.authorize_whatsapp_send_before_groups(text,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.authorize_whatsapp_send(text,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.authorize_whatsapp_send(text,uuid,uuid,uuid,text,text) to service_role;
revoke all on function public.care_group_read(uuid,uuid),public.care_group_request(uuid,boolean,uuid[]),public.care_group_customer_update(uuid,bigint,text,jsonb),
  public.care_group_admin(text,jsonb),public.care_group_invite(uuid) from public,anon;
grant execute on function public.care_group_read(uuid,uuid),public.care_group_request(uuid,boolean,uuid[]),public.care_group_customer_update(uuid,bigint,text,jsonb),
  public.care_group_admin(text,jsonb),public.care_group_invite(uuid) to authenticated;

-- Restrição preventiva já registrada na P-119; não modifica a migration instalada.
revoke insert,update,delete on public.whatsapp_delivery_channels from service_role;

create function public.claim_care_group_operation(p_operation uuid,p_capable boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_care_operations%rowtype; g public.whatsapp_care_groups%rowtype;
  a public.whatsapp_group_accounts%rowtype; n public.whatsapp_channels%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  select * into o from public.whatsapp_care_operations where id=p_operation for update;
  if o.id is null or o.state not in ('pending','blocked') or o.started_at is not null then return null; end if;
  select * into g from public.whatsapp_care_groups where id=o.group_id for update;
  if g.version<>o.version or g.state in ('closed','customer_left','creation_unknown') then return null; end if;
  if g.group_jid is null and exists(select 1 from public.whatsapp_care_operations previous
      where previous.group_id=g.id and previous.started_at is not null) then
    update public.whatsapp_care_groups set state='creation_unknown',controls_verified=false,reason='operation_unknown' where id=g.id;
    update public.whatsapp_care_operations set state='blocked' where id=o.id;
    return null;
  end if;
  if not (select enrollment_enabled from public.whatsapp_group_settings) or p_capable is distinct from true
    or o.kind not in ('create','reconcile') then
    update public.whatsapp_care_operations set state='blocked' where id=o.id;
    update public.whatsapp_care_groups set reason='capabilities_unavailable' where id=g.id;
    return null;
  end if;
  select a0.* into a from public.whatsapp_group_accounts a0 join public.whatsapp_channels n0 on n0.id=a0.channel_id
    where a0.id=any(g.approved_accounts) and a0.barbershop_id=g.barbershop_id and a0.enabled
      and (g.account_id is null or a0.id=g.account_id)
      and g.approved_account_identities->a0.id::text=jsonb_build_object('phone',n0.display_phone,'instance',n0.instance_name)
    order by a0.authorized_at,a0.id limit 1;
  select * into n from public.whatsapp_channels where id=a.channel_id;
  if exists(select 1 from public.whatsapp_care_operations x join public.whatsapp_care_groups y on y.id=x.group_id where y.account_id=a.id and x.state='running' and x.lease_until>now()) then return null; end if;
  if a.id is null or n.status<>'open' or public.whatsapp_sending_paused(n.instance_name,false) then return null; end if;
  if not exists(select 1 from public.profiles where id=g.customer_id and whatsapp_e164=g.customer_phone and whatsapp_verified_at is not null) then return null; end if;
  -- Uma operação ganha posse, mas a autorização de criação não pode ser recuperada após incerteza.
  update public.whatsapp_care_operations set state='running',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',started_at=now()
    where id=o.id returning * into o;
  update public.whatsapp_care_groups set account_id=a.id,state=case when group_jid is null then 'creating' else state end where id=g.id;
  return jsonb_build_object('id',o.id,'token',o.lease_token,'instance',n.instance_name,'group_jid',g.group_jid,
    'subject','Atendimento · Barba & Cabelo','platform_phones',jsonb_build_array(n.display_phone));
end $$;

create function public.finish_care_group_creation(p_operation uuid,p_token uuid,p_group_jid text) returns void
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_care_operations%rowtype;
begin
  select * into o from public.whatsapp_care_operations where id=p_operation and lease_token=p_token and state='running' for update;
  if o.id is null or p_group_jid is null or p_group_jid !~ '^[0-9-]+@g\.us$' then raise exception 'GROUP_STALE'; end if;
  -- Mesmo após expirar a posse, guardar o ID conhecido impede criar outro grupo.
  update public.whatsapp_care_groups set group_jid=p_group_jid,state=case when revoked_at is null then 'waiting_customer' else state end,
    reason='awaiting_verification' where id=o.group_id and (group_jid is null or group_jid=p_group_jid);
  if not found then raise exception 'GROUP_CONFLICT'; end if;
end $$;

create function public.fail_care_group_operation(p_operation uuid,p_token uuid,p_known_group text default null) returns void
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_care_operations%rowtype;
begin
  select * into o from public.whatsapp_care_operations where id=p_operation and lease_token=p_token and state='running' for update;
  if o.id is null then return; end if;
  update public.whatsapp_care_operations set state='unknown' where id=o.id;
  update public.whatsapp_care_groups set controls_verified=false,
    state=case when revoked_at is not null then state when group_jid is null then 'creation_unknown' else 'paused_unavailable' end,
    reason='operation_unknown' where id=o.group_id;
  insert into public.whatsapp_care_audit(group_id,action) values(o.group_id,'operation_unknown');
end $$;

create function public.observe_care_group(p_operation uuid,p_token uuid,p_snapshot jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_care_operations%rowtype; g public.whatsapp_care_groups%rowtype;
  member jsonb; phone text; customer_present boolean:=false; platform_admin boolean:=false;
  divergence boolean:=false; allowed_platform boolean; safe boolean; phones text[]:='{}';
begin
  select * into o from public.whatsapp_care_operations where id=p_operation and lease_token=p_token and state='running' and lease_until>now() for update;
  if o.id is null then raise exception 'GROUP_STALE'; end if;
  select * into g from public.whatsapp_care_groups where id=o.group_id for update;
  if g.version<>o.version or g.revoked_at is not null or g.state in ('customer_left','closed') then raise exception 'GROUP_STALE'; end if;
  if not (select enrollment_enabled from public.whatsapp_group_settings) or exists(
    select 1 from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id
    where a.id=g.account_id and (not a.enabled or n.status<>'open' or public.whatsapp_sending_paused(n.instance_name,false))) then raise exception 'GROUP_STALE'; end if;
  safe:=coalesce(p_snapshot->>'id'=g.group_jid and (p_snapshot->>'locked')::boolean and (p_snapshot->>'adminsAddOnly')::boolean
    and (p_snapshot->>'approvalRequired')::boolean and jsonb_typeof(p_snapshot->'participants')='array',false);
  if safe then
    for member in select value from jsonb_array_elements(p_snapshot->'participants') loop
      if member->>'jid' !~ '^[1-9][0-9]{7,14}@s\.whatsapp\.net$' then divergence:=true; exit; end if;
      phone:='+'||split_part(member->>'jid','@',1);
      if phone=any(phones) then divergence:=true; exit; end if;
      phones:=array_append(phones,phone);
      allowed_platform:=exists(select 1 from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id
        where a.id=any(g.approved_accounts) and a.enabled and a.barbershop_id=g.barbershop_id
          and g.approved_account_identities->a.id::text=jsonb_build_object('phone',n.display_phone,'instance',n.instance_name) and '+'||regexp_replace(n.display_phone,'[^0-9]','','g')=phone);
      if coalesce((member->>'admin')::boolean,false) then
        if not allowed_platform or phone=g.customer_phone or exists(select 1 from public.whatsapp_care_participants p join public.profiles u on u.id=p.user_id where p.group_id=g.id and u.whatsapp_e164=phone) then divergence:=true; exit; end if;
        platform_admin:=true;
      end if;
      if phone=g.customer_phone and exists(select 1 from public.profiles where id=g.customer_id and whatsapp_verified_at is not null and whatsapp_e164=phone) then customer_present:=true;
      elsif not allowed_platform and not exists(select 1 from public.whatsapp_care_participants p join public.profiles u on u.id=p.user_id
        where p.group_id=g.id and p.approved_at is not null and p.revoked_at is null and u.whatsapp_e164=phone
          and public.care_group_member_valid(g.id,u.id)) then divergence:=true; exit; end if;
    end loop;
  end if;
  update public.whatsapp_care_groups set observed_at=now(),observed_participants=coalesce(p_snapshot->'participants','[]'),
    controls_verified=safe and not divergence and platform_admin,
    state=case when not safe then 'paused_unavailable' when divergence or not platform_admin then 'paused_divergence'
      when not customer_present then case when use_group then 'customer_left' else 'waiting_customer' end else 'active' end,
    use_group=use_group or (safe and not divergence and platform_admin and customer_present),
    reason=case when not safe then 'controls_unverifiable' when divergence or not platform_admin then 'participants_changed'
      when not customer_present then 'customer_absent' else 'verified' end where id=g.id;
  update public.whatsapp_care_operations set state='accepted' where id=o.id;
  insert into public.whatsapp_care_audit(group_id,action) values(g.id,'observed');
end $$;

create function public.care_group_event(p_instance text,p_group_jid text,p_event_key text,p_kind text,
  p_sender text default null,p_stop text default null,p_from_me boolean default false) returns boolean
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype; inserted integer;
begin
  select g0.* into g from public.whatsapp_care_groups g0 join public.whatsapp_group_accounts a on a.id=g0.account_id
    join public.whatsapp_channels n on n.id=a.channel_id where g0.group_jid=p_group_jid and n.instance_name=p_instance for update of g0;
  if g.id is null or length(p_event_key)>128 or p_event_key is null then return false; end if;
  insert into public.whatsapp_care_events(event_key,group_id,kind) values(p_event_key,g.id,left(p_kind,50)) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 or p_from_me then return false; end if;
  if p_kind in ('group-participants.update','groups.update','connection.update') then
    update public.whatsapp_care_groups set controls_verified=false,reason='external_change',version=version+1,
      state=case when state in ('closed','customer_left','creation_unknown') then state else 'paused_divergence' end where id=g.id;
    insert into public.whatsapp_care_operations(group_id,kind,version) select id,'reconcile',version from public.whatsapp_care_groups where id=g.id on conflict do nothing;
  elsif p_kind='messages.upsert' and p_stop in ('all','marketing') then
    if p_sender=g.customer_phone then
      insert into public.whatsapp_customer_contact_preferences(customer_id,monthly_marketing,proactive_paused)
        values(g.customer_id,0,p_stop='all') on conflict(customer_id) do update set monthly_marketing=0,
        proactive_paused=whatsapp_customer_contact_preferences.proactive_paused or p_stop='all',changed_at=now();
      update public.customer_privacy set marketing=false where user_id=g.customer_id;
      insert into public.whatsapp_care_audit(group_id,actor,action) values(g.id,g.customer_id,'stop_'||p_stop);
    elsif p_sender is null then
      update public.whatsapp_care_groups set controls_verified=false,state='paused_divergence',reason='unidentified_sender',version=version+1
        where id=g.id and state not in ('closed','customer_left','creation_unknown');
    end if;
  end if;
  -- Ordem invertida nunca reativa: só uma leitura autoritativa pode reconciliar.
  return true;
end $$;

create function public.purge_care_group_audit() returns void language plpgsql security definer set search_path=public as $$
begin
  delete from public.whatsapp_care_events where received_at<now()-interval '30 days';
  delete from public.whatsapp_care_audit where created_at<now()-interval '180 days' and action not in ('requested','preferences','approve_participant','close','rejoin');
  delete from public.whatsapp_care_invites where expires_at<now();
  update public.whatsapp_care_operations set state='unknown' where state='running' and lease_until<now();
  update public.whatsapp_care_groups g set state=case when group_jid is null then 'creation_unknown' else 'paused_unavailable' end,
    controls_verified=false,reason='operation_unknown' where state in ('creating','waiting_customer') and exists(
      select 1 from public.whatsapp_care_operations o where o.group_id=g.id and o.state='unknown');
end $$;
revoke all on function public.claim_care_group_operation(uuid,boolean),public.finish_care_group_creation(uuid,uuid,text),
  public.fail_care_group_operation(uuid,uuid,text),public.observe_care_group(uuid,uuid,jsonb),
  public.care_group_event(text,text,text,text,text,text,boolean),public.purge_care_group_audit() from public,anon,authenticated;
grant execute on function public.claim_care_group_operation(uuid,boolean),public.finish_care_group_creation(uuid,uuid,text),
  public.fail_care_group_operation(uuid,uuid,text),public.observe_care_group(uuid,uuid,jsonb),
  public.care_group_event(text,text,text,text,text,text,boolean),public.purge_care_group_audit() to service_role;

create function public.care_group_identity_changed() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name='profiles' then
    if new.whatsapp_e164 is not distinct from old.whatsapp_e164 and new.whatsapp_verified_at is not distinct from old.whatsapp_verified_at then return null; end if;
    update public.whatsapp_care_participants set approved_at=null,revoked_at=now() where user_id=old.id;
    update public.whatsapp_care_groups g set controls_verified=false,version=version+1,reason='identity_changed',
      state=case when state in ('closed','customer_left','creation_unknown') then state else 'paused_divergence' end
      where customer_id=old.id or exists(select 1 from public.whatsapp_care_participants p where p.group_id=g.id and p.user_id=old.id);
  else
    if new.display_phone is not distinct from old.display_phone and new.instance_name is not distinct from old.instance_name then return null; end if;
    update public.whatsapp_care_groups g set controls_verified=false,version=version+1,reason='identity_changed',
      state=case when state in ('closed','customer_left','creation_unknown') then state else 'paused_divergence' end
      where exists(select 1 from public.whatsapp_group_accounts a where a.channel_id=old.id and a.id=any(g.approved_accounts));
    update public.whatsapp_group_accounts set enabled=false where channel_id=old.id;
  end if;
  return null;
end $$;
create trigger care_group_profile_identity after update of whatsapp_e164,whatsapp_verified_at on public.profiles
  for each row execute function public.care_group_identity_changed();
create trigger care_group_channel_identity after update of display_phone,instance_name on public.whatsapp_channels
  for each row execute function public.care_group_identity_changed();
revoke all on function public.care_group_identity_changed() from public,anon,authenticated,service_role;
