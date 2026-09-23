-- Slugs automáticos, redirects permanentes e desvinculação com carteira exclusiva.

-- ---------------------------------------------------------------------------
-- Helpers: slugify + unique allocation
-- ---------------------------------------------------------------------------

create or replace function public.slugify_pt(p_input text)
returns text
language plpgsql
immutable
as $$
declare
  raw text;
  result text;
begin
  raw := lower(coalesce(nullif(trim(p_input), ''), 'item'));
  raw := translate(
    raw,
    'áàâãäåāăąéèêëēĕėęěíìîïĩīĭįıóòôõöōŏőúùûüũūŭůűýÿçñÁÀÂÃÄÅĀĂĄÉÈÊËĒĔĖĘĚÍÌÎÏĨĪĬĮİÓÒÔÕÖŌŎŐÚÙÛÜŨŪŬŮŰÝŸÇÑ',
    'aaaaaaaaaeeeeeeeeeeiiiiiiiiiooooooooouuuuuuuuuyycnaaaaaaaaaeeeeeeeeeeiiiiiiiiiooooooooouuuuuuuuuyycn'
  );
  result := regexp_replace(raw, '[^a-z0-9]+', '-', 'g');
  result := regexp_replace(result, '^-+|-+$', '', 'g');
  if result = '' then result := 'item'; end if;
  return left(result, 60);
end;
$$;

-- ---------------------------------------------------------------------------
-- Redirect tables (antes dos allocate_* que as consultam)
-- ---------------------------------------------------------------------------

