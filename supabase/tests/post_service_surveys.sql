-- After booking_reliability.sql, same transaction ending with ROLLBACK.
reset role;
select set_config('request.jwt.claim.sub', customer_a::text, true) from booking_test_context;
select save_my_privacy(false,true,false);
insert into customer_surveys(user_id,question,state,shown_at) select customer_a,'discovery','dismissed',now()-interval '40 days' from booking_test_context;
set local role authenticated;
select pg_temp.check_booking_test(next_customer_survey()->>'question' = 'period', 'Future completed bookings do not qualify for rating');
reset role;
delete from customer_surveys where user_id=(select customer_a from booking_test_context) and question='period';
update customer_privacy set last_survey_at=now()-interval '31 days' where user_id=(select customer_a from booking_test_context);
-- Historical fixture only; production booking validation correctly rejects past insertions.
set local session_replication_role = replica;
insert into appointments(barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at,status)
select shop_id,customer_a,service_id,staff_id,now()-interval '1 day 1 hour',now()-interval '1 day','completed' from booking_test_context;
set local session_replication_role = origin;
set local role authenticated;
create temporary table rating_test as select next_customer_survey() value;
select pg_temp.check_booking_test((select value->>'question' = 'satisfaction' from rating_test), 'Recent completed appointment receives rating');
select pg_temp.check_booking_test((select value->>'appointment_id' is not null and value->>'appointment_starts_at' is not null from rating_test), 'Rating includes appointment context');
select pg_temp.check_booking_test(next_customer_survey() is null, 'Rating respects global cooldown');
select pg_temp.expect_booking_error('select answer_customer_survey((value->>''id'')::uuid,''6'') from rating_test','P0001','Rating outside fixed scale rejected');
select answer_customer_survey((value->>'id')::uuid,'5') from rating_test;
reset role;
update customer_surveys set shown_at=now()-interval '31 days' where id=(select (value->>'id')::uuid from rating_test);
update customer_privacy set last_survey_at=now()-interval '31 days' where user_id=(select customer_a from booking_test_context);
set local role authenticated;
create temporary table improvement_test as select next_customer_survey() value;
select pg_temp.check_booking_test((select value->>'question'='improvement' from improvement_test),'Improvement is offered in a later opportunity');
select pg_temp.check_booking_test((select value->>'appointment_id' from improvement_test)=(select value->>'appointment_id' from rating_test),'Followup refers to same appointment');
select answer_customer_survey((value->>'id')::uuid,'none') from improvement_test;
select set_config('request.jwt.claim.sub', customer_b::text, true) from booking_test_context;
select save_my_privacy(false,true,false);
select pg_temp.expect_booking_error('select answer_customer_survey((value->>''id'')::uuid,''1'') from rating_test','P0001','Another customer cannot answer rating');
reset role;
