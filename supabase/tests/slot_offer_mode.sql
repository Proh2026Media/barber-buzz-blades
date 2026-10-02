-- Forma de oferecer os horários por barbearia (20261002210000_slot_offer_mode.sql).
-- Rodar numa transação, sempre com ROLLBACK. Dados de teste com IDs aleatórios.
create temporary table mode_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() land_id, gen_random_uuid() owner_id, gen_random_uuid() cust_id,
  gen_random_uuid() staff_s, gen_random_uuid() staff_l, gen_random_uuid() owner_staff,
  gen_random_uuid() corte, gen_random_uuid() combo, gen_random_uuid() land_combo,
  'modo-' || substr(md5(random()::text), 1, 8) slug,
  'modo-l-' || substr(md5(random()::text), 1, 8) land_slug,
  -- Sempre numa quarta-feira, pelo menos 2 dias à frente.
  (current_date + 2 + ((10 - extract(isodow from current_date + 2)::int) % 7)) as d;
grant select on mode_ctx to anon, authenticated;
select * from mode_ctx \gset

create function pg_temp.check_mode(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_mode_error(statement text, expected_state text, label text)
returns void language plpgsql as $$
declare actual_state text;
begin
  begin execute statement;
  exception when others then get stacked diagnostics actual_state = returned_sqlstate; end;
  if actual_state is distinct from expected_state then
    raise notice 'Esperado %, recebido % em %', expected_state, actual_state, label;
  end if;
  perform pg_temp.check_mode(actual_state = expected_state, label);
end $$;
create function pg_temp.mat(t text) returns timestamptz language sql stable as $$
  select ((select d from mode_ctx) + t::time) at time zone 'America/Sao_Paulo'
$$;
-- Horários livres de S num serviço, como texto HH24:MI.
create function pg_temp.labels(p_service uuid) returns text[] language sql stable as $$
  select coalesce(array_agg(to_char(x.starts_at at time zone 'America/Sao_Paulo', 'HH24:MI') order by x.starts_at), '{}')
  from public.available_slots_internal((select staff_s from mode_ctx), p_service, (select d from mode_ctx)) x
$$;
grant execute on function pg_temp.mat(text) to authenticated, anon;
grant execute on function pg_temp.labels(uuid) to authenticated, anon;

insert into public.barbershops(id, name, slug, timezone)
select shop_id, 'Modo', slug, 'America/Sao_Paulo' from mode_ctx union all
select land_id, 'Modo página', land_slug, 'America/Sao_Paulo' from mode_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{"full_name":"Teste modo"}'::jsonb from mode_ctx c
cross join lateral unnest(array[c.owner_id, c.cust_id]) u;
insert into public.memberships(user_id, barbershop_id, role)
select cust_id, shop_id, 'customer'::public.app_role from mode_ctx union all
select owner_id, shop_id, 'shop_admin'::public.app_role from mode_ctx;
insert into public.staff(id, barbershop_id, display_name, booking_slug, user_id, active)
select staff_s, shop_id, 'S', 's', null::uuid, true from mode_ctx union all
select owner_staff, shop_id, 'Dono', 'dono', owner_id, false from mode_ctx union all
select staff_l, land_id, 'L', 'l', null, true from mode_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from mode_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select corte, shop_id, 'Corte', 30, 5000 from mode_ctx union all
select combo, shop_id, 'Combo', 60, 9000 from mode_ctx union all
select land_combo, land_id, 'Combo', 60, 9000 from mode_ctx;
insert into public.barbershop_settings(barbershop_id) select shop_id from mode_ctx union all
select land_id from mode_ctx on conflict do nothing;
update public.barbershop_settings set booking_horizon_days = 30 where barbershop_id = :'shop_id';
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select shop_id, w, true, '09:00', '19:00' from mode_ctx cross join generate_series(0, 6) w
on conflict (barbershop_id, weekday) do update set is_open = true, opens_at = '09:00', closes_at = '19:00';
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select land_id, w, true, '00:00', '23:59' from mode_ctx cross join generate_series(0, 6) w
on conflict (barbershop_id, weekday) do update set is_open = true, opens_at = '00:00', closes_at = '23:59';

-- 0. Padrão e limites da configuração.
select pg_temp.check_mode(
  (select slot_mode = 'flexible' and slot_step_minutes = 15 from public.barbershop_settings where barbershop_id = :'shop_id'),
  'Loja nova nasce no modo flexível (15 em 15)');
select pg_temp.expect_mode_error(format(
  'update public.barbershop_settings set slot_mode = ''livre'' where barbershop_id = %L', :'shop_id'),
  '23514', 'Modo desconhecido é recusado');
select pg_temp.expect_mode_error(format(
  'update public.barbershop_settings set slot_step_minutes = 25 where barbershop_id = %L', :'shop_id'),
  '23514', 'Intervalo fora da lista (25 min) é recusado');
select pg_temp.check_mode(
  not public.settings_change_is_visual(
    s, jsonb_populate_record(s, jsonb_build_object('slot_mode', 'literal')))
  and not public.settings_change_is_visual(
    s, jsonb_populate_record(s, jsonb_build_object('slot_step_minutes', 30))),
  'Forma dos horários é mudança protegida (mesma aprovação das configurações de agendamento)')
from public.barbershop_settings s where s.barbershop_id = :'shop_id';

-- Corte das 9:00 às 9:30 (gravado pelo sistema) e almoço da loja 12:30–13:15.
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status)
values (:'shop_id', :'cust_id', :'corte', :'staff_s', pg_temp.mat('09:00'), pg_temp.mat('09:30'), 'confirmed');
insert into public.availability_blocks(barbershop_id, staff_id, starts_at, ends_at, reason)
values (:'shop_id', null, pg_temp.mat('12:30'), pg_temp.mat('13:15'), 'Almoço');

