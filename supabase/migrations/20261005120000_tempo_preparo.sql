-- Tempo de preparo entre atendimentos (05/10/2026).
--
-- A barbearia pode reservar uma folga depois de cada atendimento (limpar e arrumar a cadeira).
-- O cliente continua vendo só a duração do serviço; a folga não aparece como horário livre.
--
-- 1. barbershop_settings.prep_minutes (0, 5, 10, 15, 20 ou 30; padrão 0 = como antes) vale
--    para a loja toda. services.prep_minutes (mesmos valores ou nulo = usar o da loja)
--    permite um valor próprio por serviço. service_prep_minutes(loja, serviço) resolve.
-- 2. Horários livres (available_slots_internal, usada pelo app, por "qualquer profissional"
--    e pela página pública): o atendimento novo ocupa duração + preparo dele; cada
--    atendimento existente ocupa até o fim + o preparo do serviço dele. Bloqueios, esperas e
--    o fechamento não exigem preparo (a folga pode cair no almoço ou depois de fechar).
--    staff_busy_prep_internal devolve o ocupado com o preparo; staff_busy_internal fica igual.
-- 3. No modo "no tamanho do serviço" o passo passa a ser duração + preparo
--    (Corte de 30 min com 10 de preparo: 9:00, 9:40, 10:20...). Nova versão de
--    slot_candidate_starts com p_prep; a de 3 argumentos fica igual.
-- 4. appointments_enforce_service_terms (a partir de 20261003150000_correcoes_auditoria.sql):
--    para o cliente, a grade usa o preparo e o horário que invade o preparo de um atendimento
--    vizinho é recusado com 23P01 (a mesma resposta de horário ocupado). O painel continua
--    livre para encaixar. Resto idêntico.
-- 5. apply_shop_change (a partir de 20261003230000_decisoes_whatsapp_fuso.sql) grava
--    prep_minutes em 'settings.operational', 'service.create' e 'service.update'
--    (no serviço, nulo volta a usar o da loja). Resto idêntico. As travas de governança de
--    services e barbershop_settings valem por linha, então a coluna nova já é protegida.
-- 6. Mudar o preparo da loja ou de um serviço avisa as telas abertas (availability_signals).

alter table public.barbershop_settings
  add column if not exists prep_minutes smallint not null default 0;
alter table public.barbershop_settings
  drop constraint if exists barbershop_settings_prep_minutes_check,
  add constraint barbershop_settings_prep_minutes_check
    check (prep_minutes in (0, 5, 10, 15, 20, 30));

alter table public.services
  add column if not exists prep_minutes smallint;
alter table public.services
  drop constraint if exists services_prep_minutes_check,
  add constraint services_prep_minutes_check
    check (prep_minutes is null or prep_minutes in (0, 5, 10, 15, 20, 30));

-- Preparo depois de um serviço: o do serviço, senão o da loja, senão nenhum.
create or replace function public.service_prep_minutes(p_shop_id uuid, p_service_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.prep_minutes::integer from public.services s where s.id = p_service_id),
    (select st.prep_minutes::integer from public.barbershop_settings st where st.barbershop_id = p_shop_id),
    0)
$$;

create or replace function public.staff_busy_prep_internal(p_staff_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz, prep_minutes integer, is_appointment boolean)
language sql
stable
security definer
set search_path = public
as $$
  select a.starts_at, a.ends_at, public.service_prep_minutes(a.barbershop_id, a.service_id), true
  from public.appointments a
  where a.staff_id = p_staff_id and a.status in ('pending', 'confirmed', 'completed')
    and a.starts_at < p_to and a.ends_at + interval '30 minutes' > p_from
  union all
  select b.starts_at, b.ends_at, 0, false
  from public.availability_blocks b
  join public.staff s on s.id = p_staff_id
  where b.barbershop_id = s.barbershop_id and (b.staff_id is null or b.staff_id = p_staff_id)
    and b.starts_at < p_to and b.ends_at > p_from
  union all
  select w.starts_at, w.ends_at, 0, false
  from public.slot_waits w
  where w.staff_id = p_staff_id and w.state in ('holding', 'exclusive')
    and (w.hold_until > clock_timestamp() or (w.customer_id is not null and w.claim_until > clock_timestamp()))
    and w.starts_at < p_to and w.ends_at > p_from
