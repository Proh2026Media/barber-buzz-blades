-- Regressão do clube de pontos por loja (proteção do cliente).
-- Rodar depois de 20261002110000_loyalty_program_module.sql, numa transação; sempre ROLLBACK.
create temporary table loy_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() owner_id, gen_random_uuid() assoc_id,
  gen_random_uuid() cust_a, gen_random_uuid() cust_b, gen_random_uuid() outsider,
  gen_random_uuid() owner_staff, gen_random_uuid() assoc_staff, gen_random_uuid() service_id,
  (select user_id from public.memberships where role = 'platform_admin' limit 1) admin_id;
grant select on loy_ctx to authenticated;

select shop_id, owner_id, assoc_id, cust_a, cust_b, outsider, owner_staff, assoc_staff, service_id, admin_id
from loy_ctx \gset

create function pg_temp.check_loy(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_loy_error(statement text, label text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute statement; exception when others then failed := true; end;
  perform pg_temp.check_loy(failed, label);
end $$;
create function pg_temp.complete_visit(p_customer uuid, p_day int) returns uuid language plpgsql as $$
declare aid uuid;
begin
  insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status, booked_price_cents)
  select shop_id, p_customer, service_id, assoc_staff,
    ('2030-02-01T15:00:00Z'::timestamptz + make_interval(days => p_day * 7)),
    ('2030-02-01T15:30:00Z'::timestamptz + make_interval(days => p_day * 7)),
    'confirmed'::public.appointment_status, 5000
  from loy_ctx returning id into aid;
  update public.appointments set status = 'completed' where id = aid;
  return aid;
end $$;
create function pg_temp.balance(p_user uuid) returns int language sql as $$
  select coalesce((select points from public.loyalty_accounts la join loy_ctx c on la.barbershop_id = c.shop_id
    where la.user_id = p_user), 0)
$$;
create function pg_temp.lifetime(p_user uuid) returns int language sql as $$
  select coalesce((select lifetime_points from public.loyalty_accounts la join loy_ctx c on la.barbershop_id = c.shop_id
    where la.user_id = p_user), 0)
$$;

insert into public.barbershops(id, name, slug) select shop_id, 'Loyalty test', 'loy-' || shop_id from loy_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{}'::jsonb from loy_ctx c
cross join lateral unnest(array[c.owner_id, c.assoc_id, c.cust_a, c.cust_b, c.outsider]) u;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono', owner_id, 'dono' from loy_ctx union all
select assoc_staff, shop_id, 'Parceiro', assoc_id, 'parceiro' from loy_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select service_id, shop_id, 'Corte', 30, 5000 from loy_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from loy_ctx union all
select shop_id, assoc_id, assoc_staff, 'associate'::public.shop_member_role, null from loy_ctx;
insert into public.memberships(user_id, barbershop_id, role)
select cust_a, shop_id, 'customer'::public.app_role from loy_ctx union all
select cust_b, shop_id, 'customer'::public.app_role from loy_ctx;
insert into public.barbershop_settings(barbershop_id) select shop_id from loy_ctx on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Módulo desligado: nada é creditado e só o admin liga
-- ---------------------------------------------------------------------------

select pg_temp.complete_visit(:'cust_a', 0);
select pg_temp.check_loy(pg_temp.balance(:'cust_a') = 0, 'Módulo desligado não credita pontos');

set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_id', true);
select pg_temp.expect_loy_error(
  format('select public.set_shop_loyalty_module(%L, true)', :'shop_id'),
  'Dono não liga o módulo sozinho');
select pg_temp.expect_loy_error(
  format('update public.barbershop_settings set loyalty_enabled = true where barbershop_id = %L', :'shop_id'),
  'Dono não liga o módulo pela tabela');
select set_config('request.jwt.claim.sub', :'admin_id', true);
select public.set_shop_loyalty_module(:'shop_id', true);
reset role;
select pg_temp.check_loy(
  (select loyalty_enabled from public.barbershop_settings where barbershop_id = :'shop_id'),
  'Admin liga o módulo');

-- ---------------------------------------------------------------------------
-- Regra padrão, crédito único e bônus único
-- ---------------------------------------------------------------------------

create temporary table loy_visit as select pg_temp.complete_visit(:'cust_a', 1) id;
select pg_temp.check_loy(pg_temp.balance(:'cust_a') = 50, 'Regra padrão credita 50 pontos');
update public.appointments a set status = 'confirmed' from loy_visit v where a.id = v.id;
update public.appointments a set status = 'completed' from loy_visit v where a.id = v.id;
select pg_temp.check_loy(pg_temp.balance(:'cust_a') = 50, 'Concluir de novo não credita duas vezes');

set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_id', true);
select public.save_loyalty_program(:'shop_id', 'custom', 80, 20,
  '[{"name":"Bronze","min_points":0,"benefit":"Café"},{"name":"Ouro","min_points":200,"benefit":"Desconto"}]'::jsonb);
reset role;
select pg_temp.check_loy(
  (select version from public.loyalty_programs where barbershop_id = :'shop_id') = 1,
  'Versão própria grava versão 1');
select pg_temp.check_loy(
  (select delta from public.loyalty_ledger l join loy_visit v on l.appointment_id = v.id
    where l.reason = 'appointment_completed') = 50,
  'Mudar a regra não altera o crédito já feito');

select pg_temp.complete_visit(:'cust_a', 2);
select pg_temp.check_loy(pg_temp.balance(:'cust_a') = 150, 'Nova regra: 80 por visita + 20 de boas-vindas');
select pg_temp.complete_visit(:'cust_a', 3);
select pg_temp.check_loy(pg_temp.balance(:'cust_a') = 230, 'Bônus de boas-vindas só uma vez');
select pg_temp.check_loy(
  (select count(*) from public.loyalty_ledger l join loy_ctx c on l.barbershop_id = c.shop_id
    where l.user_id = c.cust_a and l.reason = 'appointment_completed' and l.program_version = 1) = 2,
  'Créditos novos guardam a versão da regra');

-- Atendimento sem cliente cadastrado não quebra a conclusão.
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status)
select shop_id, null, service_id, assoc_staff, '2030-03-01T15:00:00Z', '2030-03-01T15:30:00Z', 'completed'
from loy_ctx;
select pg_temp.check_loy(true, 'Concluir atendimento sem cliente não falha');

