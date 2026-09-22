-- WhatsApp via Evolution API (fase 1): canal por loja, outbox, telefone no perfil, OTP.

create type public.whatsapp_channel_status as enum (
  'disconnected',
  'qr',
  'connecting',
  'open'
);

create type public.whatsapp_outbox_status as enum (
  'pending',
  'sending',
  'sent',
  'failed'
);

create type public.auth_otp_channel as enum ('whatsapp', 'email');
create type public.auth_otp_purpose as enum ('login', 'recovery');

alter table public.profiles
  add column if not exists whatsapp_e164 text,
  add column if not exists whatsapp_opt_in_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_whatsapp_e164_format;

alter table public.profiles
  add constraint profiles_whatsapp_e164_format
  check (
    whatsapp_e164 is null
    or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'
  );

create table if not exists public.whatsapp_channels (
  barbershop_id uuid primary key references public.barbershops(id) on delete cascade,
  instance_name text not null,
  status public.whatsapp_channel_status not null default 'disconnected',
  display_phone text,
  enabled boolean not null default true,
  notify_booking boolean not null default true,
  notify_reminder boolean not null default true,
  reminder_hours_before int not null default 24
    check (reminder_hours_before between 1 and 168),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_channels_instance_format
    check (instance_name ~ '^[a-z0-9][a-z0-9_-]{2,62}$')
);

create unique index if not exists whatsapp_channels_instance_name_uidx
  on public.whatsapp_channels (instance_name);

create trigger whatsapp_channels_set_updated_at
  before update on public.whatsapp_channels
  for each row execute function public.set_updated_at();

