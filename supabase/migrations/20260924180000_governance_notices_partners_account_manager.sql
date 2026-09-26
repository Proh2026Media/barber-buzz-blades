-- Governança: avisos pendentes 30min, sociedade (co-dono), sugestões de parceiro,
-- branding só sociedade, booking favorito/aleatório, gerente de conta + TTL.

-- =============================================================================
-- A) Fila de avisos pendentes (último gatilho) + auto-envio após 30 min
-- =============================================================================

create table if not exists public.staff_client_notice_pending (
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  preset text not null check (preset in ('reminder_next', 'confirm_today', 'slot_open', 'shop_hello')),
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  primary key (barbershop_id, customer_id)
);

create index if not exists staff_client_notice_pending_requested_idx
  on public.staff_client_notice_pending (requested_at);

alter table public.staff_client_notice_pending enable row level security;
revoke all on public.staff_client_notice_pending from anon, authenticated;
grant select on public.staff_client_notice_pending to authenticated;
grant all on public.staff_client_notice_pending to service_role;

drop policy if exists staff_client_notice_pending_select on public.staff_client_notice_pending;
create policy staff_client_notice_pending_select on public.staff_client_notice_pending
  for select to authenticated using (
    public.is_platform_admin()
    or public.has_shop_member_role(
      barbershop_id,
      array['owner','partner','associate','employee']::public.shop_member_role[]
    )
  );

-- Núcleo compartilhado: monta e envia o aviso (sem checar cooldown).
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
$$;

