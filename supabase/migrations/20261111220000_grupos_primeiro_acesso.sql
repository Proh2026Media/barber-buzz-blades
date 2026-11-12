-- Nº 109 — P-120. Primeiro acesso autenticado; nenhum telefone é confirmado por adesão.
-- Somente local. Depende de 105–108 e da extensão bc-groups-v2, ainda não instaladas.
create table public.whatsapp_group_enrollments (
 group_id uuid primary key references public.whatsapp_care_groups(id) on delete cascade,
 profile_phone text, profile_verified_at timestamptz,
 expires_at timestamptz not null default now()+interval '1 hour'
);
alter table public.whatsapp_group_enrollments enable row level security;
revoke all on public.whatsapp_group_enrollments from public,anon,authenticated;
grant all on public.whatsapp_group_enrollments to service_role;
create function public.care_group_phone_eligible(p_group uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_care_groups g join public.profiles p on p.id=g.customer_id
 join auth.users u on u.id=p.id left join public.whatsapp_group_enrollments e on e.group_id=g.id
 where g.id=p_group and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 and not exists(select 1 from public.profiles other where other.id<>p.id and other.whatsapp_e164=g.customer_phone and other.whatsapp_verified_at is not null)
 and ((p.whatsapp_e164=g.customer_phone and p.whatsapp_verified_at is not null)
 or (e.expires_at>now() and p.whatsapp_e164 is not distinct from e.profile_phone
 and p.whatsapp_verified_at is not distinct from e.profile_verified_at)));
$$;
revoke all on function public.care_group_phone_eligible(uuid) from public,anon,authenticated,service_role;

