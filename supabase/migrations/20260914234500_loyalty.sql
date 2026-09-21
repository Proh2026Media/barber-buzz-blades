-- Vertical 3: loyalty points

create table public.loyalty_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  points int not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta int not null,
  reason text not null,
  appointment_id uuid references public.appointments (id) on delete set null,
  created_at timestamptz not null default now()
);

create index loyalty_ledger_user_id_idx on public.loyalty_ledger (user_id);

create trigger loyalty_accounts_set_updated_at
  before update on public.loyalty_accounts
  for each row execute function public.set_updated_at();

alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_ledger enable row level security;

create policy "Users read own loyalty account"
  on public.loyalty_accounts for select
  to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

create policy "Users read own loyalty ledger"
  on public.loyalty_ledger for select
  to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

-- Create loyalty account on profile creation (extend handle_new_user)
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

  insert into public.loyalty_accounts (user_id, points)
  values (new.id, 0)
  on conflict (user_id) do nothing;

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

-- Backfill accounts for existing profiles
insert into public.loyalty_accounts (user_id, points)
select p.id, 0
from public.profiles p
on conflict (user_id) do nothing;

-- Demo bootstrap user starts Exclusive-ready (matches previous mock)
update public.loyalty_accounts
set points = 550
where user_id = '6bf30c25-8992-47ad-b07b-660ffd463725';

create or replace function public.award_points_on_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    insert into public.loyalty_accounts (user_id, points)
    values (new.customer_id, 50)
    on conflict (user_id) do update
      set points = public.loyalty_accounts.points + 50,
          updated_at = now();

    insert into public.loyalty_ledger (user_id, delta, reason, appointment_id)
    values (new.customer_id, 50, 'appointment_completed', new.id);
  end if;
  return new;
end;
$$;

create trigger appointments_award_points
  after insert or update of status on public.appointments
  for each row execute function public.award_points_on_completed();
