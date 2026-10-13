-- Saída da equipe, reservas futuras de quem sai, reconvite e reativação (13/10/2026).
-- Achados dos testes reais na Loja Teste, com as decisões do dono do mesmo dia: P-59 a P-62.
-- Depende da 20261013180000_papeis_atuais_e_fuso.sql (shop_can_act_on_appointment).
--
-- P-61. Reservas futuras de quem sai: o dono resolve ANTES de liberar a saída. Enquanto o
--   profissional tiver reservas futuras ativas (pendente, confirmada ou aguardando remarcação),
--   nem a saída se conclui nem o vínculo de equipe é desativado — a regra vale no banco
--   (gatilho em `shop_members`), não só na tela. O dono passa cada reserva para outro
--   profissional livre (`reassign_appointment_staff`; o cliente recebe o aviso de remarcação que
--   já existe) ou cancela (`cancel_appointment`; o cliente recebe o aviso de cancelamento que
--   já existe). A saída "sem levar clientes" com reservas futuras fica aguardando o dono
--   (`pending_release`) e não pode ser recusada, só liberada depois de resolver as reservas.
--   Exceção: a exclusão da própria conta (`delete_my_account`) não é barrada; as reservas ficam
--   para o dono resolver pela lista de reservas de quem saiu.
-- P-62. Parceiro que sai levando os clientes passa a depender da liberação do dono (antes saía
--   na hora). O Contratado continua sem poder levar clientes (P-01). Dono/sócio continua
--   precisando da liberação de outro dono.
-- P-59. Convidar de novo quem já saiu reativa o vínculo antigo (com o papel novo) e a ficha de
--   profissional, em vez de falhar com "This account already belongs to the professional team".
--   Quem está ativo na equipe recebe a mensagem clara "Esta conta já está na equipe…".
-- P-60. Reativar um membro em Gerenciar reativa também a ficha de profissional (volta à agenda e
--   à página pública); desativar tira a ficha da agenda e apaga o vínculo antigo `shop_admin`.
--
-- Funções recriadas a partir da versão em produção em 13/10/2026 (pg_get_functiondef):
-- apply_add_shop_member, apply_update_shop_member, request_shop_departure,
-- complete_shop_departure, approve_portfolio_release, reject_portfolio_release e
-- list_shop_departure_requests.

-- ---------------------------------------------------------------------------
-- Reservas futuras de um profissional
-- ---------------------------------------------------------------------------

