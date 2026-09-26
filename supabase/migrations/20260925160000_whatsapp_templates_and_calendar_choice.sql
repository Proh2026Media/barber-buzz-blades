-- Modelos WhatsApp oficiais (seção 4 da especificação) + {{serviço}} literal.
-- Não sobrescreve corpos personalizados já salvos em whatsapp_message_templates.

create or replace function public.default_whatsapp_template(p_template_key text)
returns text
language sql
immutable
as $$
  select case p_template_key
    when 'booking.confirmed' then
      E'✂️ *Horário confirmado!*\n\nOlá, {{cliente}}! Seu atendimento está agendado.\n\n*Serviço:* {{serviço}}\n*Profissional:* {{profissional}}\n*Data e horário:* {{quando}}\n\nPara consultar, remarcar ou cancelar seu agendamento, acesse:\n{{link_reserva}}\n\nAté breve!\n*Equipe {{loja}}*'
    when 'booking.rescheduled' then
      E'🔄 *Horário atualizado*\n\nOlá, {{cliente}}! Seu atendimento foi remarcado.\n\nConfira os dados atualizados:\n*Serviço:* {{serviço}}\n*Profissional:* {{profissional}}\n*Novo horário:* {{quando}}\n\nPara consultar ou alterar seu agendamento, acesse:\n{{link_reserva}}\n\nNos vemos no novo horário!\n*Equipe {{loja}}*'
    when 'booking.cancelled' then
      E'✂️ *Horário cancelado*\n\nOlá, {{cliente}}! Seu agendamento foi cancelado.\n\n*Serviço:* {{serviço}}\n*Profissional:* {{profissional}}\n*Data e horário cancelados:* {{quando}}\n\nQuer agendar novamente? Acesse:\n{{link_reserva}}\n\nEsperamos te ver em breve!\n*Equipe {{loja}}*'
    when 'booking.reminder' then
      E'⏰ *Lembrete do seu horário*\n\nOlá, {{cliente}}! Seu atendimento está chegando.\n\n*Serviço:* {{serviço}}\n*Profissional:* {{profissional}}\n*Data e horário:* {{quando}}\n\nPara consultar, remarcar ou cancelar seu agendamento, acesse:\n{{link_reserva}}\n\nTe esperamos por aqui!\n*Equipe {{loja}}*'
    when 'notice.reminder_next' then
      E'{{loja}}\nOi {{cliente}}, lembrete do seu próximo horário.\n{{quando}}\n\n{{link_reserva}}'
    when 'notice.confirm_today' then
      E'{{loja}}\nOi {{cliente}}, pode confirmar se vem hoje?\n{{quando}}\n\n{{link_reserva}}'
    when 'notice.slot_open' then
      E'{{loja}}\nOi {{cliente}}, abrimos uma vaga. Se quiser, fale conosco.\n{{link_reserva}}'
    when 'notice.shop_hello' then
      E'{{loja}}\nOi {{cliente}}, a equipe deixou um aviso para você.\n{{link_reserva}}'
    else
      E'{{loja}}\nAtualização do seu horário em {{quando}}.\n{{link_reserva}}'
  end;
$$;

-- Substituição única; não remove placeholders desconhecidos em silêncio.
create or replace function public.render_whatsapp_template(
  p_body text,
  p_vars jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  result text := replace(replace(coalesce(p_body, ''), E'\r\n', E'\n'), E'\r', E'\n');
  key text;
  value text;
begin
  for key, value in
    select * from jsonb_each_text(coalesce(p_vars, '{}'::jsonb))
  loop
    result := replace(result, '{{' || key || '}}', coalesce(value, ''));
  end loop;
  -- Bloqueia envio se restar {{...}} (inclui acentos, ex.: {{serviço}} não resolvido).
  if result ~ '\{\{[^}]+\}\}' then
    return null;
  end if;
  if char_length(result) > 1000 then
    return null;
  end if;
  if length(trim(result)) = 0 then
    return null;
  end if;
  return result;
end;
$$;

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

revoke all on function public.queue_appointment_whatsapp(uuid, text, timestamptz)
  from public, anon, authenticated;

-- Agenda Google: sem pré-seleção da principal; o usuário escolhe.
alter table public.google_connections
  alter column selected_calendar_id drop default;

alter table public.google_connections
  alter column selected_calendar_id drop not null;

update public.google_connections
set
  selected_calendar_id = null,
  selected_calendar_name = null
where selected_calendar_id is not null;

comment on column public.google_connections.selected_calendar_id is
  'ID da agenda Google escolhida pelo usuário (null até escolha explícita).';

create or replace function public.get_my_google_connection()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.google_connections%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('connected', false);
  end if;

  select * into r
  from public.google_connections
  where user_id = auth.uid();

  if not found then
    return jsonb_build_object('connected', false);
  end if;

  return jsonb_build_object(
    'connected', true,
    'google_email', r.google_email,
    'scopes', coalesce(to_jsonb(r.scopes), '[]'::jsonb),
    'token_expires_at', r.token_expires_at,
    'last_error', r.last_error,
    'last_calendar_sync_at', r.last_calendar_sync_at,
    'last_contacts_sync_at', r.last_contacts_sync_at,
    'selected_calendar_id', nullif(trim(coalesce(r.selected_calendar_id, '')), ''),
    'selected_calendar_name', r.selected_calendar_name,
    'updated_at', r.updated_at
  );
end;
$$;

grant execute on function public.get_my_google_connection() to authenticated;
grant execute on function public.get_my_google_connection() to service_role;

notify pgrst, 'reload schema';
