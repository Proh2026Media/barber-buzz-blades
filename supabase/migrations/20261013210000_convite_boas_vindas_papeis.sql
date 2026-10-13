-- Convite com link, boas-vindas e regras de papel no banco (13/10/2026, Cursor).
--
-- P-15  Convite com link de entrada: tabela shop_invite_links (só o servidor lê e grava). A função
--       invite-shop-admin grava o código do link (só o resumo sha-256) e a função shop-invite troca
--       o link por uma sessão, enquanto a conta ainda usa a senha temporária.
-- P-17  Boas-vindas "Você agora é Parceiro na Barbearia X" uma vez por vínculo: coluna
--       shop_members.welcome_seen_at (as linhas que já existem nascem como vistas, sem UPDATE) e
--       mark_shop_welcome_seen. Voltar à equipe ou mudar de papel mostra de novo.
-- P-05  get_my_pending_shop_invites: a pessoa convidada lê o próprio convite aguardando aprovação.
-- P-06  Loja sem dono ativo aceita o primeiro dono com 100% (antes exigia que um dono cedesse parte).
-- P-08  "Dar acesso ao painel" liga a conta ao cartão de profissional que já existe (p_staff_id),
--       sem criar outro. Mudou a assinatura de apply_add_shop_member, shop_add_member e
--       platform_add_shop_member: as versões antigas são apagadas (evita PGRST203).
-- P-02  Permissão nova manage_own_blocks (ligada para todos os papéis): o bloqueio da própria
--       agenda deixa de depender de "serviços próprios".
-- P-03  Foto do próprio perfil em <loja>/staff/<staff_id>/...: o Contratado envia e troca só na
--       própria pasta.
-- P-13  save_shop_permissions grava desligadas as permissões de gestão travadas do Contratado.
-- P-09  get_team_schedule devolve customer_id a quem pode ver o atendimento.
-- P-66  Dono da equipe (sem o shop_admin antigo) cria bloqueios de colegas e da loja inteira.
--
-- Copiadas da versão em produção em 13/10/2026 (pg_get_functiondef): apply_add_shop_member
-- (20261013190000), shop_add_member e platform_add_shop_member (20260925140000), apply_shop_change
-- (20261013150000), save_shop_permissions (20260925140000), get_team_schedule (20261003150000),
-- shop_permission_catalog (20260917170000) e shop_permission_default (20260917170000).
-- Idempotente: pode ser reaplicada.

-- ---------------------------------------------------------------------------
-- P-15. Links de convite
-- ---------------------------------------------------------------------------

create table if not exists public.shop_invite_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.shop_member_role not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  last_used_at timestamptz,
  use_count integer not null default 0
);

create index if not exists shop_invite_links_user_idx on public.shop_invite_links (user_id);

comment on table public.shop_invite_links is
  'Convites com link de entrada (P-15). Só o resumo sha-256 do código; leitura e escrita só pelo servidor.';

alter table public.shop_invite_links enable row level security;
revoke all on public.shop_invite_links from public, anon, authenticated;
grant all on public.shop_invite_links to service_role;

-- ---------------------------------------------------------------------------
-- P-17. Boas-vindas por vínculo
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shop_members' and column_name = 'welcome_seen_at'
  ) then
    -- Com o padrão now(), as linhas que já existem ficam como "vistas" sem UPDATE (nenhum gatilho
    -- roda e updated_at não muda). Depois o padrão sai: vínculo novo nasce sem ter visto.
    alter table public.shop_members add column welcome_seen_at timestamptz default now();
    alter table public.shop_members alter column welcome_seen_at drop default;
  end if;
end $$;

comment on column public.shop_members.welcome_seen_at is
  'Quando a pessoa viu a tela de boas-vindas deste vínculo (P-17). Nulo = ainda não viu.';

create or replace function public.shop_members_reset_welcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Quem abriu a própria barbearia não precisa de boas-vindas.
    if exists (
      select 1 from public.barbershops b
      where b.id = new.barbershop_id and b.founded_by_user_id = new.user_id
    ) then
      new.welcome_seen_at := coalesce(new.welcome_seen_at, now());
    else
      new.welcome_seen_at := null;
    end if;
  elsif new.active and (not old.active or new.role is distinct from old.role) then
    new.welcome_seen_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_members_reset_welcome on public.shop_members;
create trigger shop_members_reset_welcome
  before insert or update of active, role on public.shop_members
  for each row execute function public.shop_members_reset_welcome();

