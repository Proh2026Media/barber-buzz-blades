-- Run inside a transaction, after the migrations. Always ROLLBACK afterwards.
-- Fixtures use random IDs and never modify existing users or appointments.
create temporary table booking_test_context as
select gen_random_uuid() as shop_id, gen_random_uuid() as other_shop_id,
       gen_random_uuid() as staff_id, gen_random_uuid() as other_staff_id,
       gen_random_uuid() as service_id,
       gen_random_uuid() as customer_a, gen_random_uuid() as customer_b,
       gen_random_uuid() as shop_admin, gen_random_uuid() as outsider,
       gen_random_uuid() as appointment_id,
       ((current_date + 2)::timestamp + interval '10 hours') at time zone 'America/Sao_Paulo' as starts_at;
grant select on booking_test_context to authenticated;

create function pg_temp.check_booking_test(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;

create function pg_temp.expect_booking_error(statement text, expected_state text, label text)
returns void language plpgsql as $$
declare actual_state text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate;
  end;
  if actual_state is distinct from expected_state then
    raise notice 'Expected SQLSTATE %, received % for %', expected_state, actual_state, label;
  end if;
  perform pg_temp.check_booking_test(actual_state = expected_state, label);
end;
$$;

insert into public.barbershops (id, name, slug)
select shop_id, 'Booking regression test', 'test-' || shop_id from booking_test_context
union all
select other_shop_id, 'Other test shop', 'test-' || other_shop_id from booking_test_context;

insert into auth.users (id, email, raw_user_meta_data)
select user_id, user_id || '@example.invalid', '{"full_name":"Booking test"}'::jsonb
from booking_test_context c
cross join lateral unnest(array[c.customer_a, c.customer_b, c.shop_admin, c.outsider]) as u(user_id);

insert into public.memberships (user_id, barbershop_id, role)
select customer_a, shop_id, 'customer'::public.app_role from booking_test_context
union all select customer_b, shop_id, 'customer'::public.app_role from booking_test_context
union all select shop_admin, shop_id, 'shop_admin'::public.app_role from booking_test_context
union all select outsider, other_shop_id, 'customer'::public.app_role from booking_test_context;

insert into public.services (id, barbershop_id, name, duration_minutes, price_cents)
select service_id, shop_id, 'Test cut', 30, 4500 from booking_test_context;
insert into public.staff (id, barbershop_id, display_name)
select staff_id, shop_id, 'Test barber' from booking_test_context
union all select other_staff_id, other_shop_id, 'Other barber' from booking_test_context;

select set_config('request.jwt.claim.sub', customer_a::text, true) from booking_test_context;
set local role authenticated;

insert into public.appointments (id, barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
select appointment_id, shop_id, customer_a, service_id, staff_id, starts_at, starts_at + interval '30 minutes'
from booking_test_context;
select pg_temp.check_booking_test(
  (select count(*) = 1 from public.appointments a join booking_test_context c on a.id = c.appointment_id),
  'Customer can create and read a confirmed appointment');

select pg_temp.expect_booking_error(
  'insert into public.appointments (barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status)
   select shop_id, customer_a, service_id, staff_id, starts_at + interval ''1 hour'', starts_at + interval ''90 minutes'', ''completed'' from booking_test_context',
  '42501', 'Customer cannot create a completed appointment to earn points');

select pg_temp.expect_booking_error(
  'insert into public.appointments (barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
   select shop_id, customer_a, service_id, staff_id, now() - interval ''1 hour'', now() - interval ''30 minutes'' from booking_test_context',
  '22023', 'Database rejects past appointments');

select set_config('request.jwt.claim.sub', customer_b::text, true) from booking_test_context;
select pg_temp.check_booking_test(
  (select count(*) = 0 from public.appointments a join booking_test_context c on a.id = c.appointment_id),
  'Second customer cannot read the first customer appointment');
select pg_temp.check_booking_test(
  (select count(*) = 1 from booking_test_context c,
    lateral public.get_staff_busy_intervals(c.staff_id, c.starts_at, c.starts_at + interval '1 day')),
  'Second customer can see the occupied interval');
select pg_temp.check_booking_test(
  (select count(*) = 1 from booking_test_context c,
    lateral public.get_staff_busy_intervals(c.staff_id, c.starts_at + interval '15 minutes', c.starts_at + interval '1 hour')),
  'Availability includes reservations overlapping the start of the requested interval');
select pg_temp.check_booking_test(
  (select array_agg(k order by k) = array['ends_at', 'starts_at'] from booking_test_context c,
    lateral public.get_staff_busy_intervals(c.staff_id, c.starts_at, c.starts_at + interval '1 hour') b,
    lateral jsonb_object_keys(to_jsonb(b)) k),
  'Availability exposes only start and end times');

select pg_temp.expect_booking_error(
  'insert into public.appointments (barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
   select shop_id, customer_b, service_id, staff_id, starts_at, starts_at + interval ''30 minutes'' from booking_test_context',
  '23P01', 'A competing reservation cannot occupy the same interval');

select pg_temp.expect_booking_error(
  'select public.get_staff_busy_intervals(other_staff_id, starts_at, starts_at + interval ''1 day'') from booking_test_context',
  '42501', 'Availability from another shop is denied');
select pg_temp.expect_booking_error(
  'select public.get_staff_busy_intervals(staff_id, starts_at, starts_at + interval ''3 days'') from booking_test_context',
  '22023', 'Oversized availability queries are rejected');

select pg_temp.check_booking_test(
  (select count(*) = 0 from public.profiles p join booking_test_context c on p.id = c.customer_a),
  'Customers cannot read another customer profile');

select set_config('request.jwt.claim.sub', shop_admin::text, true) from booking_test_context;
select pg_temp.check_booking_test(
  (select count(*) = 1 from public.profiles p join booking_test_context c on p.id = c.customer_a),
  'Shop admin can read the booked customer name');
select pg_temp.check_booking_test(
  (select count(*) = 0 from public.profiles p join booking_test_context c on p.id = c.outsider),
  'Shop admin cannot read an unrelated customer profile');

select pg_temp.expect_booking_error(
  'update public.appointments set starts_at = now() - interval ''1 hour'', ends_at = now() - interval ''30 minutes''
   where id = (select appointment_id from booking_test_context)',
  '22023', 'Admin cannot reschedule into the past');

update public.appointments set status = 'confirmed' where id = (select appointment_id from booking_test_context);
update public.appointments set status = 'completed' where id = (select appointment_id from booking_test_context);
update public.appointments set status = 'completed' where id = (select appointment_id from booking_test_context);
update public.appointments set status = 'confirmed' where id = (select appointment_id from booking_test_context);
update public.appointments set status = 'completed' where id = (select appointment_id from booking_test_context);

select set_config('request.jwt.claim.sub', customer_a::text, true) from booking_test_context;
select pg_temp.check_booking_test(
  (select points = 50 from public.loyalty_accounts l join booking_test_context c on l.user_id = c.customer_a and l.barbershop_id = c.shop_id),
  'Completing, repeating and reopening the appointment awards exactly 50 points');
select pg_temp.check_booking_test(
  (select count(*) = 1 from public.loyalty_ledger l join booking_test_context c on l.appointment_id = c.appointment_id),
  'Exactly one completion award is recorded');

insert into public.appointments (barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
select shop_id, customer_a, service_id, staff_id, starts_at + interval '1 hour', starts_at + interval '90 minutes'
from booking_test_context;
select set_config('request.jwt.claim.sub', shop_admin::text, true) from booking_test_context;
update public.appointments set status = 'completed'
where customer_id = (select customer_a from booking_test_context) and status = 'confirmed';
select set_config('request.jwt.claim.sub', customer_a::text, true) from booking_test_context;
select pg_temp.check_booking_test(
  (select points = 100 from public.loyalty_accounts l join booking_test_context c on l.user_id = c.customer_a and l.barbershop_id = c.shop_id),
  'A different completed appointment awards another 50 points');

insert into public.appointments (barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
select shop_id, customer_a, service_id, staff_id, starts_at + interval '2 hours', starts_at + interval '150 minutes'
from booking_test_context;
update public.appointments set status = 'cancelled'
where customer_id = (select customer_a from booking_test_context) and status = 'confirmed';
select pg_temp.check_booking_test(
  (select count(*) = 0 from booking_test_context c,
    lateral public.get_staff_busy_intervals(c.staff_id, c.starts_at + interval '2 hours', c.starts_at + interval '3 hours')),
  'Cancelling releases the interval');
select pg_temp.check_booking_test(
  (select points = 100 from public.loyalty_accounts l join booking_test_context c on l.user_id = c.customer_a and l.barbershop_id = c.shop_id),
  'Cancelling does not award points');

insert into public.appointments (barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
select shop_id, customer_a, service_id, staff_id, starts_at + interval '4 hours', starts_at + interval '270 minutes'
from booking_test_context;
select public.reschedule_own_appointment(
  a.id, c.service_id, c.staff_id, c.starts_at + interval '5 hours', c.starts_at + interval '330 minutes'
)
from public.appointments a join booking_test_context c on a.customer_id = c.customer_a
where a.starts_at = c.starts_at + interval '4 hours';
select pg_temp.check_booking_test(
  (select count(*) = 1 from public.appointments a join booking_test_context c on a.customer_id = c.customer_a
   where a.starts_at = c.starts_at + interval '5 hours' and a.status = 'confirmed'),
  'Customer can atomically reschedule an active appointment');

select set_config('request.jwt.claim.sub', customer_b::text, true) from booking_test_context;
select pg_temp.expect_booking_error(
  'select public.reschedule_own_appointment(c.appointment_id, c.service_id, c.staff_id, c.starts_at + interval ''6 hours'', c.starts_at + interval ''390 minutes'')
   from booking_test_context c',
  '42501', 'A customer cannot reschedule another customer appointment');

select set_config('request.jwt.claim.sub', customer_a::text, true) from booking_test_context;
select pg_temp.expect_booking_error(
  'select public.reschedule_own_appointment(a.id, c.service_id, c.staff_id, now() - interval ''1 hour'', now() - interval ''30 minutes'')
   from public.appointments a join booking_test_context c on a.customer_id = c.customer_a
   where a.starts_at = c.starts_at + interval ''5 hours''',
  '22023', 'Customer cannot reschedule into the past');

select pg_temp.check_booking_test(
  (select count(*) = 7 from public.business_hours h join booking_test_context c on h.barbershop_id = c.shop_id),
  'New shops receive a complete weekly schedule');

select set_config('request.jwt.claim.sub', shop_admin::text, true) from booking_test_context;
insert into public.availability_blocks (barbershop_id, staff_id, starts_at, ends_at, reason)
select shop_id, staff_id, starts_at + interval '7 hours', starts_at + interval '8 hours', 'Private admin note'
from booking_test_context;

select set_config('request.jwt.claim.sub', customer_a::text, true) from booking_test_context;
select pg_temp.check_booking_test(
  (select count(*) = 7 from public.business_hours h join booking_test_context c on h.barbershop_id = c.shop_id),
  'Customer can read shop operating hours');
select pg_temp.check_booking_test(
  (select count(*) = 0 from public.availability_blocks b join booking_test_context c on b.barbershop_id = c.shop_id),
  'Customer cannot read block reasons');
select pg_temp.check_booking_test(
  (select count(*) = 1 from booking_test_context c,
    lateral public.get_staff_busy_intervals(c.staff_id, c.starts_at + interval '7 hours', c.starts_at + interval '8 hours')),
  'Availability RPC includes staff blocks');
select pg_temp.expect_booking_error(
  'insert into public.appointments (barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
   select shop_id, customer_a, service_id, staff_id, starts_at + interval ''7 hours'', starts_at + interval ''450 minutes'' from booking_test_context',
  '23P01', 'Database rejects a booking inside an availability block');

select set_config('request.jwt.claim.sub', shop_admin::text, true) from booking_test_context;
update public.business_hours
set is_open = false
where barbershop_id = (select shop_id from booking_test_context)
  and weekday = extract(dow from (select starts_at from booking_test_context))::smallint;
select set_config('request.jwt.claim.sub', customer_a::text, true) from booking_test_context;
select pg_temp.expect_booking_error(
  'insert into public.appointments (barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
   select shop_id, customer_a, service_id, staff_id, starts_at + interval ''1 hour'', starts_at + interval ''90 minutes'' from booking_test_context',
  '22023', 'Database rejects a booking on a closed day');

reset role;
select pg_temp.check_booking_test(
  not has_function_privilege('anon', 'public.get_staff_busy_intervals(uuid,timestamptz,timestamptz)', 'EXECUTE'),
  'Anonymous callers cannot execute availability RPC');
