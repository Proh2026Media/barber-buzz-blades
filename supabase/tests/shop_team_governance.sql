-- Run after 20260917120000_shop_team_governance.sql in one transaction; always ROLLBACK.
create temporary table team_test_context as
select gen_random_uuid() shop_id,gen_random_uuid() owner_id,gen_random_uuid() partner_id,
  gen_random_uuid() associate_id,gen_random_uuid() employee_id,gen_random_uuid() customer_id,
  gen_random_uuid() owner_staff,gen_random_uuid() partner_staff,gen_random_uuid() associate_staff,
  gen_random_uuid() employee_staff,gen_random_uuid() service_id;
grant select on team_test_context to authenticated;

create function pg_temp.check_team(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'PASS: %',label;
end $$;
create function pg_temp.expect_team_error(statement text,expected text,label text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; exception when others then get stacked diagnostics actual=returned_sqlstate; end;
  perform pg_temp.check_team(actual=expected,label);
end $$;

insert into public.barbershops(id,name,slug)
select shop_id,'Team governance test','team-'||shop_id from team_test_context;
insert into auth.users(id,email,raw_user_meta_data)
select user_id,user_id||'@example.invalid','{}'::jsonb from team_test_context c
cross join lateral unnest(array[c.owner_id,c.partner_id,c.associate_id,c.employee_id,c.customer_id]) u(user_id);
insert into public.staff(id,barbershop_id,display_name,user_id,booking_slug)
select owner_staff,shop_id,'Owner',owner_id,'owner' from team_test_context union all
select partner_staff,shop_id,'Partner',partner_id,'partner' from team_test_context union all
select associate_staff,shop_id,'Associate',associate_id,'associate' from team_test_context union all
select employee_staff,shop_id,'Employee',employee_id,'employee' from team_test_context;
insert into public.services(id,barbershop_id,name,duration_minutes,price_cents)
select service_id,shop_id,'Base service',30,5000 from team_test_context;
insert into public.memberships(user_id,barbershop_id,role)
select customer_id,shop_id,'customer' from team_test_context;
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select shop_id,owner_id,owner_staff,'owner'::public.shop_member_role,50 from team_test_context union all
select shop_id,partner_id,partner_staff,'partner'::public.shop_member_role,50 from team_test_context union all
select shop_id,associate_id,associate_staff,'associate'::public.shop_member_role,null from team_test_context union all
select shop_id,employee_id,employee_staff,'employee'::public.shop_member_role,null from team_test_context;

select set_config('request.jwt.claim.sub',owner_id::text,true) from team_test_context;
set local role authenticated;
create temporary table equal_request as
select request_shop_change(shop_id,'service.create','{"name":"Needs approval","duration_minutes":45,"price_cents":7000}'::jsonb) result
from team_test_context;
select pg_temp.check_team((select result->>'status'='pending' from equal_request),'Equal partner change stays pending');
select pg_temp.check_team(not exists(select 1 from services where name='Needs approval'),'Pending change is not applied');
select pg_temp.expect_team_error(
  'select decide_shop_change((select id from shop_change_requests where kind=''service.create'' order by created_at desc limit 1),true)',
  '42501','Requester cannot approve own change');

select set_config('request.jwt.claim.sub',partner_id::text,true) from team_test_context;
select decide_shop_change((select id from shop_change_requests where kind='service.create' order by created_at desc limit 1),true);
select pg_temp.check_team(exists(select 1 from services where name='Needs approval'),'Other equal partner approval applies change');

reset role;
update public.shop_members set ownership_percent=case when role='owner' then 60 else 40 end
where barbershop_id=(select shop_id from team_test_context) and role in('owner','partner');
select set_config('request.jwt.claim.sub',owner_id::text,true) from team_test_context;
set local role authenticated;
select pg_temp.check_team(
  (select request_shop_change(shop_id,'service.create','{"name":"Majority applied","duration_minutes":30,"price_cents":6000}'::jsonb)->>'status'='applied' from team_test_context),
  'Majority partner applies directly');
select pg_temp.check_team(exists(select 1 from services where name='Majority applied'),'Majority change persisted');

select set_config('request.jwt.claim.sub',partner_id::text,true) from team_test_context;
select pg_temp.expect_team_error(
  'select request_shop_change(shop_id,''service.create'',''{"name":"Blocked minority","duration_minutes":30,"price_cents":1}''::jsonb) from team_test_context',
  '42501','Minority partner cannot change operation');

select set_config('request.jwt.claim.sub',employee_id::text,true) from team_test_context;
select pg_temp.check_team(
  (select get_professional_insights(shop_id,now()-interval '1 day',now()+interval '1 day')->'own'->'quoted_cents'='null'::jsonb from team_test_context),
  'Employee financial value is hidden');
reset role;
