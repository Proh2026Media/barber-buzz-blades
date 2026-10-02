-- Forma de oferecer os horários, escolhida por barbearia (02/10/2026).
--
--   * flexible (padrão): candidatos de 15 em 15 minutos.
--   * literal: passos do tamanho do serviço (duração do profissional), ex.: Combo de 60 min
--     -> 9:00, 10:00, 11:00; Corte de 30 -> 9:00, 9:30, 10:00.
--   * custom: passos de slot_step_minutes (10, 15, 20, 30, 45 ou 60).
--
-- Em todos os modos a contagem começa no início de cada janela de expediente: na abertura do
-- dia e, de novo, no fim de cada bloqueio (almoço, folga) da loja ou do profissional. Atendimentos
-- e esperas não reiniciam a contagem; só ocupam. Só aparecem horários em que o serviço inteiro
-- cabe antes do próximo compromisso, bloqueio ou fechamento.
--
-- Cliente (quem não é dono/sócio/gerente/admin) só reserva ou remarca para um início da grade
-- atual. Agendamentos antigos continuam valendo: mudar só o status, cancelar ou restaurar não
-- confere a grade; recorrência e vaga resgatada da espera mantêm o horário original. O painel
-- continua livre.

alter table public.barbershop_settings
  add column if not exists slot_mode text not null default 'flexible',
  add column if not exists slot_step_minutes smallint not null default 15;

alter table public.barbershop_settings
  drop constraint if exists barbershop_settings_slot_mode_check,
  add constraint barbershop_settings_slot_mode_check
    check (slot_mode in ('flexible', 'literal', 'custom')),
  drop constraint if exists barbershop_settings_slot_step_minutes_check,
  add constraint barbershop_settings_slot_step_minutes_check
    check (slot_step_minutes in (10, 15, 20, 30, 45, 60));

