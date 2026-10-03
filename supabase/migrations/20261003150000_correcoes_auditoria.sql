-- Correções da auditoria de 03/10/2026 (banco).
-- Cada função parte da definição mais recente nas migrations anteriores; CREATE OR REPLACE
-- preserva os GRANTs existentes, que são reafirmados no fim de cada bloco.
--
--  1. cancel_appointment / RLS: cliente não cancela reserva confirmada que já começou.
--  2. create_own_barbershop: liga a mudança aprovada antes de semear horários e equipe.
--  3. complete_shop_departure: liga a mudança aprovada (saída de contratado/sócio) e confere quem chama.
--     request_shop_departure: fim do "status is ambiguous" (variável com nome de coluna).
--  4. delete_my_account: liga a mudança aprovada antes de desvincular staff; cancela também
--     'reschedule_requested' futuros (achado 11).
--  5. mark_shop_domain_status / list_active_custom_domains: só service role (e admin da plataforma).
--  6. save_my_whatsapp: número único por conta; coluna fora do UPDATE direto.
--  7. stop_booking_series: profissional só para as próprias séries.
--  8. process_whatsapp_reminders: lembrete por e-mail independe do WhatsApp.
--  9/10. Ritmo (cliente, parceiro, perfil): dia e hora no fuso da loja.
-- 11. get_team_schedule: atendimentos de clientes que excluíram a conta continuam na agenda.
-- 12. handle_new_user: sem loja = sem vínculo (fim do último recurso 'arena-barber').
-- 13. appointments_enforce_service_terms: prazo e grade também na âncora da série e na remarcação.
-- 14. request_shop_change: origem do pedido decidida no servidor.

-- ---------------------------------------------------------------------------
-- 1. Cancelamento pelo cliente só antes do horário
-- ---------------------------------------------------------------------------

create or replace function public.cancel_appointment(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare a appointments; origin text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_reason is not null and p_reason not in ('unexpected','schedule','plans','price','transport','service','other') then raise exception 'Invalid reason'; end if;
  select * into a from appointments where id=p_id for update;
  if a.id is null or a.status not in ('pending','confirmed','reschedule_requested') then raise exception 'Appointment cannot be cancelled'; end if;
  if a.customer_id=auth.uid() then origin := 'customer';
  elsif is_platform_admin() or has_shop_role(a.barbershop_id,array['shop_admin']::app_role[]) then origin := 'shop';
  else raise exception 'Not allowed'; end if;
  -- Reserva confirmada cujo horário já começou fica para a loja registrar (concluído ou falta).
  -- Pendente e remarcação pedida pela loja seguem canceláveis, como na tela do cliente.
  if origin = 'customer' and a.status = 'confirmed' and a.starts_at <= now() then
    raise exception 'Appointment already started' using errcode = '22023',
      hint = 'O horário já passou; fale com a barbearia.';
  end if;
  update appointments set status='cancelled' where id=a.id;
  insert into appointment_cancellations(appointment_id,reason,source,recorded_by)
  values(a.id,p_reason,origin,auth.uid());
end $$;

revoke all on function public.cancel_appointment(uuid, text) from public, anon;
grant execute on function public.cancel_appointment(uuid, text) to authenticated;

-- Caminho direto (sem RPC): mesma regra de horário para o cliente.
drop policy if exists "Customers cancel own pending or confirmed" on public.appointments;
create policy "Customers cancel own pending or confirmed"
  on public.appointments for update
  to authenticated
  using (
    (
      customer_id = auth.uid()
      and (status = 'pending' or (status = 'confirmed' and starts_at > now()))
    )
    or public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  )
  with check (
    (
      customer_id = auth.uid()
      and status = 'cancelled'
    )
    or public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  );

-- ---------------------------------------------------------------------------
-- 2. Abrir a própria barbearia
-- ---------------------------------------------------------------------------

create or replace function public.create_own_barbershop(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  staffid uuid;
  sname text := nullif(trim(p_name), '');
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if sname is null then raise exception 'Informe o nome da barbearia' using errcode = '22023'; end if;

  -- A loja nasce aqui: horários semeados e o perfil do dono não passam pela governança
  -- (o vínculo de dono só existe ao fim desta função).
  perform set_config('app.approved_shop_change', 'on', true);

  insert into public.barbershops(name, status)
  values (sname, 'active')
  returning id into sid;

  insert into public.staff(barbershop_id, user_id, display_name, active)
  values (
    sid,
    auth.uid(),
    coalesce((select full_name from public.profiles where id = auth.uid()), sname),
    true
  )
  returning id into staffid;

  insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent, active)
  values (sid, auth.uid(), staffid, 'owner', 100, true);

  insert into public.memberships(user_id, barbershop_id, role)
  select auth.uid(), sid, 'shop_admin'
  where not exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.barbershop_id = sid and m.role = 'shop_admin'
  );

  return jsonb_build_object(
    'shop_id', sid,
    'shop_slug', (select slug from public.barbershops where id = sid),
    'staff_id', staffid
  );