$$;

create or replace function public.slot_candidate_starts(
  p_staff_id uuid, p_date date, p_duration integer, p_prep integer
)
returns setof timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop uuid;
  v_tz text;
  v_win record;
  v_start timestamptz;
  v_end timestamptz;
  v_step interval;
  v_dur interval;
  v_cursor timestamptz;
  v_block record;
begin
  select s.barbershop_id into v_shop from public.staff s where s.id = p_staff_id;
  if v_shop is null or p_date is null or p_duration is null or p_duration <= 0 then return; end if;

  select h.is_open, h.opens_at, h.closes_at into v_win
  from public.business_hours h
  where h.barbershop_id = v_shop and h.weekday = extract(dow from p_date)::smallint;
  if not coalesce(v_win.is_open, false) or v_win.closes_at <= v_win.opens_at then return; end if;

  v_tz := public.shop_tz(v_shop);
  v_start := (p_date + v_win.opens_at) at time zone v_tz;
  v_end := (p_date + v_win.closes_at) at time zone v_tz;
  -- No modo "no tamanho do serviço" o passo é a duração mais o preparo; nos demais, o de sempre.
  v_step := make_interval(mins => public.shop_slot_step(v_shop, p_duration + greatest(coalesce(p_prep, 0), 0)));
  v_dur := make_interval(mins => p_duration);

  v_cursor := v_start;
  for v_block in
    select b.starts_at, b.ends_at
    from public.availability_blocks b
    where b.barbershop_id = v_shop and (b.staff_id is null or b.staff_id = p_staff_id)
      and b.starts_at < v_end and b.ends_at > v_start
    order by b.starts_at, b.ends_at
  loop
    if v_block.starts_at > v_cursor then
      return query select g from generate_series(v_cursor, v_block.starts_at - v_dur, v_step) g;
    end if;
    v_cursor := greatest(v_cursor, v_block.ends_at);
  end loop;
  if v_cursor < v_end then
    return query select g from generate_series(v_cursor, v_end - v_dur, v_step) g;
  end if;
end;
$$;

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
  prep integer;
  horizon integer;
  local_today date;
begin
  select s.barbershop_id into shop_id
  from public.staff s join public.barbershops b on b.id = s.barbershop_id
  where s.id = p_staff_id and s.active and b.status = 'active';
  if shop_id is null or p_date is null then return; end if;

  select t.duration_minutes into dur from public.staff_service_terms(p_staff_id, p_service_id) t;
  if dur is null or dur <= 0 then return; end if;
  prep := public.service_prep_minutes(shop_id, p_service_id);

  tz := public.shop_tz(shop_id);
  local_today := (clock_timestamp() at time zone tz)::date;
  select coalesce(st.booking_horizon_days, 14) into horizon
  from public.barbershop_settings st where st.barbershop_id = shop_id;
  if p_date < local_today or p_date > local_today + greatest(coalesce(horizon, 14), 1) - 1 then
    return;
  end if;

  return query
  with grid as materialized (
    select c.g from public.slot_candidate_starts(p_staff_id, p_date, dur, prep) as c(g)
  ),
  busy as materialized (
    select b.starts_at, b.ends_at, b.prep_minutes, b.is_appointment
    from public.staff_busy_prep_internal(
      p_staff_id,
      (select min(grid.g) from grid),
      (select max(grid.g) from grid) + make_interval(mins => dur + prep)) b
  )
  select grid.g, grid.g + make_interval(mins => dur)
  from grid
  where grid.g > clock_timestamp()
    and not exists (
      select 1 from busy
      where busy.starts_at < grid.g + make_interval(mins => dur + case when busy.is_appointment then prep else 0 end)
        and busy.ends_at + make_interval(mins => busy.prep_minutes) > grid.g)
  order by grid.g;
