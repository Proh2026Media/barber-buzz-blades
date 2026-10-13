-- Pausa fixa semanal (20261013220000_pausa_semanal.sql): P-10.
-- Rodar numa transação, sempre com ROLLBACK: BEGIN; \i este arquivo; ROLLBACK;
-- Dados fictícios com IDs aleatórios.
create temporary table ps_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() owner_id, gen_random_uuid() owner_staff,
  gen_random_uuid() employee_id, gen_random_uuid() employee_staff,
  gen_random_uuid() colleague_id, gen_random_uuid() colleague_staff,
  gen_random_uuid() cust_id, gen_random_uuid() corte,
  -- Dia de teste: daqui a 3 dias (fuso da loja).
  ((now() at time zone 'America/Sao_Paulo')::date + 3) as d;
grant select on ps_ctx to authenticated, anon;
select * from ps_ctx \gset

create function pg_temp.check_ps(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_ps_error(statement text, label text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute statement; exception when others then failed := true; end;
  perform pg_temp.check_ps(failed, label);
end $$;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true)
$$;
create function pg_temp.ps_at(t text) returns timestamptz language sql stable as $$
  select ((select d from ps_ctx) + t::time) at time zone 'America/Sao_Paulo'
$$;
grant execute on function pg_temp.ps_at(text) to authenticated, anon;

insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{"full_name":"Pessoa PS"}'::jsonb
from ps_ctx c cross join lateral unnest(array[c.owner_id, c.employee_id, c.colleague_id, c.cust_id]) u;
insert into public.barbershops(id, name, slug, timezone, founded_by_user_id)
select shop_id, 'Pausa PS', 'ps-' || shop_id, 'America/Sao_Paulo', owner_id from ps_ctx;
insert into public.memberships(user_id, barbershop_id, role)
select cust_id, shop_id, 'customer'::public.app_role from ps_ctx;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono PS', owner_id, 'dono' from ps_ctx union all
select employee_staff, shop_id, 'Contratado PS', employee_id, 'contratado' from ps_ctx union all
select colleague_staff, shop_id, 'Colega PS', colleague_id, 'colega' from ps_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from ps_ctx union all
select shop_id, employee_id, employee_staff, 'employee'::public.shop_member_role, null from ps_ctx union all
select shop_id, colleague_id, colleague_staff, 'employee'::public.shop_member_role, null from ps_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select corte, shop_id, 'Corte', 30, 5000 from ps_ctx;
insert into public.staff_services(barbershop_id, staff_id, service_id, duration_minutes, price_cents)
select shop_id, s, corte, 30, 5000 from ps_ctx c
cross join lateral unnest(array[c.owner_staff, c.employee_staff, c.colleague_staff]) s;
insert into public.barbershop_settings(barbershop_id) select shop_id from ps_ctx on conflict do nothing;
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select shop_id, w, true, '09:00', '19:00' from ps_ctx cross join generate_series(0, 6) w
on conflict (barbershop_id, weekday) do update set is_open = true, opens_at = '09:00', closes_at = '19:00';

-- ---------------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------------

select pg_temp.check_ps(
  not has_function_privilege('authenticated', 'public.materialize_block_rule(uuid, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.extend_availability_block_rules()', 'execute')
  and not has_table_privilege('anon', 'public.availability_block_rules', 'select')
  and has_function_privilege('authenticated', 'public.list_shop_blocks(uuid, timestamptz)', 'execute'),
  'Gerar e estender bloqueios fica com o servidor; anônimo não lê regras');

-- ---------------------------------------------------------------------------
-- Profissional: pausa na própria agenda, não na do colega nem na loja toda
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'employee_id');
set local role authenticated;
insert into public.availability_block_rules(barbershop_id, staff_id, weekdays, start_time, end_time, reason)
values (:'shop_id', :'employee_staff', array[0, 1, 2, 3, 4, 5, 6]::smallint[], '12:00', '13:00', 'Almoço');
select pg_temp.expect_ps_error(
  format($s$insert into public.availability_block_rules(barbershop_id, staff_id, weekdays, start_time, end_time)
    values (%L, %L, '{1}', '12:00', '13:00')$s$, :'shop_id', :'colleague_staff'),
  'Contratado não cria pausa na agenda do colega');
select pg_temp.expect_ps_error(
  format($s$insert into public.availability_block_rules(barbershop_id, staff_id, weekdays, start_time, end_time)
    values (%L, null, '{1}', '12:00', '13:00')$s$, :'shop_id'),
  'Contratado não cria pausa da loja toda');
select pg_temp.expect_ps_error(
  format($s$insert into public.availability_block_rules(barbershop_id, staff_id, weekdays, start_time, end_time)
    values (%L, %L, '{1}', '13:00', '12:00')$s$, :'shop_id', :'employee_staff'),
  'Fim antes do início é recusado');
select pg_temp.expect_ps_error(
  format($s$insert into public.availability_block_rules(barbershop_id, staff_id, weekdays, start_time, end_time)
    values (%L, %L, '{7}', '12:00', '13:00')$s$, :'shop_id', :'employee_staff'),
  'Dia da semana fora de 0–6 é recusado');