end;
$$;

revoke all on function public.create_own_barbershop(text) from public, anon;
grant execute on function public.create_own_barbershop(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Saída da barbearia (versão de 20261002110000 + mudança aprovada + quem chama)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_shop_departure(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  req public.shop_departure_requests;
  origin_slug text;
  old_booking_slug text;
  dest_staff_id uuid;
  cust uuid;
  origin_points int;
  origin_lifetime int;
  red public.loyalty_redemptions;
begin
  select * into req from public.shop_departure_requests where id = p_request_id for update;
  if req.id is null then raise exception 'Pedido não encontrado' using errcode = 'P0002'; end if;
  if req.status = 'completed' then return; end if;
  if req.status not in ('approved', 'pending_release') then
    raise exception 'Pedido não está aprovado' using errcode = '22023';
  end if;
  if req.status = 'pending_release' then
    raise exception 'Aguarde a liberação do sócio' using errcode = '42501';
  end if;
  -- Só o próprio profissional, quem liberou a carteira, o admin da plataforma ou o servidor.
  if auth.uid() is not null
     and auth.uid() is distinct from req.user_id
     and auth.uid() is distinct from req.release_approved_by
     and not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- Pedido aprovado: desativar o vínculo e o perfil (e criar o do destino) não passa de novo
  -- pela governança, que recusaria o próprio profissional assim que o vínculo é desativado.
  perform set_config('app.approved_shop_change', 'on', true);

  select slug into origin_slug from public.barbershops where id = req.barbershop_id;
  select booking_slug into old_booking_slug from public.staff where id = req.staff_id;

  if req.mode = 'take' then
    if req.dest_shop_id is null then
      raise exception 'Destino obrigatório' using errcode = '22023';
    end if;

    for cust in select * from public.portfolio_customer_ids(req.barbershop_id, req.staff_id) loop
      delete from public.memberships
      where user_id = cust
        and barbershop_id = req.barbershop_id
        and role = 'customer';
      insert into public.memberships (user_id, barbershop_id, role)
      select cust, req.dest_shop_id, 'customer'
      where not exists (
        select 1 from public.memberships m
        where m.user_id = cust
          and m.barbershop_id = req.dest_shop_id
          and m.role = 'customer'
      );

      -- devolve resgates pendentes na origem antes de mover a carteira
      for red in
        select * from public.loyalty_redemptions
        where user_id = cust and barbershop_id = req.barbershop_id and status = 'pending'
        for update
      loop
        update public.loyalty_redemptions
          set status = 'cancelled', resolved_at = now()
          where id = red.id;
        insert into public.loyalty_ledger (user_id, barbershop_id, delta, reason, redemption_id, note)
        values (cust, req.barbershop_id, red.cost_points, 'reward_refunded', red.id, 'shop_departure');
        update public.loyalty_accounts
          set points = points + red.cost_points, updated_at = now()
          where user_id = cust and barbershop_id = req.barbershop_id;
      end loop;

      -- mover/mesclar saldo e total da vida da loja origem → destino
      origin_points := null;
      origin_lifetime := null;
      select points, lifetime_points into origin_points, origin_lifetime
      from public.loyalty_accounts
      where user_id = cust and barbershop_id = req.barbershop_id;

      if coalesce(origin_points, 0) > 0 or coalesce(origin_lifetime, 0) > 0 then
        insert into public.loyalty_accounts (user_id, barbershop_id, points, lifetime_points)
        values (cust, req.dest_shop_id, coalesce(origin_points, 0), coalesce(origin_lifetime, 0))
        on conflict (user_id, barbershop_id) do update
          set points = public.loyalty_accounts.points + excluded.points,
              lifetime_points = public.loyalty_accounts.lifetime_points + excluded.lifetime_points,
              updated_at = now();

        update public.loyalty_ledger l
        set barbershop_id = req.dest_shop_id
        where l.user_id = cust
          and l.barbershop_id = req.barbershop_id
          and not (
            l.reason = 'welcome_bonus'
            and exists (
              select 1 from public.loyalty_ledger d
              where d.user_id = cust and d.barbershop_id = req.dest_shop_id
                and d.reason = 'welcome_bonus'
            )
          );
      end if;

      delete from public.loyalty_accounts
      where user_id = cust and barbershop_id = req.barbershop_id;
    end loop;

    select sm.staff_id into dest_staff_id
    from public.shop_members sm
    where sm.barbershop_id = req.dest_shop_id and sm.user_id = req.user_id and sm.active
    limit 1;

    if dest_staff_id is null then
      insert into public.staff (barbershop_id, user_id, display_name, active)
      select req.dest_shop_id, req.user_id, s.display_name, true
      from public.staff s where s.id = req.staff_id
      returning id into dest_staff_id;

      update public.shop_members
      set staff_id = dest_staff_id
      where barbershop_id = req.dest_shop_id and user_id = req.user_id and active;
    end if;

    if old_booking_slug is not null then
      update public.staff_slug_redirects
      set
        staff_id = dest_staff_id,
        owner_user_id = req.user_id,
        locked = true,
        deleted_at = null
      where from_shop_slug = origin_slug
        and from_booking_slug = old_booking_slug;

      insert into public.staff_slug_redirects (
        from_shop_slug, from_booking_slug, staff_id, owner_user_id, locked
      )
      select origin_slug, old_booking_slug, dest_staff_id, req.user_id, true
      where not exists (
        select 1 from public.staff_slug_redirects r
        where r.from_shop_slug = origin_slug
          and r.from_booking_slug = old_booking_slug
          and r.deleted_at is null
      );
    end if;

    update public.staff_slug_redirects
    set locked = true, staff_id = dest_staff_id, deleted_at = null
    where owner_user_id = req.user_id
      and from_shop_slug = origin_slug
      and deleted_at is null;
  else
    update public.staff_slug_redirects
    set deleted_at = now()
    where from_shop_slug = origin_slug
      and owner_user_id = req.user_id
      and locked = false
      and deleted_at is null;
  end if;

  update public.shop_members
  set active = false
  where barbershop_id = req.barbershop_id and user_id = req.user_id;

  update public.staff
  set active = false
  where id = req.staff_id;

  delete from public.memberships
  where user_id = req.user_id
    and barbershop_id = req.barbershop_id
    and role = 'shop_admin';

  update public.shop_departure_requests
  set status = 'completed', completed_at = now()
  where id = req.id;
end;
$function$;

revoke all on function public.complete_shop_departure(uuid) from public, anon;
grant execute on function public.complete_shop_departure(uuid) to authenticated;

-- request_shop_departure (versão de 20260922140000): a variável local "status" tinha o
-- mesmo nome da coluna, e o WHERE do UPDATE dava "column reference status is ambiguous"
-- em qualquer modo. Variável renomeada e colunas qualificadas; regra inalterada.
create or replace function public.request_shop_departure(
  p_shop_id uuid,
  p_mode public.shop_departure_mode,
  p_dest_shop_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.shop_members;
  staff_row public.staff;
  other_socios int;
  request_id uuid;
  v_status public.shop_departure_status;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;

  select * into member
  from public.shop_members sm
  where sm.barbershop_id = p_shop_id and sm.user_id = auth.uid() and sm.active
  limit 1;
  if member.id is null or member.staff_id is null then
    raise exception 'Você não está vinculado a esta barbearia' using errcode = '42501';
  end if;

  select * into staff_row from public.staff s where s.id = member.staff_id;
  if staff_row.id is null then raise exception 'Profissional não encontrado' using errcode = 'P0002'; end if;

  if p_mode = 'take' then
    if p_dest_shop_id is null then
      raise exception 'Informe a barbearia de destino para levar a carteira' using errcode = '22023';
    end if;
    if p_dest_shop_id = p_shop_id then
      raise exception 'Destino deve ser outra barbearia' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.barbershops b where b.id = p_dest_shop_id and b.status = 'active'
    ) then
      raise exception 'Barbearia de destino indisponível' using errcode = 'P0002';
    end if;
    -- destino: já é membro ativo OU será dono (criou loja) — exige vínculo prévio
    if not exists (
      select 1 from public.shop_members sm
      where sm.barbershop_id = p_dest_shop_id and sm.user_id = auth.uid() and sm.active
    ) and not public.is_platform_admin() then
      raise exception 'Aceite o convite ou crie a nova barbearia antes de levar a carteira' using errcode = '42501';
    end if;
  end if;

  -- cancela pedidos pendentes anteriores do mesmo usuário/loja
  update public.shop_departure_requests r
  set status = 'cancelled', decided_at = now()
  where r.barbershop_id = p_shop_id
    and r.user_id = auth.uid()
    and r.status in ('pending_release', 'approved');

  select count(*) into other_socios
  from public.shop_members sm
  where sm.barbershop_id = p_shop_id
    and sm.active
    and sm.role in ('owner', 'partner')
    and sm.user_id <> auth.uid();

  if p_mode = 'take' and member.role in ('owner', 'partner') then
    if other_socios = 0 then
      raise exception 'Sócio único: transfira a propriedade ou abra mão da carteira' using errcode = '42501';
    end if;
    v_status := 'pending_release';
  else
    v_status := 'approved';
  end if;

  insert into public.shop_departure_requests (
    barbershop_id, user_id, staff_id, mode, dest_shop_id, status
  )
  values (
    p_shop_id, auth.uid(), member.staff_id, p_mode, p_dest_shop_id, v_status
  )
  returning id into request_id;

  if v_status = 'approved' then
    perform public.complete_shop_departure(request_id);
    return jsonb_build_object('status', 'completed', 'request_id', request_id);
  end if;

  return jsonb_build_object('status', 'pending_release', 'request_id', request_id);
end;
$$;

revoke all on function public.request_shop_departure(uuid, public.shop_departure_mode, uuid) from public, anon;
grant execute on function public.request_shop_departure(uuid, public.shop_departure_mode, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4 e 11. Exclusão da própria conta
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  ownership_count int;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 13));

  -- Dono/sócio não pode apagar a conta enquanto mantém participação (quebra a sociedade).
  select count(*) into ownership_count
  from public.shop_members
  where user_id = uid
    and active
    and role in ('owner', 'partner');

  if ownership_count > 0 then
    raise exception
      'Antes de excluir a conta, transfira a sociedade ou saia da barbearia como dono/sócio.'
      using errcode = 'P0001';
  end if;

  -- Cancelar horários futuros ainda ativos (inclui os que aguardam remarcação).
  update public.appointments
  set
    status = 'cancelled',
    updated_at = now()
  where customer_id = uid
    and status in ('pending', 'confirmed', 'reschedule_requested')
    and starts_at > now();

  -- Desvincular histórico e frequência (mantém o fato, remove o vínculo pessoal).
  update public.appointments
  set customer_id = null, updated_at = now()
  where customer_id = uid;

  update public.customer_usage_events
  set user_id = null
  where user_id = uid;

  -- Equipe contratada: desativa vínculo sem apagar o histórico operacional da loja.
  -- Exclusão pedida pelo titular: a governança não barra o desvínculo do próprio perfil.
  perform set_config('app.approved_shop_change', 'on', true);

  update public.shop_members
  set active = false, updated_at = now()
  where user_id = uid and active;

  update public.staff
  set user_id = null, updated_at = now()
  where user_id = uid;

  -- Pedidos de exclusão legados.
  update public.privacy_requests
  set status = 'cancelled', updated_at = now()
  where user_id = uid and status in ('requested', 'reviewing');

  -- Remove a identidade Auth (cascata apaga perfil, fidelidade, pesquisas, Google, etc.).
  delete from auth.users where id = uid;

  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true, 'deleted_at', now());
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Domínio próprio: status e lista só pelo servidor
-- ---------------------------------------------------------------------------

