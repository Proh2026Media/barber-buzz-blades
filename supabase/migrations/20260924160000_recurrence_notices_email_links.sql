-- Token público da reserva, link nas mensagens, e-mail operacional,
-- avisos manuais do barbeiro e séries recorrentes.

-- ---------------------------------------------------------------------------
-- B) public_token + URL de gestão
-- ---------------------------------------------------------------------------

alter table public.appointments
  add column if not exists public_token text;

update public.appointments
set public_token = encode(gen_random_bytes(16), 'hex')
where public_token is null;

alter table public.appointments
  alter column public_token set default encode(gen_random_bytes(16), 'hex');

alter table public.appointments
  alter column public_token set not null;

create unique index if not exists appointments_public_token_uidx
  on public.appointments (public_token);

alter table public.appointments
  add column if not exists series_id uuid;

create index if not exists appointments_series_id_idx
  on public.appointments (series_id)
  where series_id is not null;

create or replace function public.shop_public_origin(p_shop_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  shop public.barbershops%rowtype;
  base_host text := coalesce(nullif(current_setting('app.platform_base_host', true), ''), 'beauty.contheiner.digital');
begin
  select * into shop from public.barbershops where id = p_shop_id;
  if shop.id is null then return null; end if;
  if shop.custom_domain is not null and shop.custom_domain_status = 'active' then
    return 'https://' || shop.custom_domain;
  end if;
  return 'https://' || shop.slug || '.' || base_host;
end;
$$;

revoke all on function public.shop_public_origin(uuid) from public, anon;
grant execute on function public.shop_public_origin(uuid) to authenticated, service_role;

create or replace function public.appointment_manage_url(p_appointment_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  appt public.appointments%rowtype;
  origin text;
begin
  select * into appt from public.appointments where id = p_appointment_id;
  if appt.id is null or appt.public_token is null then return null; end if;
  origin := public.shop_public_origin(appt.barbershop_id);
  if origin is null then return null; end if;
  return origin || '/app?tab=reservas&reserva=' || appt.public_token;
end;
$$;

revoke all on function public.appointment_manage_url(uuid) from public, anon;
grant execute on function public.appointment_manage_url(uuid) to authenticated, service_role;

-- Lookup público só retorna metadados mínimos (sem PII além do necessário ao gate).
create or replace function public.lookup_appointment_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  appt public.appointments%rowtype;
  shop_name text;
  service_name text;
  staff_name text;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return null;
  end if;
  select * into appt from public.appointments where public_token = trim(p_token);
  if appt.id is null then return null; end if;
  select name into shop_name from public.barbershops where id = appt.barbershop_id;
  select name into service_name from public.services where id = appt.service_id;
  select display_name into staff_name from public.staff where id = appt.staff_id;
  return jsonb_build_object(
    'appointment_id', appt.id,
    'barbershop_id', appt.barbershop_id,
    'customer_id', appt.customer_id,
    'status', appt.status,
    'starts_at', appt.starts_at,
    'ends_at', appt.ends_at,
    'shop_name', shop_name,
    'service_name', service_name,
    'staff_name', staff_name,
    'series_id', appt.series_id
  );
end;
$$;

revoke all on function public.lookup_appointment_by_token(text) from public;
grant execute on function public.lookup_appointment_by_token(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- D) email_outbox + templates
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.email_outbox_status as enum ('pending', 'sending', 'sent', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  to_email text not null,
  template_key text not null,
  subject text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.email_outbox_status not null default 'pending',
  error text,
  attempts int not null default 0,
  dedupe_key text not null,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dedupe_key)
);

create index if not exists email_outbox_pending_idx
  on public.email_outbox (scheduled_at)
  where status = 'pending';

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
grant select on public.email_outbox to authenticated;
grant all on public.email_outbox to service_role;

drop policy if exists email_outbox_select on public.email_outbox;
create policy email_outbox_select on public.email_outbox
  for select to authenticated
  using (public.shop_can_manage_whatsapp(barbershop_id));

create table if not exists public.email_message_templates (
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  template_key text not null,
  subject text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  primary key (barbershop_id, template_key),
  constraint email_message_templates_body_len
    check (char_length(body) between 1 and 4000),
  constraint email_message_templates_subject_len
    check (char_length(subject) between 1 and 200)
);

create trigger email_message_templates_set_updated_at
  before update on public.email_message_templates
  for each row execute function public.set_updated_at();

alter table public.email_message_templates enable row level security;
revoke all on public.email_message_templates from anon, authenticated;
grant select, insert, update, delete on public.email_message_templates to authenticated;
grant all on public.email_message_templates to service_role;

drop policy if exists email_message_templates_all on public.email_message_templates;
create policy email_message_templates_all on public.email_message_templates
  for all to authenticated
  using (public.shop_can_manage_whatsapp(barbershop_id))
  with check (public.shop_can_manage_whatsapp(barbershop_id));

create or replace function public.default_email_template(p_template_key text)
returns jsonb
language sql
immutable
as $$
  select case p_template_key
    when 'booking.confirmed' then jsonb_build_object(
      'subject', 'Horário confirmado — {{loja}}',
      'body', E'Olá {{cliente}},\n\nSeu horário está confirmado.\n{{servico}} com {{profissional}}\n{{quando}}\n\nGerenciar reserva:\n{{link_reserva}}'
    )
    when 'booking.cancelled' then jsonb_build_object(
      'subject', 'Horário cancelado — {{loja}}',
      'body', E'Olá {{cliente}},\n\nSeu horário foi cancelado.\n{{servico}} — {{quando}}\n\n{{link_reserva}}'
    )
    when 'booking.rescheduled' then jsonb_build_object(
      'subject', 'Horário remarcado — {{loja}}',
      'body', E'Olá {{cliente}},\n\nSeu horário foi remarcado.\n{{servico}} com {{profissional}}\nNovo horário: {{quando}}\n\n{{link_reserva}}'
    )
    when 'booking.reminder' then jsonb_build_object(
      'subject', 'Lembrete — {{loja}}',
      'body', E'Olá {{cliente}},\n\nLembrete do seu horário.\n{{servico}} com {{profissional}}\n{{quando}}\n\n{{link_reserva}}'
    )
    when 'notice.reminder_next' then jsonb_build_object(
      'subject', 'Lembrete da {{loja}}',
      'body', E'Olá {{cliente}},\n\nPassando para lembrar do seu próximo horário conosco.\n{{quando}}\n\n{{link_reserva}}'
    )
    when 'notice.confirm_today' then jsonb_build_object(
      'subject', 'Confirmação de hoje — {{loja}}',
      'body', E'Olá {{cliente}},\n\nPode confirmar se vem hoje?\n{{quando}}\n\n{{link_reserva}}'
    )
    when 'notice.slot_open' then jsonb_build_object(
      'subject', 'Vaga disponível — {{loja}}',
      'body', E'Olá {{cliente}},\n\nAbrimos uma vaga. Se quiser, fale conosco ou veja sua agenda:\n{{link_reserva}}'
    )
    when 'notice.shop_hello' then jsonb_build_object(
      'subject', 'Mensagem da {{loja}}',
      'body', E'Olá {{cliente}},\n\nA equipe da {{loja}} deixou um aviso para você.\n\n{{link_reserva}}'
    )
    else jsonb_build_object(
      'subject', 'Atualização — {{loja}}',
      'body', E'Olá {{cliente}},\n\nAtualização do seu horário em {{quando}}.\n\n{{link_reserva}}'
    )
  end;
$$;

create or replace function public.enqueue_email_message(
  p_shop_id uuid,
  p_to_email text,
  p_template_key text,
  p_subject text,
  p_body text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb,
  p_scheduled_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  message_id uuid;
  email text := lower(trim(coalesce(p_to_email, '')));
begin
  if email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    return null;
  end if;
  insert into public.email_outbox (
    barbershop_id, to_email, template_key, subject, body, payload, dedupe_key, scheduled_at
  )
  values (
    p_shop_id, email, p_template_key, p_subject, p_body,
    coalesce(p_payload, '{}'::jsonb), p_dedupe_key, coalesce(p_scheduled_at, now())
  )
  on conflict (dedupe_key) do nothing
  returning id into message_id;
  return message_id;
end;
$$;

revoke all on function public.enqueue_email_message(uuid, text, text, text, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.enqueue_email_message(uuid, text, text, text, text, text, jsonb, timestamptz)
  to service_role;

create or replace function public.claim_email_outbox(p_limit int default 20)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select id
    from public.email_outbox
    where status = 'pending' and scheduled_at <= now()
    order by scheduled_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  )
  update public.email_outbox e
  set status = 'sending', attempts = e.attempts + 1
  from picked
  where e.id = picked.id
  returning e.*;
end;
$$;

revoke all on function public.claim_email_outbox(int) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(int) to service_role;

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
    status = case when p_ok then 'sent'::public.email_outbox_status else 'failed'::public.email_outbox_status end,
    sent_at = case when p_ok then now() else sent_at end,
    error = case when p_ok then null else left(coalesce(p_error, 'erro'), 500) end
  where id = p_id;
end;
$$;

revoke all on function public.complete_email_outbox(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.complete_email_outbox(uuid, boolean, text) to service_role;

-- ---------------------------------------------------------------------------
-- Atualiza defaults WA com link + amplia keys de notice
-- ---------------------------------------------------------------------------

alter table public.whatsapp_message_templates
  drop constraint if exists whatsapp_message_templates_key_check;

alter table public.whatsapp_message_templates
  add constraint whatsapp_message_templates_key_check
  check (template_key in (
    'booking.confirmed',
    'booking.cancelled',
    'booking.rescheduled',
    'booking.reminder',
    'notice.reminder_next',
    'notice.confirm_today',
    'notice.slot_open',
    'notice.shop_hello'
  ));

create or replace function public.default_whatsapp_template(p_template_key text)
returns text
language sql
immutable
as $$
  select case p_template_key
    when 'booking.confirmed' then
      E'{{loja}}\nSeu horário está confirmado.\n{{servico}} com {{profissional}}\n{{quando}}\n\nGerenciar: {{link_reserva}}'
    when 'booking.cancelled' then
      E'{{loja}}\nSeu horário foi cancelado.\n{{servico}} — {{quando}}\n\n{{link_reserva}}'
    when 'booking.rescheduled' then
      E'{{loja}}\nSeu horário foi remarcado.\n{{servico}} com {{profissional}}\nNovo horário: {{quando}}\n\n{{link_reserva}}'
    when 'booking.reminder' then
      E'{{loja}}\nLembrete do seu horário.\n{{servico}} com {{profissional}}\n{{quando}}\n\n{{link_reserva}}'
    when 'notice.reminder_next' then
      E'{{loja}}\nOi {{cliente}}, lembrete do seu próximo horário.\n{{quando}}\n\n{{link_reserva}}'
    when 'notice.confirm_today' then
      E'{{loja}}\nOi {{cliente}}, pode confirmar se vem hoje?\n{{quando}}\n\n{{link_reserva}}'
    when 'notice.slot_open' then
      E'{{loja}}\nOi {{cliente}}, abrimos uma vaga. Se quiser, fale conosco.\n{{link_reserva}}'
    when 'notice.shop_hello' then
      E'{{loja}}\nOi {{cliente}}, a equipe deixou um aviso para você.\n{{link_reserva}}'
    else
      E'{{loja}}\nAtualização do seu horário em {{quando}}.\n{{link_reserva}}'
  end;
$$;

create or replace function public.customer_auth_email(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  email text;
begin
  select u.email into email from auth.users u where u.id = p_user_id;
  return nullif(lower(trim(coalesce(email, ''))), '');
end;
$$;

revoke all on function public.customer_auth_email(uuid) from public, anon, authenticated;
grant execute on function public.customer_auth_email(uuid) to service_role;

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
begin
  select * into appt from public.appointments where id = p_appointment_id;
  if appt.id is null then return null; end if;

  select * into profile_row from public.profiles where id = appt.customer_id;
  select * into shop_row from public.barbershops where id = appt.barbershop_id;
  select name into service_name from public.services where id = appt.service_id;
  select display_name into staff_name from public.staff where id = appt.staff_id;

  when_label := to_char(appt.starts_at at time zone coalesce(shop_row.timezone, 'America/Sao_Paulo'), 'DD/MM/YYYY às HH24:MI');
  link := coalesce(public.appointment_manage_url(appt.id), '');

  vars := jsonb_build_object(
    'loja', coalesce(shop_row.name, 'Barbearia'),
    'shop', coalesce(shop_row.name, 'Barbearia'),
    'servico', coalesce(service_name, 'Serviço'),
    'service', coalesce(service_name, 'Serviço'),
    'profissional', coalesce(staff_name, 'profissional'),
    'staff', coalesce(staff_name, 'profissional'),
    'quando', when_label,
    'when', when_label,
    'cliente', coalesce(nullif(trim(profile_row.full_name), ''), 'cliente'),
    'customer', coalesce(nullif(trim(profile_row.full_name), ''), 'cliente'),
    'link_reserva', link,
    'link', link
  );

  -- E-mail (melhor esforço; não bloqueia WhatsApp).
  customer_email := public.customer_auth_email(appt.customer_id);
  if customer_email is not null then
    select jsonb_build_object('subject', t.subject, 'body', t.body) into email_tpl
    from public.email_message_templates t
    where t.barbershop_id = appt.barbershop_id and t.template_key = p_template_key;
    email_tpl := coalesce(email_tpl, public.default_email_template(p_template_key));
    email_subject := public.render_whatsapp_template(email_tpl->>'subject', vars);
    email_body := public.render_whatsapp_template(email_tpl->>'body', vars);
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

  if profile_row.whatsapp_e164 is null or profile_row.whatsapp_opt_in_at is null then
    return null;
  end if;

  select t.body into template_body
  from public.whatsapp_message_templates t
  where t.barbershop_id = appt.barbershop_id
    and t.template_key = p_template_key;

  template_body := coalesce(template_body, public.default_whatsapp_template(p_template_key));
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
    profile_row.whatsapp_e164,
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

revoke all on function public.queue_appointment_whatsapp(uuid, text, timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- C) avisos manuais do barbeiro
-- ---------------------------------------------------------------------------

create table if not exists public.staff_client_notices (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  sent_by uuid not null references auth.users (id),
  preset text not null check (preset in (
    'reminder_next', 'confirm_today', 'slot_open', 'shop_hello'
  )),
  channels text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists staff_client_notices_rate_idx
  on public.staff_client_notices (barbershop_id, customer_id, created_at desc);

alter table public.staff_client_notices enable row level security;
revoke all on public.staff_client_notices from anon, authenticated;
grant select on public.staff_client_notices to authenticated;
grant all on public.staff_client_notices to service_role;

drop policy if exists staff_client_notices_select on public.staff_client_notices;
create policy staff_client_notices_select on public.staff_client_notices
  for select to authenticated
  using (
    public.is_platform_admin()
    or public.current_staff_id(barbershop_id) is not null
    or public.can_view_full_shop(barbershop_id)
  );

create or replace function public.send_client_notice(
  p_shop_id uuid,
  p_customer_id uuid,
  p_preset text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mine uuid;
  full_access boolean;
  served boolean;
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
  recent int;
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

  select count(*) into recent
  from public.staff_client_notices n
  where n.barbershop_id = p_shop_id
    and n.customer_id = p_customer_id
    and n.created_at > now() - interval '30 minutes';
  if recent > 0 then
    raise exception 'Aguarde 30 minutos para enviar outro aviso a este cliente.' using errcode = '22023';
  end if;

  select * into profile_row from public.profiles where id = p_customer_id;
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
    when_label := to_char(next_appt.starts_at at time zone coalesce(shop_row.timezone, 'America/Sao_Paulo'), 'DD/MM/YYYY às HH24:MI');
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
  values (p_shop_id, p_customer_id, auth.uid(), p_preset, channels);

  return jsonb_build_object('ok', true, 'channels', to_jsonb(channels));
end;
$$;

revoke all on function public.send_client_notice(uuid, uuid, text) from public, anon;
grant execute on function public.send_client_notice(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- E) booking_series
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.booking_series_kind as enum ('weekday', 'interval_days');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_series_exception_reason as enum (
    'skipped_busy', 'cancelled', 'rescheduled_out', 'series_stopped'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.booking_series (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  service_id uuid not null references public.services (id),
  staff_id uuid not null references public.staff (id),
  kind public.booking_series_kind not null,
  weekday smallint check (weekday between 0 and 6),
  interval_days smallint check (interval_days in (7, 15, 21)),
  local_time time not null,
  anchor_starts_at timestamptz not null,
  active boolean not null default true,
  created_by text not null check (created_by in ('customer', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_series_kind_fields check (
    (kind = 'weekday' and weekday is not null and interval_days is null)
    or (kind = 'interval_days' and interval_days is not null and weekday is null)
  )
);

create trigger booking_series_set_updated_at
  before update on public.booking_series
  for each row execute function public.set_updated_at();

create table if not exists public.booking_series_exceptions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.booking_series (id) on delete cascade,
  scheduled_date date not null,
  reason public.booking_series_exception_reason not null,
  created_at timestamptz not null default now(),
  unique (series_id, scheduled_date)
);

do $$ begin
  alter table public.appointments
    add constraint appointments_series_id_fkey
    foreign key (series_id) references public.booking_series (id) on delete set null;
exception when duplicate_object then null;
end $$;

alter table public.booking_series enable row level security;
alter table public.booking_series_exceptions enable row level security;
revoke all on public.booking_series from anon, authenticated;
revoke all on public.booking_series_exceptions from anon, authenticated;
grant select on public.booking_series, public.booking_series_exceptions to authenticated;
grant all on public.booking_series, public.booking_series_exceptions to service_role;

drop policy if exists booking_series_select on public.booking_series;
create policy booking_series_select on public.booking_series
  for select to authenticated
  using (
    customer_id = auth.uid()
    or public.is_platform_admin()
    or public.can_view_full_shop(barbershop_id)
    or public.current_staff_id(barbershop_id) is not null
  );

drop policy if exists booking_series_exceptions_select on public.booking_series_exceptions;
create policy booking_series_exceptions_select on public.booking_series_exceptions
  for select to authenticated
  using (
    exists (
      select 1 from public.booking_series s
      where s.id = series_id
        and (
          s.customer_id = auth.uid()
          or public.is_platform_admin()
          or public.can_view_full_shop(s.barbershop_id)
          or public.current_staff_id(s.barbershop_id) is not null
        )
    )
  );

create or replace function public.series_candidate_starts(
  p_series public.booking_series,
  p_from timestamptz,
  p_until timestamptz
)
returns setof timestamptz
language plpgsql
stable
as $$
declare
  shop_tz text;
  cursor_ts timestamptz;
  local_d date;
  candidate timestamptz;
begin
  select timezone into shop_tz from public.barbershops where id = p_series.barbershop_id;
  shop_tz := coalesce(shop_tz, 'America/Sao_Paulo');
  cursor_ts := greatest(p_series.anchor_starts_at, p_from);

  if p_series.kind = 'weekday' then
    local_d := (cursor_ts at time zone shop_tz)::date;
    -- Avança até o weekday alvo.
    while extract(dow from local_d) <> p_series.weekday loop
      local_d := local_d + 1;
    end loop;
    while true loop
      candidate := (local_d::timestamp + p_series.local_time) at time zone shop_tz;
      exit when candidate > p_until;
      if candidate >= p_from and candidate >= p_series.anchor_starts_at then
        return next candidate;
      end if;
      local_d := local_d + 7;
    end loop;
  else
    candidate := p_series.anchor_starts_at;
    while candidate < p_from loop
      candidate := candidate + make_interval(days => p_series.interval_days);
    end loop;
    while candidate <= p_until loop
      if candidate >= p_series.anchor_starts_at then
        return next candidate;
      end if;
      candidate := candidate + make_interval(days => p_series.interval_days);
    end loop;
  end if;
end;
$$;

create or replace function public.materialize_booking_series(
  p_series_id uuid,
  p_until timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  series public.booking_series%rowtype;
  horizon int;
  until_at timestamptz;
  candidate timestamptz;
  svc public.services%rowtype;
  ends_at timestamptz;
  local_date date;
  shop_tz text;
  created int := 0;
  busy boolean;
begin
  select * into series from public.booking_series where id = p_series_id and active;
  if series.id is null then return 0; end if;

  select coalesce(booking_horizon_days, 14) into horizon
  from public.barbershop_settings where barbershop_id = series.barbershop_id;
  horizon := greatest(7, least(coalesce(horizon, 14), 30));

  select timezone into shop_tz from public.barbershops where id = series.barbershop_id;
  shop_tz := coalesce(shop_tz, 'America/Sao_Paulo');
  until_at := coalesce(p_until, now() + make_interval(days => horizon));

  select * into svc from public.services where id = series.service_id;

  for candidate in
    select * from public.series_candidate_starts(series, now(), until_at)
  loop
    local_date := (candidate at time zone shop_tz)::date;
    if exists (
      select 1 from public.booking_series_exceptions e
      where e.series_id = series.id and e.scheduled_date = local_date
    ) then
      continue;
    end if;
    if exists (
      select 1 from public.appointments a
      where a.series_id = series.id
        and a.starts_at = candidate
        and a.status in ('pending', 'confirmed', 'completed', 'reschedule_requested')
    ) then
      continue;
    end if;

    ends_at := candidate + make_interval(mins => svc.duration_minutes);
    select exists (
      select 1
      from (
        select a.starts_at, a.ends_at
        from public.appointments a
        where a.staff_id = series.staff_id
          and a.status in ('pending', 'confirmed', 'completed')
          and a.starts_at < ends_at and a.ends_at > candidate
        union all
        select b.starts_at, b.ends_at
        from public.availability_blocks b
        where b.barbershop_id = series.barbershop_id
          and (b.staff_id is null or b.staff_id = series.staff_id)
          and b.starts_at < ends_at and b.ends_at > candidate
        union all
        select w.starts_at, w.ends_at
        from public.slot_waits w
        where w.staff_id = series.staff_id
          and w.state in ('holding', 'exclusive')
          and w.starts_at < ends_at and w.ends_at > candidate
      ) occupied
    ) into busy;

    if busy then
      insert into public.booking_series_exceptions (series_id, scheduled_date, reason)
      values (series.id, local_date, 'skipped_busy')
      on conflict (series_id, scheduled_date) do nothing;
      continue;
    end if;

    begin
      insert into public.appointments (
        barbershop_id, customer_id, service_id, staff_id,
        starts_at, ends_at, status, booked_price_cents, series_id
      ) values (
        series.barbershop_id, series.customer_id, series.service_id, series.staff_id,
        candidate, ends_at, 'confirmed', svc.price_cents, series.id
      );
      created := created + 1;
    exception when exclusion_violation or unique_violation or others then
      insert into public.booking_series_exceptions (series_id, scheduled_date, reason)
      values (series.id, local_date, 'skipped_busy')
      on conflict (series_id, scheduled_date) do nothing;
    end;
  end loop;

  return created;
end;
$$;

revoke all on function public.materialize_booking_series(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.materialize_booking_series(uuid, timestamptz) to service_role;

create or replace function public.create_booking_series(
  p_shop_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_kind text,
  p_interval_days int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  svc public.services%rowtype;
  st public.staff%rowtype;
  shop_tz text;
  local_time time;
  weekday smallint;
  series_id uuid;
  ends_at timestamptz;
  first_id uuid;
  created int;
  kind public.booking_series_kind;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not public.has_shop_role(p_shop_id, array['customer', 'shop_admin']::public.app_role[])
     and not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_kind = 'weekday' then
    kind := 'weekday';
  elsif p_kind = 'interval_days' and p_interval_days in (7, 15, 21) then
    kind := 'interval_days';
  else
    raise exception 'Tipo de recorrência inválido' using errcode = '22023';
  end if;

  select * into svc from public.services where id = p_service_id and barbershop_id = p_shop_id and active;
  select * into st from public.staff where id = p_staff_id and barbershop_id = p_shop_id and active;
  if svc.id is null or st.id is null then
    raise exception 'Serviço ou profissional inválido' using errcode = '22023';
  end if;

  select timezone into shop_tz from public.barbershops where id = p_shop_id;
  shop_tz := coalesce(shop_tz, 'America/Sao_Paulo');
  local_time := (p_starts_at at time zone shop_tz)::time;
  weekday := extract(dow from (p_starts_at at time zone shop_tz))::smallint;
  ends_at := p_starts_at + make_interval(mins => svc.duration_minutes);

  insert into public.booking_series (
    barbershop_id, customer_id, service_id, staff_id,
    kind, weekday, interval_days, local_time, anchor_starts_at, created_by
  ) values (
    p_shop_id, auth.uid(), p_service_id, p_staff_id,
    kind,
    case when kind = 'weekday' then weekday else null end,
    case when kind = 'interval_days' then p_interval_days else null end,
    local_time, p_starts_at, 'customer'
  )
  returning id into series_id;

  -- Primeira ocorrência (pode falhar por overlap → aborta série).
  begin
    insert into public.appointments (
      barbershop_id, customer_id, service_id, staff_id,
      starts_at, ends_at, status, booked_price_cents, series_id
    ) values (
      p_shop_id, auth.uid(), p_service_id, p_staff_id,
      p_starts_at, ends_at, 'confirmed', svc.price_cents, series_id
    )
    returning id into first_id;
  exception when others then
    delete from public.booking_series where id = series_id;
    raise;
  end;

  created := public.materialize_booking_series(series_id);

  return jsonb_build_object(
    'series_id', series_id,
    'first_appointment_id', first_id,
    'materialized', created
  );
end;
$$;

revoke all on function public.create_booking_series(uuid, uuid, uuid, timestamptz, text, int) from public, anon;
grant execute on function public.create_booking_series(uuid, uuid, uuid, timestamptz, text, int) to authenticated;

create or replace function public.stop_booking_series(p_series_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  series public.booking_series%rowtype;
  shop_tz text;
begin
  select * into series from public.booking_series where id = p_series_id;
  if series.id is null then return; end if;
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if series.customer_id <> auth.uid()
     and not public.is_platform_admin()
     and not public.can_view_full_shop(series.barbershop_id)
     and public.current_staff_id(series.barbershop_id) is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.booking_series set active = false where id = series.id;
  select timezone into shop_tz from public.barbershops where id = series.barbershop_id;

  update public.appointments a
  set status = 'cancelled'
  where a.series_id = series.id
    and a.status in ('pending', 'confirmed')
    and a.starts_at > now();

  insert into public.booking_series_exceptions (series_id, scheduled_date, reason)
  select series.id, (a.starts_at at time zone coalesce(shop_tz, 'America/Sao_Paulo'))::date, 'series_stopped'
  from public.appointments a
  where a.series_id = series.id and a.status = 'cancelled' and a.starts_at > now() - interval '1 minute'
  on conflict (series_id, scheduled_date) do update set reason = excluded.reason;
end;
$$;

revoke all on function public.stop_booking_series(uuid) from public, anon;
grant execute on function public.stop_booking_series(uuid) to authenticated;

create or replace function public.extend_booking_series()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  total int := 0;
begin
  for s in select id from public.booking_series where active loop
    total := total + public.materialize_booking_series(s.id);
  end loop;
  return total;
end;
$$;

revoke all on function public.extend_booking_series() from public, anon, authenticated;
grant execute on function public.extend_booking_series() to service_role;

-- Ao cancelar uma ocorrência de série, registra exception.
create or replace function public.appointments_series_cancel_exception()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_tz text;
begin
  if new.series_id is not null
     and new.status = 'cancelled'
     and old.status is distinct from 'cancelled' then
    select timezone into shop_tz from public.barbershops where id = new.barbershop_id;
    insert into public.booking_series_exceptions (series_id, scheduled_date, reason)
    values (
      new.series_id,
      (new.starts_at at time zone coalesce(shop_tz, 'America/Sao_Paulo'))::date,
      'cancelled'
    )
    on conflict (series_id, scheduled_date) do update set reason = 'cancelled';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_series_cancel_exception_trg on public.appointments;
create trigger appointments_series_cancel_exception_trg
  after update of status on public.appointments
  for each row execute function public.appointments_series_cancel_exception();

create or replace function public.get_team_schedule(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  mine uuid;
  full_access boolean;
begin
  if auth.uid() is null or not (
    public.is_platform_admin()
    or public.has_shop_member_role(
      p_shop_id,
      array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
    )
    or public.has_shop_role(p_shop_id, array['shop_admin']::public.app_role[])
  ) then
    raise exception 'Not allowed';
  end if;
  mine := public.current_staff_id(p_shop_id);
  full_access := public.can_view_full_shop(p_shop_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'staff_id', a.staff_id,
      'staff_name', st.display_name,
      'starts_at', a.starts_at,
      'ends_at', a.ends_at,
      'status', a.status,
      'series_id', a.series_id,
      'is_own', a.staff_id = mine,
      'customer_name', case when full_access or a.staff_id = mine then p.full_name else null end,
      'service_name', case when full_access or a.staff_id = mine then s.name else null end,
      'price_cents', case when full_access or a.staff_id = mine then coalesce(a.booked_price_cents, s.price_cents) else null end,
      'visibility', case when full_access or a.staff_id = mine then 'full' else 'busy' end
    ) order by a.starts_at)
    from public.appointments a
    join public.staff st on st.id = a.staff_id
    join public.services s on s.id = a.service_id
    join public.profiles p on p.id = a.customer_id
    where a.barbershop_id = p_shop_id
      and a.starts_at >= p_from
      and a.starts_at < p_to
      and a.status <> 'cancelled'
  ), '[]'::jsonb);
end;
$$;

notify pgrst, 'reload schema';
