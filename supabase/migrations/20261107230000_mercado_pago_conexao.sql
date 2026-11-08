-- P-49, etapa de conexão: loja e Parceiro independente (associate) autorizam contas próprias.
-- owner/partner são a sociedade; employee usa a conta da loja. Nenhum repasse/comissão.
-- Não cria pagamentos, checkout, retenção, reembolso ou ativação financeira.
-- Funções novas, sem substituir contratos da agenda ou da governança existentes.
-- OAuth: nonce SHA-256 de uso único/10 min; PKCE e tokens cifrados no Edge (AES-GCM).
-- Conta da loja: só dono/sócio com poder direto configura; 50/50 fica indisponível nesta etapa.
-- Conta pessoal: cada associate ativo configura só a própria, mesmo em loja 50/50.
-- Plataforma/gerente não recebem poder financeiro por seus papéis globais.

create or replace function public.mercado_pago_cipher_valid(p_value text)
returns boolean language sql immutable set search_path = public as $$
  select p_value is not null and length(p_value) between 44 and 16321
    and p_value ~ '^mp1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{23,}$'
$$;

create table if not exists public.mercado_pago_connections (
  id uuid primary key,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  receiver_scope text not null check (receiver_scope in ('shop','professional')),
  -- O titular pessoal é separado do staff: reatribuir um profissional não transfere tokens.
  professional_user_id uuid references auth.users(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  status text not null default 'disconnected' check (status in ('disconnected','connected')),
  connection_revision bigint not null default 0 check (connection_revision >= 0),
  collector_id text check (collector_id ~ '^[0-9]{1,32}$'),
  live_mode boolean,
  access_token_ciphertext text check (access_token_ciphertext is null or public.mercado_pago_cipher_valid(access_token_ciphertext)),
  refresh_token_ciphertext text check (refresh_token_ciphertext is null or public.mercado_pago_cipher_valid(refresh_token_ciphertext)),
  token_expires_at timestamptz,
  connected_at timestamptz,
  connected_by uuid references auth.users(id) on delete set null,
  disconnected_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint mercado_pago_connections_state check (
    (status='connected' and collector_id is not null and live_mode is not null
      and access_token_ciphertext is not null and refresh_token_ciphertext is not null
      and token_expires_at is not null and connected_at is not null)
    or (status='disconnected' and access_token_ciphertext is null and refresh_token_ciphertext is null))
);

create unique index if not exists mercado_pago_shop_connection on public.mercado_pago_connections(barbershop_id) where receiver_scope='shop';
create unique index if not exists mercado_pago_professional_connection on public.mercado_pago_connections(barbershop_id,professional_user_id) where receiver_scope='professional';
-- Sem unicidade global do coletor: o mesmo titular pode atuar em mais de uma loja.

create table if not exists public.mercado_pago_oauth_requests (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.mercado_pago_connections(id) on delete cascade,
  receiver_scope text not null check (receiver_scope in ('shop','professional')),
  staff_id uuid,
  state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
  environment text not null check (environment in ('test','production')),
  verifier_ciphertext text check (verifier_ciphertext is null or public.mercado_pago_cipher_valid(verifier_ciphertext)),
  connection_revision bigint not null check (connection_revision > 0),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  finished_at timestamptz,
  revoked_at timestamptz,
  constraint mercado_pago_oauth_ttl check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  constraint mercado_pago_oauth_verifier check (verifier_ciphertext is not null or consumed_at is not null or revoked_at is not null),
  constraint mercado_pago_oauth_finish check (finished_at is null or consumed_at is not null)
);
create index if not exists mercado_pago_oauth_shop_idx on public.mercado_pago_oauth_requests(barbershop_id);
create index if not exists mercado_pago_oauth_actor_idx on public.mercado_pago_oauth_requests(actor_id);

alter table public.mercado_pago_connections enable row level security;
alter table public.mercado_pago_oauth_requests enable row level security;
revoke all on public.mercado_pago_connections, public.mercado_pago_oauth_requests from public, anon, authenticated;
grant all on public.mercado_pago_connections, public.mercado_pago_oauth_requests to service_role;
-- Sem políticas para anon/authenticated: nem leitura de cifra, nonce, coletor ou credencial.

create or replace function public.mercado_pago_management_block(p_shop_id uuid, p_actor_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_mine numeric; v_count integer; v_low numeric; v_high numeric;
begin
  select sm.ownership_percent into v_mine from public.shop_members sm
  where sm.barbershop_id=p_shop_id and sm.user_id=p_actor_id and sm.active and sm.role in ('owner','partner');
  if v_mine is null then return 'owner_required'; end if;
  if exists(select 1 from public.account_manager_shops am join public.memberships m
      on m.user_id=am.user_id and m.role='account_manager'
      where am.barbershop_id=p_shop_id and am.user_id=p_actor_id) then
    return 'account_manager';
  end if;
  select count(*),min(ownership_percent),max(ownership_percent) into v_count,v_low,v_high
  from public.shop_members where barbershop_id=p_shop_id and active and role in ('owner','partner');
  if v_count=1 or (v_low<>v_high and v_mine=v_high and v_mine>50) then return null; end if;
  return 'shared_governance';
end $$;

-- Resolve o titular real, sem confiar no staff informado pelo navegador.
create or replace function public.mercado_pago_connection_target(
  p_shop_id uuid,p_actor_id uuid,p_receiver_scope text,p_staff_id uuid
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_staff uuid; v_member uuid; v_name text; v_block text; v_connection uuid;
begin
  if p_receiver_scope is null or p_receiver_scope not in ('shop','professional') then
    raise exception 'mp_connection_invalid' using errcode='22023'; end if;
  if p_receiver_scope='professional' then
    select sm.staff_id,sm.id,left(btrim(regexp_replace(st.display_name,'[[:cntrl:]]',' ','g')),160)
      into v_staff,v_member,v_name
    from public.shop_members sm join public.staff st on st.id=sm.staff_id
      and st.barbershop_id=sm.barbershop_id and st.user_id=sm.user_id and st.active
    where sm.barbershop_id=p_shop_id and sm.user_id=p_actor_id and sm.role='associate' and sm.active;
    if v_staff is null or (p_staff_id is not null and p_staff_id<>v_staff) then
      raise exception 'mp_connection_not_allowed' using errcode='42501'; end if;
  else
    if p_staff_id is not null then raise exception 'mp_connection_invalid' using errcode='22023'; end if;
    v_block:=public.mercado_pago_management_block(p_shop_id,p_actor_id);
    select sm.id into v_member from public.shop_members sm
      where sm.barbershop_id=p_shop_id and sm.user_id=p_actor_id and sm.active;
    select left(btrim(regexp_replace(name,'[[:cntrl:]]',' ','g')),160) into v_name
      from public.barbershops where id=p_shop_id;
    if v_name is null then raise exception 'mp_connection_not_allowed' using errcode='42501'; end if;
  end if;
  select c.id into v_connection from public.mercado_pago_connections c
    where c.barbershop_id=p_shop_id and c.receiver_scope=p_receiver_scope
      and (p_receiver_scope='shop' or c.professional_user_id=p_actor_id);
  return jsonb_build_object('connection_id',v_connection,'receiver_scope',p_receiver_scope,
    'staff_id',v_staff,'actor_id',v_member,'receiver_name',v_name,'management_blocked_reason',v_block);
end $$;

create or replace function public.get_mercado_pago_connection(
  p_shop_id uuid,p_receiver_scope text default 'shop',p_staff_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_connection public.mercado_pago_connections; v_target jsonb; v_name text;
begin
  if auth.uid() is null then raise exception 'mp_connection_not_allowed' using errcode='42501'; end if;
  if p_receiver_scope='shop' and not (
    public.has_shop_member_role(p_shop_id,array['owner','partner']::public.shop_member_role[])
    or public.is_platform_admin() or public.is_account_manager_of(p_shop_id)) then
    raise exception 'mp_connection_not_allowed' using errcode='42501'; end if;
  v_target:=public.mercado_pago_connection_target(p_shop_id,auth.uid(),p_receiver_scope,p_staff_id);
  select left(btrim(regexp_replace(name,'[[:cntrl:]]',' ','g')),160) into v_name from public.barbershops where id=p_shop_id;
  select * into v_connection from public.mercado_pago_connections where id=(v_target->>'connection_id')::uuid;
  return v_target||jsonb_build_object('supported',true,'can_manage',v_target->>'management_blocked_reason' is null,
    'shop_name',v_name,'status',coalesce(v_connection.status,'disconnected'),
    'connected',coalesce(v_connection.status='connected',false),
    'connection_revision',coalesce(v_connection.connection_revision,0)::text,
    'connected_at',case when v_connection.status='connected' then v_connection.connected_at end,
    'live_mode',case when v_connection.status='connected' then v_connection.live_mode end,
    'financial_enabled',false);
end $$;

-- Só o Edge usa estas RPCs. p_actor_id vem de getUser, não de um campo livre do navegador.
-- O UUID novo é gerado no Edge antes de cifrar o verifier e faz parte do AAD; se outro
-- início criar esse alvo antes, recusamos a corrida sem transplantar a cifra a outro UUID.
create or replace function public.begin_mercado_pago_connection(
  p_shop_id uuid,p_actor_id uuid,p_state_hash text,p_verifier_ciphertext text,
  p_expected_revision bigint,p_environment text,p_receiver_scope text,p_staff_id uuid,p_connection_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_connection public.mercado_pago_connections; v_target jsonb; v_id uuid; v_now timestamptz;
begin
  v_target:=public.mercado_pago_connection_target(p_shop_id,p_actor_id,p_receiver_scope,p_staff_id);
  if v_target->>'management_blocked_reason' is not null then
    raise exception 'mp_connection_not_allowed' using errcode='42501'; end if;
  if p_state_hash is null or p_state_hash !~ '^[0-9a-f]{64}$'
     or not public.mercado_pago_cipher_valid(p_verifier_ciphertext)
     or p_expected_revision is null or p_expected_revision<0 or p_connection_id is null
     or p_environment is null or p_environment not in ('test','production') then
    raise exception 'mp_connection_invalid' using errcode='22023'; end if;
  insert into public.mercado_pago_connections(id,barbershop_id,receiver_scope,professional_user_id,staff_id)
  values(p_connection_id,p_shop_id,p_receiver_scope,case when p_receiver_scope='professional' then p_actor_id end,
    (v_target->>'staff_id')::uuid) on conflict do nothing;
  select * into v_connection from public.mercado_pago_connections
    where barbershop_id=p_shop_id and receiver_scope=p_receiver_scope
      and (p_receiver_scope='shop' or professional_user_id=p_actor_id) for update;
  v_now:=clock_timestamp();
  v_target:=public.mercado_pago_connection_target(p_shop_id,p_actor_id,p_receiver_scope,p_staff_id);
  if v_target->>'management_blocked_reason' is not null then
    raise exception 'mp_connection_not_allowed' using errcode='42501'; end if;
  if v_connection.id is distinct from p_connection_id or v_connection.connection_revision<>p_expected_revision then
    raise exception 'mp_connection_conflict' using errcode='40001'; end if;
  if v_connection.status='connected' then
    raise exception 'mp_connection_already_connected' using errcode='22023'; end if;
  update public.mercado_pago_connections set connection_revision=connection_revision+1,updated_at=v_now,
    staff_id=(v_target->>'staff_id')::uuid where id=v_connection.id returning * into v_connection;
  update public.mercado_pago_oauth_requests set revoked_at=v_now,verifier_ciphertext=null
    where connection_id=v_connection.id and finished_at is null and revoked_at is null;
  insert into public.mercado_pago_oauth_requests(barbershop_id,actor_id,connection_id,receiver_scope,staff_id,
    state_hash,environment,verifier_ciphertext,connection_revision,created_at,expires_at)
  values(p_shop_id,p_actor_id,v_connection.id,p_receiver_scope,v_connection.staff_id,p_state_hash,p_environment,
    p_verifier_ciphertext,v_connection.connection_revision,v_now,v_now+interval '10 minutes') returning id into v_id;
  return jsonb_build_object('attempt_id',v_id,'connection_id',v_connection.id,
    'connection_revision',v_connection.connection_revision::text,'expires_at',v_now+interval '10 minutes');
end $$;

create or replace function public.consume_mercado_pago_connection(p_state_hash text,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_request public.mercado_pago_oauth_requests; v_revision bigint; v_target jsonb;
  v_cipher text; v_now timestamptz;
begin
  select * into v_request from public.mercado_pago_oauth_requests where state_hash=p_state_hash;
  if v_request.id is null or v_request.actor_id is distinct from p_actor_id then
    raise exception 'mp_connection_state_invalid' using errcode='22023'; end if;
  select connection_revision into v_revision from public.mercado_pago_connections where id=v_request.connection_id for update;
  select * into v_request from public.mercado_pago_oauth_requests where id=v_request.id for update;
  v_now:=clock_timestamp();
  v_target:=public.mercado_pago_connection_target(v_request.barbershop_id,p_actor_id,v_request.receiver_scope,v_request.staff_id);
  if v_target->>'management_blocked_reason' is not null then
    raise exception 'mp_connection_not_allowed' using errcode='42501'; end if;
  if v_request.consumed_at is not null or v_request.revoked_at is not null or v_request.expires_at<=v_now
     or v_request.connection_revision is distinct from v_revision
     or (v_target->>'connection_id')::uuid is distinct from v_request.connection_id then
    raise exception 'mp_connection_state_invalid' using errcode='22023'; end if;
  v_cipher:=v_request.verifier_ciphertext;
  update public.mercado_pago_oauth_requests set consumed_at=v_now,verifier_ciphertext=null where id=v_request.id;
  return jsonb_build_object('attempt_id',v_request.id,'shop_id',v_request.barbershop_id,'connection_id',v_request.connection_id,
    'actor_id',v_request.actor_id,'receiver_scope',v_request.receiver_scope,'staff_id',v_request.staff_id,
    'environment',v_request.environment,'verifier_ciphertext',v_cipher,
    'connection_revision',v_request.connection_revision::text,'expires_at',v_request.expires_at);
end $$;

create or replace function public.finish_mercado_pago_connection(
  p_attempt_id uuid,p_actor_id uuid,p_collector_id text,p_access_token_ciphertext text,
  p_refresh_token_ciphertext text,p_token_expires_at timestamptz,p_live_mode boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_request public.mercado_pago_oauth_requests; v_connection public.mercado_pago_connections;
  v_target jsonb; v_now timestamptz;
begin
  select * into v_request from public.mercado_pago_oauth_requests where id=p_attempt_id;
  if v_request.id is null or v_request.actor_id is distinct from p_actor_id then
    raise exception 'mp_connection_state_invalid' using errcode='22023'; end if;
  select * into v_connection from public.mercado_pago_connections where id=v_request.connection_id for update;
  select * into v_request from public.mercado_pago_oauth_requests where id=p_attempt_id for update;
  v_now:=clock_timestamp();
  v_target:=public.mercado_pago_connection_target(v_request.barbershop_id,p_actor_id,v_request.receiver_scope,v_request.staff_id);
  if v_target->>'management_blocked_reason' is not null then
    raise exception 'mp_connection_not_allowed' using errcode='42501'; end if;
  if v_request.consumed_at is null or v_request.finished_at is not null or v_request.revoked_at is not null
     or v_request.expires_at<=v_now or (v_target->>'connection_id')::uuid is distinct from v_request.connection_id then
    raise exception 'mp_connection_state_invalid' using errcode='22023'; end if;
  if v_connection.connection_revision is distinct from v_request.connection_revision then
    raise exception 'mp_connection_conflict' using errcode='40001'; end if;
  if p_collector_id is null or p_collector_id !~ '^[0-9]{1,32}$'
     or not public.mercado_pago_cipher_valid(p_access_token_ciphertext)
     or not public.mercado_pago_cipher_valid(p_refresh_token_ciphertext)
     or p_token_expires_at is null or not isfinite(p_token_expires_at)
     or p_token_expires_at<=v_now or p_token_expires_at>v_now+interval '1 year' or p_live_mode is null then
    raise exception 'mp_connection_invalid' using errcode='22023'; end if;
  if p_live_mode<>(v_request.environment='production') then
    raise exception 'mp_connection_environment_mismatch' using errcode='22023'; end if;
  if v_connection.status='connected' then
    if v_connection.collector_id is distinct from p_collector_id or v_connection.live_mode is distinct from p_live_mode then
      raise exception 'mp_connection_account_mismatch' using errcode='22023'; end if;
    raise exception 'mp_connection_already_connected' using errcode='22023';
  end if;
  update public.mercado_pago_connections set status='connected',collector_id=p_collector_id,live_mode=p_live_mode,
    access_token_ciphertext=p_access_token_ciphertext,refresh_token_ciphertext=p_refresh_token_ciphertext,
    token_expires_at=p_token_expires_at,connected_at=v_now,connected_by=p_actor_id,disconnected_at=null,
    connection_revision=connection_revision+1,updated_at=v_now
    where id=v_connection.id returning * into v_connection;
  update public.mercado_pago_oauth_requests set finished_at=v_now where id=p_attempt_id;
  return v_target||jsonb_build_object('status','connected','connected',true,
    'connection_revision',v_connection.connection_revision::text,'connected_at',v_now,
    'live_mode',p_live_mode,'financial_enabled',false);
end $$;

create or replace function public.disconnect_mercado_pago_connection(
  p_shop_id uuid,p_actor_id uuid,p_expected_revision bigint,p_receiver_scope text default 'shop',p_staff_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_connection public.mercado_pago_connections; v_target jsonb; v_now timestamptz;
begin
  v_target:=public.mercado_pago_connection_target(p_shop_id,p_actor_id,p_receiver_scope,p_staff_id);
  if v_target->>'management_blocked_reason' is not null then
    raise exception 'mp_connection_not_allowed' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision<0 then
    raise exception 'mp_connection_invalid' using errcode='22023'; end if;
  select * into v_connection from public.mercado_pago_connections where id=(v_target->>'connection_id')::uuid for update;
  v_now:=clock_timestamp();
  if v_connection.id is null then
    if p_expected_revision<>0 then raise exception 'mp_connection_conflict' using errcode='40001'; end if;
    return v_target||jsonb_build_object('status','disconnected','connected',false,'connection_revision','0','financial_enabled',false);
  end if;
  if v_connection.connection_revision<>p_expected_revision then
    raise exception 'mp_connection_conflict' using errcode='40001'; end if;
  update public.mercado_pago_connections set status='disconnected',access_token_ciphertext=null,
    refresh_token_ciphertext=null,token_expires_at=null,disconnected_at=v_now,
    connection_revision=connection_revision+1,updated_at=v_now
    where id=v_connection.id returning * into v_connection;
  update public.mercado_pago_oauth_requests set revoked_at=v_now,verifier_ciphertext=null
    where connection_id=v_connection.id and finished_at is null and revoked_at is null;
  return v_target||jsonb_build_object('status','disconnected','connected',false,
    'connection_revision',v_connection.connection_revision::text,'financial_enabled',false);
end $$;

-- Mudanças societárias invalidam apenas o alvo loja. Alteração do vínculo/staff pessoal
-- invalida apenas o próprio recebedor. Perder o vínculo associate limpa seus tokens locais;
-- o registro/UUID/coletor ficam privados, sem transferir a conexão ao novo ocupante do staff.
create or replace function public.invalidate_mercado_pago_authorizations()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_shops uuid[]:='{}'; v_users uuid[]:='{}'; v_staffs uuid[]:='{}'; v_ids uuid[]:='{}';
  v_shop_change boolean:=false; v_personal_change boolean:=false; v_id uuid;
  v_connection public.mercado_pago_connections; v_now timestamptz:=clock_timestamp();
begin
  if tg_table_name='memberships' then
    if tg_op<>'INSERT' and old.role='account_manager' then v_users:=array_append(v_users,old.user_id); end if;
    if tg_op<>'DELETE' and new.role='account_manager' then v_users:=array_append(v_users,new.user_id); end if;
    select coalesce(array_agg(distinct am.barbershop_id),'{}'::uuid[]) into v_shops
      from public.account_manager_shops am where am.user_id=any(v_users);
    v_shop_change:=true;
  elsif tg_table_name='account_manager_shops' then
    if tg_op<>'INSERT' then v_shops:=array_append(v_shops,old.barbershop_id); end if;
    if tg_op<>'DELETE' then v_shops:=array_append(v_shops,new.barbershop_id); end if;
    v_shop_change:=true;
  elsif tg_table_name='shop_members' then
    if tg_op<>'INSERT' then
      v_shops:=array_append(v_shops,old.barbershop_id); v_users:=array_append(v_users,old.user_id);
      v_shop_change:=old.role in ('owner','partner');
    end if;
    if tg_op<>'DELETE' then
      v_shops:=array_append(v_shops,new.barbershop_id); v_users:=array_append(v_users,new.user_id);
      v_shop_change:=v_shop_change or new.role in ('owner','partner');
    end if;
    v_personal_change:=true;
  elsif tg_table_name='staff' then
    if tg_op<>'INSERT' then
      v_shops:=array_append(v_shops,old.barbershop_id); v_users:=array_append(v_users,old.user_id); v_staffs:=array_append(v_staffs,old.id);
    end if;
    if tg_op<>'DELETE' then
      v_shops:=array_append(v_shops,new.barbershop_id); v_users:=array_append(v_users,new.user_id); v_staffs:=array_append(v_staffs,new.id);
    end if;
    v_personal_change:=true;
  end if;
  select coalesce(array_agg(c.id order by c.id),'{}'::uuid[]) into v_ids from public.mercado_pago_connections c
    where c.barbershop_id=any(v_shops) and (
      (v_shop_change and c.receiver_scope='shop') or
      (v_personal_change and c.receiver_scope='professional' and (c.professional_user_id=any(v_users) or c.staff_id=any(v_staffs))));
  foreach v_id in array v_ids loop
    select * into v_connection from public.mercado_pago_connections where id=v_id for update;
    update public.mercado_pago_connections set connection_revision=connection_revision+1,updated_at=v_now where id=v_id;
    update public.mercado_pago_oauth_requests set revoked_at=v_now,verifier_ciphertext=null
      where connection_id=v_id and finished_at is null and revoked_at is null;
    if v_connection.receiver_scope='professional' and not exists (
      select 1 from public.shop_members sm join public.staff st on st.id=sm.staff_id
        and st.barbershop_id=sm.barbershop_id and st.user_id=sm.user_id and st.active
      where sm.barbershop_id=v_connection.barbershop_id and sm.user_id=v_connection.professional_user_id
        and sm.staff_id=v_connection.staff_id and sm.role='associate' and sm.active
    ) then
      update public.mercado_pago_connections set status='disconnected',access_token_ciphertext=null,
        refresh_token_ciphertext=null,token_expires_at=null,disconnected_at=v_now where id=v_id;
    end if;
  end loop;
  return coalesce(new,old);
end $$;
drop trigger if exists mercado_pago_members_changed on public.shop_members;
create trigger mercado_pago_members_changed after insert or delete or update of barbershop_id,user_id,staff_id,role,ownership_percent,active
  on public.shop_members for each row execute function public.invalidate_mercado_pago_authorizations();
drop trigger if exists mercado_pago_managers_changed on public.account_manager_shops;
create trigger mercado_pago_managers_changed after insert or delete or update of barbershop_id,user_id
  on public.account_manager_shops for each row execute function public.invalidate_mercado_pago_authorizations();
drop trigger if exists mercado_pago_manager_role_changed on public.memberships;
create trigger mercado_pago_manager_role_changed after insert or delete or update of user_id,role
  on public.memberships for each row execute function public.invalidate_mercado_pago_authorizations();
drop trigger if exists mercado_pago_staff_changed on public.staff;
create trigger mercado_pago_staff_changed after delete or update of barbershop_id,user_id,active
  on public.staff for each row execute function public.invalidate_mercado_pago_authorizations();

-- Reaplicação após reversão: nenhum token pessoal sobrevive a um vínculo que ficou inválido.
update public.mercado_pago_connections c set status='disconnected',access_token_ciphertext=null,
  refresh_token_ciphertext=null,token_expires_at=null,disconnected_at=clock_timestamp(),
  connection_revision=connection_revision+1,updated_at=clock_timestamp()
where c.receiver_scope='professional' and c.status='connected' and not exists (
  select 1 from public.shop_members sm join public.staff st on st.id=sm.staff_id
    and st.barbershop_id=sm.barbershop_id and st.user_id=sm.user_id and st.active
  where sm.barbershop_id=c.barbershop_id and sm.user_id=c.professional_user_id and sm.staff_id=c.staff_id
    and sm.role='associate' and sm.active);

revoke all on function public.mercado_pago_cipher_valid(text),public.mercado_pago_management_block(uuid,uuid),
  public.mercado_pago_connection_target(uuid,uuid,text,uuid),public.invalidate_mercado_pago_authorizations(),
  public.get_mercado_pago_connection(uuid,text,uuid),
  public.begin_mercado_pago_connection(uuid,uuid,text,text,bigint,text,text,uuid,uuid),
  public.consume_mercado_pago_connection(text,uuid),
  public.finish_mercado_pago_connection(uuid,uuid,text,text,text,timestamptz,boolean),
  public.disconnect_mercado_pago_connection(uuid,uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.get_mercado_pago_connection(uuid,text,uuid) to authenticated;
grant execute on function public.begin_mercado_pago_connection(uuid,uuid,text,text,bigint,text,text,uuid,uuid),
  public.consume_mercado_pago_connection(text,uuid),
  public.finish_mercado_pago_connection(uuid,uuid,text,text,text,timestamptz,boolean),
  public.disconnect_mercado_pago_connection(uuid,uuid,bigint,text,uuid) to service_role;
notify pgrst,'reload schema';
