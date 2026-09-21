-- Permissões configuráveis por papel dentro de cada barbearia.
--
-- Antes, cada regra de acesso era uma lista de papéis fixa no código (por exemplo
-- `has_shop_member_role(shop_id, array['owner','partner'])`). Esta migration cria uma
-- matriz persistida por barbearia e troca esses pontos por consultas à matriz.
--
-- Ponto crítico de segurança: o padrão de cada permissão (`shop_permission_default`)
-- reproduz exatamente o comportamento anterior. Não há linha na tabela por padrão, e
-- a ausência de linha significa "usar o padrão". Portanto, aplicar esta migration sem
-- nenhuma configuração não altera quem vê o quê.
--
-- O Admin Global (plataforma) é isento: sempre tem acesso total e não depende da matriz.

create table public.shop_role_permissions (
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  role public.shop_member_role not null,
  permission text not null,
  allowed boolean not null,
  updated_at timestamptz not null default now(),
  primary key (barbershop_id, role, permission)
);

comment on table public.shop_role_permissions is
  'Sobrescritas da matriz de permissões por barbearia. Ausência de linha = usar o padrão de shop_permission_default.';

-- ---------------------------------------------------------------------------
-- Catálogo de permissões
-- ---------------------------------------------------------------------------

create or replace function public.shop_permission_catalog()
returns table(permission text, label text, description text, sort_order int)
language sql immutable set search_path=public as $$
  values
    ('view_agenda_all','Visão geral da agenda','Ver a agenda de todos os profissionais da unidade',10),
    ('view_financial_all','Fluxo de caixa da loja','Ver faturamento e valores de toda a barbearia',20),
    ('view_reports_global','Relatórios da unidade','Acessar métricas completas e identificadas da unidade',30),
    ('view_reports_anonymized','Indicadores gerais anonimizados','Ver números gerais da loja sem identificar quem é quem',40),
    ('view_own_score','Indicadores próprios','Acompanhar o próprio movimento e desempenho',50),
    ('view_own_earnings','Próprios valores recebidos','Ver quanto recebeu pelos próprios atendimentos',60),
    ('manage_services','Gerenciar catálogo geral','Criar, editar e alterar preços dos serviços da unidade',70),
    ('manage_own_services','Gerenciar próprios serviços','Editar preço, duração e disponibilidade dos próprios serviços',80),
    ('manage_operations','Gerenciar funcionamento','Definir horários de funcionamento, bloqueios gerais e ajustes da loja',90),
    ('manage_team','Gerenciar equipe','Convidar profissionais e alterar funções',100),
    ('manage_permissions','Alterar permissões','Editar esta matriz de acessos',110)
$$;

/** Padrão de cada papel. Reproduz exatamente as regras que existiam antes desta migration. */
create or replace function public.shop_permission_default(
  p_role public.shop_member_role,
  p_permission text
) returns boolean language sql immutable set search_path=public as $$
  select case p_permission
    -- Dono e sócio operam a unidade inteira.
    when 'view_agenda_all'         then p_role in ('owner','partner')
    when 'view_financial_all'      then p_role in ('owner','partner')
    when 'view_reports_global'     then p_role in ('owner','partner')
    when 'manage_services'         then p_role in ('owner','partner')
    when 'manage_operations'       then p_role in ('owner','partner')
    when 'manage_team'             then p_role in ('owner','partner')
    when 'manage_permissions'      then p_role in ('owner','partner')
    -- Parceiro tem ambiente próprio: indicadores gerais sem identificação e
    -- autonomia sobre os próprios serviços e valores.
    when 'view_reports_anonymized' then p_role = 'associate'
    when 'manage_own_services'     then p_role in ('owner','partner','associate')
    when 'view_own_earnings'       then p_role in ('owner','partner','associate')
    -- Contratado vê o próprio score, sem valores recebidos.
    when 'view_own_score'          then true
    else false
  end
$$;

-- ---------------------------------------------------------------------------
-- Resolução para o usuário atual
-- ---------------------------------------------------------------------------

/** Papel ativo do usuário atual na barbearia, ou nulo se não for membro. */
create or replace function public.current_shop_role(p_shop_id uuid)
returns public.shop_member_role language sql stable security definer set search_path=public as $$
  select sm.role from public.shop_members sm
  where sm.barbershop_id = p_shop_id and sm.user_id = auth.uid() and sm.active
  limit 1
$$;

/**
 * Permissão efetiva do usuário atual na barbearia.
 * O Admin Global sempre recebe `true`; quem não é membro sempre recebe `false`.
 */
