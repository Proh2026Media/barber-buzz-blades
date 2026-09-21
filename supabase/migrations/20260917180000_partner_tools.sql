-- Ferramentas do parceiro: carteira, clientes, perfil e ritmo.
--
-- Regra central do usuário: cada barbeiro é parceiro de trabalho do outro, mas cada
-- um tem carteira e lista de clientes próprias, perfil independente, e NUNCA vê os
-- dados financeiros dos colegas — somente o seu. O app une apenas a marca da
-- barbearia. Todas as funções abaixo filtram pelo `staff_id` do usuário atual.

-- ---------------------------------------------------------------------------
-- Perfil próprio: bio e avatar no registro do profissional
-- ---------------------------------------------------------------------------

alter table public.staff add column bio text;
alter table public.staff add column avatar_url text;

-- O parceiro edita o próprio perfil (nome de exibição, bio e avatar), sem tocar
-- na identidade da barbearia nem no link de agendamento (`booking_slug`).
drop policy if exists "Professionals update own profile" on public.staff;
create policy "Professionals update own profile" on public.staff for update to authenticated using(
  public.is_platform_admin()
  or id = public.current_staff_id(barbershop_id)
) with check(
  public.is_platform_admin()
  or id = public.current_staff_id(barbershop_id)
);

-- Garante que um profissional sem gestão não troque loja, status ou link público
-- ao editar o próprio perfil (a política acima já limita à própria linha).
create or replace function public.guard_staff_profile_update()
returns trigger language plpgsql set search_path=public as $$
begin
  if not public.is_platform_admin()
     and public.current_staff_id(old.barbershop_id) = old.id
     and not public.can_view_full_shop(old.barbershop_id) then
    if new.barbershop_id is distinct from old.barbershop_id
       or new.active is distinct from old.active
       or new.booking_slug is distinct from old.booking_slug then
      raise exception 'O profissional só pode editar nome, bio e avatar do próprio perfil' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_staff_profile_update_trg on public.staff;
create trigger guard_staff_profile_update_trg before update on public.staff
  for each row execute function public.guard_staff_profile_update();

-- ---------------------------------------------------------------------------
-- Carteira própria: valores do próprio atendimento (derivado, sem tabela nova)
-- ---------------------------------------------------------------------------

create or replace function public.get_partner_wallet(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  mine := public.current_staff_id(p_shop_id);
  if mine is null and not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  return jsonb_build_object(
    'total_completed_cents', coalesce((
      select sum(coalesce(a.booked_price_cents, s.price_cents))
      from public.appointments a
      left join public.services s on s.id = a.service_id
      where a.barbershop_id = p_shop_id and a.status = 'completed'
        and (mine is not null and a.staff_id = mine)
    ), 0),
    'completed_count', (
      select count(*) from public.appointments a
      where a.barbershop_id = p_shop_id and a.status = 'completed'
        and (mine is not null and a.staff_id = mine)
    ),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'appointment_id', a.id,
        'starts_at', a.starts_at,
        'customer_name', p.full_name,
        'service_name', s.name,
        'amount_cents', coalesce(a.booked_price_cents, s.price_cents)
      ) order by a.starts_at desc)
      from public.appointments a
      join public.services s on s.id = a.service_id
      left join public.profiles p on p.id = a.customer_id
      where a.barbershop_id = p_shop_id and a.status = 'completed'
        and (mine is not null and a.staff_id = mine)
    ), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Lista de clientes do próprio parceiro (derivado dos atendimentos)
-- ---------------------------------------------------------------------------

