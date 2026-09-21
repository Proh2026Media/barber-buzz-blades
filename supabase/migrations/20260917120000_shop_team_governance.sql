-- Professional access, ownership governance and direct barber booking links.
-- Additive migration: legacy shop_admin memberships keep working while each shop is migrated.

create type public.shop_member_role as enum ('owner', 'partner', 'associate', 'employee');
create type public.shop_change_status as enum ('pending', 'approved', 'rejected', 'cancelled');

alter table public.staff add column user_id uuid references auth.users(id) on delete set null;
alter table public.staff add column booking_slug text;
alter table public.staff add constraint staff_booking_slug_format
  check (booking_slug is null or booking_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
create unique index staff_user_shop_unique on public.staff(barbershop_id,user_id) where user_id is not null;
create unique index staff_booking_slug_unique on public.staff(barbershop_id,booking_slug) where booking_slug is not null;

create table public.shop_members (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  role public.shop_member_role not null,
  ownership_percent numeric(5,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(barbershop_id,user_id),
  unique(barbershop_id,staff_id),
  constraint shop_members_ownership_by_role check (
    (role in ('owner','partner') and ownership_percent > 0 and ownership_percent <= 100)
    or (role in ('associate','employee') and ownership_percent is null)
  )
);
create index shop_members_user_idx on public.shop_members(user_id) where active;
create index shop_members_shop_idx on public.shop_members(barbershop_id) where active;
create trigger shop_members_set_updated_at before update on public.shop_members
  for each row execute function public.set_updated_at();

create table public.staff_services (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  display_name text,
  duration_minutes int not null check(duration_minutes > 0),
  price_cents int not null check(price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(staff_id,service_id)
);
create index staff_services_shop_idx on public.staff_services(barbershop_id,staff_id);
create trigger staff_services_set_updated_at before update on public.staff_services
  for each row execute function public.set_updated_at();

alter table public.appointments add column booked_price_cents int check(booked_price_cents >= 0);
update public.appointments a set booked_price_cents=s.price_cents
from public.services s where s.id=a.service_id and a.booked_price_cents is null;

create table public.shop_change_requests (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  approved_by uuid references auth.users(id) on delete set null,
  kind text not null,
  payload jsonb not null,
  status public.shop_change_status not null default 'pending',
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  applied_at timestamptz
);
create index shop_change_requests_pending_idx
  on public.shop_change_requests(barbershop_id,created_at desc) where status='pending';

create table public.shop_change_approvals (
  request_id uuid not null references public.shop_change_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  approved boolean not null,
  note text,
  decided_at timestamptz not null default now(),
  primary key(request_id,user_id)
);

create or replace function public.current_shop_member(p_shop_id uuid)
returns public.shop_members language sql stable security definer set search_path=public as $$
  select sm from public.shop_members sm
  where sm.barbershop_id=p_shop_id and sm.user_id=auth.uid() and sm.active limit 1
$$;

create or replace function public.current_staff_id(p_shop_id uuid)
returns uuid language sql stable security definer set search_path=public as $$
  select sm.staff_id from public.shop_members sm
  where sm.barbershop_id=p_shop_id and sm.user_id=auth.uid() and sm.active limit 1
$$;

create or replace function public.has_shop_member_role(p_shop_id uuid,p_roles public.shop_member_role[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.shop_members sm where sm.barbershop_id=p_shop_id
    and sm.user_id=auth.uid() and sm.active and sm.role=any(p_roles))
$$;

create or replace function public.can_view_full_shop(p_shop_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or public.has_shop_member_role(p_shop_id,array['owner','partner']::public.shop_member_role[])
    or public.has_shop_role(p_shop_id,array['shop_admin']::public.app_role[])
$$;

create or replace function public.shop_governance_mode(p_shop_id uuid)
returns text language plpgsql stable security definer set search_path=public as $$
declare n int; lo numeric; hi numeric;
begin
  select count(*),min(ownership_percent),max(ownership_percent) into n,lo,hi
  from public.shop_members where barbershop_id=p_shop_id and active and role in ('owner','partner');
  if n <= 1 then return 'single'; end if;
  if lo=hi then return 'equal'; end if;
  return 'majority';
end $$;

create or replace function public.can_apply_protected_change(p_shop_id uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare mode text; mine numeric; highest numeric;
begin
  if public.is_platform_admin() then return true; end if;
  select public.shop_governance_mode(p_shop_id) into mode;
  select ownership_percent into mine from public.shop_members where barbershop_id=p_shop_id
    and user_id=auth.uid() and active and role in ('owner','partner');
  if mine is null then return false; end if;
  if mode='single' then return true; end if;
  if mode='equal' then return false; end if;
  select max(ownership_percent) into highest from public.shop_members
    where barbershop_id=p_shop_id and active and role in ('owner','partner');
  return mine=highest and mine>50;
end $$;

create or replace function public.get_shop_access_context(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor public.shop_members; mode text;
begin
  select * into actor from public.shop_members where barbershop_id=p_shop_id and user_id=auth.uid() and active limit 1;
  if actor.id is null and not public.is_platform_admin() then raise exception 'Not allowed' using errcode='42501'; end if;
  mode:=public.shop_governance_mode(p_shop_id);
  return jsonb_build_object(
    'governance_mode',mode,
    'can_apply_protected_change',public.can_apply_protected_change(p_shop_id),
    'pending_requests',(select count(*) from public.shop_change_requests where barbershop_id=p_shop_id and status='pending')
  );
end $$;

create or replace function public.validate_shop_ownership()
returns trigger language plpgsql set search_path=public as $$
declare target uuid; total numeric; leaders int;
begin
  target:=coalesce(new.barbershop_id,old.barbershop_id);
  select coalesce(sum(ownership_percent),0),count(*) filter(where role='owner') into total,leaders
  from public.shop_members where barbershop_id=target and active and role in ('owner','partner');
  if total<>100 then raise exception 'Active ownership must total 100%% (current: %)',total using errcode='23514'; end if;
  if leaders<>1 then raise exception 'A shop must have exactly one active owner' using errcode='23514'; end if;
  return null;
end $$;
create constraint trigger shop_ownership_total after insert or update or delete on public.shop_members
  deferrable initially deferred for each row execute function public.validate_shop_ownership();

create or replace function public.staff_service_same_shop()
returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from public.staff s where s.id=new.staff_id and s.barbershop_id=new.barbershop_id)
    or not exists(select 1 from public.services s where s.id=new.service_id and s.barbershop_id=new.barbershop_id)
  then raise exception 'Staff and service must belong to the same shop'; end if;
  return new;
end $$;
create trigger staff_services_same_shop before insert or update on public.staff_services
  for each row execute function public.staff_service_same_shop();

-- Visual/free is deliberately narrow and defined in the database. Everything else in settings is protected.
create or replace function public.settings_change_is_visual(old_row public.barbershop_settings,new_row public.barbershop_settings)
returns boolean language sql immutable set search_path=public as $$
  select old_row.barbershop_id=new_row.barbershop_id
    and (to_jsonb(old_row)-array['display_name','logo_url','font_family','custom_font_url','custom_font_name',
      'custom_font_faces','font_scope','header_font_weight','header_font_style','corner_style','primary_color',
      'accent_color','tagline','updated_at'])
      =(to_jsonb(new_row)-array['display_name','logo_url','font_family','custom_font_url','custom_font_name',
      'custom_font_faces','font_scope','header_font_weight','header_font_style','corner_style','primary_color',
      'accent_color','tagline','updated_at'])
$$;

create or replace function public.guard_protected_shop_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare sid uuid; is_visual boolean:=false;
begin
  if current_setting('app.approved_shop_change',true)='on' or public.is_platform_admin() then return coalesce(new,old); end if;
  sid:=coalesce(new.barbershop_id,old.barbershop_id);
  if tg_table_name='barbershop_settings' and tg_op='UPDATE' then
    is_visual:=public.settings_change_is_visual(old,new);
  end if;
  if is_visual and public.has_shop_member_role(sid,array['owner','partner']::public.shop_member_role[]) then return new; end if;
  if public.has_shop_member_role(sid,array['owner','partner']::public.shop_member_role[]) then
    if public.can_apply_protected_change(sid) then return coalesce(new,old); end if;
    if public.shop_governance_mode(sid)='equal' then
      raise exception 'Esta mudança precisa da aprovação do outro sócio' using errcode='42501',hint='Use request_shop_change';
    end if;
    raise exception 'Somente o sócio majoritário pode realizar esta mudança' using errcode='42501';
  end if;
  return coalesce(new,old);
end $$;

create trigger guard_services_change before insert or update or delete on public.services
  for each row execute function public.guard_protected_shop_change();
create trigger guard_staff_change before insert or update or delete on public.staff
  for each row execute function public.guard_protected_shop_change();
create trigger guard_staff_services_change before insert or update or delete on public.staff_services
  for each row execute function public.guard_protected_shop_change();
create trigger guard_business_hours_change before insert or update or delete on public.business_hours
  for each row execute function public.guard_protected_shop_change();
create trigger guard_availability_change before insert or update or delete on public.availability_blocks
  for each row execute function public.guard_protected_shop_change();
create trigger guard_settings_change before update on public.barbershop_settings
  for each row execute function public.guard_protected_shop_change();

create or replace function public.apply_shop_change(p_shop_id uuid,p_kind text,p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare target uuid; row_data jsonb;
begin
  perform set_config('app.approved_shop_change','on',true);
  case p_kind
    when 'service.create' then
      insert into public.services(barbershop_id,name,duration_minutes,price_cents,active)
      values(p_shop_id,p_payload->>'name',(p_payload->>'duration_minutes')::int,(p_payload->>'price_cents')::int,coalesce((p_payload->>'active')::boolean,true));
    when 'service.update' then
      target:=(p_payload->>'id')::uuid;
      update public.services set name=p_payload->>'name',duration_minutes=(p_payload->>'duration_minutes')::int,
        price_cents=(p_payload->>'price_cents')::int,active=coalesce((p_payload->>'active')::boolean,active)
      where id=target and barbershop_id=p_shop_id;
    when 'service.toggle' then
      update public.services set active=(p_payload->>'active')::boolean where id=(p_payload->>'id')::uuid and barbershop_id=p_shop_id;
    when 'service.delete' then
      delete from public.services where id=(p_payload->>'id')::uuid and barbershop_id=p_shop_id;
    when 'staff.create' then
      insert into public.staff(barbershop_id,display_name,active,booking_slug)
      values(p_shop_id,p_payload->>'display_name',coalesce((p_payload->>'active')::boolean,true),nullif(p_payload->>'booking_slug',''));
    when 'staff.update' then
      update public.staff set display_name=p_payload->>'display_name',active=coalesce((p_payload->>'active')::boolean,active),
        booking_slug=coalesce(nullif(p_payload->>'booking_slug',''),booking_slug)
      where id=(p_payload->>'id')::uuid and barbershop_id=p_shop_id;
    when 'staff.toggle' then
      update public.staff set active=(p_payload->>'active')::boolean where id=(p_payload->>'id')::uuid and barbershop_id=p_shop_id;
    when 'staff.delete' then
      delete from public.staff where id=(p_payload->>'id')::uuid and barbershop_id=p_shop_id;
    when 'hours.replace' then
      for row_data in select value from jsonb_array_elements(p_payload->'hours') loop
        insert into public.business_hours(barbershop_id,weekday,is_open,opens_at,closes_at)
        values(p_shop_id,(row_data->>'weekday')::int,(row_data->>'is_open')::boolean,
          (row_data->>'opens_at')::time,(row_data->>'closes_at')::time)
        on conflict(barbershop_id,weekday) do update set is_open=excluded.is_open,opens_at=excluded.opens_at,closes_at=excluded.closes_at;
      end loop;
    when 'availability.create' then
      insert into public.availability_blocks(barbershop_id,staff_id,starts_at,ends_at,reason)
      values(p_shop_id,nullif(p_payload->>'staff_id','')::uuid,(p_payload->>'starts_at')::timestamptz,
        (p_payload->>'ends_at')::timestamptz,nullif(p_payload->>'reason',''));
    when 'availability.delete' then
      delete from public.availability_blocks where id=(p_payload->>'id')::uuid and barbershop_id=p_shop_id;
    when 'settings.operational' then
      update public.barbershop_settings set
        booking_instructions=coalesce(p_payload->>'booking_instructions',booking_instructions),
        booking_horizon_days=coalesce((p_payload->>'booking_horizon_days')::int,booking_horizon_days),
        survey_program_enabled=coalesce((p_payload->>'survey_program_enabled')::boolean,survey_program_enabled),
        waiting_enabled=coalesce((p_payload->>'waiting_enabled')::boolean,waiting_enabled),
        waiting_cutoff_minutes=coalesce((p_payload->>'waiting_cutoff_minutes')::int,waiting_cutoff_minutes)
      where barbershop_id=p_shop_id;
    when 'member.update' then
      update public.shop_members set
        role=(p_payload->>'role')::public.shop_member_role,
        ownership_percent=case
          when (p_payload->>'role') in ('owner','partner') then (p_payload->>'ownership_percent')::numeric
          else null
        end,
        active=coalesce((p_payload->>'active')::boolean,active)
      where id=(p_payload->>'id')::uuid and barbershop_id=p_shop_id;
    else raise exception 'Unsupported change kind: %',p_kind using errcode='22023';
  end case;
end $$;

create or replace function public.request_shop_change(p_shop_id uuid,p_kind text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare request_id uuid; mode text;
begin
  if not public.has_shop_member_role(p_shop_id,array['owner','partner']::public.shop_member_role[])
    and not public.is_platform_admin() then raise exception 'Not allowed' using errcode='42501'; end if;
  mode:=public.shop_governance_mode(p_shop_id);
  if public.can_apply_protected_change(p_shop_id) then
    perform public.apply_shop_change(p_shop_id,p_kind,p_payload);
    return jsonb_build_object('status','applied');
  end if;
  if mode<>'equal' then raise exception 'Somente o sócio majoritário pode realizar esta mudança' using errcode='42501'; end if;
  insert into public.shop_change_requests(barbershop_id,requested_by,kind,payload)
  values(p_shop_id,auth.uid(),p_kind,p_payload) returning id into request_id;
  return jsonb_build_object('status','pending','request_id',request_id);
end $$;

create or replace function public.decide_shop_change(p_request_id uuid,p_approve boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare req public.shop_change_requests; remaining int; result_status text;
begin
  select * into req from public.shop_change_requests where id=p_request_id for update;
  if req.id is null or req.status<>'pending' then raise exception 'Pending request not found'; end if;
  if req.requested_by=auth.uid() then raise exception 'O solicitante não pode aprovar o próprio pedido' using errcode='42501'; end if;
  if not public.has_shop_member_role(req.barbershop_id,array['owner','partner']::public.shop_member_role[])
    then raise exception 'Not allowed' using errcode='42501'; end if;
  if public.shop_governance_mode(req.barbershop_id)<>'equal' then raise exception 'A sociedade não é mais igualitária'; end if;
  insert into public.shop_change_approvals(request_id,user_id,approved,note)
  values(req.id,auth.uid(),p_approve,nullif(trim(p_note),''))
  on conflict(request_id,user_id) do update set approved=excluded.approved,note=excluded.note,decided_at=now();
  if not p_approve then
    update public.shop_change_requests set status='rejected',approved_by=auth.uid(),
      decision_note=nullif(trim(p_note),''),decided_at=now() where id=req.id;
    return jsonb_build_object('status','rejected');
  end if;
  select count(*) into remaining from public.shop_members sm
  where sm.barbershop_id=req.barbershop_id and sm.active and sm.role in ('owner','partner')
    and sm.user_id<>req.requested_by
    and not exists(select 1 from public.shop_change_approvals a
      where a.request_id=req.id and a.user_id=sm.user_id and a.approved);
  if remaining>0 then
    return jsonb_build_object('status','pending','remaining_approvals',remaining);
  end if;
  perform public.apply_shop_change(req.barbershop_id,req.kind,req.payload);
  result_status:='approved';
  update public.shop_change_requests set status='approved',approved_by=auth.uid(),
    decision_note=nullif(trim(p_note),''),decided_at=now(),applied_at=now() where id=req.id;
  return jsonb_build_object('status',result_status,'remaining_approvals',0);
end $$;

create or replace function public.cancel_shop_change(p_request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.shop_change_requests set status='cancelled',decided_at=now()
  where id=p_request_id and requested_by=auth.uid() and status='pending';
  if not found then raise exception 'Pending request not found' using errcode='P0002'; end if;
end $$;

create or replace function public.get_team_schedule(p_shop_id uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid; full_access boolean;
begin
  if auth.uid() is null or not(public.is_platform_admin() or public.has_shop_member_role(p_shop_id,
    array['owner','partner','associate','employee']::public.shop_member_role[])
    or public.has_shop_role(p_shop_id,array['shop_admin']::public.app_role[])) then raise exception 'Not allowed'; end if;
  mine:=public.current_staff_id(p_shop_id); full_access:=public.can_view_full_shop(p_shop_id);
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',a.id,'staff_id',a.staff_id,'staff_name',st.display_name,'starts_at',a.starts_at,'ends_at',a.ends_at,'status',a.status,
    'is_own',a.staff_id=mine,'customer_name',case when full_access or a.staff_id=mine then p.full_name else null end,
    'service_name',case when full_access or a.staff_id=mine then s.name else null end,
    'price_cents',case when full_access or a.staff_id=mine then coalesce(a.booked_price_cents,s.price_cents) else null end,
    'visibility',case when full_access or a.staff_id=mine then 'full' else 'busy' end
  ) order by a.starts_at) from public.appointments a join public.staff st on st.id=a.staff_id
    join public.services s on s.id=a.service_id join public.profiles p on p.id=a.customer_id
    where a.barbershop_id=p_shop_id and a.starts_at>=p_from and a.starts_at<p_to and a.status<>'cancelled'),'[]'::jsonb);
end $$;

create or replace function public.get_professional_insights(p_shop_id uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid; member_role public.shop_member_role; full_access boolean; own_only boolean;
begin
  if p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid period' using errcode='22023'; end if;
  select sm.staff_id,sm.role into mine,member_role from public.shop_members sm
  where sm.barbershop_id=p_shop_id and sm.user_id=auth.uid() and sm.active limit 1;
  full_access:=public.is_platform_admin() or public.can_view_full_shop(p_shop_id);
  if not full_access and mine is null then raise exception 'Not allowed' using errcode='42501'; end if;
  own_only:=not full_access;
  return jsonb_build_object(
    'scope',case when full_access then 'shop' when member_role='associate' then 'own_with_global' else 'own_score' end,
    'own',coalesce((select jsonb_build_object(
      'bookings',count(*),'completed',count(*) filter(where status='completed'),
      'cancelled',count(*) filter(where status='cancelled'),
      'customers',count(distinct customer_id),
      'quoted_cents',case when member_role='employee' then null else coalesce(sum(booked_price_cents) filter(where status='completed'),0) end
    ) from public.appointments where barbershop_id=p_shop_id and starts_at>=p_from and starts_at<p_to
      and (not own_only or staff_id=mine)),'{}'::jsonb),
    'global',case when member_role='associate' then coalesce((select jsonb_build_object(
      'bookings',count(*),'completed',count(*) filter(where status='completed'),
      'cancelled',count(*) filter(where status='cancelled'),
      'no_show_rate',round(100.0*count(*) filter(where f.no_show_at is not null)/nullif(count(*),0),1)
    ) from public.appointments a left join public.appointment_facts f on f.appointment_id=a.id
      where a.barbershop_id=p_shop_id and a.starts_at>=p_from and a.starts_at<p_to
      having count(*)>=5),'{}'::jsonb) else null end
  );
end $$;

create or replace function public.resolve_direct_booking_staff(p_shop_slug text,p_staff_slug text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  select jsonb_build_object('shop_id',b.id,'shop_name',b.name,'staff_id',s.id,'staff_name',s.display_name)
  into result from public.barbershops b join public.staff s on s.barbershop_id=b.id
  where b.slug=p_shop_slug and b.status='active' and s.booking_slug=p_staff_slug and s.active;
  if result is null then raise exception 'Link de profissional inválido ou indisponível' using errcode='P0002'; end if;
  return result;
end $$;

create or replace function public.create_direct_appointment(
  p_shop_slug text,p_staff_slug text,p_service_id uuid,p_starts_at timestamptz,p_ends_at timestamptz
) returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid; staffid uuid; result uuid; price int;
begin
  select b.id,s.id into sid,staffid from public.barbershops b join public.staff s on s.barbershop_id=b.id
  where b.slug=p_shop_slug and b.status='active' and s.booking_slug=p_staff_slug and s.active;
  if sid is null then raise exception 'Link de profissional inválido ou indisponível' using errcode='P0002'; end if;
  if not public.has_shop_role(sid,array['customer','shop_admin']::public.app_role[]) then
    raise exception 'Cliente não vinculado a esta barbearia' using errcode='42501';
  end if;
  select coalesce(ss.price_cents,sv.price_cents) into price from public.services sv
  left join public.staff_services ss on ss.service_id=sv.id and ss.staff_id=staffid and ss.active
  where sv.id=p_service_id and sv.barbershop_id=sid and sv.active;
  if price is null then raise exception 'Serviço indisponível para este profissional' using errcode='22023'; end if;
  insert into public.appointments(barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at,status,booked_price_cents)
  values(sid,auth.uid(),p_service_id,staffid,p_starts_at,p_ends_at,'pending',price) returning id into result;
  return result;
end $$;

alter table public.shop_members enable row level security;
alter table public.staff_services enable row level security;
alter table public.shop_change_requests enable row level security;
alter table public.shop_change_approvals enable row level security;

create policy "Members read own or managed team" on public.shop_members for select to authenticated using(
  user_id=auth.uid() or public.is_platform_admin() or public.can_view_full_shop(barbershop_id));
create policy "Owners manage team" on public.shop_members for all to authenticated using(
  public.is_platform_admin() or (public.can_apply_protected_change(barbershop_id) and public.has_shop_member_role(barbershop_id,array['owner']::public.shop_member_role[])))
with check(public.is_platform_admin() or (public.can_apply_protected_change(barbershop_id) and public.has_shop_member_role(barbershop_id,array['owner']::public.shop_member_role[])));

create policy "Read professional services" on public.staff_services for select to authenticated using(
  public.is_platform_admin() or public.current_staff_id(barbershop_id)=staff_id or public.can_view_full_shop(barbershop_id)
  or public.has_shop_role(barbershop_id,array['customer']::public.app_role[]));
create policy "Manage professional services" on public.staff_services for all to authenticated using(
  public.is_platform_admin() or (public.current_staff_id(barbershop_id)=staff_id and public.has_shop_member_role(barbershop_id,array['associate']::public.shop_member_role[]))
  or public.can_apply_protected_change(barbershop_id))
with check(public.is_platform_admin() or (public.current_staff_id(barbershop_id)=staff_id and public.has_shop_member_role(barbershop_id,array['associate']::public.shop_member_role[]))
  or public.can_apply_protected_change(barbershop_id));

create policy "Partners read governance requests" on public.shop_change_requests for select to authenticated using(
  public.is_platform_admin() or public.has_shop_member_role(barbershop_id,array['owner','partner']::public.shop_member_role[]));
create policy "Partners read governance approvals" on public.shop_change_approvals for select to authenticated using(
  public.is_platform_admin() or exists(select 1 from public.shop_change_requests r where r.id=request_id
    and public.has_shop_member_role(r.barbershop_id,array['owner','partner']::public.shop_member_role[])));

create policy "Professional members read hours" on public.business_hours for select to authenticated using(
  public.has_shop_member_role(barbershop_id,array['owner','partner','associate','employee']::public.shop_member_role[]));
create policy "Professional members read blocks" on public.availability_blocks for select to authenticated using(
  public.has_shop_member_role(barbershop_id,array['owner','partner','associate','employee']::public.shop_member_role[]));
create policy "Professionals manage own blocks" on public.availability_blocks for all to authenticated using(
  staff_id=public.current_staff_id(barbershop_id)
  and public.has_shop_member_role(barbershop_id,array['associate']::public.shop_member_role[]))
with check(staff_id=public.current_staff_id(barbershop_id)
  and public.has_shop_member_role(barbershop_id,array['associate']::public.shop_member_role[]));

create policy "Professional members read shop" on public.barbershops for select to authenticated using(
  public.has_shop_member_role(id,array['owner','partner','associate','employee']::public.shop_member_role[]));
create policy "Professional members read staff" on public.staff for select to authenticated using(
  public.has_shop_member_role(barbershop_id,array['owner','partner','associate','employee']::public.shop_member_role[]));
create policy "Professional members read services" on public.services for select to authenticated using(
  public.has_shop_member_role(barbershop_id,array['owner','partner','associate','employee']::public.shop_member_role[]));
create policy "Owners partners manage staff" on public.staff for all to authenticated using(
  public.can_apply_protected_change(barbershop_id)) with check(public.can_apply_protected_change(barbershop_id));
create policy "Professionals read own appointments" on public.appointments for select to authenticated using(
  public.can_view_full_shop(barbershop_id) or staff_id=public.current_staff_id(barbershop_id));
create policy "Professionals operate own appointments" on public.appointments for update to authenticated using(
  public.can_view_full_shop(barbershop_id) or staff_id=public.current_staff_id(barbershop_id))
with check(public.can_view_full_shop(barbershop_id) or staff_id=public.current_staff_id(barbershop_id));

create or replace function public.guard_scoped_professional_appointment_update()
returns trigger language plpgsql set search_path=public as $$
begin
  if public.current_staff_id(old.barbershop_id)=old.staff_id and not public.can_view_full_shop(old.barbershop_id) then
    if new.barbershop_id is distinct from old.barbershop_id or new.customer_id is distinct from old.customer_id
      or new.service_id is distinct from old.service_id or new.staff_id is distinct from old.staff_id
      or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
      or new.booked_price_cents is distinct from old.booked_price_cents then
      raise exception 'O profissional só pode alterar o estado do próprio atendimento' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
create trigger guard_scoped_professional_appointment_update_trg before update on public.appointments
  for each row execute function public.guard_scoped_professional_appointment_update();
create policy "Professional members read settings" on public.barbershop_settings for select to authenticated using(
  public.has_shop_member_role(barbershop_id,array['owner','partner','associate','employee']::public.shop_member_role[]));
create policy "Owners partners update settings" on public.barbershop_settings for update to authenticated using(
  public.has_shop_member_role(barbershop_id,array['owner','partner']::public.shop_member_role[]))
with check(public.has_shop_member_role(barbershop_id,array['owner','partner']::public.shop_member_role[]));

-- Legacy bootstrap: one oldest shop_admin becomes 100% owner when a staff account can be linked safely.
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select x.barbershop_id,x.user_id,x.staff_id,'owner',100 from (
  select m.barbershop_id,m.user_id,s.id staff_id,row_number() over(partition by m.barbershop_id order by m.created_at,m.id) rn
  from public.memberships m join lateral(
    select st.id from public.staff st where st.barbershop_id=m.barbershop_id and st.user_id is null order by st.created_at limit 1
  ) s on true where m.role='shop_admin' and m.barbershop_id is not null
) x where x.rn=1 on conflict do nothing;
update public.staff st set user_id=sm.user_id from public.shop_members sm where sm.staff_id=st.id and st.user_id is null;

insert into public.staff_services(barbershop_id,staff_id,service_id,display_name,duration_minutes,price_cents,active)
select st.barbershop_id,st.id,sv.id,sv.name,sv.duration_minutes,sv.price_cents,sv.active
from public.staff st join public.services sv on sv.barbershop_id=st.barbershop_id
on conflict(staff_id,service_id) do nothing;

revoke all on function public.apply_shop_change(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.request_shop_change(uuid,text,jsonb),public.decide_shop_change(uuid,boolean,text),
  public.cancel_shop_change(uuid),public.get_team_schedule(uuid,timestamptz,timestamptz),
  public.get_professional_insights(uuid,timestamptz,timestamptz),
  public.get_shop_access_context(uuid),
  public.resolve_direct_booking_staff(text,text),public.create_direct_appointment(text,text,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.request_shop_change(uuid,text,jsonb),public.decide_shop_change(uuid,boolean,text),
  public.cancel_shop_change(uuid),public.get_team_schedule(uuid,timestamptz,timestamptz),
  public.get_professional_insights(uuid,timestamptz,timestamptz),
  public.get_shop_access_context(uuid),
  public.resolve_direct_booking_staff(text,text),public.create_direct_appointment(text,text,uuid,timestamptz,timestamptz) to authenticated;

notify pgrst,'reload schema';
