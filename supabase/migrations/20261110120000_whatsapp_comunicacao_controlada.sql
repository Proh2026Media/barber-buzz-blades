-- P-116: avisos prioritários, comunicações consentidas e canal fixo com reserva.
-- Aplicação na VPS somente pelo roteiro da TI; nenhuma mensagem é enviada pela migration.

alter table public.whatsapp_channels
  add column backup_instance_name text,
  add column delivery_mode text not null default 'primary'
    check (delivery_mode in ('primary', 'backup', 'paused')),
  add column delivery_reason text,
  add column return_notice_enabled boolean not null default false;

alter table public.whatsapp_channels add constraint whatsapp_backup_format check (
  backup_instance_name is null or
  (backup_instance_name ~ '^[a-z0-9][a-z0-9_-]{2,62}$' and backup_instance_name <> instance_name)
);
create unique index whatsapp_backup_instance_uidx on public.whatsapp_channels(backup_instance_name);

-- A reserva é uma instância dedicada já preparada pela TI. Não compra/ativa números.
create or replace function public.configure_shop_whatsapp_delivery(
  p_shop_id uuid, p_backup_instance text, p_mode text, p_reason text, p_return_enabled boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.whatsapp_channels%rowtype; backup_name text := nullif(trim(p_backup_instance), '');
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing', 116));
  select * into c from public.whatsapp_channels where barbershop_id=p_shop_id and staff_id is null for update;
  if c.id is null then raise exception 'Conecte o canal principal primeiro' using errcode='22023'; end if;
  if p_mode is null or p_mode not in ('primary','backup','paused') then
    raise exception 'Canal inválido' using errcode='22023';
  end if;
  if backup_name is not null and (backup_name = c.instance_name or exists (
    select 1 from public.whatsapp_channels x where x.instance_name=backup_name
      or (x.id<>c.id and x.backup_instance_name=backup_name)
  )) then raise exception 'Esta reserva já pertence a outro canal' using errcode='22023'; end if;
  if p_mode='backup' and (backup_name is null or p_reason is distinct from 'technical_failure') then
    raise exception 'A reserva exige falha técnica confirmada' using errcode='22023';
  end if;
  if p_reason='blocked' and p_mode<>'paused' then
    raise exception 'Canal bloqueado exige pausa e revisão' using errcode='22023';
  end if;
  update public.whatsapp_channels set backup_instance_name=backup_name, delivery_mode=p_mode,
    delivery_reason=case when p_mode='backup' then 'technical_failure'
                        when p_mode='paused' then 'review' else null end,
    return_notice_enabled=coalesce(p_return_enabled,false)
  where id=c.id returning * into c;
  return to_jsonb(c);
end $$;
revoke all on function public.configure_shop_whatsapp_delivery(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.configure_shop_whatsapp_delivery(uuid,text,text,text,boolean) to authenticated;

-- Impede alterar rota/reserva por UPDATE direto de um dono de loja.
create function public.guard_whatsapp_delivery_config() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  if auth.uid() is not null and not public.is_platform_admin() and (
    (tg_op='INSERT' and (new.backup_instance_name is not null or new.delivery_mode<>'primary' or new.return_notice_enabled))
    or (tg_op='UPDATE' and (new.instance_name is distinct from old.instance_name
    or new.barbershop_id is distinct from old.barbershop_id
    or new.staff_id is distinct from old.staff_id
    or new.status is distinct from old.status
    or new.display_phone is distinct from old.display_phone
    or new.backup_instance_name is distinct from old.backup_instance_name
    or new.delivery_mode is distinct from old.delivery_mode
    or new.delivery_reason is distinct from old.delivery_reason
    or new.return_notice_enabled is distinct from old.return_notice_enabled))
  ) then raise exception 'Somente a administração configura os canais' using errcode='42501'; end if;
  if new.backup_instance_name is not null and exists (
    select 1 from public.whatsapp_channels where instance_name=new.backup_instance_name
  ) then raise exception 'Reserva não pode ser o principal de outro canal' using errcode='23514'; end if;
  if exists (select 1 from public.whatsapp_channels where backup_instance_name=new.instance_name and id<>new.id) then
    raise exception 'Principal já reservado por outro canal' using errcode='23514';
  end if;
  return new;
end $$;
revoke insert on public.whatsapp_channels from authenticated;
create trigger whatsapp_delivery_config_guard before insert or update on public.whatsapp_channels
for each row execute function public.guard_whatsapp_delivery_config();

create table public.client_communication_budget (
  event_key text primary key,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  kind text not null check(kind in ('marketing','return')),
  reserved_at timestamptz not null default now(),
  attempted_at timestamptz,
  expires_at timestamptz not null default now()+interval '24 hours'
);
create index communication_budget_customer_idx on public.client_communication_budget(customer_id,reserved_at);
alter table public.client_communication_budget enable row level security;
revoke all on public.client_communication_budget from public,anon,authenticated;
grant all on public.client_communication_budget to service_role;

create function public.whatsapp_message_kind(p_key text) returns text
language sql immutable set search_path=public as $$
  select case
    when p_key in ('booking.confirmed','booking.rescheduled','booking.cancelled','booking.reminder',
                   'notice.reminder_next','notice.confirm_today','customer.notice','team.notice') then 'transactional'
    when p_key='notice.return_visit' then 'return'
    else 'marketing' end;
$$;
revoke all on function public.whatsapp_message_kind(text) from public,anon,authenticated;

-- Reserva atômica por pessoa, compartilhada pelas lojas/canais; nenhum aceite implícito.
create function public.reserve_client_communication(p_shop uuid,p_customer uuid,p_kind text,p_key text)
returns boolean language plpgsql security definer set search_path=public as $$
declare existing public.client_communication_budget%rowtype;
begin
  if p_customer is null or p_key is null or p_kind not in ('marketing','return') then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_customer::text,116));
  if not exists(select 1 from public.customer_privacy where user_id=p_customer and marketing) then return false; end if;
  if p_kind='return' and exists(select 1 from public.appointments
    where barbershop_id=p_shop and customer_id=p_customer and status in ('pending','confirmed') and starts_at>now()) then return false; end if;
  select * into existing from public.client_communication_budget where event_key=p_key;
  if found then
    return existing.customer_id=p_customer and existing.barbershop_id=p_shop
      and existing.kind=p_kind and existing.expires_at>now();
  end if;
  if (select count(*) from public.client_communication_budget where customer_id=p_customer
      and (attempted_at>now()-interval '7 days' or (attempted_at is null and expires_at>now())))>=2 then return false; end if;
  if p_kind='return' and exists(select 1 from public.client_communication_budget where customer_id=p_customer and kind='return'
      and (attempted_at>now()-interval '7 days' or (attempted_at is null and expires_at>now()))) then return false; end if;
  insert into public.client_communication_budget(event_key,customer_id,barbershop_id,kind)
    values(p_key,p_customer,p_shop,p_kind);
  return true;