-- ---------------------------------------------------------------------------
-- Validação da versão própria
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_id', true);
select pg_temp.expect_loy_error(
  format($q$select public.save_loyalty_program(%L, 'custom', 0, 0, '[{"name":"A","min_points":0}]')$q$, :'shop_id'),
  'Pontos por visita abaixo de 1 recusado');
select pg_temp.expect_loy_error(
  format($q$select public.save_loyalty_program(%L, 'custom', 1001, 0, '[{"name":"A","min_points":0}]')$q$, :'shop_id'),
  'Pontos por visita acima de 1000 recusado');
select pg_temp.expect_loy_error(
  format($q$select public.save_loyalty_program(%L, 'custom', 50, 0, '[{"name":"A","min_points":10}]')$q$, :'shop_id'),
  'Primeiro nível precisa começar em 0');
select pg_temp.expect_loy_error(
  format($q$select public.save_loyalty_program(%L, 'custom', 50, 0, '[{"name":"A","min_points":0},{"name":"B","min_points":0}]')$q$, :'shop_id'),
  'Mínimos dos níveis precisam crescer');
select pg_temp.expect_loy_error(
  format($q$select public.save_loyalty_program(%L, 'custom', 50, 0, '[{"name":"A","min_points":0},{"name":"a","min_points":5}]')$q$, :'shop_id'),
  'Nomes de nível repetidos recusados');
