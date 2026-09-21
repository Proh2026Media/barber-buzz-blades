-- After booking_reliability.sql, in the same transaction; always ROLLBACK.
reset role;
insert into customer_surveys(user_id,question,answer,state,answered_at,appointment_id,appointment_starts_at)
select c.customer_a,'service_interest',case when n<=3 then 'hydration' else 'facial' end,'answered',now(),c.appointment_id,c.starts_at
from booking_test_context c cross join generate_series(1,5)n;
select set_config('request.jwt.claim.sub',shop_admin::text,true) from booking_test_context;
set local role authenticated;
create temporary table interest_result as select get_service_interest_insights(shop_id,now()-interval '1 day',now()+interval '1 day') value from booking_test_context;
select pg_temp.check_booking_test((select (value->>'sample')::int=5 from interest_result),'Service interest sample counted');
select pg_temp.check_booking_test((select value->'counts'->>'hydration'='3' from interest_result),'Service interest choices aggregated');
select pg_temp.check_booking_test((get_service_interest_insights((select shop_id from booking_test_context),now()-interval '3 days',now()-interval '2 days')->'counts')='{}'::jsonb,'Small service interest sample suppressed');
select set_config('request.jwt.claim.sub',outsider::text,true) from booking_test_context;
select pg_temp.expect_booking_error('select get_service_interest_insights(shop_id,now()-interval ''1 day'',now()) from booking_test_context','P0001','Other shop member cannot read service interest');
reset role;
insert into customer_surveys(user_id,question,answer,state,answered_at)
select customer_a,'service_interest','massage','answered',now() from booking_test_context;
select pg_temp.check_booking_test((select appointment_id is not null and appointment_starts_at is not null from customer_surveys where user_id=(select customer_a from booking_test_context) and question='service_interest' and answer='massage'),'Service interest automatically receives shop context');
select pg_temp.check_booking_test(not has_function_privilege('anon','public.get_service_interest_insights(uuid,timestamptz,timestamptz)','EXECUTE'),'Anonymous service interest insights denied');
