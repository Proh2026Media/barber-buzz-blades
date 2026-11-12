-- Somente dados fictícios, BEGIN/ROLLBACK no banco local com a migration nº 105.
create table public.wa120 as select gen_random_uuid() shop,gen_random_uuid() other_shop,
  gen_random_uuid() customer,gen_random_uuid() other_customer,gen_random_uuid() owner,
  gen_random_uuid() staff,gen_random_uuid() service,gen_random_uuid() appointment,
  '+55119'||lpad((floor(random()*100000000))::bigint::text,8,'0') phone;
grant select on wa120 to authenticated;
create function pg_temp.check_wa120(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
insert into auth.users(id,email,raw_user_meta_data)
select u,u||'@example.invalid','{}'::jsonb from wa120 c cross join lateral unnest(array[c.customer,c.other_customer,c.owner]) u;
insert into public.barbershops(id,name,slug)
select shop,'Loja fictícia','w120-'||shop from wa120 union all select other_shop,'Outra fictícia','w120-'||other_shop from wa120;
insert into public.staff(id,barbershop_id,display_name,user_id,booking_slug)
select staff,shop,'Profissional fictício',owner,'teste' from wa120;
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select shop,owner,staff,'owner',100 from wa120;
insert into public.services(id,barbershop_id,name,duration_minutes,price_cents)
select service,shop,'Corte fictício',30,1000 from wa120;
select set_config('request.jwt.claim.role','service_role',true);
select public.apply_verified_whatsapp(customer,phone,true) is not null from wa120;
select set_config('request.jwt.claim.role','',true);
insert into public.whatsapp_channels(barbershop_id,instance_name,status)
select shop,'teste-'||shop,'open'::public.whatsapp_channel_status from wa120 union all select other_shop,'teste-'||other_shop,'open' from wa120;




update public.whatsapp_send_controls set paused=false;
update public.whatsapp_group_settings set enrollment_enabled=true;
update public.whatsapp_channels set display_phone='+5511888888888';
insert into public.whatsapp_group_accounts(barbershop_id,channel_id)
  select c.shop,n.id from wa120 c join public.whatsapp_channels n on n.barbershop_id=c.shop;
select set_config('request.jwt.claim.role','service_role',true);
select public.apply_verified_whatsapp(owner,'+5511777777777',true) is not null from wa120;
select set_config('request.jwt.claim.role','',true);
select set_config('request.jwt.claim.sub',customer::text,true) from wa120;
select public.care_group_request(shop,true,array(select id from public.whatsapp_group_accounts)) is not null from wa120;
-- Identidade histórica revogada, usada para conferir remoção sem nova aprovação.
insert into public.whatsapp_care_participants(group_id,user_id,role,approved_at,approved_phone,revoked_at)
select g.id,c.owner,'owner',now(),'+5511777777777',now() from public.whatsapp_care_groups g cross join wa120 c;
select set_config('request.jwt.claim.sub','',true);
