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


select pg_temp.check_wa120(public.whatsapp_sending_paused(null,false),'Instalação nasce pausada');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.set_whatsapp_send_pause('global',false,'resumed',1);
select pg_temp.check_wa120(not public.whatsapp_sending_paused(null,false),'Admin retoma explicitamente');
select pg_temp.check_wa120((select count(*)=1 from public.whatsapp_send_control_history),'Mudança deixa trilha sem conteúdo');
do $$ begin
  begin perform public.set_whatsapp_send_pause('global',true,'review',1); raise exception 'FAIL: versão antiga aceita';
  exception when raise_exception then if sqlerrm not like '%WA_STALE%' then raise; end if; end;
  raise notice 'PASS: alteração concorrente recusada por versão';
end $$;
select set_config('request.jwt.claim.sub',owner::text,true) from wa120;
do $$ begin
  begin perform public.set_whatsapp_send_pause('global',true,'review',2); raise exception 'FAIL: dono pausou plataforma';
  exception when insufficient_privilege then raise notice 'PASS: dono não altera pausa global'; end;
end $$;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.check_wa120(not has_function_privilege('authenticated','public.authorize_whatsapp_send(text,uuid,uuid,uuid,text,text)','execute'),'Cliente não autoriza transmissão');
select pg_temp.check_wa120(not has_function_privilege('service_role','public.prepare_whatsapp_delivery(uuid)','execute'),'Worker antigo não ignora a nova autorização');
select pg_temp.check_wa120(not has_table_privilege('authenticated','public.whatsapp_send_attempts','select'),'Tentativas de código não ficam visíveis ao lojista');

create temporary table challenge as select (public.request_whatsapp_login(phone,repeat('a',64))->>'challenge_id')::uuid id from wa120;
do $$ declare c record; begin select * into c from wa120;
  begin insert into public.auth_otp_challenges(channel,destination,code_hash,purpose,expires_at)
    values('whatsapp',c.phone,repeat('b',64),'signup',now()+interval '10 minutes'); raise exception 'FAIL: outra finalidade contornou limite';
  exception when raise_exception then if sqlerrm not like '%WA_RATE_LIMIT%' then raise; end if; end;
  raise notice 'PASS: limite atômico compartilhado entre cadastro e login';
end $$;
select pg_temp.check_wa120(public.whatsapp_send_candidate(p_challenge_id=>id,p_instance=>'plataforma-teste',p_code_hash=>repeat('b',64)) is null,'Código de outro pedido não ganha licença') from challenge;
select pg_temp.check_wa120(public.authorize_whatsapp_send('plataforma-teste',p_challenge_id=>id,p_instance=>'plataforma-teste',p_code_hash=>repeat('a',64))->>'reason'='group_required','Emissor individual recusa OTP') from challenge;
-- Registro fictício de transmissão já iniciada: testa finalização sem chamar provedor.
create temporary table license as with inserted as (
  insert into public.whatsapp_send_attempts(challenge_id,instance_name) select id,'plataforma-teste' from challenge returning id
) select jsonb_build_object('attempt_id',id) permit from inserted;
select public.finish_whatsapp_send((permit->>'attempt_id')::uuid,null) from license;
select pg_temp.check_wa120((select state='unknown' from public.whatsapp_send_attempts where challenge_id=c.id),'Timeout conserva resultado desconhecido') from challenge c;
select pg_temp.check_wa120((select consumed_at is null from public.auth_otp_challenges where id=c.id),'Código possivelmente entregue continua válido') from challenge c;
select pg_temp.check_wa120((select count(*)=1 from public.auth_otp_check_code(null,(select phone from wa120),'whatsapp','login',repeat('a',64),5)),'Código válido consumido uma vez');
select pg_temp.check_wa120((select count(*)=0 from public.auth_otp_check_code(null,(select phone from wa120),'whatsapp','login',repeat('a',64),5)),'Reuso do código recusado');
select public.finish_whatsapp_send((permit->>'attempt_id')::uuid,'id-teste') from license;
select public.finish_whatsapp_send((permit->>'attempt_id')::uuid,null) from license;
select pg_temp.check_wa120((select state='accepted' and provider_message_id='id-teste' from public.whatsapp_send_attempts where id=(permit->>'attempt_id')::uuid),'Resultado atrasado não regride aceite conhecido') from license;

