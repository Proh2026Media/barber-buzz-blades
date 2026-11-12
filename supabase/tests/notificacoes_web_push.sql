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
select pg_temp.push_check(not (select enabled from web_push_settings),'Instalação nasce desligada');
do $$ declare f record;begin select * into f from push_fixture;
 begin perform web_push_register(f.customer,f.customer_session,'https://fcm.googleapis.com/fcm/send/fake-customer',repeat('B',87),repeat('a',22),'https://app.example.invalid','pt-BR');raise exception 'FAIL: registrou desligado';exception when others then if sqlerrm<>'PUSH_UNAVAILABLE' then raise;end if;end;
end $$;
update web_push_settings set enabled=true;
select web_push_register(customer,customer_session,'https://fcm.googleapis.com/fcm/send/fake-customer',repeat('B',87),repeat('a',22),'https://app.example.invalid','pt-BR') from push_fixture;
select web_push_register(owner,owner_session,'https://fcm.googleapis.com/fcm/send/fake-owner',repeat('B',87),repeat('a',22),'https://app.example.invalid','pt-BR') from push_fixture;
select web_push_register(outsider,outsider_session,'https://fcm.googleapis.com/fcm/send/fake-outsider',repeat('B',87),repeat('a',22),'https://app.example.invalid','pt-BR') from push_fixture;
select pg_temp.push_check(web_push_status(customer,customer_session,'https://fcm.googleapis.com/fcm/send/fake-customer'),'Titular consulta inscrição desta sessão') from push_fixture;
select pg_temp.push_check(not web_push_status(outsider,outsider_session,'https://fcm.googleapis.com/fcm/send/fake-customer'),'Outra conta não consulta inscrição alheia') from push_fixture;
select web_push_revoke(outsider,'https://fcm.googleapis.com/fcm/send/fake-customer') from push_fixture;
select pg_temp.push_check((select count(*)=3 from web_push_subscriptions),'Outra conta não revoga inscrição alheia');
do $$ declare f record;begin select * into f from push_fixture;
 begin perform web_push_register(f.outsider,f.outsider_session,'https://fcm.googleapis.com/fcm/send/fake-customer',repeat('B',87),repeat('a',22),'https://app.example.invalid','pt-BR');raise exception 'FAIL: mudou titular';exception when others then if sqlerrm<>'PUSH_OTHER_SESSION' then raise;end if;end;
 begin perform web_push_register(f.customer,f.outsider_session,'https://fcm.googleapis.com/fcm/send/fake-2',repeat('B',87),repeat('a',22),'https://app.example.invalid','pt-BR');raise exception 'FAIL: usou sessão alheia';exception when others then if sqlerrm<>'PUSH_SESSION' then raise;end if;end;
end $$;
select pg_temp.push_check(not has_function_privilege('authenticated','public.web_push_claim()','execute') and not has_function_privilege('anon','public.web_push_claim()','execute'),'Navegador não despacha fila');
select pg_temp.push_check(not has_table_privilege('authenticated','public.web_push_subscriptions','select') and not has_table_privilege('anon','public.web_push_queue','select'),'Endpoints e fila não são públicos');
-- Isola este gatilho; regras de agendamento têm suas próprias suítes.
alter table appointments disable trigger user;
alter table appointments enable trigger appointments_web_push_notify_trg;
insert into appointments(id,barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at,status)
 select appointment,shop,customer,service,staff,now()+interval '100 days',now()+interval '100 days 30 minutes','confirmed' from push_fixture;
