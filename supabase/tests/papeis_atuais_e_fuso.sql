-- Papéis atuais da equipe, fuso rápido e pedidos da sociedade
-- (20261013180000_papeis_atuais_e_fuso.sql): P-56, P-57 e P-58.
-- Rodar numa transação, sempre com ROLLBACK: BEGIN; \i este arquivo; ROLLBACK;
-- Dados fictícios com IDs aleatórios. A loja abre todos os dias de 00:00 a 23:59 e os
-- atendimentos ficam daqui a 2 dias, às 10h, 11h e 12h (fuso da loja). Permissões da matriz
-- no padrão: Dono/sócio com visão geral; Parceiro com números sem identificação; Contratado só
-- com a própria agenda.
create temporary table pf_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() other_shop,
  gen_random_uuid() owner_id, gen_random_uuid() owner_staff,
  gen_random_uuid() socio_id, gen_random_uuid() socio_staff,
  gen_random_uuid() assoc_id, gen_random_uuid() assoc_staff,
  gen_random_uuid() employee_id, gen_random_uuid() employee_staff,
  gen_random_uuid() cust_id, gen_random_uuid() outsider_id, gen_random_uuid() corte,
  gen_random_uuid() ap_owner, gen_random_uuid() ap_assoc, gen_random_uuid() ap_employee,
  ((now() at time zone 'America/Sao_Paulo')::date + 2) as day;
grant select on pf_ctx to authenticated;
select * from pf_ctx \gset

