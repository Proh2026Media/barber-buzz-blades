-- Saída da equipe, reservas de quem sai, reconvite e reativação
-- (20261013190000_saida_equipe_reservas.sql): P-59 a P-62 e P-64.
-- Rodar numa transação, sempre com ROLLBACK: BEGIN; \i este arquivo; ROLLBACK;
-- Pré-requisito: 20261013180000_papeis_atuais_e_fuso.sql aplicada (ou no mesmo ensaio, antes).
-- Dados fictícios com IDs aleatórios. A loja abre todos os dias de 00:00 a 23:59; as reservas
-- ficam daqui a 2 dias (fuso da loja).
create temporary table se_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() dest_id,
  gen_random_uuid() owner_id, gen_random_uuid() owner_staff,
  gen_random_uuid() assoc_id, gen_random_uuid() assoc_staff,
  gen_random_uuid() employee_id, gen_random_uuid() employee_staff,
  gen_random_uuid() colleague_id, gen_random_uuid() colleague_staff,
  gen_random_uuid() dest_owner_id, gen_random_uuid() dest_owner_staff, gen_random_uuid() dest_assoc_staff,
  gen_random_uuid() cust_id, gen_random_uuid() corte,
  gen_random_uuid() ap_assoc, gen_random_uuid() ap_employee, gen_random_uuid() ap_colleague,
  ((now() at time zone 'America/Sao_Paulo')::date + 2) as day;
grant select on se_ctx to authenticated;
select * from se_ctx \gset

create function pg_temp.check_se(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_se_error(statement text, label text, expected_state text default null, expected_text text default null)
returns void language plpgsql as $$
declare failed boolean := false; state text; msg text;
begin
  begin execute statement;
  exception when others then
    failed := true;
    get stacked diagnostics state = returned_sqlstate, msg = message_text;
  end;
  if failed and ((expected_state is not null and state is distinct from expected_state)
     or (expected_text is not null and msg not ilike '%' || expected_text || '%')) then
    raise notice 'recebido: % (%)', msg, state;
    failed := false;
  end if;
  perform pg_temp.check_se(failed, label);
end $$;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true)
$$;

insert into public.barbershops(id, name, slug, timezone)
select shop_id, 'Saída equipe', 'se-' || shop_id, 'America/Sao_Paulo' from se_ctx union all
select dest_id, 'Saída destino', 'se-dest-' || dest_id, 'America/Sao_Paulo' from se_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{"full_name":"Pessoa SE"}'::jsonb
from se_ctx c
cross join lateral unnest(array[c.owner_id, c.assoc_id, c.employee_id, c.colleague_id,
  c.dest_owner_id, c.cust_id]) u;
insert into public.memberships(user_id, barbershop_id, role)
select cust_id, shop_id, 'customer'::public.app_role from se_ctx;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono SE', owner_id, 'dono' from se_ctx union all
select assoc_staff, shop_id, 'Parceiro SE', assoc_id, 'parceiro' from se_ctx union all
select employee_staff, shop_id, 'Contratado SE', employee_id, 'contratado' from se_ctx union all
select colleague_staff, shop_id, 'Colega SE', colleague_id, 'colega' from se_ctx union all
select dest_owner_staff, dest_id, 'Dono destino', dest_owner_id, 'dono' from se_ctx union all
select dest_assoc_staff, dest_id, 'Parceiro no destino', assoc_id, 'parceiro' from se_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from se_ctx union all
select shop_id, assoc_id, assoc_staff, 'associate'::public.shop_member_role, null from se_ctx union all
select shop_id, employee_id, employee_staff, 'employee'::public.shop_member_role, null from se_ctx union all
select shop_id, colleague_id, colleague_staff, 'employee'::public.shop_member_role, null from se_ctx union all
select dest_id, dest_owner_id, dest_owner_staff, 'owner'::public.shop_member_role, 100 from se_ctx union all
select dest_id, assoc_id, dest_assoc_staff, 'associate'::public.shop_member_role, null from se_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select corte, shop_id, 'Corte', 30, 5000 from se_ctx;
insert into public.barbershop_settings(barbershop_id) select shop_id from se_ctx on conflict do nothing;
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select shop_id, w, true, '00:00', '23:59' from se_ctx cross join generate_series(0, 6) w
on conflict (barbershop_id, weekday) do update set is_open = true, opens_at = '00:00', closes_at = '23:59';
-- Parceiro às 10h; Contratado às 11h; o colega também às 11h (ocupado nesse horário).
insert into public.appointments(id, barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status)
select x.ap, c.shop_id, c.cust_id, c.corte, x.st,
  (c.day + x.h) at time zone 'America/Sao_Paulo',
  (c.day + x.h + interval '30 minutes') at time zone 'America/Sao_Paulo', 'confirmed'
from se_ctx c
cross join lateral (values (c.ap_assoc, c.assoc_staff, time '10:00'),
  (c.ap_employee, c.employee_staff, time '11:00'),
  (c.ap_colleague, c.colleague_staff, time '11:00')) x(ap, st, h);
