-- Operational facts, explicit optional preferences, and versioned surveys.
create table public.customer_privacy (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  analytics boolean not null default false,
  surveys boolean not null default false,
  marketing boolean not null default false,
  last_survey_at timestamptz,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.privacy_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  analytics boolean not null, surveys boolean not null, marketing boolean not null,
  version integer not null default 1, recorded_at timestamptz not null default now()
);
create table public.customer_surveys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question text not null check (question in ('discovery','period','professional','frequency','conversation')),
  version integer not null default 1,
  answer text,
  state text not null default 'shown' check (state in ('shown','answered','dismissed')),
  shown_at timestamptz not null default now(),
  answered_at timestamptz,
  source text not null default 'customer_app' check (source = 'customer_app')
);
create index customer_surveys_user_date on public.customer_surveys(user_id, shown_at desc);
create table public.customer_usage_events (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  event text not null check (event in ('catalog_viewed','booking_started','booking_succeeded','booking_failed','availability_empty')),
  version integer not null default 1,
  received_at timestamptz not null default now()
);
create index customer_usage_events_date on public.customer_usage_events(received_at);
create table public.appointment_facts (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  quoted_price_cents integer check (quoted_price_cents >= 0),
  arrived_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  no_show_at timestamptz,
  recorded_by uuid references public.profiles(id) on delete set null,
  captured_at timestamptz not null default now()
);
create table public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  previous_status public.appointment_status,
  status public.appointment_status not null,
  previous_starts_at timestamptz,
  starts_at timestamptz not null,
  recorded_at timestamptz not null default now()
);
alter table public.customer_privacy enable row level security;
alter table public.privacy_history enable row level security;
alter table public.customer_surveys enable row level security;
alter table public.customer_usage_events enable row level security;
alter table public.appointment_facts enable row level security;
alter table public.appointment_history enable row level security;
-- All access goes through bounded RPCs; no direct client writes.
revoke all on public.customer_privacy, public.privacy_history, public.customer_surveys,
  public.customer_usage_events, public.appointment_facts, public.appointment_history from anon, authenticated;

create function public.get_my_privacy() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'preferences', coalesce((select to_jsonb(p) from customer_privacy p where user_id = auth.uid()), '{"analytics":false,"surveys":false,"marketing":false}'::jsonb),
    'history', coalesce((select jsonb_agg(h order by h.recorded_at desc) from privacy_history h where user_id = auth.uid()), '[]'::jsonb),
    'responses', coalesce((select jsonb_agg(s order by s.shown_at desc) from customer_surveys s where user_id = auth.uid()), '[]'::jsonb)
  );
end $$;

create function public.save_my_privacy(p_analytics boolean, p_surveys boolean, p_marketing boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 11));
  insert into customer_privacy(user_id, analytics, surveys, marketing)
  values (auth.uid(), p_analytics, p_surveys, p_marketing)
  on conflict (user_id) do update set analytics = excluded.analytics, surveys = excluded.surveys,
    marketing = excluded.marketing, updated_at = now();
  insert into privacy_history(user_id, analytics, surveys, marketing)
    values (auth.uid(), p_analytics, p_surveys, p_marketing);
  if not p_analytics then delete from customer_usage_events where user_id = auth.uid(); end if;
  if not p_surveys then update customer_surveys set state = 'dismissed' where user_id = auth.uid() and state = 'shown'; end if;
end $$;

create function public.next_customer_survey() returns jsonb language plpgsql security definer set search_path = public as $$
declare q text; result customer_surveys;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 11));
  if not coalesce((select surveys from customer_privacy where user_id = auth.uid()), false) then return null; end if;
  if not exists(select 1 from appointments where customer_id = auth.uid()) then return null; end if;
  if exists(select 1 from customer_privacy where user_id = auth.uid() and last_survey_at > now() - interval '30 days') then return null; end if;
  if exists(select 1 from customer_surveys where user_id = auth.uid() and shown_at > now() - interval '30 days') then return null; end if;
  select candidate into q from unnest(array['discovery','period','professional','frequency','conversation']) with ordinality as choices(candidate, position)
  where not exists(select 1 from customer_surveys where user_id = auth.uid() and question = candidate
    and (candidate = 'discovery' or shown_at > now() - interval '180 days')) order by position limit 1;
  if q is null then return null; end if;
  insert into customer_surveys(user_id, question) values (auth.uid(), q) returning * into result;
  update customer_privacy set last_survey_at = now() where user_id = auth.uid();
  return to_jsonb(result);
