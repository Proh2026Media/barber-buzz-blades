-- After booking_reliability.sql, in the same transaction; always ROLLBACK.
reset role;
select set_config('request.jwt.claim.sub','',true);
-- Uma resposta por agendamento (índice customer_surveys_appointment_question_source_unique).
create temporary table interest_appointments as
select gen_random_uuid() id, n, c.starts_at + make_interval(days => 20 + n) starts_at from booking_test_context c cross join generate_series(1,5)n;
update business_hours set is_open=true where barbershop_id=(select shop_id from booking_test_context);
insert into appointments(id,barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at)
select i.id,c.shop_id,c.customer_a,c.service_id,c.staff_id,i.starts_at,i.starts_at+interval '30 minutes'
from booking_test_context c cross join interest_appointments i;
insert into customer_surveys(user_id,question,answer,state,answered_at,appointment_id,appointment_starts_at)
select c.customer_a,'service_interest',case when i.n<=3 then 'hydration' else 'facial' end,'answered',now(),i.id,i.starts_at
from booking_test_context c cross join interest_appointments i;
select set_config('request.jwt.claim.sub',shop_admin::text,true) from booking_test_context;
set local role authenticated;
create temporary table interest_result as select get_service_interest_insights(shop_id,now()-interval '1 day',now()+interval '1 day') value from booking_test_context;
select pg_temp.check_booking_test((select (value->>'sample')::int=5 from interest_result),'Service interest sample counted');
select pg_temp.check_booking_test((select value->'counts'->>'hydration'='3' from interest_result),'Service interest choices aggregated');
select pg_temp.check_booking_test((get_service_interest_insights((select shop_id from booking_test_context),now()-interval '3 days',now()-interval '2 days')->'counts')='{}'::jsonb,'Small service interest sample suppressed');
select set_config('request.jwt.claim.sub',outsider::text,true) from booking_test_context;
select pg_temp.expect_booking_error('select get_service_interest_insights(shop_id,now()-interval ''1 day'',now()) from booking_test_context','P0001','Other shop member cannot read service interest');
reset role;
delete from customer_surveys where appointment_id in (select id from interest_appointments);
insert into customer_surveys(user_id,question,answer,state,answered_at)
select customer_a,'service_interest','massage','answered',now() from booking_test_context;
select pg_temp.check_booking_test((select appointment_id is not null and appointment_starts_at is not null from customer_surveys where user_id=(select customer_a from booking_test_context) and question='service_interest' and answer='massage'),'Service interest automatically receives shop context');
select pg_temp.check_booking_test(not has_function_privilege('anon','public.get_service_interest_insights(uuid,timestamptz,timestamptz)','EXECUTE'),'Anonymous service interest insights denied');
