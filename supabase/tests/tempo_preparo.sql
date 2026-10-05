-- Tempo de preparo entre atendimentos (20261005120000_tempo_preparo.sql).
-- Rodar numa transação, sempre com ROLLBACK: BEGIN; \i este arquivo; ROLLBACK;
-- Dados de teste com IDs aleatórios (não depende de dados reais).
create temporary table prep_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() owner_id, gen_random_uuid() cust_id,
  gen_random_uuid() staff_s, gen_random_uuid() owner_staff,
  gen_random_uuid() corte, gen_random_uuid() combo,
  'preparo-' || substr(md5(random()::text), 1, 8) slug,
  -- Sempre numa quarta-feira, pelo menos 2 dias à frente.
  (current_date + 2 + ((10 - extract(isodow from current_date + 2)::int) % 7)) as d;
grant select on prep_ctx to anon, authenticated;
select * from prep_ctx \gset

create function pg_temp.check_prep(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_prep_error(statement text, expected_state text, label text)
returns void language plpgsql as $$
declare actual_state text;
begin
  begin execute statement;
  exception when others then get stacked diagnostics actual_state = returned_sqlstate; end;
  if actual_state is distinct from expected_state then
    raise notice 'Esperado %, recebido % em %', expected_state, actual_state, label;
  end if;
  perform pg_temp.check_prep(actual_state = expected_state, label);
end $$;
create function pg_temp.pmat(t text) returns timestamptz language sql stable as $$
  select ((select d from prep_ctx) + t::time) at time zone 'America/Sao_Paulo'
$$;
-- Horários livres de S num serviço, como texto HH24:MI.
create function pg_temp.plabels(p_service uuid) returns text[] language sql stable as $$
  select coalesce(array_agg(to_char(x.starts_at at time zone 'America/Sao_Paulo', 'HH24:MI') order by x.starts_at), '{}')
  from public.available_slots_internal((select staff_s from prep_ctx), p_service, (select d from prep_ctx)) x
$$;
grant execute on function pg_temp.pmat(text) to authenticated, anon;
grant execute on function pg_temp.plabels(uuid) to authenticated, anon;

insert into public.barbershops(id, name, slug, timezone)
select shop_id, 'Preparo', slug, 'America/Sao_Paulo' from prep_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{"full_name":"Teste preparo"}'::jsonb from prep_ctx c
cross join lateral unnest(array[c.owner_id, c.cust_id]) u;
insert into public.memberships(user_id, barbershop_id, role)
select cust_id, shop_id, 'customer'::public.app_role from prep_ctx union all
select owner_id, shop_id, 'shop_admin'::public.app_role from prep_ctx;
insert into public.staff(id, barbershop_id, display_name, booking_slug, user_id, active)
select staff_s, shop_id, 'S', 's', null::uuid, true from prep_ctx union all
select owner_staff, shop_id, 'Dono', 'dono', owner_id, false from prep_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from prep_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select corte, shop_id, 'Corte', 30, 5000 from prep_ctx union all
select combo, shop_id, 'Combo', 60, 9000 from prep_ctx;
insert into public.barbershop_settings(barbershop_id) select shop_id from prep_ctx on conflict do nothing;
update public.barbershop_settings set booking_horizon_days = 30 where barbershop_id = :'shop_id';
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select shop_id, w, true, '09:00', '19:00' from prep_ctx cross join generate_series(0, 6) w
on conflict (barbershop_id, weekday) do update set is_open = true, opens_at = '09:00', closes_at = '19:00';

-- 0. Padrão e limites.
select pg_temp.check_prep(
  (select prep_minutes = 0 from public.barbershop_settings where barbershop_id = :'shop_id')
  and (select count(*) = 2 from public.services where barbershop_id = :'shop_id' and prep_minutes is null),
  'Loja nova sem preparo e serviços usando o da loja');
select pg_temp.expect_prep_error(format(
  'update public.barbershop_settings set prep_minutes = 7 where barbershop_id = %L', :'shop_id'),
  '23514', 'Preparo da loja fora da lista (7 min) é recusado');
select pg_temp.expect_prep_error(format(
  'update public.services set prep_minutes = 45 where id = %L', :'corte'),
  '23514', 'Preparo do serviço fora da lista (45 min) é recusado');
select pg_temp.check_prep(
  not public.settings_change_is_visual(
    s, jsonb_populate_record(s, jsonb_build_object('prep_minutes', 10))),
  'Preparo é mudança protegida (mesma aprovação das configurações de agendamento)')
from public.barbershop_settings s where s.barbershop_id = :'shop_id';

-- Corte 9:00–9:30 e Corte 11:00–11:30; almoço 12:30–13:15.
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status)
values (:'shop_id', :'cust_id', :'corte', :'staff_s', pg_temp.pmat('09:00'), pg_temp.pmat('09:30'), 'confirmed'),
       (:'shop_id', :'cust_id', :'corte', :'staff_s', pg_temp.pmat('11:00'), pg_temp.pmat('11:30'), 'confirmed');
insert into public.availability_blocks(barbershop_id, staff_id, starts_at, ends_at, reason)
values (:'shop_id', null, pg_temp.pmat('12:30'), pg_temp.pmat('13:15'), 'Almoço');

-- 1. Sem preparo: igual a antes.
select pg_temp.check_prep(
  (pg_temp.plabels(:'combo'))[1:2] = array['09:30', '09:45']
  and pg_temp.plabels(:'combo') @> array['10:00', '11:30']
  and not pg_temp.plabels(:'combo') && array['10:15'],
  'Sem preparo: Combo às 9:30, logo depois do Corte, e até 10:00 antes do Corte das 11:00');