update public.appointments set booked_price_cents = 7000 where id = :'ap_assoc';

-- ---------------------------------------------------------------------------
-- Permissões (P-64: funções internas de equipe fechadas para contas logadas)
-- ---------------------------------------------------------------------------

select pg_temp.check_se(
  not has_function_privilege('authenticated', 'public.apply_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.apply_update_shop_member(uuid, uuid, public.shop_member_role, numeric, boolean)', 'execute')
  and has_function_privilege('service_role', 'public.apply_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.staff_future_appointment_count(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.list_departure_appointments(uuid, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.list_departure_appointments(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.reassign_appointment_staff(uuid, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.reassign_appointment_staff(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.cancel_shop_departure(uuid)', 'execute'),
  'Funções internas fechadas; funções novas só para quem entrou');

-- ---------------------------------------------------------------------------
-- P-62. Parceiro levando os clientes espera o dono
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'assoc_id');
set local role authenticated;
create temporary table se_req as
select (public.request_shop_departure(:'shop_id', 'take', :'dest_id')) r;
reset role;
select pg_temp.check_se(
  (select r->>'status' = 'pending_release' and (r->>'future_bookings')::int = 1 from se_req)
  and exists (select 1 from public.shop_members where barbershop_id = :'shop_id' and user_id = :'assoc_id' and active),
  'Parceiro pede para sair levando os clientes: fica aguardando o dono e continua na equipe');
select (r->>'request_id') as assoc_req from se_req \gset

select pg_temp.as_user(:'assoc_id');
set local role authenticated;
select pg_temp.check_se(
  (select jsonb_array_length(public.list_shop_departure_requests(:'shop_id')) = 1),
  'Parceiro vê o próprio pedido');
select pg_temp.expect_se_error(format('select public.approve_portfolio_release(%L)', :'assoc_req'),
  'Parceiro não libera o próprio pedido', '42501');
select pg_temp.expect_se_error(format('select public.complete_shop_departure(%L)', :'assoc_req'),
  'Parceiro não conclui antes da liberação e a mensagem fala do dono', '42501', 'liberação do dono');
reset role;

select pg_temp.as_user(:'employee_id');
set local role authenticated;
select pg_temp.check_se(
  (select jsonb_array_length(public.list_shop_departure_requests(:'shop_id')) = 0),
  'Contratado abre a lista de saídas sem ver o pedido do colega (antes: Not allowed)');
select pg_temp.expect_se_error(format('select public.approve_portfolio_release(%L)', :'assoc_req'),
  'Contratado não libera saída', '42501');
reset role;

-- ---------------------------------------------------------------------------
-- P-61. Dono resolve as reservas antes de liberar
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.check_se(
  (select x->>'requester_role' = 'associate' and (x->>'future_bookings')::int = 1
   from jsonb_array_elements(public.list_shop_departure_requests(:'shop_id')) x
   where x->>'id' = :'assoc_req'),
  'Dono vê o pedido com o papel de quem pede e as reservas que faltam resolver');
select pg_temp.expect_se_error(format('select public.approve_portfolio_release(%L)', :'assoc_req'),
  'Liberar com reserva futura é recusado com a frase das reservas', 'P0001', 'reserva(s) futura(s)');
create temporary table se_list as
select public.list_departure_appointments(:'shop_id', :'assoc_staff') l;
select pg_temp.check_se(
  (select jsonb_array_length(l) = 1
     and l->0->>'id' = (select ap_assoc::text from se_ctx)
     and l->0->>'customer_name' is not null
     and exists (select 1 from jsonb_array_elements(l->0->'free_staff') f where f->>'id' = (select colleague_staff::text from se_ctx))
     and not exists (select 1 from jsonb_array_elements(l->0->'free_staff') f where f->>'id' = (select assoc_staff::text from se_ctx))
   from se_list),
  'Lista as reservas futuras de quem sai, com os colegas livres no horário');
select pg_temp.expect_se_error(format('select public.reassign_appointment_staff(%L, %L)', :'ap_employee', :'colleague_staff'),
  'Passar para colega ocupado no horário é recusado', '23P01');
select public.reassign_appointment_staff(:'ap_assoc', :'colleague_staff');
reset role;
select pg_temp.check_se(
  (select staff_id = :'colleague_staff'::uuid and booked_price_cents = 7000 and status = 'confirmed'
   from public.appointments where id = :'ap_assoc'),
  'Reserva passou para o colega, com o mesmo preço combinado e ainda confirmada');

select pg_temp.as_user(:'employee_id');
set local role authenticated;
select pg_temp.expect_se_error(format('select public.reassign_appointment_staff(%L, %L)', :'ap_employee', :'owner_staff'),
  'Contratado não passa reserva para outro profissional', '42501');
select pg_temp.expect_se_error(format('select public.list_departure_appointments(%L, %L)', :'shop_id', :'colleague_staff'),
  'Contratado não lista as reservas do colega', '42501');
reset role;

select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.check_se(
  (select public.approve_portfolio_release(:'assoc_req')->>'status' = 'completed'),
  'Sem reservas futuras, o dono libera e a saída se conclui');