create function public.care_group_begin(p_shop uuid,p_accept boolean,p_accounts uuid[],p_phone text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype; p public.profiles%rowtype; accounts uuid[]; phone text;
begin
 if auth.uid() is null then raise exception 'Sem permissão' using errcode='42501'; end if;
 if p_accept is distinct from true or not (select enrollment_enabled from public.whatsapp_group_settings)
 or not exists(select 1 from public.barbershops where id=p_shop and status='active') then raise exception 'GROUP_UNAVAILABLE'; end if;
 if not exists(select 1 from public.memberships where user_id=auth.uid() and barbershop_id=p_shop and role='customer') then raise exception 'Sem permissão' using errcode='42501'; end if;
 select * into p from public.profiles where id=auth.uid();
 phone:=public.normalize_br_whatsapp(p_phone);
 if phone is null then raise exception 'GROUP_PHONE_REQUIRED'; end if;
 -- Não informa a quem pertence o número, nem altera uma identidade confirmada nesta adesão.
 if (p.whatsapp_verified_at is not null and p.whatsapp_e164 is distinct from phone)
 or exists(select 1 from public.profiles where id<>p.id and whatsapp_e164=phone and whatsapp_verified_at is not null) then raise exception 'GROUP_PHONE_UNAVAILABLE'; end if;
 perform pg_advisory_xact_lock(hashtextextended('group-enrollment',120));
 select * into g from public.whatsapp_care_groups where barbershop_id=p_shop and customer_id=p.id for update;
 if g.id is not null then
   if g.customer_phone<>phone then raise exception 'GROUP_PHONE_UNAVAILABLE'; end if;
   if g.state in ('closed','customer_left','creation_unknown') then raise exception 'GROUP_REVIEW_REQUIRED'; end if;
   -- Retomar a mesma adesão não cria outra operação nem altera o grupo escolhido.
   update public.whatsapp_group_enrollments set expires_at=now()+interval '1 hour'
    where group_id=g.id and profile_phone is not distinct from p.whatsapp_e164
      and profile_verified_at is not distinct from p.whatsapp_verified_at;
   if g.group_jid is not null then
     insert into public.whatsapp_care_operations(group_id,kind,version) values(g.id,'reconcile',g.version) on conflict do nothing;
   end if;
   return public.care_group_read(p_shop);
 end if;
 if (select count(*) from public.whatsapp_care_groups where customer_id=p.id and requested_at>now()-interval '1 hour')>=5 then raise exception 'WA_RATE_LIMIT'; end if;
 select array_agg(id order by id) into accounts from public.whatsapp_group_accounts where barbershop_id=p_shop and enabled;
 if accounts is null or accounts is distinct from (select array_agg(x order by x) from unnest(p_accounts) x) then raise exception 'GROUP_PARTICIPANTS_CHANGED'; end if;
 if exists(select 1 from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.id=any(accounts) and '+'||regexp_replace(n.display_phone,'[^0-9]','','g')=phone) then raise exception 'GROUP_PHONE_UNAVAILABLE'; end if;
 insert into public.whatsapp_care_groups(barbershop_id,customer_id,customer_phone,approved_accounts)
 values(p_shop,p.id,phone,accounts) returning * into g;
 update public.whatsapp_care_groups set approved_account_identities=(select jsonb_object_agg(a.id::text,jsonb_build_object('phone',n.display_phone,'instance',n.instance_name)) from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.id=any(accounts)) where id=g.id;
 insert into public.whatsapp_group_enrollments(group_id,profile_phone,profile_verified_at) values(g.id,p.whatsapp_e164,p.whatsapp_verified_at);
 insert into public.whatsapp_care_operations(group_id,kind,version) values(g.id,'create',g.version);
 insert into public.whatsapp_customer_contact_preferences(customer_id) values(p.id) on conflict do nothing;
 insert into public.whatsapp_care_audit(group_id,actor,action) values(g.id,p.id,'enrollment_requested');
 return public.care_group_read(p_shop);
end $$;
revoke all on function public.care_group_begin(uuid,boolean,uuid[],text) from public,anon;
grant execute on function public.care_group_begin(uuid,boolean,uuid[],text) to authenticated;

create or replace function public.authorize_care_group_step_before_exclusive(p_operation uuid,p_token uuid,p_action text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_care_operations%rowtype; g public.whatsapp_care_groups%rowtype;
  n public.whatsapp_channels%rowtype; platforms text[]; approved text[]; removed text[];
begin
  if p_action not in ('create','configure','participants','invite','observe','close') then raise exception 'GROUP_INVALID'; end if;
  select * into o from public.whatsapp_care_operations where id=p_operation and lease_token=p_token
    and state='running' and lease_until>now() for update;
  if o.id is null then raise exception 'GROUP_STALE'; end if;
  select * into g from public.whatsapp_care_groups where id=o.group_id for update;
  if g.version<>o.version or g.reason='operator_pause' or not (select enrollment_enabled from public.whatsapp_group_settings)
    or (o.kind='close' and (p_action<>'close' or g.state<>'closed'))
    or (o.kind<>'close' and (p_action='close' or g.revoked_at is not null or g.state in ('closed','customer_left','creation_unknown')))
    or (p_action='create' and g.group_jid is not null) then raise exception 'GROUP_STALE'; end if;
  select n0.* into n from public.whatsapp_group_accounts a join public.whatsapp_channels n0 on n0.id=a.channel_id
    where a.id=g.account_id and a.id=any(g.approved_accounts) and a.enabled and a.barbershop_id=g.barbershop_id
      and g.approved_account_identities->a.id::text=jsonb_build_object('phone',n0.display_phone,'instance',n0.instance_name);
  if n.id is null or n.status<>'open' or public.whatsapp_sending_paused(n.instance_name,false) then raise exception 'GROUP_STALE'; end if;
  if exists(select 1 from unnest(g.approved_accounts) expected(id) left join public.whatsapp_group_accounts a on a.id=expected.id
      left join public.whatsapp_channels c on c.id=a.channel_id
      where a.id is null or not a.enabled or a.barbershop_id<>g.barbershop_id or
        g.approved_account_identities->a.id::text is distinct from jsonb_build_object('phone',c.display_phone,'instance',c.instance_name)) then raise exception 'GROUP_STALE'; end if;
  select array_agg('+'||regexp_replace(c.display_phone,'[^0-9]','','g')) into platforms
    from public.whatsapp_group_accounts a join public.whatsapp_channels c on c.id=a.channel_id where a.id=any(g.approved_accounts);
  if platforms is null or array_length(platforms,1)<>(select count(distinct x) from unnest(platforms) x)
    or g.customer_phone=any(platforms) then raise exception 'GROUP_INVALID'; end if;
  if o.kind<>'close' and not public.care_group_phone_eligible(g.id) then raise exception 'GROUP_STALE'; end if;
  if o.kind<>'close' and exists(select 1 from public.whatsapp_care_participants p join public.profiles u on u.id=p.user_id
    where p.group_id=g.id and p.approved_at is not null and p.revoked_at is null and
      (p.approved_phone is null or u.whatsapp_e164 is distinct from p.approved_phone or not public.care_group_member_valid(g.id,p.user_id))) then raise exception 'GROUP_STALE'; end if;
  select coalesce(array_agg(p.approved_phone),'{}') into approved from public.whatsapp_care_participants p
    where p.group_id=g.id and p.approved_at is not null and p.revoked_at is null and p.approved_phone is not null
      and public.care_group_member_valid(g.id,p.user_id);
  select coalesce(array_agg(distinct p.approved_phone),'{}') into removed from public.whatsapp_care_participants p
    where p.group_id=g.id and p.approved_phone is not null;
  if exists(select 1 from unnest(removed) phone where phone=any(platforms) or phone=g.customer_phone)
    or array_length(approved,1)<>(select count(distinct x) from unnest(approved) x) then raise exception 'GROUP_INVALID'; end if;
  if p_action='create' then
    if o.provider_creation_started then raise exception 'GROUP_STALE'; end if;
    update public.whatsapp_care_operations set provider_creation_started=true where id=o.id;
  end if;
  return jsonb_build_object('id',o.id,'token',o.lease_token,'instance',n.instance_name,'group_jid',g.group_jid,
    'subject','Atendimento · Barba & Cabelo','kind',o.kind,'platform_phones',platforms,'customer_phone',g.customer_phone,
    'approved_phones',approved,'removable_phones',removed,'use_group',g.use_group,'entry_pending',g.entry_pending);
end $$;

create or replace function public.claim_care_group_operation(p_operation uuid,p_capable boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_care_operations%rowtype; g public.whatsapp_care_groups%rowtype;
  a public.whatsapp_group_accounts%rowtype; n public.whatsapp_channels%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  select * into o from public.whatsapp_care_operations where id=p_operation for update;
  if o.id is null or o.state not in ('pending','blocked') or o.started_at is not null then return null; end if;
  select * into g from public.whatsapp_care_groups where id=o.group_id for update;
  if g.version<>o.version or (g.state in ('customer_left','creation_unknown') or (g.state='closed' and o.kind<>'close')) then return null; end if;
  if g.reason='operator_pause' then return null; end if;
  if g.group_jid is null and exists(select 1 from public.whatsapp_care_operations previous
      where previous.group_id=g.id and previous.started_at is not null) then
    update public.whatsapp_care_groups set state='creation_unknown',controls_verified=false,reason='operation_unknown' where id=g.id;
    update public.whatsapp_care_operations set state='blocked' where id=o.id;
    return null;
  end if;
  if not (select enrollment_enabled from public.whatsapp_group_settings) or p_capable is distinct from true
    or o.kind not in ('create','reconcile','remove','close') then
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
  if o.kind<>'close' and not public.care_group_phone_eligible(g.id) then return null; end if;
  -- Uma operação ganha posse, mas a autorização de criação não pode ser recuperada após incerteza.
  update public.whatsapp_care_operations set state='running',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',started_at=now()
    where id=o.id returning * into o;
  update public.whatsapp_care_groups set account_id=a.id,state=case when group_jid is null then 'creating' else state end where id=g.id;
  return public.authorize_care_group_step(o.id,o.lease_token,case when o.kind='close' then 'close' else 'observe' end);
end $$;

create or replace function public.observe_care_group_before_exclusive(p_operation uuid,p_token uuid,p_snapshot jsonb) returns void
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
      if phone=g.customer_phone and public.care_group_phone_eligible(g.id) then customer_present:=true;
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

create or replace function public.care_group_invite(p_group uuid) returns text language plpgsql security definer set search_path=public as $$
declare url text;
begin
  select i.invite_url into url from public.whatsapp_care_invites i join public.whatsapp_care_groups g on g.id=i.group_id
    where g.id=p_group and g.customer_id=auth.uid() and g.state in ('waiting_customer','active')
      and g.revoked_at is null and g.controls_verified and g.observed_at>now()-interval '30 seconds'
      and i.version=g.version and i.expires_at>now()
      and (select enrollment_enabled from public.whatsapp_group_settings)
      and public.care_group_phone_eligible(g.id);
  if url is null then raise exception 'GROUP_INVITE_UNAVAILABLE'; end if;
  return url;
end $$;

alter function public.care_group_read(uuid,uuid) rename to care_group_read_before_bootstrap;
create function public.care_group_read(p_shop uuid,p_customer uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; g public.whatsapp_care_groups%rowtype;
begin
 result:=public.care_group_read_before_bootstrap(p_shop,p_customer);
 select * into g from public.whatsapp_care_groups where barbershop_id=p_shop and customer_id=auth.uid();
 return result||jsonb_build_object('phone',coalesce(g.customer_phone,(select whatsapp_e164 from public.profiles where id=auth.uid())),
 'phone_confirmed',exists(select 1 from public.profiles where id=auth.uid() and whatsapp_e164=g.customer_phone and whatsapp_verified_at is not null),
 'enrollment_expired',exists(select 1 from public.whatsapp_group_enrollments e where e.group_id=g.id and e.expires_at<=now()),
 'phone_ready',g.state='active' and g.controls_verified and public.care_group_phone_eligible(g.id));
end $$;
revoke all on function public.care_group_read_before_bootstrap(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.care_group_read(uuid,uuid) from public,anon;
grant execute on function public.care_group_read(uuid,uuid) to authenticated;

create function public.request_whatsapp_group_phone(p_user uuid,p_destination text,p_code_hash text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype; challenge uuid; instance text;
begin
 if not (select enrollment_enabled and login_enabled from public.whatsapp_group_settings) then raise exception 'GROUP_UNAVAILABLE'; end if;
 if p_code_hash is null or p_code_hash !~ '^[a-f0-9]{64}$' or p_request_id is null then raise exception 'GROUP_INVALID'; end if;
 select x.* into g from public.whatsapp_care_groups x where x.customer_id=p_user and x.customer_phone=p_destination
 and x.state='active' and x.controls_verified and x.revoked_at is null and not x.entry_pending and public.care_group_phone_eligible(x.id)
 order by x.requested_at,x.id limit 1;
 if g.id is null then raise exception 'GROUP_UNAVAILABLE'; end if;
 select n.instance_name into instance from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.id=g.account_id;
 insert into public.auth_otp_challenges(request_id,user_id,channel,destination,code_hash,purpose,expires_at)
 values(p_request_id,p_user,'whatsapp',p_destination,p_code_hash,'verify_phone',now()+interval '10 minutes') returning id into challenge;
 insert into public.whatsapp_group_login_routes values(challenge,g.id,g.version,instance);
 return jsonb_build_object('challenge_id',challenge);
end $$;

create or replace function public.whatsapp_group_login_context(p_challenge_id uuid,p_code_hash text,p_unused boolean default true)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.auth_otp_challenges%rowtype; r public.whatsapp_group_login_routes%rowtype;
  g public.whatsapp_care_groups%rowtype; platforms text[]; sender text;
begin
  if not (select enrollment_enabled and login_enabled from public.whatsapp_group_settings) then return null; end if;
  select * into c from public.auth_otp_challenges where id=p_challenge_id and channel='whatsapp' and purpose in ('login','verify_phone')
    and code_hash=p_code_hash and expires_at>clock_timestamp() and (not p_unused or consumed_at is null);
  if c.id is null then return null; end if;
  select * into r from public.whatsapp_group_login_routes where challenge_id=c.id;
  select * into g from public.whatsapp_care_groups where id=r.group_id and version=r.version and state='active'
    and controls_verified and revoked_at is null and not entry_pending and customer_id=c.user_id and customer_phone=c.destination;
  if g.id is null or g.group_jid is null or public.whatsapp_sending_paused(r.instance_name,true)
    or not exists(select 1 from public.barbershops where id=g.barbershop_id and status='active')
    or not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=c.user_id
      and ((c.purpose='login' and p.whatsapp_e164=c.destination and p.whatsapp_verified_at is not null) or (c.purpose='verify_phone' and public.care_group_phone_eligible(g.id))) and u.deleted_at is null
      and nullif(u.email,'') is not null and (u.banned_until is null or u.banned_until<=now()))
    or exists(select 1 from public.whatsapp_care_participants where group_id=g.id and revoked_at is null)
    or exists(select 1 from public.whatsapp_care_operations where group_id=g.id and state='running' and lease_until>now()) then return null; end if;
  if exists(select 1 from unnest(g.approved_accounts) expected(id)
      left join public.whatsapp_group_accounts a on a.id=expected.id left join public.whatsapp_channels n on n.id=a.channel_id
      where a.id is null or not a.enabled or a.barbershop_id<>g.barbershop_id
        or g.approved_account_identities->a.id::text is distinct from jsonb_build_object('phone',n.display_phone,'instance',n.instance_name)) then return null; end if;
  select array_agg('+'||regexp_replace(n.display_phone,'[^0-9]','','g')) into platforms
    from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.id=any(g.approved_accounts);
  select '+'||regexp_replace(n.display_phone,'[^0-9]','','g') into sender
    from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id
    where a.id=g.account_id and a.id=any(g.approved_accounts) and n.instance_name=r.instance_name and n.status='open';
  if sender is null or platforms is null or c.destination=any(platforms)
    or cardinality(platforms)<>(select count(distinct x) from unnest(platforms) x) then return null; end if;
  return jsonb_build_object('group_id',g.id,'group_jid',g.group_jid,'version',g.version,'instance_name',r.instance_name,
    'customer_phone',c.destination,'platform_phones',platforms,'sender_phone',sender,'purpose',c.purpose,'expires_at',c.expires_at);
end $$;
create function public.check_whatsapp_group_phone(p_user uuid,p_destination text,p_code_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; profile jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 select to_jsonb(x) into result from public.auth_otp_check_user_code(p_user,p_destination,'verify_phone',p_code_hash,5) x limit 1;
 if result->>'challenge_id' is null or result->>'user_id' is distinct from p_user::text
 or public.whatsapp_group_login_context((result->>'challenge_id')::uuid,p_code_hash,false) is null
 or not exists(select 1 from public.whatsapp_send_attempts where challenge_id=(result->>'challenge_id')::uuid) then return null; end if;
 -- Confirmação e consumo na mesma transação; aviso/marketing não é requisito para entrar.
 profile:=to_jsonb(public.apply_verified_whatsapp(p_user,p_destination,coalesce((select whatsapp_e164=p_destination and whatsapp_opt_in_at is not null from public.profiles where id=p_user),false)));
 delete from public.whatsapp_group_enrollments where group_id in(select id from public.whatsapp_care_groups where customer_id=p_user);
 insert into public.whatsapp_care_operations(group_id,kind,version) select id,'reconcile',version from public.whatsapp_care_groups where customer_id=p_user and customer_phone=p_destination and state not in ('closed','customer_left','creation_unknown') on conflict do nothing;
 return profile;
end $$;
revoke all on function public.request_whatsapp_group_phone(uuid,text,text,uuid),public.check_whatsapp_group_phone(uuid,text,text) from public,anon,authenticated;
grant execute on function public.request_whatsapp_group_phone(uuid,text,text,uuid),public.check_whatsapp_group_phone(uuid,text,text) to service_role;
