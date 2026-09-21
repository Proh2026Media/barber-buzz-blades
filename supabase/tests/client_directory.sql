-- Regressão do diretório de clientes.
-- Rodar depois de 20260917190000_client_directory.sql + 20260917180000_partner_tools.sql,
-- na mesma transação; sempre ROLLBACK.
create temporary table client_test_context as
select gen_random_uuid() shop_id, gen_random_uuid() owner_id, gen_random_uuid() associate_id,
  gen_random_uuid() other_id, gen_random_uuid() customer_a, gen_random_uuid() customer_b,
  gen_random_uuid() customer_c, gen_random_uuid() owner_staff, gen_random_uuid() associate_staff,
  gen_random_uuid() other_staff, gen_random_uuid() service_id;
grant select on client_test_context to authenticated;

select shop_id, owner_id, associate_id, other_id, customer_a, customer_b, customer_c,
  owner_staff, associate_staff, other_staff, service_id
from client_test_context \gset

create function pg_temp.check_client(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'PASS: %',label;
end $$;
create function pg_temp.expect_client_error(statement text,expected text,label text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; exception when others then get stacked diagnostics actual=returned_sqlstate; end;
  perform pg_temp.check_client(actual=expected,label);
end $$;

insert into public.barbershops(id,name,slug)
select shop_id,'Client directory test','client-dir-'||shop_id from client_test_context;

insert into auth.users(id,email,raw_user_meta_data)
select user_id,user_id||'@example.invalid','{}'::jsonb from client_test_context c
cross join lateral unnest(array[c.owner_id,c.associate_id,c.other_id,c.customer_a,c.customer_b,c.customer_c]) u(user_id);

update public.profiles set full_name = 'Cliente A' where id = :'customer_a';
update public.profiles set full_name = 'Cliente B' where id = :'customer_b';
update public.profiles set full_name = 'Cliente C' where id = :'customer_c';

insert into public.staff(id,barbershop_id,display_name,user_id,booking_slug)
select owner_staff,shop_id,'Dono',owner_id,'dono' from client_test_context union all
select associate_staff,shop_id,'Parceiro',associate_id,'parceiro' from client_test_context union all
select other_staff,shop_id,'Outro',other_id,'outro' from client_test_context;

insert into public.services(id,barbershop_id,name,duration_minutes,price_cents)
select service_id,shop_id,'Corte',30,5000 from client_test_context;

insert into public.memberships(user_id,barbershop_id,role)
select customer_a,shop_id,'customer'::public.app_role from client_test_context union all
select customer_b,shop_id,'customer'::public.app_role from client_test_context union all
select customer_c,shop_id,'customer'::public.app_role from client_test_context;

insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select shop_id,owner_id,owner_staff,'owner'::public.shop_member_role,100::numeric from client_test_context union all
select shop_id,associate_id,associate_staff,'associate'::public.shop_member_role,null::numeric from client_test_context union all
select shop_id,other_id,other_staff,'associate'::public.shop_member_role,null::numeric from client_test_context;

-- Atendimentos: A duas vezes com parceiro, B uma vez com parceiro, C com o outro.
insert into public.appointments(barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at,status,booked_price_cents)
select shop_id,customer_a,service_id,associate_staff,'2030-01-01T15:00:00Z'::timestamptz,'2030-01-01T15:30:00Z'::timestamptz,'completed'::public.appointment_status,5000 from client_test_context union all
select shop_id,customer_a,service_id,associate_staff,'2030-01-22T15:00:00Z'::timestamptz,'2030-01-22T15:30:00Z'::timestamptz,'completed'::public.appointment_status,5000 from client_test_context union all
select shop_id,customer_b,service_id,associate_staff,'2030-01-05T16:00:00Z'::timestamptz,'2030-01-05T16:30:00Z'::timestamptz,'completed'::public.appointment_status,5000 from client_test_context union all
select shop_id,customer_c,service_id,other_staff,'2030-01-10T17:00:00Z'::timestamptz,'2030-01-10T17:30:00Z'::timestamptz,'completed'::public.appointment_status,5000 from client_test_context;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Escopo da lista: dono vê todos, parceiro vê só os seus
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', :'owner_id', true);
select pg_temp.check_client(
  jsonb_array_length(get_partner_clients(:'shop_id')) = 3,
  'Dono vê os três clientes da barbearia');

select set_config('request.jwt.claim.sub', :'associate_id', true);
select pg_temp.check_client(
  jsonb_array_length(get_partner_clients(:'shop_id')) = 2,
  'Parceiro vê apenas os dois clientes que atendeu');

-- ---------------------------------------------------------------------------
-- Perfil do cliente: histórico e ritmo
-- ---------------------------------------------------------------------------

select pg_temp.check_client(
  (get_client_profile(:'shop_id', :'customer_a')->>'visits')::int = 2,
  'Perfil do cliente A soma duas visitas');
select pg_temp.check_client(
  (get_client_profile(:'shop_id', :'customer_a')->>'customer_name') = 'Cliente A',
  'Perfil do cliente traz o nome');
select pg_temp.check_client(
  jsonb_array_length(get_client_profile(:'shop_id', :'customer_a')->'history') >= 2,
  'Perfil do cliente traz o histórico de agendamentos');
select pg_temp.check_client(
  (get_client_profile(:'shop_id', :'customer_a')->'rhythm'->>'avg_return_days') is not null,
  'Perfil do cliente calcula o ritmo de retorno');

-- Parceiro não abre o perfil de um cliente que não atendeu.
select pg_temp.expect_client_error(
  format('select get_client_profile(%L,%L)', :'shop_id', :'customer_c'),
  '42501','Parceiro não abre o perfil de cliente que não atendeu');

-- Dono abre qualquer cliente.
select set_config('request.jwt.claim.sub', :'owner_id', true);
select pg_temp.check_client(
  (get_client_profile(:'shop_id', :'customer_c')->>'customer_name') = 'Cliente C',
  'Dono abre o perfil de qualquer cliente');

reset role;
