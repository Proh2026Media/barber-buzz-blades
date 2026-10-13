-- Antecedência mínima para o cliente reservar (20261013150000_antecedencia_minima.sql).
-- Rodar numa transação, sempre com ROLLBACK: BEGIN; \i este arquivo; ROLLBACK;
-- Pré-requisito: 20261005120000_tempo_preparo.sql aplicada (ou no mesmo ensaio, antes).
-- Dados de teste com IDs aleatórios (não depende de dados reais). Os horários são relativos
-- ao relógio do banco: a loja abre todos os dias de 00:00 a 23:59.
create temporary table lead_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() owner_id, gen_random_uuid() cust_id,
  gen_random_uuid() staff_s, gen_random_uuid() owner_staff, gen_random_uuid() corte,
  'antecedencia-' || substr(md5(random()::text), 1, 8) slug;
grant select on lead_ctx to anon, authenticated;
select * from lead_ctx \gset

create function pg_temp.check_lead(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
-- Confere o código do erro e, se pedido, um trecho da mensagem.
create function pg_temp.expect_lead_error(statement text, expected_state text, expected_text text, label text)
returns void language plpgsql as $$
declare actual_state text; actual_message text;
begin
  begin execute statement;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate, actual_message = message_text;
  end;
  if actual_state is distinct from expected_state
     or (expected_text is not null and coalesce(actual_message, '') not ilike '%' || expected_text || '%') then
    raise notice 'Esperado % (%), recebido % (%) em %', expected_state, expected_text, actual_state, actual_message, label;
  end if;
  perform pg_temp.check_lead(
    actual_state = expected_state
      and (expected_text is null or actual_message ilike '%' || expected_text || '%'),
    label);
end $$;
-- Horários livres de S no Corte, hoje e amanhã (no fuso da loja).
create function pg_temp.lslots() returns setof timestamptz language sql stable as $$
  select x.starts_at
  from generate_series(0, 1) d
  cross join lateral public.available_slots_internal(
    (select staff_s from lead_ctx), (select corte from lead_ctx),
    (clock_timestamp() at time zone 'America/Sao_Paulo')::date + d) x
$$;
grant execute on function pg_temp.lslots() to authenticated, anon;

insert into public.barbershops(id, name, slug, timezone)
select shop_id, 'Antecedência', slug, 'America/Sao_Paulo' from lead_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{"full_name":"Teste antecedência"}'::jsonb from lead_ctx c
cross join lateral unnest(array[c.owner_id, c.cust_id]) u;
insert into public.memberships(user_id, barbershop_id, role)
select cust_id, shop_id, 'customer'::public.app_role from lead_ctx union all
select owner_id, shop_id, 'shop_admin'::public.app_role from lead_ctx;
insert into public.staff(id, barbershop_id, display_name, booking_slug, user_id, active)
select staff_s, shop_id, 'S', 's', null::uuid, true from lead_ctx union all
select owner_staff, shop_id, 'Dono', 'dono', owner_id, false from lead_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from lead_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select corte, shop_id, 'Corte', 30, 5000 from lead_ctx;
insert into public.barbershop_settings(barbershop_id) select shop_id from lead_ctx on conflict do nothing;
update public.barbershop_settings set booking_horizon_days = 30 where barbershop_id = :'shop_id';
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select shop_id, w, true, '00:00', '23:59' from lead_ctx cross join generate_series(0, 6) w
on conflict (barbershop_id, weekday) do update set is_open = true, opens_at = '00:00', closes_at = '23:59';

-- 0. Padrão, limites e aprovação.
select pg_temp.check_lead(
  (select min_lead_minutes = 30 from public.barbershop_settings where barbershop_id = :'shop_id')
  and public.shop_min_lead_minutes(:'shop_id') = 30
  and public.shop_min_lead_minutes(gen_random_uuid()) = 30,
  'Loja nova nasce com 30 min de antecedência (e loja sem ajustes também vale 30)');
select pg_temp.expect_lead_error(format(
  'update public.barbershop_settings set min_lead_minutes = 45 where barbershop_id = %L', :'shop_id'),
  '23514', null, 'Antecedência fora da lista (45 min) é recusada');
select pg_temp.check_lead(
  not public.settings_change_is_visual(
    s, jsonb_populate_record(s, jsonb_build_object('min_lead_minutes', 60))),
  'Antecedência é mudança protegida (mesma aprovação das configurações de agendamento)')
from public.barbershop_settings s where s.barbershop_id = :'shop_id';

-- 1. Sem mínimo: o primeiro horário é o próximo da grade (no máximo 45 min à frente, por
--    causa do fim do dia às 23:59).
update public.barbershop_settings set min_lead_minutes = 0 where barbershop_id = :'shop_id';
select pg_temp.check_lead(
  (select min(s) > clock_timestamp() and min(s) <= clock_timestamp() + interval '45 minutes'
   from pg_temp.lslots() s),
  'Sem mínimo: aparece o próximo horário da grade');
-- Horário dentro das próximas 2 horas, para os testes de recusa.
create temporary table lead_pick as
select min(s) as soon from pg_temp.lslots() s where s >= clock_timestamp() + interval '20 minutes';
grant select on lead_pick to authenticated;
select soon from lead_pick \gset
select pg_temp.check_lead(
  :'soon'::timestamptz < clock_timestamp() + interval '100 minutes',
  'Achou um horário livre entre 20 e 100 minutos à frente');

-- 2. Duas horas: nada antes de agora + 2 h, e o primeiro logo depois.
update public.barbershop_settings set min_lead_minutes = 120 where barbershop_id = :'shop_id';
select pg_temp.check_lead(
  exists (select 1 from public.availability_signals where barbershop_id = :'shop_id'),
  'Mudar a antecedência avisa as telas abertas');
select pg_temp.check_lead(
  (select min(s) >= clock_timestamp() + interval '120 minutes'
      and min(s) <= clock_timestamp() + interval '165 minutes'
   from pg_temp.lslots() s)
  and not exists (select 1 from pg_temp.lslots() s where s = :'soon'::timestamptz),
  '2 h: a lista começa em agora + 2 h e não mostra o horário próximo');

-- 3. Cliente marcando para si: dentro da antecedência é recusado com a frase própria.
create temporary table lead_first as select min(s) as first_ok from pg_temp.lslots() s;
grant select on lead_first to authenticated;
select first_ok from lead_first \gset
set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_id', true);
select pg_temp.expect_lead_error(format(
  'insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
   values (%L, %L, %L, %L, %L::timestamptz, %L::timestamptz + interval ''30 minutes'')',
  :'shop_id', :'cust_id', :'corte', :'staff_s', :'soon', :'soon'),
  '22023', 'pelo menos 2 h de antecedência', 'Cliente: horário dentro das 2 h é recusado com a frase da antecedência');
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
values (:'shop_id', :'cust_id', :'corte', :'staff_s', :'first_ok', :'first_ok'::timestamptz + interval '30 minutes');
select pg_temp.check_lead(
  exists (select 1 from public.appointments
          where customer_id = :'cust_id' and starts_at = :'first_ok'::timestamptz),
  'Cliente: o primeiro horário oferecido (depois das 2 h) é aceito');
-- Remarcação pelo cliente para dentro da antecedência também é recusada.
select pg_temp.expect_lead_error(format(
  'select public.reschedule_own_appointment(%L, %L, %L, %L::timestamptz, %L::timestamptz + interval ''30 minutes'')',
  (select id from public.appointments where customer_id = :'cust_id' order by created_at desc limit 1),
  :'corte', :'staff_s', :'soon', :'soon'),
  '22023', 'antecedência', 'Cliente: remarcar para dentro das 2 h é recusado');
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- 4. Painel: o dono continua livre para remarcar o cliente para dentro da antecedência.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_id', true);
update public.appointments
   set starts_at = :'soon'::timestamptz, ends_at = :'soon'::timestamptz + interval '30 minutes'
 where customer_id = :'cust_id' and starts_at = :'first_ok'::timestamptz;
select pg_temp.check_lead(
  exists (select 1 from public.appointments
          where customer_id = :'cust_id' and starts_at = :'soon'::timestamptz),
  'Painel: dono remarca o cliente para dentro das 2 h');
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- 5. Agendamento que já existe dentro da antecedência: o cliente ainda consegue cancelar.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_id', true);
select public.cancel_appointment(
  (select id from public.appointments where staff_id = :'staff_s' and starts_at = :'soon'::timestamptz),
  null);
reset role;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.check_lead(
  (select status = 'cancelled' from public.appointments
   where staff_id = :'staff_s' and starts_at = :'soon'::timestamptz),
  'Cliente cancela um agendamento que já está dentro da antecedência');

-- 6. Pedido aprovado grava a antecedência; mandar outro campo mantém o valor.
select public.apply_shop_change(:'shop_id', 'settings.operational', '{"min_lead_minutes": 1440}'::jsonb);
select pg_temp.check_lead(
  (select min_lead_minutes = 1440 from public.barbershop_settings where barbershop_id = :'shop_id')
  and not exists (select 1 from pg_temp.lslots() s where s < clock_timestamp() + interval '24 hours'),
  'Pedido aprovado grava 24 h e a lista some até amanhã neste horário');
select public.apply_shop_change(:'shop_id', 'settings.operational', '{"booking_horizon_days": 21}'::jsonb);
select pg_temp.check_lead(
  (select min_lead_minutes = 1440 from public.barbershop_settings where barbershop_id = :'shop_id'),
  'Salvar outra regra sem mandar a antecedência mantém o valor');
