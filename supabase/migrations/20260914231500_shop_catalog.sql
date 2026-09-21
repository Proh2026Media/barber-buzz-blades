-- Vertical 1: shop catalog (services + staff)

create table public.services (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  name text not null,
  duration_minutes int not null default 30 check (duration_minutes > 0),
  price_cents int not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_barbershop_id_idx on public.services (barbershop_id);
create index staff_barbershop_id_idx on public.staff (barbershop_id);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

alter table public.services enable row level security;
alter table public.staff enable row level security;

-- customers of the shop can read active catalog; shop_admin/platform_admin read all
create policy "Read services for shop members"
  on public.services for select
  to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
    or (
      active = true
      and public.has_shop_role(barbershop_id, array['customer']::public.app_role[])
    )
  );

create policy "Shop admins manage services"
  on public.services for all
  to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  );

create policy "Read staff for shop members"
  on public.staff for select
  to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
    or (
      active = true
      and public.has_shop_role(barbershop_id, array['customer']::public.app_role[])
    )
  );

create policy "Shop admins manage staff"
  on public.staff for all
  to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  );

-- Seed Arena Barber catalog
insert into public.services (barbershop_id, name, duration_minutes, price_cents, active)
select id, v.name, v.duration_minutes, v.price_cents, true
from public.barbershops b
cross join (
  values
    ('Corte Tradicional', 30, 4500),
    ('Barboterapia', 45, 6000),
    ('Combo Premium', 60, 9000)
) as v(name, duration_minutes, price_cents)
where b.slug = 'arena-barber'
  and not exists (
    select 1 from public.services s
    where s.barbershop_id = b.id and s.name = v.name
  );

insert into public.staff (barbershop_id, display_name, active)
select id, 'Mestre Carlão', true
from public.barbershops b
where b.slug = 'arena-barber'
  and not exists (
    select 1 from public.staff s
    where s.barbershop_id = b.id and s.display_name = 'Mestre Carlão'
  );