end $$;
revoke all on function public.reserve_client_communication(uuid,uuid,text,text) from public,anon,authenticated;

-- Destinatário resolvido sem aceitar UUID inválido ou agendamento de outra loja.
create function public.whatsapp_recipient(p_shop uuid,p_payload jsonb) returns uuid
language plpgsql stable security definer set search_path=public as $$
declare recipient uuid; appt uuid;
begin
  appt:=nullif(p_payload->>'appointment_id','')::uuid;
  if appt is not null then
    select customer_id into recipient from public.appointments where id=appt and barbershop_id=p_shop;
    return recipient;
  end if;
  return nullif(p_payload->>'customer_id','')::uuid;
exception when invalid_text_representation then return null;
end $$;
revoke all on function public.whatsapp_recipient(uuid,jsonb) from public,anon,authenticated;

create function public.whatsapp_recipient_allowed(p_shop uuid,p_phone text,p_payload jsonb)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare recipient uuid; appt uuid;
begin
  recipient:=public.whatsapp_recipient(p_shop,p_payload);
  if recipient is not null then
    return exists(select 1 from public.profiles where id=recipient and whatsapp_e164=p_phone
      and whatsapp_verified_at is not null and whatsapp_opt_in_at is not null);
  end if;
  appt:=nullif(p_payload->>'appointment_id','')::uuid;
  if appt is null and nullif(p_payload->>'customer_id','') is null then return true; end if;
  return exists(select 1 from public.appointments a join public.shop_clients c
    on c.id=a.shop_client_id and c.barbershop_id=a.barbershop_id
    where a.id=appt and a.barbershop_id=p_shop and c.whatsapp_e164=p_phone and c.notify_whatsapp);