revoke all on function public.deliver_client_notice(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.deliver_client_notice(uuid, uuid, text, uuid) to service_role;

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
$$;

revoke all on function public.send_client_notice(uuid, uuid, text) from public, anon;
grant execute on function public.send_client_notice(uuid, uuid, text) to authenticated;

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
    exception when others then
      -- Mantém pendente para nova tentativa; falha de canal não derruba o lote.
      null;
    end;
  end loop;
  return processed;
end;
$$;

revoke all on function public.process_pending_client_notices() from public, anon, authenticated;
grant execute on function public.process_pending_client_notices() to service_role;

create or replace function public.get_client_notice_pending(
  p_shop_id uuid,
  p_customer_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pending public.staff_client_notice_pending%rowtype;
  last_sent timestamptz;
  wait_seconds int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not (
    public.is_platform_admin()
    or public.has_shop_member_role(
      p_shop_id,
      array['owner','partner','associate','employee']::public.shop_member_role[]
    )
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into pending
  from public.staff_client_notice_pending
  where barbershop_id = p_shop_id and customer_id = p_customer_id;

  select max(n.created_at) into last_sent
  from public.staff_client_notices n
  where n.barbershop_id = p_shop_id and n.customer_id = p_customer_id;

  if last_sent is not null and last_sent > now() - interval '30 minutes' then
    wait_seconds := greatest(
      0,
      extract(epoch from (last_sent + interval '30 minutes' - now()))::int
    );
  end if;

  if pending.customer_id is null and wait_seconds = 0 then
    return jsonb_build_object('pending', null, 'wait_seconds', 0);
  end if;

  return jsonb_build_object(
    'pending', case when pending.customer_id is null then null else jsonb_build_object(
      'preset', pending.preset,
      'requested_at', pending.requested_at
    ) end,
    'wait_seconds', wait_seconds
  );
end;
$$;

revoke all on function public.get_client_notice_pending(uuid, uuid) from public, anon;
grant execute on function public.get_client_notice_pending(uuid, uuid) to authenticated;

-- =============================================================================
-- B) Booking: favorito + modo de atribuição
-- =============================================================================

alter table public.barbershop_settings
  add column if not exists staff_assignment_mode text not null default 'client_pick'
    check (staff_assignment_mode in ('client_pick', 'favorite_then_pick', 'random_available'));

create table if not exists public.customer_shop_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  favorite_staff_id uuid references public.staff(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, barbershop_id)
);

create index if not exists customer_shop_preferences_shop_idx
  on public.customer_shop_preferences (barbershop_id);

alter table public.customer_shop_preferences enable row level security;
revoke all on public.customer_shop_preferences from anon;
grant select, insert, update, delete on public.customer_shop_preferences to authenticated;
grant all on public.customer_shop_preferences to service_role;

drop policy if exists customer_shop_preferences_own on public.customer_shop_preferences;
create policy customer_shop_preferences_own on public.customer_shop_preferences
  for all to authenticated
  using (user_id = auth.uid() or public.is_platform_admin())
  with check (user_id = auth.uid() or public.is_platform_admin());

create or replace function public.set_favorite_staff(
  p_shop_id uuid,
  p_staff_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_staff_id is not null and not exists (
    select 1 from public.staff s
    where s.id = p_staff_id and s.barbershop_id = p_shop_id and s.active
  ) then
    raise exception 'Profissional inválido' using errcode = '22023';
  end if;

  insert into public.customer_shop_preferences (user_id, barbershop_id, favorite_staff_id, updated_at)
  values (auth.uid(), p_shop_id, p_staff_id, now())
  on conflict (user_id, barbershop_id) do update
    set favorite_staff_id = excluded.favorite_staff_id,
        updated_at = now();

  return jsonb_build_object('ok', true, 'favorite_staff_id', p_staff_id);
end;
$$;

revoke all on function public.set_favorite_staff(uuid, uuid) from public, anon;
grant execute on function public.set_favorite_staff(uuid, uuid) to authenticated;

create or replace function public.pick_available_staff(
  p_shop_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_prefer_staff_id uuid default null
) returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  chosen uuid;
begin
  if p_prefer_staff_id is not null
     and exists (
       select 1 from public.staff s
       where s.id = p_prefer_staff_id and s.barbershop_id = p_shop_id and s.active
     )
     and not exists (
       select 1 from public.appointments a
       where a.staff_id = p_prefer_staff_id
         and a.status in ('pending', 'confirmed')
         and a.starts_at < p_ends_at
         and a.ends_at > p_starts_at
     )
  then
    return p_prefer_staff_id;
  end if;

  select s.id into chosen
  from public.staff s
  where s.barbershop_id = p_shop_id
    and s.active
    and exists (
      select 1 from public.staff_services ss
      where ss.staff_id = s.id and ss.service_id = p_service_id and ss.active
    )
    and not exists (
      select 1 from public.appointments a
      where a.staff_id = s.id
        and a.status in ('pending', 'confirmed')
        and a.starts_at < p_ends_at
        and a.ends_at > p_starts_at
    )
  order by random()
  limit 1;

  return chosen;
end;
$$;

revoke all on function public.pick_available_staff(uuid, uuid, timestamptz, timestamptz, uuid)
  from public, anon;
grant execute on function public.pick_available_staff(uuid, uuid, timestamptz, timestamptz, uuid)
  to authenticated, service_role;

-- =============================================================================
-- C) Sugestões entre parceiros
-- =============================================================================

create table if not exists public.partner_catalog_suggestions (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  from_staff_id uuid not null references public.staff(id) on delete cascade,
  to_staff_id uuid references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  proposed_price_cents int not null check (proposed_price_cents >= 0),
  proposed_duration_minutes int not null check (proposed_duration_minutes > 0),
  proposed_display_name text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists partner_catalog_suggestions_to_idx
  on public.partner_catalog_suggestions (to_staff_id, status)
  where status = 'pending';

create index if not exists partner_catalog_suggestions_shop_idx
  on public.partner_catalog_suggestions (barbershop_id, created_at desc);

alter table public.partner_catalog_suggestions enable row level security;
revoke all on public.partner_catalog_suggestions from anon;
grant select, insert, update on public.partner_catalog_suggestions to authenticated;
grant all on public.partner_catalog_suggestions to service_role;

drop policy if exists partner_catalog_suggestions_select on public.partner_catalog_suggestions;
create policy partner_catalog_suggestions_select on public.partner_catalog_suggestions
  for select to authenticated using (
    public.is_platform_admin()
    or public.has_shop_member_role(
      barbershop_id,
      array['owner','partner','associate']::public.shop_member_role[]
    )
  );

drop policy if exists partner_catalog_suggestions_insert on public.partner_catalog_suggestions;
create policy partner_catalog_suggestions_insert on public.partner_catalog_suggestions
  for insert to authenticated with check (
    public.current_staff_id(barbershop_id) = from_staff_id
    and public.has_shop_member_role(barbershop_id, array['associate']::public.shop_member_role[])
  );

drop policy if exists partner_catalog_suggestions_update on public.partner_catalog_suggestions;
create policy partner_catalog_suggestions_update on public.partner_catalog_suggestions
  for update to authenticated using (
    public.current_staff_id(barbershop_id) = to_staff_id
    or (to_staff_id is null and public.has_shop_member_role(
      barbershop_id, array['associate']::public.shop_member_role[]
    ))
  );

create or replace function public.suggest_partner_catalog(
  p_shop_id uuid,
  p_service_id uuid,
  p_price_cents int,
  p_duration_minutes int,
  p_display_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mine uuid;
  peer record;
  created int := 0;
begin
  mine := public.current_staff_id(p_shop_id);
  if mine is null or not public.has_shop_member_role(
    p_shop_id, array['associate']::public.shop_member_role[]
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  for peer in
    select sm.staff_id
    from public.shop_members sm
    where sm.barbershop_id = p_shop_id
      and sm.active
      and sm.role = 'associate'
      and sm.staff_id <> mine
  loop
    insert into public.partner_catalog_suggestions (
      barbershop_id, from_staff_id, to_staff_id, service_id,
      proposed_price_cents, proposed_duration_minutes, proposed_display_name
    ) values (
      p_shop_id, mine, peer.staff_id, p_service_id,
      p_price_cents, p_duration_minutes, nullif(trim(p_display_name), '')
    );
    created := created + 1;
  end loop;

  return jsonb_build_object('ok', true, 'created', created);
end;
$$;

revoke all on function public.suggest_partner_catalog(uuid, uuid, int, int, text) from public, anon;
grant execute on function public.suggest_partner_catalog(uuid, uuid, int, int, text) to authenticated;

create or replace function public.decide_partner_catalog_suggestion(
  p_suggestion_id uuid,
  p_accept boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sug public.partner_catalog_suggestions%rowtype;
  mine uuid;
begin
  select * into sug from public.partner_catalog_suggestions where id = p_suggestion_id for update;
  if sug.id is null or sug.status <> 'pending' then
    raise exception 'Sugestão não encontrada' using errcode = 'P0002';
  end if;
  mine := public.current_staff_id(sug.barbershop_id);
  if mine is null or (sug.to_staff_id is not null and sug.to_staff_id <> mine) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_accept then
    insert into public.staff_services (
      barbershop_id, staff_id, service_id, display_name, duration_minutes, price_cents, active
    ) values (
      sug.barbershop_id, mine, sug.service_id, sug.proposed_display_name,
      sug.proposed_duration_minutes, sug.proposed_price_cents, true
    )
    on conflict (staff_id, service_id) do update
      set display_name = excluded.display_name,
          duration_minutes = excluded.duration_minutes,
          price_cents = excluded.price_cents,
          active = true,
          updated_at = now();
    update public.partner_catalog_suggestions
      set status = 'accepted', decided_at = now()
      where id = sug.id;
    return jsonb_build_object('status', 'accepted');
  end if;

  update public.partner_catalog_suggestions
    set status = 'dismissed', decided_at = now()
    where id = sug.id;
  return jsonb_build_object('status', 'dismissed');
end;
$$;

revoke all on function public.decide_partner_catalog_suggestion(uuid, boolean) from public, anon;
grant execute on function public.decide_partner_catalog_suggestion(uuid, boolean) to authenticated;

-- =============================================================================
-- D) WhatsApp por parceiro (canal opcional por staff)
-- =============================================================================

alter table public.whatsapp_channels
  add column if not exists staff_id uuid references public.staff(id) on delete cascade;

-- Loja: um canal sem staff; parceiro: um canal por staff.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'whatsapp_channels_pkey'
      and conrelid = 'public.whatsapp_channels'::regclass
  ) then
    alter table public.whatsapp_channels drop constraint whatsapp_channels_pkey;
  end if;
exception when others then null;
end $$;

alter table public.whatsapp_channels
  add column if not exists id uuid default gen_random_uuid();

update public.whatsapp_channels set id = gen_random_uuid() where id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'whatsapp_channels_pkey'
      and conrelid = 'public.whatsapp_channels'::regclass
  ) then
    alter table public.whatsapp_channels add primary key (id);
  end if;
exception when others then null;
end $$;

create unique index if not exists whatsapp_channels_shop_default_uidx
  on public.whatsapp_channels (barbershop_id) where staff_id is null;
create unique index if not exists whatsapp_channels_staff_uidx
  on public.whatsapp_channels (barbershop_id, staff_id) where staff_id is not null;

-- Preferir canal do staff do payload; senão canal da loja.
create or replace function public.enqueue_whatsapp_message(
  p_shop_id uuid,
  p_to_e164 text,
  p_template_key text,
  p_body text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb,
  p_scheduled_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  channel public.whatsapp_channels%rowtype;
  message_id uuid;
  prefer_staff uuid;
begin
  prefer_staff := nullif(p_payload->>'staff_id', '')::uuid;

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
$$;

revoke all on function public.enqueue_whatsapp_message(uuid, text, text, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.enqueue_whatsapp_message(uuid, text, text, text, text, jsonb, timestamptz)
  to service_role;

-- =============================================================================
-- D2) Gerente de conta — helpers (antes do guard de branding)
-- =============================================================================

alter table public.memberships drop constraint if exists memberships_shop_required_for_non_platform;
alter table public.memberships
  add constraint memberships_shop_required_for_non_platform check (
    (role in ('platform_admin', 'account_manager') and barbershop_id is null)
    or (role not in ('platform_admin', 'account_manager') and barbershop_id is not null)
  );

create unique index if not exists memberships_account_manager_once_idx
  on public.memberships (user_id) where role = 'account_manager';

create table if not exists public.account_manager_shops (
  user_id uuid not null references auth.users(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  can_view_dashboard boolean not null default false,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, barbershop_id)
);

create index if not exists account_manager_shops_shop_idx
  on public.account_manager_shops (barbershop_id);

alter table public.account_manager_shops enable row level security;
revoke all on public.account_manager_shops from anon;
grant select on public.account_manager_shops to authenticated;
grant all on public.account_manager_shops to service_role;

create or replace function public.is_account_manager_of(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_manager_shops ams
    join public.memberships m on m.user_id = ams.user_id and m.role = 'account_manager'
    where ams.user_id = auth.uid()
      and ams.barbershop_id = p_shop_id
  );
$$;

revoke all on function public.is_account_manager_of(uuid) from public;
grant execute on function public.is_account_manager_of(uuid) to authenticated, service_role;

drop policy if exists account_manager_shops_select on public.account_manager_shops;
create policy account_manager_shops_select on public.account_manager_shops
  for select to authenticated using (
    public.is_platform_admin()
    or user_id = auth.uid()
    or public.has_shop_member_role(barbershop_id, array['owner','partner']::public.shop_member_role[])
  );

drop policy if exists account_manager_shops_admin on public.account_manager_shops;
create policy account_manager_shops_admin on public.account_manager_shops
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- =============================================================================
-- E) Branding só sociedade (revoga parceiro)
-- =============================================================================

create or replace function public.guard_protected_shop_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare sid uuid; is_visual boolean := false;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if current_setting('app.approved_shop_change', true) = 'on' or public.is_platform_admin() then
    return coalesce(new, old);
  end if;
  -- Gerente de conta: nunca aplica direto (só via pedido aprovado).
  if public.is_account_manager_of(coalesce(new.barbershop_id, old.barbershop_id))
    and not public.is_platform_admin() then
    raise exception 'Gerente de conta precisa de aprovação do dono' using errcode='42501',
      hint='Use request_shop_change';
  end if;
  sid := coalesce(new.barbershop_id, old.barbershop_id);
  if tg_table_name = 'barbershop_settings' and tg_op = 'UPDATE' then
    is_visual := public.settings_change_is_visual(old, new);
  end if;
  -- Visual só para dono/co-dono (não parceiro).
  if is_visual and public.has_shop_member_role(
    sid, array['owner','partner']::public.shop_member_role[]
  ) then
    if public.can_apply_protected_change(sid) then return new; end if;
    if public.shop_governance_mode(sid) in ('equal', 'majority') then
      raise exception 'Esta mudança precisa da aprovação do outro sócio' using errcode='42501',
        hint='Use request_shop_change';
    end if;
    raise exception 'Somente o sócio majoritário pode realizar esta mudança' using errcode='42501';
  end if;
  if public.has_shop_member_role(sid, array['owner','partner']::public.shop_member_role[]) then
    if public.can_apply_protected_change(sid) then return coalesce(new, old); end if;
    if public.shop_governance_mode(sid) in ('equal', 'majority') then
      raise exception 'Esta mudança precisa da aprovação do outro sócio' using errcode='42501',
        hint='Use request_shop_change';
    end if;
    raise exception 'Somente o sócio majoritário pode realizar esta mudança' using errcode='42501';
  end if;
  raise exception 'Sem permissão para alterar este item' using errcode='42501';
end $$;

drop policy if exists "Shop members update settings" on public.barbershop_settings;
create policy "Shop members update settings" on public.barbershop_settings for update to authenticated using(
  public.is_platform_admin()
  or public.has_shop_member_role(barbershop_id, array['owner','partner']::public.shop_member_role[])
  or public.is_account_manager_of(barbershop_id)
) with check(
  public.is_platform_admin()
  or public.has_shop_member_role(barbershop_id, array['owner','partner']::public.shop_member_role[])
  or public.is_account_manager_of(barbershop_id)
);

-- =============================================================================
-- F) Sociedade: múltiplos co-donos (owner), minoria propõe, signup type
-- =============================================================================

alter table public.barbershops
  add column if not exists society_intent text
    check (society_intent is null or society_intent in ('single', 'majority', 'equal', 'minority'));

-- Aceitar vários owners (co-donos); pelo menos um owner; soma 100%.
create or replace function public.validate_shop_ownership()
returns trigger language plpgsql set search_path=public as $$
declare target uuid; total numeric; leaders int;
begin
  target:=coalesce(new.barbershop_id,old.barbershop_id);
  select coalesce(sum(ownership_percent),0),
         count(*) filter(where role in ('owner','partner'))
    into total, leaders
  from public.shop_members
  where barbershop_id=target and active and role in ('owner','partner');
  if leaders = 0 then
    raise exception 'A loja precisa de ao menos um dono ativo' using errcode='23514';
  end if;
  if total<>100 then
    raise exception 'Active ownership must total 100%% (current: %)',total using errcode='23514';
  end if;
  return null;
end $$;

-- Migra sócios (partner) → co-dono (owner), preservando %.
do $$
declare r record;
begin
  for r in
    select id, barbershop_id from public.shop_members where role = 'partner' and active
  loop
    update public.shop_members set role = 'owner', updated_at = now() where id = r.id;
  end loop;
end $$;

-- Pedidos de mudança: TTL, source, checklist.
alter table public.shop_change_requests
  add column if not exists expires_at timestamptz,
  add column if not exists source text not null default 'society'
    check (source in ('society', 'account_manager', 'majority_log')),
  add column if not exists checklist jsonb not null default '[]'::jsonb;

create or replace function public.request_shop_change(
  p_shop_id uuid,
  p_kind text,
  p_payload jsonb,
  p_source text default 'society',
  p_ttl_minutes int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id uuid;
  mode text;
  ttl int;
  is_mgr boolean := false;
  checklist jsonb;
begin
  is_mgr := public.is_account_manager_of(p_shop_id);
  if not public.has_shop_member_role(p_shop_id, array['owner','partner']::public.shop_member_role[])
     and not public.is_platform_admin()
     and not is_mgr then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  mode := public.shop_governance_mode(p_shop_id);
  checklist := coalesce(p_payload->'checklist', jsonb_build_array(
    jsonb_build_object('kind', p_kind, 'summary', coalesce(p_payload->>'summary', p_kind))
  ));

  -- Gerente de conta sempre cria pedido com TTL 30 min.
  if is_mgr and not public.is_platform_admin() then
    ttl := coalesce(p_ttl_minutes, 30);
    insert into public.shop_change_requests(
      barbershop_id, requested_by, kind, payload, source, expires_at, checklist
    ) values (
      p_shop_id, auth.uid(), p_kind, p_payload, 'account_manager',
      now() + make_interval(mins => ttl), checklist
    ) returning id into request_id;
    return jsonb_build_object(
      'status', 'pending',
      'request_id', request_id,
      'expires_at', now() + make_interval(mins => ttl)
    );
  end if;

  if public.can_apply_protected_change(p_shop_id) then
    perform public.apply_shop_change(p_shop_id, p_kind, p_payload);
    -- Log checklist para majoritário (auditoria / popup).
    insert into public.shop_change_requests(
      barbershop_id, requested_by, kind, payload, status, source, checklist,
      decided_at, applied_at, approved_by
    ) values (
      p_shop_id, auth.uid(), p_kind, p_payload, 'approved', 'majority_log', checklist,
      now(), now(), auth.uid()
    );
    return jsonb_build_object('status', 'applied');
  end if;

  -- Minoria (majority mode) e igualitário: abrem pedido pendente.
  if mode not in ('equal', 'majority') then
    raise exception 'Somente o sócio majoritário pode realizar esta mudança' using errcode='42501';
  end if;

  ttl := p_ttl_minutes; -- sociedade sem TTL por padrão
  insert into public.shop_change_requests(
    barbershop_id, requested_by, kind, payload, source, expires_at, checklist
  ) values (
    p_shop_id, auth.uid(), p_kind, p_payload, coalesce(nullif(p_source, ''), 'society'),
    case when ttl is null then null else now() + make_interval(mins => ttl) end,
    checklist
  ) returning id into request_id;

  return jsonb_build_object('status', 'pending', 'request_id', request_id);
end;
$$;

-- Compat: assinatura antiga (3 args) continua via default nos novos parâmetros.
-- Recria grants.
revoke all on function public.request_shop_change(uuid, text, jsonb, text, int) from public, anon;
grant execute on function public.request_shop_change(uuid, text, jsonb, text, int) to authenticated;

-- Mantém overload de 3 args apontando para a nova.
create or replace function public.request_shop_change(p_shop_id uuid, p_kind text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.request_shop_change(p_shop_id, p_kind, p_payload, 'society', null);
end;
$$;

revoke all on function public.request_shop_change(uuid, text, jsonb) from public, anon;
grant execute on function public.request_shop_change(uuid, text, jsonb) to authenticated;

create or replace function public.decide_shop_change(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.shop_change_requests;
  remaining int;
  result_status text;
  mode text;
begin
  select * into req from public.shop_change_requests where id = p_request_id for update;
  if req.id is null or req.status <> 'pending' then
    raise exception 'Pending request not found';
  end if;
  if req.expires_at is not null and req.expires_at < now() then
    update public.shop_change_requests
      set status = 'expired', decided_at = now()
      where id = req.id;
    return jsonb_build_object('status', 'expired');
  end if;
  if req.requested_by = auth.uid() then
    raise exception 'O solicitante não pode aprovar o próprio pedido' using errcode='42501';
  end if;
  if not public.has_shop_member_role(
    req.barbershop_id, array['owner','partner']::public.shop_member_role[]
  ) then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  mode := public.shop_governance_mode(req.barbershop_id);

  -- Pedidos do gerente: qualquer dono/co-dono com poder de aplicar (ou majoritário) aprova.
  if req.source = 'account_manager' then
    if not public.can_apply_protected_change(req.barbershop_id)
       and mode = 'equal' then
      -- igualitário: qualquer outro co-dono pode aprovar (um basta para AM)
      null;
    elsif not public.can_apply_protected_change(req.barbershop_id) and mode <> 'equal' then
      raise exception 'Somente o sócio majoritário pode aprovar' using errcode='42501';
    end if;
  elsif mode = 'equal' then
    null; -- peer approve
  elsif mode = 'majority' then
    if not public.can_apply_protected_change(req.barbershop_id) then
      raise exception 'Somente o sócio majoritário pode aprovar' using errcode='42501';
    end if;
  else
    raise exception 'A sociedade não exige mais aprovação';
  end if;

  insert into public.shop_change_approvals(request_id, user_id, approved, note)
  values (req.id, auth.uid(), p_approve, nullif(trim(p_note), ''))
  on conflict (request_id, user_id) do update
    set approved = excluded.approved, note = excluded.note, decided_at = now();

  if not p_approve then
    update public.shop_change_requests
      set status = 'rejected', approved_by = auth.uid(),
          decision_note = nullif(trim(p_note), ''), decided_at = now()
      where id = req.id;
    return jsonb_build_object('status', 'rejected');
  end if;

  if req.source = 'account_manager' or mode = 'majority' then
    remaining := 0;
  else
    select count(*) into remaining from public.shop_members sm
    where sm.barbershop_id = req.barbershop_id and sm.active and sm.role in ('owner','partner')
      and sm.user_id <> req.requested_by
      and not exists (
        select 1 from public.shop_change_approvals a
        where a.request_id = req.id and a.user_id = sm.user_id and a.approved
      );
  end if;

  if remaining > 0 then
    return jsonb_build_object('status', 'pending', 'remaining_approvals', remaining);
  end if;

  perform public.apply_shop_change(req.barbershop_id, req.kind, req.payload);
  result_status := 'approved';
  update public.shop_change_requests
    set status = 'approved', approved_by = auth.uid(),
        decision_note = nullif(trim(p_note), ''), decided_at = now(), applied_at = now()
    where id = req.id;
  return jsonb_build_object('status', result_status, 'remaining_approvals', 0);
end;
$$;

revoke all on function public.decide_shop_change(uuid, boolean, text) from public, anon;
grant execute on function public.decide_shop_change(uuid, boolean, text) to authenticated;

create or replace function public.expire_shop_change_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update public.shop_change_requests
    set status = 'expired', decided_at = now()
  where status = 'pending'
    and expires_at is not null
    and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expire_shop_change_requests() from public, anon, authenticated;
grant execute on function public.expire_shop_change_requests() to service_role;

create or replace function public.list_pending_shop_changes(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  if not (
    public.is_platform_admin()
    or public.has_shop_member_role(p_shop_id, array['owner','partner']::public.shop_member_role[])
    or public.is_account_manager_of(p_shop_id)
  ) then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  -- Expira no caminho de leitura.
  update public.shop_change_requests
    set status = 'expired', decided_at = now()
  where barbershop_id = p_shop_id
    and status = 'pending'
    and expires_at is not null
    and expires_at < now();

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'kind', r.kind,
      'payload', r.payload,
      'source', r.source,
      'checklist', r.checklist,
      'expires_at', r.expires_at,
      'created_at', r.created_at,
      'requested_by', r.requested_by,
      'status', r.status
    ) order by r.created_at desc)
    from public.shop_change_requests r
    where r.barbershop_id = p_shop_id
      and r.status = 'pending'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_pending_shop_changes(uuid) from public, anon;
grant execute on function public.list_pending_shop_changes(uuid) to authenticated;

-- =============================================================================
-- G) Gerente de conta — RPCs de assign
-- =============================================================================

create or replace function public.assign_account_manager_shop(
  p_user_id uuid,
  p_shop_id uuid,
  p_can_view_dashboard boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.user_id = p_user_id and m.role = 'account_manager'
  ) then
    insert into public.memberships (user_id, barbershop_id, role)
    values (p_user_id, null, 'account_manager');
  end if;

  insert into public.account_manager_shops (user_id, barbershop_id, can_view_dashboard, assigned_by)
  values (p_user_id, p_shop_id, p_can_view_dashboard, auth.uid())
  on conflict (user_id, barbershop_id) do update
    set can_view_dashboard = excluded.can_view_dashboard,
        assigned_by = auth.uid();

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.assign_account_manager_shop(uuid, uuid, boolean) from public, anon;
grant execute on function public.assign_account_manager_shop(uuid, uuid, boolean) to authenticated;

create or replace function public.unassign_account_manager_shop(
  p_user_id uuid,
  p_shop_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode='42501';
  end if;
  delete from public.account_manager_shops
  where user_id = p_user_id and barbershop_id = p_shop_id;
end;
$$;

revoke all on function public.unassign_account_manager_shop(uuid, uuid) from public, anon;
grant execute on function public.unassign_account_manager_shop(uuid, uuid) to authenticated;

-- shop_governance_mode: partners já migrados; continua contando owner (+ partner legado).
create or replace function public.shop_governance_mode(p_shop_id uuid)
returns text language plpgsql stable security definer set search_path=public as $$
declare n int; lo numeric; hi numeric;
begin
  select count(*), min(ownership_percent), max(ownership_percent) into n, lo, hi
  from public.shop_members
  where barbershop_id = p_shop_id and active and role in ('owner', 'partner');
  if n <= 1 then return 'single'; end if;
  if lo = hi then return 'equal'; end if;
  return 'majority';
end $$;

-- Co-dono via platform_add_shop_member (role owner com %).
create or replace function public.platform_add_shop_member(
  p_shop_id uuid,
  p_user_id uuid,
  p_role public.shop_member_role,
  p_ownership_percent numeric default null,
  p_display_name text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  staffid uuid;
  memberid uuid;
  owner_share numeric;
  owner_id uuid;
  effective_role public.shop_member_role := p_role;
begin
  if not public.is_platform_admin() then raise exception 'Platform admin required' using errcode='42501'; end if;
  if exists(select 1 from public.shop_members where barbershop_id=p_shop_id and user_id=p_user_id) then
    raise exception 'This account already belongs to the professional team' using errcode='23505';
  end if;
  if effective_role = 'partner' then
    effective_role := 'owner';
  end if;
  if effective_role = 'owner' and (p_ownership_percent is null or p_ownership_percent <= 0 or p_ownership_percent >= 100) then
    raise exception 'Co-owner ownership must be between 0 and 100' using errcode='22023';
  end if;
  select id into staffid from public.staff where barbershop_id=p_shop_id and user_id=p_user_id;
  if staffid is null then
    insert into public.staff(barbershop_id,user_id,display_name,active)
    values(p_shop_id,p_user_id,coalesce(nullif(trim(p_display_name),''),(select full_name from public.profiles where id=p_user_id),'Profissional'),true)
    returning id into staffid;
  end if;
  if effective_role = 'owner' then
    select id, ownership_percent into owner_id, owner_share from public.shop_members
    where barbershop_id=p_shop_id and role='owner' and active
    order by ownership_percent desc
    limit 1
    for update;
    if owner_share is null or owner_share <= p_ownership_percent then
      raise exception 'The owner does not have enough participation to transfer' using errcode='23514';
    end if;
    update public.shop_members set ownership_percent = ownership_percent - p_ownership_percent
    where id = owner_id;
  elsif p_ownership_percent is not null then
    raise exception 'Only co-owners receive ownership percentage' using errcode='22023';
  end if;
  insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
  values(p_shop_id,p_user_id,staffid,effective_role,case when effective_role='owner' then p_ownership_percent else null end)
  returning id into memberid;
  return memberid;
end $$;

revoke all on function public.platform_add_shop_member(uuid,uuid,public.shop_member_role,numeric,text) from public,anon;
grant execute on function public.platform_add_shop_member(uuid,uuid,public.shop_member_role,numeric,text) to authenticated;

-- Persistir staff_assignment_mode em settings.operational
create or replace function public.apply_shop_change(p_shop_id uuid, p_kind text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.approved_shop_change', 'on', true);
  case p_kind
    when 'service.create' then
      insert into public.services(
        barbershop_id, name, description, duration_minutes, price_cents, active, icon
      ) values (
        p_shop_id,
        p_payload->>'name',
        nullif(p_payload->>'description', ''),
        (p_payload->>'duration_minutes')::int,
        (p_payload->>'price_cents')::int,
        coalesce((p_payload->>'active')::boolean, true),
        nullif(p_payload->>'icon', '')
      );
    when 'service.update' then
      update public.services set
        name = coalesce(p_payload->>'name', name),
        description = case when p_payload ? 'description' then nullif(p_payload->>'description', '') else description end,
        duration_minutes = coalesce((p_payload->>'duration_minutes')::int, duration_minutes),
        price_cents = coalesce((p_payload->>'price_cents')::int, price_cents),
        active = coalesce((p_payload->>'active')::boolean, active),
        icon = case when p_payload ? 'icon' then nullif(p_payload->>'icon', '') else icon end
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'service.toggle' then
      update public.services set active = (p_payload->>'active')::boolean
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'service.delete' then
      delete from public.services where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.create' then
      insert into public.staff(
        barbershop_id, display_name, active, avatar_url, bio, booking_slug
      ) values (
        p_shop_id,
        p_payload->>'display_name',
        coalesce((p_payload->>'active')::boolean, true),
        nullif(p_payload->>'avatar_url', ''),
        nullif(p_payload->>'bio', ''),
        nullif(p_payload->>'booking_slug', '')
      );
    when 'staff.update' then
      update public.staff set
        display_name = coalesce(p_payload->>'display_name', display_name),
        active = coalesce((p_payload->>'active')::boolean, active),
        avatar_url = case when p_payload ? 'avatar_url' then nullif(p_payload->>'avatar_url', '') else avatar_url end,
        bio = case when p_payload ? 'bio' then nullif(p_payload->>'bio', '') else bio end,
        booking_slug = case when p_payload ? 'booking_slug' then nullif(p_payload->>'booking_slug', '') else booking_slug end
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.toggle' then
      update public.staff set active = (p_payload->>'active')::boolean
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.delete' then
      delete from public.staff where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'hours.replace' then
      delete from public.business_hours where barbershop_id = p_shop_id;
      insert into public.business_hours(barbershop_id, weekday, open_time, close_time)
      select p_shop_id, (h->>'weekday')::int, (h->>'open_time')::time, (h->>'close_time')::time
      from jsonb_array_elements(coalesce(p_payload->'hours', '[]'::jsonb)) h;
    when 'availability.create' then
      insert into public.availability_blocks(
        barbershop_id, staff_id, starts_at, ends_at, reason
      ) values (
        p_shop_id,
        nullif(p_payload->>'staff_id', '')::uuid,
        (p_payload->>'starts_at')::timestamptz,
        (p_payload->>'ends_at')::timestamptz,
        nullif(p_payload->>'reason', '')
      );
    when 'availability.delete' then
      delete from public.availability_blocks
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'settings.operational' then
      update public.barbershop_settings set
        booking_instructions = coalesce(p_payload->>'booking_instructions', booking_instructions),
        booking_horizon_days = coalesce((p_payload->>'booking_horizon_days')::int, booking_horizon_days),
        survey_program_enabled = coalesce(
          (p_payload->>'survey_program_enabled')::boolean,
          survey_program_enabled
        ),
        waiting_enabled = coalesce((p_payload->>'waiting_enabled')::boolean, waiting_enabled),
        waiting_cutoff_minutes = coalesce(
          (p_payload->>'waiting_cutoff_minutes')::int,
          waiting_cutoff_minutes
        ),
        staff_assignment_mode = coalesce(
          nullif(p_payload->>'staff_assignment_mode', ''),
          staff_assignment_mode
        )
      where barbershop_id = p_shop_id;
    when 'member.update' then
      update public.shop_members set
        role = (p_payload->>'role')::public.shop_member_role,
        ownership_percent = case
          when (p_payload->>'role') in ('owner', 'partner')
            then (p_payload->>'ownership_percent')::numeric
          else null
        end,
        active = coalesce((p_payload->>'active')::boolean, active)
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    else
      raise exception 'Unsupported change kind: %', p_kind using errcode = '22023';
  end case;
end;
$$;