select pg_temp.check_ps(
  (select count(*) = 1 from public.list_shop_blocks(:'shop_id', pg_temp.ps_at('00:00'))
   where staff_id = :'employee_staff' and starts_at = pg_temp.ps_at('12:00') and ends_at = pg_temp.ps_at('13:00')
     and rule_id is not null),
  'A regra vira o bloqueio 12:00–13:00 no dia de teste, com rule_id na lista');
reset role;

select pg_temp.check_ps(
  (select count(*) between 119 and 121 from public.availability_blocks b
   join public.availability_block_rules r on r.id = b.rule_id
   where r.staff_id = :'employee_staff' and r.barbershop_id = :'shop_id')
  and (select materialized_until = (now() at time zone 'America/Sao_Paulo')::date + 120
       from public.availability_block_rules where staff_id = :'employee_staff'),
  'Todos os dias gerados para os próximos 120 dias');

-- ---------------------------------------------------------------------------
-- Horários livres respeitam a pausa
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'cust_id');
set local role authenticated;
select pg_temp.check_ps(
  not exists (select 1 from public.get_available_slots(:'shop_id', :'corte', :'d', :'employee_staff')
              where starts_at < pg_temp.ps_at('13:00') and ends_at > pg_temp.ps_at('12:00'))
  and exists (select 1 from public.get_available_slots(:'shop_id', :'corte', :'d', :'employee_staff')
              where starts_at = pg_temp.ps_at('13:00'))
  and exists (select 1 from public.get_available_slots(:'shop_id', :'corte', :'d', :'colleague_staff')
              where starts_at = pg_temp.ps_at('12:00')),
  'Cliente não vê 12:00–13:00 com o contratado; o colega continua livre');
reset role;

-- ---------------------------------------------------------------------------
-- Pular um dia e estender sem recriar
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'employee_id');
set local role authenticated;
delete from public.availability_blocks
where staff_id = :'employee_staff' and starts_at = pg_temp.ps_at('12:00');
reset role;
update public.availability_block_rules set materialized_until = materialized_until - 10
where staff_id = :'employee_staff';
select public.extend_availability_block_rules();
select pg_temp.check_ps(
  not exists (select 1 from public.availability_blocks
              where staff_id = :'employee_staff' and starts_at = pg_temp.ps_at('12:00'))
  and (select count(*) between 118 and 120 from public.availability_blocks where staff_id = :'employee_staff'),
  'Dia apagado à mão não volta; extensão completa a janela sem duplicar');

-- ---------------------------------------------------------------------------
-- Dono: pausa da loja toda; apagar a regra limpa só o futuro
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'owner_id');
set local role authenticated;
insert into public.availability_block_rules(barbershop_id, staff_id, weekdays, start_time, end_time, reason)
values (:'shop_id', null, array[extract(dow from :'d'::date)::smallint], '15:00', '15:30', 'Reunião');
select pg_temp.check_ps(
  (select count(*) = 1 from public.list_shop_blocks(:'shop_id', pg_temp.ps_at('00:00'))
   where staff_id is null and starts_at = pg_temp.ps_at('15:00') and rule_id is not null),
  'Dono cria pausa semanal da loja toda (só no dia da semana escolhido)');
select pg_temp.check_ps(
  (select count(*) = 2 from public.availability_block_rules where barbershop_id = :'shop_id'),
  'Dono vê as regras da loja e a do contratado');
reset role;

select pg_temp.as_user(:'colleague_id');
set local role authenticated;
select pg_temp.check_ps(
  (select count(*) = 1 from public.availability_block_rules where barbershop_id = :'shop_id'),
  'Colega vê só a pausa da loja toda, não a do contratado');
delete from public.availability_block_rules where barbershop_id = :'shop_id';
reset role;
select pg_temp.check_ps(
  (select count(*) = 2 from public.availability_block_rules where barbershop_id = :'shop_id'),
  'Colega não apaga regras da loja');

-- Bloqueio passado da regra vira histórico ao apagar a regra.
select set_config('request.jwt.claim.sub', '', true);
insert into public.availability_blocks(barbershop_id, staff_id, starts_at, ends_at, reason, rule_id)
select :'shop_id', :'employee_staff', now() - interval '2 days', now() - interval '2 days' + interval '1 hour',
  'Almoço', id from public.availability_block_rules where staff_id = :'employee_staff';

select pg_temp.as_user(:'employee_id');
set local role authenticated;
delete from public.availability_block_rules where staff_id = :'employee_staff';
reset role;
select pg_temp.check_ps(
  not exists (select 1 from public.availability_blocks
              where staff_id = :'employee_staff' and ends_at > now())
  and (select count(*) = 1 from public.availability_blocks
       where staff_id = :'employee_staff' and ends_at < now() and rule_id is null),
  'Apagar a regra tira as pausas futuras e mantém a passada como histórico');
