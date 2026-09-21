-- Shop operating hours, closed weekdays and exceptional availability blocks.

alter table public.barbershops
  add column timezone text not null default 'America/Sao_Paulo';

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_open boolean not null default true,
  opens_at time not null default '09:00',
  closes_at time not null default '19:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbershop_id, weekday),
  constraint business_hours_time_order check (not is_open or closes_at > opens_at)
);

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  staff_id uuid references public.staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint availability_blocks_time_order check (ends_at > starts_at)
);

create index availability_blocks_shop_starts_idx
  on public.availability_blocks (barbershop_id, starts_at);
create index availability_blocks_staff_starts_idx
  on public.availability_blocks (staff_id, starts_at);

create trigger business_hours_set_updated_at
  before update on public.business_hours
  for each row execute function public.set_updated_at();

create or replace function public.seed_business_hours()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.business_hours (barbershop_id, weekday, is_open)
  select new.id, day, day between 1 and 6
  from generate_series(0, 6) as day
  on conflict (barbershop_id, weekday) do nothing;
  return new;
end;
$$;

create trigger barbershops_seed_business_hours_trg
  after insert on public.barbershops
  for each row execute function public.seed_business_hours();

insert into public.business_hours (barbershop_id, weekday, is_open)
select b.id, day, day between 1 and 6
from public.barbershops b
cross join generate_series(0, 6) as day
on conflict (barbershop_id, weekday) do nothing;

create or replace function public.availability_block_same_shop()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.staff_id is not null and not exists (
    select 1 from public.staff s
    where s.id = new.staff_id and s.barbershop_id = new.barbershop_id
  ) then
    raise exception 'staff must belong to availability block barbershop' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger availability_block_same_shop_trg
  before insert or update on public.availability_blocks
  for each row execute function public.availability_block_same_shop();

alter table public.business_hours enable row level security;
alter table public.availability_blocks enable row level security;

create policy "Shop members read business hours"
  on public.business_hours for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['customer', 'shop_admin']::public.app_role[])
  );

create policy "Shop admins manage business hours"
  on public.business_hours for all to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  );

create policy "Shop admins manage availability blocks"
  on public.availability_blocks for all to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  );

-- Clients receive occupied intervals without seeing private block reasons.
create or replace function public.get_staff_busy_intervals(
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  shop_id uuid;
begin
  if p_starts_at is null or p_ends_at is null
     or not isfinite(p_starts_at) or not isfinite(p_ends_at)
     or p_ends_at <= p_starts_at
     or p_ends_at - p_starts_at > interval '2 days' then
    raise exception 'Invalid availability interval' using errcode = '22023';
  end if;

  select s.barbershop_id into shop_id
  from public.staff s
  join public.barbershops b on b.id = s.barbershop_id
  where s.id = p_staff_id and s.active and b.status = 'active';

  if auth.uid() is null or shop_id is null or not (
    public.is_platform_admin()
    or public.has_shop_role(shop_id, array['customer', 'shop_admin']::public.app_role[])
  ) then
    raise exception 'Not authorized to view availability' using errcode = '42501';
  end if;

  return query
  select occupied.starts_at, occupied.ends_at
  from (
    select a.starts_at, a.ends_at
    from public.appointments a
    where a.staff_id = p_staff_id
      and a.status in ('pending', 'confirmed', 'completed')
      and a.starts_at < p_ends_at and a.ends_at > p_starts_at
    union all
    select greatest(block.starts_at, p_starts_at), least(block.ends_at, p_ends_at)
    from public.availability_blocks block
    where block.barbershop_id = shop_id
      and (block.staff_id is null or block.staff_id = p_staff_id)
      and block.starts_at < p_ends_at and block.ends_at > p_starts_at
  ) occupied
  order by occupied.starts_at;
end;
$$;

-- Enforce operating hours and blocks for direct API calls as well as the UI.
create or replace function public.appointments_validate_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_timezone text;
  local_start timestamp;
  local_end timestamp;
  day_hours public.business_hours%rowtype;
begin
  if tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at or new.staff_id is distinct from old.staff_id then
    if new.starts_at <= clock_timestamp() then
      raise exception 'O horário selecionado já passou. Escolha outro horário.' using errcode = '22023';
    end if;

    select b.timezone into shop_timezone from public.barbershops b where b.id = new.barbershop_id;
    local_start := new.starts_at at time zone shop_timezone;
    local_end := new.ends_at at time zone shop_timezone;

    select * into day_hours
    from public.business_hours h
    where h.barbershop_id = new.barbershop_id
      and h.weekday = extract(dow from local_start)::smallint;

    if day_hours.id is null or not day_hours.is_open
       or local_end::date <> local_start::date
       or local_start::time < day_hours.opens_at
       or local_end::time > day_hours.closes_at then
      raise exception 'O horário está fora do funcionamento da barbearia.' using errcode = '22023';
    end if;

    if exists (
      select 1 from public.availability_blocks block
      where block.barbershop_id = new.barbershop_id
        and (block.staff_id is null or block.staff_id = new.staff_id)
        and block.starts_at < new.ends_at and block.ends_at > new.starts_at
    ) then
      raise exception 'O horário está bloqueado pela barbearia.' using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