create table if not exists public.shop_slug_redirects (
  id uuid primary key default gen_random_uuid(),
  from_slug text not null,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint shop_slug_redirects_slug_format check (from_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists shop_slug_redirects_active_uidx
  on public.shop_slug_redirects (from_slug)
  where deleted_at is null;

create index if not exists shop_slug_redirects_shop_idx
  on public.shop_slug_redirects (barbershop_id)
  where deleted_at is null;

create table if not exists public.staff_slug_redirects (
  id uuid primary key default gen_random_uuid(),
  from_shop_slug text not null,
  from_booking_slug text not null,
  staff_id uuid references public.staff(id) on delete set null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint staff_slug_redirects_shop_format check (from_shop_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint staff_slug_redirects_booking_format check (from_booking_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists staff_slug_redirects_active_uidx
  on public.staff_slug_redirects (from_shop_slug, from_booking_slug)
  where deleted_at is null;

create index if not exists staff_slug_redirects_owner_idx
  on public.staff_slug_redirects (owner_user_id)
  where deleted_at is null;

create or replace function public.allocate_shop_slug(p_base text, p_exclude_id uuid default null)
returns text
language plpgsql
as $$
declare
  base text := public.slugify_pt(p_base);
  candidate text;
  n int := 1;
begin
  candidate := base;
  loop
    exit when not exists (
      select 1 from public.barbershops b
      where b.slug = candidate and (p_exclude_id is null or b.id <> p_exclude_id)
    )
    and not exists (
      select 1 from public.shop_slug_redirects r
      where r.from_slug = candidate and r.deleted_at is null
        and (p_exclude_id is null or r.barbershop_id <> p_exclude_id)
    );
    n := n + 1;
    candidate := left(base, 56) || '-' || n::text;
  end loop;
  return candidate;
end;
$$;

create or replace function public.allocate_booking_slug(
  p_shop_id uuid,
  p_base text,
  p_exclude_staff_id uuid default null
)
returns text
language plpgsql
as $$
declare
  base text := public.slugify_pt(p_base);
  candidate text;
  n int := 1;
  shop_slug text;
begin
  select slug into shop_slug from public.barbershops where id = p_shop_id;
  candidate := base;
  loop
    exit when not exists (
      select 1 from public.staff s
      where s.barbershop_id = p_shop_id
        and s.booking_slug = candidate
        and (p_exclude_staff_id is null or s.id <> p_exclude_staff_id)
    )
    and not exists (
      select 1 from public.staff_slug_redirects r
      where r.from_shop_slug = shop_slug
        and r.from_booking_slug = candidate
        and r.deleted_at is null
        and (p_exclude_staff_id is null or r.staff_id is distinct from p_exclude_staff_id)
    );
    n := n + 1;
    candidate := left(base, 56) || '-' || n::text;
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Departure / portfolio release
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.shop_departure_mode as enum ('take', 'forfeit');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.shop_departure_status as enum (
    'pending_release',
    'approved',
    'rejected',
    'completed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.shop_departure_requests (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  mode public.shop_departure_mode not null,
  dest_shop_id uuid references public.barbershops(id) on delete set null,
  status public.shop_departure_status not null default 'pending_release',
  release_approved_by uuid references auth.users(id) on delete set null,
  release_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  completed_at timestamptz,
  constraint shop_departure_take_needs_dest check (
    mode = 'forfeit' or dest_shop_id is not null or status in ('pending_release', 'cancelled', 'rejected')
  )
);

create index if not exists shop_departure_requests_shop_idx
  on public.shop_departure_requests (barbershop_id, status);

create index if not exists shop_departure_requests_user_idx
  on public.shop_departure_requests (user_id, status);

-- ---------------------------------------------------------------------------
-- Auto-slug triggers
-- ---------------------------------------------------------------------------

create or replace function public.trg_barbershop_auto_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_slug text;
  locked_hit boolean;
begin
  if tg_op = 'INSERT' then
    if new.slug is null or btrim(new.slug) = '' or new.slug = public.slugify_pt(new.name) then
      new.slug := public.allocate_shop_slug(new.name, null);
    else
      new.slug := public.allocate_shop_slug(new.slug, null);
    end if;
    return new;
  end if;

  if new.name is distinct from old.name then
    next_slug := public.allocate_shop_slug(new.name, new.id);
    if next_slug is distinct from old.slug then
      select exists (
        select 1 from public.shop_slug_redirects r
        where r.from_slug = old.slug and r.deleted_at is null and r.locked
      ) into locked_hit;
      if locked_hit then
        raise exception 'Slug antigo travado; não é possível liberar este endereço' using errcode = '42501';
      end if;
      update public.shop_slug_redirects
      set deleted_at = null, barbershop_id = new.id, locked = false
      where from_slug = old.slug and deleted_at is not null;

      insert into public.shop_slug_redirects (from_slug, barbershop_id, locked)
      select old.slug, new.id, false
      where not exists (
        select 1 from public.shop_slug_redirects r
        where r.from_slug = old.slug and r.deleted_at is null
      );

      new.slug := next_slug;
    end if;
  elsif new.slug is distinct from old.slug then
    -- slug manual não permitido: reconcilia a partir do nome
    new.slug := public.allocate_shop_slug(new.name, new.id);
    if new.slug is distinct from old.slug then
      insert into public.shop_slug_redirects (from_slug, barbershop_id, locked)
      select old.slug, new.id, false
      where not exists (
        select 1 from public.shop_slug_redirects r
        where r.from_slug = old.slug and r.deleted_at is null
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists barbershop_auto_slug_trg on public.barbershops;
create trigger barbershop_auto_slug_trg
  before insert or update of name, slug on public.barbershops
  for each row execute function public.trg_barbershop_auto_slug();

create or replace function public.trg_staff_auto_booking_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_slug text;
  shop_slug text;
  owner uuid;
  locked_hit boolean;
begin
  select b.slug into shop_slug from public.barbershops b where b.id = new.barbershop_id;
  owner := new.user_id;

  if tg_op = 'INSERT' then
    new.booking_slug := public.allocate_booking_slug(new.barbershop_id, new.display_name, null);
    return new;
  end if;

  if new.display_name is distinct from old.display_name then
    next_slug := public.allocate_booking_slug(new.barbershop_id, new.display_name, new.id);
    if next_slug is distinct from old.booking_slug and old.booking_slug is not null then
      select exists (
        select 1 from public.staff_slug_redirects r
        where r.from_shop_slug = shop_slug
          and r.from_booking_slug = old.booking_slug
          and r.deleted_at is null
          and r.locked
      ) into locked_hit;
      if locked_hit then
        raise exception 'Link do profissional travado na barbearia; não é possível alterar' using errcode = '42501';
      end if;
      if owner is null then
        select sm.user_id into owner
        from public.shop_members sm
        where sm.staff_id = new.id and sm.active
        limit 1;
      end if;
      if owner is not null then
        insert into public.staff_slug_redirects (
          from_shop_slug, from_booking_slug, staff_id, owner_user_id, locked
        )
        select shop_slug, old.booking_slug, new.id, owner, false
        where not exists (
          select 1 from public.staff_slug_redirects r
          where r.from_shop_slug = shop_slug
            and r.from_booking_slug = old.booking_slug
            and r.deleted_at is null
        );
      end if;
      new.booking_slug := next_slug;
    elsif next_slug is distinct from old.booking_slug then
      new.booking_slug := next_slug;
    end if;
  elsif new.booking_slug is distinct from old.booking_slug then
    -- força regeneração a partir do nome (sem edição manual)
    new.booking_slug := coalesce(
      old.booking_slug,
      public.allocate_booking_slug(new.barbershop_id, new.display_name, new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists staff_auto_booking_slug_trg on public.staff;
create trigger staff_auto_booking_slug_trg
  before insert or update of display_name, booking_slug on public.staff
  for each row execute function public.trg_staff_auto_booking_slug();

-- apply_shop_change: ignora booking_slug manual; trigger gera
create or replace function public.apply_shop_change(p_shop_id uuid, p_kind text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  row_data jsonb;
begin
  perform set_config('app.approved_shop_change', 'on', true);
  case p_kind
    when 'service.create' then
      insert into public.services(barbershop_id, name, duration_minutes, price_cents, active)
      values (
        p_shop_id,
        p_payload->>'name',
        (p_payload->>'duration_minutes')::int,
        (p_payload->>'price_cents')::int,
        coalesce((p_payload->>'active')::boolean, true)
      );
    when 'service.update' then
      target := (p_payload->>'id')::uuid;
      update public.services
      set
        name = p_payload->>'name',
        duration_minutes = (p_payload->>'duration_minutes')::int,
        price_cents = (p_payload->>'price_cents')::int,
        active = coalesce((p_payload->>'active')::boolean, active)
      where id = target and barbershop_id = p_shop_id;
    when 'service.toggle' then
      update public.services
      set active = (p_payload->>'active')::boolean
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'service.delete' then
      delete from public.services where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.create' then
      insert into public.staff(barbershop_id, display_name, active)
      values (
        p_shop_id,
        p_payload->>'display_name',
        coalesce((p_payload->>'active')::boolean, true)
      );
    when 'staff.update' then
      update public.staff
      set
        display_name = p_payload->>'display_name',
        active = coalesce((p_payload->>'active')::boolean, active)
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.toggle' then
      update public.staff
      set active = (p_payload->>'active')::boolean
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.delete' then
      delete from public.staff where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'hours.replace' then
      for row_data in select value from jsonb_array_elements(p_payload->'hours') loop
        insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
        values (
          p_shop_id,
          (row_data->>'weekday')::int,
          (row_data->>'is_open')::boolean,
          (row_data->>'opens_at')::time,
          (row_data->>'closes_at')::time
        )
        on conflict (barbershop_id, weekday) do update
        set is_open = excluded.is_open, opens_at = excluded.opens_at, closes_at = excluded.closes_at;
      end loop;
    when 'availability.create' then
      insert into public.availability_blocks(barbershop_id, staff_id, starts_at, ends_at, reason)
      values (
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
        survey_program_enabled = coalesce((p_payload->>'survey_program_enabled')::boolean, survey_program_enabled),
        waiting_enabled = coalesce((p_payload->>'waiting_enabled')::boolean, waiting_enabled),
        waiting_cutoff_minutes = coalesce((p_payload->>'waiting_cutoff_minutes')::int, waiting_cutoff_minutes)
      where barbershop_id = p_shop_id;
    when 'member.update' then
      update public.shop_members set
        role = (p_payload->>'role')::public.shop_member_role,
        ownership_percent = case
          when (p_payload->>'role') in ('owner', 'partner') then (p_payload->>'ownership_percent')::numeric
          else null
        end,
        active = coalesce((p_payload->>'active')::boolean, active)
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    else
      raise exception 'Unsupported change kind: %', p_kind using errcode = '22023';
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resolve links (slug atual → redirect → loja atual do profissional)
-- ---------------------------------------------------------------------------

create or replace function public.resolve_shop_by_slug(p_shop_ref text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sid uuid;
  ref text := lower(btrim(coalesce(p_shop_ref, '')));
begin
  if ref = '' then return null; end if;
  select id into sid from public.barbershops where lower(slug) = ref and status = 'active';
  if sid is not null then return sid; end if;
  select r.barbershop_id into sid
  from public.shop_slug_redirects r
  join public.barbershops b on b.id = r.barbershop_id
  where r.from_slug = ref and r.deleted_at is null and b.status = 'active'
  limit 1;
  return sid;
end;
$$;

create or replace function public.resolve_direct_booking_staff(p_shop_slug text, p_staff_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  shop_id uuid;
  staff_row public.staff;
  owner uuid;
  dest_shop public.barbershops;
  dest_staff public.staff;
  shop_slug text := lower(btrim(coalesce(p_shop_slug, '')));
  staff_slug text := lower(btrim(coalesce(p_staff_slug, '')));
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;

  -- 1) slug atual na loja (direto ou via redirect de loja)
  shop_id := public.resolve_shop_by_slug(shop_slug);
  if shop_id is not null then
    select s.* into staff_row
    from public.staff s
    where s.barbershop_id = shop_id and s.booking_slug = staff_slug and s.active
    limit 1;
    if staff_row.id is not null then
      return jsonb_build_object(
        'shop_id', shop_id,
        'shop_name', (select name from public.barbershops where id = shop_id),
        'shop_slug', (select slug from public.barbershops where id = shop_id),
        'staff_id', staff_row.id,
        'staff_name', staff_row.display_name,
        'staff_slug', staff_row.booking_slug,
        'via_redirect', false
      );
    end if;
  end if;

  -- 2) redirect de profissional (inclui locked pós-saída)
  select r.owner_user_id, r.staff_id
  into owner, staff_row.id
  from public.staff_slug_redirects r
  where r.from_shop_slug = shop_slug
    and r.from_booking_slug = staff_slug
    and r.deleted_at is null
  limit 1;

  if owner is null and shop_id is not null then
    -- redirect indexed by current shop slug alias
    select b.slug into shop_slug from public.barbershops b where b.id = shop_id;
    select r.owner_user_id, r.staff_id
    into owner, staff_row.id
    from public.staff_slug_redirects r
    where r.from_shop_slug = shop_slug
      and r.from_booking_slug = staff_slug
      and r.deleted_at is null
    limit 1;
  end if;

  if owner is null then
    raise exception 'Link de profissional inválido ou indisponível' using errcode = 'P0002';
  end if;

  -- loja atual do profissional (staff ativo vinculado ao usuário)
  select s.* into dest_staff
  from public.staff s
  join public.shop_members sm on sm.staff_id = s.id and sm.user_id = owner and sm.active
  join public.barbershops b on b.id = s.barbershop_id and b.status = 'active'
  where s.active
  order by sm.created_at desc nulls last
  limit 1;

  if dest_staff.id is null then
    select s.* into dest_staff from public.staff s where s.id = staff_row.id;
  end if;

  if dest_staff.id is null then
    raise exception 'Link de profissional inválido ou indisponível' using errcode = 'P0002';
  end if;

  select * into dest_shop from public.barbershops where id = dest_staff.barbershop_id;

  return jsonb_build_object(
    'shop_id', dest_shop.id,
    'shop_name', dest_shop.name,
    'shop_slug', dest_shop.slug,
    'staff_id', dest_staff.id,
    'staff_name', dest_staff.display_name,
    'staff_slug', dest_staff.booking_slug,
    'via_redirect', true
  );
end;
$$;

create or replace function public.create_direct_appointment(
  p_shop_slug text,
  p_staff_slug text,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved jsonb;
  sid uuid;
  staffid uuid;
  result uuid;
  price int;
begin
  resolved := public.resolve_direct_booking_staff(p_shop_slug, p_staff_slug);
  sid := (resolved->>'shop_id')::uuid;
  staffid := (resolved->>'staff_id')::uuid;
  if not public.has_shop_role(sid, array['customer', 'shop_admin']::public.app_role[]) then
    raise exception 'Cliente não vinculado a esta barbearia' using errcode = '42501';
  end if;
  select coalesce(ss.price_cents, sv.price_cents) into price
  from public.services sv
  left join public.staff_services ss on ss.service_id = sv.id and ss.staff_id = staffid and ss.active
  where sv.id = p_service_id and sv.barbershop_id = sid and sv.active;
  if price is null then
    raise exception 'Serviço indisponível para este profissional' using errcode = '22023';
  end if;
  insert into public.appointments (
    barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status, booked_price_cents
  )
  values (sid, auth.uid(), p_service_id, staffid, p_starts_at, p_ends_at, 'pending', price)
  returning id into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Redirect management RPCs
-- ---------------------------------------------------------------------------

create or replace function public.list_shop_slug_redirects(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not (
    public.is_platform_admin()
    or public.has_shop_member_role(p_shop_id, array['owner', 'partner', 'associate']::public.shop_member_role[])
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'from_slug', r.from_slug,
      'locked', r.locked,
      'created_at', r.created_at
    ) order by r.created_at desc)
    from public.shop_slug_redirects r
    where r.barbershop_id = p_shop_id and r.deleted_at is null
  ), '[]'::jsonb);
end;
$$;

create or replace function public.list_staff_slug_redirects(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  shop_slug text;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not (
    public.is_platform_admin()
    or public.has_shop_member_role(p_shop_id, array['owner', 'partner', 'associate']::public.shop_member_role[])
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select slug into shop_slug from public.barbershops where id = p_shop_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'from_shop_slug', r.from_shop_slug,
      'from_booking_slug', r.from_booking_slug,
      'locked', r.locked,
      'owner_user_id', r.owner_user_id,
      'created_at', r.created_at
    ) order by r.created_at desc)
    from public.staff_slug_redirects r
    where r.from_shop_slug = shop_slug and r.deleted_at is null
  ), '[]'::jsonb);
end;
$$;

create or replace function public.delete_shop_slug_redirect(p_redirect_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.shop_slug_redirects;
begin
  select * into row from public.shop_slug_redirects where id = p_redirect_id and deleted_at is null;
  if row.id is null then raise exception 'Redirect não encontrado' using errcode = 'P0002'; end if;
  if row.locked then raise exception 'Redirect travado' using errcode = '42501'; end if;
  if not (
    public.is_platform_admin()
    or public.has_shop_member_role(row.barbershop_id, array['owner', 'partner']::public.shop_member_role[])
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.shop_slug_redirects set deleted_at = now() where id = row.id;
end;
$$;

create or replace function public.delete_staff_slug_redirect(p_redirect_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.staff_slug_redirects;
  shop_id uuid;
begin
  select * into row from public.staff_slug_redirects where id = p_redirect_id and deleted_at is null;
  if row.id is null then raise exception 'Redirect não encontrado' using errcode = 'P0002'; end if;
  if row.locked then
    -- só o dono do link (profissional) pode apagar locked
    if row.owner_user_id is distinct from auth.uid() and not public.is_platform_admin() then
      raise exception 'Redirect travado; só o profissional pode removê-lo' using errcode = '42501';
    end if;
  else
    select id into shop_id from public.barbershops where slug = row.from_shop_slug;
    if not (
      public.is_platform_admin()
      or row.owner_user_id = auth.uid()
      or (
        shop_id is not null
        and public.has_shop_member_role(shop_id, array['owner', 'partner']::public.shop_member_role[])
      )
    ) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  update public.staff_slug_redirects set deleted_at = now() where id = row.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Departure flow
-- ---------------------------------------------------------------------------

create or replace function public.portfolio_customer_ids(p_shop_id uuid, p_staff_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct a.customer_id
  from public.appointments a
  where a.barbershop_id = p_shop_id
    and a.staff_id = p_staff_id
    and a.status = 'completed'
    and a.customer_id is not null;
$$;

create or replace function public.request_shop_departure(
  p_shop_id uuid,
  p_mode public.shop_departure_mode,
  p_dest_shop_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.shop_members;
  staff_row public.staff;
  other_socios int;
  request_id uuid;
  status public.shop_departure_status;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;

  select * into member
  from public.shop_members
  where barbershop_id = p_shop_id and user_id = auth.uid() and active
  limit 1;
  if member.id is null or member.staff_id is null then
    raise exception 'Você não está vinculado a esta barbearia' using errcode = '42501';
  end if;

  select * into staff_row from public.staff where id = member.staff_id;
  if staff_row.id is null then raise exception 'Profissional não encontrado' using errcode = 'P0002'; end if;

  if p_mode = 'take' then
    if p_dest_shop_id is null then
      raise exception 'Informe a barbearia de destino para levar a carteira' using errcode = '22023';
    end if;
    if p_dest_shop_id = p_shop_id then
      raise exception 'Destino deve ser outra barbearia' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.barbershops b where b.id = p_dest_shop_id and b.status = 'active'
    ) then
      raise exception 'Barbearia de destino indisponível' using errcode = 'P0002';
    end if;
    -- destino: já é membro ativo OU será dono (criou loja) — exige vínculo prévio
    if not exists (
      select 1 from public.shop_members sm
      where sm.barbershop_id = p_dest_shop_id and sm.user_id = auth.uid() and sm.active
    ) and not public.is_platform_admin() then
      raise exception 'Aceite o convite ou crie a nova barbearia antes de levar a carteira' using errcode = '42501';
    end if;
  end if;

  -- cancela pedidos pendentes anteriores do mesmo usuário/loja
  update public.shop_departure_requests
  set status = 'cancelled', decided_at = now()
  where barbershop_id = p_shop_id
    and user_id = auth.uid()
    and status in ('pending_release', 'approved');

  select count(*) into other_socios
  from public.shop_members sm
  where sm.barbershop_id = p_shop_id
    and sm.active
    and sm.role in ('owner', 'partner')
    and sm.user_id <> auth.uid();

  if p_mode = 'take' and member.role in ('owner', 'partner') then
    if other_socios = 0 then
      raise exception 'Sócio único: transfira a propriedade ou abra mão da carteira' using errcode = '42501';
    end if;
    status := 'pending_release';
  else
    status := 'approved';
  end if;

  insert into public.shop_departure_requests (
    barbershop_id, user_id, staff_id, mode, dest_shop_id, status
  )
  values (
    p_shop_id, auth.uid(), member.staff_id, p_mode, p_dest_shop_id, status
  )
  returning id into request_id;

  if status = 'approved' then
    perform public.complete_shop_departure(request_id);
    return jsonb_build_object('status', 'completed', 'request_id', request_id);
  end if;

  return jsonb_build_object('status', 'pending_release', 'request_id', request_id);
end;
$$;

create or replace function public.approve_portfolio_release(p_request_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.shop_departure_requests;
begin
  select * into req from public.shop_departure_requests where id = p_request_id for update;
  if req.id is null or req.status <> 'pending_release' then
    raise exception 'Pedido pendente não encontrado' using errcode = 'P0002';
  end if;
  if req.user_id = auth.uid() then
    raise exception 'O solicitante não pode liberar a própria carteira' using errcode = '42501';
  end if;
  if not public.has_shop_member_role(
    req.barbershop_id, array['owner', 'partner']::public.shop_member_role[]
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.shop_departure_requests
  set
    status = 'approved',
    release_approved_by = auth.uid(),
    release_note = nullif(trim(p_note), ''),
    decided_at = now()
  where id = req.id;

  perform public.complete_shop_departure(req.id);
  return jsonb_build_object('status', 'completed', 'request_id', req.id);
end;
$$;

create or replace function public.reject_portfolio_release(p_request_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.shop_departure_requests;
begin
  select * into req from public.shop_departure_requests where id = p_request_id for update;
  if req.id is null or req.status <> 'pending_release' then
    raise exception 'Pedido pendente não encontrado' using errcode = 'P0002';
  end if;
  if req.user_id = auth.uid() then
    raise exception 'O solicitante não pode rejeitar o próprio pedido' using errcode = '42501';
  end if;
  if not public.has_shop_member_role(
    req.barbershop_id, array['owner', 'partner']::public.shop_member_role[]
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.shop_departure_requests
  set
    status = 'rejected',
    release_approved_by = auth.uid(),
    release_note = nullif(trim(p_note), ''),
    decided_at = now()
  where id = req.id;

  return jsonb_build_object('status', 'rejected', 'request_id', req.id);
end;
$$;

create or replace function public.complete_shop_departure(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.shop_departure_requests;
  origin_slug text;
  old_booking_slug text;
  dest_staff_id uuid;
  cust uuid;
begin
  select * into req from public.shop_departure_requests where id = p_request_id for update;
  if req.id is null then raise exception 'Pedido não encontrado' using errcode = 'P0002'; end if;
  if req.status = 'completed' then return; end if;
  if req.status not in ('approved', 'pending_release') then
    raise exception 'Pedido não está aprovado' using errcode = '22023';
  end if;
  -- associate take already approved; partner pending must be approved first
  if req.status = 'pending_release' then
    raise exception 'Aguarde a liberação do sócio' using errcode = '42501';
  end if;

  select slug into origin_slug from public.barbershops where id = req.barbershop_id;
  select booking_slug into old_booking_slug from public.staff where id = req.staff_id;

  if req.mode = 'take' then
    if req.dest_shop_id is null then
      raise exception 'Destino obrigatório' using errcode = '22023';
    end if;

    -- move customer memberships of portfolio
    for cust in select * from public.portfolio_customer_ids(req.barbershop_id, req.staff_id) loop
      delete from public.memberships
      where user_id = cust
        and barbershop_id = req.barbershop_id
        and role = 'customer';
      insert into public.memberships (user_id, barbershop_id, role)
      select cust, req.dest_shop_id, 'customer'
      where not exists (
        select 1 from public.memberships m
        where m.user_id = cust
          and m.barbershop_id = req.dest_shop_id
          and m.role = 'customer'
      );
    end loop;

    -- ensure staff at destination
    select sm.staff_id into dest_staff_id
    from public.shop_members sm
    where sm.barbershop_id = req.dest_shop_id and sm.user_id = req.user_id and sm.active
    limit 1;

    if dest_staff_id is null then
      insert into public.staff (barbershop_id, user_id, display_name, active)
      select req.dest_shop_id, req.user_id, s.display_name, true
      from public.staff s where s.id = req.staff_id
      returning id into dest_staff_id;

      update public.shop_members
      set staff_id = dest_staff_id
      where barbershop_id = req.dest_shop_id and user_id = req.user_id and active;
    end if;

    -- lock origin booking link forever → current staff
    if old_booking_slug is not null then
      update public.staff_slug_redirects
      set
        staff_id = dest_staff_id,
        owner_user_id = req.user_id,
        locked = true,
        deleted_at = null
      where from_shop_slug = origin_slug
        and from_booking_slug = old_booking_slug;

      insert into public.staff_slug_redirects (
        from_shop_slug, from_booking_slug, staff_id, owner_user_id, locked
      )
      select origin_slug, old_booking_slug, dest_staff_id, req.user_id, true
      where not exists (
        select 1 from public.staff_slug_redirects r
        where r.from_shop_slug = origin_slug
          and r.from_booking_slug = old_booking_slug
          and r.deleted_at is null
      );
    end if;

    -- lock any other redirects owned by this user for this shop
    update public.staff_slug_redirects
    set locked = true, staff_id = dest_staff_id, deleted_at = null
    where owner_user_id = req.user_id
      and from_shop_slug = origin_slug
      and deleted_at is null;
  else
    -- forfeit: free non-locked redirects for shop reuse; soft-delete unlocked
    update public.staff_slug_redirects
    set deleted_at = now()
    where from_shop_slug = origin_slug
      and owner_user_id = req.user_id
      and locked = false
      and deleted_at is null;
  end if;

  -- deactivate at origin
  update public.shop_members
  set active = false
  where barbershop_id = req.barbershop_id and user_id = req.user_id;

  update public.staff
  set active = false
  where id = req.staff_id;

  -- remove shop_admin membership if present (legacy)
  delete from public.memberships
  where user_id = req.user_id
    and barbershop_id = req.barbershop_id
    and role = 'shop_admin';

  update public.shop_departure_requests
  set status = 'completed', completed_at = now()
  where id = req.id;
end;
$$;

create or replace function public.list_shop_departure_requests(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not (
    public.is_platform_admin()
    or public.has_shop_member_role(p_shop_id, array['owner', 'partner', 'associate']::public.shop_member_role[])
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'user_id', r.user_id,
      'staff_id', r.staff_id,
      'mode', r.mode,
      'dest_shop_id', r.dest_shop_id,
      'status', r.status,
      'created_at', r.created_at,
      'staff_name', s.display_name,
      'requester_name', p.full_name
    ) order by r.created_at desc)
    from public.shop_departure_requests r
    left join public.staff s on s.id = r.staff_id
    left join public.profiles p on p.id = r.user_id
    where r.barbershop_id = p_shop_id
      and r.status in ('pending_release', 'approved')
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Signup: membership da loja do link
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_shop_id uuid;
  shop_ref text;
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );

  insert into public.loyalty_accounts (user_id, points)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  shop_ref := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'shop',
    new.raw_user_meta_data ->> 'shop_slug',
    ''
  )), '');

  if shop_ref is not null then
    target_shop_id := public.resolve_shop_by_slug(shop_ref);
  end if;

  if target_shop_id is null then
    select id into target_shop_id
    from public.barbershops
    where slug = 'arena-barber'
    limit 1;
  end if;

  if target_shop_id is not null then
    insert into public.memberships (user_id, barbershop_id, role)
    select new.id, target_shop_id, 'customer'
    where not exists (
      select 1 from public.memberships m
      where m.user_id = new.id
        and m.barbershop_id = target_shop_id
        and m.role = 'customer'
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.shop_slug_redirects enable row level security;
alter table public.staff_slug_redirects enable row level security;
alter table public.shop_departure_requests enable row level security;

revoke all on public.shop_slug_redirects from anon, authenticated;
revoke all on public.staff_slug_redirects from anon, authenticated;
revoke all on public.shop_departure_requests from anon, authenticated;

grant select on public.shop_slug_redirects to authenticated;
grant select on public.staff_slug_redirects to authenticated;
grant select on public.shop_departure_requests to authenticated;

drop policy if exists shop_slug_redirects_select on public.shop_slug_redirects;
create policy shop_slug_redirects_select on public.shop_slug_redirects
  for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_member_role(barbershop_id, array['owner', 'partner', 'associate']::public.shop_member_role[])
  );

drop policy if exists staff_slug_redirects_select on public.staff_slug_redirects;
create policy staff_slug_redirects_select on public.staff_slug_redirects
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or public.is_platform_admin()
    or exists (
      select 1 from public.barbershops b
      where b.slug = from_shop_slug
        and public.has_shop_member_role(
          b.id, array['owner', 'partner', 'associate']::public.shop_member_role[]
        )
    )
  );

drop policy if exists shop_departure_requests_select on public.shop_departure_requests;
create policy shop_departure_requests_select on public.shop_departure_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or public.has_shop_member_role(barbershop_id, array['owner', 'partner']::public.shop_member_role[])
  );

grant execute on function public.slugify_pt(text) to authenticated;
grant execute on function public.resolve_shop_by_slug(text) to authenticated;
grant execute on function public.resolve_direct_booking_staff(text, text) to authenticated;
grant execute on function public.list_shop_slug_redirects(uuid) to authenticated;
grant execute on function public.list_staff_slug_redirects(uuid) to authenticated;
grant execute on function public.delete_shop_slug_redirect(uuid) to authenticated;
grant execute on function public.delete_staff_slug_redirect(uuid) to authenticated;
grant execute on function public.request_shop_departure(uuid, public.shop_departure_mode, uuid) to authenticated;
grant execute on function public.approve_portfolio_release(uuid, text) to authenticated;
grant execute on function public.reject_portfolio_release(uuid, text) to authenticated;
grant execute on function public.complete_shop_departure(uuid) to authenticated;
grant execute on function public.list_shop_departure_requests(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Patch: auto-slug no perfil + criar loja própria + branding com redirect
-- ---------------------------------------------------------------------------

create or replace function public.guard_staff_profile_update()
returns trigger language plpgsql set search_path=public as $$
begin
  if not public.is_platform_admin()
     and public.current_staff_id(old.barbershop_id) = old.id
     and not public.can_view_full_shop(old.barbershop_id) then
    if new.barbershop_id is distinct from old.barbershop_id
       or new.active is distinct from old.active then
      raise exception 'O profissional só pode editar nome, bio e avatar do próprio perfil' using errcode='42501';
    end if;
    if new.booking_slug is distinct from old.booking_slug
       and new.display_name is not distinct from old.display_name then
      raise exception 'O profissional só pode editar nome, bio e avatar do próprio perfil' using errcode='42501';
    end if;
  end if;
  return new;
end $$;

create or replace function public.create_own_barbershop(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  staffid uuid;
  sname text := nullif(trim(p_name), '');
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if sname is null then raise exception 'Informe o nome da barbearia' using errcode = '22023'; end if;

  insert into public.barbershops(name, status)
  values (sname, 'active')
  returning id into sid;

  insert into public.staff(barbershop_id, user_id, display_name, active)
  values (
    sid,
    auth.uid(),
    coalesce((select full_name from public.profiles where id = auth.uid()), sname),
    true
  )
  returning id into staffid;

  insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent, active)
  values (sid, auth.uid(), staffid, 'owner', 100, true);

  insert into public.memberships(user_id, barbershop_id, role)
  select auth.uid(), sid, 'shop_admin'
  where not exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.barbershop_id = sid and m.role = 'shop_admin'
  );

  return jsonb_build_object(
    'shop_id', sid,
    'shop_slug', (select slug from public.barbershops where id = sid),
    'staff_id', staffid
  );
end;
$$;
grant execute on function public.create_own_barbershop(text) to authenticated;

create or replace function public.get_public_shop_branding(p_shop_ref text)
returns table (
  shop_id uuid,
  shop_name text,
  display_name text,
  logo_url text,
  logo_background_color text,
  font_family text,
  custom_font_url text,
  header_font_weight integer,
  header_font_style text,
  corner_style text,
  primary_color text,
  accent_color text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare sid uuid;
begin
  if nullif(btrim(p_shop_ref), '') is null then return; end if;
  if p_shop_ref ~* '^[0-9a-f-]{36}$' then
    sid := p_shop_ref::uuid;
  else
    sid := public.resolve_shop_by_slug(p_shop_ref);
  end if;
  if sid is null then return; end if;
  return query
  select
    b.id, b.name, s.display_name, s.logo_url, s.logo_background_color,
    s.font_family, s.custom_font_url, s.header_font_weight, s.header_font_style,
    s.corner_style, s.primary_color, s.accent_color
  from public.barbershops b
  left join public.barbershop_settings s on s.barbershop_id = b.id
  where b.id = sid and b.status = 'active'
  limit 1;
end;
$$;

drop function if exists public.get_public_shop_branding_v2(text);
create function public.get_public_shop_branding_v2(p_shop_ref text)
returns table (
  shop_id uuid,
  shop_name text,
  display_name text,
  logo_url text,
  logo_background_color text,
  font_family text,
  custom_font_url text,
  header_font_weight integer,
  header_font_style text,
  corner_style text,
  primary_color text,
  accent_color text,
  login_layout text,
  login_image_url text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare sid uuid;
begin
  if nullif(btrim(p_shop_ref), '') is null then return; end if;
  if p_shop_ref ~* '^[0-9a-f-]{36}$' then
    sid := p_shop_ref::uuid;
  else
    sid := public.resolve_shop_by_slug(p_shop_ref);
  end if;
  if sid is null then return; end if;
  return query
  select
    b.id, b.name, s.display_name, s.logo_url, s.logo_background_color,
    s.font_family, s.custom_font_url, s.header_font_weight, s.header_font_style,
    s.corner_style, s.primary_color, s.accent_color, s.login_layout, s.login_image_url
  from public.barbershops b
  left join public.barbershop_settings s on s.barbershop_id = b.id
  where b.id = sid and b.status = 'active'
  limit 1;
end;
$$;
grant execute on function public.get_public_shop_branding_v2(text) to anon, authenticated;
