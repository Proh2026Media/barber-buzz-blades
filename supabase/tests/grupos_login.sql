-- Somente dados fictícios, BEGIN/ROLLBACK no banco local com a migration nº 105.
create temporary table wa120 as select gen_random_uuid() shop,gen_random_uuid() other_shop,
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

-- P-120: nenhum teste transmite mensagens, todas as respostas externas são fictícias.
select pg_temp.check_wa120(not (select login_enabled from public.whatsapp_group_settings),'Login por grupo nasce desligado');
select pg_temp.check_wa120(not has_table_privilege('authenticated','public.whatsapp_group_login_routes','select'),'Vínculos dos desafios não são públicos');
select pg_temp.check_wa120(not has_function_privilege('authenticated','public.whatsapp_group_login_context(uuid,text,boolean)','execute'),'Usuário não consulta destino do desafio');
select pg_temp.check_wa120(not has_function_privilege('service_role','public.authorize_care_group_step_before_exclusive(uuid,uuid,text)','execute'),'Serviço não contorna proteção chamando autorização antiga');
select pg_temp.check_wa120(not has_function_privilege('service_role','public.authorize_whatsapp_send_before_exclusive(text,uuid,uuid,uuid,text,text)','execute'),'Serviço não acessa emissor individual legado');
select set_config('request.jwt.claim.sub',owner::text,true) from wa120;
do $$ begin
 begin perform public.care_group_read((select shop from wa120),(select customer from wa120)); raise exception 'FAIL: dono leu ficha';
 exception when insufficient_privilege then raise notice 'PASS: dono não lê grupo de cliente'; end;
 begin perform public.care_group_admin('propose_participant','{}'); raise exception 'FAIL: proposta';
 exception when insufficient_privilege then raise notice 'PASS: proposta comercial bloqueada'; end;
 begin update public.whatsapp_care_participants set revoked_at=null; raise exception 'FAIL: reativou profissional';
 exception when insufficient_privilege then raise notice 'PASS: escrita direta não reativa profissional'; end;
end $$;
select set_config('request.jwt.claim.sub','',true);
update public.whatsapp_care_groups set account_id=(select id from public.whatsapp_group_accounts limit 1),
 group_jid='12345-67890@g.us',state='active',controls_verified=true,entry_pending=false,use_group=true,reason='verified';
update public.whatsapp_group_settings set login_enabled=true;
create temporary table group_challenge as select public.request_whatsapp_group_login(phone,repeat('a',64),gen_random_uuid()) result from wa120;
create temporary table group_context as select public.whatsapp_group_login_context((result->>'challenge_id')::uuid,repeat('a',64)) context from group_challenge;
select pg_temp.check_wa120(context->>'group_jid'='12345-67890@g.us' and context->>'customer_phone'=(select phone from wa120),'Servidor resolve somente grupo do titular') from group_context;
select pg_temp.check_wa120(public.authorize_whatsapp_group_login((select (result->>'challenge_id')::uuid from group_challenge),repeat('a',64),context||'{"group_jid":"999@g.us"}') is null,'Destino alterado não recebe autorização') from group_context;
select pg_temp.check_wa120(public.authorize_whatsapp_send('teste-'||(select shop from wa120),p_challenge_id=>(result->>'challenge_id')::uuid,p_instance=>'teste-'||(select shop from wa120),p_code_hash=>repeat('a',64))->>'reason'='group_required','OTP não pode sair pelo transporte individual') from group_challenge;
-- Pausa/versão/identidade revalidadas depois da consulta externa.
do $$ declare id uuid; begin select (result->>'challenge_id')::uuid into id from group_challenge;
 begin update public.whatsapp_care_groups set version=version+1;
 perform pg_temp.check_wa120(public.whatsapp_group_login_context(id,repeat('a',64)) is null,'Mudança de versão invalida o desafio');
 raise exception 'reverter'; exception when raise_exception then if sqlerrm<>'reverter' then raise; end if; end;
 begin update public.whatsapp_group_accounts set enabled=false;
 perform pg_temp.check_wa120(public.whatsapp_group_login_context(id,repeat('a',64)) is null,'Revogar número bloqueia código');
 raise exception 'reverter'; exception when raise_exception then if sqlerrm<>'reverter' then raise; end if; end;
 begin update public.whatsapp_care_groups set state='customer_left';
 perform pg_temp.check_wa120(public.whatsapp_group_login_context(id,repeat('a',64)) is null,'Saída do cliente bloqueia código');
 raise exception 'reverter'; exception when raise_exception then if sqlerrm<>'reverter' then raise; end if; end;
end $$;
create temporary table group_permit as select public.authorize_whatsapp_group_login((result->>'challenge_id')::uuid,repeat('a',64),(select context from group_context)) permit from group_challenge;
select pg_temp.check_wa120(permit ? 'attempt_id' and permit->>'group_jid'='12345-67890@g.us' and not (permit ? 'to_e164'),'Licença contém grupo e tentativa, sem destino privado') from group_permit;
select pg_temp.check_wa120(public.authorize_whatsapp_group_login((result->>'challenge_id')::uuid,repeat('a',64),(select context from group_context)) is null,'Mesmo desafio não transmite duas vezes') from group_challenge;
select public.finish_whatsapp_send((permit->>'attempt_id')::uuid,null) from group_permit;
select pg_temp.check_wa120((select state='unknown' from public.whatsapp_send_attempts where id=(permit->>'attempt_id')::uuid),'Timeout mantém resultado desconhecido sem retry') from group_permit;
select pg_temp.check_wa120(public.check_whatsapp_group_login(phone,repeat('a',64))->>'user_id'=customer::text,'Código do grupo confirma a mesma conta') from wa120;
select pg_temp.check_wa120(public.check_whatsapp_group_login(phone,repeat('a',64)) is null,'Código consumido não abre outra sessão') from wa120;
select pg_temp.check_wa120(not has_function_privilege('authenticated','public.check_whatsapp_group_login(text,text)','execute'),'Verificação restrita ao serviço');