create or replace function public.mark_shop_domain_status(
  p_shop_id uuid,
  p_status public.shop_domain_status,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.barbershops;
  base text := public.app_platform_base_host();
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
begin
  -- Só a função de borda (service role, depois de conferir o DNS) ou o admin da plataforma.
  -- Dono/sócio não grava o status direto: 'active' sem verificação derrubaria a regra.
  if auth.uid() is null then
    if jwt_role in ('anon', 'authenticated') then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  elsif not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.barbershops set
    custom_domain_status = p_status,
    domain_verified_at = case when p_status = 'active' then now() else domain_verified_at end,
    domain_last_error = nullif(trim(coalesce(p_error, '')), ''),
    updated_at = now()
  where id = p_shop_id
    and custom_domain is not null
  returning * into row;

  if row.id is null then
    raise exception 'Shop/domain not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'shop_id', row.id,
    'shop_slug', row.slug,
    'platform_base_host', base,
    'platform_subdomain', row.slug || '.' || base,
    'custom_domain', row.custom_domain,
    'custom_domain_status', row.custom_domain_status,
    'domain_verify_token', row.domain_verify_token,
    'domain_verified_at', row.domain_verified_at,
    'domain_last_error', row.domain_last_error
  );
end;
$$;

create or replace function public.list_active_custom_domains()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
begin
  -- Service role (sync Traefik / cron) ou admin da plataforma.
  if auth.uid() is null then
    if jwt_role in ('anon', 'authenticated') then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  elsif not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'shop_id', b.id,
      'shop_slug', b.slug,
      'custom_domain', b.custom_domain,
      'status', b.custom_domain_status,
      'verify_token', b.domain_verify_token
    ) order by b.custom_domain)
    from public.barbershops b
    where b.custom_domain is not null
      and b.status = 'active'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.mark_shop_domain_status(uuid, public.shop_domain_status, text)
  from public, anon, authenticated;
