-- Cadastro: nome, WhatsApp e aceite dos documentos legais.
--
-- 1. public.profiles ganha o registro do aceite: terms_version, privacy_version,
--    dpa_version, terms_accepted_at, age_confirmed_at (todas null por padrão).
--    O usuário NÃO altera essas colunas direto: o UPDATE direto em profiles
--    continua liberado só para full_name, avatar_url e updated_at
--    (20261003150000_correcoes_auditoria.sql). O aceite passa por
--    record_my_terms_acceptance (usuário) ou pelo service role (register-shop).
-- 2. handle_new_user (a partir de 20261003150000_correcoes_auditoria.sql) passa a:
--    - usar full_name (ou name, do Google) dos metadados como nome, com o começo
--      do e-mail só como último recurso;
--    - gravar o aceite (versões, data, idade) quando vier nos metadados;
--    - gravar whatsapp/whatsapp_opt_in dos metadados como número NÃO verificado
--      (whatsapp_verified_at null; o gatilho profiles_whatsapp_verified_guard de
--      20261003180000_verificar_whatsapp_perfil.sql garante o mesmo). Número já
--      confirmado em outra conta é ignorado, como em save_my_whatsapp.
--    Nada disso pode impedir a criação da conta: dado inválido é ignorado.
-- 3. record_my_terms_acceptance: grava o aceite da conta logada.
--
-- Nome de exibição: não há função nova. O usuário já muda o próprio nome por
-- UPDATE direto em profiles.full_name (coluna liberada em
-- 20261003150000_correcoes_auditoria.sql; usado em CustomerProfile.tsx).
--
-- Depende de: 20261003150000_correcoes_auditoria.sql (handle_new_user, grants
-- de colunas) e 20261003180000_verificar_whatsapp_perfil.sql (whatsapp_verified_at).

-- ---------------------------------------------------------------------------
-- 1. Colunas do aceite
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists privacy_version text,
  add column if not exists dpa_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists age_confirmed_at timestamptz;

comment on column public.profiles.terms_version is
  'Versão dos Termos de Uso aceita (src/features/legal/versions.ts).';
comment on column public.profiles.privacy_version is
  'Versão da Política de Privacidade aceita.';
comment on column public.profiles.dpa_version is
  'Versão do Acordo de Dados aceita pelo dono de barbearia (null para clientes).';
comment on column public.profiles.terms_accepted_at is
  'Quando a versão atual dos documentos foi aceita.';
comment on column public.profiles.age_confirmed_at is
  'Quando a pessoa declarou ter a idade mínima exigida.';

-- Reafirma a proteção: UPDATE direto só em nome, foto e updated_at.
revoke update on table public.profiles from anon, authenticated;
grant update (full_name, avatar_url, updated_at) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Versão de documento aceita (texto curto, sem espaço)
-- ---------------------------------------------------------------------------

