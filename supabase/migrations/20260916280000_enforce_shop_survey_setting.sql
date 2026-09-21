-- Enforce the shop switch even when survey RPCs are called directly.
create or replace function public.enforce_shop_survey_program()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_id uuid;
begin
  if new.appointment_id is not null then
    select a.barbershop_id into shop_id
    from public.appointments a
    where a.id = new.appointment_id and a.customer_id = new.user_id;
  end if;

  if shop_id is null then
    select a.barbershop_id into shop_id
    from public.appointments a
    where a.customer_id = new.user_id
    order by a.starts_at desc, a.id
    limit 1;
  end if;

  if shop_id is not null and not coalesce(
    (select s.survey_program_enabled from public.barbershop_settings s where s.barbershop_id = shop_id),
    true
  ) then
    raise exception 'Shop survey program disabled';
  end if;

  return new;
end;
$$;

create trigger customer_surveys_enforce_shop_program
  before insert or update of answer, state on public.customer_surveys
  for each row execute function public.enforce_shop_survey_program();
