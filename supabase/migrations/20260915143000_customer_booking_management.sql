-- Customers can atomically reschedule their own active appointment.
create or replace function public.reschedule_own_appointment(
  p_appointment_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_appointment public.appointments%rowtype;
begin
  select * into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if auth.uid() is null
     or current_appointment.id is null
     or current_appointment.customer_id <> auth.uid()
     or current_appointment.status not in ('pending', 'confirmed') then
    raise exception 'Appointment cannot be rescheduled' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.services s
    where s.id = p_service_id
      and s.barbershop_id = current_appointment.barbershop_id
      and s.active
  ) or not exists (
    select 1 from public.staff s
    where s.id = p_staff_id
      and s.barbershop_id = current_appointment.barbershop_id
      and s.active
  ) then
    raise exception 'Service or staff is unavailable' using errcode = '22023';
  end if;

  update public.appointments
  set service_id = p_service_id,
      staff_id = p_staff_id,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      status = 'pending'
  where id = p_appointment_id;

  return p_appointment_id;
end;
$$;

revoke all on function public.reschedule_own_appointment(uuid, uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.reschedule_own_appointment(uuid, uuid, uuid, timestamptz, timestamptz) to authenticated;

-- Preserve service and professional names in the customer's booking history,
-- even when an item is later disabled from the public catalog.
alter policy "Read services for shop members"
  on public.services
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
    or (active and public.has_shop_role(barbershop_id, array['customer']::public.app_role[]))
    or exists (
      select 1 from public.appointments a
      where a.service_id = services.id and a.customer_id = auth.uid()
    )
  );

alter policy "Read staff for shop members"
  on public.staff
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
    or (active and public.has_shop_role(barbershop_id, array['customer']::public.app_role[]))
    or exists (
      select 1 from public.appointments a
      where a.staff_id = staff.id and a.customer_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
