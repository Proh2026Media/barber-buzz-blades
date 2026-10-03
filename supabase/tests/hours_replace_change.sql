-- Horário de funcionamento por mudança protegida (20261003130000_fix_hours_replace.sql).
-- Rodar numa transação, sempre com ROLLBACK. Dados de teste com IDs aleatórios.
create temporary table hours_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() owner_id, gen_random_uuid() partner_id,
  gen_random_uuid() employee_id, gen_random_uuid() owner_staff, gen_random_uuid() partner_staff,
  gen_random_uuid() employee_staff, 'horas-' || substr(md5(random()::text), 1, 8) slug;
grant select on hours_ctx to authenticated;

create function pg_temp.check_hours(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_hours_error(statement text, expected text, label text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; exception when others then get stacked diagnostics actual = returned_sqlstate; end;
  perform pg_temp.check_hours(actual = expected, label);
end $$;

insert into public.barbershops(id, name, slug) select shop_id, 'Hours test', slug from hours_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{}'::jsonb from hours_ctx c
cross join lateral unnest(array[c.owner_id, c.partner_id, c.employee_id]) u;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Owner', owner_id, 'owner-h' from hours_ctx union all
select partner_staff, shop_id, 'Partner', partner_id, 'partner-h' from hours_ctx union all
select employee_staff, shop_id, 'Employee', employee_id, 'employee-h' from hours_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 60 from hours_ctx union all
select shop_id, partner_id, partner_staff, 'partner'::public.shop_member_role, 40 from hours_ctx union all
select shop_id, employee_id, employee_staff, 'employee'::public.shop_member_role, null from hours_ctx;

-- Expediente inicial criado pelo banco ao cadastrar a loja: garante 09:00-19:00, domingo fechado.
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select shop_id, d, d <> 0, '09:00', '19:00' from hours_ctx cross join generate_series(0, 6) d
on conflict (barbershop_id, weekday) do update
  set is_open = excluded.is_open, opens_at = excluded.opens_at, closes_at = excluded.closes_at;

create temporary table hours_payload as
select jsonb_build_object('hours', jsonb_agg(jsonb_build_object(
  'weekday', d, 'is_open', d not in (0, 1),
  'opens_at', case when d = 6 then '08:00' else '10:00' end,
  'closes_at', case when d = 6 then '14:00' else '20:00' end
) order by d)) payload from generate_series(0, 6) d;
grant select on hours_payload to authenticated;

-- 1) Dono majoritário aplica na hora.
select set_config('request.jwt.claim.sub', owner_id::text, true) from hours_ctx;
set local role authenticated;
select pg_temp.check_hours(
  (select request_shop_change(shop_id, 'hours.replace', (select payload from hours_payload)) ->> 'status' = 'applied' from hours_ctx),
  'Dono majoritario aplica horario na hora');
reset role;
select pg_temp.check_hours(
  (select count(*) = 7 from public.business_hours where barbershop_id = (select shop_id from hours_ctx)),
  'Continua com um registro por dia da semana');
select pg_temp.check_hours(
  (select opens_at = '10:00' and closes_at = '20:00' and is_open from public.business_hours
   where barbershop_id = (select shop_id from hours_ctx) and weekday = 2),
  'Terca gravada com 10:00-20:00');
select pg_temp.check_hours(
  (select opens_at = '08:00' and closes_at = '14:00' and is_open from public.business_hours
   where barbershop_id = (select shop_id from hours_ctx) and weekday = 6),
  'Sabado gravado com 08:00-14:00');
select pg_temp.check_hours(
  (select bool_and(not is_open) from public.business_hours
   where barbershop_id = (select shop_id from hours_ctx) and weekday in (0, 1)),
  'Domingo e segunda ficam fechados (is_open respeitado)');

-- 2) Socio minoritario abre pedido; dono aprova e o horario e gravado.
update public.shop_members set ownership_percent = 50
where barbershop_id = (select shop_id from hours_ctx) and role in ('owner', 'partner');
create temporary table hours_payload2 as
select jsonb_build_object('hours', jsonb_agg(jsonb_build_object(
  'weekday', d, 'is_open', d <> 0, 'opens_at', '11:00', 'closes_at', '21:00') order by d)) payload
from generate_series(0, 6) d;
grant select on hours_payload2 to authenticated;
select set_config('request.jwt.claim.sub', partner_id::text, true) from hours_ctx;
set local role authenticated;
select pg_temp.check_hours(
  (select request_shop_change(shop_id, 'hours.replace', (select payload from hours_payload2)) ->> 'status' = 'pending' from hours_ctx),
  'Socio com partes iguais abre pedido pendente');
reset role;
select pg_temp.check_hours(
  (select opens_at = '10:00' from public.business_hours where barbershop_id = (select shop_id from hours_ctx) and weekday = 2),
  'Pedido pendente nao altera o horario');
select set_config('request.jwt.claim.sub', owner_id::text, true) from hours_ctx;
set local role authenticated;
select pg_temp.check_hours(
  (select decide_shop_change(
     (select id from public.shop_change_requests where barbershop_id = (select shop_id from hours_ctx)
        and kind = 'hours.replace' and status = 'pending' order by created_at desc limit 1), true) ->> 'status' = 'approved'),
  'Aprovacao do pedido de horario nao da erro');
reset role;
select pg_temp.check_hours(
  (select bool_and(opens_at = '11:00' and closes_at = '21:00') from public.business_hours
   where barbershop_id = (select shop_id from hours_ctx) and weekday <> 0),
  'Horario aprovado foi gravado em opens_at/closes_at');
select pg_temp.check_hours(
  (select not is_open from public.business_hours where barbershop_id = (select shop_id from hours_ctx) and weekday = 0),
  'Domingo continua fechado apos aprovacao');

-- 3) Colaborador comum nao muda o horario.
select set_config('request.jwt.claim.sub', employee_id::text, true) from hours_ctx;
set local role authenticated;
select pg_temp.expect_hours_error(
  'select request_shop_change((select shop_id from hours_ctx), ''hours.replace'', (select payload from hours_payload2))',
  '42501', 'Colaborador comum e recusado');
reset role;

-- 4) Fechamento antes da abertura e recusado pela restricao da tabela.
select set_config('request.jwt.claim.sub', owner_id::text, true) from hours_ctx;
update public.shop_members set ownership_percent = case when role = 'owner' then 60 else 40 end
where barbershop_id = (select shop_id from hours_ctx) and role in ('owner', 'partner');
set local role authenticated;
select pg_temp.expect_hours_error(
  'select request_shop_change((select shop_id from hours_ctx), ''hours.replace'', ''{"hours":[{"weekday":3,"is_open":true,"opens_at":"18:00","closes_at":"09:00"}]}''::jsonb)',
  '23514', 'Fechar antes de abrir e recusado');
reset role;
select set_config('request.jwt.claim.sub', '', true);