select pg_temp.expect_loy_error(
  format($q$select public.save_loyalty_program(%L, 'custom', 50, 0, '[{"name":"1","min_points":0},{"name":"2","min_points":1},{"name":"3","min_points":2},{"name":"4","min_points":3},{"name":"5","min_points":4},{"name":"6","min_points":5},{"name":"7","min_points":6}]')$q$, :'shop_id'),
  'Mais de 6 níveis recusado');
select set_config('request.jwt.claim.sub', :'assoc_id', true);
select pg_temp.expect_loy_error(
  format($q$select public.save_loyalty_program(%L, 'default', null, null, null)$q$, :'shop_id'),
  'Parceiro não altera a regra');

-- ---------------------------------------------------------------------------
-- Ajuste manual
-- ---------------------------------------------------------------------------

select pg_temp.expect_loy_error(
  format($q$select public.adjust_loyalty_points(%L, %L, 10, 'motivo valido aqui')$q$, :'shop_id', :'cust_a'),
  'Parceiro não ajusta pontos');
select set_config('request.jwt.claim.sub', :'owner_id', true);
select pg_temp.expect_loy_error(
  format($q$select public.adjust_loyalty_points(%L, %L, 10, 'curto')$q$, :'shop_id', :'cust_a'),
  'Ajuste sem motivo suficiente recusado');
select pg_temp.expect_loy_error(
  format($q$select public.adjust_loyalty_points(%L, %L, 1001, 'motivo valido aqui')$q$, :'shop_id', :'cust_a'),
  'Ajuste acima do limite recusado');
select pg_temp.expect_loy_error(
  format($q$select public.adjust_loyalty_points(%L, %L, -231, 'correcao de lancamento')$q$, :'shop_id', :'cust_a'),
  'Ajuste que deixaria saldo negativo recusado');
select pg_temp.expect_loy_error(
  format($q$select public.adjust_loyalty_points(%L, %L, 10, 'cliente de outra loja')$q$, :'shop_id', :'outsider'),
  'Ajuste em quem não é cliente da loja recusado');
select pg_temp.check_loy(
  public.adjust_loyalty_points(:'shop_id', :'cust_a', -30, 'correcao de lancamento') = 200,
  'Ajuste para baixo com motivo aplicado');
reset role;
select pg_temp.check_loy(pg_temp.lifetime(:'cust_a') = 230, 'Ajuste para baixo preserva o nível conquistado');

-- ---------------------------------------------------------------------------
-- Recompensas e resgates
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_id', true);
create temporary table loy_reward as
select public.save_loyalty_reward(:'shop_id', null, 'Corte grátis', 'Um corte', 150, true, 0) id;
create temporary table loy_reward_big as
select public.save_loyalty_reward(:'shop_id', null, 'Kit premium', '', 5000, true, 1) id;

select set_config('request.jwt.claim.sub', :'cust_b', true);
select pg_temp.expect_loy_error(
  format('select public.request_loyalty_redemption(%L)', (select id from loy_reward)),
  'Resgate sem pontos suficientes recusado');

select set_config('request.jwt.claim.sub', :'cust_a', true);
create temporary table loy_red as select public.request_loyalty_redemption((select id from loy_reward)) id;
reset role;
select pg_temp.check_loy(pg_temp.balance(:'cust_a') = 50, 'Resgate reserva os pontos');
select pg_temp.check_loy(pg_temp.lifetime(:'cust_a') = 230, 'Resgate não derruba o nível');

set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_b', true);
select pg_temp.expect_loy_error(
  format($q$select public.resolve_loyalty_redemption(%L, 'cancel')$q$, (select id from loy_red)),
  'Outro cliente não cancela o resgate');
select set_config('request.jwt.claim.sub', :'cust_a', true);
select pg_temp.expect_loy_error(
  format($q$select public.resolve_loyalty_redemption(%L, 'fulfill')$q$, (select id from loy_red)),
  'Cliente não marca o próprio resgate como entregue');
