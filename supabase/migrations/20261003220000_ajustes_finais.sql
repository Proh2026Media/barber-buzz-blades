-- Ajustes finais da auditoria de 03/10/2026.
--
-- 1. validate_shop_ownership (gatilho DEFERRED shop_ownership_total em
--    shop_members): apagar uma barbearia inteira apaga os sócios em cascata e o
--    gatilho, no COMMIT, recusava com "A loja precisa de ao menos um dono
--    ativo". Agora a função sai sem erro quando a barbearia já não existe.
--    A função passa a SECURITY DEFINER para que essa conferência (e a soma das
--    participações) não dependa do que o RLS deixa quem fez a alteração ver:
--    no COMMIT o gatilho roda com o papel da sessão, e um dono que acabou de
--    sair da própria loja já não "enxerga" a barbearia — sem isso, a loja
--    pareceria apagada e ficaria sem dono. Funções de gatilho não podem ser
--    chamadas diretamente. Fora isso, as regras são as mesmas de
--    20260924180000_governance_notices_partners_account_manager.sql.
--
-- 2. save_my_whatsapp (a partir de 20261003180000_verificar_whatsapp_perfil.sql):
--    não responde mais "Este WhatsApp já está em outra conta" (23505). Qualquer
--    conta logada usava a resposta para descobrir, sem limite, se um número tem
--    conta. O número é gravado como NÃO verificado, sem revelar nada; o índice
--    único profiles_whatsapp_e164_verified_unique vale só entre números
--    confirmados, então não há conflito. A recusa continua na confirmação por
--    código (auth-otp → apply_verified_whatsapp → phone_in_use), que exige ter
--    o celular e tem limite de envios.
--
-- 3. purge_auth_otp_challenges (só service_role): apaga desafios de código
--    vencidos ou consumidos criados há mais de 7 dias. Chamada pelo
--    whatsapp-dispatch (cron do host) uma vez por hora. Os limites de envio
--    olham no máximo 1 hora para trás e os tokens de cadastro exigem desafio
--    não vencido (10 minutos), então nada em uso é apagado.
--
-- Nenhuma tela depende desta migration.

-- ---------------------------------------------------------------------------
-- 1. validate_shop_ownership
-- ---------------------------------------------------------------------------

create or replace function public.validate_shop_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target uuid; total numeric; leaders int;
begin
  target := coalesce(new.barbershop_id, old.barbershop_id);

  -- Barbearia apagada (sócios removidos em cascata): nada a conferir.
  if not exists (select 1 from public.barbershops b where b.id = target) then
    return null;
  end if;

  select coalesce(sum(ownership_percent), 0),
         count(*) filter (where role in ('owner', 'partner'))
    into total, leaders
  from public.shop_members
  where barbershop_id = target and active and role in ('owner', 'partner');
  if leaders = 0 then
    raise exception 'A loja precisa de ao menos um dono ativo' using errcode = '23514';
  end if;
  if total <> 100 then
    raise exception 'Active ownership must total 100%% (current: %)', total using errcode = '23514';
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. save_my_whatsapp sem revelar números de outras contas
-- ---------------------------------------------------------------------------

create or replace function public.save_my_whatsapp(p_raw text, p_opt_in boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  current_number text;
  result public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  normalized := public.normalize_br_whatsapp(p_raw);
  if p_opt_in and normalized is null then
    raise exception 'Informe um WhatsApp válido com DDD' using errcode = '22023';
  end if;

  select p.whatsapp_e164 into current_number
  from public.profiles p
  where p.id = auth.uid();

  -- Sem conferir outras contas: responder "já está em outra conta" aqui
  -- revelaria quem tem conta. Número novo fica NÃO verificado; a recusa de
  -- número confirmado em outra conta acontece só na confirmação por código.
  update public.profiles
  set
    whatsapp_e164 = normalized,
    -- Mesmo número: mantém a verificação. Número novo ou vazio: sem verificação
    -- (o gatilho profiles_whatsapp_verified_guard garante o mesmo).
    whatsapp_verified_at = case
      when normalized is not null and normalized is not distinct from current_number
        then whatsapp_verified_at
      else null
    end,
    whatsapp_opt_in_at = case when p_opt_in then coalesce(whatsapp_opt_in_at, now()) else null end,
    updated_at = now()
  where id = auth.uid()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.save_my_whatsapp(text, boolean) from public, anon;
grant execute on function public.save_my_whatsapp(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Limpeza dos desafios de código antigos
-- ---------------------------------------------------------------------------

create index if not exists auth_otp_challenges_created_idx
  on public.auth_otp_challenges (created_at);

create or replace function public.purge_auth_otp_challenges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.auth_otp_challenges c
  where c.created_at < now() - interval '7 days'
    and (c.consumed_at is not null or c.expires_at < now());
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_auth_otp_challenges() from public, anon, authenticated;
grant execute on function public.purge_auth_otp_challenges() to service_role;

-- ---------------------------------------------------------------------------
-- enqueue_whatsapp_message (versão de 20260924180000): não envia a um número que
-- está CONFIRMADO em outra conta. Com save_my_whatsapp aceitando qualquer número sem
-- revelar nada, uma conta poderia gravar (sem código) o WhatsApp confirmado de outra
-- pessoa e fazer os próprios avisos chegarem a ela. O destinatário vem do pacote
-- (customer_id, ou o cliente da reserva em appointment_id); sem destinatário conhecido,
-- nada muda. Números sem dono confirmado continuam recebendo como antes.
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

  if recipient is not null and p_to_e164 is not null and exists (
    select 1 from public.profiles p
    where p.whatsapp_e164 = p_to_e164
      and p.whatsapp_verified_at is not null
      and p.id <> recipient
  ) then
    return null;
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
