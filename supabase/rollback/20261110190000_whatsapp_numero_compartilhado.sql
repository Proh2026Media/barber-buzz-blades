-- Reversão nº 104/P-119: aplicar em transação, sem apagar histórico.
-- Primeiro remover explicitamente os vínculos extras e resolver os envios incertos.
do $$ begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 if exists(select 1 from public.whatsapp_number_links where removed_at is null group by channel_id having count(*)>1) then
   raise exception 'Há números compartilhados. Retire os vínculos extras antes da reversão.';
 end if;
 if exists(select 1 from public.whatsapp_outbox where status='sending' or (status='failed' and delivery_started_at is not null and provider_message_id is null)) then
   raise exception 'Há envio em andamento ou resultado incerto. Conferir antes da reversão.';
 end if;
end $$;
drop trigger whatsapp_detach_shop on public.barbershops;
drop trigger whatsapp_detach_staff on public.staff;
drop trigger whatsapp_legacy_preferences on public.whatsapp_channels;
CREATE OR REPLACE FUNCTION public.whatsapp_route_channel(p_shop uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare professional uuid; result uuid;
begin
  if nullif(p_payload->>'appointment_id','') is not null then
    select staff_id into professional from public.appointments
      where id=(p_payload->>'appointment_id')::uuid and barbershop_id=p_shop;
  elsif nullif(p_payload->>'staff_id','') is not null then
    select id into professional from public.staff where id=(p_payload->>'staff_id')::uuid and barbershop_id=p_shop and active;
  end if;
  if professional is not null then
    select id into result from public.whatsapp_channels where barbershop_id=p_shop and staff_id=professional;
  end if;
  if result is null then select id into result from public.whatsapp_channels where barbershop_id=p_shop and staff_id is null; end if;
  return result;
exception when invalid_text_representation then return null;
end $function$
;
CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_message(p_shop_id uuid, p_to_e164 text, p_template_key text, p_body text, p_dedupe_key text, p_payload jsonb DEFAULT '{}'::jsonb, p_scheduled_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.whatsapp_channels%rowtype; message_id uuid; recipient uuid;
  kind text:=public.whatsapp_message_kind(p_template_key); event_key text;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  if p_to_e164 is null or p_to_e164 !~ '^\+[1-9][0-9]{7,14}$' then return null; end if;
  if not public.whatsapp_recipient_allowed(p_shop_id,p_to_e164,p_payload) then return null; end if;
  if p_body is null or length(trim(p_body))=0 or p_dedupe_key is null then return null; end if;
  if exists(select 1 from public.whatsapp_outbox where dedupe_key=p_dedupe_key) then return null; end if;
  -- Canal do profissional do atendimento; geral da loja quando não há vínculo próprio.
  select * into c from public.whatsapp_channels where id=public.whatsapp_route_channel(p_shop_id,p_payload);
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
end $function$
;
CREATE OR REPLACE FUNCTION public.prepare_whatsapp_delivery(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.whatsapp_outbox%rowtype; c public.whatsapp_channels%rowtype;
  b public.client_communication_budget%rowtype; recipient uuid; instance text; appt public.appointments%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
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
  if o.channel_id is null then
    select * into c from public.whatsapp_channels where id=public.whatsapp_route_channel(o.barbershop_id,o.payload);
  end if;
  if (appt.id is not null and c.staff_id is not null and c.staff_id<>appt.staff_id) or c.id is null or not c.enabled or c.delivery_mode='paused'
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
end $function$
;
CREATE OR REPLACE FUNCTION public.process_whatsapp_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  queued int := 0;
  candidate record;
  message_id uuid;
begin
  for candidate in
    select
      a.id as appointment_id,
      a.starts_at - make_interval(hours => coalesce(c.reminder_hours_before, 24)) as remind_at
    from public.appointments a
    left join lateral (
      select ch.reminder_hours_before, ch.notify_reminder
      from public.whatsapp_channels ch
      where ch.barbershop_id = a.barbershop_id
      order by ch.staff_id nulls first
      limit 1
    ) c on true
    where a.status in ('pending', 'confirmed')
      and (a.customer_id is not null or a.shop_client_id is not null)
      and coalesce(c.notify_reminder, true)
      and a.starts_at > now()
      and a.starts_at - make_interval(hours => coalesce(c.reminder_hours_before, 24)) <= now()
      and a.starts_at - make_interval(hours => coalesce(c.reminder_hours_before, 24))
        > now() - interval '2 hours'
  loop
    message_id := public.queue_appointment_whatsapp(
      candidate.appointment_id,
      'booking.reminder',
      candidate.remind_at
    );
    if message_id is not null then
      queued := queued + 1;
    end if;
  end loop;
  return queued;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.process_whatsapp_return_notices()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; message_id uuid; total integer:=0; origin text; body text;
begin
  for r in
    with visits as (
      select a.barbershop_id,a.customer_id,(a.starts_at at time zone public.shop_tz(a.barbershop_id))::date as day
      from public.appointments a join public.customer_privacy p on p.user_id=a.customer_id and p.marketing and p.analytics
      join public.whatsapp_channels c on c.barbershop_id=a.barbershop_id and c.staff_id is null
        and c.enabled and c.return_notice_enabled and c.delivery_mode<>'paused'
      where a.status='completed' and a.starts_at>now()-interval '365 days' and a.starts_at<=now()
      group by a.barbershop_id,a.customer_id,day
    ), rhythm as (
      select barbershop_id,customer_id,max(day) as last_day,
        greatest(7,least(180,ceil((max(day)-min(day))::numeric/(count(*)-1))))::int as interval_days
      from visits group by barbershop_id,customer_id having count(*)>=3
    )
    select x.*,p.whatsapp_e164,s.name
    from rhythm x join public.profiles p on p.id=x.customer_id
    join public.barbershops s on s.id=x.barbershop_id
    where p.whatsapp_opt_in_at is not null and p.whatsapp_verified_at is not null
      and x.last_day+x.interval_days<=(now() at time zone public.shop_tz(x.barbershop_id))::date
      and not exists(select 1 from public.appointments a where a.barbershop_id=x.barbershop_id and a.customer_id=x.customer_id
        and a.status in ('pending','confirmed') and a.starts_at>now())
      and not exists(select 1 from public.client_communication_budget b where b.customer_id=x.customer_id
        and (b.attempted_at>now()-interval '7 days' or (b.attempted_at is null and b.expires_at>now())) and b.kind='return')
      and (select count(*) from public.client_communication_budget b where b.customer_id=x.customer_id
        and (b.attempted_at>now()-interval '7 days' or (b.attempted_at is null and b.expires_at>now())))<2
    order by x.last_day,x.barbershop_id,x.customer_id limit 100
  loop
    origin:=public.shop_public_origin(r.barbershop_id);
    if origin is null or origin !~ '^https://' then continue; end if;
    body:=format(E'Barba & Cabelo — %s\nQuer marcar seu próximo atendimento? Veja os horários: %s/app\n\nPara parar de receber convites, desative Receber ofertas em Conta → Privacidade: %s/app?tab=conta',r.name,origin,origin);
    message_id:=public.enqueue_whatsapp_message(r.barbershop_id,r.whatsapp_e164,'notice.return_visit',body,
      'return:'||r.barbershop_id||':'||r.customer_id||':'||to_char(now() at time zone 'UTC','YYYY-MM-DD'),
      jsonb_build_object('customer_id',r.customer_id),now());
    if message_id is not null then total:=total+1; end if;
  end loop;
  return total;
end $function$
;
CREATE OR REPLACE FUNCTION public.platform_assign_whatsapp_channel(p_id uuid, p_version bigint, p_shop uuid, p_staff uuid, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.whatsapp_channels%rowtype; moved boolean;
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  select * into c from public.whatsapp_channels where id=p_id for update;
  if c.id is null or c.routing_version is distinct from p_version then
    raise exception 'WA_STALE' using errcode='40001'; end if;
  if p_shop is not null and not exists(select 1 from public.barbershops where id=p_shop and status='active') then
    raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
  if p_staff is not null and not exists(select 1 from public.staff where id=p_staff and barbershop_id=p_shop and active) then
    raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
  if p_shop is null and (p_staff is not null or coalesce(p_enabled,false)) then
    raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
  if exists(select 1 from public.whatsapp_channels where id<>p_id and barbershop_id=p_shop and staff_id is not distinct from p_staff) then
    raise exception 'WA_TARGET_OCCUPIED' using errcode='23505'; end if;
  moved:=c.barbershop_id is distinct from p_shop or c.staff_id is distinct from p_staff;
  if moved and (c.backup_instance_name is not null or c.delivery_mode<>'primary') then
    raise exception 'WA_RESERVE_ASSIGNED' using errcode='22023'; end if;
  if exists(select 1 from public.whatsapp_outbox where
    (channel_id=p_id or (channel_id is null and barbershop_id=c.barbershop_id)) and
    (status='sending' or (status='failed' and delivery_started_at is not null and provider_message_id is null))) then
    raise exception 'WA_DELIVERY_BUSY' using errcode='55000'; end if;
  if moved then
    -- Não levar fila antiga ao novo vínculo nem reencaminhar pendências para outro número.
    update public.whatsapp_outbox set status='failed',error='Vínculo do canal alterado; aviso não enviado'
      where (channel_id=p_id or (channel_id is null and barbershop_id=c.barbershop_id)) and status='pending';
    insert into public.whatsapp_channel_movements(channel_id,actor_id,old_shop_id,new_shop_id,old_staff_id,new_staff_id)
      values(p_id,auth.uid(),c.barbershop_id,p_shop,c.staff_id,p_staff);
  end if;
  update public.whatsapp_channels set barbershop_id=p_shop,staff_id=p_staff,enabled=coalesce(p_enabled,false),
    return_notice_enabled=case when moved then false else return_notice_enabled end,
    routing_version=routing_version+1 where id=p_id returning * into c;
  return to_jsonb(c);
end $function$
;
CREATE OR REPLACE FUNCTION public.platform_whatsapp_directory()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  return jsonb_build_object(
    'number_reserves',true,
    'channels',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.whatsapp_channels c),'[]'::jsonb),
    'shops',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.barbershops where status='active'),'[]'::jsonb),
    'staff',coalesce((select jsonb_agg(jsonb_build_object('id',id,'shop_id',barbershop_id,'name',display_name) order by display_name) from public.staff where active),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_channel_movements order by created_at desc,id limit 30) h),'[]'::jsonb),
    'configuration_history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_number_config_history order by created_at desc,id limit 30) h),'[]'::jsonb)
  );
