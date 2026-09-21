-- Foundation: multi-tenant barbershops + profiles + memberships + RLS

create extension if not exists "pgcrypto";

create type public.app_role as enum ('customer', 'shop_admin', 'platform_admin');
create type public.barbershop_status as enum ('active', 'suspended');

create table public.barbershops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.barbershop_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint barbershops_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  barbershop_id uuid references public.barbershops (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  constraint memberships_shop_required_for_non_platform
    check (
      (role = 'platform_admin' and barbershop_id is null)
      or (role <> 'platform_admin' and barbershop_id is not null)
    )
);

create unique index memberships_user_shop_role_idx
  on public.memberships (user_id, barbershop_id, role)
  where barbershop_id is not null;

create unique index memberships_platform_admin_once_idx
  on public.memberships (user_id)
  where role = 'platform_admin';

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_barbershop_id_idx on public.memberships (barbershop_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger barbershops_set_updated_at
  before update on public.barbershops
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.role = 'platform_admin'
  );
$$;

create or replace function public.has_shop_role(p_shop_id uuid, p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.barbershop_id = p_shop_id
      and m.role = any (p_roles)
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  demo_shop_id uuid;
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );

  select id into demo_shop_id
  from public.barbershops
  where slug = 'arena-barber'
  limit 1;

  if demo_shop_id is not null then
    insert into public.memberships (user_id, barbershop_id, role)
    select new.id, demo_shop_id, 'customer'
    where not exists (
      select 1
      from public.memberships m
      where m.user_id = new.id
        and m.barbershop_id = demo_shop_id
        and m.role = 'customer'
    );
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.barbershops enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

-- barbershops
create policy "Members can read their shops"
  on public.barbershops for select
  to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(id, array['customer', 'shop_admin']::public.app_role[])
  );

create policy "Platform admins can insert shops"
  on public.barbershops for insert
  to authenticated
  with check (public.is_platform_admin());

create policy "Platform or shop admin can update shops"
  on public.barbershops for update
  to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(id, array['shop_admin']::public.app_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_shop_role(id, array['shop_admin']::public.app_role[])
  );

create policy "Platform admins can delete shops"
  on public.barbershops for delete
  to authenticated
  using (public.is_platform_admin());

-- profiles
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_platform_admin());

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Platform admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- memberships
create policy "Users can read own memberships"
  on public.memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or (
      barbershop_id is not null
      and public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
    )
  );

create policy "Platform admins manage memberships"
  on public.memberships for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Shop admins can insert customer memberships"
  on public.memberships for insert
  to authenticated
  with check (
    role = 'customer'
    and barbershop_id is not null
    and public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  );

-- Seed demo shop
insert into public.barbershops (name, slug, status)
values ('Arena Barber', 'arena-barber', 'active')
on conflict (slug) do nothing;

-- After first signup, promote a user in SQL editor if needed:
-- insert into public.memberships (user_id, barbershop_id, role)
-- values ('<user-uuid>', null, 'platform_admin');
-- insert into public.memberships (user_id, barbershop_id, role)
-- values ('<user-uuid>', (select id from public.barbershops where slug = 'arena-barber'), 'shop_admin');
