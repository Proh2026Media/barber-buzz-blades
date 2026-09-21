-- After booking_reliability.sql, in the same transaction; always ROLLBACK.
reset role;
select set_config('request.jwt.claim.sub',customer_a::text,true) from booking_test_context;
select save_my_privacy(false,true,false);
insert into customer_surveys(user_id,question,answer,state,shown_at)
select customer_a,question,'skip','answered',now()-interval '31 days' from booking_test_context cross join unnest(array['discovery','period','professional','frequency','conversation']) question;
update customer_privacy set last_survey_at=now()-interval '31 days' where user_id=(select customer_a from booking_test_context);
set local role authenticated;
create temporary table service_interest_test as select next_customer_survey() value;
select pg_temp.check_booking_test((select value->>'question'='service_interest' from service_interest_test),'Service interest follows standard question order');
select pg_temp.expect_booking_error('select answer_customer_survey((value->>''id'')::uuid,''haircut'') from service_interest_test','P0001','Nonstandard service answer rejected');
select answer_customer_survey((value->>'id')::uuid,'hydration') from service_interest_test;
reset role;
select pg_temp.check_booking_test((select answer='hydration' and state='answered' from customer_surveys where id=(select (value->>'id')::uuid from service_interest_test)),'Standard service interest saved');
select set_config('request.jwt.claim.sub',customer_a::text,true) from booking_test_context;
set local role authenticated;
select pg_temp.check_booking_test(next_customer_survey() is null,'Service interest respects global cooldown');
select set_config('request.jwt.claim.sub',customer_b::text,true) from booking_test_context;
select pg_temp.expect_booking_error('select answer_customer_survey((value->>''id'')::uuid,''facial'') from service_interest_test','P0001','Other customer cannot answer service interest');
reset role;
