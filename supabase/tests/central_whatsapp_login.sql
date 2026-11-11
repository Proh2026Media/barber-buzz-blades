-- Cenário local explícito de envios liberados; a migration nasce pausada.
update public.whatsapp_send_controls set paused=false where scope='global';
-- P-117: dados fictícios; executar dentro de BEGIN/ROLLBACK com a migration nº 102.
create temporary table wa117 as select gen_random_uuid() shop,gen_random_uuid() other_shop,
  gen_random_uuid() customer,gen_random_uuid() other_customer,gen_random_uuid() owner,
  gen_random_uuid() staff,gen_random_uuid() service,gen_random_uuid() appointment,
  '+55119'||lpad((floor(random()*100000000))::bigint::text,8,'0') phone;
grant select on wa117 to authenticated;
create function pg_temp.check_wa117(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
insert into auth.users(id,email,raw_user_meta_data)
select u,u||'@example.invalid','{}'::jsonb from wa117 c cross join lateral unnest(array[c.customer,c.other_customer,c.owner]) u;
insert into public.barbershops(id,name,slug)
select shop,'Loja fictícia','w116-'||shop from wa117 union all select other_shop,'Outra fictícia','w116-'||other_shop from wa117;
insert into public.staff(id,barbershop_id,display_name,user_id,booking_slug)
select staff,shop,'Profissional fictício',owner,'teste' from wa117;
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select shop,owner,staff,'owner',100 from wa117;
insert into public.services(id,barbershop_id,name,duration_minutes,price_cents)
select service,shop,'Corte fictício',30,1000 from wa117;
select set_config('request.jwt.claim.role','service_role',true);
select public.apply_verified_whatsapp(customer,phone,true) is not null from wa117;
select set_config('request.jwt.claim.role','',true);
insert into public.whatsapp_channels(barbershop_id,instance_name,status)
select shop,'teste-'||shop,'open'::public.whatsapp_channel_status from wa117 union all select other_shop,'teste-'||other_shop,'open' from wa117;

-- RPCs públicas não dão acesso a anônimos; consumidor OTP somente service_role.
select pg_temp.check_wa117(not has_function_privilege('anon','public.platform_whatsapp_directory()','execute'),'Anônimo não acessa inventário');
select pg_temp.check_wa117(not has_function_privilege('authenticated','public.request_whatsapp_login(text,text)','execute'),'Cliente não cria desafio diretamente');
select set_config('request.jwt.claim.sub',owner::text,true) from wa117;
do $$ begin
  begin perform public.platform_whatsapp_directory(); raise exception 'FAIL: dono acessou central';
  exception when insufficient_privilege then raise notice 'PASS: dono não acessa central'; end;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
alter table wa117 add column channel uuid default gen_random_uuid();
select pg_temp.check_wa117(public.platform_create_whatsapp_channel(channel,'Canal fictício')=channel,'Admin cadastra canal livre') from wa117;
select pg_temp.check_wa117(public.platform_create_whatsapp_channel(channel,'Canal fictício')=channel,'Repetição da criação é idempotente') from wa117;
select pg_temp.check_wa117((select not enabled and barbershop_id is null from public.whatsapp_channels where id=channel),'Novo canal começa livre e sem avisos') from wa117;
select pg_temp.check_wa117((public.platform_assign_whatsapp_channel(channel,0,shop,staff,true)->>'staff_id')=staff::text,'Distribuição ao profissional da loja') from wa117;
select pg_temp.check_wa117(public.whatsapp_route_channel(shop,jsonb_build_object('staff_id',staff))=channel,'Canal específico tem prioridade') from wa117;
select pg_temp.check_wa117(public.whatsapp_route_channel(other_shop,jsonb_build_object('staff_id',staff))<>channel,'Profissional de outra loja não desvia rota') from wa117;
select pg_temp.check_wa117(public.whatsapp_route_channel(shop,'{}')<>channel,'Aviso geral permanece no canal da loja') from wa117;
select pg_temp.check_wa117((select whatsapp_e164=phone from public.profiles where id=customer),'Distribuição não muda telefone pessoal') from wa117;
do $$ declare c record; begin select * into c from wa117;
  begin perform public.platform_assign_whatsapp_channel(c.channel,0,c.shop,c.staff,true); raise exception 'FAIL: versão antiga aceita';
  exception when serialization_failure then raise notice 'PASS: versão antiga recusada'; end;
  begin perform public.platform_assign_whatsapp_channel(c.channel,1,c.other_shop,c.staff,true); raise exception 'FAIL: profissional de outra loja aceito';
  exception when invalid_parameter_value then raise notice 'PASS: profissional de outra loja recusado'; end;
  begin perform public.platform_assign_whatsapp_channel(c.channel,1,c.shop,null,true); raise exception 'FAIL: destino ocupado aceito';
  exception when unique_violation then raise notice 'PASS: destino ocupado recusado'; end;
end $$;
-- Nenhum envio; insere aviso fictício e transfere o canal para inventário livre.
select pg_temp.check_wa117(public.enqueue_whatsapp_message(shop,phone,'customer.notice','Teste','central-1',jsonb_build_object('customer_id',customer,'staff_id',staff)) is not null,'Aviso vinculado ao canal próprio') from wa117;
select pg_temp.check_wa117((select channel_id=channel from public.whatsapp_outbox where dedupe_key='central-1'),'Fila preserva canal escolhido') from wa117;
select pg_temp.check_wa117((public.platform_assign_whatsapp_channel(channel,1,null,null,false)->>'barbershop_id') is null,'Canal retorna ao inventário') from wa117;
select pg_temp.check_wa117((select status='failed' and delivery_started_at is null from public.whatsapp_outbox where dedupe_key='central-1'),'Transferência cancela fila sem envio') from wa117;
select pg_temp.check_wa117((select count(*)=2 from public.whatsapp_channel_movements where channel_id=(select channel from wa117)),'Movimentos auditados');
select pg_temp.check_wa117((public.platform_assign_whatsapp_channel(channel,2,shop,staff,true)->>'enabled')='true','Canal pode ser atribuído novamente') from wa117;
select public.enqueue_whatsapp_message(shop,phone,'customer.notice','Teste','central-2',jsonb_build_object('customer_id',customer,'staff_id',staff)) from wa117;
update public.whatsapp_outbox set status='sending' where dedupe_key='central-2';
do $$ declare c record; begin select * into c from wa117;
  begin perform public.platform_assign_whatsapp_channel(c.channel,3,null,null,false); raise exception 'FAIL: transferiu durante envio';
  exception when object_not_in_prerequisite_state then raise notice 'PASS: envio em curso bloqueia transferência'; end;
end $$;
select pg_temp.check_wa117((select public.prepare_whatsapp_delivery(id)->>'instance_name'='bc-'||channel from public.whatsapp_outbox where dedupe_key='central-2'),'Preparação respeita canal profissional') from wa117;
update public.whatsapp_outbox set status='failed' where dedupe_key='central-2';
do $$ declare c record; begin select * into c from wa117;
  begin perform public.platform_assign_whatsapp_channel(c.channel,3,null,null,false); raise exception 'FAIL: transferiu envio incerto';
  exception when object_not_in_prerequisite_state then raise notice 'PASS: envio incerto bloqueia transferência'; end;
end $$;
-- UPDATE direto não pula auditoria, mesmo com papel admin.
set local role authenticated;
do $$ declare c record; begin select * into c from wa117;
  begin update public.whatsapp_channels set staff_id=null where id=c.channel; raise exception 'FAIL: UPDATE contornou central';
  exception when insufficient_privilege then raise notice 'PASS: admin direto não pula auditoria'; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
-- Login: só número verificado, desafio global e atômico, último código, limite real no servidor.
select pg_temp.check_wa117(public.request_whatsapp_login(phone,repeat('a',64))->>'user_id'=customer::text,'Login reconhece número verificado') from wa117;
do $$ declare c record; begin select * into c from wa117;
  begin perform public.request_whatsapp_login(c.phone,repeat('b',64)); raise exception 'FAIL: repetiu sem espera';
  exception when raise_exception then if SQLERRM<>'WA_RATE_LIMIT' then raise; end if; raise notice 'PASS: espera de 60 segundos no banco'; end;
end $$;
update public.auth_otp_challenges set created_at=now()-interval '61 seconds' where destination=(select phone from wa117);
select public.request_whatsapp_login(phone,repeat('b',64)) from wa117;
select pg_temp.check_wa117(not exists(select 1 from public.auth_otp_check_code(null,phone,'whatsapp','login',repeat('a',64),5)),'Código anterior invalidado no reenvio') from wa117;
select pg_temp.check_wa117(exists(select 1 from public.auth_otp_check_code(null,phone,'whatsapp','login',repeat('b',64),5)),'Último código aceito') from wa117;
select pg_temp.check_wa117(not exists(select 1 from public.auth_otp_check_code(null,phone,'whatsapp','login',repeat('b',64),5)),'Código consumido não pode ser repetido') from wa117;
update public.auth_otp_challenges set created_at=now()-interval '61 seconds' where destination=(select phone from wa117);
select public.request_whatsapp_login(phone,repeat('c',64)) from wa117;
update public.auth_otp_challenges set created_at=now()-interval '61 seconds' where destination=(select phone from wa117);
do $$ declare c record; begin select * into c from wa117;
  begin perform public.request_whatsapp_login(c.phone,repeat('d',64)); raise exception 'FAIL: quarto pedido aceito';
  exception when raise_exception then if SQLERRM<>'WA_RATE_LIMIT' then raise; end if; raise notice 'PASS: máximo três pedidos em 15 minutos'; end;
end $$;
select * from public.auth_otp_check_code(null,(select phone from wa117),'whatsapp','login',repeat('f',64),5);
select * from public.auth_otp_check_code(null,(select phone from wa117),'whatsapp','login',repeat('f',64),5);
select * from public.auth_otp_check_code(null,(select phone from wa117),'whatsapp','login',repeat('f',64),5);
select * from public.auth_otp_check_code(null,(select phone from wa117),'whatsapp','login',repeat('f',64),5);
select * from public.auth_otp_check_code(null,(select phone from wa117),'whatsapp','login',repeat('f',64),5);
select pg_temp.check_wa117(not exists(select 1 from public.auth_otp_check_code(null,phone,'whatsapp','login',repeat('c',64),5)),'Cinco erros invalidam o código') from wa117;
select pg_temp.check_wa117(public.request_whatsapp_login('+5511888888888',repeat('e',64))->>'user_id' is null,'Número desconhecido também grava desafio sem conta');
