-- Executar em BEGIN/ROLLBACK na bancada; nenhuma conexão real.
create temporary table health_fixture as select gen_random_uuid() admin,gen_random_uuid() customer,gen_random_uuid() channel,gen_random_uuid() empty_channel;
create function pg_temp.health_check(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end $$;
insert into auth.users(id,email,raw_user_meta_data) select admin,admin||'@example.invalid','{}'::jsonb from health_fixture union all select customer,customer||'@example.invalid','{}'::jsonb from health_fixture;
insert into memberships(user_id,role) select admin,'platform_admin' from health_fixture;
select set_config('request.jwt.claim.sub',customer::text,true) from health_fixture;
do $$ begin begin perform platform_whatsapp_health_data();raise exception 'FAIL: cliente leu monitor';exception when insufficient_privilege then raise notice 'PASS: cliente sem acesso';end;end $$;
select pg_temp.health_check(not has_function_privilege('anon','public.platform_whatsapp_health_data()','execute'),'Visitante sem acesso ao monitor');
insert into whatsapp_channels(id,instance_name,display_phone,label,enabled) select channel,'health-'||channel,'+5511999990000','Número fictício',false from health_fixture union all select empty_channel,'health-'||empty_channel,null,'Preparação sem telefone',false from health_fixture;
insert into whatsapp_send_attempts(instance_name,challenge_id,state,started_at) select 'health-'||channel,gen_random_uuid(),'unknown',now()-interval '10 minutes' from health_fixture;
select set_config('request.jwt.claim.sub',admin::text,true) from health_fixture;
create temporary table health_result as select platform_whatsapp_health_data() value;
select pg_temp.health_check(exists(select 1 from health_result,jsonb_array_elements(value->'numbers') n where n->>'id'=(select channel::text from health_fixture)),'Número identificado aparece no monitor');
select pg_temp.health_check(not exists(select 1 from health_result,jsonb_array_elements(value->'numbers') n where n->>'id'=(select empty_channel::text from health_fixture)),'Preparação sem telefone não aparece como número');
select pg_temp.health_check((select (n->>'unknown')::int=1 from health_result,jsonb_array_elements(value->'numbers') n where n->>'id'=(select channel::text from health_fixture)),'Resultado incerto contabilizado por instância');
select pg_temp.health_check((select not (value::text ~ 'provider_message_id|qrcode|to_e164|body|apiKey') from health_result),'Monitor não retorna destinatário, conteúdo, QR ou segredo');

-- Só dentro da transação de bancada: simula catálogo que omite todos os números.
create or replace function public.platform_whatsapp_directory() returns jsonb language sql security definer set search_path=public as $$ select '{"channels":[]}'::jsonb $$;
select pg_temp.health_check(jsonb_array_length(platform_whatsapp_health_data()->'numbers')=0,'Monitor respeita exclusões do catálogo vigente');
