-- Availability exposes only occupied intervals, never another customer's booking.
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
  select a.starts_at, a.ends_at
  from public.appointments a
  where a.staff_id = p_staff_id
    and a.status in ('pending', 'confirmed', 'completed')
    and a.starts_at < p_ends_at
    and a.ends_at > p_starts_at
  order by a.starts_at;
end;
$$;

revoke all on function public.get_staff_busy_intervals(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_staff_busy_intervals(uuid, timestamptz, timestamptz) to authenticated;

-- A shop administrator needs the customer name when reading the shop's agenda.
create policy "Shop admins read appointment customers"
  on public.profiles for select to authenticated
  using (exists (
    select 1 from public.appointments a
    where a.customer_id = profiles.id
      and public.has_shop_role(a.barbershop_id, array['shop_admin']::public.app_role[])
  ));

-- Reject stale UI selections and direct API attempts, but allow closing old bookings.
create or replace function public.appointments_validate_booking()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.starts_at <= clock_timestamp() then
      raise exception 'O horário selecionado já passou. Escolha outro horário.' using errcode = '22023';
    end if;
  elsif new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    if new.starts_at <= clock_timestamp() then
      raise exception 'O horário selecionado já passou. Escolha outro horário.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger appointments_validate_booking_trg
  before insert or update on public.appointments
  for each row execute function public.appointments_validate_booking();

-- Customers must not be able to insert a completed booking and award themselves points.
alter policy "Customers create own appointments"
  on public.appointments
  with check (
    customer_id = auth.uid()
    and status = 'pending'
    and public.has_shop_role(barbershop_id, array['customer', 'shop_admin']::public.app_role[])
  );

-- Preserve existing balances/history. If historical duplicate awards exist, this
-- index intentionally fails so they can be reviewed rather than silently removed.
create unique index loyalty_ledger_completion_once_idx
  on public.loyalty_ledger (appointment_id)
  where reason = 'appointment_completed' and appointment_id is not null;

create or replace function public.award_points_on_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    -- Claim the award atomically before changing the balance. Reopening and
    -- completing the same appointment again leaves the balance unchanged.
    insert into public.loyalty_ledger (user_id, delta, reason, appointment_id)
    values (new.customer_id, 50, 'appointment_completed', new.id)
    on conflict (appointment_id)
      where reason = 'appointment_completed' and appointment_id is not null
      do nothing;

    if found then
      insert into public.loyalty_accounts (user_id, points)
      values (new.customer_id, 50)
      on conflict (user_id) do update
        set points = public.loyalty_accounts.points + 50,
            updated_at = now();
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