-- Fila: perda da posse, pausa entre prévia e licença, desistência e resultado desconhecido.
alter table public.appointments disable trigger user;
insert into public.appointments(id,barbershop_id,customer_id,staff_id,service_id,starts_at,ends_at,status)
select appointment,shop,customer,staff,service,now()+interval '2 days',now()+interval '2 days 30 minutes','confirmed' from wa120;
alter table public.appointments enable trigger user;
select public.queue_appointment_whatsapp(appointment,'booking.confirmed') from wa120;
create temporary table claimed as select id,lease_token from public.claim_whatsapp_outbox(1);
select pg_temp.check_wa120((select count(*)=1 from claimed),'Worker reserva um aviso');
select pg_temp.check_wa120(public.whatsapp_send_candidate(p_outbox_id=>id,p_lease_token=>gen_random_uuid()) is null,'Posse incorreta bloqueada') from claimed;
update public.whatsapp_outbox set lease_until=now()-interval '1 minute' where id in(select id from claimed);
create temporary table reclaimed as select id,lease_token from public.claim_whatsapp_outbox(1);
select pg_temp.check_wa120(public.whatsapp_send_candidate(p_outbox_id=>id,p_lease_token=>lease_token) is null,'Worker antigo não transmite após recuperação') from claimed;
select pg_temp.check_wa120((select count(*)=1 from reclaimed),'Reinício antes de licença permite recuperação');
select public.defer_whatsapp_send(id,lease_token) from claimed;
select pg_temp.check_wa120((select status='sending' from public.whatsapp_outbox where id=c.id),'Worker antigo não adia posse nova') from reclaimed c;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.set_whatsapp_send_pause('global',true,'restriction',2);
select pg_temp.check_wa120(public.authorize_whatsapp_send('teste-'||(select shop from wa120),p_outbox_id=>id,p_lease_token=>lease_token)->>'reason'='unavailable','Pausa após prévia impede transmissão') from reclaimed;
select public.set_whatsapp_send_pause('global',false,'resumed',3);
select public.set_whatsapp_send_pause(id::text,true,'restriction',0) from public.whatsapp_channels where barbershop_id=(select shop from wa120);
select pg_temp.check_wa120(public.whatsapp_send_candidate(p_outbox_id=>id,p_lease_token=>lease_token) is null,'Pausa do número alcança os avisos vinculados') from reclaimed;
select public.set_whatsapp_send_pause(id::text,false,'resumed',1) from public.whatsapp_channels where barbershop_id=(select shop from wa120);
update public.profiles set whatsapp_opt_in_at=null where id=(select customer from wa120);
select pg_temp.check_wa120(public.authorize_whatsapp_send('teste-'||(select shop from wa120),p_outbox_id=>id,p_lease_token=>lease_token) is null,'Descadastro pendente respeitado antes de transmitir') from reclaimed;
select pg_temp.check_wa120(not exists(select 1 from public.whatsapp_send_attempts where outbox_id in(select id from reclaimed)),'Descadastro não cria tentativa externa');
update public.profiles set whatsapp_opt_in_at=now() where id=(select customer from wa120);
select public.enqueue_whatsapp_message(shop,phone,'booking.reminder','Lembrete fictício','wa120-segundo',jsonb_build_object('appointment_id',appointment,'customer_id',customer)) from wa120;
create temporary table next_job as select id,lease_token from public.claim_whatsapp_outbox(1);
create temporary table next_license as select public.authorize_whatsapp_send('teste-'||(select shop from wa120),p_outbox_id=>id,p_lease_token=>lease_token) permit from next_job;
select pg_temp.check_wa120(permit ? 'attempt_id','Aviso válido recebe licença') from next_license;
-- Simula processo morto depois da licença, inclusive antes de registrar resposta.
update public.whatsapp_send_attempts set started_at=now()-interval '3 minutes' where outbox_id in(select id from next_job);
update public.whatsapp_outbox set lease_until=now()-interval '1 minute' where id in(select id from next_job);
select pg_temp.check_wa120(not exists(select 1 from public.claim_whatsapp_outbox(5) where id in(select id from next_job)),'Reinício após licença não repete mensagem');
select pg_temp.check_wa120((select state='unknown' from public.whatsapp_send_attempts where outbox_id in(select id from next_job)),'Tentativa abandonada preserva incerteza');
select public.defer_whatsapp_send(id,lease_token) from next_job;
select pg_temp.check_wa120((select delivery_started_at is not null from public.whatsapp_outbox where id in(select id from next_job)),'Não apaga evidência de transmissão ao adiar');
select pg_temp.check_wa120((public.whatsapp_send_dashboard()->>'unknown_24h')::integer>=1,'Painel apresenta incerteza real');

