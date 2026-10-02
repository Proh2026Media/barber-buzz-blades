-- Regras de agendamento com uma fonte só (02/10/2026).
--
-- Quem faz o quê:
--   * A loja "usa serviços por profissional" quando existe ao menos uma linha em staff_services.
--     Nesse caso só faz o serviço quem tem a linha ativa (com duração e preço dela).
--     Loja sem nenhuma linha em staff_services: todo profissional ativo faz todos os serviços
--     ativos, com a duração e o preço do catálogo (não quebra lojas que nunca configuraram).
--   * Horários livres: candidatos de 15 em 15 minutos a partir da abertura, só os que cabem o
--     serviço inteiro antes do fechamento e sem encostar em atendimento, bloqueio ou reserva da
--     espera. Calculados por available_slots_internal, usada pelo app, pela escolha de
--     "qualquer profissional" e pela página pública.
--   * Cliente (quem não é dono/sócio/gerente/admin): o banco recalcula o término e o preço.
--     O painel continua livre para ajustar duração e preço.

create or replace function public.shop_tz(p_shop_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select n.name from public.barbershops b join pg_timezone_names n on n.name = b.timezone
     where b.id = p_shop_id limit 1),
    'America/Sao_Paulo')
$$;

create or replace function public.shop_uses_staff_services(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff_services ss where ss.barbershop_id = p_shop_id)
$$;

-- Duração e preço que valem para o profissional neste serviço; nenhuma linha = não faz.
create or replace function public.staff_service_terms(p_staff_id uuid, p_service_id uuid)
returns table (duration_minutes integer, price_cents integer)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(ss.duration_minutes, sv.duration_minutes), coalesce(ss.price_cents, sv.price_cents)
  from public.staff st
  join public.services sv on sv.id = p_service_id and sv.barbershop_id = st.barbershop_id and sv.active
  left join public.staff_services ss on ss.staff_id = st.id and ss.service_id = sv.id and ss.active
  where st.id = p_staff_id and st.active
    and (ss.id is not null or not public.shop_uses_staff_services(st.barbershop_id))
$$;