-- 1. Flexível: 15 em 15, o Combo aparece logo depois do Corte.
select pg_temp.check_mode(
  (pg_temp.labels(:'combo'))[1] = '09:30'
  and pg_temp.labels(:'combo') @> array['09:45', '11:30', '13:15', '13:30', '18:00']
  and not pg_temp.labels(:'combo') && array['09:00', '11:45', '12:00', '12:15', '18:15'],
  'Flexível: Combo começa 9:30 (depois do Corte), cabe antes do almoço até 11:30 e volta às 13:15');

-- 2. Literal: passos do tamanho do serviço, recomeçando no fim do almoço.
update public.barbershop_settings set slot_mode = 'literal' where barbershop_id = :'shop_id';
select pg_temp.check_mode(
  pg_temp.labels(:'combo') = array['10:00', '11:00', '13:15', '14:15', '15:15', '16:15', '17:15'],
  'Literal: Combo 60 min em 10:00, 11:00 e, após o almoço, 13:15, 14:15… 17:15');
select pg_temp.check_mode(
  (pg_temp.labels(:'corte'))[1:3] = array['09:30', '10:00', '10:30']
  and pg_temp.labels(:'corte') @> array['12:00', '13:15', '13:45', '18:15']
  and not pg_temp.labels(:'corte') && array['09:45', '13:30', '18:30'],
  'Literal: Corte 30 min de meia em meia hora; depois do almoço conta a partir de 13:15');

-- 3. Ajustável: a loja escolhe o passo.
update public.barbershop_settings set slot_mode = 'custom', slot_step_minutes = 20 where barbershop_id = :'shop_id';
select pg_temp.check_mode(
  (pg_temp.labels(:'combo'))[1:6] = array['09:40', '10:00', '10:20', '10:40', '11:00', '11:20']
  and pg_temp.labels(:'combo') @> array['13:15', '13:35', '17:55']
  and not pg_temp.labels(:'combo') && array['09:20', '11:40', '13:30', '18:00'],
  'Ajustável 20 min: 9:40, 10:00… 11:20; depois do almoço 13:15, 13:35… 17:55');
update public.barbershop_settings set slot_step_minutes = 60 where barbershop_id = :'shop_id';
select pg_temp.check_mode(
  pg_temp.labels(:'corte') = array['10:00', '11:00', '12:00', '13:15', '14:15', '15:15', '16:15', '17:15', '18:15'],
  'Ajustável 60 min: Corte só nas horas da grade, cabendo antes do almoço e do fechamento');

-- 4. Validação da reserva pelo cliente segue o modo; agendamentos antigos continuam valendo.
update public.barbershop_settings set slot_mode = 'flexible', slot_step_minutes = 15 where barbershop_id = :'shop_id';
set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_id', true);
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
values (:'shop_id', :'cust_id', :'corte', :'staff_s', pg_temp.mat('15:30'), pg_temp.mat('16:00')),
       (:'shop_id', :'cust_id', :'corte', :'staff_s', pg_temp.mat('17:00'), pg_temp.mat('17:30'));
