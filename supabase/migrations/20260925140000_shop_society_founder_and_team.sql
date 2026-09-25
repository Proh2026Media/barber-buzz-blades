-- Fundador da loja + equipe/sociedade controláveis pelo dono (admin/gerente mantêm override).

-- ---------------------------------------------------------------------------
-- 1) Fundador
-- ---------------------------------------------------------------------------
alter table public.barbershops
  add column if not exists founded_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists barbershops_founded_by_idx
  on public.barbershops (founded_by_user_id)
  where founded_by_user_id is not null;

comment on column public.barbershops.founded_by_user_id is
  'Conta que criou a barbearia; âncora da sociedade (não rebaixa sem transferir fundação).';

-- Backfill: dono ativo com maior participação (ou único owner).
update public.barbershops b
set founded_by_user_id = sub.user_id
from (
  select distinct on (m.barbershop_id)
    m.barbershop_id,
    m.user_id
  from public.shop_members m
  where m.active and m.role in ('owner', 'partner')
  order by m.barbershop_id, m.ownership_percent desc nulls last, m.created_at asc
) sub
where b.id = sub.barbershop_id
  and b.founded_by_user_id is null;

-- ---------------------------------------------------------------------------
-- 2) Helpers de autorização
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_shop_society(p_shop_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_platform_admin() then return true; end if;
  if public.is_account_manager_of(p_shop_id) then return true; end if;
  if public.can_apply_protected_change(p_shop_id) then return true; end if;
  return false;
end;
$$;

revoke all on function public.can_manage_shop_society(uuid) from public;
grant execute on function public.can_manage_shop_society(uuid) to authenticated, service_role;

create or replace function public.is_shop_founder(p_shop_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.barbershops b
    where b.id = p_shop_id and b.founded_by_user_id = p_user_id
  );
$$;

revoke all on function public.is_shop_founder(uuid, uuid) from public;
grant execute on function public.is_shop_founder(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Aplicação interna de membro (sem checagem de sociedade)
-- ---------------------------------------------------------------------------
create or replace function public.apply_add_shop_member(
  p_shop_id uuid,
  p_user_id uuid,
  p_role public.shop_member_role,
  p_ownership_percent numeric default null,
  p_display_name text default null
) returns uuid
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
begin
  perform set_config('app.approved_shop_change', 'on', true);

  if effective_role = 'partner' then
    effective_role := 'owner';
  end if;

  if exists (
    select 1 from public.shop_members
    where barbershop_id = p_shop_id and user_id = p_user_id
  ) then
    raise exception 'This account already belongs to the professional team' using errcode = '23505';
  end if;

  if effective_role = 'owner'
     and (p_ownership_percent is null or p_ownership_percent <= 0 or p_ownership_percent >= 100) then
    raise exception 'Co-owner ownership must be between 0 and 100' using errcode = '22023';
  end if;

  select id into staffid
  from public.staff
  where barbershop_id = p_shop_id and user_id = p_user_id;

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

revoke all on function public.apply_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text) from public, anon;
grant execute on function public.apply_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text) to service_role;

create or replace function public.apply_update_shop_member(
  p_shop_id uuid,
  p_member_id uuid,
  p_role public.shop_member_role default null,
  p_ownership_percent numeric default null,
  p_active boolean default null
) returns uuid
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

  return row.id;
end;
$$;

