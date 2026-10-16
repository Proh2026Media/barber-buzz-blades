-- Desfazer as migrations de 16/10/2026 sem restaurar o banco inteiro:
--   20261016120000_retorno_google_app_instalado.sql
--   20261016130000_agendamento_pelo_painel.sql
--
-- Usar SÓ com autorização do dono e se algo der errado depois da aplicação (ver o pacote
-- docs/implantacao-agendamento-painel-2026-10-16.md, "Como desfazer"). Rodar numa transação
-- só: `psql -1 -v ON_ERROR_STOP=1`. O que é apagado:
--   * as funções novas e as tabelas `oauth_code_relay` e `shop_clients` (apelidos e clientes do
--     balcão cadastrados depois da aplicação SE PERDEM);
--   * as colunas `appointments.shop_client_id` e `appointments.booked_by`.
-- Atendimentos marcados pelo painel para cliente do balcão (sem conta) FICAM, sem nome (como os
-- de conta excluída): conferir antes com a consulta do passo de diagnóstico do pacote.
-- As onze funções recriadas pela migration voltam às versões anteriores, copiadas das migrations
-- indicadas abaixo de cada uma, com as mesmas permissões de antes.

drop function if exists public.oauth_relay_put(uuid, text);
drop function if exists public.oauth_relay_take(uuid);
drop table if exists public.oauth_code_relay;

drop function if exists public.find_shop_client(uuid, text);
drop function if exists public.book_for_client(uuid, uuid, uuid, timestamptz, uuid, uuid, text, text, text, boolean);
drop function if exists public.set_client_nickname(uuid, uuid, uuid, text);
drop function if exists public.update_shop_client(uuid, uuid, text, text, boolean);
drop function if exists public.get_shop_client(uuid, uuid);
drop function if exists public.get_team_slots(uuid, uuid, uuid, date);
drop trigger if exists appointments_guard_client_columns on public.appointments;
drop function if exists public.appointments_guard_client_columns();
drop trigger if exists memberships_link_shop_clients on public.memberships;
drop function if exists public.link_shop_clients_on_customer_join();

-- get_team_schedule: versão de 20261013210000_convite_boas_vindas_papeis.sql
create or replace function public.get_team_schedule(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  mine uuid;
  full_access boolean;
begin
  if auth.uid() is null or not (
    public.is_platform_admin()
    or public.has_shop_member_role(
      p_shop_id,
      array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
    )
    or public.has_shop_role(p_shop_id, array['shop_admin']::public.app_role[])
  ) then
    raise exception 'Not allowed';
  end if;
  mine := public.current_staff_id(p_shop_id);
  full_access := public.can_view_full_shop(p_shop_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'staff_id', a.staff_id,
      'staff_name', st.display_name,
      'starts_at', a.starts_at,
      'ends_at', a.ends_at,
      'status', a.status,
      'series_id', a.series_id,
      'is_own', a.staff_id = mine,
      'customer_id', case when full_access or a.staff_id = mine then a.customer_id else null end,
      'customer_name', case when full_access or a.staff_id = mine then p.full_name else null end,
      'service_name', case when full_access or a.staff_id = mine then s.name else null end,
      'price_cents', case when full_access or a.staff_id = mine then coalesce(a.booked_price_cents, s.price_cents) else null end,
      'visibility', case when full_access or a.staff_id = mine then 'full' else 'busy' end
    ) order by a.starts_at)
    from public.appointments a
    join public.staff st on st.id = a.staff_id
    join public.services s on s.id = a.service_id
    -- Cliente que excluiu a conta: o atendimento fica, sem nome.
    left join public.profiles p on p.id = a.customer_id
    where a.barbershop_id = p_shop_id
      and a.starts_at >= p_from
      and a.starts_at < p_to
      and a.status <> 'cancelled'
  ), '[]'::jsonb);
end;
$$;

