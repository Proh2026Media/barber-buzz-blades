alter table public.appointment_facts
  add column customer_delay_minutes integer check(customer_delay_minutes between 1 and 1440),
  add column shop_delay_minutes integer check(shop_delay_minutes between 1 and 1440),
  add column occurrence_updated_at timestamptz,
  add column occurrence_recorded_by uuid references public.profiles(id) on delete set null,
  add constraint occurrence_no_show_exclusive check(no_show_at is null or (customer_delay_minutes is null and shop_delay_minutes is null));

create function public.save_appointment_occurrence(p_id uuid, p_customer_delay integer, p_shop_delay integer, p_no_show boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare a appointments; f appointment_facts;
begin
  select * into a from appointments where id=p_id for update;
  if auth.uid() is null or a.id is null or not (is_platform_admin() or has_shop_role(a.barbershop_id,array['shop_admin']::app_role[])) then raise exception 'Not allowed'; end if;
  if now()<a.starts_at or a.status not in ('pending','confirmed','completed') then raise exception 'Invalid appointment state'; end if;
  if (p_customer_delay is not null and p_customer_delay not between 1 and 1440) or (p_shop_delay is not null and p_shop_delay not between 1 and 1440) then raise exception 'Invalid delay'; end if;
  select * into f from appointment_facts where appointment_id=p_id;
  if f.no_show_at is not null then raise exception 'No show already recorded'; end if;
  if p_no_show then
    if now()<a.ends_at or a.status not in ('pending','confirmed') or p_customer_delay is not null or p_shop_delay is not null or f.customer_delay_minutes is not null or f.shop_delay_minutes is not null or f.arrived_at is not null or f.started_at is not null then raise exception 'Invalid no show'; end if;
  end if;
  insert into appointment_facts(appointment_id,customer_delay_minutes,shop_delay_minutes,no_show_at,occurrence_updated_at,occurrence_recorded_by)
  values(p_id,p_customer_delay,p_shop_delay,case when p_no_show then now() end,now(),auth.uid())
  on conflict(appointment_id) do update set
    customer_delay_minutes=excluded.customer_delay_minutes,shop_delay_minutes=excluded.shop_delay_minutes,
    no_show_at=excluded.no_show_at,occurrence_updated_at=excluded.occurrence_updated_at,occurrence_recorded_by=excluded.occurrence_recorded_by;
  if p_no_show then update appointments set status='cancelled' where id=p_id; end if;
end $$;
revoke all on function public.save_appointment_occurrence(uuid,integer,integer,boolean) from public,anon;
grant execute on function public.save_appointment_occurrence(uuid,integer,integer,boolean) to authenticated;

create function public.get_occurrence_insights(p_shop_id uuid,p_from timestamptz,p_to timestamptz) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not (is_platform_admin() or (p_shop_id is not null and has_shop_role(p_shop_id,array['shop_admin']::app_role[]))) then raise exception 'Not allowed'; end if;
  if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid period'; end if;
  return (select jsonb_build_object('customer_sample',count(f.customer_delay_minutes),'customer_mean',avg(f.customer_delay_minutes),'shop_sample',count(f.shop_delay_minutes),'shop_mean',avg(f.shop_delay_minutes))
    from appointments a join appointment_facts f on f.appointment_id=a.id
    where (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to);
end $$;
revoke all on function public.get_occurrence_insights(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_occurrence_insights(uuid,timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
