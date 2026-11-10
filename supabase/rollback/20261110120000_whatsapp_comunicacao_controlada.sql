-- Reversão P-116: executar em transação, após retirar o worker novo.
-- Definições da bancada com migrations nº 1–100. Não apaga mensagens, números ou orçamento.
CREATE OR REPLACE FUNCTION public.claim_email_outbox(p_limit integer DEFAULT 20)
 RETURNS SETOF email_outbox
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.email_outbox
  set status = 'failed', error = 'Não enviado a tempo (mais de 24 horas de atraso).'
  where status in ('pending', 'sending')
    and scheduled_at < now() - interval '24 hours';

  -- Envio que caiu no meio (função reiniciada, servidor de e-mail travou) volta à fila.
  update public.email_outbox
  set
    status = case when attempts >= 5 then 'failed'::public.email_outbox_status else 'pending'::public.email_outbox_status end,
    error = coalesce(error, 'Envio interrompido; nova tentativa agendada.')
  where status = 'sending'
    and coalesce(claimed_at, scheduled_at) < now() - interval '10 minutes';

  return query
  with picked as (
    select id
    from public.email_outbox
    where status = 'pending' and scheduled_at <= now() and attempts < 5
    order by scheduled_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  )
  update public.email_outbox e
  set status = 'sending', attempts = e.attempts + 1, claimed_at = now()
  from picked
  where e.id = picked.id
  returning e.*;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_outbox(p_limit integer DEFAULT 20)
 RETURNS SETOF whatsapp_outbox
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  with picked as (
    select o.id
    from public.whatsapp_outbox o
    where o.status = 'pending'
      and o.scheduled_at <= now()
      and o.attempts < 5
    order by o.scheduled_at, o.created_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
    for update skip locked
  )
  update public.whatsapp_outbox o
  set status = 'sending',
      attempts = o.attempts + 1
  from picked
  where o.id = picked.id
  returning o.*;
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_email_outbox(p_id uuid, p_ok boolean, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.email_outbox
  set
    status = case
      when p_ok then 'sent'::public.email_outbox_status
      when attempts >= 5 then 'failed'::public.email_outbox_status
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
$function$;

CREATE OR REPLACE FUNCTION public.complete_whatsapp_outbox(p_id uuid, p_ok boolean, p_provider_message_id text DEFAULT NULL::text, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.whatsapp_outbox
  set
    status = case when p_ok then 'sent'::public.whatsapp_outbox_status else 'failed'::public.whatsapp_outbox_status end,
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    error = case when p_ok then null else left(coalesce(p_error, 'send failed'), 500) end,
    sent_at = case when p_ok then now() else sent_at end
  where id = p_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.deliver_client_notice(p_shop_id uuid, p_customer_id uuid, p_preset text, p_sent_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    if public.enqueue_whatsapp_message(
      p_shop_id,
      profile_row.whatsapp_e164,
      template_key,
      wa_body,
      template_key || ':' || p_customer_id::text || ':' || to_char(now(), 'YYYYMMDDHH24MI'),
      jsonb_build_object('preset', p_preset, 'customer_id', p_customer_id),
      now()
    ) is not null then
      channels := array_append(channels, 'whatsapp');
    end if;
  end if;

  customer_email := public.customer_auth_email(p_customer_id);
  if customer_email is not null then
    email_tpl := public.default_email_template(template_key);
    email_subject := public.render_whatsapp_template(email_tpl->>'subject', vars);
    email_body := public.render_whatsapp_template(email_tpl->>'body', vars);
    if public.enqueue_email_message(
      p_shop_id,
      customer_email,
      template_key,
      email_subject,
      email_body,
      'email:' || template_key || ':' || p_customer_id::text || ':' || to_char(now(), 'YYYYMMDDHH24MI'),
      jsonb_build_object('preset', p_preset),
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

  return jsonb_build_object('ok', true, 'channels', to_jsonb(channels), 'status', 'sent');
end;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_message(p_shop_id uuid, p_to_e164 text, p_template_key text, p_body text, p_dedupe_key text, p_payload jsonb DEFAULT '{}'::jsonb, p_scheduled_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  channel public.whatsapp_channels%rowtype;
  message_id uuid;
  prefer_staff uuid;
  recipient uuid;
  appointment_ref uuid;
begin
  prefer_staff := nullif(p_payload->>'staff_id', '')::uuid;

  -- Destinatário: cliente informado no pacote ou o cliente da reserva.
  begin
    recipient := nullif(p_payload->>'customer_id', '')::uuid;
    if recipient is null then
      appointment_ref := nullif(p_payload->>'appointment_id', '')::uuid;
      if appointment_ref is not null then
        select a.customer_id into recipient from public.appointments a where a.id = appointment_ref;
      end if;
    end if;
  exception when invalid_text_representation then
    recipient := null;
  end;

  if recipient is not null then
    -- Destinatário conhecido: só para o número que ELE confirmou por código.
    if p_to_e164 is null or not exists (
      select 1 from public.profiles p
      where p.id = recipient
        and p.whatsapp_e164 = p_to_e164
        and p.whatsapp_verified_at is not null
    ) then
      return null;
    end if;

    -- Número confirmado em outra conta (regra de 20261003220000; com o índice único de
    -- números confirmados, a conferência acima já a cobre).
    if exists (
      select 1 from public.profiles p
      where p.whatsapp_e164 = p_to_e164
        and p.whatsapp_verified_at is not null
        and p.id <> recipient
    ) then
      return null;
    end if;
  end if;

  if prefer_staff is not null then
    select * into channel
    from public.whatsapp_channels
    where barbershop_id = p_shop_id and staff_id = prefer_staff
    limit 1;
  end if;

  if channel.id is null then
    select * into channel
    from public.whatsapp_channels
    where barbershop_id = p_shop_id and staff_id is null
    limit 1;
  end if;

  -- Compat: linhas antigas sem coluna id resolvida via barbershop
  if channel.id is null then
    select * into channel
    from public.whatsapp_channels
    where barbershop_id = p_shop_id
    order by staff_id nulls first
    limit 1;
  end if;

  if channel.barbershop_id is null
     or not channel.enabled
     or channel.status <> 'open' then
    return null;
  end if;

  if p_template_key = 'booking.reminder' then
    if not channel.notify_reminder then
      return null;
    end if;
  elsif p_template_key like 'booking.%' and not channel.notify_booking then
    return null;
  end if;

  insert into public.whatsapp_outbox (
    barbershop_id, to_e164, template_key, body, payload, dedupe_key, scheduled_at
  )
  values (
    p_shop_id, p_to_e164, p_template_key, p_body,
    coalesce(p_payload, '{}'::jsonb), p_dedupe_key, coalesce(p_scheduled_at, now())
  )
  on conflict (dedupe_key) do nothing
  returning id into message_id;

  return message_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.process_pending_client_notices()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    exception when others then
      -- Mantém pendente para nova tentativa; falha de canal não derruba o lote.
      null;
    end;
  end loop;
  return processed;
end;
$function$;

CREATE OR REPLACE FUNCTION public.queue_appointment_whatsapp(p_appointment_id uuid, p_template_key text, p_scheduled_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
               then ':' || to_char(coalesce(p_scheduled_at, now()), 'YYYYMMDDHH24')
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
         then ':' || to_char(coalesce(p_scheduled_at, now()), 'YYYYMMDDHH24')
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
$function$;

CREATE OR REPLACE FUNCTION public.send_client_notice(p_shop_id uuid, p_customer_id uuid, p_preset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  select max(n.created_at) into recent_at
  from public.staff_client_notices n
  where n.barbershop_id = p_shop_id
    and n.customer_id = p_customer_id
    and n.created_at > now() - interval '30 minutes';

  if recent_at is not null then
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
$function$;


grant insert on public.whatsapp_channels to authenticated;
drop trigger if exists whatsapp_delivery_config_guard on public.whatsapp_channels;
drop function if exists public.guard_whatsapp_delivery_config();
drop function if exists public.configure_shop_whatsapp_delivery(uuid,text,text,text,boolean);
drop function if exists public.process_whatsapp_return_notices();
drop function if exists public.prepare_whatsapp_delivery(uuid);
drop function if exists public.defer_whatsapp_delivery(uuid);
-- Helpers e colunas ficam inertes para preservar a auditoria. Não reaplicar a migration
-- sobre esta estrutura: a retomada exige uma migration de avanço revisada.
notify pgrst,'reload schema';