exception when invalid_text_representation then return false;
end $$;
revoke all on function public.whatsapp_recipient_allowed(uuid,text,jsonb) from public,anon,authenticated;

alter table public.whatsapp_outbox
  add column channel_id uuid references public.whatsapp_channels(id) on delete set null,
  add column communication_key text references public.client_communication_budget(event_key) on delete set null,
  add column delivery_started_at timestamptz,
  add column delivery_instance text;

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

-- Reclama transacionais primeiro. Sending abandonado nunca é reenviado cegamente.
create or replace function public.claim_whatsapp_outbox(p_limit int default 20)
returns setof public.whatsapp_outbox language plpgsql security definer set search_path=public as $$
begin
  return query with picked as (
    select o.id from public.whatsapp_outbox o where o.status='pending' and o.scheduled_at<=now()
      and o.attempts<5 and o.delivery_started_at is null
    order by case when public.whatsapp_message_kind(o.template_key)='transactional' then 0 else 1 end,
      o.scheduled_at,o.created_at,o.id
    limit greatest(1,least(coalesce(p_limit,20),100)) for update skip locked
  ), claimed as (update public.whatsapp_outbox o set status='sending',attempts=o.attempts+1
    from picked where o.id=picked.id returning o.*)
  select * from claimed order by case when public.whatsapp_message_kind(template_key)='transactional' then 0 else 1 end,scheduled_at,created_at,id;
end $$;

-- A conferência é imediatamente anterior à chamada externa e só uma vez por mensagem.
create function public.prepare_whatsapp_delivery(p_id uuid) returns jsonb
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

