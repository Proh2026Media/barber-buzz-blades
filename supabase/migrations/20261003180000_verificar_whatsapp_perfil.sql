-- Verificação por código do WhatsApp gravado no perfil.
--
-- Problema: save_my_whatsapp gravava qualquer número. Alguém podia registrar o
-- WhatsApp de outra pessoa (que ainda não tem conta) e, com o índice único,
-- impedir o dono real de usá-lo — ou receber o login/recuperação por WhatsApp.
--
-- Regras novas:
--   1. profiles.whatsapp_verified_at marca o número confirmado por código
--      (auth-otp, purpose 'verify_phone', e register-shop, que confere o
--      código do cadastro) — sempre por apply_verified_whatsapp. Só o
--      service_role grava a coluna, e só quando a informa explicitamente:
--      número trocado sem informar a verificação fica NÃO verificado.
--   2. Números já gravados continuam valendo: recebem whatsapp_verified_at
--      nesta migration (exceto números repetidos entre contas, que ficam sem
--      verificação até o dono confirmar).
--   3. Login e recuperação por WhatsApp só acham contas com número verificado.
--   4. O índice único passa a valer só para números verificados: um número
--      não verificado não bloqueia o dono real; quando ele confirma o código,
--      as cópias não verificadas em outras contas são removidas.
--   5. save_my_whatsapp continua existindo (cadastro em /auth e liga/desliga
--      de avisos): mantém a verificação se o número não mudou; número novo
--      gravado por ela fica NÃO verificado.
--   6. apply_verified_whatsapp (só service_role) grava o número confirmado.
--   7. auth_otp_check_user_code (só service_role) confere o código de
--      verify_phone contando tentativas só nos desafios da própria conta.
--
-- Depende de: 20261003150000_correcoes_auditoria.sql (save_my_whatsapp mais
-- recente, índice profiles_whatsapp_e164_unique) e
-- 20261003160000_otp_tentativas.sql (auth_otp_check_code com tentativas).

-- ---------------------------------------------------------------------------
-- 1. Finalidade nova do desafio OTP
-- ---------------------------------------------------------------------------

-- ADD VALUE IF NOT EXISTS (PG ≥ 9.6) dispensa o bloco DO. O valor novo não é
-- usado como literal nesta migration (só por parâmetro, depois do commit).
alter type public.auth_otp_purpose add value if not exists 'verify_phone';

-- Limite de envios por conta (verify_phone grava user_id do solicitante).
create index if not exists auth_otp_challenges_user_purpose_idx
  on public.auth_otp_challenges (user_id, purpose, created_at desc)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Coluna de verificação + preenchimento dos números atuais
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists whatsapp_verified_at timestamptz;

-- Compatibilidade: números já gravados e sem repetição continuam valendo.
-- (Feito antes do gatilho abaixo, que ignoraria esta escrita.)
update public.profiles p
   set whatsapp_verified_at = coalesce(p.whatsapp_opt_in_at, p.updated_at, now())
 where p.whatsapp_e164 is not null
   and p.whatsapp_verified_at is null
   and not exists (
     select 1 from public.profiles o
     where o.whatsapp_e164 = p.whatsapp_e164
       and o.id <> p.id
   );

-- Índice único só entre números verificados.
drop index if exists public.profiles_whatsapp_e164_unique;
create unique index if not exists profiles_whatsapp_e164_verified_unique
  on public.profiles (whatsapp_e164)
  where whatsapp_e164 is not null and whatsapp_verified_at is not null;

create index if not exists profiles_whatsapp_e164_idx
  on public.profiles (whatsapp_e164)
  where whatsapp_e164 is not null;

-- ---------------------------------------------------------------------------
-- 3. Gatilho: só o servidor (service_role) marca número como verificado
-- ---------------------------------------------------------------------------

create or replace function public.profiles_whatsapp_verified_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  -- Mesma leitura do papel do JWT usada em mark_shop_domain_status. Fica dentro
  -- do gatilho (sem função auxiliar) para não depender de GRANT de quem atualiza.
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
  trusted boolean := jwt_role = 'service_role';
