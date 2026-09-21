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
     or current_appointment.status not in ('pending', 'confirmed', 'reschedule_requested') then
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
      status = 'confirmed'
  where id = p_appointment_id;

  return p_appointment_id;
end;
$$;

revoke all on function public.reschedule_own_appointment(uuid, uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.reschedule_own_appointment(uuid, uuid, uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.cancel_appointment(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare a appointments; origin text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_reason is not null and p_reason not in ('unexpected','schedule','plans','price','transport','service','other') then raise exception 'Invalid reason'; end if;
  select * into a from appointments where id=p_id for update;
  if a.id is null or a.status not in ('pending','confirmed','reschedule_requested') then raise exception 'Appointment cannot be cancelled'; end if;
  if a.customer_id=auth.uid() then origin := 'customer';
  elsif is_platform_admin() or has_shop_role(a.barbershop_id,array['shop_admin']::app_role[]) then origin := 'shop';
  else raise exception 'Not allowed'; end if;
  update appointments set status='cancelled' where id=a.id;
  insert into appointment_cancellations(appointment_id,reason,source,recorded_by)
  values(a.id,p_reason,origin,auth.uid());
end $$;


create function public.withdraw_appointment_confirmation(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare a appointments;
begin
 select * into a from appointments where id=p_id for update;
 if auth.uid() is null or a.id is null or not(is_platform_admin() or has_shop_role(a.barbershop_id,array['shop_admin']::app_role[])) then raise exception 'Not allowed'; end if;
 if a.status<>'confirmed' then raise exception 'Appointment not confirmed'; end if;
 update appointments set status='reschedule_requested' where id=p_id;
end $$;
revoke all on function public.withdraw_appointment_confirmation(uuid) from public,anon;
grant execute on function public.withdraw_appointment_confirmation(uuid) to authenticated;
notify pgrst,'reload schema';