create or replace function public.staff_busy_internal(p_staff_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.starts_at, a.ends_at
  from public.appointments a
  where a.staff_id = p_staff_id and a.status in ('pending', 'confirmed', 'completed')
    and a.starts_at < p_to and a.ends_at > p_from
  union all
  select b.starts_at, b.ends_at
  from public.availability_blocks b
  join public.staff s on s.id = p_staff_id
  where b.barbershop_id = s.barbershop_id and (b.staff_id is null or b.staff_id = p_staff_id)
    and b.starts_at < p_to and b.ends_at > p_from
  union all
  select w.starts_at, w.ends_at
  from public.slot_waits w
  where w.staff_id = p_staff_id and w.state in ('holding', 'exclusive')
    and (w.hold_until > clock_timestamp() or (w.customer_id is not null and w.claim_until > clock_timestamp()))
    and w.starts_at < p_to and w.ends_at > p_from
$$;

-- Fonte única dos horários livres de um profissional, num serviço, num dia da loja.
create or replace function public.available_slots_internal(p_staff_id uuid, p_service_id uuid, p_date date)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  shop_id uuid;
  tz text;
  dur integer;
  horizon integer;
  local_today date;
  win record;
  day_start timestamptz;
  day_end timestamptz;
begin
  select s.barbershop_id into shop_id
  from public.staff s join public.barbershops b on b.id = s.barbershop_id
  where s.id = p_staff_id and s.active and b.status = 'active';
  if shop_id is null or p_date is null then return; end if;

  select t.duration_minutes into dur from public.staff_service_terms(p_staff_id, p_service_id) t;
  if dur is null or dur <= 0 then return; end if;

  tz := public.shop_tz(shop_id);
  local_today := (clock_timestamp() at time zone tz)::date;
  select coalesce(st.booking_horizon_days, 14) into horizon
  from public.barbershop_settings st where st.barbershop_id = shop_id;
  if p_date < local_today or p_date > local_today + greatest(coalesce(horizon, 14), 1) - 1 then
    return;
  end if;

  select h.is_open, h.opens_at, h.closes_at into win
  from public.business_hours h
  where h.barbershop_id = shop_id and h.weekday = extract(dow from p_date)::smallint;
  if not coalesce(win.is_open, false) or win.closes_at <= win.opens_at then return; end if;

  day_start := (p_date + win.opens_at) at time zone tz;
  day_end := (p_date + win.closes_at) at time zone tz;

  return query
  with busy as materialized (
    select b.starts_at, b.ends_at from public.staff_busy_internal(p_staff_id, day_start, day_end) b
  )
  select g, g + make_interval(mins => dur)
  from generate_series(day_start, day_end - make_interval(mins => dur), interval '15 minutes') g
  where g > clock_timestamp()
    and not exists (
      select 1 from busy where busy.starts_at < g + make_interval(mins => dur) and busy.ends_at > g)
  order by g;
end;
$$;

revoke all on function public.shop_tz(uuid) from public, anon, authenticated;
revoke all on function public.shop_uses_staff_services(uuid) from public, anon, authenticated;
revoke all on function public.staff_service_terms(uuid, uuid) from public, anon, authenticated;
revoke all on function public.staff_busy_internal(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.available_slots_internal(uuid, uuid, date) from public, anon, authenticated;

-- App do cliente: horários livres (p_staff_id nulo = todos os profissionais que fazem o serviço).
create or replace function public.get_available_slots(
  p_shop_id uuid, p_service_id uuid, p_date date, p_staff_id uuid default null
)
returns table (staff_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null or not (
    public.is_platform_admin()
    or public.has_shop_role(p_shop_id, array['customer', 'shop_admin']::public.app_role[])
  ) then
    raise exception 'Not authorized to view availability' using errcode = '42501';
  end if;
  perform public.process_slot_waits();
  return query
  select s.id, x.starts_at, x.ends_at
  from public.staff s
  cross join lateral public.available_slots_internal(s.id, p_service_id, p_date) x
  where s.barbershop_id = p_shop_id and s.active and (p_staff_id is null or s.id = p_staff_id)
  order by x.starts_at, s.id;
end;
$$;

-- App do cliente: quem faz cada serviço, com duração e preço próprios.
create or replace function public.get_booking_terms(p_shop_id uuid)
returns table (staff_id uuid, service_id uuid, duration_minutes integer, price_cents integer)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null or not (
    public.is_platform_admin()
    or public.has_shop_role(p_shop_id, array['customer', 'shop_admin']::public.app_role[])
    or public.can_view_full_shop(p_shop_id)
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select st.id, sv.id, t.duration_minutes, t.price_cents
  from public.staff st
  join public.services sv on sv.barbershop_id = st.barbershop_id and sv.active
  cross join lateral public.staff_service_terms(st.id, sv.id) t
  where st.barbershop_id = p_shop_id and st.active;
end;
$$;

revoke all on function public.get_available_slots(uuid, uuid, date, uuid) from public, anon;
grant execute on function public.get_available_slots(uuid, uuid, date, uuid) to authenticated;
revoke all on function public.get_booking_terms(uuid) from public, anon;
grant execute on function public.get_booking_terms(uuid) to authenticated;

-- "Qualquer profissional": mesma regra dos horários, inclusive para o favorito.
create or replace function public.pick_available_staff(
  p_shop_id uuid, p_service_id uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_prefer_staff_id uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  local_day date;
  chosen uuid;
begin
  if auth.uid() is null or not (
    public.is_platform_admin()
    or public.has_shop_role(p_shop_id, array['customer', 'shop_admin']::public.app_role[])
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  local_day := (p_starts_at at time zone public.shop_tz(p_shop_id))::date;

  if p_prefer_staff_id is not null
     and exists (select 1 from public.staff s where s.id = p_prefer_staff_id and s.barbershop_id = p_shop_id)
     and exists (
       select 1 from public.available_slots_internal(p_prefer_staff_id, p_service_id, local_day) x
       where x.starts_at = p_starts_at)
  then
    return p_prefer_staff_id;
  end if;

  select s.id into chosen
  from public.staff s
  where s.barbershop_id = p_shop_id and s.active
    and exists (
      select 1 from public.available_slots_internal(s.id, p_service_id, local_day) x
      where x.starts_at = p_starts_at)
  order by random()
  limit 1;
  return chosen;
end;
$$;

revoke all on function public.pick_available_staff(uuid, uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.pick_available_staff(uuid, uuid, timestamptz, timestamptz, uuid) to authenticated;

-- Gatilho: para cliente, término e preço saem da regra do profissional; não aceita
-- profissional que não faz o serviço nem dia além do prazo de agendamento da loja.
-- Nome escolhido para rodar antes de appointments_validate_booking_trg e appointments_waiting_guard
-- (gatilhos BEFORE rodam em ordem alfabética), que conferem o término já recalculado.
create or replace function public.appointments_enforce_service_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  terms record;
  tz text;
  horizon integer;
begin
  if auth.uid() is null or public.can_view_full_shop(new.barbershop_id) then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.service_id is not distinct from old.service_id
     and new.staff_id is not distinct from old.staff_id
     and new.starts_at is not distinct from old.starts_at
     and new.ends_at is not distinct from old.ends_at then
    new.booked_price_cents := old.booked_price_cents;
    return new;
  end if;

  select t.duration_minutes, t.price_cents into terms
  from public.staff_service_terms(new.staff_id, new.service_id) t;
  if terms.duration_minutes is null then
    raise exception 'Este profissional não faz o serviço escolhido.' using errcode = '22023';
  end if;

  new.ends_at := new.starts_at + make_interval(mins => terms.duration_minutes);
  if tg_op = 'INSERT' or new.service_id is distinct from old.service_id
     or new.staff_id is distinct from old.staff_id then
    new.booked_price_cents := terms.price_cents;
  else
    new.booked_price_cents := old.booked_price_cents;
  end if;

  -- Ocorrências de recorrência são geradas à frente de propósito.
  if new.series_id is null then
    tz := public.shop_tz(new.barbershop_id);
    select coalesce(s.booking_horizon_days, 14) into horizon
    from public.barbershop_settings s where s.barbershop_id = new.barbershop_id;
    if (new.starts_at at time zone tz)::date
       > (clock_timestamp() at time zone tz)::date + greatest(coalesce(horizon, 14), 1) - 1 then
      raise exception 'Esse dia ainda não está aberto para agendamento.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_enforce_terms_trg on public.appointments;
create trigger appointments_enforce_terms_trg
before insert or update on public.appointments
for each row execute function public.appointments_enforce_service_terms();

-- Remarcação pelo cliente: término e preço pela regra do profissional (p_ends_at é ignorado).
create or replace function public.reschedule_own_appointment(
  p_appointment_id uuid, p_service_id uuid, p_staff_id uuid,
  p_starts_at timestamptz, p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_appointment public.appointments%rowtype;
  terms record;
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
    where s.id = p_service_id and s.barbershop_id = current_appointment.barbershop_id and s.active
  ) or not exists (
    select 1 from public.staff s
    where s.id = p_staff_id and s.barbershop_id = current_appointment.barbershop_id and s.active
  ) then
    raise exception 'Service or staff is unavailable' using errcode = '22023';
  end if;

  select t.duration_minutes, t.price_cents into terms
  from public.staff_service_terms(p_staff_id, p_service_id) t;
  if terms.duration_minutes is null then
    raise exception 'Este profissional não faz o serviço escolhido.' using errcode = '22023';
  end if;

  update public.appointments
  set service_id = p_service_id,
      staff_id = p_staff_id,
      starts_at = p_starts_at,
      ends_at = p_starts_at + make_interval(mins => terms.duration_minutes),
      booked_price_cents = case
        when p_service_id is distinct from current_appointment.service_id
          or p_staff_id is distinct from current_appointment.staff_id
        then terms.price_cents else current_appointment.booked_price_cents end,
      status = 'confirmed'
  where id = p_appointment_id;

  return p_appointment_id;
end;
$$;

-- Link direto do profissional: mesma regra (p_ends_at é ignorado).
create or replace function public.create_direct_appointment(
  p_shop_slug text, p_staff_slug text, p_service_id uuid,
  p_starts_at timestamptz, p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved jsonb;
  sid uuid;
  staffid uuid;
  result uuid;
  terms record;
begin
  resolved := public.resolve_direct_booking_staff(p_shop_slug, p_staff_slug);
  sid := (resolved->>'shop_id')::uuid;
  staffid := (resolved->>'staff_id')::uuid;
  if not public.has_shop_role(sid, array['customer', 'shop_admin']::public.app_role[]) then
    raise exception 'Cliente não vinculado a esta barbearia' using errcode = '42501';
  end if;
  select t.duration_minutes, t.price_cents into terms
  from public.staff_service_terms(staffid, p_service_id) t
  where exists (select 1 from public.services sv where sv.id = p_service_id and sv.barbershop_id = sid);
  if terms.duration_minutes is null then
    raise exception 'Serviço indisponível para este profissional' using errcode = '22023';
  end if;
  insert into public.appointments (
    barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status, booked_price_cents
  )
  values (sid, auth.uid(), p_service_id, staffid, p_starts_at,
          p_starts_at + make_interval(mins => terms.duration_minutes), 'pending', terms.price_cents)
  returning id into result;
  return result;
end;
$$;

-- Recorrência: duração e preço do profissional.
create or replace function public.create_booking_series(
  p_shop_id uuid, p_service_id uuid, p_staff_id uuid, p_starts_at timestamptz,
  p_kind text, p_interval_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  svc public.services%rowtype;
  st public.staff%rowtype;
  terms record;
  shop_tz text;
  local_time time;
  weekday smallint;
  series_id uuid;
  ends_at timestamptz;
  first_id uuid;
  created int;
  kind public.booking_series_kind;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not public.has_shop_role(p_shop_id, array['customer', 'shop_admin']::public.app_role[])
     and not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_kind = 'weekday' then
    kind := 'weekday';
  elsif p_kind = 'interval_days' and p_interval_days in (7, 15, 21) then
    kind := 'interval_days';
  else
    raise exception 'Tipo de recorrência inválido' using errcode = '22023';
  end if;

  select * into svc from public.services where id = p_service_id and barbershop_id = p_shop_id and active;
  select * into st from public.staff where id = p_staff_id and barbershop_id = p_shop_id and active;
  if svc.id is null or st.id is null then
    raise exception 'Serviço ou profissional inválido' using errcode = '22023';
  end if;
  select t.duration_minutes, t.price_cents into terms
  from public.staff_service_terms(p_staff_id, p_service_id) t;
  if terms.duration_minutes is null then
    raise exception 'Este profissional não faz o serviço escolhido.' using errcode = '22023';
  end if;

  shop_tz := public.shop_tz(p_shop_id);
  local_time := (p_starts_at at time zone shop_tz)::time;
  weekday := extract(dow from (p_starts_at at time zone shop_tz))::smallint;
  ends_at := p_starts_at + make_interval(mins => terms.duration_minutes);

  insert into public.booking_series (
    barbershop_id, customer_id, service_id, staff_id,
    kind, weekday, interval_days, local_time, anchor_starts_at, created_by
  ) values (
    p_shop_id, auth.uid(), p_service_id, p_staff_id,
    kind,
    case when kind = 'weekday' then weekday else null end,
    case when kind = 'interval_days' then p_interval_days else null end,
    local_time, p_starts_at, 'customer'
  )
  returning id into series_id;

  -- Primeira ocorrência (pode falhar por sobreposição: aborta a série).
  begin
    insert into public.appointments (
      barbershop_id, customer_id, service_id, staff_id,
      starts_at, ends_at, status, booked_price_cents, series_id
    ) values (
      p_shop_id, auth.uid(), p_service_id, p_staff_id,
      p_starts_at, ends_at, 'confirmed', terms.price_cents, series_id
    )
    returning id into first_id;
  exception when others then
    delete from public.booking_series where id = series_id;
    raise;
  end;

  created := public.materialize_booking_series(series_id);

  return jsonb_build_object(
    'series_id', series_id,
    'first_appointment_id', first_id,
    'materialized', created
  );
end;
$$;

-- Recorrência: duração/preço do profissional e espera vencida deixa de contar como ocupada.
create or replace function public.materialize_booking_series(p_series_id uuid, p_until timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  series public.booking_series%rowtype;
  horizon int;
  until_at timestamptz;
  candidate timestamptz;
  terms record;
  ends_at timestamptz;
  local_date date;
  shop_tz text;
  created int := 0;
  busy boolean;
begin
  select * into series from public.booking_series where id = p_series_id and active;
  if series.id is null then return 0; end if;

  select coalesce(booking_horizon_days, 14) into horizon
  from public.barbershop_settings where barbershop_id = series.barbershop_id;
  horizon := greatest(7, least(coalesce(horizon, 14), 30));

  shop_tz := public.shop_tz(series.barbershop_id);
  until_at := coalesce(p_until, now() + make_interval(days => horizon));

  select t.duration_minutes, t.price_cents into terms
  from public.staff_service_terms(series.staff_id, series.service_id) t;

  for candidate in
    select * from public.series_candidate_starts(series, now(), until_at)
  loop
    local_date := (candidate at time zone shop_tz)::date;
    if exists (
      select 1 from public.booking_series_exceptions e
      where e.series_id = series.id and e.scheduled_date = local_date
    ) then
      continue;
    end if;
    if exists (
      select 1 from public.appointments a
      where a.series_id = series.id
        and a.starts_at = candidate
        and a.status in ('pending', 'confirmed', 'completed', 'reschedule_requested')
    ) then
      continue;
    end if;

    if terms.duration_minutes is null then
      insert into public.booking_series_exceptions (series_id, scheduled_date, reason)
      values (series.id, local_date, 'skipped_busy')
      on conflict (series_id, scheduled_date) do nothing;
      continue;
    end if;

    ends_at := candidate + make_interval(mins => terms.duration_minutes);
    select exists (
      select 1 from public.staff_busy_internal(series.staff_id, candidate, ends_at)
    ) into busy;

    if busy then
      insert into public.booking_series_exceptions (series_id, scheduled_date, reason)
      values (series.id, local_date, 'skipped_busy')
      on conflict (series_id, scheduled_date) do nothing;
      continue;
    end if;

    begin
      insert into public.appointments (
        barbershop_id, customer_id, service_id, staff_id,
        starts_at, ends_at, status, booked_price_cents, series_id
      ) values (
        series.barbershop_id, series.customer_id, series.service_id, series.staff_id,
        candidate, ends_at, 'confirmed', terms.price_cents, series.id
      );
      created := created + 1;
    exception when exclusion_violation or unique_violation or others then
      insert into public.booking_series_exceptions (series_id, scheduled_date, reason)
      values (series.id, local_date, 'skipped_busy')
      on conflict (series_id, scheduled_date) do nothing;
    end;
  end loop;

  return created;
end;
$$;

-- Espera: o serviço precisa caber no intervalo com a duração do profissional.
create or replace function public.waiting_action(p_id uuid, p_action text, p_service_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare w slot_waits; s services; a appointments; result uuid; t timestamptz; dur integer;
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
  select x.duration_minutes into dur from staff_service_terms(w.staff_id, s.id) x;
  if s.id is null or dur is null or dur*interval '1 minute'>w.ends_at-w.starts_at
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
  select x.duration_minutes into dur from staff_service_terms(w.staff_id, s.id) x;
  if s.id is null or dur is null or dur*interval '1 minute'>w.ends_at-w.starts_at
   or not exists(select 1 from staff where id=w.staff_id and active) then raise exception 'Serviço ou profissional indisponível.'; end if;
  update slot_waits set state='claimed' where id=w.id;
  insert into appointments(barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at,status)
  values(w.barbershop_id,auth.uid(),s.id,w.staff_id,w.starts_at,w.starts_at+dur*interval '1 minute','confirmed') returning id into result;
  update slot_waits set claimed_appointment_id=result where id=w.id;
  perform emit_waiting_event(w,'claimed');
 else raise exception 'Invalid action'; end if;
 return result;
end $$;

-- Página pública: mesma regra do app. Cada profissional mostra os horários do serviço mais
-- curto que ele faz ("a partir de X min"); quem não faz nenhum serviço não mostra horários.
create or replace function public.get_public_shop_landing(p_shop_ref text default null, p_host text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  sid uuid;
  shop record;
  cfg jsonb;
  tz text;
  now_ts timestamptz := now();
  today date;
  win record;
  staff_json jsonb := '[]'::jsonb;
  services_json jsonb := '[]'::jsonb;
  hours_json jsonb;
  st record;
  shortest record;
  free_slots text[];
begin
  if nullif(btrim(coalesce(p_host, '')), '') is not null then
    sid := (public.resolve_shop_by_host(p_host) ->> 'shop_id')::uuid;
  elsif nullif(btrim(coalesce(p_shop_ref, '')), '') is not null then
    if p_shop_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      sid := p_shop_ref::uuid;
    else
      sid := public.resolve_shop_by_slug(p_shop_ref);
    end if;
  end if;
  if sid is null then return null; end if;

  select b.id, b.name, b.slug, b.timezone,
    s.display_name, s.tagline, s.logo_url, s.logo_background_color, s.font_family,
    s.custom_font_url, s.header_font_weight, s.header_font_style, s.corner_style,
    s.primary_color, s.accent_color, s.login_image_url, s.booking_instructions,
    coalesce(s.landing, '{}'::jsonb) as landing
  into shop
  from public.barbershops b
  left join public.barbershop_settings s on s.barbershop_id = b.id
  where b.id = sid and b.status = 'active';
  if shop.id is null then return null; end if;

  cfg := jsonb_build_object(
    'enabled', true, 'headline', '', 'about', '', 'address', '', 'instagram', '', 'whatsapp', '',
    'show_staff', true, 'show_services', true, 'show_today', true, 'show_hours', true
  ) || shop.landing;

  tz := public.shop_tz(sid);
  today := (now_ts at time zone tz)::date;

  select coalesce(jsonb_agg(jsonb_build_object(
      'weekday', h.weekday, 'is_open', h.is_open,
      'opens_at', to_char(h.opens_at, 'HH24:MI'), 'closes_at', to_char(h.closes_at, 'HH24:MI')
    ) order by h.weekday), '[]'::jsonb)
  into hours_json
  from public.business_hours h where h.barbershop_id = sid;

  select h.is_open, h.opens_at, h.closes_at into win
  from public.business_hours h
  where h.barbershop_id = sid and h.weekday = extract(dow from today)::int;

  if (cfg ->> 'enabled')::boolean then
    if (cfg ->> 'show_services')::boolean then
      select coalesce(jsonb_agg(jsonb_build_object(
          'name', sv.name, 'description', coalesce(sv.description, ''),
          'duration_minutes', sv.duration_minutes, 'price_cents', sv.price_cents, 'icon', sv.icon
        ) order by sv.created_at), '[]'::jsonb)
      into services_json
      from (select * from public.services where barbershop_id = sid and active
            order by created_at limit 30) sv;
    end if;

    if (cfg ->> 'show_staff')::boolean then
      for st in
        select id, display_name, bio, avatar_url, booking_slug
        from public.staff where barbershop_id = sid and active
        order by created_at limit 20
      loop
        free_slots := array[]::text[];
        select sv.id, t.duration_minutes into shortest
        from public.services sv
        cross join lateral public.staff_service_terms(st.id, sv.id) t
        where sv.barbershop_id = sid and sv.active
        order by t.duration_minutes, sv.created_at
        limit 1;
        if (cfg ->> 'show_today')::boolean and win.is_open and shortest.id is not null then
          select coalesce(array_agg(to_char(x.starts_at at time zone tz, 'HH24:MI') order by x.starts_at),
                          array[]::text[])
          into free_slots
          from (
            select a.starts_at from public.available_slots_internal(st.id, shortest.id, today) a
            order by a.starts_at limit 12
          ) x;
        end if;
        staff_json := staff_json || jsonb_build_object(
          'name', st.display_name,
          'bio', coalesce(st.bio, ''),
          'avatar_url', st.avatar_url,
          'booking_slug', st.booking_slug,
          'free_today', to_jsonb(free_slots),
          'offers_services', shortest.id is not null,
          'min_duration_minutes', shortest.duration_minutes
        );
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'shop', jsonb_build_object(
      'id', shop.id, 'name', shop.name, 'slug', shop.slug, 'timezone', tz,
      'display_name', shop.display_name, 'tagline', shop.tagline, 'logo_url', shop.logo_url,
      'logo_background_color', shop.logo_background_color, 'font_family', shop.font_family,
      'custom_font_url', shop.custom_font_url, 'header_font_weight', shop.header_font_weight,
      'header_font_style', shop.header_font_style, 'corner_style', shop.corner_style,
      'primary_color', shop.primary_color, 'accent_color', shop.accent_color,
      'hero_image_url', shop.login_image_url
    ),
    'landing', cfg,
    'hours', case when (cfg ->> 'enabled')::boolean and (cfg ->> 'show_hours')::boolean
      then hours_json else '[]'::jsonb end,
    'today', jsonb_build_object(
      'date', today,
      'weekday', extract(dow from today)::int,
      'is_open', coalesce(win.is_open, false),
      'opens_at', to_char(win.opens_at, 'HH24:MI'),
      'closes_at', to_char(win.closes_at, 'HH24:MI'),
      'step_minutes', 15
    ),
    'staff', staff_json,
    'services', services_json,
    'generated_at', now_ts
  );
end;
$$;

revoke all on function public.get_public_shop_landing(text, text) from public;
grant execute on function public.get_public_shop_landing(text, text) to anon, authenticated;

-- Sinal de mudança de agenda, sem dado pessoal: só loja, profissional e quando mudou.
-- As telas escutam (Realtime) ou consultam o último sinal e refazem a própria consulta.
create table if not exists public.availability_signals (
  id bigint generated always as identity primary key,
  barbershop_id uuid not null,
  staff_id uuid,
  changed_at timestamptz not null default clock_timestamp()
);
create index if not exists availability_signals_shop_changed_idx
  on public.availability_signals (barbershop_id, changed_at desc);
alter table public.availability_signals enable row level security;
drop policy if exists "Anyone reads availability signals" on public.availability_signals;
create policy "Anyone reads availability signals" on public.availability_signals
  for select to anon, authenticated using (true);
revoke all on public.availability_signals from public, anon, authenticated;
grant select on public.availability_signals to anon, authenticated;

create or replace function public.emit_availability_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  -- A agenda nunca falha por causa do sinal.
  begin
    insert into public.availability_signals (barbershop_id, staff_id)
    values (
      (r ->> 'barbershop_id')::uuid,
      case when tg_table_name = 'staff' then (r ->> 'id')::uuid else nullif(r ->> 'staff_id', '')::uuid end
    );
    if random() < 0.05 then
      delete from public.availability_signals
      where id in (
        select id from public.availability_signals
        where changed_at < clock_timestamp() - interval '1 day'
        order by id limit 500
        for update skip locked);
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;
revoke all on function public.emit_availability_signal() from public, anon, authenticated;

drop trigger if exists appointments_availability_signal on public.appointments;
create trigger appointments_availability_signal
after insert or delete or update of status, starts_at, ends_at, staff_id, service_id on public.appointments
for each row execute function public.emit_availability_signal();
drop trigger if exists availability_blocks_availability_signal on public.availability_blocks;
create trigger availability_blocks_availability_signal
after insert or update or delete on public.availability_blocks
for each row execute function public.emit_availability_signal();
drop trigger if exists slot_waits_availability_signal on public.slot_waits;
create trigger slot_waits_availability_signal
after insert or update or delete on public.slot_waits
for each row execute function public.emit_availability_signal();
drop trigger if exists business_hours_availability_signal on public.business_hours;
create trigger business_hours_availability_signal
after insert or update or delete on public.business_hours
for each row execute function public.emit_availability_signal();
drop trigger if exists staff_services_availability_signal on public.staff_services;
create trigger staff_services_availability_signal
after insert or update or delete on public.staff_services
for each row execute function public.emit_availability_signal();
drop trigger if exists staff_availability_signal on public.staff;
create trigger staff_availability_signal
after insert or delete or update of active on public.staff
for each row execute function public.emit_availability_signal();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'availability_signals')
  then
    alter publication supabase_realtime add table public.availability_signals;
  end if;
end $$;
