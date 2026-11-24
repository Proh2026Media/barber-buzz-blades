-- Somente banco descartável; o executor envolve em BEGIN/ROLLBACK. Nenhuma chamada de rede.
create temporary table push_fixture as select gen_random_uuid() customer,gen_random_uuid() owner,gen_random_uuid() outsider,
 gen_random_uuid() customer_session,gen_random_uuid() owner_session,gen_random_uuid() outsider_session,
 gen_random_uuid() shop,gen_random_uuid() staff,gen_random_uuid() service,gen_random_uuid() appointment;
create function pg_temp.push_check(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;raise notice 'PASS: %',label;end $$;
alter table shop_members disable trigger user;
insert into auth.users(id,email,raw_user_meta_data) select customer,customer||'@example.invalid','{}'::jsonb from push_fixture union all select owner,owner||'@example.invalid','{}'::jsonb from push_fixture union all select outsider,outsider||'@example.invalid','{}'::jsonb from push_fixture;
insert into auth.sessions(id,user_id) select customer_session,customer from push_fixture union all select owner_session,owner from push_fixture union all select outsider_session,outsider from push_fixture;
insert into barbershops(id,name,slug) select shop,'Push fictício','push-'||shop from push_fixture;
insert into staff(id,barbershop_id,display_name,user_id) select staff,shop,'Profissional fictício',owner from push_fixture;
insert into shop_members(barbershop_id,user_id,staff_id,role,ownership_percent) select shop,owner,staff,'owner',100 from push_fixture;
insert into services(id,barbershop_id,name,duration_minutes,price_cents) select service,shop,'Corte fictício',30,1000 from push_fixture;
alter table appointments disable trigger user;
insert into appointments(id,barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at,status)
select appointment,shop,customer,service,staff,now(),now()+interval '30 minutes','cancelled' from push_fixture;
do $$
declare f record; e uuid; token uuid; seen timestamptz; subscription uuid; job uuid; lease_key uuid := gen_random_uuid();
begin
select * into f from push_fixture;
insert into email_outbox(barbershop_id,to_email,template_key,subject,body,dedupe_key,status,payload)
values(f.shop,f.customer||'@example.invalid','booking.confirmed','Teste','Teste',gen_random_uuid()::text,'sending',jsonb_build_object('appointment_id',f.appointment)) returning id into e;
token:=email_open_token(e);
perform pg_temp.push_check(token is not null and token=email_open_token(e),'Token estável para o mesmo e-mail');
perform complete_email_outbox(e,true,null);
perform set_config('request.jwt.claim.sub',f.owner::text,true);
perform pg_temp.push_check((select sent_at is not null and opened_at is null from appointment_notice_history(f.appointment)),'Enviado sem abertura');
perform record_notice_open(token,'push');
perform pg_temp.push_check((select opened_at is null from appointment_notice_history(f.appointment)),'Canal incorreto ignorado');
perform record_notice_open(token,'email');select opened_at into seen from appointment_notice_history(f.appointment);
perform record_notice_open(token,'email');
perform pg_temp.push_check(seen is not null and (select opened_at=seen from appointment_notice_history(f.appointment)),'Abertura registrada uma vez');
insert into web_push_subscriptions(user_id,session_id,endpoint,p256dh,auth_key,origin,locale)
values(f.customer,f.customer_session,'https://web.push.apple.com/'||f.customer,repeat('A',87),repeat('B',22),'https://push-'||f.shop||'.'||app_platform_base_host(),'pt-BR') returning id into subscription;
update web_push_settings set enabled=true;
insert into web_push_queue(subscription_id,appointment_id,kind,target,state,lease)
values(subscription,f.appointment,'created','/app','processing',lease_key) returning id into job;
token:=(web_push_authorize_receipt(job,lease_key)->>'receipt')::uuid;
perform pg_temp.push_check(token is not null,'Envio autorizado entrega token de toque');
update web_push_queue set state='accepted',finished_at=now() where id=job;
perform record_notice_open(token,'push');
delete from web_push_queue where id=job;
perform pg_temp.push_check((select sent_at is not null and opened_at is not null from appointment_notice_history(f.appointment) where channel='push'),'Histórico de toque sobrevive à limpeza da fila');
perform set_config('request.jwt.claim.sub',f.outsider::text,true);
perform pg_temp.push_check(not exists(select from appointment_notice_history(f.appointment)),'Outra conta sem acesso');
end $$;