create or replace function public.mark_shop_welcome_seen(p_shop_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.shop_members
  set welcome_seen_at = now()
  where barbershop_id = p_shop_id and user_id = auth.uid() and welcome_seen_at is null;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- P-05. Convite aguardando aprovação, legível pela pessoa convidada
-- ---------------------------------------------------------------------------

create or replace function public.get_my_pending_shop_invites()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'request_id', r.id,
    'shop_id', r.barbershop_id,
    'shop_name', b.name,
    'role', r.payload->>'role',
    'requested_at', r.created_at
  ) order by r.created_at desc), '[]'::jsonb)
  from public.shop_change_requests r
  join public.barbershops b on b.id = r.barbershop_id
  where auth.uid() is not null
    and r.kind = 'member.add'
    and r.status = 'pending'
    and r.payload->>'user_id' = auth.uid()::text
    and (r.expires_at is null or r.expires_at > now())
$$;

-- ---------------------------------------------------------------------------
-- P-06 e P-08. Entrada na equipe: primeiro dono e cartão de profissional existente
-- ---------------------------------------------------------------------------

drop function if exists public.platform_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text);
drop function if exists public.shop_add_member(uuid, uuid, public.shop_member_role, numeric, text);
drop function if exists public.apply_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text);

create or replace function public.apply_add_shop_member(
  p_shop_id uuid,
  p_user_id uuid,
  p_role public.shop_member_role,
  p_ownership_percent numeric default null,
  p_display_name text default null,
  p_staff_id uuid default null
)
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
  effective_percent numeric := p_ownership_percent;
  previous public.shop_members;
  chosen public.staff;
  first_owner boolean := false;
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

  if effective_role = 'owner' then
    -- Loja sem dono ativo (criada pela plataforma): o primeiro dono entra com 100%.
    first_owner := not exists (
      select 1 from public.shop_members m
      where m.barbershop_id = p_shop_id and m.active and m.role in ('owner', 'partner')
        and m.user_id <> p_user_id
    );
    if first_owner then
      if effective_percent is not null and effective_percent <> 100 then
        raise exception 'O primeiro dono da barbearia entra com 100%%.' using errcode = '22023';
      end if;
      effective_percent := 100;
    elsif effective_percent is null or effective_percent <= 0 or effective_percent >= 100 then
      raise exception 'Co-owner ownership must be between 0 and 100' using errcode = '22023';
    end if;
  elsif effective_percent is not null then
    raise exception 'Only co-owners receive ownership percentage' using errcode = '22023';
  end if;

  if p_staff_id is not null then
    -- "Dar acesso ao painel" pelo cartão do profissional: liga a conta a esse cartão.
    select * into chosen
    from public.staff
    where id = p_staff_id and barbershop_id = p_shop_id
    for update;
    if chosen.id is null then
      raise exception 'Profissional não encontrado nesta barbearia.' using errcode = '22023';
    end if;
    if (chosen.user_id is not null and chosen.user_id <> p_user_id)
       or exists (
         select 1 from public.shop_members m
         where m.barbershop_id = p_shop_id and m.staff_id = p_staff_id and m.user_id <> p_user_id
       ) then
      raise exception 'Este profissional já está ligado a outra conta.'
        using errcode = '23505', hint = 'staff_linked';
    end if;
    if exists (
      select 1 from public.staff s
      where s.barbershop_id = p_shop_id and s.user_id = p_user_id and s.id <> p_staff_id
    ) then
      raise exception 'Esta conta já tem outro cartão de profissional nesta barbearia.'
        using errcode = '23505', hint = 'other_card';
    end if;
    update public.staff
    set user_id = p_user_id, active = true, updated_at = now()
    where id = p_staff_id;
    staffid := p_staff_id;
  else
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
  end if;

  if effective_role = 'owner' and not first_owner then
    select id, ownership_percent into owner_id, owner_share
    from public.shop_members
    where barbershop_id = p_shop_id and role = 'owner' and active
    order by ownership_percent desc nulls last
    limit 1
    for update;

    if owner_share is null or owner_share <= effective_percent then
      raise exception 'The owner does not have enough participation to transfer' using errcode = '23514';
    end if;

    update public.shop_members
    set ownership_percent = ownership_percent - effective_percent,
        updated_at = now()
    where id = owner_id;
  end if;

  if previous.id is not null then
    -- Volta à equipe: o vínculo antigo é reativado com o papel do convite novo.
    update public.shop_members
    set role = effective_role,
        ownership_percent = case when effective_role = 'owner' then effective_percent else null end,
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
    case when effective_role = 'owner' then effective_percent else null end,
    true
  )
  returning id into memberid;

  return memberid;