end $$;

create function public.answer_customer_survey(p_id uuid, p_answer text) returns void language plpgsql security definer set search_path = public as $$
declare q text; allowed text[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 11));
  if not coalesce((select surveys from customer_privacy where user_id = auth.uid()), false) then raise exception 'Surveys disabled'; end if;
  select question into q from customer_surveys where id = p_id and user_id = auth.uid() and state = 'shown' for update;
  if q is null then raise exception 'Survey unavailable'; end if;
  allowed := case q
    when 'discovery' then array['referral','walk_by','google','instagram','other','skip']
    when 'period' then array['morning','afternoon','evening','varies','skip']
    when 'professional' then array['same','available','by_service','no_preference','skip']
    when 'frequency' then array['up_to_15','16_to_30','31_to_60','over_60','undefined','skip']
    when 'conversation' then array['talk','quiet','decide_on_day','no_preference','skip'] end;
  if p_answer is not null and not (p_answer = any(allowed)) then raise exception 'Invalid answer'; end if;
  update customer_surveys set answer = p_answer, state = case when p_answer is null then 'dismissed' else 'answered' end,
    answered_at = now() where id = p_id;
end $$;

create function public.record_customer_usage(p_id uuid, p_shop_id uuid, p_event text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 11));
  if not coalesce((select analytics from customer_privacy where user_id = auth.uid()), false) then return; end if;
  if not has_shop_role(p_shop_id, array['customer','shop_admin']::app_role[]) then raise exception 'Shop unavailable'; end if;
  insert into customer_usage_events(id, user_id, barbershop_id, event) values(p_id, auth.uid(), p_shop_id, p_event) on conflict (id) do nothing;
end $$;

create function public.capture_appointment_facts() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    insert into appointment_facts(appointment_id, quoted_price_cents) select new.id, price_cents from services where id = new.service_id;
    insert into appointment_history(appointment_id, actor_id, status, starts_at) values(new.id, auth.uid(), new.status, new.starts_at);
  else
    if old.service_id is distinct from new.service_id then
      update appointment_facts set quoted_price_cents = (select price_cents from services where id = new.service_id) where appointment_id = new.id;
    end if;
    if old.status is distinct from new.status or old.starts_at is distinct from new.starts_at then
      insert into appointment_history(appointment_id, actor_id, previous_status, status, previous_starts_at, starts_at)
      values(new.id, auth.uid(), old.status, new.status, old.starts_at, new.starts_at);
    end if;
    if new.status = 'completed' and old.status <> 'completed' then
      update appointment_facts set finished_at = now(), recorded_by = auth.uid() where appointment_id = new.id;
    end if;
  end if;
  return new;
end $$;
create trigger capture_appointment_facts after insert or update on public.appointments for each row execute function public.capture_appointment_facts();

create function public.erase_my_optional_data() returns void language plpgsql security definer set search_path = public as $$
begin
  perform save_my_privacy(false, false, false);
  delete from customer_surveys where user_id = auth.uid();
end $$;