create or replace function public.staff_future_appointment_count(p_staff_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.appointments a
  where p_staff_id is not null
    and a.staff_id = p_staff_id
    and a.status in ('pending', 'confirmed', 'reschedule_requested')
    and a.starts_at > now()
$$;

-- Desativar alguém da equipe com reservas futuras é recusado (a própria pessoa excluindo a
-- conta passa; a saída pela loja confere antes, em complete_shop_departure).
create or replace function public.guard_member_exit_future_bookings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if old.active and not new.active and auth.uid() is distinct from old.user_id then
    v_count := public.staff_future_appointment_count(old.staff_id);
    if v_count > 0 then
      raise exception 'Ainda há % reserva(s) futura(s) com este profissional. Passe para outro profissional ou cancele antes de tirar da equipe.', v_count
        using errcode = 'P0001', hint = 'future_bookings';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists shop_members_exit_future_bookings on public.shop_members;
create trigger shop_members_exit_future_bookings
before update of active on public.shop_members
for each row execute function public.guard_member_exit_future_bookings();

-- Reservas futuras para o dono resolver. Com p_staff_id: as daquele profissional. Sem: as de
-- profissionais que já saíram da equipe ou estão fora da agenda (ficha inativa). Para cada
-- reserva, os colegas livres naquele horário que fazem o serviço.
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

-- Passa uma reserva futura para outro profissional livre (dono: visão geral da agenda). O
-- preço e a duração combinados continuam os mesmos; o cliente recebe o aviso de remarcação.
create or replace function public.reassign_appointment_staff(p_appointment_id uuid, p_staff_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.appointments;
  target public.staff;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into a from public.appointments where id = p_appointment_id for update;
  if a.id is null then raise exception 'Reserva não encontrada' using errcode = 'P0002'; end if;
  if not public.can_view_full_shop(a.barbershop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if a.status not in ('pending', 'confirmed') or a.starts_at <= now() then
    raise exception 'Só dá para passar reservas futuras ativas. Esta pode ser cancelada.' using errcode = '22023';
  end if;
  select * into target from public.staff where id = p_staff_id;
  if target.id is null or target.barbershop_id <> a.barbershop_id or not target.active then
    raise exception 'Escolha um profissional ativo desta barbearia.' using errcode = '22023';
  end if;
  if target.id = a.staff_id then
    raise exception 'A reserva já é deste profissional.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.staff_service_terms(target.id, a.service_id)) then
    raise exception 'Este profissional não faz o serviço desta reserva.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.appointments x
    where x.staff_id = target.id and x.id <> a.id
      and x.status in ('pending', 'confirmed', 'completed')
      and x.starts_at < a.ends_at and x.ends_at > a.starts_at
  ) or exists (
    select 1 from public.availability_blocks b
    where b.barbershop_id = a.barbershop_id
      and (b.staff_id is null or b.staff_id = target.id)
      and b.starts_at < a.ends_at and b.ends_at > a.starts_at
  ) then
    raise exception 'Este profissional não está livre nesse horário.' using errcode = '23P01';
  end if;

  update public.appointments set staff_id = target.id where id = a.id;
  return jsonb_build_object('status', 'reassigned', 'appointment_id', a.id, 'staff_id', target.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- P-59. Convite de quem já saiu reativa o vínculo
-- ---------------------------------------------------------------------------

create or replace function public.apply_add_shop_member(p_shop_id uuid, p_user_id uuid, p_role shop_member_role, p_ownership_percent numeric default null, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  staffid uuid;
  memberid uuid;
  owner_share numeric;
  owner_id uuid;
  effective_role public.shop_member_role := p_role;
  previous public.shop_members;
begin
  perform set_config('app.approved_shop_change', 'on', true);

  if effective_role = 'partner' then
    effective_role := 'owner';
  end if;

  select * into previous
  from public.shop_members
  where barbershop_id = p_shop_id and user_id = p_user_id
  for update;

  if previous.id is not null and previous.active then
    raise exception 'Esta conta já está na equipe desta barbearia.'
      using errcode = '23505', hint = 'already_member';
  end if;

  if effective_role = 'owner'
     and (p_ownership_percent is null or p_ownership_percent <= 0 or p_ownership_percent >= 100) then
    raise exception 'Co-owner ownership must be between 0 and 100' using errcode = '22023';
  end if;

  select id into staffid
  from public.staff
  where barbershop_id = p_shop_id and user_id = p_user_id;

  if staffid is null and previous.staff_id is not null
     and exists (select 1 from public.staff s where s.id = previous.staff_id and s.barbershop_id = p_shop_id) then
    staffid := previous.staff_id;
  end if;

  if staffid is null then
    insert into public.staff (barbershop_id, user_id, display_name, active)
    values (
      p_shop_id,
      p_user_id,
      coalesce(
        nullif(trim(p_display_name), ''),
        (select full_name from public.profiles where id = p_user_id),
        'Profissional'
      ),
      true
    )
    returning id into staffid;
  else
    update public.staff set active = true, updated_at = now()
    where id = staffid and not active;
  end if;

  if effective_role = 'owner' then
    select id, ownership_percent into owner_id, owner_share
    from public.shop_members
    where barbershop_id = p_shop_id and role = 'owner' and active
    order by ownership_percent desc nulls last
    limit 1
    for update;

    if owner_share is null or owner_share <= p_ownership_percent then
      raise exception 'The owner does not have enough participation to transfer' using errcode = '23514';
    end if;

    update public.shop_members
    set ownership_percent = ownership_percent - p_ownership_percent,
        updated_at = now()
    where id = owner_id;
  elsif p_ownership_percent is not null then
    raise exception 'Only co-owners receive ownership percentage' using errcode = '22023';
  end if;

  if previous.id is not null then
    -- Volta à equipe: o vínculo antigo é reativado com o papel do convite novo.
    update public.shop_members
    set role = effective_role,
        ownership_percent = case when effective_role = 'owner' then p_ownership_percent else null end,
        staff_id = staffid,
        active = true,
        updated_at = now()
    where id = previous.id
    returning id into memberid;
    return memberid;
  end if;

  insert into public.shop_members (
    barbershop_id, user_id, staff_id, role, ownership_percent, active
  ) values (
    p_shop_id,
    p_user_id,
    staffid,
    effective_role,
    case when effective_role = 'owner' then p_ownership_percent else null end,
    true
  )
  returning id into memberid;

  return memberid;
end;
$$;

-- ---------------------------------------------------------------------------
-- P-60. Ativar/desativar membro leva a ficha de profissional junto
-- ---------------------------------------------------------------------------

create or replace function public.apply_update_shop_member(p_shop_id uuid, p_member_id uuid, p_role shop_member_role default null, p_ownership_percent numeric default null, p_active boolean default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.shop_members;
  next_role public.shop_member_role;
  next_pct numeric;
  next_active boolean;
  founder uuid;
  donor_id uuid;
  donor_share numeric;
  delta numeric;
begin
  perform set_config('app.approved_shop_change', 'on', true);

  select * into row
  from public.shop_members
  where id = p_member_id and barbershop_id = p_shop_id
  for update;

  if row.id is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  select founded_by_user_id into founder from public.barbershops where id = p_shop_id;

  next_role := coalesce(p_role, row.role);
  if next_role = 'partner' then next_role := 'owner'; end if;
  next_active := coalesce(p_active, row.active);

  if founder is not null and row.user_id = founder then
    if next_role <> 'owner' then
      raise exception 'O fundador não pode ser rebaixado. Transfira a fundação antes.' using errcode = '42501';
    end if;
    if next_active is not true then
      raise exception 'O fundador não pode ser desativado. Transfira a fundação antes.' using errcode = '42501';
    end if;
  end if;

  if next_role in ('owner', 'partner') then
    next_pct := coalesce(p_ownership_percent, row.ownership_percent);
    if next_pct is null or next_pct <= 0 or next_pct > 100 then
      raise exception 'Ownership percent inválido' using errcode = '22023';
    end if;
  else
    next_pct := null;
  end if;

  -- Ajuste de %: diferença sai/entra do maior dono (exceto o próprio).
  if row.role in ('owner', 'partner') and next_role in ('owner', 'partner')
     and coalesce(row.ownership_percent, 0) is distinct from coalesce(next_pct, 0) then
    delta := coalesce(next_pct, 0) - coalesce(row.ownership_percent, 0);
    if delta <> 0 then
      select id, ownership_percent into donor_id, donor_share
      from public.shop_members
      where barbershop_id = p_shop_id
        and active
        and role in ('owner', 'partner')
        and id <> row.id
      order by ownership_percent desc nulls last
      limit 1
      for update;

      if donor_id is null then
        raise exception 'Não há outro dono para ajustar a participação' using errcode = '23514';
      end if;
      if delta > 0 and donor_share <= delta then
        raise exception 'Participação insuficiente para transferir' using errcode = '23514';
      end if;

      update public.shop_members
      set ownership_percent = ownership_percent - delta,
          updated_at = now()
      where id = donor_id;
    end if;
  elsif row.role not in ('owner', 'partner') and next_role in ('owner', 'partner') then
    -- Promoção a co-dono: tira % do maior dono.
    select id, ownership_percent into donor_id, donor_share
    from public.shop_members
    where barbershop_id = p_shop_id and active and role in ('owner', 'partner')
    order by ownership_percent desc nulls last
    limit 1
    for update;
    if donor_share is null or donor_share <= next_pct then
      raise exception 'Participação insuficiente para promover a co-dono' using errcode = '23514';
    end if;
    update public.shop_members
    set ownership_percent = ownership_percent - next_pct,
        updated_at = now()
    where id = donor_id;
  elsif row.role in ('owner', 'partner') and next_role not in ('owner', 'partner') then
    -- Rebaixa: devolve % ao maior dono restante.
    select id into donor_id
    from public.shop_members
    where barbershop_id = p_shop_id
      and active
      and role in ('owner', 'partner')
      and id <> row.id
    order by ownership_percent desc nulls last
    limit 1
    for update;
    if donor_id is null then
      raise exception 'Não é possível remover o último dono' using errcode = '23514';
    end if;
    update public.shop_members
    set ownership_percent = ownership_percent + coalesce(row.ownership_percent, 0),
        updated_at = now()
    where id = donor_id;
  end if;

  update public.shop_members
  set role = next_role,
      ownership_percent = next_pct,
      active = next_active,
      updated_at = now()
  where id = row.id;

  -- A ficha de profissional acompanha o vínculo: volta à agenda ao reativar, sai ao desativar.
  if next_active is distinct from row.active and row.staff_id is not null then
    update public.staff set active = next_active, updated_at = now()
    where id = row.staff_id and barbershop_id = p_shop_id;
  end if;
  if row.active and not next_active then
    delete from public.memberships
    where user_id = row.user_id and barbershop_id = p_shop_id and role = 'shop_admin';
  end if;

  return row.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- P-61 e P-62. Pedido de saída
-- ---------------------------------------------------------------------------

create or replace function public.request_shop_departure(p_shop_id uuid, p_mode shop_departure_mode, p_dest_shop_id uuid default null)
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
  v_future int;
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

  if p_mode = 'take' and member.role = 'employee' then
    raise exception 'Contratado sai sem levar os clientes' using errcode = '42501';
  end if;

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

  if p_mode = 'take' and member.role in ('owner', 'partner') and other_socios = 0 then
    raise exception 'Sócio único: transfira a propriedade ou abra mão da carteira' using errcode = '42501';
  end if;

  v_future := public.staff_future_appointment_count(member.staff_id);

  -- Levar clientes sempre espera a liberação de um dono (Parceiro: do dono; dono/sócio: de
  -- outro dono). Sair sem levar só espera quando há reservas futuras para o dono resolver.
  if p_mode = 'take' or v_future > 0 then
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
    return jsonb_build_object('status', 'completed', 'request_id', request_id, 'future_bookings', 0);
  end if;

  return jsonb_build_object('status', 'pending_release', 'request_id', request_id, 'future_bookings', v_future);
end;
$$;

-- A própria pessoa desiste do pedido que ainda espera o dono.
create or replace function public.cancel_shop_departure(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare req public.shop_departure_requests;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into req from public.shop_departure_requests where id = p_request_id for update;
  if req.id is null or req.status <> 'pending_release' then
    raise exception 'Pedido pendente não encontrado' using errcode = 'P0002';
  end if;
  if req.user_id is distinct from auth.uid() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.shop_departure_requests
  set status = 'cancelled', decided_at = now()
  where id = req.id;
  return jsonb_build_object('status', 'cancelled', 'request_id', req.id);
end;
$$;

create or replace function public.complete_shop_departure(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.shop_departure_requests;
  origin_slug text;
  old_booking_slug text;
  dest_staff_id uuid;
  cust uuid;
  origin_points int;
  origin_lifetime int;
  red public.loyalty_redemptions;
  v_future int;
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

  -- P-61: ninguém sai deixando reservas futuras sem dono resolver.
  v_future := public.staff_future_appointment_count(req.staff_id);
  if v_future > 0 then
    raise exception 'Ainda há % reserva(s) futura(s) com este profissional. Passe para outro profissional ou cancele antes de liberar a saída.', v_future
      using errcode = 'P0001', hint = 'future_bookings';
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
$$;

-- Liberação pelo dono: qualquer dono/sócio ativo que não seja quem pediu. A conclusão confere
-- de novo as reservas futuras (o pedido continua aguardando se ainda houver alguma).
create or replace function public.approve_portfolio_release(p_request_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.shop_departure_requests;
  v_future int;
begin
  select * into req from public.shop_departure_requests where id = p_request_id for update;
  if req.id is null or req.status <> 'pending_release' then
    raise exception 'Pedido pendente não encontrado' using errcode = 'P0002';
  end if;
  if req.user_id = auth.uid() then
    raise exception 'O solicitante não pode liberar a própria carteira' using errcode = '42501';
  end if;
  if not public.has_shop_member_role(
    req.barbershop_id, array['owner', 'partner']::public.shop_member_role[]
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  v_future := public.staff_future_appointment_count(req.staff_id);
  if v_future > 0 then
    raise exception 'Ainda há % reserva(s) futura(s) com este profissional. Passe para outro profissional ou cancele antes de liberar a saída.', v_future
      using errcode = 'P0001', hint = 'future_bookings';
  end if;

  update public.shop_departure_requests
  set
    status = 'approved',
    release_approved_by = auth.uid(),
    release_note = nullif(trim(p_note), ''),
    decided_at = now()
  where id = req.id;

  perform public.complete_shop_departure(req.id);
  return jsonb_build_object('status', 'completed', 'request_id', req.id);
end;
$$;

-- Recusar vale para levar os clientes (a pessoa continua na equipe e pode sair sem levar).
-- Sair sem levar os clientes não se recusa: o dono resolve as reservas e libera.
create or replace function public.reject_portfolio_release(p_request_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.shop_departure_requests;
begin
  select * into req from public.shop_departure_requests where id = p_request_id for update;
  if req.id is null or req.status <> 'pending_release' then
    raise exception 'Pedido pendente não encontrado' using errcode = 'P0002';
  end if;
  if req.user_id = auth.uid() then
    raise exception 'O solicitante não pode rejeitar o próprio pedido' using errcode = '42501';
  end if;
  if not public.has_shop_member_role(
    req.barbershop_id, array['owner', 'partner']::public.shop_member_role[]
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if req.mode <> 'take' then
    raise exception 'A saída sem levar clientes não pode ser recusada: resolva as reservas e libere.'
      using errcode = '22023', hint = 'forfeit_not_rejectable';
  end if;

  update public.shop_departure_requests
  set
    status = 'rejected',
    release_approved_by = auth.uid(),
    release_note = nullif(trim(p_note), ''),
    decided_at = now()
  where id = req.id;

  return jsonb_build_object('status', 'rejected', 'request_id', req.id);
end;
$$;

-- Pedidos de saída: donos/sócios veem todos; os demais membros, só os próprios. Com papel de
-- quem pediu e quantas reservas futuras ainda faltam resolver.
create or replace function public.list_shop_departure_requests(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_all boolean;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not public.shop_is_team(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_all := public.is_platform_admin()
    or public.has_shop_member_role(p_shop_id, array['owner', 'partner']::public.shop_member_role[]);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'user_id', r.user_id,
      'staff_id', r.staff_id,
      'mode', r.mode,
      'dest_shop_id', r.dest_shop_id,
      'status', r.status,
      'created_at', r.created_at,
      'staff_name', s.display_name,
      'requester_name', p.full_name,
      'requester_role', sm.role,
      'future_bookings', public.staff_future_appointment_count(r.staff_id)
    ) order by r.created_at desc)
    from public.shop_departure_requests r
    left join public.staff s on s.id = r.staff_id
    left join public.profiles p on p.id = r.user_id
    left join public.shop_members sm on sm.barbershop_id = r.barbershop_id and sm.user_id = r.user_id
    where r.barbershop_id = p_shop_id
      and r.status in ('pending_release', 'approved')
      and (v_all or r.user_id = auth.uid())
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

-- P-64: as duas funções internas de equipe estavam executáveis por qualquer conta logada (sem
-- conferir permissão). Só os fluxos aprovados (apply_shop_change, shop_add_member,
-- platform_add_shop_member, funções do servidor) as chamam.
revoke all on function public.apply_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text) from public, anon, authenticated;
revoke all on function public.apply_update_shop_member(uuid, uuid, public.shop_member_role, numeric, boolean) from public, anon, authenticated;
grant execute on function public.apply_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text) to service_role;
grant execute on function public.apply_update_shop_member(uuid, uuid, public.shop_member_role, numeric, boolean) to service_role;

revoke all on function public.staff_future_appointment_count(uuid) from public, anon, authenticated;
revoke all on function public.guard_member_exit_future_bookings() from public, anon, authenticated;
revoke all on function public.list_departure_appointments(uuid, uuid) from public, anon;
revoke all on function public.reassign_appointment_staff(uuid, uuid) from public, anon;
revoke all on function public.cancel_shop_departure(uuid) from public, anon;
grant execute on function public.list_departure_appointments(uuid, uuid) to authenticated;
grant execute on function public.reassign_appointment_staff(uuid, uuid) to authenticated;
grant execute on function public.cancel_shop_departure(uuid) to authenticated;

notify pgrst, 'reload schema';