end $function$
;
CREATE OR REPLACE FUNCTION public.configure_shop_whatsapp_delivery(p_shop_id uuid, p_backup_instance text, p_mode text, p_reason text, p_return_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.whatsapp_channels%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  select * into c from public.whatsapp_channels where barbershop_id=p_shop_id and staff_id is null;
  return public.configure_whatsapp_number_internal(c.id,c.routing_version,p_backup_instance,p_mode,p_reason,p_return_enabled);
end $function$
;
CREATE OR REPLACE FUNCTION public.guard_whatsapp_delivery_config()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare candidate public.whatsapp_channels%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  if auth.uid() is not null and not public.is_platform_admin() and (
    (tg_op='INSERT' and (new.backup_instance_name is not null or new.delivery_mode<>'primary' or new.return_notice_enabled))
    or (tg_op='UPDATE' and (new.instance_name is distinct from old.instance_name
    or new.barbershop_id is distinct from old.barbershop_id or new.staff_id is distinct from old.staff_id
    or new.status is distinct from old.status or new.display_phone is distinct from old.display_phone
    or new.backup_instance_name is distinct from old.backup_instance_name or new.delivery_mode is distinct from old.delivery_mode
    or new.return_notice_enabled is distinct from old.return_notice_enabled or new.delivery_reason is distinct from old.delivery_reason))
  ) then raise exception 'Somente a administração configura os números' using errcode='42501'; end if;
  if new.backup_instance_name is not null then
    select * into candidate from public.whatsapp_channels where instance_name=new.backup_instance_name;
    if new.backup_instance_name=new.instance_name or
       (candidate.id is not null and (candidate.barbershop_id is not null or candidate.staff_id is not null
       or candidate.enabled or candidate.backup_instance_name is not null or candidate.delivery_mode<>'primary')) or
       exists(select 1 from public.whatsapp_channels where id<>new.id and backup_instance_name=new.backup_instance_name)
    then raise exception 'WA_BACKUP_UNAVAILABLE' using errcode='23514'; end if;
  end if;
  if exists(select 1 from public.whatsapp_channels where id<>new.id and backup_instance_name=new.instance_name)
     and (new.barbershop_id is not null or new.staff_id is not null or new.enabled
          or new.backup_instance_name is not null or new.delivery_mode<>'primary') then
    raise exception 'WA_NUMBER_RESERVED' using errcode='23514';
  end if;
  return new;
end $function$
;
drop function public.platform_add_whatsapp_link(uuid,bigint,uuid,uuid,boolean);
drop function public.platform_update_whatsapp_link(uuid,bigint,boolean,boolean,boolean);
drop function public.shop_update_whatsapp_preferences(uuid,uuid,bigint,boolean,boolean,boolean,integer);
drop function public.shop_whatsapp_channel(uuid);
drop function public.whatsapp_sync_legacy_preferences();
drop function public.whatsapp_detach_deleted_destination();
drop function public.whatsapp_sync_legacy_anchor(uuid);
drop function public.whatsapp_link_not_busy(uuid);
drop function public.whatsapp_identify_shop(uuid,uuid,text);
drop function public.whatsapp_route_link(uuid,jsonb);
drop view public.whatsapp_delivery_channels;
-- Tabelas e referência no outbox preservadas como histórico. Não reaplicar nº104 cegamente.
notify pgrst,'reload schema';