-- Falha após iniciar a chamada externa é resultado incerto: sem retry automático/reserva.
create or replace function public.complete_whatsapp_outbox(p_id uuid,p_ok boolean,p_provider_message_id text default null,p_error text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.whatsapp_outbox set status=case when p_ok then 'sent'::public.whatsapp_outbox_status else 'failed'::public.whatsapp_outbox_status end,
    provider_message_id=coalesce(p_provider_message_id,provider_message_id),
    error=case when p_ok then null else left(coalesce(p_error,'Resultado incerto; conferir antes de reenviar'),500) end,
    sent_at=case when p_ok then now() else sent_at end
  where id=p_id and status='sending';
end $$;

create or replace function public.deliver_client_notice(
  p_shop_id uuid,
  p_customer_id uuid,
  p_preset text,
  p_sent_by uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  shop_row public.barbershops%rowtype;
  template_key text;
  vars jsonb;
  wa_body text;
  email_tpl jsonb;
  email_subject text;
  email_body text;
  customer_email text;
  channels text[] := '{}';
  next_appt public.appointments%rowtype;
  when_label text := '';
  link text := '';
  communication_key text;
  promotional boolean := p_preset in ('slot_open','shop_hello');
begin
  if p_preset not in ('reminder_next', 'confirm_today', 'slot_open', 'shop_hello') then
    raise exception 'Preset inválido' using errcode = '22023';
  end if;

  select * into profile_row from public.profiles where id = p_customer_id;
  if profile_row.id is null then
    raise exception 'Cliente não encontrado' using errcode = 'P0002';
  end if;
  select * into shop_row from public.barbershops where id = p_shop_id;

  select * into next_appt
  from public.appointments a
  where a.barbershop_id = p_shop_id
    and a.customer_id = p_customer_id
    and a.status in ('pending', 'confirmed')
    and a.starts_at > now()
  order by a.starts_at
  limit 1;

  if next_appt.id is not null then
    when_label := to_char(
      next_appt.starts_at at time zone coalesce(shop_row.timezone, 'America/Sao_Paulo'),
      'DD/MM/YYYY às HH24:MI'
    );
    link := coalesce(public.appointment_manage_url(next_appt.id), '');
  else
    link := coalesce(public.shop_public_origin(p_shop_id), '') || '/app?tab=reservas';
  end if;

  if not promotional and next_appt.id is null then
    raise exception 'NOTICE_NO_APPOINTMENT' using errcode='22023';
  end if;
  if promotional then
    communication_key := 'notice:' || gen_random_uuid()::text;
    if not public.reserve_client_communication(p_shop_id,p_customer_id,'marketing',communication_key) then
      raise exception 'NOTICE_COMMUNICATION_LIMIT_OR_CONSENT' using errcode='22023';
    end if;
  end if;
  template_key := 'notice.' || p_preset;
  vars := jsonb_build_object(
    'loja', coalesce(shop_row.name, 'Barbearia'),
    'shop', coalesce(shop_row.name, 'Barbearia'),
    'cliente', coalesce(nullif(trim(profile_row.full_name), ''), 'cliente'),
    'customer', coalesce(nullif(trim(profile_row.full_name), ''), 'cliente'),
    'quando', when_label,
    'when', when_label,
    'servico', '',
    'profissional', '',
    'link_reserva', link,
    'link', link
  );

  if profile_row.whatsapp_e164 is not null and profile_row.whatsapp_opt_in_at is not null then
    wa_body := public.render_whatsapp_template(public.default_whatsapp_template(template_key), vars);
    if promotional then wa_body:='Barba & Cabelo — ' || shop_row.name || E'\n' || wa_body || E'\n\nPreferências de comunicação: ' || public.shop_public_origin(p_shop_id) || '/app?tab=conta'; end if;
    if public.enqueue_whatsapp_message(
      p_shop_id,
      profile_row.whatsapp_e164,
      template_key,
      wa_body,
      coalesce(communication_key,template_key || ':' || p_shop_id || ':' || p_customer_id::text || ':' || to_char(now(), 'YYYYMMDDHH24MI')),
      jsonb_build_object('preset',p_preset,'customer_id',p_customer_id,'communication_key',communication_key)
        || case when not promotional then jsonb_build_object('appointment_id',next_appt.id,'starts_at',next_appt.starts_at) else '{}'::jsonb end,
      now()
    ) is not null then
      channels := array_append(channels, 'whatsapp');
    end if;
  end if;

  customer_email := public.customer_auth_email(p_customer_id);
  if customer_email is not null and (not promotional or array_length(channels,1) is null) then
    email_tpl := public.default_email_template(template_key);
    email_subject := public.render_whatsapp_template(email_tpl->>'subject', vars);
    email_body := public.render_whatsapp_template(email_tpl->>'body', vars);
    if promotional then email_body:=email_body || E'\n\nPreferências de comunicação: ' || public.shop_public_origin(p_shop_id) || '/app?tab=conta'; end if;
    if public.enqueue_email_message(
      p_shop_id,
      customer_email,
      template_key,
      email_subject,
      email_body,
      'email:' || coalesce(communication_key,template_key || ':' || p_shop_id || ':' || p_customer_id::text || ':' || to_char(now(), 'YYYYMMDDHH24MI')),
      jsonb_build_object('preset',p_preset,'customer_id',p_customer_id,'communication_key',communication_key)
        || case when not promotional then jsonb_build_object('appointment_id',next_appt.id,'starts_at',next_appt.starts_at) else '{}'::jsonb end,
      now()
    ) is not null then
      channels := array_append(channels, 'email');
    end if;
  end if;

  if coalesce(array_length(channels, 1), 0) = 0 then
    raise exception 'Cliente sem WhatsApp com opt-in nem e-mail para receber avisos.' using errcode = '22023';
  end if;

  insert into public.staff_client_notices (barbershop_id, customer_id, sent_by, preset, channels)
  values (p_shop_id, p_customer_id, p_sent_by, p_preset, channels);

  delete from public.staff_client_notice_pending
  where barbershop_id = p_shop_id and customer_id = p_customer_id;

  return jsonb_build_object('ok', true, 'channels', to_jsonb(channels), 'status', 'accepted');
end;
$$;


create or replace function public.queue_appointment_whatsapp(
  p_appointment_id uuid,
  p_template_key text,
  p_scheduled_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.appointments%rowtype;
  profile_row public.profiles%rowtype;
  client_row public.shop_clients%rowtype;
  shop_row public.barbershops%rowtype;
  service_name text;
  staff_name text;
  when_label text;
  template_body text;
  body text;
  dedupe text;
  vars jsonb;
  link text;
  email_tpl jsonb;
  email_subject text;
  email_body text;
  customer_email text;
  to_number text;
  origin text;
begin
  select * into appt from public.appointments where id = p_appointment_id;
  if appt.id is null then return null; end if;

  select * into profile_row from public.profiles where id = appt.customer_id;
  if appt.customer_id is null and appt.shop_client_id is not null then
    select * into client_row from public.shop_clients where id = appt.shop_client_id;
  end if;
  select * into shop_row from public.barbershops where id = appt.barbershop_id;
  select name into service_name from public.services where id = appt.service_id;
  select display_name into staff_name from public.staff where id = appt.staff_id;

  when_label := to_char(
    appt.starts_at at time zone coalesce(shop_row.timezone, 'America/Sao_Paulo'),
    'DD/MM/YYYY "às" HH24"h"MI'
  );
  if appt.customer_id is null and client_row.id is not null then
    -- Sem conta não dá para abrir o agendamento: o link leva ao cadastro no app da barbearia.
    origin := public.shop_public_origin(appt.barbershop_id);
    link := case when origin is null then ''
                 else origin || '/auth?cadastro=1&next=%2Fapp%3Ftab%3Dreservas' end;
  else
    link := coalesce(public.appointment_manage_url(appt.id), '');
  end if;

  vars := jsonb_build_object(
    'loja', coalesce(shop_row.name, 'Barbearia'),
    'shop', coalesce(shop_row.name, 'Barbearia'),
    'serviço', coalesce(service_name, 'Serviço'),
    'servico', coalesce(service_name, 'Serviço'),
    'service', coalesce(service_name, 'Serviço'),
    'profissional', coalesce(staff_name, 'profissional'),
    'staff', coalesce(staff_name, 'profissional'),
    'quando', when_label,
    'when', when_label,
    'cliente', coalesce(nullif(trim(profile_row.full_name), ''), nullif(trim(client_row.full_name), ''), 'cliente'),
    'customer', coalesce(nullif(trim(profile_row.full_name), ''), nullif(trim(client_row.full_name), ''), 'cliente'),
    'link_reserva', link,
    'link', link
  );

  customer_email := public.customer_auth_email(appt.customer_id);
  if customer_email is not null then
    select jsonb_build_object('subject', t.subject, 'body', t.body) into email_tpl
    from public.email_message_templates t
    where t.barbershop_id = appt.barbershop_id and t.template_key = p_template_key;
    email_tpl := coalesce(email_tpl, public.default_email_template(p_template_key));
    email_subject := public.render_whatsapp_template(email_tpl->>'subject', vars);
    email_body := public.render_whatsapp_template(email_tpl->>'body', vars);
    if email_subject is not null and email_body is not null then
      perform public.enqueue_email_message(
        appt.barbershop_id,
        customer_email,
        p_template_key,
        email_subject,
        email_body,
        'email:' || p_template_key || ':' || appt.id::text
          || case when p_template_key = 'booking.reminder'
               then ':' || appt.starts_at::text
               when p_template_key='booking.rescheduled' then ':' || appt.updated_at::text
               else ''
             end,
        jsonb_build_object('appointment_id', appt.id),
        coalesce(p_scheduled_at, now())
      );
    end if;
  end if;

  if appt.customer_id is not null then
    if profile_row.whatsapp_e164 is null or profile_row.whatsapp_opt_in_at is null then
      return null;
    end if;
    to_number := profile_row.whatsapp_e164;
  elsif client_row.id is not null then
    -- Cliente do balcão: o número que ele passou ao barbeiro, se os avisos estiverem ligados.
    if client_row.whatsapp_e164 is null or not client_row.notify_whatsapp then
      return null;
    end if;
    to_number := client_row.whatsapp_e164;
  else
    return null;
  end if;

  select t.body into template_body
  from public.whatsapp_message_templates t
  where t.barbershop_id = appt.barbershop_id
    and t.template_key = p_template_key;

  template_body := coalesce(template_body, public.default_whatsapp_template(p_template_key));

  -- Se o modelo pede {{link_reserva}}, exige URL HTTPS absoluta.
  if position('{{link_reserva}}' in template_body) > 0
     and (link is null or link !~ '^https://') then
    return null;
  end if;

  body := public.render_whatsapp_template(template_body, vars);
  if body is null or length(trim(body)) = 0 then
    return null;
  end if;

  dedupe := p_template_key || ':' || p_appointment_id::text
    || case when p_template_key = 'booking.reminder'
         then ':' || appt.starts_at::text
         when p_template_key='booking.rescheduled' then ':' || appt.updated_at::text
         else ''
       end;

  return public.enqueue_whatsapp_message(
    appt.barbershop_id,
    to_number,
    p_template_key,
    body,
    dedupe,
    jsonb_build_object(
      'appointment_id', appt.id,
      'starts_at', appt.starts_at,
      'status', appt.status
    ),
    coalesce(p_scheduled_at, now())
  );
end;
$$;


-- O mesmo orçamento vale para o e-mail alternativo dos avisos promocionais.
-- Não afeta outros e-mails transacionais do produto.
create or replace function public.claim_email_outbox(p_limit int default 20)
returns setof public.email_outbox language plpgsql security definer set search_path=public as $$
declare e public.email_outbox%rowtype; b public.client_communication_budget%rowtype;
begin
  update public.email_outbox set status='failed',error='Não enviado a tempo (mais de 24 horas de atraso).'
    where status in ('pending','sending') and scheduled_at<now()-interval '24 hours';
  update public.email_outbox set status=case when attempts>=5 or template_key in ('notice.slot_open','notice.shop_hello')
      then 'failed'::public.email_outbox_status else 'pending'::public.email_outbox_status end,
    error=coalesce(error,'Envio interrompido; conferir antes de reenviar.')
    where status='sending' and coalesce(claimed_at,scheduled_at)<now()-interval '10 minutes';
  for e in select * from public.email_outbox where status='pending' and scheduled_at<=now() and attempts<5
    order by case when template_key in ('notice.slot_open','notice.shop_hello') then 1 else 0 end,scheduled_at,id
    limit greatest(1,least(coalesce(p_limit,20),50)) for update skip locked
  loop
    if e.template_key in ('notice.slot_open','notice.shop_hello') then
      select * into b from public.client_communication_budget where event_key=e.payload->>'communication_key';
      if b.event_key is null then
        update public.email_outbox set status='failed',error='Comunicação sem autorização atual' where id=e.id; continue;
      end if;
      perform pg_advisory_xact_lock(hashtextextended(b.customer_id::text,116));
      if b.expires_at<=now() or not exists(select 1 from public.customer_privacy where user_id=b.customer_id and marketing)
        or (b.attempted_at is null and (select count(*) from public.client_communication_budget where customer_id=b.customer_id
          and event_key<>b.event_key and attempted_at>now()-interval '7 days')>=2) then
        update public.email_outbox set status='failed',error='Comunicação recusada, expirada ou limitada' where id=e.id; continue;
      end if;
      update public.client_communication_budget set attempted_at=coalesce(attempted_at,now()) where event_key=b.event_key;
    end if;
    update public.email_outbox set status='sending',attempts=attempts+1,claimed_at=now() where id=e.id returning * into e;
    return next e;
  end loop;
end $$;

create function public.defer_whatsapp_delivery(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  -- Chamado pelo worker somente quando NÃO chamou sendText (pré-conferência indisponível).
  update public.whatsapp_outbox set status=case when attempts<5 then 'pending'::public.whatsapp_outbox_status else 'failed'::public.whatsapp_outbox_status end,
    scheduled_at=now()+interval '5 minutes',delivery_started_at=null,delivery_instance=null,
    error='Canal indisponível antes do envio'
  where id=p_id and status='sending';
end $$;
revoke all on function public.defer_whatsapp_delivery(uuid) from public,anon,authenticated;
grant execute on function public.defer_whatsapp_delivery(uuid) to service_role;

-- Retorno semanal: média dos intervalos de visitas concluídas nos últimos 365 dias,
-- mínimo 3 dias de visita. Não deriva frequência de cancelamentos nem faltas.
create function public.process_whatsapp_return_notices() returns integer
language plpgsql security definer set search_path=public as $$
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
end $$;
revoke all on function public.process_whatsapp_return_notices() from public,anon,authenticated;
grant execute on function public.process_whatsapp_return_notices() to service_role;

-- Autorizações herdadas são reafirmadas; helpers não ficam expostos por padrão.
revoke all on function public.enqueue_whatsapp_message(uuid,text,text,text,text,jsonb,timestamptz),
  public.claim_whatsapp_outbox(int),public.complete_whatsapp_outbox(uuid,boolean,text,text),
  public.claim_email_outbox(int),public.deliver_client_notice(uuid,uuid,text,uuid),
  public.queue_appointment_whatsapp(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.enqueue_whatsapp_message(uuid,text,text,text,text,jsonb,timestamptz),
  public.claim_whatsapp_outbox(int),public.complete_whatsapp_outbox(uuid,boolean,text,text),
  public.claim_email_outbox(int),public.deliver_client_notice(uuid,uuid,text,uuid) to service_role;
revoke all on function public.guard_whatsapp_delivery_config() from public,anon,authenticated;
notify pgrst,'reload schema';

create or replace function public.complete_email_outbox(
  p_id uuid,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.email_outbox
  set
    status = case
      when p_ok then 'sent'::public.email_outbox_status
      when attempts >= 5 or template_key in ('notice.slot_open','notice.shop_hello') then 'failed'::public.email_outbox_status
      else 'pending'::public.email_outbox_status
    end,
    sent_at = case when p_ok then now() else sent_at end,
    scheduled_at = case
      when p_ok or attempts >= 5 then scheduled_at
      else greatest(scheduled_at, now() + make_interval(mins => 5 * attempts))
    end,
    error = case when p_ok then null else left(coalesce(p_error, 'erro'), 500) end
  where id = p_id and status = 'sending';
end;
$$;


create or replace function public.send_client_notice(
  p_shop_id uuid,
  p_customer_id uuid,
  p_preset text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mine uuid;
  full_access boolean;
  served boolean;
  recent_at timestamptz;
  wait_seconds int;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_preset not in ('reminder_next', 'confirm_today', 'slot_open', 'shop_hello') then
    raise exception 'Preset inválido' using errcode = '22023';
  end if;

  mine := public.current_staff_id(p_shop_id);
  full_access := public.is_platform_admin() or public.can_view_full_shop(p_shop_id);
  if mine is null and not full_access then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not full_access then
    select exists(
      select 1 from public.appointments a
      where a.barbershop_id = p_shop_id and a.staff_id = mine and a.customer_id = p_customer_id
    ) into served;
    if not served then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text||p_customer_id::text,116));
  select max(n.created_at) into recent_at
  from public.staff_client_notices n
  where n.barbershop_id = p_shop_id
    and n.customer_id = p_customer_id
    and n.created_at > now() - interval '30 minutes';

  if recent_at is not null then
    if p_preset in ('slot_open','shop_hello') then
      raise exception 'NOTICE_COMMUNICATION_LIMIT_OR_CONSENT' using errcode='22023';
    end if;
    insert into public.staff_client_notice_pending (
      barbershop_id, customer_id, preset, requested_by, requested_at
    ) values (p_shop_id, p_customer_id, p_preset, auth.uid(), now())
    on conflict (barbershop_id, customer_id) do update
      set preset = excluded.preset,
          requested_by = excluded.requested_by,
          requested_at = now();
    wait_seconds := greatest(
      0,
      extract(epoch from (recent_at + interval '30 minutes' - now()))::int
    );
    return jsonb_build_object(
      'ok', true,
      'status', 'queued',
      'wait_seconds', wait_seconds,
      'preset', p_preset
    );
  end if;

  return public.deliver_client_notice(p_shop_id, p_customer_id, p_preset, auth.uid());
end;
$$;


create or replace function public.process_pending_client_notices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  row_pending public.staff_client_notice_pending%rowtype;
  last_sent timestamptz;
  processed int := 0;
begin
  for row_pending in
    select * from public.staff_client_notice_pending
    order by requested_at
    limit 50
  loop
    select max(n.created_at) into last_sent
    from public.staff_client_notices n
    where n.barbershop_id = row_pending.barbershop_id
      and n.customer_id = row_pending.customer_id;

    if last_sent is not null and last_sent > now() - interval '30 minutes' then
      continue;
    end if;

    begin
      perform public.deliver_client_notice(
        row_pending.barbershop_id,
        row_pending.customer_id,
        row_pending.preset,
        row_pending.requested_by
      );
      processed := processed + 1;
    exception when sqlstate '22023' then
      delete from public.staff_client_notice_pending where barbershop_id=row_pending.barbershop_id and customer_id=row_pending.customer_id;
    when others then
      -- Mantém pendente para nova tentativa; falha de canal não derruba o lote.
      null;
    end;
  end loop;
  return processed;
end;
$$;
