-- After booking_reliability.sql, in the same transaction; always ROLLBACK.
reset role;
-- export_my_data lê auth.users.phone, coluna criada pelas migrations do GoTrue
-- (Auth do Supabase). O Postgres local de teste (supabase/postgres sem GoTrue)
-- tem só o auth.users básico, sem ela: cria a coluna nesta transação (some no
-- ROLLBACK) para o teste refletir o esquema real. Só altera quando a coluna
-- falta: ALTER TABLE exige ser dono de auth.users (supabase_auth_admin) mesmo
-- com IF NOT EXISTS, então em banco com Auth nada é executado. Localmente,
-- rodar como superusuário (ex.: psql -U supabase_admin).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'phone'
  ) then
    alter table auth.users add column phone text;
  end if;
end $$;
select set_config('request.jwt.claim.sub', customer_a::text, true) from booking_test_context;
set local role authenticated;
select pg_temp.check_booking_test((export_my_data()->'account'->>'id')::uuid = auth.uid(), 'Export identifies only own account');
select pg_temp.check_booking_test(not (export_my_data()->'account' ? 'encrypted_password'), 'Export excludes credentials');
select pg_temp.check_booking_test(not exists(select 1 from jsonb_array_elements(export_my_data()->'appointments') a where (a->>'customer_id')::uuid <> auth.uid()), 'Export excludes other customer appointments');
create temporary table privacy_request_test as select request_account_deletion() id;
select pg_temp.check_booking_test(request_account_deletion() = (select id from privacy_request_test), 'Duplicate requests return same protocol');
select pg_temp.check_booking_test(jsonb_array_length(list_privacy_requests(false)) = 1, 'Own request visible');
select pg_temp.expect_booking_error('select list_privacy_requests(true)', 'P0001', 'Customer cannot read global queue');
select set_config('request.jwt.claim.sub', customer_b::text, true) from booking_test_context;
select pg_temp.check_booking_test(jsonb_array_length(list_privacy_requests(false)) = 0, 'Another customer cannot read request');
select pg_temp.expect_booking_error('select update_privacy_request(id, ''cancelled'') from privacy_request_test', 'P0001', 'Another customer cannot cancel request');
select pg_temp.expect_booking_error('select update_privacy_request(id, ''reviewing'') from privacy_request_test', 'P0001', 'Customer cannot start review');
reset role;
insert into memberships(user_id,role) select shop_admin,'platform_admin' from booking_test_context;
select set_config('request.jwt.claim.sub', shop_admin::text, true) from booking_test_context;
set local role authenticated;
select pg_temp.check_booking_test(exists(select 1 from jsonb_array_elements(list_privacy_requests(true)) r where (r->>'id')::uuid = (select id from privacy_request_test)), 'Platform can see request');
select update_privacy_request(id,'reviewing') from privacy_request_test;
select set_config('request.jwt.claim.sub', customer_a::text, true) from booking_test_context;
select pg_temp.check_booking_test(list_privacy_requests(false)->0->>'status' = 'reviewing', 'Customer sees review status');
select update_privacy_request(id,'cancelled') from privacy_request_test;
select pg_temp.check_booking_test(jsonb_array_length(list_privacy_requests(false)) = 0, 'Customer can cancel request');
select pg_temp.check_booking_test(exists(select 1 from appointments where customer_id=auth.uid()), 'Request does not remove bookings');
reset role;
select pg_temp.check_booking_test(not has_function_privilege('anon','public.export_my_data()','EXECUTE'), 'Anonymous export denied');
