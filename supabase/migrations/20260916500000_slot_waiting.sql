-- Optional, single-customer waiting windows. Existing appointments are unchanged.
alter table public.barbershop_settings
 add column waiting_enabled boolean not null default false,
 add column waiting_cutoff_minutes integer not null default 30 check (waiting_cutoff_minutes between 0 and 1440);

create table public.slot_waits (
 id uuid primary key default gen_random_uuid(),
 barbershop_id uuid not null references public.barbershops(id),
 appointment_id uuid not null references public.appointments(id),
 staff_id uuid not null references public.staff(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 hold_until timestamptz not null,
 claim_until timestamptz not null,
 customer_id uuid references public.profiles(id),
 service_id uuid references public.services(id),
 state text not null default 'holding' check (state in ('holding','exclusive','released','restored','claimed','disabled')),
 restorable boolean not null default true,
 claimed_appointment_id uuid references public.appointments(id),
 created_at timestamptz not null default now(),
 check (ends_at > starts_at and claim_until > hold_until),
 check ((customer_id is null) = (service_id is null))
);
create unique index slot_waits_one_active_origin on public.slot_waits(appointment_id) where state in ('holding','exclusive');
create index slot_waits_active_staff on public.slot_waits(staff_id) where state in ('holding','exclusive');
alter table public.slot_waits enable row level security;
revoke all on public.slot_waits from anon, authenticated;

-- Durable in-app messages; event identity is also the future external-delivery dedupe key.
create table public.waiting_events (
 id uuid primary key default gen_random_uuid(),
 wait_id uuid not null references public.slot_waits(id),
 user_id uuid not null references public.profiles(id),
 kind text not null,
 starts_at timestamptz not null,
 deadline timestamptz,
 created_at timestamptz not null default now(),
 unique(wait_id,user_id,kind)
);
alter table public.waiting_events enable row level security;
revoke all on public.waiting_events from anon, authenticated;
grant select on public.waiting_events to authenticated;
create policy waiting_events_own on public.waiting_events for select to authenticated using(user_id=auth.uid());

create function public.emit_waiting_event(w public.slot_waits, p_kind text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if w.customer_id is not null then
  insert into waiting_events(wait_id,user_id,kind,starts_at,deadline)
  values(w.id,w.customer_id,p_kind,w.starts_at,case when p_kind='exclusive' then w.claim_until end)
  on conflict do nothing;
 end if;
end $$;

create function public.process_slot_waits() returns void
language plpgsql security definer set search_path=public as $$
declare w slot_waits; t timestamptz := clock_timestamp();
begin
 for w in select * from slot_waits where state in ('holding','exclusive') and hold_until<=t for update skip locked loop
  if w.customer_id is null or w.claim_until<=t or w.starts_at<=t then
   update slot_waits set state='released' where id=w.id;
   perform emit_waiting_event(w,'expired');
  elsif w.state='holding' then
   update slot_waits set state='exclusive' where id=w.id;
   perform emit_waiting_event(w,'exclusive');
  end if;
 end loop;
end $$;

-- Every appointment write serializes on its professional, including direct API writes.
create function public.guard_waiting_booking() returns trigger
language plpgsql security definer set search_path=public as $$
declare t timestamptz := clock_timestamp();
begin
 perform 1 from staff where id=new.staff_id for update;
 if new.status in ('pending','confirmed','completed') and exists (
  select 1 from slot_waits w where w.staff_id=new.staff_id and w.state in ('holding','exclusive')
   and (w.hold_until>t or (w.customer_id is not null and w.claim_until>t))
   and w.starts_at<new.ends_at and w.ends_at>new.starts_at
 ) then raise exception 'Este horário está reservado para a espera.' using errcode='23P01'; end if;
 return new;
end $$;
create trigger appointments_waiting_guard before insert or update on public.appointments for each row execute function public.guard_waiting_booking();

create function public.invalidate_waiting_restoration() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if old.status='reschedule_requested' and (new.status<>old.status or new.starts_at<>old.starts_at or new.staff_id<>old.staff_id) then
  update slot_waits set restorable=false where appointment_id=new.id and state in ('holding','exclusive');
 end if;
 return new;
end $$;
create trigger appointments_waiting_restoration after update on public.appointments for each row execute function public.invalidate_waiting_restoration();

create or replace function public.withdraw_appointment_confirmation(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare a appointments; s barbershop_settings; t timestamptz;
begin
 select * into a from appointments where id=p_id for update;
 if auth.uid() is null or a.id is null or not(is_platform_admin() or has_shop_role(a.barbershop_id,array['shop_admin']::app_role[])) then raise exception 'Not allowed' using errcode='42501'; end if;
 select * into s from barbershop_settings where barbershop_id=a.barbershop_id for update;
 perform 1 from staff where id=a.staff_id for update;
 t:=clock_timestamp();
 if a.status<>'confirmed' then raise exception 'Appointment not confirmed'; end if;
 update appointments set status='reschedule_requested' where id=p_id;
 if s.waiting_enabled and a.starts_at>=t+make_interval(mins=>s.waiting_cutoff_minutes+15) then
  insert into slot_waits(barbershop_id,appointment_id,staff_id,starts_at,ends_at,hold_until,claim_until)
  values(a.barbershop_id,a.id,a.staff_id,a.starts_at,a.ends_at,t+interval '10 minutes',t+interval '15 minutes');
 end if;
end $$;

create function public.guard_waiting_settings() returns trigger
language plpgsql security definer set search_path=public as $$
declare w slot_waits;
begin
 if tg_op='UPDATE' and (new.waiting_enabled is distinct from old.waiting_enabled or new.waiting_cutoff_minutes is distinct from old.waiting_cutoff_minutes) then
  if auth.uid() is null or not(is_platform_admin() or has_shop_role(new.barbershop_id,array['shop_admin']::app_role[])) then raise exception 'Not allowed' using errcode='42501'; end if;
  if old.waiting_enabled and not new.waiting_enabled then
   for w in select * from slot_waits where barbershop_id=new.barbershop_id and state in ('holding','exclusive') for update loop
    update slot_waits set state='disabled' where id=w.id;
    perform emit_waiting_event(w,'disabled');
   end loop;
  end if;
 end if;
 return new;
end $$;
create trigger settings_waiting_guard before update on public.barbershop_settings for each row execute function public.guard_waiting_settings();

create function public.waiting_action(p_id uuid,p_action text,p_service_id uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare w slot_waits; s services; a appointments; result uuid; t timestamptz;
begin
 select * into w from slot_waits where id=p_id;
 if auth.uid() is null or w.id is null or not(is_platform_admin() or has_shop_role(w.barbershop_id,array['customer','shop_admin']::app_role[])) then raise exception 'Not allowed' using errcode='42501'; end if;
 -- Use the same settings -> staff -> wait lock order as withdrawals.
 perform 1 from barbershop_settings where barbershop_id=w.barbershop_id for update;
 perform 1 from staff where id=w.staff_id for update;
 perform process_slot_waits();
 select * into w from slot_waits where id=p_id for update;
 t:=clock_timestamp();
 if w.state not in ('holding','exclusive') or w.starts_at<=t then raise exception 'A espera já foi encerrada.'; end if;
 if p_action='join' then
  if w.hold_until<=t or w.customer_id is not null then raise exception 'Outro cliente já entrou ou o prazo terminou.'; end if;
  if exists(select 1 from appointments where id=w.appointment_id and customer_id=auth.uid()) then raise exception 'Você já é o titular desta reserva.'; end if;
  select * into s from services where id=p_service_id and barbershop_id=w.barbershop_id and active;
  if s.id is null or s.duration_minutes*interval '1 minute'>w.ends_at-w.starts_at
   or not exists(select 1 from staff where id=w.staff_id and active) then raise exception 'Serviço indisponível para este intervalo.'; end if;
  update slot_waits set customer_id=auth.uid(),service_id=s.id where id=w.id;
 elsif p_action='leave' then
  if w.customer_id is distinct from auth.uid() then raise exception 'Not allowed' using errcode='42501'; end if;
  perform emit_waiting_event(w,'left');
  if w.hold_until>t then update slot_waits set customer_id=null,service_id=null where id=w.id;
  else update slot_waits set state='released' where id=w.id; end if;
 elsif p_action='restore' then
  if not(is_platform_admin() or has_shop_role(w.barbershop_id,array['shop_admin']::app_role[])) then raise exception 'Not allowed' using errcode='42501'; end if;
  select * into a from appointments where id=w.appointment_id for update;
  if not w.restorable or w.hold_until<=t or a.status<>'reschedule_requested' or a.starts_at<>w.starts_at or a.staff_id<>w.staff_id then raise exception 'A reserva original não pode mais ser restaurada.'; end if;
  update slot_waits set state='restored' where id=w.id;
  update appointments set status='confirmed' where id=a.id;
  perform emit_waiting_event(w,'restored');
 elsif p_action='claim' then
  if w.customer_id is distinct from auth.uid() then raise exception 'Not allowed' using errcode='42501'; end if;
  if w.hold_until>t or w.claim_until<=t then raise exception 'A vaga ainda não foi liberada ou o prazo terminou.'; end if;
  select * into s from services where id=w.service_id and active and barbershop_id=w.barbershop_id;
  if s.id is null or s.duration_minutes*interval '1 minute'>w.ends_at-w.starts_at
   or not exists(select 1 from staff where id=w.staff_id and active) then raise exception 'Serviço ou profissional indisponível.'; end if;
  update slot_waits set state='claimed' where id=w.id;
  insert into appointments(barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at,status)
  values(w.barbershop_id,auth.uid(),s.id,w.staff_id,w.starts_at,w.starts_at+s.duration_minutes*interval '1 minute','confirmed') returning id into result;
  update slot_waits set claimed_appointment_id=result where id=w.id;
  perform emit_waiting_event(w,'claimed');
 else raise exception 'Invalid action'; end if;
 return result;
end $$;

create function public.get_waiting_state(p_shop_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare admin_view boolean; t timestamptz; result jsonb;
begin
 if auth.uid() is null or not(is_platform_admin() or has_shop_role(p_shop_id,array['customer','shop_admin']::app_role[])) then raise exception 'Not allowed' using errcode='42501'; end if;
 perform process_slot_waits();
 t:=clock_timestamp();
 admin_view:=is_platform_admin() or has_shop_role(p_shop_id,array['shop_admin']::app_role[]);
 select jsonb_build_object('server_now',t,'waits',coalesce(jsonb_agg(jsonb_build_object(
  'id',w.id,'appointment_id',case when admin_view then w.appointment_id end,'staff_id',w.staff_id,
  'starts_at',w.starts_at,'ends_at',w.ends_at,'hold_until',w.hold_until,'claim_until',w.claim_until,
  'state',w.state,'mine',w.customer_id=auth.uid(),'has_interest',w.customer_id is not null,
  'service_id',case when w.customer_id=auth.uid() then w.service_id end,
  'restorable',admin_view and w.restorable and w.hold_until>t
 )),'[]'::jsonb),'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb)
 from (select e.* from waiting_events e join slot_waits sw on sw.id=e.wait_id where e.user_id=auth.uid() and sw.barbershop_id=p_shop_id order by e.created_at desc limit 50) e)) into result
 from slot_waits w where w.barbershop_id=p_shop_id and w.state in ('holding','exclusive')
 and (w.hold_until>t or (w.customer_id is not null and w.claim_until>t))
 and (admin_view or w.customer_id=auth.uid() or (w.customer_id is null and w.hold_until>t and not exists(select 1 from appointments a where a.id=w.appointment_id and a.customer_id=auth.uid())));
 return result;
end $$;

-- Extend the existing privacy-safe busy interval endpoint without duplicating its validation.
alter function public.get_staff_busy_intervals(uuid,timestamptz,timestamptz) rename to get_staff_busy_intervals_without_waits;
create function public.get_staff_busy_intervals(p_staff_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns table(starts_at timestamptz,ends_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
 perform process_slot_waits();
 return query select * from get_staff_busy_intervals_without_waits(p_staff_id,p_starts_at,p_ends_at);
 return query select w.starts_at,w.ends_at from slot_waits w where w.staff_id=p_staff_id and w.state in ('holding','exclusive')
  and (w.hold_until>clock_timestamp() or (w.customer_id is not null and w.claim_until>clock_timestamp()))
  and w.starts_at<p_ends_at and w.ends_at>p_starts_at;
end $$;

revoke all on function public.emit_waiting_event(public.slot_waits,text),public.process_slot_waits(),public.guard_waiting_booking(),public.invalidate_waiting_restoration(),public.guard_waiting_settings(),public.waiting_action(uuid,text,uuid),public.get_waiting_state(uuid),public.get_staff_busy_intervals(uuid,timestamptz,timestamptz),public.get_staff_busy_intervals_without_waits(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.waiting_action(uuid,text,uuid),public.get_waiting_state(uuid),public.get_staff_busy_intervals(uuid,timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