create or replace function public.legal_version_clean(p_raw text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when btrim(coalesce(p_raw, '')) ~ '^[0-9A-Za-z._-]{1,32}$' then btrim(p_raw)
    else null
  end
$$;

revoke all on function public.legal_version_clean(text) from public, anon;
grant execute on function public.legal_version_clean(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. handle_new_user (a partir de 20261003150000_correcoes_auditoria.sql)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_shop_id uuid;
  shop_ref text;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
  v_terms text;
  v_privacy text;
  v_dpa text;
  v_accepted_at timestamptz;
  v_age_at timestamptz;
  v_whatsapp text;
  v_opt_in boolean := false;
begin
  -- Nome escolhido no cadastro (ou o do Google); o começo do e-mail é o último recurso.
  -- full_name em branco cai para name; quebras de linha e tabs viram espaço.
  v_name := left(nullif(btrim(regexp_replace(coalesce(
    nullif(btrim(meta ->> 'full_name'), ''),
    meta ->> 'name',
    ''
  ), '[[:cntrl:]]+', ' ', 'g')), ''), 80);

  insert into public.profiles (id, full_name)
  values (new.id, coalesce(v_name, split_part(new.email, '@', 1)));

  -- Dos metadados (controlados pelo usuário) só saem nome, versões, datas, idade e
  -- WhatsApp NÃO verificado: nada de papel, loja da equipe ou verificação.
  -- Aceite: dado estranho é ignorado; a conta nasce de qualquer jeito.
  begin
    v_terms := public.legal_version_clean(meta ->> 'terms_version');
    v_privacy := public.legal_version_clean(meta ->> 'privacy_version');
    v_dpa := public.legal_version_clean(meta ->> 'dpa_version');

    if v_terms is not null or v_privacy is not null then
      -- Data enviada pelo app só vale se for plausível (até 1 dia antes, nunca no futuro).
      begin
        v_accepted_at := nullif(btrim(coalesce(meta ->> 'terms_accepted_at', '')), '')::timestamptz;
      exception when others then
        v_accepted_at := null;
      end;
      if v_accepted_at is null
        or v_accepted_at > now()
        or v_accepted_at < now() - interval '1 day' then
        v_accepted_at := now();
      end if;
    end if;

    if lower(coalesce(meta ->> 'age_confirmed', '')) = 'true' then
      v_age_at := coalesce(v_accepted_at, now());
    end if;

    if v_terms is not null or v_privacy is not null or v_age_at is not null then
      update public.profiles
         set terms_version = v_terms,
             privacy_version = v_privacy,
             dpa_version = v_dpa,
             terms_accepted_at = v_accepted_at,
             age_confirmed_at = v_age_at
       where id = new.id;
    end if;
  exception when others then
    raise warning 'handle_new_user: aceite ignorado para %: %', new.id, sqlerrm;
  end;

  -- WhatsApp do cadastro: sempre NÃO verificado (a confirmação é por código).
  -- Bloco separado: um número problemático não desfaz o aceite gravado acima.
  begin
    -- O app manda só dígitos com DDI (ex.: 5511999990000, 351912345678). Sem o sinal +,
    -- normalize_br_whatsapp só reconhece o 55; com 12 a 15 dígitos, o + vale para todos.
    v_whatsapp := public.normalize_br_whatsapp(
      case
        when btrim(coalesce(meta ->> 'whatsapp', '')) ~ '^[0-9]{12,15}$'
          then '+' || btrim(meta ->> 'whatsapp')
        else meta ->> 'whatsapp'
      end
    );
    v_opt_in := lower(coalesce(meta ->> 'whatsapp_opt_in', '')) = 'true';

    -- Número confirmado em outra conta não é copiado (mesma regra de save_my_whatsapp).
    if v_whatsapp is not null and not exists (
      select 1 from public.profiles p
      where p.whatsapp_e164 = v_whatsapp
        and p.whatsapp_verified_at is not null
        and p.id <> new.id
    ) then
      update public.profiles
         set whatsapp_e164 = v_whatsapp,
             whatsapp_verified_at = null,
             whatsapp_opt_in_at = case when v_opt_in then now() else null end
       where id = new.id;
    end if;
  exception when others then
    raise warning 'handle_new_user: WhatsApp ignorado para %: %', new.id, sqlerrm;
  end;

  shop_ref := nullif(btrim(coalesce(
    meta ->> 'shop',
    meta ->> 'shop_slug',
    ''
  )), '');

  -- Sem loja nos metadados = sem vínculo (dono novo, convidado da equipe, login sem loja).
  -- O cliente entra na loja pelo link dela (join_shop_as_customer).
  if shop_ref is not null then
    target_shop_id := public.resolve_shop_by_slug(shop_ref);
  end if;

  if target_shop_id is not null then
    insert into public.memberships (user_id, barbershop_id, role)
    select new.id, target_shop_id, 'customer'
    where not exists (
      select 1 from public.memberships m
      where m.user_id = new.id
        and m.barbershop_id = target_shop_id
        and m.role = 'customer'
    );

    insert into public.loyalty_accounts (user_id, barbershop_id, points)
    values (new.id, target_shop_id, 0)
    on conflict (user_id, barbershop_id) do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. record_my_terms_acceptance: aceite da conta logada
-- ---------------------------------------------------------------------------
--
-- Mesmas versões já gravadas: mantém a data do aceite (não "rejuvenesce" o
-- registro). Versão diferente: grava a versão informada e a data de agora.
-- p_dpa_version null mantém o acordo de dados já aceito (clientes não têm).
-- Idade: só marca quando confirmada; nunca apaga uma confirmação anterior.

create or replace function public.record_my_terms_acceptance(
  p_terms_version text,
  p_privacy_version text,
  p_dpa_version text default null,
  p_age_confirmed boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_terms text := public.legal_version_clean(p_terms_version);
  v_privacy text := public.legal_version_clean(p_privacy_version);
  v_dpa text := public.legal_version_clean(p_dpa_version);
  cur public.profiles%rowtype;
  same boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_terms is null or v_privacy is null then
    raise exception 'Versão dos documentos inválida' using errcode = '22023';
  end if;
  if p_dpa_version is not null and v_dpa is null then
    raise exception 'Versão do acordo de dados inválida' using errcode = '22023';
  end if;

  select * into cur from public.profiles where id = v_uid for update;
  if cur.id is null then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;

  same := cur.terms_accepted_at is not null
    and cur.terms_version is not distinct from v_terms
    and cur.privacy_version is not distinct from v_privacy
    and (v_dpa is null or cur.dpa_version is not distinct from v_dpa);

  update public.profiles
     set terms_version = v_terms,
         privacy_version = v_privacy,
         dpa_version = coalesce(v_dpa, dpa_version),
         terms_accepted_at = case when same then terms_accepted_at else now() end,
         age_confirmed_at = case
           when coalesce(p_age_confirmed, false) then coalesce(age_confirmed_at, now())
           else age_confirmed_at
         end,
         updated_at = now()
   where id = v_uid;
end;
$$;

revoke all on function public.record_my_terms_acceptance(text, text, text, boolean)
  from public, anon;
grant execute on function public.record_my_terms_acceptance(text, text, text, boolean)
  to authenticated;