select pg_temp.check_loy(
  public.resolve_loyalty_redemption((select id from loy_red), 'cancel') = 'cancelled',
  'Cliente cancela o próprio resgate');
reset role;
select pg_temp.check_loy(pg_temp.balance(:'cust_a') = 200, 'Cancelamento devolve os pontos');

set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_a', true);
select pg_temp.check_loy(
  public.resolve_loyalty_redemption((select id from loy_red), 'cancel') = 'cancelled',
  'Cancelar de novo não devolve duas vezes');
reset role;
select pg_temp.check_loy(pg_temp.balance(:'cust_a') = 200, 'Saldo continua 200 após repetição');

set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_a', true);
create temporary table loy_red2 as select public.request_loyalty_redemption((select id from loy_reward)) id;
select set_config('request.jwt.claim.sub', :'assoc_id', true);
select pg_temp.check_loy(
  public.resolve_loyalty_redemption((select id from loy_red2), 'fulfill') = 'fulfilled',
  'Equipe marca o resgate como entregue');
reset role;
select pg_temp.check_loy(pg_temp.balance(:'cust_a') = 50, 'Entrega não devolve pontos');

-- Vencimento após 30 dias devolve os pontos.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_id', true);
select public.adjust_loyalty_points(:'shop_id', :'cust_a', 200, 'bonus de aniversario do cliente');
select set_config('request.jwt.claim.sub', :'cust_a', true);
create temporary table loy_red3 as select public.request_loyalty_redemption((select id from loy_reward)) id;
reset role;
update public.loyalty_redemptions set expires_at = now() - interval '1 minute' where id = (select id from loy_red3);
set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_a', true);
select public.get_shop_loyalty_program(:'shop_id');
reset role;
select pg_temp.check_loy(
  (select status from public.loyalty_redemptions where id = (select id from loy_red3)) = 'expired',
  'Resgate vencido fica como expirado');
select pg_temp.check_loy(pg_temp.balance(:'cust_a') = 250, 'Resgate vencido devolve os pontos');

-- ---------------------------------------------------------------------------
-- Escrita direta bloqueada e módulo pausado congela
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_a', true);
select pg_temp.expect_loy_error(
  format('update public.loyalty_accounts set points = 99999 where user_id = %L', :'cust_a'),
  'Cliente não altera o saldo direto');
select pg_temp.expect_loy_error(
  format($q$insert into public.loyalty_ledger(user_id, barbershop_id, delta, reason) values (%L, %L, 500, 'manual_adjustment')$q$, :'cust_a', :'shop_id'),
  'Cliente não lança pontos direto');
select pg_temp.expect_loy_error(
  format('select public.list_shop_loyalty_customers(%L)', :'shop_id'),
  'Cliente não lista os clientes da loja');
select set_config('request.jwt.claim.sub', :'outsider', true);
select pg_temp.expect_loy_error(
  format('select public.get_shop_loyalty_program(%L)', :'shop_id'),
  'Quem não é da loja não lê a regra');

select set_config('request.jwt.claim.sub', :'admin_id', true);
select public.set_shop_loyalty_module(:'shop_id', false);
reset role;
select pg_temp.complete_visit(:'cust_a', 4);
select pg_temp.check_loy(pg_temp.balance(:'cust_a') = 250, 'Módulo pausado não credita e mantém o saldo');
set local role authenticated;
select set_config('request.jwt.claim.sub', :'cust_a', true);
select pg_temp.expect_loy_error(
  format('select public.request_loyalty_redemption(%L)', (select id from loy_reward)),
  'Módulo pausado não aceita novo resgate');
reset role;
select pg_temp.check_loy(
  (select count(*) from public.loyalty_ledger l join loy_ctx c on l.barbershop_id = c.shop_id where l.user_id = c.cust_a) > 0,
  'Módulo pausado não apaga o histórico');