end;
$$;

create or replace function public.platform_add_shop_member(
  p_shop_id uuid,
  p_user_id uuid,
  p_role public.shop_member_role,
  p_ownership_percent numeric default null,
  p_display_name text default null,
  p_staff_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() and not public.is_account_manager_of(p_shop_id) then
    raise exception 'Platform admin or account manager required' using errcode = '42501';
  end if;
  return public.apply_add_shop_member(
    p_shop_id, p_user_id, p_role, p_ownership_percent, p_display_name, p_staff_id
  );
end;
$$;

create or replace function public.shop_add_member(
  p_shop_id uuid,
  p_user_id uuid,
  p_role public.shop_member_role,
  p_ownership_percent numeric default null,
  p_display_name text default null,
  p_staff_id uuid default null
)
returns jsonb
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
      p_shop_id, p_user_id, p_role, p_ownership_percent, p_display_name, p_staff_id
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
      'staff_id', p_staff_id,
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

-- apply_shop_change: igual à de produção; o pedido aprovado de member.add leva o staff_id (P-08).
CREATE OR REPLACE FUNCTION public.apply_shop_change(p_shop_id uuid, p_kind text, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform set_config('app.approved_shop_change', 'on', true);
  case p_kind
    when 'service.create' then
      insert into public.services(
        barbershop_id, name, description, duration_minutes, price_cents, active, icon, prep_minutes
      ) values (
        p_shop_id,
        p_payload->>'name',
        nullif(p_payload->>'description', ''),
        (p_payload->>'duration_minutes')::int,
        (p_payload->>'price_cents')::int,
        coalesce((p_payload->>'active')::boolean, true),
        nullif(p_payload->>'icon', ''),
        nullif(p_payload->>'prep_minutes', '')::smallint
      );
    when 'service.update' then
      update public.services set
        name = coalesce(p_payload->>'name', name),
        description = case when p_payload ? 'description' then nullif(p_payload->>'description', '') else description end,
        duration_minutes = coalesce((p_payload->>'duration_minutes')::int, duration_minutes),
        price_cents = coalesce((p_payload->>'price_cents')::int, price_cents),
        active = coalesce((p_payload->>'active')::boolean, active),
        icon = case when p_payload ? 'icon' then nullif(p_payload->>'icon', '') else icon end,
        prep_minutes = case
          when p_payload ? 'prep_minutes' then nullif(p_payload->>'prep_minutes', '')::smallint
          else prep_minutes
        end
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
        slot_step_minutes = coalesce((p_payload->>'slot_step_minutes')::smallint, slot_step_minutes),
        prep_minutes = coalesce((p_payload->>'prep_minutes')::smallint, prep_minutes),
        min_lead_minutes = coalesce((p_payload->>'min_lead_minutes')::smallint, min_lead_minutes)
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
        nullif(p_payload->>'display_name', ''),
        nullif(p_payload->>'staff_id', '')::uuid
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
$function$;

-- ---------------------------------------------------------------------------
-- P-02. Bloqueio da própria agenda como permissão própria
-- ---------------------------------------------------------------------------

create or replace function public.shop_permission_catalog()
returns table(permission text, label text, description text, sort_order integer)
language sql
immutable
set search_path = public
as $$
  values
    ('view_agenda_all','Visão geral da agenda','Ver a agenda de todos os profissionais da unidade',10),
    ('view_money','Valores do dia e próprios recebimentos','Ver o resumo de valores do dia e quanto recebeu pelos próprios atendimentos',20),
    ('view_financial_all','Relatórios financeiros da loja','Acessar faturamento e relatórios financeiros completos da unidade',30),
    ('view_reports_global','Relatórios da unidade','Acessar métricas completas e identificadas da unidade',40),
    ('view_reports_anonymized','Indicadores gerais anonimizados','Ver números gerais da loja sem identificar quem é quem',50),
    ('view_own_score','Indicadores próprios','Acompanhar o próprio movimento e desempenho',60),
    ('manage_services','Gerenciar catálogo geral','Criar, editar e alterar preços dos serviços da unidade',70),
    ('manage_own_services','Gerenciar próprios serviços','Editar preço, duração e disponibilidade dos próprios serviços',80),
    ('manage_own_blocks','Bloquear a própria agenda','Criar e apagar folgas e pausas só na própria agenda',85),
    ('manage_operations','Gerenciar funcionamento','Definir horários de funcionamento, bloqueios gerais e ajustes da loja',90),
    ('manage_team','Gerenciar equipe','Convidar profissionais e alterar funções',100),
    ('manage_permissions','Alterar permissões','Editar esta matriz de acessos',110)
$$;

create or replace function public.shop_permission_default(p_role public.shop_member_role, p_permission text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case p_permission
    -- Dono e sócio operam a unidade inteira.
    when 'view_agenda_all'         then p_role in ('owner','partner')
    when 'view_financial_all'      then p_role in ('owner','partner')
    when 'view_reports_global'     then p_role in ('owner','partner')
    when 'manage_services'         then p_role in ('owner','partner')
    when 'manage_operations'       then p_role in ('owner','partner')
    when 'manage_team'             then p_role in ('owner','partner')
    when 'manage_permissions'      then p_role in ('owner','partner')
    -- Parceiro tem ambiente próprio: indicadores gerais sem identificação.
    when 'view_reports_anonymized' then p_role = 'associate'
    when 'manage_own_services'     then p_role in ('owner','partner','associate')
    -- Folga e pausa na própria agenda: todos (decisão 7 do plano de ambientes).
    when 'manage_own_blocks'       then true
    -- Valores do dia e próprios recebimentos: contratado não vê.
    when 'view_money'              then p_role in ('owner','partner','associate')
    -- Contratado vê o próprio score.
    when 'view_own_score'          then true
    else false
  end
$$;

drop policy if exists "Professionals manage own blocks" on public.availability_blocks;
create policy "Professionals manage own blocks" on public.availability_blocks
  for all to authenticated
  using (
    staff_id = public.current_staff_id(barbershop_id)
    and public.shop_permission_granted(barbershop_id, 'manage_own_blocks')
  )
  with check (
    staff_id = public.current_staff_id(barbershop_id)
    and public.shop_permission_granted(barbershop_id, 'manage_own_blocks')
  );

-- P-66. Dono da equipe (sem o shop_admin antigo): bloqueios de colegas e da loja inteira.
drop policy if exists "Team managers manage availability blocks" on public.availability_blocks;
create policy "Team managers manage availability blocks" on public.availability_blocks
  for all to authenticated
  using (
    public.can_apply_protected_change(barbershop_id)
    and public.shop_can_manage_operations(barbershop_id)
  )
  with check (
    public.can_apply_protected_change(barbershop_id)
    and public.shop_can_manage_operations(barbershop_id)
  );

-- ---------------------------------------------------------------------------
-- P-13. Matriz: permissões de gestão sem efeito para o Contratado ficam desligadas
-- ---------------------------------------------------------------------------

create or replace function public.save_shop_permissions(p_shop_id uuid, p_matrix jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
      -- O banco só aplica mudanças da loja de dono ou sócio: para o Contratado essas ficam
      -- desligadas (a tela já trava as células; decisão 8 do plano de ambientes).
      if target_role = 'employee'
         and permission_name in ('manage_services', 'manage_operations', 'manage_team', 'manage_permissions') then
        flag := false;
      end if;
      if flag is distinct from public.shop_permission_default(target_role, permission_name) then
        insert into public.shop_role_permissions(barbershop_id, role, permission, allowed)
        values (p_shop_id, target_role, permission_name, flag);
      end if;
    end loop;
  end loop;

  return public.get_shop_permissions(p_shop_id);
end $$;

-- ---------------------------------------------------------------------------
-- P-03. Foto do próprio perfil: <loja>/staff/<staff_id>/arquivo
-- ---------------------------------------------------------------------------

drop policy if exists "Authorized users upload service images" on storage.objects;
create policy "Authorized users upload service images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'barbershop-services'
    and (
      public.is_platform_admin()
      or public.has_shop_role(((storage.foldername(name))[1])::uuid, array['shop_admin']::public.app_role[])
      or public.has_shop_member_role(((storage.foldername(name))[1])::uuid, array['owner','partner','associate']::public.shop_member_role[])
      or public.shop_can_manage_services(((storage.foldername(name))[1])::uuid)
      or public.shop_can_manage_own_services(((storage.foldername(name))[1])::uuid)
      or (
        (storage.foldername(name))[2] = 'staff'
        and (storage.foldername(name))[3] = public.current_staff_id(((storage.foldername(name))[1])::uuid)::text
      )
    )
  );

drop policy if exists "Authorized users update service images" on storage.objects;
create policy "Authorized users update service images" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'barbershop-services'
    and (
      public.is_platform_admin()
      or public.has_shop_role(((storage.foldername(name))[1])::uuid, array['shop_admin']::public.app_role[])
      or public.has_shop_member_role(((storage.foldername(name))[1])::uuid, array['owner','partner','associate']::public.shop_member_role[])
      or public.shop_can_manage_services(((storage.foldername(name))[1])::uuid)
      or public.shop_can_manage_own_services(((storage.foldername(name))[1])::uuid)
      or (
        (storage.foldername(name))[2] = 'staff'
        and (storage.foldername(name))[3] = public.current_staff_id(((storage.foldername(name))[1])::uuid)::text
      )
    )
  )
  with check (
    bucket_id = 'barbershop-services'
    and (
      public.is_platform_admin()
      or public.has_shop_role(((storage.foldername(name))[1])::uuid, array['shop_admin']::public.app_role[])
      or public.has_shop_member_role(((storage.foldername(name))[1])::uuid, array['owner','partner','associate']::public.shop_member_role[])
      or public.shop_can_manage_services(((storage.foldername(name))[1])::uuid)
      or public.shop_can_manage_own_services(((storage.foldername(name))[1])::uuid)
      or (
        (storage.foldername(name))[2] = 'staff'
        and (storage.foldername(name))[3] = public.current_staff_id(((storage.foldername(name))[1])::uuid)::text
      )
    )
  );

drop policy if exists "Authorized users delete service images" on storage.objects;
create policy "Authorized users delete service images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'barbershop-services'
    and (
      public.is_platform_admin()
      or public.has_shop_role(((storage.foldername(name))[1])::uuid, array['shop_admin']::public.app_role[])
      or public.has_shop_member_role(((storage.foldername(name))[1])::uuid, array['owner','partner','associate']::public.shop_member_role[])
      or public.shop_can_manage_services(((storage.foldername(name))[1])::uuid)
      or public.shop_can_manage_own_services(((storage.foldername(name))[1])::uuid)
      or (
        (storage.foldername(name))[2] = 'staff'
        and (storage.foldername(name))[3] = public.current_staff_id(((storage.foldername(name))[1])::uuid)::text
      )
    )
  );

-- ---------------------------------------------------------------------------
-- P-09. Agenda da equipe: ficha do cliente para quem pode ver o atendimento
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

-- ---------------------------------------------------------------------------
-- P-18: barbearia aberta por quem já tem conta (/cadastrar com sessão). Igual à de
-- 20261003150000, mas grava quem fundou: o dono-fundador não vê "boas-vindas" na própria loja.
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

  insert into public.barbershops(name, status, founded_by_user_id)
  values (sname, 'active', auth.uid())
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

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

revoke all on function public.apply_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.apply_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text, uuid) to service_role;
revoke all on function public.platform_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text, uuid) from public, anon;
grant execute on function public.platform_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text, uuid) to authenticated, service_role;
revoke all on function public.shop_add_member(uuid, uuid, public.shop_member_role, numeric, text, uuid) from public, anon;
grant execute on function public.shop_add_member(uuid, uuid, public.shop_member_role, numeric, text, uuid) to authenticated, service_role;
revoke all on function public.apply_shop_change(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_shop_change(uuid, text, jsonb) to service_role;
revoke all on function public.save_shop_permissions(uuid, jsonb) from public, anon;
grant execute on function public.save_shop_permissions(uuid, jsonb) to authenticated, service_role;
revoke all on function public.shop_members_reset_welcome() from public, anon, authenticated;
revoke all on function public.mark_shop_welcome_seen(uuid) from public, anon;
grant execute on function public.mark_shop_welcome_seen(uuid) to authenticated;
revoke all on function public.get_my_pending_shop_invites() from public, anon;
grant execute on function public.get_my_pending_shop_invites() to authenticated;
revoke all on function public.get_team_schedule(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_team_schedule(uuid, timestamptz, timestamptz) to authenticated, service_role;
revoke all on function public.create_own_barbershop(text) from public, anon;
grant execute on function public.create_own_barbershop(text) to authenticated;

notify pgrst, 'reload schema';
