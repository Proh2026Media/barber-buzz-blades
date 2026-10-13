-- Regras de papel no banco (20261013120000_regras_papel_banco.sql): P-01, P-04 e P-07.
-- Rodar depois da migration, numa transação: BEGIN; \i este arquivo; ROLLBACK;
-- Usuários e lojas fictícios, gerados aqui (não depende de dados reais).
create temporary table rp_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() dest_id,
  gen_random_uuid() owner_id, gen_random_uuid() owner_staff,
  gen_random_uuid() assoc_id, gen_random_uuid() assoc_staff,
  gen_random_uuid() employee_id, gen_random_uuid() employee_staff,
  gen_random_uuid() dest_owner_id, gen_random_uuid() dest_owner_staff,
  gen_random_uuid() dest_assoc_staff, gen_random_uuid() dest_employee_staff,
  gen_random_uuid() admin_id, gen_random_uuid() outsider_id,
  gen_random_uuid() owner_block, gen_random_uuid() assoc_block, gen_random_uuid() shop_block;
grant select on rp_ctx to authenticated;

create function pg_temp.check_rp(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
-- Com expected_state, a recusa precisa vir com esse código (e não por outro erro qualquer).
create function pg_temp.expect_rp_error(statement text, label text, expected_state text default null)
returns void language plpgsql as $$
declare failed boolean := false; state text;
begin
  begin execute statement; exception when others then failed := true; state := sqlstate; end;
  if failed and expected_state is not null and state is distinct from expected_state then
    raise notice 'código recebido: %', state;
    failed := false;
  end if;
  perform pg_temp.check_rp(failed, label);
end $$;

-- ---------------------------------------------------------------------------
-- Cenário: loja com dono único, Parceiro e Contratado; outra loja onde os dois
-- profissionais já estão na equipe (destino possível da carteira).
-- ---------------------------------------------------------------------------

insert into public.barbershops(id, name, slug)
select shop_id, 'Regras papel', 'rp-loja-' || shop_id from rp_ctx union all
select dest_id, 'Regras destino', 'rp-dest-' || dest_id from rp_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{}'::jsonb
from rp_ctx c
cross join lateral unnest(array[c.owner_id, c.assoc_id, c.employee_id, c.dest_owner_id,
  c.admin_id, c.outsider_id]) u;
insert into public.memberships(user_id, role) select admin_id, 'platform_admin' from rp_ctx;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono RP', owner_id, 'dono' from rp_ctx union all
select assoc_staff, shop_id, 'Parceiro RP', assoc_id, 'parceiro' from rp_ctx union all
select employee_staff, shop_id, 'Contratado RP', employee_id, 'contratado' from rp_ctx union all
select dest_owner_staff, dest_id, 'Dono destino', dest_owner_id, 'dono' from rp_ctx union all
select dest_assoc_staff, dest_id, 'Parceiro no destino', assoc_id, 'parceiro' from rp_ctx union all
select dest_employee_staff, dest_id, 'Contratado no destino', employee_id, 'contratado' from rp_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from rp_ctx union all
select shop_id, assoc_id, assoc_staff, 'associate'::public.shop_member_role, null from rp_ctx union all
select shop_id, employee_id, employee_staff, 'employee'::public.shop_member_role, null from rp_ctx union all
select dest_id, dest_owner_id, dest_owner_staff, 'owner'::public.shop_member_role, 100 from rp_ctx union all
select dest_id, assoc_id, dest_assoc_staff, 'associate'::public.shop_member_role, null from rp_ctx union all
select dest_id, employee_id, dest_employee_staff, 'employee'::public.shop_member_role, null from rp_ctx;
insert into public.availability_blocks(id, barbershop_id, staff_id, starts_at, ends_at, reason)
select owner_block, shop_id, owner_staff, now() + interval '2 days', now() + interval '2 days 1 hour', 'Consulta médica do dono' from rp_ctx union all
select assoc_block, shop_id, assoc_staff, now() + interval '3 days', now() + interval '3 days 1 hour', 'Particular do parceiro' from rp_ctx union all
select shop_block, shop_id, null, now() + interval '4 days', now() + interval '4 days 8 hours', 'Feriado da loja' from rp_ctx;

-- ---------------------------------------------------------------------------
-- Permissões das funções novas
-- ---------------------------------------------------------------------------

select pg_temp.check_rp(
  not has_function_privilege('anon', 'public.list_shop_blocks(uuid, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.list_shop_blocks(uuid, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.list_platform_shop_owners()', 'execute')
  and has_function_privilege('authenticated', 'public.list_platform_shop_owners()', 'execute')
  and not has_function_privilege('anon', 'public.request_shop_departure(uuid, public.shop_departure_mode, uuid)', 'execute'),
  'Funções fechadas para visitantes e abertas só para quem entrou');

-- ---------------------------------------------------------------------------
-- P-04. Bloqueios: Parceiro não recebe nome nem motivo dos colegas
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', assoc_id::text, true) from rp_ctx;
set local role authenticated;
select pg_temp.check_rp(
  not exists (
    select 1 from public.availability_blocks b join rp_ctx c on b.id = c.owner_block),
  'Parceiro não lê direto o bloqueio do dono');
select pg_temp.check_rp(
  (select count(*) from public.availability_blocks b join rp_ctx c
     on b.id in (c.assoc_block, c.shop_block)) = 2,
  'Parceiro lê direto o próprio bloqueio e o da loja inteira');
select pg_temp.check_rp(
  exists (
    select 1 from rp_ctx c, public.list_shop_blocks(c.shop_id, now()) l
    where l.id = c.owner_block and l.reason is null and l.staff_display_name is null
      and l.staff_id = c.owner_staff),
  'Bloqueio do dono chega ao Parceiro só com o intervalo, sem nome nem motivo');
select pg_temp.check_rp(
  exists (
    select 1 from rp_ctx c, public.list_shop_blocks(c.shop_id, now()) l
    where l.id = c.assoc_block and l.reason = 'Particular do parceiro'
      and l.staff_display_name = 'Parceiro RP'),
  'Parceiro recebe o próprio bloqueio completo');
select pg_temp.check_rp(
  exists (
    select 1 from rp_ctx c, public.list_shop_blocks(c.shop_id, now()) l
    where l.id = c.shop_block and l.reason = 'Feriado da loja'),
  'Bloqueio da loja inteira chega com o motivo');
reset role;

select set_config('request.jwt.claim.sub', employee_id::text, true) from rp_ctx;
set local role authenticated;
select pg_temp.check_rp(
  exists (
    select 1 from rp_ctx c, public.list_shop_blocks(c.shop_id, now()) l
    where l.id = c.assoc_block and l.reason is null and l.staff_display_name is null),
  'Contratado também não recebe nome nem motivo do colega');
reset role;

select set_config('request.jwt.claim.sub', owner_id::text, true) from rp_ctx;
set local role authenticated;
select pg_temp.check_rp(
  (select count(*) from public.availability_blocks b join rp_ctx c
     on b.id in (c.owner_block, c.assoc_block, c.shop_block)) = 3,
  'Dono lê direto todos os bloqueios');
select pg_temp.check_rp(
  exists (
    select 1 from rp_ctx c, public.list_shop_blocks(c.shop_id, now()) l
    where l.id = c.assoc_block and l.reason = 'Particular do parceiro'
      and l.staff_display_name = 'Parceiro RP'),
  'Dono recebe nome e motivo do bloqueio do Parceiro');
select pg_temp.check_rp(
  (select count(*) from rp_ctx c, public.list_shop_blocks(c.shop_id, now() + interval '3 days 2 hours') l
     where l.barbershop_id = c.shop_id) = 1,
  'Lista começa na data pedida');
reset role;

select set_config('request.jwt.claim.sub', outsider_id::text, true) from rp_ctx;
set local role authenticated;
select pg_temp.expect_rp_error(
  'select * from public.list_shop_blocks((select shop_id from rp_ctx), now())',
  'Pessoa de fora não lista os bloqueios da loja', '42501');
select pg_temp.check_rp(
  not exists (
    select 1 from public.availability_blocks b join rp_ctx c on b.barbershop_id = c.shop_id),
  'Pessoa de fora não lê bloqueio nenhum direto');
reset role;

-- ---------------------------------------------------------------------------
-- P-07. Donos e sócios ativos para o painel da plataforma
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', admin_id::text, true) from rp_ctx;
set local role authenticated;
select pg_temp.check_rp(
  exists (
    select 1 from rp_ctx c, public.list_platform_shop_owners() o
    where o.barbershop_id = c.shop_id and o.user_id = c.owner_id)
  and not exists (
    select 1 from rp_ctx c, public.list_platform_shop_owners() o
    where o.barbershop_id = c.shop_id and o.user_id in (c.assoc_id, c.employee_id)),
  'Admin da plataforma vê o dono da loja, sem Parceiro nem Contratado');
reset role;

select set_config('request.jwt.claim.sub', owner_id::text, true) from rp_ctx;
set local role authenticated;
select pg_temp.expect_rp_error(
  'select * from public.list_platform_shop_owners()',
  'Dono de loja não lê a lista da plataforma', '42501');
reset role;

-- ---------------------------------------------------------------------------
-- P-01. Saída: Contratado não leva clientes; os demais casos continuam iguais
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', owner_id::text, true) from rp_ctx;
set local role authenticated;
select pg_temp.expect_rp_error(
  'select public.request_shop_departure((select shop_id from rp_ctx), ''take'', (select dest_id from rp_ctx))',
  'Dono único continua sem poder sair levando a carteira', '42501');
reset role;

select set_config('request.jwt.claim.sub', employee_id::text, true) from rp_ctx;
set local role authenticated;
select pg_temp.expect_rp_error(
  'select public.request_shop_departure((select shop_id from rp_ctx), ''take'', (select dest_id from rp_ctx))',
  'Contratado não sai levando os clientes', '42501');
reset role;
select pg_temp.check_rp(
  exists (
    select 1 from public.shop_members sm join rp_ctx c
      on sm.barbershop_id = c.shop_id and sm.user_id = c.employee_id
    where sm.active)
  and not exists (
    select 1 from public.shop_departure_requests r join rp_ctx c
      on r.barbershop_id = c.shop_id and r.user_id = c.employee_id),
  'Recusa não abre pedido nem tira o Contratado da equipe');

select set_config('request.jwt.claim.sub', employee_id::text, true) from rp_ctx;
set local role authenticated;
select pg_temp.check_rp(
  (select public.request_shop_departure(c.shop_id, 'forfeit', null)->>'status' from rp_ctx c) = 'completed',
  'Contratado sai sem levar os clientes');
reset role;

select set_config('request.jwt.claim.sub', assoc_id::text, true) from rp_ctx;
set local role authenticated;
-- Desde 20261013190000_saida_equipe_reservas.sql (P-62), levar a carteira espera o dono.
select pg_temp.check_rp(
  (select public.request_shop_departure(c.shop_id, 'take', c.dest_id)->>'status' from rp_ctx c) = 'pending_release',
  'Parceiro pede para sair levando a carteira e espera a liberação do dono');
reset role;
select set_config('request.jwt.claim.sub', owner_id::text, true) from rp_ctx;
set local role authenticated;
select pg_temp.check_rp(
  (select public.approve_portfolio_release(r.id)->>'status'
   from public.shop_departure_requests r join rp_ctx c
     on r.barbershop_id = c.shop_id and r.user_id = c.assoc_id
   where r.status = 'pending_release') = 'completed',
  'Dono libera e o Parceiro sai levando a carteira');
reset role;
select set_config('request.jwt.claim.sub', '', true);
