-- Regressão das ferramentas do parceiro.
-- Rodar depois de 20260917180000_partner_tools.sql na mesma transação; sempre ROLLBACK.
create temporary table partner_test_context as
select gen_random_uuid() shop_id, gen_random_uuid() associate_id, gen_random_uuid() other_id,
  gen_random_uuid() customer_id, gen_random_uuid() customer2_id,
  gen_random_uuid() associate_staff, gen_random_uuid() other_staff,
  gen_random_uuid() service_id, gen_random_uuid() service2_id;
grant select on partner_test_context to authenticated;

select shop_id, associate_id, other_id, customer_id, customer2_id,
  associate_staff, other_staff, service_id, service2_id
from partner_test_context \gset

create function pg_temp.check_partner(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'PASS: %',label;
end $$;
create function pg_temp.expect_partner_error(statement text,expected text,label text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; exception when others then get stacked diagnostics actual=returned_sqlstate; end;
  perform pg_temp.check_partner(actual=expected,label);
end $$;

insert into public.barbershops(id,name,slug)
select shop_id,'Partner tools test','partner-tools-'||shop_id from partner_test_context;

insert into auth.users(id,email,raw_user_meta_data)
select user_id,user_id||'@example.invalid','{}'::jsonb from partner_test_context c
cross join lateral unnest(array[c.associate_id,c.other_id,c.customer_id,c.customer2_id]) u(user_id);

-- O trigger handle_new_user já cria o profile; aqui só ajustamos o nome.
update public.profiles set full_name = 'Cliente A' where id = :'customer_id';
update public.profiles set full_name = 'Cliente B' where id = :'customer2_id';

insert into public.staff(id,barbershop_id,display_name,user_id,booking_slug)
select associate_staff,shop_id,'Parceiro',associate_id,'parceiro' from partner_test_context union all
select other_staff,shop_id,'Outro',other_id,'outro' from partner_test_context;

insert into public.services(id,barbershop_id,name,duration_minutes,price_cents)
select service_id,shop_id,'Corte',30,5000 from partner_test_context union all
select service2_id,shop_id,'Barba',30,3000 from partner_test_context;

insert into public.memberships(user_id,barbershop_id,role)
select customer_id,shop_id,'customer'::public.app_role from partner_test_context union all
select customer2_id,shop_id,'customer'::public.app_role from partner_test_context;

insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select shop_id,associate_id,associate_staff,'associate'::public.shop_member_role,null::numeric from partner_test_context union all
select shop_id,other_id,other_staff,'associate'::public.shop_member_role,null::numeric from partner_test_context;

-- Atendimentos concluídos em dias distintos (horário UTC dentro do funcionamento 09–19h de America/Sao_Paulo).
insert into public.appointments(barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at,status,booked_price_cents)
select shop_id,customer_id,service_id,associate_staff,'2030-01-01T15:00:00Z'::timestamptz,'2030-01-01T15:30:00Z'::timestamptz,'completed'::public.appointment_status,5000 from partner_test_context union all
select shop_id,customer_id,service2_id,associate_staff,'2030-01-22T15:00:00Z'::timestamptz,'2030-01-22T15:30:00Z'::timestamptz,'completed'::public.appointment_status,3000 from partner_test_context union all
select shop_id,customer2_id,service_id,associate_staff,'2030-01-05T16:00:00Z'::timestamptz,'2030-01-05T16:30:00Z'::timestamptz,'completed'::public.appointment_status,5000 from partner_test_context union all
-- Atendimento do OUTRO parceiro: não pode aparecer na carteira do primeiro.
select shop_id,customer2_id,service_id,other_staff,'2030-01-10T17:00:00Z'::timestamptz,'2030-01-10T17:30:00Z'::timestamptz,'completed'::public.appointment_status,5000 from partner_test_context;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'associate_id', true);

-- ---------------------------------------------------------------------------
-- Carteira: só o próprio
-- ---------------------------------------------------------------------------
select pg_temp.check_partner(
  (get_partner_wallet(:'shop_id')->>'completed_count')::int = 3,
  'Carteira soma apenas os atendimentos do próprio parceiro');
select pg_temp.check_partner(
  (get_partner_wallet(:'shop_id')->>'total_completed_cents')::int = 13000,
  'Carteira soma 5000+3000+5000 sem o valor do colega');
select pg_temp.check_partner(
  jsonb_array_length(get_partner_wallet(:'shop_id')->'entries') = 3,
  'Carteira lista apenas as próprias entradas');

-- ---------------------------------------------------------------------------
-- Clientes: só os do próprio parceiro
-- ---------------------------------------------------------------------------
select pg_temp.check_partner(
  jsonb_array_length(get_partner_clients(:'shop_id')) = 2,
  'Lista de clientes tem os dois clientes do próprio parceiro');
select pg_temp.check_partner(
  (get_partner_clients(:'shop_id')->0->>'customer_name') is not null,
  'Lista de clientes traz o nome do cliente');

-- ---------------------------------------------------------------------------
-- Ritmo: mediana de retorno calculada
-- ---------------------------------------------------------------------------
select pg_temp.check_partner(
  (get_partner_rhythm(:'shop_id')->>'sample')::int = 1,
  'Ritmo conta um intervalo de retorno (cliente A voltou uma vez)');
select pg_temp.check_partner(
  (get_partner_rhythm(:'shop_id')->>'avg_return_days')::float = 21,
  'Ritmo calcula 21 dias de retorno');
select pg_temp.check_partner(
  (get_partner_rhythm(:'shop_id')->>'preferred_weekday') is not null,
  'Ritmo informa o dia preferido');

-- ---------------------------------------------------------------------------
-- Perfil próprio: parceiro atualiza bio/avatar, não o slug nem outro perfil
-- ---------------------------------------------------------------------------
update public.staff set bio = 'Bio nova' where id = :'associate_staff';
select pg_temp.check_partner(
  (select bio from public.staff where id = :'associate_staff') = 'Bio nova',
  'Parceiro atualiza a própria bio');

select pg_temp.expect_partner_error(
  format('update public.staff set booking_slug=%L where id=%L', 'hack', :'associate_staff'),
  '42501','Parceiro não pode alterar o próprio slug público');

-- Tentar editar o colega não lança erro: a política simplesmente não casa e nada muda.
update public.staff set display_name = 'Invasor' where id = :'other_staff';
select pg_temp.check_partner(
  (select display_name from public.staff where id = :'other_staff') = 'Outro',
  'Parceiro não pode editar o perfil do colega');

-- ---------------------------------------------------------------------------
-- Ritmo do cliente: só o próprio cliente
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'customer_id', true);
select pg_temp.check_partner(
  (get_customer_rhythm(:'shop_id')->>'sample')::int >= 1,
  'Ritmo do cliente devolve os próprios atendimentos');
select pg_temp.check_partner(
  (get_customer_rhythm(:'shop_id')->>'top_service') is not null,
  'Ritmo do cliente aponta um serviço');

reset role;
