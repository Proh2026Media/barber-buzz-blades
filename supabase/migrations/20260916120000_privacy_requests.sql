create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested' check(status in ('requested','reviewing','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index privacy_requests_one_active on public.privacy_requests(user_id) where status in ('requested','reviewing');
alter table public.privacy_requests enable row level security;
revoke all on public.privacy_requests from anon, authenticated;

create function public.export_my_data() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'format_version',1,'exported_at',now(),
    'account',(select jsonb_build_object('id',id,'email',email,'phone',phone,'created_at',created_at) from auth.users where id = auth.uid()),
    'profile',(select to_jsonb(p) from profiles p where id = auth.uid()),
    'appointments',coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('service_name',s.name,'staff_name',t.display_name,'shop_name',b.name) order by a.starts_at desc) from appointments a join services s on s.id=a.service_id join staff t on t.id=a.staff_id join barbershops b on b.id=a.barbershop_id where a.customer_id=auth.uid()),'[]'::jsonb),
    'appointment_facts',coalesce((select jsonb_agg(to_jsonb(f) - 'recorded_by') from appointment_facts f join appointments a on a.id=f.appointment_id where a.customer_id=auth.uid()),'[]'::jsonb),
    'appointment_history',coalesce((select jsonb_agg(to_jsonb(h) - 'actor_id' order by h.recorded_at) from appointment_history h join appointments a on a.id=h.appointment_id where a.customer_id=auth.uid()),'[]'::jsonb),
    'loyalty',coalesce((select jsonb_agg(l) from loyalty_ledger l where user_id=auth.uid()),'[]'::jsonb),
    'privacy',get_my_privacy(),
    'usage',coalesce((select jsonb_agg(e order by received_at) from customer_usage_events e where user_id=auth.uid()),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(r order by created_at desc) from privacy_requests r where user_id=auth.uid()),'[]'::jsonb)
  );
end $$;

create function public.list_privacy_requests(p_admin boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or (p_admin and not is_platform_admin()) then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(r order by created_at desc) from privacy_requests r where (p_admin or user_id=auth.uid()) and status <> 'cancelled'),'[]'::jsonb);
end $$;

create function public.request_account_deletion() returns uuid language plpgsql security definer set search_path = public as $$
declare request_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,12));
  select id into request_id from privacy_requests where user_id=auth.uid() and status in ('requested','reviewing');
  if request_id is not null then return request_id; end if;
  insert into privacy_requests(user_id) values(auth.uid()) returning id into request_id;
  return request_id;
end $$;

create function public.update_privacy_request(p_id uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
declare request_row privacy_requests;
begin
  select * into request_row from privacy_requests where id=p_id for update;
  if auth.uid() is null or request_row.id is null then raise exception 'Not allowed'; end if;
  if not ((p_status='cancelled' and request_row.user_id=auth.uid()) or (p_status='reviewing' and is_platform_admin())) then raise exception 'Not allowed'; end if;
  if request_row.status not in ('requested','reviewing') then raise exception 'Request is closed'; end if;
  update privacy_requests set status=p_status, updated_at=now() where id=p_id;
end $$;
revoke all on function public.export_my_data(), public.list_privacy_requests(boolean), public.request_account_deletion(), public.update_privacy_request(uuid,text) from public, anon;
grant execute on function public.export_my_data(), public.list_privacy_requests(boolean), public.request_account_deletion(), public.update_privacy_request(uuid,text) to authenticated;
notify pgrst,'reload schema';