revoke all on function public.list_active_custom_domains() from public, anon, authenticated;
grant execute on function public.mark_shop_domain_status(uuid, public.shop_domain_status, text)
  to service_role;
grant execute on function public.list_active_custom_domains() to service_role;

-- ---------------------------------------------------------------------------
-- 6. WhatsApp do perfil: um número por conta e gravação só pela RPC
-- ---------------------------------------------------------------------------

create or replace function public.save_my_whatsapp(p_raw text, p_opt_in boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  result public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  normalized := public.normalize_br_whatsapp(p_raw);
  if p_opt_in and normalized is null then
    raise exception 'Informe um WhatsApp válido com DDD' using errcode = '22023';
  end if;

  -- O login e a recuperação por WhatsApp acham a conta pelo número: ele não pode repetir.
  if normalized is not null and exists (
    select 1 from public.profiles p
    where p.whatsapp_e164 = normalized and p.id <> auth.uid()
  ) then
    raise exception 'Este WhatsApp já está em outra conta' using errcode = '23505';
  end if;

  update public.profiles
  set
    whatsapp_e164 = normalized,
    whatsapp_opt_in_at = case when p_opt_in then coalesce(whatsapp_opt_in_at, now()) else null end,
    updated_at = now()
  where id = auth.uid()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.save_my_whatsapp(text, boolean) from public, anon;
grant execute on function public.save_my_whatsapp(text, boolean) to authenticated;

-- Índice único parcial: criado só se a base não tiver duplicados (não apaga número de ninguém).
do $$
begin
  if exists (
    select 1 from public.profiles
    where whatsapp_e164 is not null
    group by whatsapp_e164
    having count(*) > 1
  ) then
    raise notice 'profiles_whatsapp_e164_unique não criado: há números repetidos para revisar';
  else
    create unique index if not exists profiles_whatsapp_e164_unique
      on public.profiles (whatsapp_e164)
      where whatsapp_e164 is not null;
  end if;
end $$;

-- UPDATE direto no perfil só para nome e foto; WhatsApp passa por save_my_whatsapp.
revoke update on table public.profiles from anon, authenticated;
grant update (full_name, avatar_url, updated_at) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Parar recorrência
-- ---------------------------------------------------------------------------

create or replace function public.stop_booking_series(p_series_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  series public.booking_series%rowtype;
  shop_tz text;
begin
  select * into series from public.booking_series where id = p_series_id;
  if series.id is null then return; end if;
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  -- Cliente dono, admin, quem vê a loja inteira ou o profissional da própria série.
  if series.customer_id is distinct from auth.uid()
     and not public.is_platform_admin()
     and not public.can_view_full_shop(series.barbershop_id)
     and public.current_staff_id(series.barbershop_id) is distinct from series.staff_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.booking_series set active = false where id = series.id;
  select timezone into shop_tz from public.barbershops where id = series.barbershop_id;

  update public.appointments a
  set status = 'cancelled'
  where a.series_id = series.id
    and a.status in ('pending', 'confirmed')
    and a.starts_at > now();

  insert into public.booking_series_exceptions (series_id, scheduled_date, reason)
  select series.id, (a.starts_at at time zone coalesce(shop_tz, 'America/Sao_Paulo'))::date, 'series_stopped'
  from public.appointments a
  where a.series_id = series.id and a.status = 'cancelled' and a.starts_at > now() - interval '1 minute'
  on conflict (series_id, scheduled_date) do update set reason = excluded.reason;
end;
$$;

revoke all on function public.stop_booking_series(uuid) from public, anon;
grant execute on function public.stop_booking_series(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Lembretes: e-mail independe do WhatsApp
-- ---------------------------------------------------------------------------
-- queue_appointment_whatsapp enfileira o e-mail (se houver) e só depois decide o WhatsApp;
-- enqueue_whatsapp_message continua exigindo canal ligado, aberto e com lembrete ativo.
-- Sem canal, a antecedência padrão é 24 h. Loja que desligou o lembrete no canal fica sem lembrete.

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

revoke all on function public.process_whatsapp_reminders() from public, anon, authenticated;
grant execute on function public.process_whatsapp_reminders() to service_role;

-- ---------------------------------------------------------------------------
-- 9 e 10. Ritmo no fuso da barbearia
-- ---------------------------------------------------------------------------

/** Mediana dos dias entre atendimentos concluídos consecutivos do cliente atual. */
create or replace function public.get_customer_rhythm(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; sample int; tz text;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  tz := public.shop_tz(p_shop_id);

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
      extract(dow from (a.starts_at at time zone tz)) as dow,
      extract(hour from (a.starts_at at time zone tz)) as hour,
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

grant execute on function public.get_customer_rhythm(uuid), public.get_partner_rhythm(uuid)
  to authenticated;
grant execute on function public.get_client_profile(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Agenda da equipe com atendimentos de contas excluídas
-- ---------------------------------------------------------------------------

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

revoke all on function public.get_team_schedule(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_team_schedule(uuid, timestamptz, timestamptz) to authenticated;

-- Reservas sem cliente que aguardavam remarcação não têm mais quem remarque: libera o horário.
update public.appointments
set status = 'cancelled', updated_at = now()
where customer_id is null
  and status = 'reschedule_requested'
  and starts_at > now();

-- ---------------------------------------------------------------------------
-- 12. Cadastro sem loja não vira cliente da Arena Barber
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
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );

  shop_ref := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'shop',
    new.raw_user_meta_data ->> 'shop_slug',
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

-- Limpeza conservadora dos vínculos indevidos já criados: só quem é da equipe de OUTRA loja,
-- não é da equipe da Arena e nunca usou a Arena (sem reservas, sem movimento de pontos, saldo zero).
do $$
declare
  arena uuid;
begin
  select id into arena from public.barbershops where slug = 'arena-barber' limit 1;
  if arena is null then return; end if;

  with removidos as (
    delete from public.memberships m
    where m.barbershop_id = arena
      and m.role = 'customer'
      and (
        exists (
          select 1 from public.shop_members sm
          where sm.user_id = m.user_id and sm.barbershop_id <> arena
        )
        or exists (
          select 1 from public.memberships m2
          where m2.user_id = m.user_id and m2.barbershop_id <> arena and m2.role = 'shop_admin'
        )
      )
      and not exists (
        select 1 from public.shop_members sm
        where sm.user_id = m.user_id and sm.barbershop_id = arena
      )
      and not exists (
        select 1 from public.memberships m3
        where m3.user_id = m.user_id and m3.barbershop_id = arena and m3.role <> 'customer'
      )
      and not exists (
        select 1 from public.appointments a
        where a.customer_id = m.user_id and a.barbershop_id = arena
      )
      and not exists (
        select 1 from public.loyalty_ledger l
        where l.user_id = m.user_id and l.barbershop_id = arena
      )
      and not exists (
        select 1 from public.loyalty_accounts la
        where la.user_id = m.user_id and la.barbershop_id = arena
          and (coalesce(la.points, 0) <> 0 or coalesce(la.lifetime_points, 0) <> 0)
      )
    returning m.user_id
  )
  delete from public.loyalty_accounts la
  using removidos r
  where la.user_id = r.user_id and la.barbershop_id = arena;
end $$;

-- ---------------------------------------------------------------------------
-- 13. Prazo e grade também para a âncora da série e a remarcação de ocorrência
-- ---------------------------------------------------------------------------

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
           new.staff_id, (new.starts_at at time zone tz)::date, terms.duration_minutes) c(g)
         where c.g = new.starts_at)
    then
      raise exception 'Esse horário não está entre os oferecidos pela barbearia. Escolha outro.'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Origem do pedido de mudança decidida no servidor
-- ---------------------------------------------------------------------------

create or replace function public.request_shop_change(
  p_shop_id uuid,
  p_kind text,
  p_payload jsonb,
  p_source text default 'society',
  p_ttl_minutes int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id uuid;
  mode text;
  ttl int;
  is_mgr boolean := false;
  checklist jsonb;
begin
  -- p_source fica na assinatura por compatibilidade, mas é ignorado: 'account_manager' só
  -- para o gerente de conta e 'majority_log' só no registro automático abaixo.
  is_mgr := public.is_account_manager_of(p_shop_id);
  if not public.has_shop_member_role(p_shop_id, array['owner','partner']::public.shop_member_role[])
     and not public.is_platform_admin()
     and not is_mgr then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  mode := public.shop_governance_mode(p_shop_id);
  checklist := coalesce(p_payload->'checklist', jsonb_build_array(
    jsonb_build_object('kind', p_kind, 'summary', coalesce(p_payload->>'summary', p_kind))
  ));

  -- Gerente de conta sempre cria pedido com TTL 30 min.
  if is_mgr and not public.is_platform_admin() then
    ttl := coalesce(p_ttl_minutes, 30);
    insert into public.shop_change_requests(
      barbershop_id, requested_by, kind, payload, source, expires_at, checklist
    ) values (
      p_shop_id, auth.uid(), p_kind, p_payload, 'account_manager',
      now() + make_interval(mins => ttl), checklist
    ) returning id into request_id;
    return jsonb_build_object(
      'status', 'pending',
      'request_id', request_id,
      'expires_at', now() + make_interval(mins => ttl)
    );
  end if;

  if public.can_apply_protected_change(p_shop_id) then
    perform public.apply_shop_change(p_shop_id, p_kind, p_payload);
    -- Log checklist para majoritário (auditoria / popup).
    insert into public.shop_change_requests(
      barbershop_id, requested_by, kind, payload, status, source, checklist,
      decided_at, applied_at, approved_by
    ) values (
      p_shop_id, auth.uid(), p_kind, p_payload, 'approved', 'majority_log', checklist,
      now(), now(), auth.uid()
    );
    return jsonb_build_object('status', 'applied');
  end if;

  -- Minoria (majority mode) e igualitário: abrem pedido pendente.
  if mode not in ('equal', 'majority') then
    raise exception 'Somente o sócio majoritário pode realizar esta mudança' using errcode='42501';
  end if;

  ttl := p_ttl_minutes; -- sociedade sem TTL por padrão
  insert into public.shop_change_requests(
    barbershop_id, requested_by, kind, payload, source, expires_at, checklist
  ) values (
    p_shop_id, auth.uid(), p_kind, p_payload, 'society',
    case when ttl is null then null else now() + make_interval(mins => ttl) end,
    checklist
  ) returning id into request_id;

  return jsonb_build_object('status', 'pending', 'request_id', request_id);
end;
$$;

revoke all on function public.request_shop_change(uuid, text, jsonb, text, integer) from public, anon;
grant execute on function public.request_shop_change(uuid, text, jsonb, text, integer) to authenticated;

notify pgrst, 'reload schema';
