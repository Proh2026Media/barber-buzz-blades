-- Decisões do dono de 03/10/2026: avisos por WhatsApp só para número confirmado e fuso
-- horário configurável por barbearia.
--
-- 1. enqueue_whatsapp_message (a partir de 20261003220000_ajustes_finais.sql): quando o
--    destinatário é conhecido pelo pacote (customer_id, ou o cliente da reserva em
--    appointment_id), o aviso só entra na fila se o perfil DESSE destinatário tiver
--    whatsapp_e164 = p_to_e164 e whatsapp_verified_at preenchido. Número gravado sem
--    código (cadastro antigo, "confirmar depois", save_my_whatsapp) deixa de receber até a
--    pessoa confirmar. Destinatário desconhecido (sem customer_id/appointment_id ou reserva
--    sem cliente): nada muda. A recusa de número confirmado em OUTRA conta (220000) fica,
--    embora a nova regra já a cubra.
--    Chamadores conferidos (versões mais recentes) — todos os avisos a cliente informam o
--    destinatário, então nenhum precisou mudar:
--      * queue_appointment_whatsapp (20260925160000): appointment_id no pacote;
--        usada por process_whatsapp_reminders (20261003150000) e pelos gatilhos de reserva.
--      * deliver_client_notice (20260924180000, por send_client_notice e pelos avisos
--        automáticos): customer_id no pacote. Cliente só com WhatsApp não confirmado e sem
--        e-mail passa a receber "Cliente sem WhatsApp com opt-in nem e-mail" (22023).
--    Não há outro INSERT em whatsapp_outbox nas migrations nem nas Edge functions.
--    Avisos a cliente já pendentes na fila ao aplicar, para número não confirmado do
--    destinatário, ficam 'failed' com o motivo (não são apagados nem enviados).
--
-- 2. Fuso horário da barbearia (barbershops.timezone já existe, padrão America/Sao_Paulo;
--    shop_tz, horários livres, agenda, avisos e página pública já leem a coluna).
--    * is_valid_shop_timezone(text): nome existente em pg_timezone_names no formato IANA
--      Região/Cidade (inclui todos os fusos do Brasil e de Portugal e nomes antigos como
--      Brazil/East) ou 'UTC'. Recusa abreviações soltas (EST, CET...), posix/, right/,
--      Etc/ (sinal invertido, confunde) e SystemV/.
--    * set_shop_timezone(p_shop_id, p_timezone): mesma regra de papel das demais
--      configurações de agendamento (dono/sócio, gerente de conta, admin da plataforma) e
--      o MESMO caminho de governança: passa por request_shop_change com o tipo novo
--      'shop.timezone'. Trocar o fuso desloca todos os horários oferecidos, como
--      'settings.operational' e 'hours.replace', então em sociedade igualitária ou para
--      sócio minoritário vira pedido pendente. Devolve o jsonb de request_shop_change
--      ({status: applied|pending, ...}) com 'timezone', ou {status: 'unchanged'}.
--    * apply_shop_change (a partir de 20261003130000_fix_hours_replace.sql) ganha o ramo
--      'shop.timezone', que confere o fuso de novo ao aplicar. Resto idêntico.
--    * Gatilho barbershops_timezone_guard: fuso inválido é recusado (22023) em qualquer
--      gravação; troca do fuso por usuário logado só pelo caminho aprovado
--      (app.approved_shop_change) ou por admin da plataforma. Servidor (service_role, sem
--      auth.uid(), ex.: register-shop) grava direto. Lojas existentes não mudam.
--    * create_own_barbershop não muda (assinatura preservada): a loja nasce com o padrão
--      e o dono ajusta depois por set_shop_timezone.
--
-- Telas publicadas antes desta migration não dependem dela.

