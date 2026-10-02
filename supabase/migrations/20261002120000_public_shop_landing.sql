-- Página pública da barbearia: configuração em barbershop_settings.landing e leitura anônima
-- com barbeiros, expediente, serviços e horários livres de hoje (nenhum dado de cliente).

create or replace function public.landing_config_valid(p jsonb) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(
    jsonb_typeof(p) = 'object'
    and not exists (
      select 1 from jsonb_object_keys(p) k
      where k not in (
        'enabled', 'headline', 'about', 'address', 'instagram', 'whatsapp',
        'show_staff', 'show_services', 'show_today', 'show_hours'
      )
    )
    and not exists (
      select 1 from unnest(array['enabled', 'show_staff', 'show_services', 'show_today', 'show_hours']) k
      where p ? k and jsonb_typeof(p -> k) <> 'boolean'
    )
    and not exists (
      select 1 from unnest(array['headline', 'about', 'address', 'instagram', 'whatsapp']) k
      where p ? k and jsonb_typeof(p -> k) <> 'string'
    )
    and char_length(coalesce(p ->> 'headline', '')) <= 80
    and char_length(coalesce(p ->> 'about', '')) <= 600
    and char_length(coalesce(p ->> 'address', '')) <= 160
    and coalesce(p ->> 'instagram', '') ~ '^(@?[A-Za-z0-9._]{1,30})?$'
    and coalesce(p ->> 'whatsapp', '') ~ '^(\+?[0-9 ()-]{8,20})?$',
    false)
$$;

alter table public.barbershop_settings
  add column if not exists landing jsonb not null default '{}'::jsonb;

alter table public.barbershop_settings drop constraint if exists barbershop_settings_landing_valid;
alter table public.barbershop_settings
  add constraint barbershop_settings_landing_valid check (public.landing_config_valid(landing));

-- A página faz parte da identidade visual: mesma regra de aprovação do logo e das cores.
create or replace function public.settings_change_is_visual(
  old_row public.barbershop_settings, new_row public.barbershop_settings
) returns boolean
language sql immutable set search_path = public as $$
  select old_row.barbershop_id = new_row.barbershop_id
    and (to_jsonb(old_row) - array[
      'display_name','logo_url','logo_background_color','login_layout','login_image_url',
      'font_family','custom_font_url','custom_font_name','custom_font_faces','font_scope',
      'header_font_weight','header_font_style','corner_style','floating_chrome',
      'primary_color','accent_color','tagline','landing','updated_at'
    ]) = (to_jsonb(new_row) - array[
      'display_name','logo_url','logo_background_color','login_layout','login_image_url',
      'font_family','custom_font_url','custom_font_name','custom_font_faces','font_scope',
      'header_font_weight','header_font_style','corner_style','floating_chrome',
      'primary_color','accent_color','tagline','landing','updated_at'
    ])
$$;

create or replace function public.get_public_shop_landing(
  p_shop_ref text default null, p_host text default null
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  sid uuid;
  shop record;
  cfg jsonb;
  tz text;
  now_ts timestamptz := now();
  today date;
  win record;
  step_min int;
  day_start timestamptz;
  day_end timestamptz;
  staff_json jsonb := '[]'::jsonb;
  services_json jsonb := '[]'::jsonb;
  hours_json jsonb;
  st record;
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
    coalesce(s.landing, '{}'::jsonb) as landing
  into shop
  from public.barbershops b
  left join public.barbershop_settings s on s.barbershop_id = b.id
  where b.id = sid and b.status = 'active';
  if shop.id is null then return null; end if;

  cfg := jsonb_build_object(
    'enabled', true, 'headline', '', 'about', '', 'address', '', 'instagram', '', 'whatsapp', '',
    'show_staff', true, 'show_services', true, 'show_today', true, 'show_hours', true
  ) || shop.landing;

  tz := coalesce(
    (select name from pg_timezone_names where name = shop.timezone limit 1),
    'America/Sao_Paulo'
  );
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

  step_min := greatest(15, least(120, coalesce(
    (select min(duration_minutes) from public.services where barbershop_id = sid and active), 30)));
  if win.is_open then
    day_start := (today + win.opens_at) at time zone tz;
    day_end := (today + win.closes_at) at time zone tz;
  end if;

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

    if (cfg ->> 'show_staff')::boolean or (cfg ->> 'show_today')::boolean then
      for st in
        select id, display_name, bio, avatar_url, booking_slug
        from public.staff where barbershop_id = sid and active
        order by created_at limit 20
      loop
        free_slots := array[]::text[];
        if (cfg ->> 'show_today')::boolean and win.is_open then
          select coalesce(array_agg(to_char(slot at time zone tz, 'HH24:MI') order by slot), array[]::text[])
          into free_slots
          from (
            select g as slot
            from generate_series(day_start, day_end - make_interval(mins => step_min),
                                 make_interval(mins => step_min)) g
            where g > now_ts
              and not exists (
                select 1 from public.appointments a
                where a.staff_id = st.id and a.status in ('pending', 'confirmed', 'completed')
                  and a.starts_at < g + make_interval(mins => step_min) and a.ends_at > g)
              and not exists (
                select 1 from public.availability_blocks bl
                where bl.barbershop_id = sid and (bl.staff_id is null or bl.staff_id = st.id)
                  and bl.starts_at < g + make_interval(mins => step_min) and bl.ends_at > g)
              and not exists (
                select 1 from public.slot_waits w
                where w.staff_id = st.id and w.state in ('holding', 'exclusive')
                  and (w.hold_until > now_ts or (w.customer_id is not null and w.claim_until > now_ts))
                  and w.starts_at < g + make_interval(mins => step_min) and w.ends_at > g)
            order by g
            limit 12
          ) free;
        end if;
        staff_json := staff_json || jsonb_build_object(
          'name', st.display_name,
          'bio', case when (cfg ->> 'show_staff')::boolean then coalesce(st.bio, '') else '' end,
          'avatar_url', case when (cfg ->> 'show_staff')::boolean then st.avatar_url end,
          'booking_slug', st.booking_slug,
          'free_today', to_jsonb(free_slots)
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
      'step_minutes', step_min
    ),
    'staff', staff_json,
    'services', services_json,
    'generated_at', now_ts
  );
end;
$$;

revoke all on function public.get_public_shop_landing(text, text) from public;
grant execute on function public.get_public_shop_landing(text, text) to anon, authenticated;