create or replace function public.shop_permission_granted(p_shop_id uuid, p_permission text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare actor_role public.shop_member_role; stored boolean;
begin
  if public.is_platform_admin() then return true; end if;
  actor_role := public.current_shop_role(p_shop_id);
  if actor_role is null then return false; end if;
  select srp.allowed into stored from public.shop_role_permissions srp
    where srp.barbershop_id = p_shop_id and srp.role = actor_role and srp.permission = p_permission;
  if stored is null then return public.shop_permission_default(actor_role, p_permission); end if;
  return stored;
end $$;

/** Permissão efetiva de um papel específico (usada pela UI e por regras compostas). */
create or replace function public.shop_role_permission_value(
  p_shop_id uuid,
  p_role public.shop_member_role,
  p_permission text
) returns boolean language plpgsql stable security definer set search_path=public as $$
declare stored boolean;
begin
  select srp.allowed into stored from public.shop_role_permissions srp
    where srp.barbershop_id = p_shop_id and srp.role = p_role and srp.permission = p_permission;
  if stored is null then return public.shop_permission_default(p_role, p_permission); end if;
  return stored;
end $$;

-- ---------------------------------------------------------------------------
-- Leitura e gravação da matriz
-- ---------------------------------------------------------------------------

/** Matriz completa (padrões já resolvidos) para exibição e edição. */
create or replace function public.get_shop_permissions(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare allowed boolean;
begin
  allowed := public.is_platform_admin()
    or public.shop_permission_granted(p_shop_id,'manage_permissions')
    or public.can_apply_protected_change(p_shop_id);
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
    ),'{}'::jsonb)
  );
end $$;

/**
 * Grava a matriz. Só armazena o que difere do padrão, para que ajustes futuros nos
 * padrões alcancem quem nunca personalizou nada.
 * Exige a mesma governança das demais mudanças protegidas.
 */
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
  if not (public.is_platform_admin() or public.can_apply_protected_change(p_shop_id)) then
    raise exception 'Not allowed' using errcode='42501';
  end if;
  if p_matrix is null or jsonb_typeof(p_matrix) <> 'object' then
    raise exception 'Matriz inválida' using errcode='22023';
  end if;

  -- Evita que a loja perca o acesso à própria configuração de permissões.
  if p_matrix ? 'owner' and (p_matrix->'owner') ? 'manage_permissions'
     and coalesce((p_matrix->'owner'->>'manage_permissions')::boolean, false) is not true then
    raise exception 'O dono precisa manter a gestão de permissões' using errcode='22023';
  end if;

  -- Valida tudo antes de gravar: nenhuma linha é alterada se algo estiver inválido.
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

  -- Só substitui os papéis enviados; os demais mantêm o que já estava configurado.
  delete from public.shop_role_permissions
    where barbershop_id = p_shop_id and role = any (touched);

  for role_name, entry in select r.key, r.value from jsonb_each(p_matrix) r loop
    target_role := role_name::public.shop_member_role;
    for permission_name in select p.key from jsonb_each(entry) p loop
      flag := (entry ->> permission_name)::boolean;
      -- Guarda apenas o que difere do padrão: ajustes futuros no padrão alcançam
      -- quem nunca personalizou aquela permissão.
      if flag is distinct from public.shop_permission_default(target_role, permission_name) then
        insert into public.shop_role_permissions(barbershop_id, role, permission, allowed)
        values (p_shop_id, target_role, permission_name, flag);
      end if;
    end loop;
  end loop;

  return public.get_shop_permissions(p_shop_id);
end $$;

-- ---------------------------------------------------------------------------
-- Gates de capacidade consultados pelas políticas
-- ---------------------------------------------------------------------------

