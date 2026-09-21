-- Run after 20260917130000_team_provisioning.sql in one transaction; always ROLLBACK.
create temporary table provision_context as
select gen_random_uuid() shop_id,gen_random_uuid() platform_id,gen_random_uuid() owner_id,
  gen_random_uuid() partner_id,gen_random_uuid() employee_id,gen_random_uuid() owner_staff;
grant select on provision_context to authenticated;
create function pg_temp.check_provision(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;

insert into public.barbershops(id,name,slug)
select shop_id,'Provision test','provision-'||shop_id from provision_context;
insert into auth.users(id,email,raw_user_meta_data)
select user_id,user_id||'@example.invalid','{}'::jsonb from provision_context c
cross join lateral unnest(array[c.platform_id,c.owner_id,c.partner_id,c.employee_id]) u(user_id);
insert into public.memberships(user_id,role)
select platform_id,'platform_admin' from provision_context;
insert into public.staff(id,barbershop_id,user_id,display_name)
select owner_staff,shop_id,owner_id,'Owner' from provision_context;
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select shop_id,owner_id,owner_staff,'owner',100 from provision_context;

select set_config('request.jwt.claim.sub',platform_id::text,true) from provision_context;
set local role authenticated;
select platform_add_shop_member(shop_id,employee_id,'employee',null,'Employee') from provision_context;
select platform_add_shop_member(shop_id,partner_id,'partner',40,'Partner') from provision_context;
select pg_temp.check_provision(
  exists(select 1 from shop_members m join provision_context c on m.user_id=c.employee_id where m.role='employee' and m.ownership_percent is null),
  'Platform provisions employee without financial ownership');
select pg_temp.check_provision(
  exists(select 1 from shop_members m join provision_context c on m.user_id=c.partner_id where m.role='partner' and m.ownership_percent=40),
  'Platform provisions partner with requested share');
select pg_temp.check_provision(
  exists(select 1 from shop_members m join provision_context c on m.user_id=c.owner_id where m.role='owner' and m.ownership_percent=60),
  'Partner share is transferred from current owner');
reset role;
