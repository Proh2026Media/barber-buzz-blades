-- Cenário local explícito de envios liberados; a migration nasce pausada.
update public.whatsapp_send_controls set paused=false where scope='global';
-- P-116: dados fictícios; executar dentro de BEGIN/ROLLBACK com a migration nº 101.
create temporary table wa116 as select gen_random_uuid() shop,gen_random_uuid() other_shop,
  gen_random_uuid() customer,gen_random_uuid() other_customer,gen_random_uuid() owner,
  gen_random_uuid() staff,gen_random_uuid() service,gen_random_uuid() appointment,
  '+55119'||lpad((floor(random()*100000000))::bigint::text,8,'0') phone;
grant select on wa116 to authenticated;
create function pg_temp.check_wa116(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
insert into auth.users(id,email,raw_user_meta_data)
select u,u||'@example.invalid','{}'::jsonb from wa116 c cross join lateral unnest(array[c.customer,c.other_customer,c.owner]) u;
insert into public.barbershops(id,name,slug)
select shop,'Loja fictícia','w116-'||shop from wa116 union all select other_shop,'Outra fictícia','w116-'||other_shop from wa116;
insert into public.staff(id,barbershop_id,display_name,user_id,booking_slug)
select staff,shop,'Profissional fictício',owner,'teste' from wa116;
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select shop,owner,staff,'owner',100 from wa116;
insert into public.services(id,barbershop_id,name,duration_minutes,price_cents)
select service,shop,'Corte fictício',30,1000 from wa116;
select set_config('request.jwt.claim.role','service_role',true);
select public.apply_verified_whatsapp(customer,phone,true) is not null from wa116;
select set_config('request.jwt.claim.role','',true);
insert into public.whatsapp_channels(barbershop_id,instance_name,status)
select shop,'teste-'||shop,'open'::public.whatsapp_channel_status from wa116 union all select other_shop,'teste-'||other_shop,'open' from wa116;

select pg_temp.check_wa116(not public.reserve_client_communication(shop,customer,'marketing','sem-aceite'),'Marketing sem aceite recusado') from wa116;
insert into public.customer_privacy(user_id,marketing,analytics) select customer,true,true from wa116;
select pg_temp.check_wa116(public.reserve_client_communication(shop,customer,'return','retorno'),'Primeiro retorno autorizado') from wa116;
select pg_temp.check_wa116(public.reserve_client_communication(shop,customer,'return','retorno'),'Mesma chave é idempotente') from wa116;
select pg_temp.check_wa116(not public.reserve_client_communication(shop,customer,'return','retorno2'),'Segundo retorno em sete dias recusado') from wa116;
select pg_temp.check_wa116(public.reserve_client_communication(other_shop,customer,'marketing','marketing'),'Segunda comunicação de outra loja autorizada') from wa116;
select pg_temp.check_wa116(not public.reserve_client_communication(shop,customer,'marketing','marketing3'),'Terceira comunicação recusada entre lojas') from wa116;
select pg_temp.check_wa116(not public.reserve_client_communication(shop,other_customer,'return','retorno'),'Chave não pode ser reaproveitada por outro cliente') from wa116;
update public.client_communication_budget set attempted_at=now()-interval '7 days 1 minute',expires_at=now()-interval '1 minute';
select pg_temp.check_wa116(public.reserve_client_communication(shop,customer,'return','nova-semana'),'Janela móvel libera após sete dias') from wa116;
delete from public.client_communication_budget;

-- Simula agendamento de teste sem o validador de horários comerciais (regra não alterada).
alter table public.appointments disable trigger user;
insert into public.appointments(id,barbershop_id,customer_id,staff_id,service_id,starts_at,ends_at,status)
select appointment,shop,customer,staff,service,now()+interval '2 days',now()+interval '2 days 30 minutes','confirmed' from wa116;
alter table public.appointments enable trigger user;
select pg_temp.check_wa116(not public.reserve_client_communication(shop,customer,'return','futuro'),'Convite de retorno bloqueado com próximo agendamento') from wa116;

select pg_temp.check_wa116(public.queue_appointment_whatsapp(appointment,'booking.confirmed') is not null,'Aviso transacional entra na fila') from wa116;
select pg_temp.check_wa116(public.queue_appointment_whatsapp(appointment,'booking.confirmed') is null,'Mesmo evento não duplica') from wa116;
select pg_temp.check_wa116(public.enqueue_whatsapp_message(shop,phone,'notice.shop_hello','Oferta','oferta',jsonb_build_object('customer_id',customer)) is not null,'Marketing com aceite entra na fila') from wa116;
select pg_temp.check_wa116(public.enqueue_whatsapp_message(shop,phone,'notice.slot_open','Vaga','vaga',jsonb_build_object('customer_id',customer)) is not null,'Segunda comunicação entra') from wa116;
select pg_temp.check_wa116(public.enqueue_whatsapp_message(shop,phone,'notice.shop_hello','Outra','terceira',jsonb_build_object('customer_id',customer)) is null,'Limite também vale no enfileirador direto') from wa116;
select pg_temp.check_wa116((select template_key='booking.confirmed' from public.claim_whatsapp_outbox(1)),'Aviso de agendamento tem prioridade') ;
select pg_temp.check_wa116((select public.prepare_whatsapp_delivery(id)->>'instance_name' like 'teste-%' from public.whatsapp_outbox where dedupe_key like 'booking.confirmed:%'),'Rota fixa preparada');
select pg_temp.check_wa116((select public.prepare_whatsapp_delivery(id) is null from public.whatsapp_outbox where dedupe_key like 'booking.confirmed:%'),'Preparação não pode ser repetida');
select public.complete_whatsapp_outbox(id,false,null,'Resultado incerto') from public.whatsapp_outbox where dedupe_key like 'booking.confirmed:%';
select pg_temp.check_wa116(not exists(select 1 from public.claim_whatsapp_outbox(20) where template_key='booking.confirmed'),'Envio incerto não volta à fila');
update public.customer_privacy set marketing=false;
select pg_temp.check_wa116((select public.prepare_whatsapp_delivery(id) is null from public.whatsapp_outbox where dedupe_key='oferta'),'Retirada do aceite antes do envio é respeitada');
update public.customer_privacy set marketing=true;
update public.profiles set whatsapp_opt_in_at=null from wa116 c where id=c.customer;
select pg_temp.check_wa116((select public.prepare_whatsapp_delivery(id) is null from public.whatsapp_outbox where dedupe_key='vaga'),'Retirada dos avisos WhatsApp antes do envio é respeitada');
update public.profiles set whatsapp_opt_in_at=now() from wa116 c where id=c.customer;

delete from public.whatsapp_outbox; delete from public.email_outbox; delete from public.client_communication_budget;
-- Roteamento administrativo: não permite reservas compartilhadas nem alteração por dono.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.check_wa116((public.configure_shop_whatsapp_delivery(shop,'reserva-ficticia','backup','technical_failure',false)->>'delivery_mode')='backup','Admin seleciona reserva por falha técnica') from wa116;
do $$ declare c record; denied boolean:=false; begin select * into c from wa116;
  begin perform public.configure_shop_whatsapp_delivery(c.other_shop,'reserva-ficticia','backup','technical_failure',false); exception when others then denied:=true; end;
  perform pg_temp.check_wa116(denied,'Reserva não pode servir outra loja');
  denied:=false;
  begin perform public.configure_shop_whatsapp_delivery(c.shop,'reserva-ficticia','backup','blocked',false); exception when others then denied:=true; end;
  perform pg_temp.check_wa116(denied,'Banimento não habilita reserva');
end $$;
select set_config('request.jwt.claim.sub',owner::text,true) from wa116;
do $$ declare c record; denied boolean:=false; begin select * into c from wa116;
  begin perform public.configure_shop_whatsapp_delivery(c.shop,'outra-reserva','backup','technical_failure',false); exception when insufficient_privilege then denied:=true; end;
  perform pg_temp.check_wa116(denied,'Dono não muda canais da plataforma');
  denied:=false;
  begin update public.whatsapp_channels set delivery_mode='primary' where barbershop_id=c.shop; exception when insufficient_privilege then denied:=true; end;
  perform pg_temp.check_wa116(denied,'UPDATE direto também protegido');
end $$;
select set_config('request.jwt.claim.sub','',true);
select public.queue_appointment_whatsapp(appointment,'booking.confirmed') from wa116;
select count(*) from public.claim_whatsapp_outbox(20);
select pg_temp.check_wa116((select public.prepare_whatsapp_delivery(id)->>'instance_name'='reserva-ficticia' from public.whatsapp_outbox where template_key='booking.confirmed'),'Avisos usam reserva explicitamente selecionada');
select public.defer_whatsapp_delivery(id) from public.whatsapp_outbox;
select pg_temp.check_wa116((select status='pending' and delivery_started_at is null from public.whatsapp_outbox),'Sem sendText, falha técnica pode ser adiada');

-- E-mail promocional respeita a preferência novamente antes do despacho.
delete from public.email_outbox;
delete from public.whatsapp_outbox;
select public.deliver_client_notice(shop,customer,'shop_hello',owner) from wa116;
select pg_temp.check_wa116((select count(*) from public.whatsapp_outbox)=1 and (select count(*) from public.email_outbox)=0,'Promoção usa um canal, sem cópia duplicada');
update public.whatsapp_channels set enabled=false;
select public.deliver_client_notice(shop,customer,'slot_open',owner) from wa116;
select pg_temp.check_wa116((select count(*) from public.email_outbox)=1,'E-mail alternativo usa o mesmo orçamento');
update public.customer_privacy set marketing=false;
select pg_temp.check_wa116(not exists(select 1 from public.claim_email_outbox(20)),'E-mail promocional não sai após retirada do aceite');

-- Retorno por histórico, sem efeito externo: só enfileira e deixa desligado por padrão.
delete from public.whatsapp_outbox; delete from public.email_outbox; delete from public.client_communication_budget;
update public.customer_privacy set marketing=true;
update public.whatsapp_channels set enabled=true,delivery_mode='primary',return_notice_enabled=true;
alter table public.appointments disable trigger user;
delete from public.appointments;
insert into public.appointments(barbershop_id,customer_id,staff_id,service_id,starts_at,ends_at,status)
select c.shop,c.customer,c.staff,c.service,now()-make_interval(days=>d),now()-make_interval(days=>d)+interval '30 minutes','completed'
from wa116 c cross join unnest(array[90,60,30]) d;
alter table public.appointments enable trigger user;
select pg_temp.check_wa116(public.process_whatsapp_return_notices()=1,'Histórico suficiente gera um convite de retorno');
select pg_temp.check_wa116(public.process_whatsapp_return_notices()=0,'Rodadas repetidas não duplicam retorno');
alter table public.appointments disable trigger user;
insert into public.appointments(barbershop_id,customer_id,staff_id,service_id,starts_at,ends_at,status)
select shop,customer,staff,service,now()+interval '2 days',now()+interval '2 days 30 minutes','confirmed' from wa116;
alter table public.appointments enable trigger user;
select count(*) from public.claim_whatsapp_outbox(20);
select pg_temp.check_wa116((select public.prepare_whatsapp_delivery(id) is null from public.whatsapp_outbox where template_key='notice.return_visit'),'Novo agendamento impede retorno já enfileirado');
select pg_temp.check_wa116(not has_function_privilege('authenticated','public.prepare_whatsapp_delivery(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.reserve_client_communication(uuid,uuid,text,text)','EXECUTE'),'Helpers privados');

-- Duas alterações reais do mesmo agendamento geram duas versões, sem duplicar a mesma.
delete from public.whatsapp_outbox; delete from public.email_outbox;
update wa116 set appointment=(select id from public.appointments where status='confirmed' limit 1);
select pg_temp.check_wa116(public.queue_appointment_whatsapp(appointment,'booking.rescheduled') is not null,'Primeira remarcação gera aviso') from wa116;
select pg_temp.check_wa116(public.queue_appointment_whatsapp(appointment,'booking.rescheduled') is null,'Repetir a mesma versão não duplica') from wa116;
set local session_replication_role=replica;
update public.appointments a set starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day',updated_at=now()+interval '1 second'
from wa116 c where a.id=c.appointment;
set local session_replication_role=origin;
select pg_temp.check_wa116(public.queue_appointment_whatsapp(appointment,'booking.rescheduled') is not null,'Nova remarcação não fica bloqueada pelo dedupe antigo') from wa116;
select count(*) from public.claim_whatsapp_outbox(20);
select pg_temp.check_wa116(public.prepare_whatsapp_delivery(o.id) is null,'Versão anterior de horário não é enviada')
from public.whatsapp_outbox o join wa116 c on true join public.appointments a on a.id=c.appointment
where (o.payload->>'starts_at')::timestamptz<>a.starts_at;
select pg_temp.check_wa116(public.prepare_whatsapp_delivery(o.id) is not null,'Versão atual é preparada normalmente')
from public.whatsapp_outbox o join wa116 c on true join public.appointments a on a.id=c.appointment
where (o.payload->>'starts_at')::timestamptz=a.starts_at;