create or replace function public.can_view_full_shop(p_shop_id uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
begin
  if public.is_platform_admin() then return true; end if;
  if public.has_shop_role(p_shop_id,array['shop_admin']::public.app_role[]) then return true; end if;
  return public.shop_permission_granted(p_shop_id,'view_agenda_all');
end $$;

create or replace function public.shop_can_view_financials(p_shop_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or public.shop_permission_granted(p_shop_id,'view_financial_all')
$$;

create or replace function public.shop_can_manage_services(p_shop_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or public.shop_permission_granted(p_shop_id,'manage_services')
$$;

create or replace function public.shop_can_manage_own_services(p_shop_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or public.shop_permission_granted(p_shop_id,'manage_own_services')
$$;

create or replace function public.shop_can_manage_team(p_shop_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or public.shop_permission_granted(p_shop_id,'manage_team')
$$;

create or replace function public.shop_can_manage_operations(p_shop_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or public.shop_permission_granted(p_shop_id,'manage_operations')
$$;

-- ---------------------------------------------------------------------------
-- Políticas: capacidade (matriz) + governança (sociedade) continuam separadas.
-- A governança segue decidindo se uma mudança pode ser aplicada sozinha; a matriz
-- decide quem tem a capacidade. Os padrões mantêm o resultado anterior.
-- ---------------------------------------------------------------------------

drop policy "Owners manage team" on public.shop_members;
create policy "Owners manage team" on public.shop_members for all to authenticated using(
  public.is_platform_admin() or (public.can_apply_protected_change(barbershop_id)
    and public.shop_can_manage_team(barbershop_id)))
with check(public.is_platform_admin() or (public.can_apply_protected_change(barbershop_id)
  and public.shop_can_manage_team(barbershop_id)));

drop policy "Manage professional services" on public.staff_services;
create policy "Manage professional services" on public.staff_services for all to authenticated using(
  public.is_platform_admin()
  or (public.current_staff_id(barbershop_id)=staff_id and public.shop_can_manage_own_services(barbershop_id))
  or (public.can_apply_protected_change(barbershop_id) and public.shop_can_manage_services(barbershop_id)))
with check(public.is_platform_admin()
  or (public.current_staff_id(barbershop_id)=staff_id and public.shop_can_manage_own_services(barbershop_id))
  or (public.can_apply_protected_change(barbershop_id) and public.shop_can_manage_services(barbershop_id)));

drop policy "Professionals manage own blocks" on public.availability_blocks;
create policy "Professionals manage own blocks" on public.availability_blocks for all to authenticated using(
  staff_id=public.current_staff_id(barbershop_id)
    and public.shop_can_manage_own_services(barbershop_id))
with check(staff_id=public.current_staff_id(barbershop_id)
  and public.shop_can_manage_own_services(barbershop_id));

drop policy "Owners partners manage staff" on public.staff;
create policy "Owners partners manage staff" on public.staff for all to authenticated using(
  public.is_platform_admin() or (public.can_apply_protected_change(barbershop_id)
    and public.shop_can_manage_team(barbershop_id)))
with check(public.is_platform_admin() or (public.can_apply_protected_change(barbershop_id)
  and public.shop_can_manage_team(barbershop_id)));

drop policy "Owners partners update settings" on public.barbershop_settings;
create policy "Owners partners update settings" on public.barbershop_settings for update to authenticated using(
  public.is_platform_admin() or (public.can_apply_protected_change(barbershop_id)
    and public.shop_can_manage_operations(barbershop_id)))
with check(public.is_platform_admin() or (public.can_apply_protected_change(barbershop_id)
  and public.shop_can_manage_operations(barbershop_id)));

-- ---------------------------------------------------------------------------
-- RLS da nova tabela
-- ---------------------------------------------------------------------------

alter table public.shop_role_permissions enable row level security;

create policy "Members read own shop permissions" on public.shop_role_permissions
  for select to authenticated using(
    public.is_platform_admin()
    or public.shop_permission_granted(barbershop_id,'manage_permissions')
    or public.can_apply_protected_change(barbershop_id));

create policy "Managers write shop permissions" on public.shop_role_permissions
  for all to authenticated using(
    public.is_platform_admin() or public.can_apply_protected_change(barbershop_id))
  with check(public.is_platform_admin() or public.can_apply_protected_change(barbershop_id));

-- ---------------------------------------------------------------------------
-- RPCs que dependiam de papéis fixos
-- ---------------------------------------------------------------------------

create or replace function public.get_professional_insights(p_shop_id uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid; member_role public.shop_member_role; full_access boolean;
  show_earnings boolean; show_anonymized boolean;
begin
  if p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid period' using errcode='22023'; end if;
  select sm.staff_id,sm.role into mine,member_role from public.shop_members sm
  where sm.barbershop_id=p_shop_id and sm.user_id=auth.uid() and sm.active limit 1;
  full_access:=public.is_platform_admin() or public.can_view_full_shop(p_shop_id);
  if not full_access and mine is null then raise exception 'Not allowed' using errcode='42501'; end if;
  show_earnings:=public.shop_permission_granted(p_shop_id,'view_own_earnings');
  show_anonymized:=public.shop_permission_granted(p_shop_id,'view_reports_anonymized');
  return jsonb_build_object(
    'scope',case when full_access then 'shop' when show_anonymized then 'own_with_global' else 'own_score' end,
    'own',coalesce((select jsonb_build_object(
      'bookings',count(*),'completed',count(*) filter(where status='completed'),
      'cancelled',count(*) filter(where status='cancelled'),
      'customers',count(distinct customer_id),
      'quoted_cents',case when full_access or show_earnings
        then coalesce(sum(booked_price_cents) filter(where status='completed'),0) else null end
    ) from public.appointments where barbershop_id=p_shop_id and starts_at>=p_from and starts_at<p_to
      and (full_access or staff_id=mine)),'{}'::jsonb),
    'global',case when not full_access and show_anonymized then coalesce((select jsonb_build_object(
      'bookings',count(*),'completed',count(*) filter(where status='completed'),
      'cancelled',count(*) filter(where status='cancelled'),
      'no_show_rate',round(100.0*count(*) filter(where f.no_show_at is not null)/nullif(count(*),0),1)
    ) from public.appointments a left join public.appointment_facts f on f.appointment_id=a.id
      where a.barbershop_id=p_shop_id and a.starts_at>=p_from and a.starts_at<p_to
      having count(*)>=5),'{}'::jsonb) else null end
  );
end $$;

-- O painel de negócio passa a aceitar quem tem a permissão de caixa, não apenas o
-- papel legado `shop_admin` (o sócio já via os números na interface e não conseguia
-- ler aqui). O corpo é idêntico ao da migration 20260916180000; só a permissão mudou.
create or replace function public.get_business_insights(p_shop_id uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; rating_sample bigint; improvement_sample bigint; cancellation_sample bigint;
begin
  if auth.uid() is null or not (is_platform_admin() or (p_shop_id is not null and (has_shop_role(p_shop_id,array['shop_admin']::app_role[]) or shop_can_view_financials(p_shop_id)))) then raise exception 'Not allowed'; end if;
  if p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid period'; end if;
  select jsonb_build_object(
    'bookings',count(*),'customers',count(distinct a.customer_id),
    'completed',count(*) filter(where a.status='completed'),
    'cancelled',count(*) filter(where a.status='cancelled' and f.no_show_at is null),
    'no_shows',count(*) filter(where f.no_show_at is not null),
    'quoted_completed_cents',coalesce(sum(f.quoted_price_cents) filter(where a.status='completed'),0),
    'missing_price',count(*) filter(where f.quoted_price_cents is null),
    'wait_sample',count(*) filter(where f.arrived_at is not null and f.started_at is not null),
    'mean_wait_minutes',avg(extract(epoch from(f.started_at-f.arrived_at))/60) filter(where f.started_at is not null)
  ) into result from appointments a left join appointment_facts f on f.appointment_id=a.id
  where (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;

  select count(*) into rating_sample from customer_surveys s join appointments a on a.id=s.appointment_id
  where s.question='satisfaction' and s.state='answered' and s.answer in ('1','2','3','4','5')
    and (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;
  select count(*) into improvement_sample from customer_surveys s join appointments a on a.id=s.appointment_id
  where s.question='improvement' and s.state='answered' and s.answer<>'skip'
    and (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;
  select count(*) into cancellation_sample from appointment_cancellations c join appointments a on a.id=c.appointment_id
  where c.reason is not null and (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;

  return result || jsonb_build_object(
    'usage',coalesce((select jsonb_object_agg(event,total) from(select event,count(*) total from customer_usage_events where(p_shop_id is null or barbershop_id=p_shop_id)and received_at>=p_from and received_at<p_to group by event)counts),'{}'::jsonb),
    'rating_sample',rating_sample,
    'rating_average',case when rating_sample>=5 then(select round(avg(s.answer::numeric),2) from customer_surveys s join appointments a on a.id=s.appointment_id where s.question='satisfaction' and s.state='answered' and s.answer in('1','2','3','4','5')and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to)else null end,
    'rating_distribution',case when rating_sample>=5 then coalesce((select jsonb_object_agg(answer,total)from(select s.answer,count(*) total from customer_surveys s join appointments a on a.id=s.appointment_id where s.question='satisfaction'and s.state='answered'and s.answer in('1','2','3','4','5')and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to group by s.answer)ratings),'{}'::jsonb)else '{}'::jsonb end,
    'improvement_sample',improvement_sample,
    'improvement_counts',case when improvement_sample>=5 then coalesce((select jsonb_object_agg(answer,total)from(select s.answer,count(*) total from customer_surveys s join appointments a on a.id=s.appointment_id where s.question='improvement'and s.state='answered'and s.answer<>'skip'and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to group by s.answer)improvements),'{}'::jsonb)else '{}'::jsonb end,
    'cancellation_reason_sample',cancellation_sample,
    'cancellation_reason_counts',case when cancellation_sample>=5 then coalesce((select jsonb_object_agg(reason,total)from(select c.reason,count(*) total from appointment_cancellations c join appointments a on a.id=c.appointment_id where c.reason is not null and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to group by c.reason)cancellations),'{}'::jsonb)else '{}'::jsonb end
  );
end $$;

grant select on public.shop_role_permissions to authenticated;
grant execute on function public.shop_permission_catalog(),
  public.shop_permission_default(public.shop_member_role,text),
  public.current_shop_role(uuid),
  public.shop_permission_granted(uuid,text),
  public.shop_role_permission_value(uuid,public.shop_member_role,text),
  public.get_shop_permissions(uuid),
  public.save_shop_permissions(uuid,jsonb),
  public.shop_can_view_financials(uuid),
  public.shop_can_manage_services(uuid),
  public.shop_can_manage_own_services(uuid),
  public.shop_can_manage_team(uuid),
  public.shop_can_manage_operations(uuid)
to authenticated;