revoke all on function public.get_my_privacy(), public.save_my_privacy(boolean,boolean,boolean), public.next_customer_survey(), public.answer_customer_survey(uuid,text), public.record_customer_usage(uuid,uuid,text), public.erase_my_optional_data() from public, anon;
grant execute on function public.get_my_privacy(), public.save_my_privacy(boolean,boolean,boolean), public.next_customer_survey(), public.answer_customer_survey(uuid,text), public.record_customer_usage(uuid,uuid,text), public.erase_my_optional_data() to authenticated;
create function public.record_attendance(p_appointment_id uuid, p_stage text) returns void
language plpgsql security definer set search_path = public as $$
declare a appointments;
begin
  select * into a from appointments where id = p_appointment_id for update;
  if a.id is null or not (is_platform_admin() or has_shop_role(a.barbershop_id, array['shop_admin']::app_role[])) then raise exception 'Not allowed'; end if;
  if a.status not in ('pending','confirmed') then raise exception 'Appointment is not active'; end if;
  if p_stage in ('arrived','started') and (a.starts_at at time zone (select timezone from barbershops where id = a.barbershop_id))::date <> (now() at time zone (select timezone from barbershops where id = a.barbershop_id))::date then raise exception 'Attendance must be recorded on the appointment day'; end if;
  if p_stage not in ('arrived','started','no_show') then raise exception 'Invalid stage'; end if;
  if p_stage = 'no_show' and now() < a.ends_at then raise exception 'Wait until the scheduled end'; end if;
  insert into appointment_facts(appointment_id) values(a.id) on conflict do nothing;
  if p_stage = 'arrived' then
    update appointment_facts set arrived_at = coalesce(arrived_at, now()), recorded_by = auth.uid() where appointment_id = a.id;
  elsif p_stage = 'started' then
    if not exists(select 1 from appointment_facts where appointment_id = a.id and arrived_at is not null) then raise exception 'Record arrival first'; end if;
    update appointment_facts set started_at = coalesce(started_at, now()), recorded_by = auth.uid() where appointment_id = a.id;
  else
    if exists(select 1 from appointment_facts where appointment_id = a.id and arrived_at is not null) then raise exception 'Customer already arrived'; end if;
    update appointment_facts set no_show_at = now(), recorded_by = auth.uid() where appointment_id = a.id;
    update appointments set status = 'cancelled' where id = a.id;
  end if;
end $$;

create function public.get_appointment_attendance(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare a appointments;
begin
  select * into a from appointments where id = p_id;
  if a.id is null or auth.uid() is null or not (a.customer_id = auth.uid() or is_platform_admin() or has_shop_role(a.barbershop_id, array['shop_admin']::app_role[])) then raise exception 'Not allowed'; end if;
  return coalesce((select to_jsonb(f) from appointment_facts f where appointment_id = a.id), '{}'::jsonb);
end $$;
revoke all on function public.get_appointment_attendance(uuid) from public, anon;
grant execute on function public.get_appointment_attendance(uuid) to authenticated;

create function public.get_business_insights(p_shop_id uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if auth.uid() is null or not (is_platform_admin() or (p_shop_id is not null and has_shop_role(p_shop_id, array['shop_admin']::app_role[]))) then raise exception 'Not allowed'; end if;
  if p_to <= p_from or p_to - p_from > interval '366 days' then raise exception 'Invalid period'; end if;
  select jsonb_build_object(
    'bookings', count(*), 'customers', count(distinct a.customer_id),
    'completed', count(*) filter(where a.status = 'completed'),
    'cancelled', count(*) filter(where a.status = 'cancelled' and f.no_show_at is null),
    'no_shows', count(*) filter(where f.no_show_at is not null),
    'quoted_completed_cents', coalesce(sum(f.quoted_price_cents) filter(where a.status = 'completed'),0),
    'missing_price', count(*) filter(where f.quoted_price_cents is null),
    'wait_sample', count(*) filter(where f.arrived_at is not null and f.started_at is not null),
    'mean_wait_minutes', avg(extract(epoch from (f.started_at - f.arrived_at))/60) filter(where f.started_at is not null),
    'attendance', case when p_shop_id is null then '[]'::jsonb else coalesce(jsonb_agg(jsonb_build_object('id',a.id,'arrived_at',f.arrived_at,'started_at',f.started_at,'no_show_at',f.no_show_at)), '[]'::jsonb) end
  ) into result from appointments a left join appointment_facts f on f.appointment_id = a.id
  where (p_shop_id is null or a.barbershop_id = p_shop_id) and a.starts_at >= p_from and a.starts_at < p_to;
  -- Only aggregate usage, restricted to the requested shop and server receipt window.
  return result || jsonb_build_object('usage', coalesce((select jsonb_object_agg(event, total) from (
    select event, count(*) total from customer_usage_events where (p_shop_id is null or barbershop_id = p_shop_id)
      and received_at >= p_from and received_at < p_to group by event
  ) counts), '{}'::jsonb));
end $$;
revoke all on function public.record_attendance(uuid,text), public.get_business_insights(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.record_attendance(uuid,text), public.get_business_insights(uuid,timestamptz,timestamptz) to authenticated;

-- Operational deployment must schedule this function daily; it cannot be called by clients.
create function public.purge_customer_usage() returns void language sql security definer set search_path = public as $$
  delete from customer_usage_events where received_at < now() - interval '90 days';
$$;
revoke all on function public.purge_customer_usage() from public, anon, authenticated;
notify pgrst, 'reload schema';