create table if not exists public.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  to_e164 text not null,
  template_key text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.whatsapp_outbox_status not null default 'pending',
  provider_message_id text,
  error text,
  attempts int not null default 0,
  dedupe_key text not null,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint whatsapp_outbox_to_e164_format
    check (to_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create unique index if not exists whatsapp_outbox_dedupe_uidx
  on public.whatsapp_outbox (dedupe_key);

create index if not exists whatsapp_outbox_pending_idx
  on public.whatsapp_outbox (scheduled_at, created_at)
  where status = 'pending';

create index if not exists whatsapp_outbox_shop_idx
  on public.whatsapp_outbox (barbershop_id, created_at desc);

create table if not exists public.auth_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  channel public.auth_otp_channel not null,
  destination text not null,
  code_hash text not null,
  purpose public.auth_otp_purpose not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_otp_challenges_dest_idx
  on public.auth_otp_challenges (destination, created_at desc);

create index if not exists auth_otp_challenges_open_idx
  on public.auth_otp_challenges (barbershop_id, destination)
  where consumed_at is null;

-- Quem pode gerir o canal WhatsApp da loja (dono/sócio ou admin legado/plataforma).
create or replace function public.shop_can_manage_whatsapp(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or public.has_shop_role(p_shop_id, array['shop_admin']::public.app_role[])
    or exists (
      select 1
      from public.shop_members m
      where m.barbershop_id = p_shop_id
        and m.user_id = auth.uid()
        and m.active
        and m.role in ('owner', 'partner')
    );
$$;

revoke all on function public.shop_can_manage_whatsapp(uuid) from public, anon;
grant execute on function public.shop_can_manage_whatsapp(uuid) to authenticated;

alter table public.whatsapp_channels enable row level security;
alter table public.whatsapp_outbox enable row level security;
alter table public.auth_otp_challenges enable row level security;

revoke all on public.whatsapp_channels from anon, authenticated;
revoke all on public.whatsapp_outbox from anon, authenticated;
revoke all on public.auth_otp_challenges from anon, authenticated;

grant select, insert, update on public.whatsapp_channels to authenticated;
grant select on public.whatsapp_outbox to authenticated;

drop policy if exists whatsapp_channels_select on public.whatsapp_channels;
create policy whatsapp_channels_select on public.whatsapp_channels
  for select to authenticated
  using (public.shop_can_manage_whatsapp(barbershop_id));

drop policy if exists whatsapp_channels_insert on public.whatsapp_channels;
create policy whatsapp_channels_insert on public.whatsapp_channels
  for insert to authenticated
  with check (public.shop_can_manage_whatsapp(barbershop_id));

drop policy if exists whatsapp_channels_update on public.whatsapp_channels;
create policy whatsapp_channels_update on public.whatsapp_channels
  for update to authenticated
  using (public.shop_can_manage_whatsapp(barbershop_id))
  with check (public.shop_can_manage_whatsapp(barbershop_id));

-- Outbox: loja vê o próprio histórico; escrita só via funções security definer / service role.
drop policy if exists whatsapp_outbox_select on public.whatsapp_outbox;
create policy whatsapp_outbox_select on public.whatsapp_outbox
  for select to authenticated
  using (public.shop_can_manage_whatsapp(barbershop_id));

-- Enfileira mensagem se canal ativo, opt-in e número válidos.
create or replace function public.enqueue_whatsapp_message(
  p_shop_id uuid,
  p_to_e164 text,
  p_template_key text,
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
  channel public.whatsapp_channels%rowtype;
  message_id uuid;
begin
  if p_to_e164 is null or p_to_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    return null;
  end if;

  select * into channel
  from public.whatsapp_channels
  where barbershop_id = p_shop_id;

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
$$;

revoke all on function public.enqueue_whatsapp_message(uuid, text, text, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.enqueue_whatsapp_message(uuid, text, text, text, text, jsonb, timestamptz)
  to service_role;

-- Monta texto amigável e enfileira a partir de um atendimento.
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
  body text;
  dedupe text;
begin
  select * into appt from public.appointments where id = p_appointment_id;
  if appt.id is null then return null; end if;

  select * into profile_row from public.profiles where id = appt.customer_id;
  if profile_row.whatsapp_e164 is null or profile_row.whatsapp_opt_in_at is null then
    return null;
  end if;

  select * into shop_row from public.barbershops where id = appt.barbershop_id;
  select name into service_name from public.services where id = appt.service_id;
  select display_name into staff_name from public.staff where id = appt.staff_id;

  when_label := to_char(appt.starts_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI');

  body := case p_template_key
    when 'booking.confirmed' then
      format(
        E'%s\nSeu horário está confirmado.\n%s com %s\n%s',
        coalesce(shop_row.name, 'Barbearia'),
        coalesce(service_name, 'Serviço'),
        coalesce(staff_name, 'profissional'),
        when_label
      )
    when 'booking.cancelled' then
      format(
        E'%s\nSeu horário foi cancelado.\n%s — %s',
        coalesce(shop_row.name, 'Barbearia'),
        coalesce(service_name, 'Serviço'),
        when_label
      )
    when 'booking.rescheduled' then
      format(
        E'%s\nSeu horário foi remarcado.\n%s com %s\nNovo horário: %s',
        coalesce(shop_row.name, 'Barbearia'),
        coalesce(service_name, 'Serviço'),
        coalesce(staff_name, 'profissional'),
        when_label
      )
    when 'booking.reminder' then
      format(
        E'%s\nLembrete do seu horário.\n%s com %s\n%s',
        coalesce(shop_row.name, 'Barbearia'),
        coalesce(service_name, 'Serviço'),
        coalesce(staff_name, 'profissional'),
        when_label
      )
    else
      format(E'%s\nAtualização do seu horário em %s.', coalesce(shop_row.name, 'Barbearia'), when_label)
  end;

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

create or replace function public.appointments_whatsapp_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status in ('pending', 'confirmed') then
    perform public.queue_appointment_whatsapp(new.id, 'booking.confirmed', now());
  elsif tg_op = 'UPDATE' then
    if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      perform public.queue_appointment_whatsapp(new.id, 'booking.cancelled', now());
    elsif new.status in ('pending', 'confirmed')
      and (
        old.starts_at is distinct from new.starts_at
        or old.staff_id is distinct from new.staff_id
        or old.service_id is distinct from new.service_id
      ) then
      perform public.queue_appointment_whatsapp(new.id, 'booking.rescheduled', now());
    elsif new.status = 'confirmed' and old.status = 'pending' then
      perform public.queue_appointment_whatsapp(new.id, 'booking.confirmed', now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_whatsapp_notify_trg on public.appointments;
create trigger appointments_whatsapp_notify_trg
  after insert or update of status, starts_at, staff_id, service_id
  on public.appointments
  for each row execute function public.appointments_whatsapp_notify();

-- Lembretes: enfileira para horários nas próximas N horas (conforme canal).
create or replace function public.process_whatsapp_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  queued int := 0;
  candidate record;
  message_id uuid;
begin
  for candidate in
    select
      a.id as appointment_id,
      a.starts_at - make_interval(hours => c.reminder_hours_before) as remind_at
    from public.appointments a
    join public.whatsapp_channels c on c.barbershop_id = a.barbershop_id
    join public.profiles p on p.id = a.customer_id
    where c.enabled
      and c.status = 'open'
      and c.notify_reminder
      and a.status in ('pending', 'confirmed')
      and p.whatsapp_e164 is not null
      and p.whatsapp_opt_in_at is not null
      and a.starts_at > now()
      and a.starts_at - make_interval(hours => c.reminder_hours_before) <= now()
      and a.starts_at - make_interval(hours => c.reminder_hours_before) > now() - interval '2 hours'
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
$$;

revoke all on function public.process_whatsapp_reminders() from public, anon, authenticated;

-- Claim de lote para o worker (service role).
create or replace function public.claim_whatsapp_outbox(p_limit int default 20)
returns setof public.whatsapp_outbox
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.claim_whatsapp_outbox(int) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_outbox(int) to service_role;

create or replace function public.complete_whatsapp_outbox(
  p_id uuid,
  p_ok boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.whatsapp_outbox
  set
    status = case when p_ok then 'sent'::public.whatsapp_outbox_status else 'failed'::public.whatsapp_outbox_status end,
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    error = case when p_ok then null else left(coalesce(p_error, 'send failed'), 500) end,
    sent_at = case when p_ok then now() else sent_at end
  where id = p_id;
end;
$$;

revoke all on function public.complete_whatsapp_outbox(uuid, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_whatsapp_outbox(uuid, boolean, text, text) to service_role;

revoke all on function public.process_whatsapp_reminders() from public, anon, authenticated;
grant execute on function public.process_whatsapp_reminders() to service_role;

-- Normaliza telefone BR para E.164 (+55…).
create or replace function public.normalize_br_whatsapp(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  if p_raw is null then return null; end if;
  digits := regexp_replace(p_raw, '\D', '', 'g');
  if digits = '' then return null; end if;
  if left(digits, 2) = '55' and length(digits) between 12 and 13 then
    return '+' || digits;
  end if;
  if length(digits) in (10, 11) then
    return '+55' || digits;
  end if;
  if left(p_raw, 1) = '+' and p_raw ~ '^\+[1-9][0-9]{7,14}$' then
    return p_raw;
  end if;
  return null;
end;
$$;

revoke all on function public.normalize_br_whatsapp(text) from public, anon;
grant execute on function public.normalize_br_whatsapp(text) to authenticated;

create or replace function public.save_my_whatsapp(p_raw text, p_opt_in boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  result public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  normalized := public.normalize_br_whatsapp(p_raw);
  if p_opt_in and normalized is null then
    raise exception 'Informe um WhatsApp válido com DDD' using errcode = '22023';
  end if;

  update public.profiles
  set
    whatsapp_e164 = normalized,
    whatsapp_opt_in_at = case when p_opt_in then coalesce(whatsapp_opt_in_at, now()) else null end,
    updated_at = now()
  where id = auth.uid()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.save_my_whatsapp(text, boolean) from public, anon;
grant execute on function public.save_my_whatsapp(text, boolean) to authenticated;

notify pgrst, 'reload schema';