-- Tamanho do passo para um serviço de p_duration minutos na loja.
create or replace function public.shop_slot_step(p_shop_id uuid, p_duration integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case coalesce(s.slot_mode, 'flexible')
    when 'literal' then greatest(coalesce(p_duration, 15), 1)
    when 'custom' then coalesce(s.slot_step_minutes, 15)::integer
    else 15
  end
  from (select 1) one
  left join public.barbershop_settings s on s.barbershop_id = p_shop_id
$$;

-- Inícios possíveis no dia (antes de descontar atendimentos, esperas e o horário atual).
create or replace function public.slot_candidate_starts(p_staff_id uuid, p_date date, p_duration integer)
returns setof timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop uuid;
  v_tz text;
  v_win record;
  v_start timestamptz;
  v_end timestamptz;
  v_step interval;
  v_dur interval;
  v_cursor timestamptz;
  v_block record;
begin
  select s.barbershop_id into v_shop from public.staff s where s.id = p_staff_id;
  if v_shop is null or p_date is null or p_duration is null or p_duration <= 0 then return; end if;

  select h.is_open, h.opens_at, h.closes_at into v_win
  from public.business_hours h
  where h.barbershop_id = v_shop and h.weekday = extract(dow from p_date)::smallint;
  if not coalesce(v_win.is_open, false) or v_win.closes_at <= v_win.opens_at then return; end if;

  v_tz := public.shop_tz(v_shop);
  v_start := (p_date + v_win.opens_at) at time zone v_tz;
  v_end := (p_date + v_win.closes_at) at time zone v_tz;
  v_step := make_interval(mins => public.shop_slot_step(v_shop, p_duration));
  v_dur := make_interval(mins => p_duration);

  v_cursor := v_start;
  for v_block in
    select b.starts_at, b.ends_at
    from public.availability_blocks b
    where b.barbershop_id = v_shop and (b.staff_id is null or b.staff_id = p_staff_id)
      and b.starts_at < v_end and b.ends_at > v_start
    order by b.starts_at, b.ends_at
  loop
    if v_block.starts_at > v_cursor then
      return query select g from generate_series(v_cursor, v_block.starts_at - v_dur, v_step) g;
    end if;
    v_cursor := greatest(v_cursor, v_block.ends_at);
  end loop;
  if v_cursor < v_end then
    return query select g from generate_series(v_cursor, v_end - v_dur, v_step) g;
  end if;
end;
$$;

-- Fonte única dos horários livres: a grade da loja menos o que está ocupado.
create or replace function public.available_slots_internal(p_staff_id uuid, p_service_id uuid, p_date date)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  shop_id uuid;
  tz text;
  dur integer;
  horizon integer;
  local_today date;
begin
  select s.barbershop_id into shop_id
  from public.staff s join public.barbershops b on b.id = s.barbershop_id
  where s.id = p_staff_id and s.active and b.status = 'active';
  if shop_id is null or p_date is null then return; end if;

  select t.duration_minutes into dur from public.staff_service_terms(p_staff_id, p_service_id) t;
  if dur is null or dur <= 0 then return; end if;

  tz := public.shop_tz(shop_id);
  local_today := (clock_timestamp() at time zone tz)::date;
  select coalesce(st.booking_horizon_days, 14) into horizon
  from public.barbershop_settings st where st.barbershop_id = shop_id;
  if p_date < local_today or p_date > local_today + greatest(coalesce(horizon, 14), 1) - 1 then
    return;
  end if;

  return query
  with grid as materialized (
    select c.g from public.slot_candidate_starts(p_staff_id, p_date, dur) as c(g)
  ),
  busy as materialized (
    select b.starts_at, b.ends_at
    from public.staff_busy_internal(
      p_staff_id,
      (select min(grid.g) from grid),
      (select max(grid.g) from grid) + make_interval(mins => dur)) b
  )
  select grid.g, grid.g + make_interval(mins => dur)
  from grid
  where grid.g > clock_timestamp()
    and not exists (
      select 1 from busy where busy.starts_at < grid.g + make_interval(mins => dur) and busy.ends_at > grid.g)
  order by grid.g;
end;
$$;

revoke all on function public.shop_slot_step(uuid, integer) from public, anon, authenticated;
revoke all on function public.slot_candidate_starts(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.available_slots_internal(uuid, uuid, date) from public, anon, authenticated;

-- Gatilho do cliente: além de duração e preço, o início precisa estar na grade atual da loja.
create or replace function public.appointments_enforce_service_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  terms record;
  tz text;
  horizon integer;
begin
  if auth.uid() is null or public.can_view_full_shop(new.barbershop_id) then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.service_id is not distinct from old.service_id
     and new.staff_id is not distinct from old.staff_id
     and new.starts_at is not distinct from old.starts_at
     and new.ends_at is not distinct from old.ends_at then
    new.booked_price_cents := old.booked_price_cents;
    return new;
  end if;

  select t.duration_minutes, t.price_cents into terms
  from public.staff_service_terms(new.staff_id, new.service_id) t;
  if terms.duration_minutes is null then
    raise exception 'Este profissional não faz o serviço escolhido.' using errcode = '22023';
  end if;

  new.ends_at := new.starts_at + make_interval(mins => terms.duration_minutes);
  if tg_op = 'INSERT' or new.service_id is distinct from old.service_id
     or new.staff_id is distinct from old.staff_id then
    new.booked_price_cents := terms.price_cents;
  else
    new.booked_price_cents := old.booked_price_cents;
  end if;

  -- Ocorrências de recorrência são geradas à frente de propósito.
  if new.series_id is null then
    tz := public.shop_tz(new.barbershop_id);
    select coalesce(s.booking_horizon_days, 14) into horizon
    from public.barbershop_settings s where s.barbershop_id = new.barbershop_id;
    if (new.starts_at at time zone tz)::date
       > (clock_timestamp() at time zone tz)::date + greatest(coalesce(horizon, 14), 1) - 1 then
      raise exception 'Esse dia ainda não está aberto para agendamento.' using errcode = '22023';
    end if;

    -- Grade da loja: só quando o horário, o profissional ou o serviço mudam. A vaga resgatada
    -- da lista de espera mantém o horário original, mesmo que a loja tenha mudado de modo.
    -- Horário passado, fora do expediente ou em bloqueio fica para appointments_validate_booking,
    -- que dá a mensagem específica.
    if (tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at
        or new.staff_id is distinct from old.staff_id
        or new.service_id is distinct from old.service_id)
       and new.starts_at > clock_timestamp()
       and exists (
         select 1 from public.business_hours h
         where h.barbershop_id = new.barbershop_id and h.is_open
           and h.weekday = extract(dow from (new.starts_at at time zone tz))::smallint
           and (new.ends_at at time zone tz)::date = (new.starts_at at time zone tz)::date
           and (new.starts_at at time zone tz)::time >= h.opens_at
           and (new.ends_at at time zone tz)::time <= h.closes_at)
       and not exists (
         select 1 from public.availability_blocks b
         where b.barbershop_id = new.barbershop_id and (b.staff_id is null or b.staff_id = new.staff_id)
           and b.starts_at < new.ends_at and b.ends_at > new.starts_at)
       and not exists (
         select 1 from public.slot_waits w
         where w.staff_id = new.staff_id and w.starts_at = new.starts_at
           and w.state = 'claimed' and w.customer_id = auth.uid())
       and not exists (
         select 1
         from public.slot_candidate_starts(
           new.staff_id, (new.starts_at at time zone tz)::date, terms.duration_minutes) c(g)
         where c.g = new.starts_at)
    then
      raise exception 'Esse horário não está entre os oferecidos pela barbearia. Escolha outro.'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

-- Pedido aprovado de "configurações de agendamento" também leva a forma dos horários.
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
        ),
        slot_mode = coalesce(nullif(p_payload->>'slot_mode', ''), slot_mode),
        slot_step_minutes = coalesce((p_payload->>'slot_step_minutes')::smallint, slot_step_minutes)
      where barbershop_id = p_shop_id;
    when 'member.add' then
      perform public.apply_add_shop_member(
        p_shop_id,
        (p_payload->>'user_id')::uuid,
        (p_payload->>'role')::public.shop_member_role,
        nullif(p_payload->>'ownership_percent', '')::numeric,
        nullif(p_payload->>'display_name', '')
      );
    when 'member.update' then
      perform public.apply_update_shop_member(
        p_shop_id,
        (p_payload->>'id')::uuid,
        case when p_payload ? 'role' and nullif(p_payload->>'role', '') is not null
          then (p_payload->>'role')::public.shop_member_role
          else null end,
        case when p_payload ? 'ownership_percent'
          then nullif(p_payload->>'ownership_percent', '')::numeric
          else null end,
        case when p_payload ? 'active'
          then (p_payload->>'active')::boolean
          else null end
      );
    else
      raise exception 'Unsupported change kind: %', p_kind using errcode = '22023';
  end case;
end;
$$;

-- Mudar a forma dos horários altera a agenda oferecida: avisa as telas abertas.
create or replace function public.emit_slot_mode_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slot_mode is distinct from old.slot_mode
     or new.slot_step_minutes is distinct from old.slot_step_minutes then
    begin
      insert into public.availability_signals (barbershop_id, staff_id) values (new.barbershop_id, null);
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;
revoke all on function public.emit_slot_mode_signal() from public, anon, authenticated;
drop trigger if exists barbershop_settings_slot_mode_signal on public.barbershop_settings;
create trigger barbershop_settings_slot_mode_signal
after update of slot_mode, slot_step_minutes on public.barbershop_settings
for each row execute function public.emit_slot_mode_signal();

-- Página pública: segue a forma dos horários da loja (mesma função do app) e informa o modo.
create or replace function public.get_public_shop_landing(p_shop_ref text default null, p_host text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  sid uuid;
  shop record;
  cfg jsonb;
  tz text;
  now_ts timestamptz := now();
  today date;
  win record;
  staff_json jsonb := '[]'::jsonb;
  services_json jsonb := '[]'::jsonb;
  hours_json jsonb;
  st record;
  shortest record;
  free_slots text[];
begin
  if nullif(btrim(coalesce(p_host, '')), '') is not null then
    sid := (public.resolve_shop_by_host(p_host) ->> 'shop_id')::uuid;
  elsif nullif(btrim(coalesce(p_shop_ref, '')), '') is not null then
    if p_shop_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      sid := p_shop_ref::uuid;
    else
      sid := public.resolve_shop_by_slug(p_shop_ref);
    end if;
  end if;
  if sid is null then return null; end if;

  select b.id, b.name, b.slug, b.timezone,
    s.display_name, s.tagline, s.logo_url, s.logo_background_color, s.font_family,
    s.custom_font_url, s.header_font_weight, s.header_font_style, s.corner_style,
    s.primary_color, s.accent_color, s.login_image_url, s.booking_instructions,
    coalesce(s.landing, '{}'::jsonb) as landing,
    coalesce(s.slot_mode, 'flexible') as slot_mode, coalesce(s.slot_step_minutes, 15) as slot_step_minutes
  into shop
  from public.barbershops b
  left join public.barbershop_settings s on s.barbershop_id = b.id
  where b.id = sid and b.status = 'active';
  if shop.id is null then return null; end if;

  cfg := jsonb_build_object(
    'enabled', true, 'headline', '', 'about', '', 'address', '', 'instagram', '', 'whatsapp', '',
    'show_staff', true, 'show_services', true, 'show_today', true, 'show_hours', true
  ) || shop.landing;

  tz := public.shop_tz(sid);
  today := (now_ts at time zone tz)::date;

  select coalesce(jsonb_agg(jsonb_build_object(
      'weekday', h.weekday, 'is_open', h.is_open,
      'opens_at', to_char(h.opens_at, 'HH24:MI'), 'closes_at', to_char(h.closes_at, 'HH24:MI')
    ) order by h.weekday), '[]'::jsonb)
  into hours_json
  from public.business_hours h where h.barbershop_id = sid;

  select h.is_open, h.opens_at, h.closes_at into win
  from public.business_hours h
  where h.barbershop_id = sid and h.weekday = extract(dow from today)::int;

  if (cfg ->> 'enabled')::boolean then
    if (cfg ->> 'show_services')::boolean then
      select coalesce(jsonb_agg(jsonb_build_object(
          'name', sv.name, 'description', coalesce(sv.description, ''),
          'duration_minutes', sv.duration_minutes, 'price_cents', sv.price_cents, 'icon', sv.icon
        ) order by sv.created_at), '[]'::jsonb)
      into services_json
      from (select * from public.services where barbershop_id = sid and active
            order by created_at limit 30) sv;
    end if;

    if (cfg ->> 'show_staff')::boolean then
      for st in
        select id, display_name, bio, avatar_url, booking_slug
        from public.staff where barbershop_id = sid and active
        order by created_at limit 20
      loop
        free_slots := array[]::text[];
        select sv.id, t.duration_minutes into shortest
        from public.services sv
        cross join lateral public.staff_service_terms(st.id, sv.id) t
        where sv.barbershop_id = sid and sv.active
        order by t.duration_minutes, sv.created_at
        limit 1;
        if (cfg ->> 'show_today')::boolean and win.is_open and shortest.id is not null then
          select coalesce(array_agg(to_char(x.starts_at at time zone tz, 'HH24:MI') order by x.starts_at),
                          array[]::text[])
          into free_slots
          from (
            select a.starts_at from public.available_slots_internal(st.id, shortest.id, today) a
            order by a.starts_at limit 12
          ) x;
        end if;
        staff_json := staff_json || jsonb_build_object(
          'name', st.display_name,
          'bio', coalesce(st.bio, ''),
          'avatar_url', st.avatar_url,
          'booking_slug', st.booking_slug,
          'free_today', to_jsonb(free_slots),
          'offers_services', shortest.id is not null,
          'min_duration_minutes', shortest.duration_minutes
        );
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'shop', jsonb_build_object(
      'id', shop.id, 'name', shop.name, 'slug', shop.slug, 'timezone', tz,
      'display_name', shop.display_name, 'tagline', shop.tagline, 'logo_url', shop.logo_url,
      'logo_background_color', shop.logo_background_color, 'font_family', shop.font_family,
      'custom_font_url', shop.custom_font_url, 'header_font_weight', shop.header_font_weight,
      'header_font_style', shop.header_font_style, 'corner_style', shop.corner_style,
      'primary_color', shop.primary_color, 'accent_color', shop.accent_color,
      'hero_image_url', shop.login_image_url
    ),
    'landing', cfg,
    'hours', case when (cfg ->> 'enabled')::boolean and (cfg ->> 'show_hours')::boolean
      then hours_json else '[]'::jsonb end,
    'today', jsonb_build_object(
      'date', today,
      'weekday', extract(dow from today)::int,
      'is_open', coalesce(win.is_open, false),
      'opens_at', to_char(win.opens_at, 'HH24:MI'),
      'closes_at', to_char(win.closes_at, 'HH24:MI'),
      'slot_mode', shop.slot_mode,
      'step_minutes', case shop.slot_mode
        when 'literal' then null when 'custom' then shop.slot_step_minutes else 15 end
    ),
    'staff', staff_json,
    'services', services_json,
    'generated_at', now_ts
  );
end;
$$;

revoke all on function public.get_public_shop_landing(text, text) from public;
grant execute on function public.get_public_shop_landing(text, text) to anon, authenticated;