-- queue_appointment_whatsapp: versão de 20260925160000_whatsapp_templates_and_calendar_choice.sql
create or replace function public.queue_appointment_whatsapp(
  p_appointment_id uuid,
  p_template_key text,
  p_scheduled_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.appointments%rowtype;
  profile_row public.profiles%rowtype;
  shop_row public.barbershops%rowtype;
  service_name text;
  staff_name text;
  when_label text;
  template_body text;
  body text;
  dedupe text;
  vars jsonb;
  link text;
  email_tpl jsonb;
  email_subject text;
  email_body text;
  customer_email text;
begin
  select * into appt from public.appointments where id = p_appointment_id;
  if appt.id is null then return null; end if;

  select * into profile_row from public.profiles where id = appt.customer_id;
  select * into shop_row from public.barbershops where id = appt.barbershop_id;
  select name into service_name from public.services where id = appt.service_id;
  select display_name into staff_name from public.staff where id = appt.staff_id;

  when_label := to_char(
    appt.starts_at at time zone coalesce(shop_row.timezone, 'America/Sao_Paulo'),
    'DD/MM/YYYY "às" HH24"h"MI'
  );
  link := coalesce(public.appointment_manage_url(appt.id), '');

  vars := jsonb_build_object(
    'loja', coalesce(shop_row.name, 'Barbearia'),
    'shop', coalesce(shop_row.name, 'Barbearia'),
    'serviço', coalesce(service_name, 'Serviço'),
    'servico', coalesce(service_name, 'Serviço'),
    'service', coalesce(service_name, 'Serviço'),
    'profissional', coalesce(staff_name, 'profissional'),
    'staff', coalesce(staff_name, 'profissional'),
    'quando', when_label,
    'when', when_label,
    'cliente', coalesce(nullif(trim(profile_row.full_name), ''), 'cliente'),
    'customer', coalesce(nullif(trim(profile_row.full_name), ''), 'cliente'),
    'link_reserva', link,
    'link', link
  );

  customer_email := public.customer_auth_email(appt.customer_id);
  if customer_email is not null then
    select jsonb_build_object('subject', t.subject, 'body', t.body) into email_tpl
    from public.email_message_templates t
    where t.barbershop_id = appt.barbershop_id and t.template_key = p_template_key;
    email_tpl := coalesce(email_tpl, public.default_email_template(p_template_key));
    email_subject := public.render_whatsapp_template(email_tpl->>'subject', vars);
    email_body := public.render_whatsapp_template(email_tpl->>'body', vars);
    if email_subject is not null and email_body is not null then
      perform public.enqueue_email_message(
        appt.barbershop_id,
        customer_email,
        p_template_key,
        email_subject,
        email_body,
        'email:' || p_template_key || ':' || appt.id::text
          || case when p_template_key = 'booking.reminder'
               then ':' || to_char(coalesce(p_scheduled_at, now()), 'YYYYMMDDHH24')
               else ''
             end,
        jsonb_build_object('appointment_id', appt.id),
        coalesce(p_scheduled_at, now())
      );
    end if;
  end if;

  if profile_row.whatsapp_e164 is null or profile_row.whatsapp_opt_in_at is null then
    return null;
  end if;

  select t.body into template_body
  from public.whatsapp_message_templates t
  where t.barbershop_id = appt.barbershop_id
    and t.template_key = p_template_key;

  template_body := coalesce(template_body, public.default_whatsapp_template(p_template_key));

  -- Se o modelo pede {{link_reserva}}, exige URL HTTPS absoluta.
  if position('{{link_reserva}}' in template_body) > 0
     and (link is null or link !~ '^https://') then
    return null;
  end if;

  body := public.render_whatsapp_template(template_body, vars);
  if body is null or length(trim(body)) = 0 then
    return null;
  end if;

  dedupe := p_template_key || ':' || p_appointment_id::text
    || case when p_template_key = 'booking.reminder'
         then ':' || to_char(coalesce(p_scheduled_at, now()), 'YYYYMMDDHH24')
         else ''
       end;

  return public.enqueue_whatsapp_message(
    appt.barbershop_id,
    profile_row.whatsapp_e164,
    p_template_key,
    body,
    dedupe,
    jsonb_build_object(
      'appointment_id', appt.id,
      'starts_at', appt.starts_at,
      'status', appt.status
    ),
    coalesce(p_scheduled_at, now())
  );
end;
$$;

-- process_whatsapp_reminders: versão de 20261003150000_correcoes_auditoria.sql
create or replace function public.process_whatsapp_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  queued int := 0;
  candidate record;
  message_id uuid;
begin
  for candidate in
    select
      a.id as appointment_id,
      a.starts_at - make_interval(hours => coalesce(c.reminder_hours_before, 24)) as remind_at
    from public.appointments a
    left join lateral (
      select ch.reminder_hours_before, ch.notify_reminder
      from public.whatsapp_channels ch
      where ch.barbershop_id = a.barbershop_id
      order by ch.staff_id nulls first
      limit 1
    ) c on true
    where a.status in ('pending', 'confirmed')
      and a.customer_id is not null
      and coalesce(c.notify_reminder, true)
      and a.starts_at > now()
      and a.starts_at - make_interval(hours => coalesce(c.reminder_hours_before, 24)) <= now()
      and a.starts_at - make_interval(hours => coalesce(c.reminder_hours_before, 24))
        > now() - interval '2 hours'
  loop
    message_id := public.queue_appointment_whatsapp(
      candidate.appointment_id,
      'booking.reminder',
      candidate.remind_at
    );
    if message_id is not null then
      queued := queued + 1;
    end if;
  end loop;
  return queued;
end;
$$;

-- apply_verified_whatsapp: versão de 20261003180000_verificar_whatsapp_perfil.sql
create or replace function public.apply_verified_whatsapp(
  p_user_id uuid,
  p_whatsapp text,
  p_opt_in boolean default true
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  result public.profiles%rowtype;
begin
  if p_user_id is null then
    raise exception 'Conta não informada' using errcode = '22023';
  end if;

  normalized := public.normalize_br_whatsapp(p_whatsapp);
  if normalized is null then
    raise exception 'Informe um WhatsApp válido com DDD' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.whatsapp_e164 = normalized
      and p.whatsapp_verified_at is not null
      and p.id <> p_user_id
  ) then
    raise exception 'Este WhatsApp já está em outra conta' using errcode = '23505';
  end if;

  -- Quem confirmou o código é o dono do número: cópias não verificadas em
  -- outras contas deixam de usá-lo (e de receber avisos por ele).
  update public.profiles
     set whatsapp_e164 = null,
         whatsapp_opt_in_at = null,
         whatsapp_verified_at = null,
         updated_at = now()
   where whatsapp_e164 = normalized
     and whatsapp_verified_at is null
     and id <> p_user_id;

  update public.profiles
     set whatsapp_e164 = normalized,
         whatsapp_verified_at = now(),
         whatsapp_opt_in_at = case
           when coalesce(p_opt_in, true) then coalesce(whatsapp_opt_in_at, now())
           else null
         end,
         updated_at = now()
   where id = p_user_id
  returning * into result;

  if result.id is null then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

-- get_partner_clients: versão de 20260917190000_client_directory.sql
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

-- get_client_profile: versão de 20261003150000_correcoes_auditoria.sql
create or replace function public.get_client_profile(p_shop_id uuid, p_customer_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  mine uuid;
  full_access boolean;
  served boolean;
  result jsonb;
  profile_name text;
  profile_avatar text;
  tz text;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  mine := public.current_staff_id(p_shop_id);
  full_access := public.is_platform_admin() or public.can_view_full_shop(p_shop_id);
  if mine is null and not full_access then
    raise exception 'Not allowed' using errcode='42501';
  end if;
  tz := public.shop_tz(p_shop_id);

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
          extract(dow from (a.starts_at at time zone tz)) as dow,
          extract(hour from (a.starts_at at time zone tz)) as hour,
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

-- get_partner_rhythm: versão de 20261003150000_correcoes_auditoria.sql
create or replace function public.get_partner_rhythm(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid; result jsonb; tz text;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  mine := public.current_staff_id(p_shop_id);
  if mine is null then raise exception 'Not allowed' using errcode='42501'; end if;
  tz := public.shop_tz(p_shop_id);

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
      extract(dow from (a.starts_at at time zone tz)) as dow,
      extract(hour from (a.starts_at at time zone tz)) as hour,
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

-- get_business_insights: versão de 20260917150000_shop_role_permissions.sql
create or replace function public.get_business_insights(p_shop_id uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; rating_sample bigint; improvement_sample bigint; cancellation_sample bigint;
begin
  if auth.uid() is null or not (is_platform_admin() or (p_shop_id is not null and (has_shop_role(p_shop_id,array['shop_admin']::app_role[]) or shop_can_view_financials(p_shop_id)))) then raise exception 'Not allowed'; end if;
  if p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid period'; end if;
  select jsonb_build_object(
    'bookings',count(*),'customers',count(distinct a.customer_id),
    'completed',count(*) filter(where a.status='completed'),
    'cancelled',count(*) filter(where a.status='cancelled' and f.no_show_at is null),
    'no_shows',count(*) filter(where f.no_show_at is not null),
    'quoted_completed_cents',coalesce(sum(f.quoted_price_cents) filter(where a.status='completed'),0),
    'missing_price',count(*) filter(where f.quoted_price_cents is null),
    'wait_sample',count(*) filter(where f.arrived_at is not null and f.started_at is not null),
    'mean_wait_minutes',avg(extract(epoch from(f.started_at-f.arrived_at))/60) filter(where f.started_at is not null)
  ) into result from appointments a left join appointment_facts f on f.appointment_id=a.id
  where (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;

  select count(*) into rating_sample from customer_surveys s join appointments a on a.id=s.appointment_id
  where s.question='satisfaction' and s.state='answered' and s.answer in ('1','2','3','4','5')
    and (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;
  select count(*) into improvement_sample from customer_surveys s join appointments a on a.id=s.appointment_id
  where s.question='improvement' and s.state='answered' and s.answer<>'skip'
    and (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;
  select count(*) into cancellation_sample from appointment_cancellations c join appointments a on a.id=c.appointment_id
  where c.reason is not null and (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;

  return result || jsonb_build_object(
    'usage',coalesce((select jsonb_object_agg(event,total) from(select event,count(*) total from customer_usage_events where(p_shop_id is null or barbershop_id=p_shop_id)and received_at>=p_from and received_at<p_to group by event)counts),'{}'::jsonb),
    'rating_sample',rating_sample,
    'rating_average',case when rating_sample>=5 then(select round(avg(s.answer::numeric),2) from customer_surveys s join appointments a on a.id=s.appointment_id where s.question='satisfaction' and s.state='answered' and s.answer in('1','2','3','4','5')and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to)else null end,
    'rating_distribution',case when rating_sample>=5 then coalesce((select jsonb_object_agg(answer,total)from(select s.answer,count(*) total from customer_surveys s join appointments a on a.id=s.appointment_id where s.question='satisfaction'and s.state='answered'and s.answer in('1','2','3','4','5')and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to group by s.answer)ratings),'{}'::jsonb)else '{}'::jsonb end,
    'improvement_sample',improvement_sample,
    'improvement_counts',case when improvement_sample>=5 then coalesce((select jsonb_object_agg(answer,total)from(select s.answer,count(*) total from customer_surveys s join appointments a on a.id=s.appointment_id where s.question='improvement'and s.state='answered'and s.answer<>'skip'and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to group by s.answer)improvements),'{}'::jsonb)else '{}'::jsonb end,
    'cancellation_reason_sample',cancellation_sample,
    'cancellation_reason_counts',case when cancellation_sample>=5 then coalesce((select jsonb_object_agg(reason,total)from(select c.reason,count(*) total from appointment_cancellations c join appointments a on a.id=c.appointment_id where c.reason is not null and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to group by c.reason)cancellations),'{}'::jsonb)else '{}'::jsonb end
  );
end $$;

-- get_professional_insights: versão de 20260917170000_shop_permission_money_semantics.sql
create or replace function public.get_professional_insights(p_shop_id uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid; member_role public.shop_member_role; full_access boolean;
  show_money boolean; show_anonymized boolean;
begin
  if p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid period' using errcode='22023'; end if;
  select sm.staff_id,sm.role into mine,member_role from public.shop_members sm
  where sm.barbershop_id=p_shop_id and sm.user_id=auth.uid() and sm.active limit 1;
  full_access:=public.is_platform_admin() or public.can_view_full_shop(p_shop_id);
  if not full_access and mine is null then raise exception 'Not allowed' using errcode='42501'; end if;
  show_money:=public.shop_permission_granted(p_shop_id,'view_money');
  show_anonymized:=public.shop_permission_granted(p_shop_id,'view_reports_anonymized');
  return jsonb_build_object(
    'scope',case when full_access then 'shop' when show_anonymized then 'own_with_global' else 'own_score' end,
    'own',coalesce((select jsonb_build_object(
      'bookings',count(*),'completed',count(*) filter(where status='completed'),
      'cancelled',count(*) filter(where status='cancelled'),
      'customers',count(distinct customer_id),
      'quoted_cents',case when full_access or show_money
        then coalesce(sum(booked_price_cents) filter(where status='completed'),0) else null end
    ) from public.appointments where barbershop_id=p_shop_id and starts_at>=p_from and starts_at<p_to
      and (full_access or staff_id=mine)),'{}'::jsonb),
    'global',case when not full_access and show_anonymized then coalesce((select jsonb_build_object(
      'bookings',count(*),'completed',count(*) filter(where status='completed'),
      'cancelled',count(*) filter(where status='cancelled'),
      'no_show_rate',round(100.0*count(*) filter(where f.no_show_at is not null)/nullif(count(*),0),1)
    ) from public.appointments a left join public.appointment_facts f on f.appointment_id=a.id
      where a.barbershop_id=p_shop_id and a.starts_at>=p_from and a.starts_at<p_to
      having count(*)>=5),'{}'::jsonb) else null end
  );
end $$;

-- list_departure_appointments: versão de 20261013190000_saida_equipe_reservas.sql
create or replace function public.list_departure_appointments(p_shop_id uuid, p_staff_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.shop_can_act_on_appointment(p_shop_id, p_staff_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'staff_id', a.staff_id,
      'staff_name', st.display_name,
      'starts_at', a.starts_at,
      'ends_at', a.ends_at,
      'status', a.status,
      'service_name', sv.name,
      'customer_name', p.full_name,
      'free_staff', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.display_name) order by o.display_name)
        from public.staff o
        where o.barbershop_id = a.barbershop_id
          and o.active
          and o.id <> a.staff_id
          and exists (select 1 from public.staff_service_terms(o.id, a.service_id))
          and not exists (
            select 1 from public.appointments x
            where x.staff_id = o.id
              and x.status in ('pending', 'confirmed', 'completed')
              and x.starts_at < a.ends_at and x.ends_at > a.starts_at)
          and not exists (
            select 1 from public.availability_blocks b
            where b.barbershop_id = a.barbershop_id
              and (b.staff_id is null or b.staff_id = o.id)
              and b.starts_at < a.ends_at and b.ends_at > a.starts_at)
      ), '[]'::jsonb)
    ) order by a.starts_at)
    from public.appointments a
    join public.staff st on st.id = a.staff_id
    join public.services sv on sv.id = a.service_id
    left join public.profiles p on p.id = a.customer_id
    where a.barbershop_id = p_shop_id
      and a.status in ('pending', 'confirmed', 'reschedule_requested')
      and a.starts_at > now()
      and (
        (p_staff_id is not null and a.staff_id = p_staff_id)
        or (p_staff_id is null and (
          not st.active
          or not exists (
            select 1 from public.shop_members sm
            where sm.staff_id = st.id and sm.barbershop_id = p_shop_id and sm.active)
            and st.user_id is not null))
      )
  ), '[]'::jsonb);
end;
$$;

-- get_partner_wallet: versão de 20260917180000_partner_tools.sql
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

-- Funções auxiliares da migration (depois das recriações acima, que já não as usam).
drop function if exists public.link_shop_clients_to_profile(uuid, text, uuid);
drop function if exists public.shop_client_visible(uuid, uuid, uuid);
drop function if exists public.shop_client_clean_nickname(text);
drop function if exists public.shop_has_customer(uuid, uuid);

-- A política de leitura das fichas cita appointments.shop_client_id: sai antes da coluna.
drop policy if exists "Team reads shop clients" on public.shop_clients;
drop index if exists public.appointments_shop_client_idx;
alter table public.appointments drop column if exists shop_client_id;
alter table public.appointments drop column if exists booked_by;
drop table if exists public.shop_clients;

-- Permissões como antes da migration (as recriações mantêm as de agora; repõe as originais).
revoke all on function public.get_team_schedule(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_team_schedule(uuid, timestamptz, timestamptz) to authenticated, service_role;
revoke all on function public.queue_appointment_whatsapp(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.queue_appointment_whatsapp(uuid, text, timestamptz) to service_role;
revoke all on function public.process_whatsapp_reminders() from public, anon, authenticated;
grant execute on function public.process_whatsapp_reminders() to service_role;
revoke all on function public.apply_verified_whatsapp(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.apply_verified_whatsapp(uuid, text, boolean) to service_role;
grant execute on function public.get_partner_clients(uuid) to authenticated, service_role;
grant execute on function public.get_client_profile(uuid, uuid) to authenticated, service_role;
-- Antes da migration estas duas também valiam para public e anon (a migration tirou; as duas
-- recusam quem não entrou). Devolve igual, para o banco voltar exatamente ao que era.
grant execute on function public.get_partner_clients(uuid) to public, anon;
grant execute on function public.get_client_profile(uuid, uuid) to public, anon;

notify pgrst, 'reload schema';
