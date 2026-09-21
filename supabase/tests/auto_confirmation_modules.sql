-- Run after booking_reliability.sql and optional_occurrences.sql in a rollback transaction.
reset role;
-- Independent future reservation for withdrawal and rescheduling.
update business_hours set is_open=true where barbershop_id=(select shop_id from booking_test_context);
delete from availability_blocks where barbershop_id=(select shop_id from booking_test_context);
create temporary table withdrawal_test as select gen_random_uuid() as id, gen_random_uuid() as replacement;
grant select on withdrawal_test to authenticated;
select set_config('request.jwt.claim.sub',customer_a::text,true) from booking_test_context;
set local role authenticated;
insert into appointments(id,barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at)
select w.id,c.shop_id,c.customer_a,c.service_id,c.staff_id,c.starts_at+interval '7 hours',c.starts_at+interval '450 minutes' from booking_test_context c,withdrawal_test w;
select pg_temp.check_booking_test((select status='confirmed' from appointments where id=(select id from withdrawal_test)),'New reservation automatically confirmed');
select pg_temp.expect_booking_error('select withdraw_appointment_confirmation(id) from withdrawal_test','42501','Customer cannot withdraw confirmation');
select set_config('request.jwt.claim.sub',shop_admin::text,true) from booking_test_context;
select withdraw_appointment_confirmation(id) from withdrawal_test;
select pg_temp.check_booking_test((select status='reschedule_requested' from appointments where id=(select id from withdrawal_test)),'Withdrawal requests rescheduling');
select set_config('request.jwt.claim.sub',customer_b::text,true) from booking_test_context;
insert into appointments(id,barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at)
select w.replacement,c.shop_id,c.customer_b,c.service_id,c.staff_id,c.starts_at+interval '7 hours',c.starts_at+interval '450 minutes' from booking_test_context c,withdrawal_test w;
select pg_temp.check_booking_test((select status='confirmed' from appointments where id=(select replacement from withdrawal_test)),'Withdrawal immediately releases the slot');
select set_config('request.jwt.claim.sub',customer_a::text,true) from booking_test_context;
select reschedule_own_appointment(w.id,c.service_id,c.staff_id,c.starts_at+interval '6 hours',c.starts_at+interval '390 minutes') from booking_test_context c,withdrawal_test w;
select pg_temp.check_booking_test((select status='confirmed' from appointments where id=(select id from withdrawal_test)),'Customer reschedule automatically confirmed');
select set_config('request.jwt.claim.sub',shop_admin::text,true) from booking_test_context;
select withdraw_appointment_confirmation(id) from withdrawal_test;
select set_config('request.jwt.claim.sub',customer_a::text,true) from booking_test_context;
select cancel_appointment(id,null) from withdrawal_test;
select pg_temp.check_booking_test((select status='cancelled' from appointments where id=(select id from withdrawal_test)),'Customer can permanently cancel withdrawn booking');
reset role;
select set_config('request.jwt.claim.sub',shop_admin::text,true) from booking_test_context;
set local role authenticated;
select pg_temp.expect_booking_error('select set_shop_sports_module(shop_id,true) from booking_test_context','P0001','Shop admin cannot enable paid modules');
select pg_temp.expect_booking_error('update barbershop_settings set sports_enabled=true where barbershop_id=(select shop_id from booking_test_context)','42501','Module direct update denied');
select pg_temp.expect_booking_error('update appointments set status=''completed'' where id=(select appointment_id from booking_test_context)','P0001','No show cannot be completed for points');
reset role;
insert into memberships(user_id,role) select outsider,'platform_admin' from booking_test_context;
select set_config('request.jwt.claim.sub',outsider::text,true) from booking_test_context;
set local role authenticated;
select set_shop_sports_module(shop_id,true) from booking_test_context;
select pg_temp.check_booking_test((select sports_enabled from barbershop_settings where barbershop_id=(select shop_id from booking_test_context)),'Platform enables sports for one shop');
select pg_temp.check_booking_test((select not sports_enabled from barbershop_settings where barbershop_id=(select other_shop_id from booking_test_context)),'Other shop stays disabled');
select set_shop_sports_module(shop_id,false) from booking_test_context;
select pg_temp.check_booking_test((select not sports_enabled from barbershop_settings where barbershop_id=(select shop_id from booking_test_context)),'Platform disables sports');
reset role;