-- Replay tardio do mesmo pedido não substitui o desafio ainda válido.
update public.auth_otp_challenges set created_at=now()-interval '2 minutes' where destination=(select phone from wa120);
create temporary table request_once as select gen_random_uuid() id;
select public.request_whatsapp_login_once((select phone from wa120),repeat('b',64),(select id from request_once));
update public.auth_otp_challenges set created_at=now()-interval '2 minutes' where request_id=(select id from request_once);
do $$ begin
  begin perform public.request_whatsapp_login_once((select phone from wa120),repeat('c',64),(select id from request_once)); raise exception 'FAIL: replay tardio aceito';
  exception when raise_exception then if sqlerrm not like '%WA_RATE_LIMIT%' then raise; end if; end;
  raise notice 'PASS: pedido repetido depois de 60 segundos continua deduplicado';
end $$;
select pg_temp.check_wa120((select code_hash=repeat('b',64) and consumed_at is null from public.auth_otp_challenges where request_id=(select id from request_once)),'Replay não invalida o código que o usuário digita');
select pg_temp.check_wa120((select count(*)=0 from public.auth_otp_check_code(null,(select phone from wa120),'email','login',repeat('b',64),5)),'Código de outro canal não confirma o telefone');
select pg_temp.check_wa120((select count(*)=0 from public.auth_otp_check_code(null,(select phone from wa120),'whatsapp','recovery',repeat('b',64),5)),'Código de outra finalidade não abre sessão');
update public.auth_otp_challenges set expires_at=now()-interval '1 second' where request_id=(select id from request_once);
select pg_temp.check_wa120((select count(*)=0 from public.auth_otp_check_code(null,(select phone from wa120),'whatsapp','login',repeat('b',64),5)),'Código expirado recusado no servidor');
-- Falhas persistentes pedem revisão, sem rotular a causa como bloqueio da Meta.
insert into public.whatsapp_send_attempts(challenge_id,instance_name,state,started_at) select gen_random_uuid(),'plataforma-falhas','unknown',now()-interval '1 minute' from generate_series(1,3);
insert into public.auth_otp_challenges(channel,destination,code_hash,purpose,expires_at)
 values('whatsapp','+5511999998888',repeat('d',64),'signup',now()+interval '10 minutes');
select pg_temp.check_wa120(public.authorize_whatsapp_send('plataforma-falhas',p_challenge_id=>id,p_instance=>'plataforma-falhas',p_code_hash=>repeat('d',64))->>'reason'='group_required','Cadastro também não transmite OTP individual') from public.auth_otp_challenges where destination='+5511999998888';

select pg_temp.check_wa120(not exists(select 1 from public.whatsapp_send_attempts where challenge_id in(select id from public.auth_otp_challenges where destination='+5511999998888')),'Circuito não cria transmissão adicional');