create or replace function public.get_partner_clients(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  mine := public.current_staff_id(p_shop_id);
  if mine is null then raise exception 'Not allowed' using errcode='42501'; end if;

  return coalesce((
    select jsonb_agg(c order by c->>'last_visit' desc)
    from (
      select jsonb_build_object(
        'customer_id', a.customer_id,
        'customer_name', p.full_name,
        'visits', count(*),
        'total_spent_cents', sum(coalesce(a.booked_price_cents, s.price_cents)),
        'last_visit', max(a.starts_at)
      ) as c
      from public.appointments a
      join public.services s on s.id = a.service_id
      left join public.profiles p on p.id = a.customer_id
      where a.barbershop_id = p_shop_id and a.staff_id = mine and a.status = 'completed'
      group by a.customer_id, p.full_name
    ) clients
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Ritmo: frequência de retorno, dia e horário preferidos
-- ---------------------------------------------------------------------------

/** Mediana dos dias entre atendimentos concluídos consecutivos do cliente atual. */
create or replace function public.get_customer_rhythm(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; sample int;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;

  select jsonb_build_object(
    'sample', count(distinct appt_id),
    'avg_return_days', percentile_cont(0.5) within group (order by interval_days),
    'preferred_weekday', mode() within group (order by dow),
    'preferred_hour', mode() within group (order by hour),
    'top_service', (
      select s.name from public.appointments a2 join public.services s on s.id=a2.service_id
      where a2.barbershop_id=p_shop_id and a2.customer_id=auth.uid() and a2.status='completed'
      group by s.name order by count(*) desc limit 1
    ),
    'avg_spend_cents', round(avg(coalesce(booked_price_cents, price_cents)))
  ) into result
  from (
    select
      a.id as appt_id,
      extract(epoch from (a.starts_at - lag(a.starts_at) over (order by a.starts_at)))/86400 as interval_days,
      extract(dow from a.starts_at) as dow,
      extract(hour from a.starts_at) as hour,
      a.booked_price_cents, sv.price_cents
    from public.appointments a
    left join public.services sv on sv.id = a.service_id
    where a.barbershop_id = p_shop_id and a.customer_id = auth.uid() and a.status = 'completed'
  ) intervals
  where intervals.interval_days is not null;

  if result is null or (result->>'sample')::int = 0 then
    return jsonb_build_object('sample', 0);
  end if;
  return result;
end $$;

/** Ritmo dos clientes do próprio parceiro (mesma métrica, escopo da carteira dele). */
create or replace function public.get_partner_rhythm(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid; result jsonb;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  mine := public.current_staff_id(p_shop_id);
  if mine is null then raise exception 'Not allowed' using errcode='42501'; end if;

  select jsonb_build_object(
    'sample', count(distinct appt_id),
    'avg_return_days', percentile_cont(0.5) within group (order by interval_days),
    'preferred_weekday', mode() within group (order by dow),
    'preferred_hour', mode() within group (order by hour),
    'top_service', (
      select s.name from public.appointments a2 join public.services s on s.id=a2.service_id
      where a2.barbershop_id=p_shop_id and a2.staff_id=mine and a2.status='completed'
      group by s.name order by count(*) desc limit 1
    ),
    'avg_spend_cents', round(avg(coalesce(booked_price_cents, price_cents)))
  ) into result
  from (
    select
      a.id as appt_id,
      extract(epoch from (a.starts_at - lag(a.starts_at) over (partition by a.customer_id order by a.starts_at)))/86400 as interval_days,
      extract(dow from a.starts_at) as dow,
      extract(hour from a.starts_at) as hour,
      a.booked_price_cents, sv.price_cents
    from public.appointments a
    left join public.services sv on sv.id = a.service_id
    where a.barbershop_id = p_shop_id and a.staff_id = mine and a.status = 'completed'
  ) intervals
  where intervals.interval_days is not null;

  if result is null or (result->>'sample')::int = 0 then
    return jsonb_build_object('sample', 0);
  end if;
  return result;
end $$;

grant execute on function public.get_partner_wallet(uuid),
  public.get_partner_clients(uuid),
  public.get_customer_rhythm(uuid),
  public.get_partner_rhythm(uuid)
to authenticated;
