create table public.appointment_cancellations (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  reason text check(reason in ('unexpected','schedule','plans','price','transport','service','other')),
  source text not null check(source in ('customer','shop')),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now()
);
alter table public.appointment_cancellations enable row level security;
revoke all on public.appointment_cancellations from anon, authenticated;

create function public.cancel_appointment(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare a appointments; origin text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_reason is not null and p_reason not in ('unexpected','schedule','plans','price','transport','service','other') then raise exception 'Invalid reason'; end if;
  select * into a from appointments where id=p_id for update;
  if a.id is null or a.status not in ('pending','confirmed') then raise exception 'Appointment cannot be cancelled'; end if;
  if a.customer_id=auth.uid() then origin := 'customer';
  elsif is_platform_admin() or has_shop_role(a.barbershop_id,array['shop_admin']::app_role[]) then origin := 'shop';
  else raise exception 'Not allowed'; end if;
  update appointments set status='cancelled' where id=a.id;
  insert into appointment_cancellations(appointment_id,reason,source,recorded_by)
  values(a.id,p_reason,origin,auth.uid());
end $$;

create function public.get_appointment_cancellations(p_shop_id uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_shop_id is null then
    return coalesce((select jsonb_agg(jsonb_build_object('appointment_id',c.appointment_id,'reason',c.reason,'source',c.source,'recorded_at',c.recorded_at)) from appointment_cancellations c join appointments a on a.id=c.appointment_id where a.customer_id=auth.uid()),'[]'::jsonb);
  end if;
  if not (is_platform_admin() or has_shop_role(p_shop_id,array['shop_admin']::app_role[])) then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('appointment_id',c.appointment_id,'reason',c.reason,'source',c.source,'recorded_at',c.recorded_at)) from appointment_cancellations c join appointments a on a.id=c.appointment_id where a.barbershop_id=p_shop_id),'[]'::jsonb);
end $$;
revoke all on function public.cancel_appointment(uuid,text),public.get_appointment_cancellations(uuid) from public,anon;
grant execute on function public.cancel_appointment(uuid,text),public.get_appointment_cancellations(uuid) to authenticated;
notify pgrst,'reload schema';