-- ---------------------------------------------------------------------------
-- 1. Avisos por WhatsApp só para número confirmado do próprio destinatário
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_whatsapp_message(
  p_shop_id uuid,
  p_to_e164 text,
  p_template_key text,
  p_body text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb,
  p_scheduled_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  channel public.whatsapp_channels%rowtype;
  message_id uuid;
  prefer_staff uuid;
  recipient uuid;
  appointment_ref uuid;
begin
  prefer_staff := nullif(p_payload->>'staff_id', '')::uuid;

  -- Destinatário: cliente informado no pacote ou o cliente da reserva.
  begin
    recipient := nullif(p_payload->>'customer_id', '')::uuid;
    if recipient is null then
      appointment_ref := nullif(p_payload->>'appointment_id', '')::uuid;
      if appointment_ref is not null then
        select a.customer_id into recipient from public.appointments a where a.id = appointment_ref;
      end if;
    end if;
  exception when invalid_text_representation then
    recipient := null;
  end;

  if recipient is not null then
    -- Destinatário conhecido: só para o número que ELE confirmou por código.
    if p_to_e164 is null or not exists (
      select 1 from public.profiles p
      where p.id = recipient
        and p.whatsapp_e164 = p_to_e164
        and p.whatsapp_verified_at is not null
    ) then
      return null;
    end if;

    -- Número confirmado em outra conta (regra de 20261003220000; com o índice único de
    -- números confirmados, a conferência acima já a cobre).
    if exists (
      select 1 from public.profiles p
      where p.whatsapp_e164 = p_to_e164
        and p.whatsapp_verified_at is not null
        and p.id <> recipient
    ) then
      return null;
    end if;
  end if;

  if prefer_staff is not null then
    select * into channel
    from public.whatsapp_channels
    where barbershop_id = p_shop_id and staff_id = prefer_staff
    limit 1;
  end if;

  if channel.id is null then
    select * into channel
    from public.whatsapp_channels
    where barbershop_id = p_shop_id and staff_id is null
    limit 1;
  end if;

  -- Compat: linhas antigas sem coluna id resolvida via barbershop
  if channel.id is null then
    select * into channel
    from public.whatsapp_channels
    where barbershop_id = p_shop_id
    order by staff_id nulls first
    limit 1;
  end if;

  if channel.barbershop_id is null
     or not channel.enabled
     or channel.status <> 'open' then
    return null;
  end if;

  if p_template_key = 'booking.reminder' then
    if not channel.notify_reminder then
      return null;
    end if;
  elsif p_template_key like 'booking.%' and not channel.notify_booking then
    return null;
  end if;

  insert into public.whatsapp_outbox (
    barbershop_id, to_e164, template_key, body, payload, dedupe_key, scheduled_at
  )
  values (
    p_shop_id, p_to_e164, p_template_key, p_body,
    coalesce(p_payload, '{}'::jsonb), p_dedupe_key, coalesce(p_scheduled_at, now())
  )
  on conflict (dedupe_key) do nothing
  returning id into message_id;

  return message_id;
end;
$$;

revoke all on function public.enqueue_whatsapp_message(uuid, text, text, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.enqueue_whatsapp_message(uuid, text, text, text, text, jsonb, timestamptz)
  to service_role;

-- Avisos que já estavam na fila (pendentes) quando esta migration é aplicada seguem a
-- mesma regra: destinatário conhecido sem o número confirmado → não sai. Ficam como
-- 'failed' com o motivo, sem apagar (histórico). Avisos sem destinatário conhecido
-- (equipe/dono) não são tocados. Os uuids do pacote são conferidos antes da conversão
-- para um pacote estranho não interromper a migration.
with queued as (
  select
    o.id,
    o.to_e164,
    coalesce(
      case when o.payload->>'customer_id'
             ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (o.payload->>'customer_id')::uuid end,
      (select a.customer_id
         from public.appointments a
        where a.id = case when o.payload->>'appointment_id'
                            ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                       then (o.payload->>'appointment_id')::uuid end)
    ) as recipient
  from public.whatsapp_outbox o
  where o.status = 'pending'
)
update public.whatsapp_outbox o
set status = 'failed',
    error = 'WhatsApp do destinatário não confirmado (20261003230000)'
from queued q
where o.id = q.id
  and q.recipient is not null
  and not exists (
    select 1 from public.profiles p
    where p.id = q.recipient
      and p.whatsapp_e164 = q.to_e164
      and p.whatsapp_verified_at is not null
  );

-- ---------------------------------------------------------------------------
-- 2a. Validação do fuso horário
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_shop_timezone(p_timezone text)
returns boolean
language sql
stable
set search_path = public, pg_catalog
as $$
  select p_timezone is not null
    and length(p_timezone) between 3 and 64
    and (p_timezone = 'UTC' or p_timezone ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$')
    and p_timezone !~ '^(posix|right|Etc|SystemV)/'
    and exists (select 1 from pg_catalog.pg_timezone_names n where n.name = p_timezone)
$$;

revoke all on function public.is_valid_shop_timezone(text) from public, anon;
grant execute on function public.is_valid_shop_timezone(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2b. Gravação direta do fuso: só válido e, para usuário logado, só pelo caminho aprovado
-- ---------------------------------------------------------------------------

create or replace function public.guard_barbershop_timezone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_valid_shop_timezone(new.timezone) then
    raise exception 'Fuso horário inválido' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE'
     and auth.uid() is not null
     and coalesce(current_setting('app.approved_shop_change', true), '') <> 'on'
     and not public.is_platform_admin() then
    raise exception 'Use set_shop_timezone para mudar o fuso horário da barbearia'
      using errcode = '42501', hint = 'Use set_shop_timezone';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_barbershop_timezone() from public, anon, authenticated;

drop trigger if exists barbershops_timezone_guard_ins on public.barbershops;
create trigger barbershops_timezone_guard_ins
  before insert on public.barbershops
  for each row
  when (new.timezone is distinct from 'America/Sao_Paulo')
  execute function public.guard_barbershop_timezone();

drop trigger if exists barbershops_timezone_guard_upd on public.barbershops;
create trigger barbershops_timezone_guard_upd
  before update of timezone on public.barbershops
  for each row
  when (new.timezone is distinct from old.timezone)
  execute function public.guard_barbershop_timezone();

-- ---------------------------------------------------------------------------
-- 2c. apply_shop_change com o ramo 'shop.timezone'
-- ---------------------------------------------------------------------------

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
        barbershop_id, name, description, duration_minutes, price_cents, active, icon
      ) values (
        p_shop_id,
        p_payload->>'name',
        nullif(p_payload->>'description', ''),
        (p_payload->>'duration_minutes')::int,
        (p_payload->>'price_cents')::int,
        coalesce((p_payload->>'active')::boolean, true),
        nullif(p_payload->>'icon', '')
      );
    when 'service.update' then
      update public.services set
        name = coalesce(p_payload->>'name', name),
        description = case when p_payload ? 'description' then nullif(p_payload->>'description', '') else description end,
        duration_minutes = coalesce((p_payload->>'duration_minutes')::int, duration_minutes),
        price_cents = coalesce((p_payload->>'price_cents')::int, price_cents),
        active = coalesce((p_payload->>'active')::boolean, active),
        icon = case when p_payload ? 'icon' then nullif(p_payload->>'icon', '') else icon end
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
        slot_step_minutes = coalesce((p_payload->>'slot_step_minutes')::smallint, slot_step_minutes)
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

revoke all on function public.apply_shop_change(uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2d. set_shop_timezone: dono/sócio, pelo mesmo caminho de governança
-- ---------------------------------------------------------------------------

create or replace function public.set_shop_timezone(p_shop_id uuid, p_timezone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text := btrim(coalesce(p_timezone, ''));
  current_tz text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  -- Mesma checagem de papel de request_shop_change (configurações da loja).
  if not public.has_shop_member_role(p_shop_id, array['owner','partner']::public.shop_member_role[])
     and not public.is_platform_admin()
     and not public.is_account_manager_of(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not public.is_valid_shop_timezone(tz) then
    raise exception 'Fuso horário inválido' using errcode = '22023';
  end if;

  select b.timezone into current_tz from public.barbershops b where b.id = p_shop_id;
  if not found then
    raise exception 'Barbearia não encontrada' using errcode = 'P0002';
  end if;
  if current_tz = tz then
    return jsonb_build_object('status', 'unchanged', 'timezone', tz);
  end if;

  return public.request_shop_change(
    p_shop_id,
    'shop.timezone',
    jsonb_build_object('timezone', tz, 'summary', 'Fuso horário: ' || tz)
  ) || jsonb_build_object('timezone', tz);
end;
$$;

revoke all on function public.set_shop_timezone(uuid, text) from public, anon;
grant execute on function public.set_shop_timezone(uuid, text) to authenticated;

notify pgrst, 'reload schema';
