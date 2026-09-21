-- Diretório de clientes: escopo por papel e perfil detalhado do cliente.
--
-- Regra: dono e sócio veem todos os clientes da barbearia; parceiro e contratado
-- veem apenas os clientes que atenderam. O perfil de cada cliente (histórico e
-- ritmo) respeita o mesmo isolamento.

-- ---------------------------------------------------------------------------
-- Lista de clientes com escopo por papel
-- ---------------------------------------------------------------------------

create or replace function public.get_partner_clients(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid; full_access boolean;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  mine := public.current_staff_id(p_shop_id);
  full_access := public.is_platform_admin() or public.can_view_full_shop(p_shop_id);
  if mine is null and not full_access then
    raise exception 'Not allowed' using errcode='42501';
  end if;

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
      where a.barbershop_id = p_shop_id and a.status = 'completed'
        and (full_access or a.staff_id = mine)
      group by a.customer_id, p.full_name
    ) clients
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Perfil do cliente: histórico completo e ritmo
-- ---------------------------------------------------------------------------

create or replace function public.get_client_profile(p_shop_id uuid, p_customer_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  mine uuid;
  full_access boolean;
  served boolean;
  result jsonb;
  profile_name text;
  profile_avatar text;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  mine := public.current_staff_id(p_shop_id);
  full_access := public.is_platform_admin() or public.can_view_full_shop(p_shop_id);
  if mine is null and not full_access then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  -- Sem acesso completo, o profissional só abre clientes que já atendeu.
  if not full_access then
    select exists(
      select 1 from public.appointments a
      where a.barbershop_id = p_shop_id and a.staff_id = mine and a.customer_id = p_customer_id
    ) into served;
    if not served then raise exception 'Not allowed' using errcode='42501'; end if;
  end if;

  select p.full_name, p.avatar_url into profile_name, profile_avatar
  from public.profiles p where p.id = p_customer_id;

  select jsonb_build_object(
    'customer_id', p_customer_id,
    'customer_name', profile_name,
    'avatar_url', profile_avatar,
    'visits', count(*),
    'total_spent_cents', coalesce(sum(coalesce(a.booked_price_cents, s.price_cents)), 0),
    'first_visit', min(a.starts_at),
    'last_visit', max(a.starts_at)
  ) into result
  from public.appointments a
  join public.services s on s.id = a.service_id
  where a.barbershop_id = p_shop_id and a.customer_id = p_customer_id and a.status = 'completed';

  if result is null then
    return jsonb_build_object(
      'customer_id', p_customer_id, 'customer_name', profile_name,
      'avatar_url', profile_avatar, 'visits', 0, 'total_spent_cents', 0,
      'first_visit', null, 'last_visit', null, 'rhythm', jsonb_build_object('sample', 0),
      'history', '[]'::jsonb
    );
  end if;

  result := result || jsonb_build_object(
    'rhythm', coalesce((
      select jsonb_build_object(
        'sample', count(distinct appt_id),
        'avg_return_days', percentile_cont(0.5) within group (order by interval_days),
        'preferred_weekday', mode() within group (order by dow),
        'preferred_hour', mode() within group (order by hour),
        'top_service', (
          select s2.name from public.appointments a2 join public.services s2 on s2.id = a2.service_id
          where a2.barbershop_id = p_shop_id and a2.customer_id = p_customer_id and a2.status = 'completed'
          group by s2.name order by count(*) desc limit 1
        ),
        'avg_spend_cents', round(avg(coalesce(booked_price_cents, price_cents)))
      )
      from (
        select
          a.id as appt_id,
          extract(epoch from (a.starts_at - lag(a.starts_at) over (order by a.starts_at)))/86400 as interval_days,
          extract(dow from a.starts_at) as dow,
          extract(hour from a.starts_at) as hour,
          a.booked_price_cents, sv.price_cents
        from public.appointments a
        left join public.services sv on sv.id = a.service_id
        where a.barbershop_id = p_shop_id and a.customer_id = p_customer_id and a.status = 'completed'
      ) intervals
      where intervals.interval_days is not null
    ), jsonb_build_object('sample', 0)),
    'history', coalesce((
      select jsonb_agg(h order by h->>'starts_at' desc)
      from (
        select jsonb_build_object(
          'appointment_id', a.id,
          'starts_at', a.starts_at,
          'service_name', s.name,
          'staff_name', st.display_name,
          'status', a.status,
          'amount_cents', coalesce(a.booked_price_cents, s.price_cents)
        ) as h
        from public.appointments a
        join public.services s on s.id = a.service_id
        left join public.staff st on st.id = a.staff_id
        where a.barbershop_id = p_shop_id and a.customer_id = p_customer_id
      ) history
    ), '[]'::jsonb)
  );

  return result;
end $$;

grant execute on function public.get_client_profile(uuid, uuid) to authenticated;