create function pg_temp.check_pf(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_pf_error(statement text, label text, expected_state text default null)
returns void language plpgsql as $$
declare failed boolean := false; state text;
begin
  begin execute statement; exception when others then failed := true; state := sqlstate; end;
  if failed and expected_state is not null and state is distinct from expected_state then
    raise notice 'código recebido: %', state;
    failed := false;
  end if;
  perform pg_temp.check_pf(failed, label);
end $$;
create function pg_temp.expect_pf_ok(statement text, label text)
returns void language plpgsql as $$
declare msg text;
begin
  begin execute statement;
  exception when others then
    get stacked diagnostics msg = message_text;
    raise notice 'erro: % (%)', msg, sqlstate;
    perform pg_temp.check_pf(false, label);
    return;
  end;
  perform pg_temp.check_pf(true, label);
end $$;

insert into public.barbershops(id, name, slug, timezone)
select shop_id, 'Papéis atuais', 'pf-' || shop_id, 'America/Sao_Paulo' from pf_ctx union all
select other_shop, 'Outra loja', 'pf-outra-' || other_shop, 'America/Manaus' from pf_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{"full_name":"Pessoa PF"}'::jsonb
from pf_ctx c
cross join lateral unnest(array[c.owner_id, c.socio_id, c.assoc_id, c.employee_id,
  c.cust_id, c.outsider_id]) u;
update public.profiles set full_name = 'Cliente PF' where id = :'cust_id';
insert into public.memberships(user_id, barbershop_id, role)
select cust_id, shop_id, 'customer'::public.app_role from pf_ctx;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono PF', owner_id, 'dono' from pf_ctx union all
select socio_staff, shop_id, 'Sócio PF', socio_id, 'socio' from pf_ctx union all
select assoc_staff, shop_id, 'Parceiro PF', assoc_id, 'parceiro' from pf_ctx union all
select employee_staff, shop_id, 'Contratado PF', employee_id, 'contratado' from pf_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 70 from pf_ctx union all
select shop_id, socio_id, socio_staff, 'owner'::public.shop_member_role, 30 from pf_ctx union all
select shop_id, assoc_id, assoc_staff, 'associate'::public.shop_member_role, null from pf_ctx union all
select shop_id, employee_id, employee_staff, 'employee'::public.shop_member_role, null from pf_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select corte, shop_id, 'Corte', 30, 5000 from pf_ctx;
insert into public.barbershop_settings(barbershop_id) select shop_id from pf_ctx on conflict do nothing;
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select shop_id, w, true, '00:00', '23:59' from pf_ctx cross join generate_series(0, 6) w
on conflict (barbershop_id, weekday) do update set is_open = true, opens_at = '00:00', closes_at = '23:59';
insert into public.appointments(id, barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status)
select x.ap, c.shop_id, c.cust_id, c.corte, x.st,
  (c.day + x.h) at time zone 'America/Sao_Paulo',
  (c.day + x.h + interval '30 minutes') at time zone 'America/Sao_Paulo', 'confirmed'
from pf_ctx c
cross join lateral (values (c.ap_owner, c.owner_staff, time '10:00'),
  (c.ap_assoc, c.assoc_staff, time '11:00'), (c.ap_employee, c.employee_staff, time '12:00')) x(ap, st, h);

-- ---------------------------------------------------------------------------
-- P-56. Fuso da loja
-- ---------------------------------------------------------------------------

select pg_temp.check_pf(
  public.shop_tz(:'shop_id') = 'America/Sao_Paulo'
  and public.shop_tz(:'other_shop') = 'America/Manaus'
  and public.shop_tz(gen_random_uuid()) = 'America/Sao_Paulo',
  'Fuso da loja: o gravado vale; loja inexistente cai em São Paulo');
-- Chamadas separadas (como nas funções de horários livres), sem o planejador juntar em uma.
create temporary table pf_timing(elapsed interval);
do $$
declare t0 timestamptz := clock_timestamp(); x text; s uuid;
begin
  select shop_id into s from pf_ctx;
  for i in 1..200 loop x := public.shop_tz(s); end loop;
  insert into pf_timing values (clock_timestamp() - t0);
end $$;
select pg_temp.check_pf(
  (select elapsed < interval '1 second' from pf_timing),
  '200 consultas do fuso em menos de 1 s (antes: ~0,4 s cada)');

-- ---------------------------------------------------------------------------
-- P-57. Pedidos da sociedade
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', :'socio_id', true);
set local role authenticated;
select pg_temp.expect_pf_ok(format('select public.list_pending_shop_changes(%L)', :'shop_id'),
  'Sócio abre a lista de pedidos da sociedade (antes: erro de função só leitura)');
reset role;
select set_config('request.jwt.claim.sub', :'employee_id', true);
set local role authenticated;
select pg_temp.expect_pf_error(format('select public.list_pending_shop_changes(%L)', :'shop_id'),
  'Contratado não lê os pedidos da sociedade', '42501');
reset role;

-- ---------------------------------------------------------------------------
-- P-58. Reserva: horários livres e termos para equipe e cliente; pessoa de fora não
-- ---------------------------------------------------------------------------

do $$
declare u uuid; c pf_ctx;
begin
  select * into c from pf_ctx;
  foreach u in array array[c.owner_id, c.socio_id, c.assoc_id, c.employee_id, c.cust_id] loop
    perform set_config('request.jwt.claim.sub', u::text, true);
    perform public.get_available_slots(c.shop_id, c.corte, c.day, null);
    perform public.get_booking_terms(c.shop_id);
    perform public.get_waiting_state(c.shop_id);
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select pg_temp.check_pf(true, 'Dono, sócio, Parceiro, Contratado e cliente veem horários, termos e espera');
select set_config('request.jwt.claim.sub', :'outsider_id', true);
set local role authenticated;
select pg_temp.expect_pf_error(format('select public.get_available_slots(%L, %L, %L::date, null)', :'shop_id', :'corte', :'day'),
  'Pessoa de fora não lê horários livres pela função da equipe', '42501');
select pg_temp.expect_pf_error(format('select public.get_booking_terms(%L)', :'shop_id'),
  'Pessoa de fora não lê os termos de reserva', '42501');
reset role;

-- ---------------------------------------------------------------------------
-- P-58. Agenda: cada um no que é seu; visão geral para dono e sócio
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', :'employee_id', true);
set local role authenticated;
select pg_temp.expect_pf_ok(format('select public.get_appointment_attendance(%L)', :'ap_employee'),
  'Contratado lê a presença do próprio atendimento');
select pg_temp.expect_pf_error(format('select public.get_appointment_attendance(%L)', :'ap_assoc'),
  'Contratado não lê a presença do atendimento do colega', 'P0001');
select pg_temp.expect_pf_error(format('select public.cancel_appointment(%L, null)', :'ap_assoc'),
  'Contratado não cancela atendimento do colega', 'P0001');
select pg_temp.expect_pf_ok(format('select public.withdraw_appointment_confirmation(%L)', :'ap_employee'),
  'Contratado retira a confirmação do próprio atendimento');
select pg_temp.expect_pf_ok(format('select public.cancel_appointment(%L, ''schedule'')', :'ap_employee'),
  'Contratado cancela o próprio atendimento (antes: Not allowed)');
select pg_temp.check_pf(
  (select jsonb_array_length(public.get_appointment_cancellations(:'shop_id')) = 1),
  'Contratado vê o cancelamento do próprio atendimento');
reset role;

select set_config('request.jwt.claim.sub', :'assoc_id', true);
set local role authenticated;
select pg_temp.check_pf(
  (select jsonb_array_length(public.get_appointment_cancellations(:'shop_id')) = 0),
  'Parceiro não vê cancelamento da agenda do colega');
select pg_temp.expect_pf_ok(format('select public.get_occurrence_insights(%L, now() - interval ''30 days'', now())', :'shop_id'),
  'Parceiro lê os números sem identificação (antes: Not allowed)');
reset role;

select set_config('request.jwt.claim.sub', :'employee_id', true);
set local role authenticated;
select pg_temp.expect_pf_error(format('select public.get_occurrence_insights(%L, now() - interval ''30 days'', now())', :'shop_id'),
  'Contratado não lê os números da loja', 'P0001');
reset role;

select set_config('request.jwt.claim.sub', :'socio_id', true);
set local role authenticated;
select pg_temp.check_pf(
  (select jsonb_array_length(public.get_appointment_cancellations(:'shop_id')) = 1),
  'Sócio vê os cancelamentos da loja');
select pg_temp.check_pf(
  exists (select 1 from public.profiles where id = (select cust_id from pf_ctx) and full_name = 'Cliente PF'),
  'Sócio lê o nome do cliente dos atendimentos da loja');
select pg_temp.expect_pf_ok(format('select public.cancel_appointment(%L, ''other'')', :'ap_assoc'),
  'Sócio (30%) cancela atendimento do Parceiro (antes: Not allowed)');
select pg_temp.expect_pf_ok(format('select public.get_service_interest_insights(%L, now() - interval ''30 days'', now())', :'shop_id'),
  'Sócio lê os números de interesse');
reset role;

select set_config('request.jwt.claim.sub', :'outsider_id', true);
set local role authenticated;
select pg_temp.expect_pf_error(format('select public.cancel_appointment(%L, null)', :'ap_owner'),
  'Pessoa de fora não cancela atendimento', 'P0001');
select pg_temp.expect_pf_error(format('select public.get_appointment_cancellations(%L)', :'shop_id'),
  'Pessoa de fora não lê cancelamentos da loja', 'P0001');
select pg_temp.check_pf(
  not exists (select 1 from public.profiles where id = (select cust_id from pf_ctx)),
  'Pessoa de fora não lê o perfil do cliente');
reset role;

-- ---------------------------------------------------------------------------
-- P-58. Ajuste da espera: dono pela equipe liga e desliga
-- ---------------------------------------------------------------------------

-- apply_shop_change é a etapa do servidor de um pedido já aprovado; aqui roda como o servidor,
-- com a conta do dono na sessão.
select set_config('request.jwt.claim.sub', :'owner_id', true);
select pg_temp.expect_pf_ok(format(
  'select public.apply_shop_change(%L, ''settings.operational'', ''{"waiting_enabled": true}''::jsonb)', :'shop_id'),
  'Dono (pela equipe) aplica mudança da espera sem ser barrado pelo gatilho');
select pg_temp.check_pf(
  (select waiting_enabled from public.barbershop_settings where barbershop_id = :'shop_id'),
  'Espera ligada');
select set_config('app.approved_shop_change', '', true);
select set_config('request.jwt.claim.sub', :'employee_id', true);
select pg_temp.expect_pf_error(format(
  'update public.barbershop_settings set waiting_enabled = false where barbershop_id = %L', :'shop_id'),
  'Contratado não muda a espera direto');
select set_config('request.jwt.claim.sub', '', true);
