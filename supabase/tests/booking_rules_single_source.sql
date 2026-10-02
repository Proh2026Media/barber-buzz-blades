-- Regras de agendamento com fonte única (20261002190000_booking_rules_single_source.sql).
-- Rodar numa transação, sempre com ROLLBACK. Dados de teste com IDs aleatórios.
create temporary table rules_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() plain_shop_id, gen_random_uuid() land_shop_id,
  gen_random_uuid() owner_id, gen_random_uuid() cust_id,
  gen_random_uuid() staff_a, gen_random_uuid() staff_b, gen_random_uuid() staff_c,
  gen_random_uuid() staff_x, gen_random_uuid() staff_l, gen_random_uuid() owner_staff,
  gen_random_uuid() corte, gen_random_uuid() combo, gen_random_uuid() plain_cut, gen_random_uuid() land_combo,
  'regras-' || substr(md5(random()::text), 1, 8) slug,
  'regras-l-' || substr(md5(random()::text), 1, 8) land_slug,
  -- Sempre numa quarta-feira (dia aberto), pelo menos 2 dias à frente.
  (current_date + 2 + ((10 - extract(isodow from current_date + 2)::int) % 7)) as d;
grant select on rules_ctx to anon, authenticated;
select * from rules_ctx \gset

create function pg_temp.check_rules(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_rules_error(statement text, expected_state text, label text)
returns void language plpgsql as $$
declare actual_state text;
begin
  begin execute statement;
  exception when others then get stacked diagnostics actual_state = returned_sqlstate; end;
  if actual_state is distinct from expected_state then
    raise notice 'Esperado %, recebido % em %', expected_state, actual_state, label;
  end if;
  perform pg_temp.check_rules(actual_state = expected_state, label);
end $$;
-- Instante local da loja no dia de teste.
create function pg_temp.at(t text) returns timestamptz language sql stable as $$
  select ((select d from rules_ctx) + t::time) at time zone 'America/Sao_Paulo'
$$;
grant execute on function pg_temp.at(text) to authenticated, anon;

insert into public.barbershops(id, name, slug, timezone)
select shop_id, 'Regras', slug, 'America/Sao_Paulo' from rules_ctx union all
select plain_shop_id, 'Sem serviços por profissional', slug || '-p', 'America/Sao_Paulo' from rules_ctx union all
select land_shop_id, 'Página', land_slug, 'America/Sao_Paulo' from rules_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{"full_name":"Teste regras"}'::jsonb from rules_ctx c
cross join lateral unnest(array[c.owner_id, c.cust_id]) u;
insert into public.memberships(user_id, barbershop_id, role)
select cust_id, shop_id, 'customer'::public.app_role from rules_ctx union all
select cust_id, plain_shop_id, 'customer'::public.app_role from rules_ctx union all
select owner_id, shop_id, 'shop_admin'::public.app_role from rules_ctx;
insert into public.staff(id, barbershop_id, display_name, booking_slug, user_id, active)
select staff_a, shop_id, 'A', 'a', null::uuid, true from rules_ctx union all
select staff_b, shop_id, 'B', 'b', null, true from rules_ctx union all
select staff_c, shop_id, 'C', 'c', null, true from rules_ctx union all
select owner_staff, shop_id, 'Dono', 'dono', owner_id, false from rules_ctx union all
select staff_x, plain_shop_id, 'X', 'x', null, true from rules_ctx union all
select staff_l, land_shop_id, 'L', 'l', null, true from rules_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from rules_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select corte, shop_id, 'Corte', 30, 5000 from rules_ctx union all
select combo, shop_id, 'Combo', 60, 9000 from rules_ctx union all
select plain_cut, plain_shop_id, 'Corte', 30, 4000 from rules_ctx union all
select land_combo, land_shop_id, 'Combo', 60, 9000 from rules_ctx;
-- A faz Corte com duração e preço próprios (45 min, R$ 60) e Combo padrão; B só Corte; C nada.
insert into public.staff_services(barbershop_id, staff_id, service_id, duration_minutes, price_cents)
select shop_id, staff_a, corte, 45, 6000 from rules_ctx union all
select shop_id, staff_a, combo, 60, 9000 from rules_ctx union all
select shop_id, staff_b, corte, 30, 5000 from rules_ctx;
insert into public.barbershop_settings(barbershop_id) select shop_id from rules_ctx union all
select plain_shop_id from rules_ctx union all select land_shop_id from rules_ctx on conflict do nothing;
update public.barbershop_settings set booking_horizon_days = 30 where barbershop_id = :'shop_id';
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select s, w, true, '09:00', '19:00' from rules_ctx c
cross join lateral unnest(array[c.shop_id, c.plain_shop_id]) s cross join generate_series(0, 6) w
on conflict (barbershop_id, weekday) do update set is_open = true, opens_at = '09:00', closes_at = '19:00';
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select land_shop_id, w, true, '00:00', '23:59' from rules_ctx cross join generate_series(0, 6) w
on conflict (barbershop_id, weekday) do update set is_open = true, opens_at = '00:00', closes_at = '23:59';

set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_id', true);

-- 1. O banco recalcula término e preço; não aceita profissional que não faz o serviço.
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, booked_price_cents)
values (:'shop_id', :'cust_id', :'corte', :'staff_a', pg_temp.at('10:00'), pg_temp.at('10:05'), 1);
select pg_temp.check_rules(
  (select ends_at = pg_temp.at('10:45') and booked_price_cents = 6000 from public.appointments
   where staff_id = :'staff_a' and starts_at = pg_temp.at('10:00')),
  'Corte 10:00–10:05 com R$ 0,01 vira 10:00–10:45 com o preço do profissional');
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
values (:'shop_id', :'cust_id', :'corte', :'staff_b', pg_temp.at('13:00'), pg_temp.at('17:00'));
select pg_temp.check_rules(
  (select ends_at = pg_temp.at('13:30') and booked_price_cents = 5000 from public.appointments
   where staff_id = :'staff_b' and starts_at = pg_temp.at('13:00')),
  'Corte 13:00–17:00 vira 13:00–13:30');
