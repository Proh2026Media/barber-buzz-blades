-- Mensagens WhatsApp personalizáveis por barbearia (confirmação, cancelamento, remarcação, lembrete).

create table if not exists public.whatsapp_message_templates (
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  template_key text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  primary key (barbershop_id, template_key),
  constraint whatsapp_message_templates_key_check
    check (template_key in (
      'booking.confirmed',
      'booking.cancelled',
      'booking.rescheduled',
      'booking.reminder'
    )),
  constraint whatsapp_message_templates_body_len
    check (char_length(body) between 1 and 1000)
);

create trigger whatsapp_message_templates_set_updated_at
  before update on public.whatsapp_message_templates
  for each row execute function public.set_updated_at();

alter table public.whatsapp_message_templates enable row level security;

revoke all on public.whatsapp_message_templates from anon, authenticated;
grant select, insert, update, delete on public.whatsapp_message_templates to authenticated;
grant all on public.whatsapp_message_templates to service_role;

drop policy if exists whatsapp_message_templates_select on public.whatsapp_message_templates;
create policy whatsapp_message_templates_select on public.whatsapp_message_templates
  for select to authenticated
  using (public.shop_can_manage_whatsapp(barbershop_id));

drop policy if exists whatsapp_message_templates_write on public.whatsapp_message_templates;
create policy whatsapp_message_templates_write on public.whatsapp_message_templates
  for all to authenticated
  using (public.shop_can_manage_whatsapp(barbershop_id))
  with check (public.shop_can_manage_whatsapp(barbershop_id));

-- Defaults embutidos (iguais ao texto anterior hardcoded).
create or replace function public.default_whatsapp_template(p_template_key text)
returns text
language sql
immutable
as $$
  select case p_template_key
    when 'booking.confirmed' then
      E'{{loja}}\nSeu horário está confirmado.\n{{servico}} com {{profissional}}\n{{quando}}'
    when 'booking.cancelled' then
      E'{{loja}}\nSeu horário foi cancelado.\n{{servico}} — {{quando}}'
    when 'booking.rescheduled' then
      E'{{loja}}\nSeu horário foi remarcado.\n{{servico}} com {{profissional}}\nNovo horário: {{quando}}'
    when 'booking.reminder' then
      E'{{loja}}\nLembrete do seu horário.\n{{servico}} com {{profissional}}\n{{quando}}'
    else
      E'{{loja}}\nAtualização do seu horário em {{quando}}.'
  end;
$$;

revoke all on function public.default_whatsapp_template(text) from public, anon;
grant execute on function public.default_whatsapp_template(text) to authenticated, service_role;

create or replace function public.render_whatsapp_template(
  p_body text,
  p_vars jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  result text := coalesce(p_body, '');
  key text;
  value text;
begin
  for key, value in
    select * from jsonb_each_text(coalesce(p_vars, '{}'::jsonb))
  loop
    result := replace(result, '{{' || key || '}}', coalesce(value, ''));
  end loop;
  -- Remove placeholders não preenchidos para não vazar {{...}} no WhatsApp.
  result := regexp_replace(result, '\{\{[a-z_]+\}\}', '', 'gi');
  return trim(both E'\n' from result);
end;
$$;

revoke all on function public.render_whatsapp_template(text, jsonb) from public, anon;
grant execute on function public.render_whatsapp_template(text, jsonb) to service_role;

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
begin
  select * into appt from public.appointments where id = p_appointment_id;
  if appt.id is null then return null; end if;

  select * into profile_row from public.profiles where id = appt.customer_id;
  if profile_row.whatsapp_e164 is null or profile_row.whatsapp_opt_in_at is null then
    return null;
  end if;

  select * into shop_row from public.barbershops where id = appt.barbershop_id;
  select name into service_name from public.services where id = appt.service_id;
  select display_name into staff_name from public.staff where id = appt.staff_id;

  when_label := to_char(appt.starts_at at time zone coalesce(shop_row.timezone, 'America/Sao_Paulo'), 'DD/MM/YYYY às HH24:MI');

  select t.body into template_body
  from public.whatsapp_message_templates t
  where t.barbershop_id = appt.barbershop_id
    and t.template_key = p_template_key;

  template_body := coalesce(template_body, public.default_whatsapp_template(p_template_key));

  vars := jsonb_build_object(
    'loja', coalesce(shop_row.name, 'Barbearia'),
    'shop', coalesce(shop_row.name, 'Barbearia'),
    'servico', coalesce(service_name, 'Serviço'),
    'service', coalesce(service_name, 'Serviço'),
    'profissional', coalesce(staff_name, 'profissional'),
    'staff', coalesce(staff_name, 'profissional'),
    'quando', when_label,
    'when', when_label,
    'cliente', coalesce(nullif(trim(profile_row.full_name), ''), 'cliente'),
    'customer', coalesce(nullif(trim(profile_row.full_name), ''), 'cliente')
  );

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

notify pgrst, 'reload schema';
