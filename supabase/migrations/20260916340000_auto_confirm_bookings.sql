alter table public.appointments alter column status set default 'confirmed';
create function public.appointments_auto_confirm() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.status='pending' then new.status='confirmed'; end if;
  return new;
end $$;
create trigger appointments_auto_confirm_trg before insert on public.appointments
for each row execute function public.appointments_auto_confirm();
alter policy "Customers create own appointments" on public.appointments
with check(customer_id=auth.uid() and status='confirmed' and has_shop_role(barbershop_id,array['customer','shop_admin']::app_role[]));
-- Existing pending reservations were waiting for manual approval.
update public.appointments set status='confirmed' where status='pending';

create function public.appointments_block_no_show_completion() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.status='completed' and exists(select 1 from appointment_facts where appointment_id=new.id and no_show_at is not null)
    then raise exception 'A falta registrada não pode gerar conclusão ou pontos'; end if;
  return new;
end $$;
create trigger appointments_block_no_show_completion_trg before update on public.appointments
for each row execute function public.appointments_block_no_show_completion();
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
      status = 'confirmed'
  where id = p_appointment_id;

  return p_appointment_id;
end;
$$;

revoke all on function public.reschedule_own_appointment(uuid, uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.reschedule_own_appointment(uuid, uuid, uuid, timestamptz, timestamptz) to authenticated;


notify pgrst,'reload schema';