select pg_temp.check_mode(
  (select count(*) = 2 from public.appointments
   where staff_id = :'staff_s' and starts_at in (pg_temp.mat('15:30'), pg_temp.mat('17:00'))),
  'Flexível: cliente reserva Corte às 15:30 e às 17:00');
select pg_temp.expect_mode_error(format(
  'insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
   values (%L, %L, %L, %L, pg_temp.mat(''10:07''), pg_temp.mat(''10:37''))', :'shop_id', :'cust_id', :'corte', :'staff_s'),
  '22023', 'Flexível: início fora da grade (10:07) é recusado');
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.barbershop_settings set slot_mode = 'literal' where barbershop_id = :'shop_id';
set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_id', true);
select pg_temp.expect_mode_error(format(
  'insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
   values (%L, %L, %L, %L, pg_temp.mat(''10:30''), pg_temp.mat(''11:30''))', :'shop_id', :'cust_id', :'combo', :'staff_s'),
  '22023', 'Literal: Combo às 10:30 (fora da grade de 60 min) é recusado');
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
values (:'shop_id', :'cust_id', :'combo', :'staff_s', pg_temp.mat('10:00'), pg_temp.mat('11:00'));
select pg_temp.check_mode(
  exists (select 1 from public.appointments where staff_id = :'staff_s' and starts_at = pg_temp.mat('10:00')),
  'Literal: Combo às 10:00 é aceito');
update public.appointments set status = 'cancelled'
where staff_id = :'staff_s' and starts_at = pg_temp.mat('15:30');
select pg_temp.check_mode(
  (select status = 'cancelled' from public.appointments where staff_id = :'staff_s' and starts_at = pg_temp.mat('15:30')),
  'Agendamento antigo fora da grade nova (15:30) ainda pode ser cancelado');
select pg_temp.expect_mode_error(format(
  'select public.reschedule_own_appointment(a.id, %L, %L, pg_temp.mat(''16:30''), pg_temp.mat(''17:00''))
   from public.appointments a where a.staff_id = %L and a.starts_at = pg_temp.mat(''17:00'')',
  :'corte', :'staff_s', :'staff_s'),
  '22023', 'Literal: remarcar Corte para 16:30 (fora da grade 13:15, 13:45…) é recusado');
select public.reschedule_own_appointment(a.id, :'corte', :'staff_s', pg_temp.mat('16:45'), pg_temp.mat('17:15'))
from public.appointments a where a.staff_id = :'staff_s' and a.starts_at = pg_temp.mat('17:00');
select pg_temp.check_mode(
  exists (select 1 from public.appointments where staff_id = :'staff_s' and starts_at = pg_temp.mat('16:45')),
  'Literal: remarcar para 16:45 (na grade) é aceito');

-- 5. "Qualquer profissional" segue o modo.
select pg_temp.check_mode(
  public.pick_available_staff(:'shop_id', :'combo', pg_temp.mat('11:30'), pg_temp.mat('12:30'), null) is null
  and public.pick_available_staff(:'shop_id', :'combo', pg_temp.mat('11:00'), pg_temp.mat('12:00'), null) = :'staff_s',
  'Literal: "qualquer profissional" não escolhe 11:30, escolhe 11:00');
select pg_temp.check_mode(
  (select array_agg(to_char(starts_at at time zone 'America/Sao_Paulo', 'HH24:MI') order by starts_at)
   from public.get_available_slots(:'shop_id', :'combo', :'d', null)) = array['11:00', '13:15', '14:15', '15:15', '17:15'],
  'Literal: app do cliente recebe 11:00, 13:15, 14:15, 15:15, 17:15 (10:00 e 16:15 ocupados)');

-- 6. O dono no painel continua livre.
select set_config('request.jwt.claim.sub', :'owner_id', true);
update public.appointments set starts_at = pg_temp.mat('14:20'), ends_at = pg_temp.mat('14:50')
where staff_id = :'staff_s' and starts_at = pg_temp.mat('16:45');
select pg_temp.check_mode(
  exists (select 1 from public.appointments where staff_id = :'staff_s' and starts_at = pg_temp.mat('14:20')),
  'Dono move atendimento para fora da grade pelo painel');
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- Vaga da lista de espera mantém o horário original (15:30), mesmo fora da grade literal.
insert into public.slot_waits(barbershop_id, appointment_id, staff_id, starts_at, ends_at, hold_until, claim_until, state, customer_id, service_id)
select :'shop_id', a.id, :'staff_s', pg_temp.mat('15:30'), pg_temp.mat('16:00'),
  now() - interval '1 minute', now() + interval '1 hour', 'exclusive', :'cust_id', :'corte'
from public.appointments a where a.staff_id = :'staff_s' and a.starts_at = pg_temp.mat('15:30');
select id as wait_id from public.slot_waits where staff_id = :'staff_s' and starts_at = pg_temp.mat('15:30') \gset
set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_id', true);
select public.waiting_action(:'wait_id', 'claim');
select pg_temp.check_mode(
  exists (select 1 from public.appointments where staff_id = :'staff_s'
          and starts_at = pg_temp.mat('15:30') and status = 'confirmed'),
  'Literal: vaga resgatada da espera às 15:30 é aceita no horário original');
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- 7. Pedido aprovado leva a configuração; mudar o modo avisa as telas abertas.
select public.apply_shop_change(:'shop_id', 'settings.operational',
  jsonb_build_object('slot_mode', 'custom', 'slot_step_minutes', 45));
select pg_temp.check_mode(
  (select slot_mode = 'custom' and slot_step_minutes = 45 from public.barbershop_settings where barbershop_id = :'shop_id'),
  'Pedido aprovado (settings.operational) grava modo e intervalo');
select pg_temp.check_mode(
  (select count(*) > 0 from public.availability_signals
   where barbershop_id = :'shop_id' and staff_id is null and changed_at >= now()),
  'Trocar o modo gera sinal para recarregar os horários');

-- 8. Página pública segue o modo da loja.
insert into public.staff_services(barbershop_id, staff_id, service_id, duration_minutes, price_cents)
select land_id, staff_l, land_combo, 60, 9000 from mode_ctx;
update public.barbershop_settings set slot_mode = 'literal' where barbershop_id = :'land_id';
set local role anon;
select pg_temp.check_mode(
  (select bool_and(extract(minute from t.value::time)::int = 0)
   from jsonb_array_elements(public.get_public_shop_landing(:'land_slug') -> 'staff') s,
        jsonb_array_elements_text(s -> 'free_today') t) is not false
  and public.get_public_shop_landing(:'land_slug') -> 'today' ->> 'slot_mode' = 'literal'
  and public.get_public_shop_landing(:'land_slug') -> 'today' -> 'step_minutes' = 'null'::jsonb,
  'Página (literal): Combo de 60 min só em horas cheias desde 00:00');
reset role;
update public.barbershop_settings set slot_mode = 'custom', slot_step_minutes = 45 where barbershop_id = :'land_id';
set local role anon;
select pg_temp.check_mode(
  (select bool_and((extract(hour from t.value::time)::int * 60 + extract(minute from t.value::time)::int) % 45 = 0)
   from jsonb_array_elements(public.get_public_shop_landing(:'land_slug') -> 'staff') s,
        jsonb_array_elements_text(s -> 'free_today') t) is not false
  and (public.get_public_shop_landing(:'land_slug') -> 'today' ->> 'step_minutes')::int = 45,
  'Página (ajustável 45): horários de 45 em 45 min desde 00:00');
reset role;
select pg_temp.check_mode(
  (select array(select jsonb_array_elements_text(s -> 'free_today'))
   from jsonb_array_elements(public.get_public_shop_landing(:'land_slug') -> 'staff') s)
  = array(select to_char(x.starts_at at time zone 'America/Sao_Paulo', 'HH24:MI')
          from public.available_slots_internal(:'staff_l', :'land_combo',
            (now() at time zone 'America/Sao_Paulo')::date) x order by x.starts_at limit 12),
  'Página e app usam a mesma função também no modo ajustável');
select pg_temp.check_mode(
  not has_function_privilege('anon', 'public.slot_candidate_starts(uuid,date,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.slot_candidate_starts(uuid,date,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.shop_slot_step(uuid,integer)', 'EXECUTE'),
  'Funções internas da grade não ficam expostas');