-- 2. Preparo de 10 min na loja (modo 15 em 15).
update public.barbershop_settings set prep_minutes = 10 where barbershop_id = :'shop_id';
select pg_temp.check_prep(
  (select prep_minutes = 10 from public.barbershop_settings where barbershop_id = :'shop_id')
  and exists (select 1 from public.availability_signals where barbershop_id = :'shop_id'),
  'Mudar o preparo da loja avisa as telas abertas');
select pg_temp.check_prep(
  (pg_temp.plabels(:'combo'))[1] = '09:45'
  and not pg_temp.plabels(:'combo') && array['09:30', '10:00', '11:30', '11:45']
  and pg_temp.plabels(:'combo') @> array['13:15', '18:00'],
  'Preparo 10: Combo só às 9:45 (depois do preparo do Corte) e não às 10:00 (o preparo invadiria o Corte das 11:00); depois do almoço e no fim do dia o preparo não conta');
select pg_temp.check_prep(
  pg_temp.plabels(:'corte') @> array['09:45', '10:15', '11:45', '12:00']
  and not pg_temp.plabels(:'corte') && array['09:30', '10:30', '11:30'],
  'Preparo 10: Corte às 9:45 e 10:15, não às 10:30 (preparo até 11:10) nem às 11:30');

-- 3. Preparo próprio do serviço: Corte sem preparo, Combo segue a loja.
update public.services set prep_minutes = 0 where id = :'corte';
select pg_temp.check_prep(
  (pg_temp.plabels(:'combo'))[1] = '09:30'
  and not pg_temp.plabels(:'combo') && array['10:00'],
  'Corte com preparo 0: Combo volta a caber às 9:30; o Combo mantém o preparo de 10 da loja');
update public.services set prep_minutes = null where id = :'corte';

-- 4. No tamanho do serviço: o passo é duração + preparo.
update public.barbershop_settings set slot_mode = 'literal' where barbershop_id = :'shop_id';
select pg_temp.check_prep(
  pg_temp.plabels(:'corte') = array['09:40', '10:20', '11:40', '13:15', '13:55', '14:35',
    '15:15', '15:55', '16:35', '17:15', '17:55'],
  'Literal com preparo 10: Corte de 40 em 40 (9:40, 10:20, 11:40 depois do Corte das 11:00…), recomeçando às 13:15');

-- 5. Reserva pelo cliente respeita o preparo; o painel continua livre para encaixar.
update public.barbershop_settings set slot_mode = 'flexible', slot_step_minutes = 15 where barbershop_id = :'shop_id';
set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_id', true);
select pg_temp.expect_prep_error(format(
  'insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
   values (%L, %L, %L, %L, pg_temp.pmat(''09:30''), pg_temp.pmat(''10:00''))', :'shop_id', :'cust_id', :'corte', :'staff_s'),
  '23P01', 'Cliente: Corte às 9:30 invade o preparo do Corte das 9:00');
select pg_temp.expect_prep_error(format(
  'insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
   values (%L, %L, %L, %L, pg_temp.pmat(''10:30''), pg_temp.pmat(''11:00''))', :'shop_id', :'cust_id', :'corte', :'staff_s'),
  '23P01', 'Cliente: Corte às 10:30 deixaria o preparo dele em cima do Corte das 11:00');
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
values (:'shop_id', :'cust_id', :'corte', :'staff_s', pg_temp.pmat('09:45'), pg_temp.pmat('10:15'));
select pg_temp.check_prep(
  exists (select 1 from public.appointments where staff_id = :'staff_s' and starts_at = pg_temp.pmat('09:45')),
  'Cliente: Corte às 9:45 (depois do preparo) é aceito');
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_id', true);
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
values (:'shop_id', :'owner_id', :'corte', :'staff_s', pg_temp.pmat('11:30'), pg_temp.pmat('12:00'));
select pg_temp.check_prep(
  exists (select 1 from public.appointments where staff_id = :'staff_s' and starts_at = pg_temp.pmat('11:30')),
  'Painel: dono encaixa às 11:30 mesmo dentro do preparo');
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- 6. Pedido aprovado grava o preparo da loja e do serviço.
select public.apply_shop_change(:'shop_id', 'settings.operational', '{"prep_minutes": 15}'::jsonb);
select public.apply_shop_change(:'shop_id', 'service.update',
  jsonb_build_object('id', :'combo', 'prep_minutes', 20));
select pg_temp.check_prep(
  (select prep_minutes = 15 from public.barbershop_settings where barbershop_id = :'shop_id')
  and (select prep_minutes = 20 from public.services where id = :'combo'),
  'Pedido aprovado grava o preparo da loja (15) e do Combo (20)');
select public.apply_shop_change(:'shop_id', 'service.update',
  jsonb_build_object('id', :'combo', 'name', 'Combo'));
select pg_temp.check_prep(
  (select prep_minutes = 20 from public.services where id = :'combo'),
  'Editar o serviço sem mandar o preparo mantém o valor');
select public.apply_shop_change(:'shop_id', 'service.update',
  jsonb_build_object('id', :'combo', 'prep_minutes', null));
select public.apply_shop_change(:'shop_id', 'service.create',
  jsonb_build_object('name', 'Barba', 'duration_minutes', 20, 'price_cents', 3000, 'prep_minutes', 5));
select pg_temp.check_prep(
  (select prep_minutes is null from public.services where id = :'combo')
  and (select prep_minutes = 5 from public.services where barbershop_id = :'shop_id' and name = 'Barba')
  and public.service_prep_minutes(:'shop_id', :'combo') = 15,
  'Preparo nulo volta a usar o da loja; serviço novo nasce com o preparo pedido');
