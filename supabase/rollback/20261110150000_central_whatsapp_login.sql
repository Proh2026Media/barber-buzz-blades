-- P-117: executar apenas pelo roteiro TI, sem apagar inventário, desafios ou auditoria.
-- Recusa reversão com canais profissionais em uso: nº101 usa somente o geral da loja.
do $$ begin
 if exists(select 1 from public.whatsapp_channels where staff_id is not null and enabled) then
   raise exception 'Pausar e revisar canais profissionais antes da reversão'; end if;
 if exists(select 1 from public.whatsapp_outbox where status='sending') then
   raise exception 'Aguardar os envios antes da reversão'; end if;
end $$;
drop function public.platform_whatsapp_directory();
drop function public.platform_create_whatsapp_channel(uuid,text);
drop function public.platform_assign_whatsapp_channel(uuid,bigint,uuid,uuid,boolean);
drop function public.request_whatsapp_login(text,text);
create or replace function public.enqueue_whatsapp_message(
  p_shop_id uuid,p_to_e164 text,p_template_key text,p_body text,p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb,p_scheduled_at timestamptz default now()
) returns uuid language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_channels%rowtype; message_id uuid; recipient uuid;
  kind text:=public.whatsapp_message_kind(p_template_key); event_key text;
begin
  if p_to_e164 is null or p_to_e164 !~ '^\+[1-9][0-9]{7,14}$' then return null; end if;
  if not public.whatsapp_recipient_allowed(p_shop_id,p_to_e164,p_payload) then return null; end if;
  if p_body is null or length(trim(p_body))=0 or p_dedupe_key is null then return null; end if;
  if exists(select 1 from public.whatsapp_outbox where dedupe_key=p_dedupe_key) then return null; end if;
  -- Canal fixo da loja. Não procurar qualquer outro canal nem alternar por mensagem.
  select * into c from public.whatsapp_channels where barbershop_id=p_shop_id and staff_id is null;
  if c.id is null or not c.enabled or c.delivery_mode='paused' then return null; end if;
  if p_template_key='booking.reminder' and not c.notify_reminder then return null; end if;
  if p_template_key in ('booking.confirmed','booking.cancelled','booking.rescheduled') and not c.notify_booking then return null; end if;
  if kind<>'transactional' then
    recipient:=public.whatsapp_recipient(p_shop_id,p_payload);
    event_key:=coalesce(nullif(p_payload->>'communication_key',''),p_dedupe_key);
    if coalesce(p_scheduled_at,now())>now()+interval '24 hours' then return null; end if;
    if not public.reserve_client_communication(p_shop_id,recipient,kind,event_key) then return null; end if;
  end if;
  insert into public.whatsapp_outbox(barbershop_id,to_e164,template_key,body,payload,dedupe_key,scheduled_at,channel_id,communication_key)
    values(p_shop_id,p_to_e164,p_template_key,p_body,coalesce(p_payload,'{}'),p_dedupe_key,coalesce(p_scheduled_at,now()),c.id,event_key)
    on conflict(dedupe_key) do nothing returning id into message_id;
  return message_id;
end $$;


create or replace function public.prepare_whatsapp_delivery(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_outbox%rowtype; c public.whatsapp_channels%rowtype;
  b public.client_communication_budget%rowtype; recipient uuid; instance text; appt public.appointments%rowtype;
begin
  select * into o from public.whatsapp_outbox where id=p_id for update;
  if o.id is null or o.status<>'sending' or o.delivery_started_at is not null then return null; end if;
  if not public.whatsapp_recipient_allowed(o.barbershop_id,o.to_e164,o.payload) then
    update public.whatsapp_outbox set status='failed',error='Preferência ou destinatário alterado' where id=p_id; return null;
  end if;
  begin
    select * into appt from public.appointments where id=nullif(o.payload->>'appointment_id','')::uuid and barbershop_id=o.barbershop_id;
  exception when invalid_text_representation then
    update public.whatsapp_outbox set status='failed',error='Aviso com referência inválida' where id=p_id; return null; end;
  if appt.id is not null and (
    (o.template_key in ('booking.confirmed','booking.rescheduled','booking.reminder','notice.reminder_next','notice.confirm_today') and (appt.status not in ('pending','confirmed') or appt.starts_at<=now()))
    or (o.template_key='booking.cancelled' and appt.status<>'cancelled')
    or (o.payload ? 'starts_at' and (o.payload->>'starts_at')::timestamptz<>appt.starts_at)
  ) then
    update public.whatsapp_outbox set status='failed',error='Agendamento alterado; aviso anterior descartado' where id=p_id; return null;
  end if;
  select * into c from public.whatsapp_channels where id=o.channel_id and barbershop_id=o.barbershop_id;
  if c.id is null then
    select * into c from public.whatsapp_channels where barbershop_id=o.barbershop_id and staff_id is null;
  end if;
  if c.id is null or not c.enabled or c.delivery_mode='paused'
     or (o.template_key='booking.reminder' and not c.notify_reminder)
     or (o.template_key in ('booking.confirmed','booking.cancelled','booking.rescheduled') and not c.notify_booking) then
    update public.whatsapp_outbox set status='failed',error='Canal pausado ou aviso desativado' where id=p_id; return null;
  end if;
  instance:=case when c.delivery_mode='backup' and c.delivery_reason='technical_failure' then c.backup_instance_name
                 when c.delivery_mode='primary' then c.instance_name end;
  if instance is null then update public.whatsapp_outbox set status='failed',error='Rota não configurada' where id=p_id; return null; end if;
  if public.whatsapp_message_kind(o.template_key)<>'transactional' then
    recipient:=public.whatsapp_recipient(o.barbershop_id,o.payload);
    if recipient is null then update public.whatsapp_outbox set status='failed',error='Destinatário não identificado' where id=p_id; return null; end if;
    perform pg_advisory_xact_lock(hashtextextended(recipient::text,116));
    select * into b from public.client_communication_budget where event_key=o.communication_key;
    if b.event_key is null or b.expires_at<=now()
       or (b.kind='return' and (not c.return_notice_enabled or not exists(select 1 from public.customer_privacy where user_id=recipient and analytics)))
       or not exists(select 1 from public.customer_privacy where user_id=recipient and marketing)
       or (b.kind='return' and exists(select 1 from public.appointments where barbershop_id=o.barbershop_id and customer_id=recipient and status in ('pending','confirmed') and starts_at>now())) then
      update public.whatsapp_outbox set status='failed',error='Comunicação expirada, recusada ou sem necessidade' where id=p_id; return null;
    end if;
    -- Conta pela tentativa efetiva, não pela virada do calendário.
    if b.attempted_at is null and (select count(*) from public.client_communication_budget where customer_id=recipient
      and event_key<>b.event_key and attempted_at>now()-interval '7 days')>=2 then
      update public.whatsapp_outbox set status='failed',error='Limite de comunicações atingido' where id=p_id; return null;
    end if;
    update public.client_communication_budget set attempted_at=coalesce(attempted_at,now()) where event_key=b.event_key;
  end if;
  update public.whatsapp_outbox set delivery_started_at=now(),delivery_instance=instance,channel_id=c.id where id=p_id;
  return jsonb_build_object('instance_name',instance,'to_e164',o.to_e164,'body',o.body);
end $$;
revoke all on function public.prepare_whatsapp_delivery(uuid) from public,anon,authenticated;
grant execute on function public.prepare_whatsapp_delivery(uuid) to service_role;


drop function public.whatsapp_route_channel(uuid,jsonb);
-- Mantém colunas e trigger de proteção; não reaplicar nº102 sem migration de avanço.