end;
$$;

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
  check_window boolean;
  prep integer;
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
  prep := public.service_prep_minutes(new.barbershop_id, new.service_id);
  if tg_op = 'INSERT' or new.service_id is distinct from old.service_id
     or new.staff_id is distinct from old.staff_id then
    new.booked_price_cents := terms.price_cents;
  else
    new.booked_price_cents := old.booked_price_cents;
  end if;

  -- Ocorrências de recorrência são geradas à frente de propósito. A âncora (primeira
  -- ocorrência, escolhida pelo cliente) e a remarcação de uma ocorrência seguem a regra.
  check_window := new.series_id is null
    or (tg_op = 'UPDATE' and new.starts_at is distinct from old.starts_at)
    or (tg_op = 'INSERT' and exists (
      select 1 from public.booking_series bs
      where bs.id = new.series_id and bs.anchor_starts_at = new.starts_at));

  if check_window then
    tz := public.shop_tz(new.barbershop_id);
    select coalesce(s.booking_horizon_days, 14) into horizon
    from public.barbershop_settings s where s.barbershop_id = new.barbershop_id;
    if (new.starts_at at time zone tz)::date
       > (clock_timestamp() at time zone tz)::date + greatest(coalesce(horizon, 14), 1) - 1 then
      raise exception 'Esse dia ainda não está aberto para agendamento.' using errcode = '22023';
    end if;

    -- Grade da loja: só quando o horário, o profissional ou o serviço mudam. A vaga resgatada
    -- da lista de espera mantém o horário original, mesmo que a loja tenha mudado de modo.
    -- Horário passado, fora do expediente ou em bloqueio fica para appointments_validate_booking,
    -- que dá a mensagem específica.
    if (tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at
        or new.staff_id is distinct from old.staff_id
        or new.service_id is distinct from old.service_id)
       and new.starts_at > clock_timestamp()
       and exists (
         select 1 from public.business_hours h
         where h.barbershop_id = new.barbershop_id and h.is_open
           and h.weekday = extract(dow from (new.starts_at at time zone tz))::smallint
           and (new.ends_at at time zone tz)::date = (new.starts_at at time zone tz)::date
           and (new.starts_at at time zone tz)::time >= h.opens_at
           and (new.ends_at at time zone tz)::time <= h.closes_at)
       and not exists (
         select 1 from public.availability_blocks b
         where b.barbershop_id = new.barbershop_id and (b.staff_id is null or b.staff_id = new.staff_id)
           and b.starts_at < new.ends_at and b.ends_at > new.starts_at)
       and not exists (
         select 1 from public.slot_waits w
         where w.staff_id = new.staff_id and w.starts_at = new.starts_at
           and w.state = 'claimed' and w.customer_id = auth.uid())
       and not exists (
         select 1
         from public.slot_candidate_starts(
           new.staff_id, (new.starts_at at time zone tz)::date, terms.duration_minutes, prep) c(g)
         where c.g = new.starts_at)
    then
      raise exception 'Esse horário não está entre os oferecidos pela barbearia. Escolha outro.'
        using errcode = '22023';
    end if;

    -- Tempo de preparo: o atendimento novo precisa deixar o preparo dele livre antes do
    -- próximo e começar depois do preparo do anterior. Mesmas condições da grade (horário
    -- passado, fora do expediente ou em bloqueio continuam com a mensagem específica); a
    -- sobreposição direta continua com a trava de horário ocupado; a vaga resgatada da
    -- espera mantém o horário original.
    if (tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at
        or new.staff_id is distinct from old.staff_id
        or new.service_id is distinct from old.service_id)
       and new.starts_at > clock_timestamp()
       and exists (
         select 1 from public.business_hours h
         where h.barbershop_id = new.barbershop_id and h.is_open
           and h.weekday = extract(dow from (new.starts_at at time zone tz))::smallint
           and (new.ends_at at time zone tz)::date = (new.starts_at at time zone tz)::date
           and (new.starts_at at time zone tz)::time >= h.opens_at
           and (new.ends_at at time zone tz)::time <= h.closes_at)
       and not exists (
         select 1 from public.availability_blocks b
         where b.barbershop_id = new.barbershop_id and (b.staff_id is null or b.staff_id = new.staff_id)
           and b.starts_at < new.ends_at and b.ends_at > new.starts_at)
       and not exists (
         select 1 from public.slot_waits w
         where w.staff_id = new.staff_id and w.starts_at = new.starts_at
           and w.state = 'claimed' and w.customer_id = auth.uid())
       and exists (
         select 1 from public.appointments a
         where a.staff_id = new.staff_id and a.id is distinct from new.id
           and a.status in ('pending', 'confirmed', 'completed')
           and a.starts_at < new.ends_at + make_interval(mins => prep)
           and a.ends_at + make_interval(mins => public.service_prep_minutes(a.barbershop_id, a.service_id))
             > new.starts_at
           and not (a.starts_at < new.ends_at and a.ends_at > new.starts_at))
    then
      raise exception 'Esse horário não está mais livre. Escolha outro.' using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.apply_shop_change(p_shop_id uuid, p_kind text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.approved_shop_change', 'on', true);
  case p_kind
    when 'service.create' then
      insert into public.services(
        barbershop_id, name, description, duration_minutes, price_cents, active, icon, prep_minutes
      ) values (
        p_shop_id,
        p_payload->>'name',
        nullif(p_payload->>'description', ''),
        (p_payload->>'duration_minutes')::int,
        (p_payload->>'price_cents')::int,
        coalesce((p_payload->>'active')::boolean, true),
        nullif(p_payload->>'icon', ''),
        nullif(p_payload->>'prep_minutes', '')::smallint
      );
    when 'service.update' then
      update public.services set
        name = coalesce(p_payload->>'name', name),
        description = case when p_payload ? 'description' then nullif(p_payload->>'description', '') else description end,
        duration_minutes = coalesce((p_payload->>'duration_minutes')::int, duration_minutes),
        price_cents = coalesce((p_payload->>'price_cents')::int, price_cents),
        active = coalesce((p_payload->>'active')::boolean, active),
        icon = case when p_payload ? 'icon' then nullif(p_payload->>'icon', '') else icon end,
        prep_minutes = case
          when p_payload ? 'prep_minutes' then nullif(p_payload->>'prep_minutes', '')::smallint
          else prep_minutes
        end
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'service.toggle' then
      update public.services set active = (p_payload->>'active')::boolean
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'service.delete' then
      delete from public.services where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.create' then
      insert into public.staff(
        barbershop_id, display_name, active, avatar_url, bio, booking_slug
      ) values (
        p_shop_id,
        p_payload->>'display_name',
        coalesce((p_payload->>'active')::boolean, true),
        nullif(p_payload->>'avatar_url', ''),
        nullif(p_payload->>'bio', ''),
        nullif(p_payload->>'booking_slug', '')
      );
    when 'staff.update' then
      update public.staff set
        display_name = coalesce(p_payload->>'display_name', display_name),
        active = coalesce((p_payload->>'active')::boolean, active),
        avatar_url = case when p_payload ? 'avatar_url' then nullif(p_payload->>'avatar_url', '') else avatar_url end,
        bio = case when p_payload ? 'bio' then nullif(p_payload->>'bio', '') else bio end,
        booking_slug = case when p_payload ? 'booking_slug' then nullif(p_payload->>'booking_slug', '') else booking_slug end
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.toggle' then
      update public.staff set active = (p_payload->>'active')::boolean
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.delete' then
      delete from public.staff where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'hours.replace' then
      -- Mesmo formato que a tela envia: weekday, is_open, opens_at, closes_at.
      insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
      select
        p_shop_id,
        (h->>'weekday')::int,
        coalesce((h->>'is_open')::boolean, true),
        coalesce((h->>'opens_at')::time, '09:00'::time),
        coalesce((h->>'closes_at')::time, '19:00'::time)
      from jsonb_array_elements(coalesce(p_payload->'hours', '[]'::jsonb)) h
      on conflict (barbershop_id, weekday) do update
        set is_open = excluded.is_open,
            opens_at = excluded.opens_at,
            closes_at = excluded.closes_at,
            updated_at = now();
    when 'availability.create' then
      insert into public.availability_blocks(
        barbershop_id, staff_id, starts_at, ends_at, reason
      ) values (
        p_shop_id,
        nullif(p_payload->>'staff_id', '')::uuid,
        (p_payload->>'starts_at')::timestamptz,
        (p_payload->>'ends_at')::timestamptz,
        nullif(p_payload->>'reason', '')
      );
    when 'availability.delete' then
      delete from public.availability_blocks
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'settings.operational' then
      update public.barbershop_settings set
        booking_instructions = coalesce(p_payload->>'booking_instructions', booking_instructions),
        booking_horizon_days = coalesce((p_payload->>'booking_horizon_days')::int, booking_horizon_days),
        survey_program_enabled = coalesce(
          (p_payload->>'survey_program_enabled')::boolean,
          survey_program_enabled
        ),
        waiting_enabled = coalesce((p_payload->>'waiting_enabled')::boolean, waiting_enabled),
        waiting_cutoff_minutes = coalesce(
          (p_payload->>'waiting_cutoff_minutes')::int,
          waiting_cutoff_minutes
        ),
        staff_assignment_mode = coalesce(
          nullif(p_payload->>'staff_assignment_mode', ''),
          staff_assignment_mode
        ),
        slot_mode = coalesce(nullif(p_payload->>'slot_mode', ''), slot_mode),
        slot_step_minutes = coalesce((p_payload->>'slot_step_minutes')::smallint, slot_step_minutes),
        prep_minutes = coalesce((p_payload->>'prep_minutes')::smallint, prep_minutes)
      where barbershop_id = p_shop_id;
    when 'shop.timezone' then
      -- Fuso da barbearia (set_shop_timezone). Confere de novo: um pedido aprovado
      -- depois precisa continuar válido no momento de aplicar.
      if not public.is_valid_shop_timezone(p_payload->>'timezone') then
        raise exception 'Fuso horário inválido' using errcode = '22023';
      end if;
      update public.barbershops set timezone = p_payload->>'timezone'
      where id = p_shop_id;
    when 'member.add' then
      perform public.apply_add_shop_member(
        p_shop_id,
        (p_payload->>'user_id')::uuid,
        (p_payload->>'role')::public.shop_member_role,
        nullif(p_payload->>'ownership_percent', '')::numeric,
        nullif(p_payload->>'display_name', '')
      );
    when 'member.update' then
      perform public.apply_update_shop_member(
        p_shop_id,
        (p_payload->>'id')::uuid,
        case when p_payload ? 'role' and nullif(p_payload->>'role', '') is not null
          then (p_payload->>'role')::public.shop_member_role
          else null end,
        case when p_payload ? 'ownership_percent'
          then nullif(p_payload->>'ownership_percent', '')::numeric
          else null end,
        case when p_payload ? 'active'
          then (p_payload->>'active')::boolean
          else null end
      );
    else
      raise exception 'Unsupported change kind: %', p_kind using errcode = '22023';
  end case;
end;
$$;

-- Mudar o preparo da loja também altera a agenda oferecida.
create or replace function public.emit_slot_mode_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slot_mode is distinct from old.slot_mode
     or new.slot_step_minutes is distinct from old.slot_step_minutes
     or new.prep_minutes is distinct from old.prep_minutes then
    begin
      insert into public.availability_signals (barbershop_id, staff_id) values (new.barbershop_id, null);
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;
drop trigger if exists barbershop_settings_slot_mode_signal on public.barbershop_settings;
create trigger barbershop_settings_slot_mode_signal
after update of slot_mode, slot_step_minutes, prep_minutes on public.barbershop_settings
for each row execute function public.emit_slot_mode_signal();

create or replace function public.emit_service_prep_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.prep_minutes is distinct from old.prep_minutes then
    begin
      insert into public.availability_signals (barbershop_id, staff_id) values (new.barbershop_id, null);
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;
drop trigger if exists services_prep_signal on public.services;
create trigger services_prep_signal
after update of prep_minutes on public.services
for each row execute function public.emit_service_prep_signal();

revoke all on function public.service_prep_minutes(uuid, uuid) from public, anon, authenticated;
revoke all on function public.staff_busy_prep_internal(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.slot_candidate_starts(uuid, date, integer, integer) from public, anon, authenticated;
revoke all on function public.available_slots_internal(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.appointments_enforce_service_terms() from public, anon, authenticated;
revoke all on function public.apply_shop_change(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.emit_slot_mode_signal() from public, anon, authenticated;
revoke all on function public.emit_service_prep_signal() from public, anon, authenticated;