reset role;
select pg_temp.check_se(
  not exists (select 1 from public.shop_members where barbershop_id = :'shop_id' and user_id = :'assoc_id' and active)
  and not (select active from public.staff where id = :'assoc_staff'),
  'Parceiro saiu da equipe e da agenda');

-- ---------------------------------------------------------------------------
-- P-61. Contratado sai sem levar, com reserva futura: espera o dono, sem recusa
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'employee_id');
set local role authenticated;
create temporary table se_req2 as
select public.request_shop_departure(:'shop_id', 'forfeit', null) r;
reset role;
select (r->>'request_id') as emp_req from se_req2 \gset
select pg_temp.check_se(
  (select r->>'status' = 'pending_release' from se_req2)
  and exists (select 1 from public.shop_members where barbershop_id = :'shop_id' and user_id = :'employee_id' and active),
  'Contratado com reserva futura: saída fica aguardando o dono');

select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.expect_se_error(format('select public.reject_portfolio_release(%L)', :'emp_req'),
  'Saída sem levar clientes não pode ser recusada', '22023');
reset role;

select pg_temp.as_user(:'employee_id');
set local role authenticated;
select pg_temp.check_se(
  (select public.cancel_shop_departure(:'emp_req')->>'status' = 'cancelled'),
  'Contratado desiste do pedido que esperava o dono');
create temporary table se_req3 as
select public.request_shop_departure(:'shop_id', 'forfeit', null) r;
reset role;
select (r->>'request_id') as emp_req3 from se_req3 \gset

select pg_temp.as_user(:'owner_id');
set local role authenticated;
select public.cancel_appointment(:'ap_employee', 'other');
select pg_temp.check_se(
  (select public.approve_portfolio_release(:'emp_req3')->>'status' = 'completed'),
  'Dono cancela a reserva (cliente avisado pelo aviso de cancelamento) e libera a saída');
reset role;
select pg_temp.check_se(
  (select status = 'cancelled' from public.appointments where id = :'ap_employee')
  and not (select active from public.staff where id = :'employee_staff'),
  'Reserva cancelada e Contratado fora da agenda');

-- ---------------------------------------------------------------------------
-- P-61. Tirar da equipe em Gerenciar com reservas futuras é recusado
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.expect_se_error(format(
  'select public.shop_update_member(%L, (select id from public.shop_members where barbershop_id = %L and user_id = %L), null, null, false)',
  :'shop_id', :'shop_id', :'colleague_id'),
  'Desativar quem tem reservas futuras é recusado com a frase das reservas', 'P0001', 'reserva(s) futura(s)');
select public.cancel_appointment(:'ap_assoc', 'other');
select public.cancel_appointment(:'ap_colleague', 'other');
select pg_temp.check_se(
  (select public.shop_update_member(:'shop_id', (select id from public.shop_members where barbershop_id = :'shop_id' and user_id = :'colleague_id'), null, null, false)->>'status' = 'applied'),
  'Sem reservas futuras, o dono desativa o colega');
reset role;
select pg_temp.check_se(
  not (select active from public.staff where id = :'colleague_staff'),
  'P-60: desativar tira a ficha do colega da agenda');

select pg_temp.as_user(:'owner_id');
set local role authenticated;
select public.shop_update_member(:'shop_id', (select id from public.shop_members where barbershop_id = :'shop_id' and user_id = :'colleague_id'), null, null, true);
reset role;
select pg_temp.check_se(
  (select active from public.staff where id = :'colleague_staff')
  and exists (select 1 from public.shop_members where barbershop_id = :'shop_id' and user_id = :'colleague_id' and active),
  'P-60: reativar devolve a ficha do colega à agenda');

-- ---------------------------------------------------------------------------
-- P-59. Convidar de novo quem saiu reativa o vínculo
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.check_se(
  (select public.shop_add_member(:'shop_id', :'employee_id', 'associate', null, null)->>'status' = 'applied'),
  'Dono convida de novo o ex-Contratado (antes: "This account already belongs…")');
select pg_temp.expect_se_error(format('select public.shop_add_member(%L, %L, ''employee'', null, null)', :'shop_id', :'colleague_id'),
  'Convidar quem está ativo avisa que já está na equipe', '23505', 'já está na equipe');
reset role;
select pg_temp.check_se(
  (select count(*) = 1 and bool_and(active) and bool_and(role = 'associate') and bool_and(staff_id = :'employee_staff'::uuid)
   from public.shop_members where barbershop_id = :'shop_id' and user_id = :'employee_id')
  and (select active from public.staff where id = :'employee_staff'),
  'Volta com o papel novo, o mesmo vínculo e a mesma ficha de profissional, ativa');

-- ---------------------------------------------------------------------------
-- Sem reservas futuras, a saída sem levar continua imediata
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'colleague_id');
set local role authenticated;
select pg_temp.check_se(
  (select public.request_shop_departure(:'shop_id', 'forfeit', null)->>'status' = 'completed'),
  'Sem reservas futuras, quem sai sem levar clientes sai na hora');
reset role;
select set_config('request.jwt.claim.sub', '', true);
