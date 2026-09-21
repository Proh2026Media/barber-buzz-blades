-- After booking_reliability.sql, in the same transaction; always ROLLBACK.
reset role;
insert into memberships(user_id,role) select shop_admin,'platform_admin' from booking_test_context on conflict do nothing;
set local session_replication_role=replica;
insert into appointments(id,barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at,status)
select gen_random_uuid(),c.shop_id,c.customer_a,c.service_id,c.staff_id,c.starts_at+(n||' days')::interval,c.starts_at+(n||' days')::interval+interval '30 minutes','cancelled'
from booking_test_context c cross join generate_series(10,14) n;
set local session_replication_role=origin;
insert into customer_surveys(user_id,question,answer,state,appointment_id,appointment_starts_at)
select a.customer_id,'satisfaction',((row_number() over(order by a.id)-1)%5+1)::text,'answered',a.id,a.starts_at
from appointments a join booking_test_context c on a.barbershop_id=c.shop_id order by a.id limit 5;
insert into customer_surveys(user_id,question,answer,state,appointment_id,appointment_starts_at)
select a.customer_id,'improvement',case when row_number() over(order by a.id)<=3 then 'punctuality' else 'comfort' end,'answered',a.id,a.starts_at
from appointments a join booking_test_context c on a.barbershop_id=c.shop_id order by a.id limit 5;
insert into appointment_cancellations(appointment_id,reason,source,recorded_by)
select a.id,case when row_number() over(order by a.id)<=4 then 'schedule' else 'price' end,'shop',c.shop_admin
from appointments a join booking_test_context c on a.barbershop_id=c.shop_id where a.status='cancelled' order by a.id limit 5;
select set_config('request.jwt.claim.sub',shop_admin::text,true) from booking_test_context;
set local role authenticated;
create temporary table aggregate_result as select get_business_insights(shop_id,starts_at-interval '1 day',starts_at+interval '20 days') value from booking_test_context;
select pg_temp.check_booking_test((select (value->>'rating_sample')::int=5 from aggregate_result),'Rating sample counted');
select pg_temp.check_booking_test((select (value->>'rating_average')::numeric=3 from aggregate_result),'Rating average calculated');
select pg_temp.check_booking_test((select value->'rating_distribution'->>'5'='1' from aggregate_result),'Rating distribution aggregated');
select pg_temp.check_booking_test((select value->'improvement_counts'->>'punctuality'='3' from aggregate_result),'Improvement reasons aggregated');
select pg_temp.check_booking_test((select value->'cancellation_reason_counts'->>'schedule'='4' from aggregate_result),'Cancellation reasons aggregated');
select pg_temp.check_booking_test((get_business_insights((select shop_id from booking_test_context),now()-interval '1 day',now())->'rating_distribution')='{}'::jsonb,'Small samples suppressed');
select set_config('request.jwt.claim.sub',outsider::text,true) from booking_test_context;
select pg_temp.expect_booking_error('select get_business_insights(shop_id,now()-interval ''1 day'',now()) from booking_test_context','P0001','Other shop member cannot read aggregates');
reset role;
