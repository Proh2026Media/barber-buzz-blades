-- Executar somente em banco descartável, envolto em BEGIN/ROLLBACK.
create function pg_temp.push_batch_check(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;raise notice 'PASS: %',label;end $$;
create temporary table push_batch_fixture as select gen_random_uuid() u,gen_random_uuid() s;
insert into auth.users(id,email,raw_user_meta_data) select u,u||'@example.invalid','{}'::jsonb from push_batch_fixture;
insert into auth.sessions(id,user_id) select s,u from push_batch_fixture;
update web_push_settings set enabled=true;
select web_push_register(u,s,'https://fcm.googleapis.com/fcm/send/fake-batch',repeat('B',87),repeat('a',22),'https://app.example.invalid','pt-BR') from push_batch_fixture;
insert into web_push_queue(subscription_id,kind,target)
select s.id,'test','/app' from web_push_subscriptions s cross join generate_series(1,12) where s.user_id=(select u from push_batch_fixture);
create temporary table push_batch_a as select * from web_push_claim();
create temporary table push_batch_b as select * from web_push_claim();
select pg_temp.push_batch_check((select count(*)=4 from push_batch_a) and (select count(*)=4 from push_batch_b),'Cada reserva limita a quatro tarefas');
select pg_temp.push_batch_check(not exists(select 1 from push_batch_a a join push_batch_b b using(id)),'Reservas não repetem tarefas');
select pg_temp.push_batch_check((select count(*)=4 from web_push_queue where state='queued'),'Excedente permanece disponível sem ser reservado');
select web_push_authorize(id,lease) is not null from push_batch_a;
select pg_temp.push_batch_check((select bool_and(web_push_authorize(id,lease) is null) from push_batch_a),'Autorização de transmissão é consumida uma única vez');
-- Simula corte do worker com tarefas autorizadas e outras reservadas antes da autorização.
update web_push_queue set claimed_at=now()-interval '6 minutes' where state='processing';
create temporary table push_batch_c as select * from web_push_claim();
select pg_temp.push_batch_check((select count(*)=8 from web_push_queue where state='unknown'),'Interrupção vira incerta, inclusive reserva sem resposta');
select pg_temp.push_batch_check(not exists(select 1 from push_batch_c c join (select id from push_batch_a union all select id from push_batch_b) old using(id)),'Lote seguinte não repete tarefas incertas');
select pg_temp.push_batch_check((select count(*)=4 from push_batch_c),'Lote seguinte pega somente o excedente que nunca foi tentado');
select pg_temp.push_batch_check(not has_function_privilege('authenticated','public.web_push_claim()','execute') and has_function_privilege('service_role','public.web_push_claim()','execute'),'Permissões do claim permanecem restritas');
update web_push_settings set enabled=false;
select pg_temp.push_batch_check((select count(*)=0 from web_push_claim()),'Pausa global impede reservar');
select pg_temp.push_batch_check((select bool_and(web_push_authorize(id,lease) is null) from push_batch_c),'Pausa posterior à reserva impede transmitir');