revoke all on function public.apply_update_shop_member(uuid, uuid, public.shop_member_role, numeric, boolean) from public, anon;
grant execute on function public.apply_update_shop_member(uuid, uuid, public.shop_member_role, numeric, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 4) RPCs públicas: add / update / transfer founder / list
-- ---------------------------------------------------------------------------
create or replace function public.shop_add_member(
  p_shop_id uuid,
  p_user_id uuid,
  p_role public.shop_member_role,
  p_ownership_percent numeric default null,
  p_display_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mode text;
  memberid uuid;
  request_id uuid;
  is_override boolean;
  can_propose boolean;
begin
  is_override := public.is_platform_admin() or public.is_account_manager_of(p_shop_id);

  if not is_override
     and not public.has_shop_member_role(
       p_shop_id, array['owner', 'partner']::public.shop_member_role[]
     ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  mode := public.shop_governance_mode(p_shop_id);

  if is_override or public.can_apply_protected_change(p_shop_id) then
    memberid := public.apply_add_shop_member(
      p_shop_id, p_user_id, p_role, p_ownership_percent, p_display_name
    );
    return jsonb_build_object('status', 'applied', 'member_id', memberid);
  end if;

  -- Igualitário / minoritário: abre pedido.
  can_propose := mode in ('equal', 'majority');
  if not can_propose then
    raise exception 'Somente quem aplica mudanças protegidas pode convidar nesta sociedade'
      using errcode = '42501';
  end if;

  insert into public.shop_change_requests (
    barbershop_id, requested_by, kind, payload, source, checklist
  ) values (
    p_shop_id,
    auth.uid(),
    'member.add',
    jsonb_build_object(
      'user_id', p_user_id,
      'role', p_role,
      'ownership_percent', p_ownership_percent,
      'display_name', p_display_name,
      'summary', coalesce(nullif(trim(p_display_name), ''), 'Novo membro')
    ),
    'society',
    jsonb_build_array(jsonb_build_object(
      'kind', 'member.add',
      'summary', coalesce(nullif(trim(p_display_name), ''), 'Convidar membro')
    ))
  )
  returning id into request_id;

  return jsonb_build_object('status', 'pending', 'request_id', request_id);
end;
$$;

revoke all on function public.shop_add_member(uuid, uuid, public.shop_member_role, numeric, text) from public, anon;
grant execute on function public.shop_add_member(uuid, uuid, public.shop_member_role, numeric, text) to authenticated;

create or replace function public.shop_update_member(
  p_shop_id uuid,
  p_member_id uuid,
  p_role public.shop_member_role default null,
  p_ownership_percent numeric default null,
  p_active boolean default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mode text;
  memberid uuid;
  request_id uuid;
  is_override boolean;
  target public.shop_members;
begin
  is_override := public.is_platform_admin() or public.is_account_manager_of(p_shop_id);

  if not is_override
     and not public.has_shop_member_role(
       p_shop_id, array['owner', 'partner']::public.shop_member_role[]
     ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into target
  from public.shop_members
  where id = p_member_id and barbershop_id = p_shop_id;

  if target.id is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  -- Bloqueio imediato do fundador (também na proposta).
  if public.is_shop_founder(p_shop_id, target.user_id) then
    if (p_role is not null and p_role not in ('owner', 'partner'))
       or p_active is false then
      raise exception 'O fundador não pode ser rebaixado ou desativado. Transfira a fundação antes.'
        using errcode = '42501';
    end if;
  end if;

  if is_override or public.can_apply_protected_change(p_shop_id) then
    memberid := public.apply_update_shop_member(
      p_shop_id, p_member_id, p_role, p_ownership_percent, p_active
    );
    return jsonb_build_object('status', 'applied', 'member_id', memberid);
  end if;

  mode := public.shop_governance_mode(p_shop_id);
  if mode not in ('equal', 'majority') then
    raise exception 'Somente quem aplica mudanças protegidas pode alterar papéis'
      using errcode = '42501';
  end if;

  insert into public.shop_change_requests (
    barbershop_id, requested_by, kind, payload, source, checklist
  ) values (
    p_shop_id,
    auth.uid(),
    'member.update',
    jsonb_build_object(
      'id', p_member_id,
      'role', p_role,
      'ownership_percent', p_ownership_percent,
      'active', p_active,
      'summary', 'Alterar papel ou participação'
    ),
    'society',
    jsonb_build_array(jsonb_build_object(
      'kind', 'member.update',
      'summary', 'Alterar papel ou participação societária'
    ))
  )
  returning id into request_id;

  return jsonb_build_object('status', 'pending', 'request_id', request_id);
end;
$$;

revoke all on function public.shop_update_member(uuid, uuid, public.shop_member_role, numeric, boolean) from public, anon;
grant execute on function public.shop_update_member(uuid, uuid, public.shop_member_role, numeric, boolean) to authenticated;

create or replace function public.transfer_shop_founder(
  p_shop_id uuid,
  p_new_founder_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_founder uuid;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select founded_by_user_id into current_founder
  from public.barbershops
  where id = p_shop_id
  for update;

  if current_founder is null then
    raise exception 'Loja sem fundador registrado' using errcode = 'P0002';
  end if;

  if not public.is_platform_admin() and current_founder <> auth.uid() then
    raise exception 'Só o fundador ou o admin global pode transferir a fundação'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.shop_members
    where barbershop_id = p_shop_id
      and user_id = p_new_founder_user_id
      and active
      and role in ('owner', 'partner')
  ) then
    raise exception 'O novo fundador precisa ser dono/co-dono ativo' using errcode = '22023';
  end if;

  update public.barbershops
  set founded_by_user_id = p_new_founder_user_id,
      updated_at = now()
  where id = p_shop_id;

  return jsonb_build_object(
    'ok', true,
    'founded_by_user_id', p_new_founder_user_id
  );
end;
$$;

revoke all on function public.transfer_shop_founder(uuid, uuid) from public, anon;
grant execute on function public.transfer_shop_founder(uuid, uuid) to authenticated;

create or replace function public.list_shop_team_members(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  founder uuid;
begin
  if not (
    public.is_platform_admin()
    or public.is_account_manager_of(p_shop_id)
    or public.has_shop_member_role(
      p_shop_id, array['owner', 'partner']::public.shop_member_role[]
    )
    or public.can_view_full_shop(p_shop_id)
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select founded_by_user_id into founder from public.barbershops where id = p_shop_id;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'user_id', m.user_id,
      'staff_id', m.staff_id,
      'role', m.role,
      'ownership_percent', m.ownership_percent,
      'active', m.active,
      'display_name', coalesce(s.display_name, p.full_name, u.email, 'Profissional'),
      'email', u.email,
      'is_founder', (founder is not null and m.user_id = founder),
      'created_at', m.created_at
    ) order by
      case when founder is not null and m.user_id = founder then 0 else 1 end,
      case m.role when 'owner' then 0 when 'partner' then 1 when 'associate' then 2 else 3 end,
      coalesce(m.ownership_percent, 0) desc,
      coalesce(s.display_name, p.full_name, '')
    )
    from public.shop_members m
    left join public.staff s on s.id = m.staff_id
    left join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.barbershop_id = p_shop_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_shop_team_members(uuid) from public, anon;
grant execute on function public.list_shop_team_members(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) platform_add_shop_member: admin OU gerente da loja
-- ---------------------------------------------------------------------------
create or replace function public.platform_add_shop_member(
  p_shop_id uuid,
  p_user_id uuid,
  p_role public.shop_member_role,
  p_ownership_percent numeric default null,
  p_display_name text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() and not public.is_account_manager_of(p_shop_id) then
    raise exception 'Platform admin or account manager required' using errcode = '42501';
  end if;
  return public.apply_add_shop_member(
    p_shop_id, p_user_id, p_role, p_ownership_percent, p_display_name
  );
end;
$$;

revoke all on function public.platform_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text) from public, anon;
grant execute on function public.platform_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) apply_shop_change: member.add + member.update robusto
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
      delete from public.business_hours where barbershop_id = p_shop_id;
      insert into public.business_hours(barbershop_id, weekday, open_time, close_time)
      select p_shop_id, (h->>'weekday')::int, (h->>'open_time')::time, (h->>'close_time')::time
      from jsonb_array_elements(coalesce(p_payload->'hours', '[]'::jsonb)) h;
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
        )
      where barbershop_id = p_shop_id;
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

-- ---------------------------------------------------------------------------
-- 7) Permissões: gerente da loja também lê/grava matriz
-- ---------------------------------------------------------------------------
create or replace function public.get_shop_permissions(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare allowed boolean;
begin
  allowed := public.is_platform_admin()
    or public.is_account_manager_of(p_shop_id)
    or public.shop_permission_granted(p_shop_id,'manage_permissions')
    or public.can_apply_protected_change(p_shop_id)
    or public.has_shop_member_role(
      p_shop_id, array['owner', 'partner']::public.shop_member_role[]
    );
  if not allowed then raise exception 'Not allowed' using errcode='42501'; end if;

  return jsonb_build_object(
    'catalog', coalesce((
      select jsonb_agg(jsonb_build_object(
        'permission', c.permission, 'label', c.label,
        'description', c.description, 'sort_order', c.sort_order
      ) order by c.sort_order)
      from public.shop_permission_catalog() c
    ),'[]'::jsonb),
    'roles', jsonb_build_array('owner','partner','associate','employee'),
    'matrix', coalesce((
      select jsonb_object_agg(r.role, r.entries)
      from (
        select sm.role::text as role, jsonb_object_agg(c.permission,
          public.shop_role_permission_value(p_shop_id, sm.role, c.permission)) as entries
        from (select unnest(array['owner','partner','associate','employee']::public.shop_member_role[]) as role) sm
        cross join public.shop_permission_catalog() c
        group by sm.role
      ) r
    ), '{}'::jsonb),
    'founded_by_user_id', (select founded_by_user_id from public.barbershops where id = p_shop_id)
  );
end $$;

create or replace function public.save_shop_permissions(p_shop_id uuid, p_matrix jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  role_name text;
  entry jsonb;
  permission_name text;
  flag boolean;
  target_role public.shop_member_role;
  touched public.shop_member_role[] := '{}';
begin
  if not (
    public.is_platform_admin()
    or public.is_account_manager_of(p_shop_id)
    or public.can_apply_protected_change(p_shop_id)
  ) then
    raise exception 'Not allowed' using errcode='42501';
  end if;
  if p_matrix is null or jsonb_typeof(p_matrix) <> 'object' then
    raise exception 'Matriz inválida' using errcode='22023';
  end if;

  if p_matrix ? 'owner' and (p_matrix->'owner') ? 'manage_permissions'
     and coalesce((p_matrix->'owner'->>'manage_permissions')::boolean, false) is not true then
    raise exception 'O dono precisa manter a gestão de permissões' using errcode='22023';
  end if;

  for role_name, entry in select r.key, r.value from jsonb_each(p_matrix) r loop
    if role_name not in ('owner','partner','associate','employee') then
      raise exception 'Papel inválido: %', role_name using errcode='22023';
    end if;
    if jsonb_typeof(entry) <> 'object' then
      raise exception 'Permissões inválidas para o papel %', role_name using errcode='22023';
    end if;
    for permission_name in select p.key from jsonb_each(entry) p loop
      if not exists (select 1 from public.shop_permission_catalog() c where c.permission = permission_name) then
        raise exception 'Permissão desconhecida: %', permission_name using errcode='22023';
      end if;
      if jsonb_typeof(entry -> permission_name) <> 'boolean' then
        raise exception 'Valor inválido para %', permission_name using errcode='22023';
      end if;
    end loop;
    touched := touched || role_name::public.shop_member_role;
  end loop;

  delete from public.shop_role_permissions
    where barbershop_id = p_shop_id and role = any (touched);

  for role_name, entry in select r.key, r.value from jsonb_each(p_matrix) r loop
    target_role := role_name::public.shop_member_role;
    for permission_name in select p.key from jsonb_each(entry) p loop
      flag := (entry ->> permission_name)::boolean;
      if flag is distinct from public.shop_permission_default(target_role, permission_name) then
        insert into public.shop_role_permissions(barbershop_id, role, permission, allowed)
        values (p_shop_id, target_role, permission_name, flag);
      end if;
    end loop;
  end loop;

  return public.get_shop_permissions(p_shop_id);
end $$;

-- RLS: gerente lê membros da loja
drop policy if exists "Members read own or managed team" on public.shop_members;
create policy "Members read own or managed team" on public.shop_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or public.is_account_manager_of(barbershop_id)
    or public.can_view_full_shop(barbershop_id)
  );

drop policy if exists "Owners manage team" on public.shop_members;
create policy "Owners manage team" on public.shop_members
  for all to authenticated
  using (
    public.is_platform_admin()
    or public.is_account_manager_of(barbershop_id)
    or (public.can_apply_protected_change(barbershop_id) and public.shop_can_manage_team(barbershop_id))
  )
  with check (
    public.is_platform_admin()
    or public.is_account_manager_of(barbershop_id)
    or (public.can_apply_protected_change(barbershop_id) and public.shop_can_manage_team(barbershop_id))
  );

notify pgrst, 'reload schema';