begin
  if tg_op = 'INSERT' then
    -- Servidor: vale só a verificação informada explicitamente no INSERT.
    if new.whatsapp_e164 is null or not trusted then
      new.whatsapp_verified_at := null;
    end if;
    return new;
  end if;

  if new.whatsapp_e164 is null then
    new.whatsapp_verified_at := null;
  elsif not trusted then
    -- Usuário (inclusive via funções security definer chamadas por ele):
    -- mantém a verificação só se o número não mudou.
    if new.whatsapp_e164 is distinct from old.whatsapp_e164 then
      new.whatsapp_verified_at := null;
    else
      new.whatsapp_verified_at := old.whatsapp_verified_at;
    end if;
  elsif new.whatsapp_e164 is distinct from old.whatsapp_e164
    and new.whatsapp_verified_at is not distinct from old.whatsapp_verified_at then
    -- Servidor trocou o número sem informar a verificação: NÃO conta como
    -- verificado (falha fechada). Quem confere código grava pela
    -- apply_verified_whatsapp, que informa whatsapp_verified_at.
    new.whatsapp_verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_whatsapp_verified_guard on public.profiles;
create trigger profiles_whatsapp_verified_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_whatsapp_verified_guard();

-- ---------------------------------------------------------------------------
-- 4. save_my_whatsapp (a partir de 20261003150000_correcoes_auditoria.sql)
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

  -- O login e a recuperação por WhatsApp acham a conta pelo número verificado:
  -- ele não pode estar confirmado em outra conta.
  if normalized is not null and exists (
    select 1 from public.profiles p
    where p.whatsapp_e164 = normalized
      and p.whatsapp_verified_at is not null
      and p.id <> auth.uid()
  ) then
    raise exception 'Este WhatsApp já está em outra conta' using errcode = '23505';
  end if;

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
-- 5. apply_verified_whatsapp: grava o número confirmado por código (auth-otp)
-- ---------------------------------------------------------------------------

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

revoke all on function public.apply_verified_whatsapp(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_verified_whatsapp(uuid, text, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. auth_otp_check_user_code: checagem de código restrita à conta (verify_phone)
-- ---------------------------------------------------------------------------
--
-- auth_otp_check_code (20261003160000) soma o erro em todos os desafios abertos
-- do número, de qualquer conta. Em verify_phone isso deixaria outra conta
-- logada esgotar as 5 tentativas do dono do número só mandando códigos errados.
-- Aqui a busca, o bloqueio e a contagem valem só para os desafios da conta.

create or replace function public.auth_otp_check_user_code(
  p_user_id uuid,
  p_destination text,
  p_purpose public.auth_otp_purpose,
  p_code_hash text,
  p_max_attempts integer default 5
)
returns table (challenge_id uuid, user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.auth_otp_challenges;
begin
  if p_user_id is null then
    return;
  end if;

  -- Tentativas em paralelo da mesma conta ficam em fila.
  perform 1
  from public.auth_otp_challenges c
  where c.user_id = p_user_id
    and c.barbershop_id is null
    and c.destination = p_destination
    and c.channel = 'whatsapp'
    and c.purpose = p_purpose
    and c.consumed_at is null
    and c.expires_at > now()
  for update;

  select * into v_match
  from public.auth_otp_challenges c
  where c.user_id = p_user_id
    and c.barbershop_id is null
    and c.destination = p_destination
    and c.channel = 'whatsapp'
    and c.purpose = p_purpose
    and c.consumed_at is null
    and c.expires_at > now()
    and c.attempts < p_max_attempts
    and c.code_hash = p_code_hash
  order by c.created_at desc
  limit 1;

  if v_match.id is not null then
    update public.auth_otp_challenges
       set consumed_at = now()
     where id = v_match.id;
    challenge_id := v_match.id;
    user_id := v_match.user_id;
    return next;
    return;
  end if;

  update public.auth_otp_challenges c
     set attempts = c.attempts + 1,
         consumed_at = case
           when c.attempts + 1 >= p_max_attempts then now()
           else c.consumed_at
         end
   where c.user_id = p_user_id
     and c.barbershop_id is null
     and c.destination = p_destination
     and c.channel = 'whatsapp'
     and c.purpose = p_purpose
     and c.consumed_at is null
     and c.expires_at > now();

  return;
end;
$$;

revoke all on function public.auth_otp_check_user_code(
  uuid, text, public.auth_otp_purpose, text, integer
) from public, anon, authenticated;
grant execute on function public.auth_otp_check_user_code(
  uuid, text, public.auth_otp_purpose, text, integer
) to service_role;
