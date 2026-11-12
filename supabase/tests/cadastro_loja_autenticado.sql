-- Executor envolve em BEGIN/ROLLBACK; somente banco descartável.
create temporary table signup_fixture as select gen_random_uuid() person, gen_random_uuid() other,gen_random_uuid() request;
create function pg_temp.check_signup(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end $$;
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at)
select person,person||'@example.invalid','{"full_name":"Dono fictício"}'::jsonb,now() from signup_fixture;
insert into auth.users(id,email,raw_user_meta_data) select other,other||'@example.invalid','{}'::jsonb from signup_fixture;
select pg_temp.check_signup(not has_function_privilege('anon','register_my_barbershop(uuid,text,text,text,boolean,text,text,text)','execute'),'Visitante não cria loja');
select pg_temp.check_signup(not has_table_privilege('authenticated','shop_registration_requests','select'),'Histórico privado');
select set_config('request.jwt.claim.sub',other::text,true) from signup_fixture;
do $$ begin
 begin perform register_my_barbershop(request,'Teste','America/Sao_Paulo','single',true,'1','1','1') from signup_fixture;raise exception 'FAIL: e-mail sem prova';exception when insufficient_privilege then raise notice 'PASS: e-mail não confirmado recusado';end;
end $$;
select set_config('request.jwt.claim.sub',person::text,true) from signup_fixture;
do $$ begin
 begin perform register_my_barbershop(request,'Teste','America/Sao_Paulo','single',false,'1','1','1') from signup_fixture;raise exception 'FAIL: sem aceite';exception when invalid_parameter_value then raise notice 'PASS: aceite obrigatório';end;
 begin perform register_my_barbershop(request,'Teste','Invalido/Falso','single',true,'1','1','1') from signup_fixture;raise exception 'FAIL: fuso inválido';exception when invalid_parameter_value then raise notice 'PASS: fuso validado';end;
 begin perform register_my_barbershop(request,'Teste','America/Sao_Paulo',null,true,'1','1','1') from signup_fixture;raise exception 'FAIL: sociedade nula';exception when invalid_parameter_value then raise notice 'PASS: sociedade validada';end;
end $$;
create temporary table signup_result as select register_my_barbershop(request,'Loja fictícia','Europe/Lisbon','equal',true,'1','1','1') result from signup_fixture;
select pg_temp.check_signup((select count(*)=1 from barbershops where founded_by_user_id=(select person from signup_fixture)),'Uma loja criada');
select pg_temp.check_signup((select timezone='Europe/Lisbon' and society_intent='equal' from barbershops where id=(select (result->>'shop_id')::uuid from signup_result)),'Fuso e intenção preservados');
select pg_temp.check_signup((select role='owner' and ownership_percent=100 and active from shop_members where id=(select (result->>'member_id')::uuid from signup_result)),'Dono e acesso corretos');
select pg_temp.check_signup((select dpa_version='1' and age_confirmed_at is not null from profiles where id=(select person from signup_fixture)),'Aceite gravado');
select pg_temp.check_signup((select whatsapp_verified_at is null from profiles where id=(select person from signup_fixture)),'Cadastro não confirma telefone');
select pg_temp.check_signup((select register_my_barbershop(request,'Nome alterado','America/Sao_Paulo','single',true,'1','1','1') from signup_fixture)=(select result from signup_result),'Repetição devolve a loja original mesmo após mudança de rascunho');
select pg_temp.check_signup((select count(*)=1 from shop_registration_requests where user_id=(select person from signup_fixture)),'Uma operação registrada');
update auth.users set email_confirmed_at=now() where id=(select other from signup_fixture);
select set_config('request.jwt.claim.sub',other::text,true) from signup_fixture;
select pg_temp.check_signup((select register_my_barbershop(request,'Outra loja','America/Sao_Paulo','single',true,'1','1','1')->>'shop_id' from signup_fixture)<>(select result->>'shop_id' from signup_result),'Outra conta não obtém resultado do primeiro titular');
select set_config('request.jwt.claim.sub',person::text,true) from signup_fixture;
select pg_temp.check_signup((select register_my_barbershop(gen_random_uuid(),'Segunda loja','America/Sao_Paulo','single',true,'1','1','1')->>'shop_id')<>(select result->>'shop_id' from signup_result),'Mesma conta pode criar outra loja com novo pedido');