select pg_temp.push_check((select count(*)=2 from web_push_queue),'Cliente e dono recebem uma tarefa por aparelho; estranho não recebe');
select pg_temp.push_check((select count(*)=1 from web_push_queue q join web_push_subscriptions s on s.id=q.subscription_id where s.user_id=(select owner from push_fixture)),'Dono que também atende não recebe duplicado');
create temporary table push_claimed as select * from web_push_claim();
select pg_temp.push_check((select count(*)=0 from web_push_claim()),'Segundo lote não pega tarefas em andamento');
create temporary table push_permits as select p.id,p.lease,web_push_authorize(p.id,p.lease) permit from push_claimed p;
select pg_temp.push_check((select bool_and(permit is not null) from push_permits),'Autoriza destinatários válidos');
select pg_temp.push_check((select bool_and(permit->>'shop_name'='Push fictício') from push_permits),'Nome da barbearia deriva do agendamento no servidor');
select pg_temp.push_check((select bool_and(web_push_authorize(id,lease) is null) from push_claimed),'Não autoriza a mesma transmissão duas vezes');
select web_push_finish(id,lease,'unknown') from push_claimed;
select pg_temp.push_check((select count(*)=0 from web_push_claim()),'Envio incerto nunca volta à fila automaticamente');
update appointments set ends_at=ends_at+interval '5 minutes' where id=(select appointment from push_fixture);
select pg_temp.push_check((select count(*)=2 from web_push_queue where kind='changed'),'Mudança de horário gera atualização');
create temporary table push_second as select * from web_push_claim();
-- Simula retirada administrativa de acesso após a fila, sem testar as regras de saída da equipe.
update shop_members set active=false where user_id=(select owner from push_fixture);
select pg_temp.push_check((select web_push_authorize(q.id,q.lease) is null from push_second q join web_push_queue w on w.id=q.id join web_push_subscriptions s on s.id=w.subscription_id where s.user_id=(select owner from push_fixture)),'Permissão retirada depois da fila bloqueia envio');
update web_push_settings set enabled=false;
select pg_temp.push_check((select web_push_authorize(q.id,q.lease) is null from push_second q join web_push_queue w on w.id=q.id join web_push_subscriptions s on s.id=w.subscription_id where s.user_id=(select customer from push_fixture)),'Pausa global depois da reserva bloqueia transmissão');
update appointments set status='cancelled' where id=(select appointment from push_fixture);
select pg_temp.push_check((select count(*)=0 from web_push_queue where kind='cancelled'),'Serviço desligado não acumula novos avisos');
update web_push_settings set enabled=true;
select web_push_test(customer,customer_session,'https://fcm.googleapis.com/fcm/send/fake-customer') from push_fixture;
do $$ declare f record;begin select * into f from push_fixture;
 begin perform web_push_test(f.customer,f.customer_session,'https://fcm.googleapis.com/fcm/send/fake-customer');raise exception 'FAIL: repetiu teste';exception when others then if sqlerrm<>'PUSH_WAIT' then raise;end if;end;
end $$;
select pg_temp.push_check((select count(*)=1 from web_push_queue where kind='test'),'Teste próprio limitado a uma vez por minuto');
-- A mesma conta recebe a identidade de cada loja pelo agendamento, não pela última visita.
create temporary table push_second_shop as select gen_random_uuid() shop,gen_random_uuid() staff,gen_random_uuid() service,gen_random_uuid() appointment;
insert into barbershops(id,name,slug) select shop,'Segunda barbearia fictícia','push-second-'||shop from push_second_shop;
insert into staff(id,barbershop_id,display_name,user_id) select s.staff,s.shop,'Outro profissional fictício',f.outsider from push_second_shop s,push_fixture f;
insert into services(id,barbershop_id,name,duration_minutes,price_cents) select service,shop,'Outro corte fictício',30,1000 from push_second_shop;
insert into appointments(id,barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at,status)
 select s.appointment,s.shop,f.customer,s.service,s.staff,now()+interval '101 days',now()+interval '101 days 30 minutes','confirmed' from push_second_shop s,push_fixture f;
create temporary table push_third_claim as select * from web_push_claim();
select pg_temp.push_check((select web_push_authorize(c.id,c.lease)->>'shop_name'='Segunda barbearia fictícia' from push_third_claim c join web_push_queue q on q.id=c.id where q.appointment_id=(select appointment from push_second_shop)),'Mesmo cliente recebe nome da segunda loja sem reutilizar a primeira');
delete from auth.sessions where id=(select customer_session from push_fixture);
select pg_temp.push_check(not exists(select 1 from web_push_subscriptions where user_id=(select customer from push_fixture)),'Fim da sessão remove inscrição e fila vinculada');
select web_push_revoke(owner,'https://fcm.googleapis.com/fcm/send/fake-owner') from push_fixture;
select pg_temp.push_check(not exists(select 1 from web_push_subscriptions where user_id=(select owner from push_fixture)),'Desativação remove inscrição do titular');
