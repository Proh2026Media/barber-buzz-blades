-- Vertical 2: appointments

create type public.appointment_status as enum (
  'pending',
  'confirmed',
  'cancelled',
  'completed'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  staff_id uuid not null references public.staff (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_order check (ends_at > starts_at)
);

create index appointments_barbershop_starts_idx
  on public.appointments (barbershop_id, starts_at);

create index appointments_staff_starts_idx
  on public.appointments (staff_id, starts_at);

create index appointments_customer_id_idx
  on public.appointments (customer_id);

-- Prevent overlapping active bookings for the same staff
create extension if not exists btree_gist;

alter table public.appointments
  add constraint appointments_staff_no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('pending', 'confirmed'));

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- Keep service/staff in the same shop as the appointment
create or replace function public.appointments_same_shop()
returns trigger
language plpgsql
as $$
declare
  service_shop uuid;
  staff_shop uuid;
begin
  select barbershop_id into service_shop from public.services where id = new.service_id;
  select barbershop_id into staff_shop from public.staff where id = new.staff_id;
  if service_shop is distinct from new.barbershop_id then
    raise exception 'service must belong to appointment barbershop';
  end if;
  if staff_shop is distinct from new.barbershop_id then
    raise exception 'staff must belong to appointment barbershop';
  end if;
  return new;
end;
$$;

create trigger appointments_same_shop_trg
  before insert or update on public.appointments
  for each row execute function public.appointments_same_shop();

alter table public.appointments enable row level security;

create policy "Customers read own appointments"
  on public.appointments for select
  to authenticated
  using (
    customer_id = auth.uid()
    or public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  );

create policy "Customers create own appointments"
  on public.appointments for insert
  to authenticated
  with check (
    customer_id = auth.uid()
    and public.has_shop_role(barbershop_id, array['customer', 'shop_admin']::public.app_role[])
  );

create policy "Customers cancel own pending or confirmed"
  on public.appointments for update
  to authenticated
  using (
    (
      customer_id = auth.uid()
      and status in ('pending', 'confirmed')
    )
    or public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  )
  with check (
    (
      customer_id = auth.uid()
      and status = 'cancelled'
    )
    or public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  );
