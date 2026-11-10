-- P-117: central de canais administrados e login pelo número pessoal confirmado.
-- Não ativa WhatsApp, não envia mensagens, não muda vínculos existentes.
alter table public.whatsapp_channels alter column barbershop_id drop not null;
alter table public.whatsapp_channels add column label text not null default '',
  add column routing_version bigint not null default 0;
alter table public.whatsapp_channels add constraint whatsapp_staff_requires_shop
  check (staff_id is null or barbershop_id is not null);

create table public.whatsapp_channel_movements (
  id uuid primary key default gen_random_uuid(), channel_id uuid not null,
  actor_id uuid references public.profiles(id) on delete set null,
  old_shop_id uuid, new_shop_id uuid, old_staff_id uuid, new_staff_id uuid,
  created_at timestamptz not null default now()
);
alter table public.whatsapp_channel_movements enable row level security;
revoke all on public.whatsapp_channel_movements from public,anon,authenticated;
grant select on public.whatsapp_channel_movements to authenticated;
create policy whatsapp_movements_admin on public.whatsapp_channel_movements for select to authenticated
  using(public.is_platform_admin());

create function public.platform_whatsapp_directory() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  return jsonb_build_object(
    'channels',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.whatsapp_channels c),'[]'::jsonb),
    'shops',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.barbershops where status='active'),'[]'::jsonb),
    'staff',coalesce((select jsonb_agg(jsonb_build_object('id',id,'shop_id',barbershop_id,'name',display_name) order by display_name) from public.staff where active),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_channel_movements order by created_at desc,id limit 30) h),'[]'::jsonb)
  );
end $$;

create function public.platform_create_whatsapp_channel(p_id uuid,p_label text) returns uuid
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  if p_id is null or length(trim(coalesce(p_label,''))) not between 2 and 80 then
    raise exception 'WA_LABEL_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  -- Idempotência da criação, inclusive quando a resposta se perde.
  insert into public.whatsapp_channels(id,label,instance_name,enabled)
    values(p_id,trim(p_label),'bc-'||p_id,false) on conflict(id) do nothing;
  return p_id;
end $$;

create function public.platform_assign_whatsapp_channel(
  p_id uuid,p_version bigint,p_shop uuid,p_staff uuid,p_enabled boolean
) returns jsonb language plpgsql security definer set search_path=public as $$
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
end $$;

-- Transferências apenas pela RPC auditada, mesmo para admin. O endpoint de conexão
-- continua atualizando status/número; donos conservam as preferências de avisos.
create function public.guard_whatsapp_assignment() returns trigger
language plpgsql set search_path=public as $$
begin
  if current_user in ('authenticated','anon','service_role') and
    (new.barbershop_id is distinct from old.barbershop_id or new.staff_id is distinct from old.staff_id
     or new.instance_name is distinct from old.instance_name or new.routing_version is distinct from old.routing_version) then
    raise exception 'Use a central de canais' using errcode='42501'; end if;
  return new;
end $$;
create trigger whatsapp_assignment_guard before update on public.whatsapp_channels
for each row execute function public.guard_whatsapp_assignment();

-- Só o profissional do agendamento (ou do payload interno validado) pode ter canal próprio.
-- Um canal próprio pausado não autoriza usar silenciosamente o canal de outro profissional.
create function public.whatsapp_route_channel(p_shop uuid,p_payload jsonb) returns uuid
language plpgsql stable security definer set search_path=public as $$
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
end $$;
revoke all on function public.whatsapp_route_channel(uuid,jsonb) from public,anon,authenticated;

-- Reserva de login atômica: sem revelar conta; pausa entre pedidos e limite global por número.
create function public.request_whatsapp_login(p_destination text,p_code_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare person uuid; challenge uuid;
begin
  if p_destination !~ '^\+[1-9][0-9]{7,14}$' or p_code_hash !~ '^[a-f0-9]{64}$' or p_destination is null or p_code_hash is null then
    raise exception 'Entrada inválida' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('wa-login:'||p_destination,117));
  if exists(select 1 from public.auth_otp_challenges where destination=p_destination and channel='whatsapp' and created_at>now()-interval '60 seconds')
     or (select count(*) from public.auth_otp_challenges where destination=p_destination and channel='whatsapp' and created_at>now()-interval '15 minutes')>=3 then
    raise exception 'WA_RATE_LIMIT' using errcode='P0001'; end if;
  select p.id into person from public.profiles p join auth.users u on u.id=p.id
    where p.whatsapp_e164=p_destination and p.whatsapp_verified_at is not null
    and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) and nullif(u.email,'') is not null;
  update public.auth_otp_challenges set consumed_at=now()
    where destination=p_destination and channel='whatsapp' and purpose='login' and barbershop_id is null and consumed_at is null;
  insert into public.auth_otp_challenges(user_id,barbershop_id,channel,destination,code_hash,purpose,expires_at)
    values(person,null,'whatsapp',p_destination,p_code_hash,'login',now()+interval '10 minutes') returning id into challenge;
  return jsonb_build_object('challenge_id',challenge,'user_id',person);
end $$;
revoke all on function public.request_whatsapp_login(text,text) from public,anon,authenticated;
grant execute on function public.request_whatsapp_login(text,text) to service_role;

revoke all on function public.platform_whatsapp_directory(),public.platform_create_whatsapp_channel(uuid,text),
  public.platform_assign_whatsapp_channel(uuid,bigint,uuid,uuid,boolean) from public,anon;
grant execute on function public.platform_whatsapp_directory(),public.platform_create_whatsapp_channel(uuid,text),
  public.platform_assign_whatsapp_channel(uuid,bigint,uuid,uuid,boolean) to authenticated;

-- Definição anterior: nº 101; preserva consentimentos, cotas e tratamento de incerteza.
create or replace function public.enqueue_whatsapp_message(
  p_shop_id uuid,p_to_e164 text,p_template_key text,p_body text,p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb,p_scheduled_at timestamptz default now()
) returns uuid language plpgsql security definer set search_path=public as $$
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
end $$;


-- Definição anterior: nº 101; preserva consentimentos, cotas e tratamento de incerteza.
create or replace function public.prepare_whatsapp_delivery(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
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
end $$;
revoke all on function public.prepare_whatsapp_delivery(uuid) from public,anon,authenticated;
grant execute on function public.prepare_whatsapp_delivery(uuid) to service_role;