select pg_temp.expect_rules_error(format(
  'insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, booked_price_cents)
   values (%L, %L, %L, %L, pg_temp.at(''11:00''), pg_temp.at(''12:00''), 1)', :'shop_id', :'cust_id', :'combo', :'staff_b'),
  '22023', 'Profissional que não faz o Combo é recusado');
select pg_temp.expect_rules_error(format(
  'insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
   values (%L, %L, %L, %L, pg_temp.at(''11:00''), pg_temp.at(''11:30''))', :'shop_id', :'cust_id', :'corte', :'staff_c'),
  '22023', 'Profissional sem serviços cadastrados é recusado quando a loja usa serviços por profissional');
select pg_temp.expect_rules_error(format(
  'insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
   values (%L, %L, %L, %L, pg_temp.at(''18:30''), pg_temp.at(''18:35''))', :'shop_id', :'cust_id', :'combo', :'staff_a'),
  '22023', 'Combo de 60 min às 18:30 (terminaria 19:30) é recusado mesmo mandando término curto');
select pg_temp.expect_rules_error(format(
  'insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
   values (%L, %L, %L, %L, pg_temp.at(''10:00'') + interval ''40 days'', pg_temp.at(''10:30'') + interval ''40 days'')',
  :'shop_id', :'cust_id', :'corte', :'staff_b'),
  '22023', 'Dia além do prazo de agendamento da loja é recusado');
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
values (:'plain_shop_id', :'cust_id', :'plain_cut', :'staff_x', pg_temp.at('10:00'), pg_temp.at('10:01'));
select pg_temp.check_rules(
  (select ends_at = pg_temp.at('10:30') and booked_price_cents = 4000 from public.appointments
   where staff_id = :'staff_x'),
  'Loja sem serviços por profissional: todos fazem tudo, com duração e preço do catálogo');

-- 2. Remarcação: término e preço pela regra; troca de serviço muda o preço.
select public.reschedule_own_appointment(a.id, :'combo', :'staff_a', pg_temp.at('15:00'), pg_temp.at('15:05'))
from public.appointments a where a.staff_id = :'staff_a' and a.starts_at = pg_temp.at('10:00');
select pg_temp.check_rules(
  (select ends_at = pg_temp.at('16:00') and booked_price_cents = 9000 and service_id = :'combo'
   from public.appointments where staff_id = :'staff_a' and starts_at = pg_temp.at('15:00')),
  'Remarcar para Combo recalcula término (16:00) e preço (R$ 90)');
select pg_temp.expect_rules_error(format(
  'select public.reschedule_own_appointment(a.id, %L, %L, pg_temp.at(''16:30''), pg_temp.at(''17:30''))
   from public.appointments a where a.staff_id = %L and a.starts_at = pg_temp.at(''15:00'')',
  :'combo', :'staff_b', :'staff_a'),
  '22023', 'Remarcar para profissional que não faz o serviço é recusado');
update public.appointments set status = 'cancelled', booked_price_cents = 1
where staff_id = :'staff_x';
select pg_temp.check_rules(
  (select status = 'cancelled' and booked_price_cents = 4000 from public.appointments where staff_id = :'staff_x'),
  'Cliente cancela, mas não muda o preço');
select set_config('request.jwt.claim.sub', :'owner_id', true);
-- O painel continua livre para ajustar duração e preço.
update public.appointments set ends_at = pg_temp.at('13:50'), booked_price_cents = 7777
where staff_id = :'staff_b' and starts_at = pg_temp.at('13:00');
select pg_temp.check_rules(
  (select ends_at = pg_temp.at('13:50') and booked_price_cents = 7777 from public.appointments
   where staff_id = :'staff_b' and starts_at = pg_temp.at('13:00')),
  'Dono ajusta duração e preço pelo painel');
update public.appointments set ends_at = pg_temp.at('13:30'), booked_price_cents = 5000
where staff_id = :'staff_b' and starts_at = pg_temp.at('13:00');
select set_config('request.jwt.claim.sub', :'cust_id', true);

-- Link direto do profissional
select public.create_direct_appointment(:'slug', 'a', :'corte', pg_temp.at('09:00'), pg_temp.at('09:01'));
select pg_temp.check_rules(
  (select ends_at = pg_temp.at('09:45') and booked_price_cents = 6000 from public.appointments
   where staff_id = :'staff_a' and starts_at = pg_temp.at('09:00')),
  'Link direto usa duração e preço próprios do profissional');

-- 5. Horários de 15 em 15 minutos, só os que cabem o serviço inteiro.
select pg_temp.check_rules(
  (select array_agg(to_char(starts_at at time zone 'America/Sao_Paulo', 'HH24:MI') order by starts_at)
   from public.get_available_slots(:'shop_id', :'corte', :'d', :'staff_b'))
  @> array['09:00', '09:15', '12:30', '13:30', '18:30']
  and not (select array_agg(to_char(starts_at at time zone 'America/Sao_Paulo', 'HH24:MI'))
   from public.get_available_slots(:'shop_id', :'corte', :'d', :'staff_b'))
  && array['12:45', '13:00', '13:15', '18:45'],
  'B (Corte 30 min): candidatos de 15 em 15, sem encostar no 13:00–13:30 e sem passar das 19:00');
select pg_temp.check_rules(
  (select max(starts_at) = pg_temp.at('18:00') and bool_and(ends_at <= pg_temp.at('19:00'))
   from public.get_available_slots(:'shop_id', :'combo', :'d', :'staff_a')),
  'Combo de 60 min: último horário 18:00, nenhum termina depois do fechamento');
select pg_temp.check_rules(
  (select bool_and(ends_at - starts_at = interval '45 minutes')
   from public.get_available_slots(:'shop_id', :'corte', :'d', :'staff_a')),
  'Horários de A usam a duração própria dele (45 min)');
select pg_temp.check_rules(
  not exists (select 1 from public.get_available_slots(:'shop_id', :'corte', :'d', :'staff_c')),
  'Profissional sem serviços não tem horários');
select pg_temp.check_rules(
  (select array_agg(distinct staff_id) <@ array[:'staff_a', :'staff_b']::uuid[]
     and count(distinct staff_id) = 2
   from public.get_available_slots(:'shop_id', :'corte', :'d', null)),
  '"Qualquer profissional" junta só quem faz o serviço');
reset role;
select set_config('request.jwt.claim.sub', '', true);
-- Origens das esperas: reservas canceladas de C (não ocupam horário).
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status)
select :'shop_id', :'cust_id', :'corte', :'staff_c', pg_temp.at(t), pg_temp.at(t) + interval '30 minutes', 'cancelled'
from unnest(array['09:00', '09:30', '10:00']) t;
-- Bloqueio de B 10:00–11:00 e espera ativa 15:00–15:30; espera vencida às 16:00 não ocupa.
insert into public.availability_blocks(barbershop_id, staff_id, starts_at, ends_at, reason)
values (:'shop_id', :'staff_b', pg_temp.at('10:00'), pg_temp.at('11:00'), 'Teste');
insert into public.slot_waits(barbershop_id, appointment_id, staff_id, starts_at, ends_at, hold_until, claim_until, state)
select :'shop_id', a.id, :'staff_b', pg_temp.at('15:00'), pg_temp.at('15:30'), now() + interval '1 hour', now() + interval '2 hours', 'holding'
from public.appointments a where a.staff_id = :'staff_c' and a.starts_at = pg_temp.at('09:00');
insert into public.slot_waits(barbershop_id, appointment_id, staff_id, starts_at, ends_at, hold_until, claim_until, state)
select :'shop_id', a.id, :'staff_b', pg_temp.at('16:00'), pg_temp.at('16:30'), now() - interval '2 hours', now() - interval '1 hour', 'holding'
from public.appointments a where a.staff_id = :'staff_c' and a.starts_at = pg_temp.at('09:30');
select pg_temp.check_rules(
  (select not (array_agg(to_char(starts_at at time zone 'America/Sao_Paulo', 'HH24:MI'))
               && array['09:45', '10:00', '10:30', '14:45', '15:00', '15:15'])
     and array_agg(to_char(starts_at at time zone 'America/Sao_Paulo', 'HH24:MI')) @> array['09:30', '11:00', '15:30', '16:00']
   from public.available_slots_internal(:'staff_b', :'corte', :'d')),
  'Bloqueio e espera ativa ocupam; espera vencida não ocupa');
set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_id', true);

-- 3. "Qualquer profissional": mesma lista de ocupados, favorito também precisa fazer o serviço.
select pg_temp.check_rules(
  public.pick_available_staff(:'shop_id', :'corte', pg_temp.at('10:15'), pg_temp.at('10:45'), :'staff_b') = :'staff_a',
  'Favorito bloqueado não é escolhido; vai para quem está livre');
select pg_temp.check_rules(
  public.pick_available_staff(:'shop_id', :'corte', pg_temp.at('15:00'), pg_temp.at('15:30'), :'staff_b') is null,
  'Favorito com a vaga reservada para a espera não é escolhido');
select pg_temp.check_rules(
  public.pick_available_staff(:'shop_id', :'corte', pg_temp.at('12:00'), pg_temp.at('12:30'), :'staff_c') <> :'staff_c',
  'Favorito que não faz o serviço não é escolhido');
select pg_temp.check_rules(
  public.pick_available_staff(:'shop_id', :'combo', pg_temp.at('12:00'), pg_temp.at('13:00'), null) = :'staff_a',
  'Só quem faz o Combo entra no sorteio');
select pg_temp.check_rules(
  public.pick_available_staff(:'shop_id', :'combo', pg_temp.at('15:00'), pg_temp.at('16:00'), null) is null,
  'Sem ninguém livre que faça o serviço, nenhum profissional é escolhido');

-- Recorrência: espera vencida não pula a semana seguinte.
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.slot_waits(barbershop_id, appointment_id, staff_id, starts_at, ends_at, hold_until, claim_until, state)
select :'shop_id', a.id, :'staff_b', pg_temp.at('11:00') + interval '7 days', pg_temp.at('11:30') + interval '7 days',
  now() - interval '2 hours', now() - interval '1 hour', 'holding'
from public.appointments a where a.staff_id = :'staff_c' and a.starts_at = pg_temp.at('10:00');
set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_id', true);
select public.create_booking_series(:'shop_id', :'corte', :'staff_b', pg_temp.at('11:00'), 'weekday', null);
select pg_temp.check_rules(
  exists (select 1 from public.appointments where staff_id = :'staff_b'
          and starts_at = pg_temp.at('11:00') + interval '7 days' and series_id is not null),
  'Recorrência não trata espera vencida como horário ocupado');

-- 4. Página pública: mesma regra do app, sem dado de cliente.
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.staff_services(barbershop_id, staff_id, service_id, duration_minutes, price_cents)
select land_shop_id, staff_l, land_combo, 60, 9000 from rules_ctx;
set local role anon;
select pg_temp.check_rules(
  (select bool_and(s ->> 'offers_services' = 'false' and jsonb_array_length(s -> 'free_today') = 0)
   from jsonb_array_elements(public.get_public_shop_landing(:'slug') -> 'staff') s where s ->> 'name' = 'C'),
  'Página: profissional sem serviços não mostra horários');
select pg_temp.check_rules(
  (select (s ->> 'min_duration_minutes')::int = 45
   from jsonb_array_elements(public.get_public_shop_landing(:'slug') -> 'staff') s where s ->> 'name' = 'A'),
  'Página: "a partir de" usa o serviço mais curto do profissional');
select pg_temp.check_rules(
  (select bool_and(t.value::time <= time '22:59' and extract(minute from t.value::time)::int % 15 = 0)
   from jsonb_array_elements(public.get_public_shop_landing(:'land_slug') -> 'staff') s,
        jsonb_array_elements_text(s -> 'free_today') t) is not false,
  'Página: Combo de 60 min nunca aparece terminando depois do fechamento; grade de 15 min');
reset role;
select pg_temp.check_rules(
  (select array(select jsonb_array_elements_text(s -> 'free_today'))
   from jsonb_array_elements(public.get_public_shop_landing(:'land_slug') -> 'staff') s)
  = array(select to_char(x.starts_at at time zone 'America/Sao_Paulo', 'HH24:MI')
          from public.available_slots_internal(:'staff_l', :'land_combo',
            (now() at time zone 'America/Sao_Paulo')::date) x order by x.starts_at limit 12),
  'Página e app usam a mesma função de horários');

-- Atualização instantânea: sinal sem dado pessoal.
select pg_temp.check_rules(
  (select count(*) > 0 from public.availability_signals where barbershop_id = :'shop_id'),
  'Mudanças de agenda geram sinal para a loja');
set local role anon;
select pg_temp.check_rules(
  (select count(*) > 0 from public.availability_signals where barbershop_id = :'shop_id')
  and (select count(*) = 0 from public.appointments where barbershop_id = :'shop_id'),
  'Visitante lê o sinal, mas não lê agendamentos');
select pg_temp.expect_rules_error(format(
  'insert into public.availability_signals(barbershop_id) values (%L)', :'shop_id'),
  '42501', 'Visitante não grava sinal');
reset role;
select pg_temp.check_rules(
  (select array_agg(column_name::text order by column_name) = array['barbershop_id', 'changed_at', 'id', 'staff_id']
   from information_schema.columns where table_schema = 'public' and table_name = 'availability_signals'),
  'Sinal só tem loja, profissional e horário da mudança');
select pg_temp.check_rules(
  not has_function_privilege('anon', 'public.get_available_slots(uuid,uuid,date,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.available_slots_internal(uuid,uuid,date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.available_slots_internal(uuid,uuid,date)', 'EXECUTE'),
  'Funções internas de horário não ficam expostas');
