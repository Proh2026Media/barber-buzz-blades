-- Clube de pontos como módulo por loja.
-- Regras de proteção do cliente:
--  * crédito único por atendimento concluído (índice único já existente) e bônus de boas-vindas único;
--  * cada crédito grava a versão da regra; mudar a regra não altera o que já foi creditado;
--  * nível calculado pelo total ganho na vida (resgates não derrubam o nível);
--  * saldo nunca negativo (check + bloqueio da linha);
--  * ajuste manual só por dono/sócio, com motivo (>= 10 caracteres) e limite de ±1000;
--  * resgate reserva os pontos e devolve se cancelado ou não entregue em 30 dias;
--  * módulo desligado congela créditos e novos resgates, sem apagar saldo nem histórico.

-- ---------------------------------------------------------------------------
-- 1. Interruptor do módulo (só admin da plataforma), como o de esportes
-- ---------------------------------------------------------------------------

alter table public.barbershop_settings
  add column if not exists loyalty_enabled boolean not null default false;

-- Lojas que já usam pontos continuam com o clube ligado.
update public.barbershop_settings s
set loyalty_enabled = true
where exists (select 1 from public.loyalty_accounts la where la.barbershop_id = s.barbershop_id);

create or replace function public.guard_shop_loyalty_module() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.loyalty_enabled)
     or (tg_op = 'UPDATE' and new.loyalty_enabled is distinct from old.loyalty_enabled) then
    if auth.uid() is null or not public.is_platform_admin() then
      raise exception 'Only platform admins can change loyalty module' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists barbershop_settings_guard_loyalty on public.barbershop_settings;
create trigger barbershop_settings_guard_loyalty
  before insert or update on public.barbershop_settings
  for each row execute function public.guard_shop_loyalty_module();

create or replace function public.set_shop_loyalty_module(p_shop_id uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_enabled is null then raise exception 'Enabled is required'; end if;
  update public.barbershop_settings set loyalty_enabled = p_enabled where barbershop_id = p_shop_id;
  if not found then raise exception 'Shop not found' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.set_shop_loyalty_module(uuid, boolean) from public, anon;
grant execute on function public.set_shop_loyalty_module(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Regra da loja (padrão ou versão própria)
-- ---------------------------------------------------------------------------

create or replace function public.loyalty_default_tiers() returns jsonb
language sql immutable as $$
  select '[
    {"name": "Classic", "min_points": 0, "benefit": ""},
    {"name": "Select", "min_points": 100, "benefit": ""},
    {"name": "Privilege", "min_points": 300, "benefit": ""},
    {"name": "Exclusive", "min_points": 500, "benefit": ""}
  ]'::jsonb
$$;

-- Níveis: 1 a 6, o primeiro em 0, mínimos crescentes, nomes únicos (1-30), benefício até 160.
create or replace function public.loyalty_tiers_valid(p_tiers jsonb) returns boolean
language plpgsql immutable as $$
declare
  item jsonb;
  prev int := -1;
  idx int := 0;
  nm text;
  pts int;
  names text[] := '{}';
begin
  if p_tiers is null or jsonb_typeof(p_tiers) <> 'array' then return false; end if;
  if jsonb_array_length(p_tiers) < 1 or jsonb_array_length(p_tiers) > 6 then return false; end if;
  for item in select value from jsonb_array_elements(p_tiers) loop
    if jsonb_typeof(item) <> 'object' then return false; end if;
    nm := btrim(coalesce(item ->> 'name', ''));
    if char_length(nm) < 1 or char_length(nm) > 30 then return false; end if;
    if lower(nm) = any (names) then return false; end if;
    names := names || lower(nm);
    if jsonb_typeof(item -> 'min_points') <> 'number' then return false; end if;
    pts := (item ->> 'min_points')::numeric::int;
    if (item ->> 'min_points')::numeric <> pts then return false; end if;
    if idx = 0 and pts <> 0 then return false; end if;
    if pts <= prev or pts > 1000000 then return false; end if;
    if char_length(coalesce(item ->> 'benefit', '')) > 160 then return false; end if;
    prev := pts;
    idx := idx + 1;
  end loop;
  return true;
exception when others then
  return false;
end $$;

create table if not exists public.loyalty_programs (
  barbershop_id uuid primary key references public.barbershops (id) on delete cascade,
  mode text not null default 'default' check (mode in ('default', 'custom')),
  points_per_visit int not null default 50 check (points_per_visit between 1 and 1000),
  welcome_bonus int not null default 0 check (welcome_bonus between 0 and 1000),
  tiers jsonb not null default public.loyalty_default_tiers()
    check (public.loyalty_tiers_valid(tiers)),
  version int not null default 1 check (version >= 1),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_program_versions (
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (barbershop_id, version)
);

alter table public.loyalty_programs enable row level security;
alter table public.loyalty_program_versions enable row level security;

drop policy if exists "Members read loyalty program" on public.loyalty_programs;
create policy "Members read loyalty program" on public.loyalty_programs
  for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['customer', 'shop_admin']::public.app_role[])
    or public.has_shop_member_role(
      barbershop_id, array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
    )
  );

drop policy if exists "Owners read loyalty versions" on public.loyalty_program_versions;
create policy "Owners read loyalty versions" on public.loyalty_program_versions
  for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_member_role(barbershop_id, array['owner', 'partner']::public.shop_member_role[])
  );

-- Regra em vigor: sem linha ou modo padrão = regra padrão do sistema (versão 0).
create or replace function public.loyalty_effective_program(p_shop_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object(
        'mode', 'custom',
        'points_per_visit', p.points_per_visit,
        'welcome_bonus', p.welcome_bonus,
        'tiers', p.tiers,
        'version', p.version)
     from public.loyalty_programs p
     where p.barbershop_id = p_shop_id and p.mode = 'custom'),
    jsonb_build_object(
      'mode', 'default',
      'points_per_visit', 50,
      'welcome_bonus', 0,
      'tiers', public.loyalty_default_tiers(),
      'version', coalesce(
        (select p.version from public.loyalty_programs p where p.barbershop_id = p_shop_id), 0))
  )
$$;

revoke all on function public.loyalty_effective_program(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- 3. Saldo, total da vida e livro-caixa
-- ---------------------------------------------------------------------------

alter table public.loyalty_accounts
  add column if not exists lifetime_points int not null default 0;

update public.loyalty_accounts la
set lifetime_points = greatest(
  la.points,
  coalesce((
    select sum(l.delta) from public.loyalty_ledger l
    where l.user_id = la.user_id and l.barbershop_id = la.barbershop_id and l.delta > 0
  ), 0)
);

alter table public.loyalty_accounts drop constraint if exists loyalty_accounts_lifetime_check;
alter table public.loyalty_accounts
  add constraint loyalty_accounts_lifetime_check check (lifetime_points >= 0);

alter table public.loyalty_ledger add column if not exists program_version int;
alter table public.loyalty_ledger add column if not exists note text;
alter table public.loyalty_ledger add column if not exists actor_id uuid references auth.users (id) on delete set null;
alter table public.loyalty_ledger add column if not exists redemption_id uuid;

alter table public.loyalty_ledger drop constraint if exists loyalty_ledger_reason_check;
alter table public.loyalty_ledger
  add constraint loyalty_ledger_reason_check check (
    reason in (
      'appointment_completed', 'welcome_bonus', 'manual_adjustment',
      'reward_redeemed', 'reward_refunded'
    )
  );

alter table public.loyalty_ledger drop constraint if exists loyalty_ledger_note_check;
alter table public.loyalty_ledger
  add constraint loyalty_ledger_note_check check (note is null or char_length(note) <= 240);

create unique index if not exists loyalty_ledger_welcome_once_idx
  on public.loyalty_ledger (user_id, barbershop_id) where reason = 'welcome_bonus';

-- ---------------------------------------------------------------------------
-- 4. Recompensas e resgates
-- ---------------------------------------------------------------------------

create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text not null default '' check (char_length(description) <= 200),
  cost_points int not null check (cost_points between 1 and 100000),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loyalty_rewards_shop_idx on public.loyalty_rewards (barbershop_id, active, sort_order);

create table if not exists public.loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid references public.loyalty_rewards (id) on delete set null,
  reward_name text not null,
  cost_points int not null check (cost_points > 0),
  status text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);

create index if not exists loyalty_redemptions_shop_status_idx
  on public.loyalty_redemptions (barbershop_id, status, created_at desc);
create index if not exists loyalty_redemptions_user_idx
  on public.loyalty_redemptions (user_id, barbershop_id, created_at desc);

alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_redemptions enable row level security;

drop policy if exists "Members read loyalty rewards" on public.loyalty_rewards;
create policy "Members read loyalty rewards" on public.loyalty_rewards
  for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['customer', 'shop_admin']::public.app_role[])
    or public.has_shop_member_role(
      barbershop_id, array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
    )
  );

drop policy if exists "Read own or shop redemptions" on public.loyalty_redemptions;
create policy "Read own or shop redemptions" on public.loyalty_redemptions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or public.has_shop_member_role(
      barbershop_id, array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
    )
  );

-- Escrita só pelas funções abaixo.
revoke insert, update, delete on public.loyalty_programs, public.loyalty_program_versions,
  public.loyalty_rewards, public.loyalty_redemptions from anon, authenticated;
revoke insert, update, delete on public.loyalty_ledger, public.loyalty_accounts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Crédito por atendimento concluído
-- ---------------------------------------------------------------------------

create or replace function public.award_points_on_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  program jsonb;
  pts int;
  bonus int;
  ver int;
begin
  if new.status <> 'completed'
     or (tg_op = 'UPDATE' and old.status = 'completed')
     or new.customer_id is null then
    return new;
  end if;
  if not coalesce(
    (select s.loyalty_enabled from public.barbershop_settings s where s.barbershop_id = new.barbershop_id),
    false
  ) then
    return new;
  end if;

  program := public.loyalty_effective_program(new.barbershop_id);
  pts := (program ->> 'points_per_visit')::int;
  bonus := (program ->> 'welcome_bonus')::int;
  ver := (program ->> 'version')::int;

  insert into public.loyalty_ledger (user_id, barbershop_id, delta, reason, appointment_id, program_version)
  values (new.customer_id, new.barbershop_id, pts, 'appointment_completed', new.id, ver)
  on conflict (appointment_id)
    where reason = 'appointment_completed' and appointment_id is not null
    do nothing;
  if not found then return new; end if;

  if bonus > 0 then
    insert into public.loyalty_ledger (user_id, barbershop_id, delta, reason, appointment_id, program_version)
    values (new.customer_id, new.barbershop_id, bonus, 'welcome_bonus', new.id, ver)
    on conflict (user_id, barbershop_id) where reason = 'welcome_bonus' do nothing;
    if found then pts := pts + bonus; end if;
  end if;

  insert into public.loyalty_accounts (user_id, barbershop_id, points, lifetime_points)
  values (new.customer_id, new.barbershop_id, pts, pts)
  on conflict (user_id, barbershop_id) do update
    set points = public.loyalty_accounts.points + excluded.points,
        lifetime_points = public.loyalty_accounts.lifetime_points + excluded.lifetime_points,
        updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Funções de leitura
-- ---------------------------------------------------------------------------

create or replace function public.loyalty_can_view_shop(p_shop_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_platform_admin()
    or public.has_shop_role(p_shop_id, array['customer', 'shop_admin']::public.app_role[])
    or public.has_shop_member_role(
      p_shop_id, array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
    )
  )
$$;

create or replace function public.loyalty_can_manage(p_shop_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_platform_admin()
    or public.has_shop_member_role(p_shop_id, array['owner', 'partner']::public.shop_member_role[])
  )
$$;

create or replace function public.loyalty_can_staff(p_shop_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_platform_admin()
    or public.has_shop_role(p_shop_id, array['shop_admin']::public.app_role[])
    or public.has_shop_member_role(
      p_shop_id, array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
    )
  )
$$;

revoke all on function public.loyalty_can_view_shop(uuid) from public, anon;
revoke all on function public.loyalty_can_manage(uuid) from public, anon;
revoke all on function public.loyalty_can_staff(uuid) from public, anon;

-- Devolve os pontos de resgates vencidos (chamada pelas funções do clube; não precisa de agendador).
create or replace function public.loyalty_expire_redemptions(p_shop_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.loyalty_redemptions;
  n int := 0;
begin
  for r in
    select * from public.loyalty_redemptions
    where barbershop_id = p_shop_id and status = 'pending' and expires_at <= now()
    for update skip locked
  loop
    update public.loyalty_redemptions
      set status = 'expired', resolved_at = now()
      where id = r.id;
    insert into public.loyalty_ledger (user_id, barbershop_id, delta, reason, redemption_id, note)
    values (r.user_id, r.barbershop_id, r.cost_points, 'reward_refunded', r.id, 'expired');
    update public.loyalty_accounts
      set points = points + r.cost_points, updated_at = now()
      where user_id = r.user_id and barbershop_id = r.barbershop_id;
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.loyalty_expire_redemptions(uuid) from public, anon, authenticated;

create or replace function public.get_shop_loyalty_program(p_shop_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  enabled boolean;
begin
  if not public.loyalty_can_view_shop(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform public.loyalty_expire_redemptions(p_shop_id);
  select coalesce(s.loyalty_enabled, false) into enabled
  from public.barbershop_settings s where s.barbershop_id = p_shop_id;
  return public.loyalty_effective_program(p_shop_id)
    || jsonb_build_object(
      'enabled', coalesce(enabled, false),
      'rewards', coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', r.id, 'name', r.name, 'description', r.description,
            'cost_points', r.cost_points, 'active', r.active, 'sort_order', r.sort_order)
          order by r.sort_order, r.cost_points, r.name)
        from public.loyalty_rewards r
        where r.barbershop_id = p_shop_id
          and (r.active or public.loyalty_can_manage(p_shop_id))
      ), '[]'::jsonb)
    );
end $$;

revoke all on function public.get_shop_loyalty_program(uuid) from public, anon;
grant execute on function public.get_shop_loyalty_program(uuid) to authenticated;

create or replace function public.list_shop_loyalty_customers(
  p_shop_id uuid, p_search text default null, p_limit int default 50
) returns table (
  user_id uuid, full_name text, points int, lifetime_points int, updated_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.loyalty_can_staff(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select la.user_id, coalesce(p.full_name, ''), la.points, la.lifetime_points, la.updated_at
    from public.loyalty_accounts la
    left join public.profiles p on p.id = la.user_id
    where la.barbershop_id = p_shop_id
      and (q is null or p.full_name ilike '%' || q || '%')
    order by la.lifetime_points desc, la.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200));
end $$;

revoke all on function public.list_shop_loyalty_customers(uuid, text, int) from public, anon;
grant execute on function public.list_shop_loyalty_customers(uuid, text, int) to authenticated;

create or replace function public.list_shop_loyalty_redemptions(
  p_shop_id uuid, p_status text default 'pending'
) returns table (
  id uuid, user_id uuid, full_name text, reward_name text, cost_points int, status text,
  created_at timestamptz, expires_at timestamptz, resolved_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.loyalty_can_staff(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform public.loyalty_expire_redemptions(p_shop_id);
  return query
    select r.id, r.user_id, coalesce(p.full_name, ''), r.reward_name, r.cost_points, r.status,
      r.created_at, r.expires_at, r.resolved_at
    from public.loyalty_redemptions r
    left join public.profiles p on p.id = r.user_id
    where r.barbershop_id = p_shop_id
      and (p_status is null or r.status = p_status)
    order by r.created_at desc
    limit 200;
end $$;

revoke all on function public.list_shop_loyalty_redemptions(uuid, text) from public, anon;
grant execute on function public.list_shop_loyalty_redemptions(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Gestão (dono/sócio)
-- ---------------------------------------------------------------------------

create or replace function public.save_loyalty_program(
  p_shop_id uuid, p_mode text, p_points_per_visit int, p_welcome_bonus int, p_tiers jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cur public.loyalty_programs;
  next_version int;
  tiers jsonb;
begin
  if not public.loyalty_can_manage(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not coalesce((select loyalty_enabled from public.barbershop_settings where barbershop_id = p_shop_id), false) then
    raise exception 'O clube de pontos está desligado para esta barbearia' using errcode = '22023';
  end if;
  if p_mode not in ('default', 'custom') then
    raise exception 'Modo inválido' using errcode = '22023';
  end if;

  select * into cur from public.loyalty_programs where barbershop_id = p_shop_id for update;

  if p_mode = 'custom' then
    if p_points_per_visit is null or p_points_per_visit < 1 or p_points_per_visit > 1000 then
      raise exception 'Pontos por visita devem ficar entre 1 e 1000' using errcode = '22023';
    end if;
    if coalesce(p_welcome_bonus, 0) < 0 or coalesce(p_welcome_bonus, 0) > 1000 then
      raise exception 'Bônus de boas-vindas deve ficar entre 0 e 1000' using errcode = '22023';
    end if;
    if not public.loyalty_tiers_valid(p_tiers) then
      raise exception 'Níveis inválidos: de 1 a 6, o primeiro em 0 ponto, mínimos crescentes e nomes diferentes'
        using errcode = '22023';
    end if;
    select jsonb_agg(jsonb_build_object(
        'name', btrim(e ->> 'name'),
        'min_points', (e ->> 'min_points')::numeric::int,
        'benefit', btrim(coalesce(e ->> 'benefit', ''))) order by ord)
      into tiers
      from jsonb_array_elements(p_tiers) with ordinality as t(e, ord);
  end if;

  next_version := coalesce(cur.version, 0) + 1;

  insert into public.loyalty_programs as lp (
    barbershop_id, mode, points_per_visit, welcome_bonus, tiers, version, updated_by, updated_at
  ) values (
    p_shop_id, p_mode,
    case when p_mode = 'custom' then p_points_per_visit else 50 end,
    case when p_mode = 'custom' then coalesce(p_welcome_bonus, 0) else 0 end,
    case when p_mode = 'custom' then tiers else public.loyalty_default_tiers() end,
    next_version, auth.uid(), now()
  )
  on conflict (barbershop_id) do update set
    mode = excluded.mode,
    points_per_visit = excluded.points_per_visit,
    welcome_bonus = excluded.welcome_bonus,
    tiers = excluded.tiers,
    version = excluded.version,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  insert into public.loyalty_program_versions (barbershop_id, version, snapshot, created_by)
  values (p_shop_id, next_version, public.loyalty_effective_program(p_shop_id), auth.uid());

  return public.loyalty_effective_program(p_shop_id);
end $$;

revoke all on function public.save_loyalty_program(uuid, text, int, int, jsonb) from public, anon;
grant execute on function public.save_loyalty_program(uuid, text, int, int, jsonb) to authenticated;

create or replace function public.save_loyalty_reward(
  p_shop_id uuid, p_reward_id uuid, p_name text, p_description text, p_cost_points int,
  p_active boolean, p_sort_order int default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
begin
  if not public.loyalty_can_manage(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 60 then
    raise exception 'Nome da recompensa deve ter de 2 a 60 caracteres' using errcode = '22023';
  end if;
  if p_cost_points is null or p_cost_points < 1 or p_cost_points > 100000 then
    raise exception 'Custo em pontos deve ficar entre 1 e 100000' using errcode = '22023';
  end if;
  if p_reward_id is null then
    if (select count(*) from public.loyalty_rewards where barbershop_id = p_shop_id) >= 30 then
      raise exception 'Limite de 30 recompensas por barbearia' using errcode = '22023';
    end if;
    insert into public.loyalty_rewards (barbershop_id, name, description, cost_points, active, sort_order)
    values (p_shop_id, btrim(p_name), left(btrim(coalesce(p_description, '')), 200), p_cost_points,
      coalesce(p_active, true), coalesce(p_sort_order, 0))
    returning id into rid;
  else
    update public.loyalty_rewards set
      name = btrim(p_name),
      description = left(btrim(coalesce(p_description, '')), 200),
      cost_points = p_cost_points,
      active = coalesce(p_active, active),
      sort_order = coalesce(p_sort_order, sort_order),
      updated_at = now()
    where id = p_reward_id and barbershop_id = p_shop_id
    returning id into rid;
    if rid is null then raise exception 'Recompensa não encontrada' using errcode = 'P0002'; end if;
  end if;
  return rid;
end $$;

revoke all on function public.save_loyalty_reward(uuid, uuid, text, text, int, boolean, int) from public, anon;
grant execute on function public.save_loyalty_reward(uuid, uuid, text, text, int, boolean, int) to authenticated;

create or replace function public.adjust_loyalty_points(
  p_shop_id uuid, p_user_id uuid, p_delta int, p_reason text
) returns int
language plpgsql security definer set search_path = public as $$
declare
  acc public.loyalty_accounts;
  reason_text text := btrim(coalesce(p_reason, ''));
begin
  if not public.loyalty_can_manage(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not coalesce((select loyalty_enabled from public.barbershop_settings where barbershop_id = p_shop_id), false) then
    raise exception 'O clube de pontos está desligado para esta barbearia' using errcode = '22023';
  end if;
  if p_delta is null or p_delta = 0 or p_delta < -1000 or p_delta > 1000 then
    raise exception 'O ajuste deve ficar entre -1000 e 1000 pontos, diferente de zero' using errcode = '22023';
  end if;
  if char_length(reason_text) < 10 or char_length(reason_text) > 240 then
    raise exception 'Explique o motivo do ajuste (de 10 a 240 caracteres)' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Não é permitido ajustar os próprios pontos' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.loyalty_accounts where user_id = p_user_id and barbershop_id = p_shop_id
  ) and not exists (
    select 1 from public.memberships
    where user_id = p_user_id and barbershop_id = p_shop_id and role = 'customer'
  ) then
    raise exception 'Cliente não pertence a esta barbearia' using errcode = 'P0002';
  end if;

  insert into public.loyalty_accounts (user_id, barbershop_id, points)
  values (p_user_id, p_shop_id, 0)
  on conflict (user_id, barbershop_id) do nothing;

  select * into acc from public.loyalty_accounts
  where user_id = p_user_id and barbershop_id = p_shop_id for update;

  if acc.points + p_delta < 0 then
    raise exception 'O saldo do cliente não pode ficar negativo (saldo atual: %)', acc.points
      using errcode = '22023';
  end if;

  insert into public.loyalty_ledger (user_id, barbershop_id, delta, reason, note, actor_id, program_version)
  values (p_user_id, p_shop_id, p_delta, 'manual_adjustment', reason_text, auth.uid(),
    (public.loyalty_effective_program(p_shop_id) ->> 'version')::int);

  -- Correções para baixo mexem só no saldo; o nível conquistado é preservado.
  update public.loyalty_accounts set
    points = points + p_delta,
    lifetime_points = lifetime_points + greatest(p_delta, 0),
    updated_at = now()
  where user_id = p_user_id and barbershop_id = p_shop_id
  returning points into acc.points;

  return acc.points;
end $$;

revoke all on function public.adjust_loyalty_points(uuid, uuid, int, text) from public, anon;
grant execute on function public.adjust_loyalty_points(uuid, uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Resgate
-- ---------------------------------------------------------------------------

create or replace function public.request_loyalty_redemption(p_reward_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  rw public.loyalty_rewards;
  acc public.loyalty_accounts;
  rid uuid;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into rw from public.loyalty_rewards where id = p_reward_id;
  if rw.id is null or not rw.active then
    raise exception 'Recompensa indisponível' using errcode = 'P0002';
  end if;
  if not public.has_shop_role(rw.barbershop_id, array['customer']::public.app_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not coalesce((select loyalty_enabled from public.barbershop_settings where barbershop_id = rw.barbershop_id), false) then
    raise exception 'O clube de pontos está pausado nesta barbearia' using errcode = '22023';
  end if;
  perform public.loyalty_expire_redemptions(rw.barbershop_id);

  select * into acc from public.loyalty_accounts
  where user_id = auth.uid() and barbershop_id = rw.barbershop_id for update;
  if acc.user_id is null or acc.points < rw.cost_points then
    raise exception 'Pontos insuficientes para esta recompensa' using errcode = '22023';
  end if;
  if (select count(*) from public.loyalty_redemptions
      where user_id = auth.uid() and barbershop_id = rw.barbershop_id and status = 'pending') >= 3 then
    raise exception 'Você já tem 3 resgates aguardando retirada' using errcode = '22023';
  end if;

  insert into public.loyalty_redemptions (barbershop_id, user_id, reward_id, reward_name, cost_points)
  values (rw.barbershop_id, auth.uid(), rw.id, rw.name, rw.cost_points)
  returning id into rid;

  insert into public.loyalty_ledger (user_id, barbershop_id, delta, reason, redemption_id, note)
  values (auth.uid(), rw.barbershop_id, -rw.cost_points, 'reward_redeemed', rid, rw.name);

  update public.loyalty_accounts set points = points - rw.cost_points, updated_at = now()
  where user_id = auth.uid() and barbershop_id = rw.barbershop_id;

  return rid;
end $$;

revoke all on function public.request_loyalty_redemption(uuid) from public, anon;
grant execute on function public.request_loyalty_redemption(uuid) to authenticated;

-- 'fulfill' (entregue no balcão) pela equipe; 'cancel' pela equipe ou pelo próprio cliente, com devolução.
create or replace function public.resolve_loyalty_redemption(p_redemption_id uuid, p_action text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  r public.loyalty_redemptions;
  is_staff boolean;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into r from public.loyalty_redemptions where id = p_redemption_id for update;
  if r.id is null then raise exception 'Resgate não encontrado' using errcode = 'P0002'; end if;
  is_staff := public.loyalty_can_staff(r.barbershop_id);
  if p_action not in ('fulfill', 'cancel') then
    raise exception 'Ação inválida' using errcode = '22023';
  end if;
  if p_action = 'fulfill' and not is_staff then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_action = 'cancel' and not is_staff and r.user_id <> auth.uid() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if r.status <> 'pending' then
    return r.status;
  end if;
  if r.expires_at <= now() then
    perform public.loyalty_expire_redemptions(r.barbershop_id);
    return 'expired';
  end if;

  if p_action = 'fulfill' then
    update public.loyalty_redemptions
      set status = 'fulfilled', resolved_at = now(), resolved_by = auth.uid()
      where id = r.id;
    return 'fulfilled';
  end if;

  update public.loyalty_redemptions
    set status = 'cancelled', resolved_at = now(), resolved_by = auth.uid()
    where id = r.id;
  insert into public.loyalty_ledger (user_id, barbershop_id, delta, reason, redemption_id, actor_id, note)
  values (r.user_id, r.barbershop_id, r.cost_points, 'reward_refunded', r.id, auth.uid(), 'cancelled');
  update public.loyalty_accounts set points = points + r.cost_points, updated_at = now()
  where user_id = r.user_id and barbershop_id = r.barbershop_id;
  return 'cancelled';
end $$;

revoke all on function public.resolve_loyalty_redemption(uuid, text) from public, anon;
grant execute on function public.resolve_loyalty_redemption(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Saída de profissional levando a carteira: devolve resgates pendentes na origem,
--    leva saldo e total da vida, e não duplica o bônus de boas-vindas no destino.
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

-- ---------------------------------------------------------------------------
-- 10. Exportação de dados do cliente inclui os resgates
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'format_version', 2,
    'exported_at', now(),
    'account', (
      select jsonb_build_object('id', id, 'email', email, 'phone', phone, 'created_at', created_at)
      from auth.users where id = auth.uid()
    ),
    'profile', (select to_jsonb(p) from profiles p where id = auth.uid()),
    'appointments', coalesce((
      select jsonb_agg(
        to_jsonb(a) || jsonb_build_object(
          'service_name', s.name,
          'staff_name', t.display_name,
          'shop_name', b.name
        )
        order by a.starts_at desc
      )
      from appointments a
      join services s on s.id = a.service_id
      join staff t on t.id = a.staff_id
      join barbershops b on b.id = a.barbershop_id
      where a.customer_id = auth.uid()
    ), '[]'::jsonb),
    'appointment_facts', coalesce((
      select jsonb_agg(to_jsonb(f) - 'recorded_by')
      from appointment_facts f
      join appointments a on a.id = f.appointment_id
      where a.customer_id = auth.uid()
    ), '[]'::jsonb),
    'appointment_history', coalesce((
      select jsonb_agg(to_jsonb(h) - 'actor_id' order by h.recorded_at)
      from appointment_history h
      join appointments a on a.id = h.appointment_id
      where a.customer_id = auth.uid()
    ), '[]'::jsonb),
    'loyalty_accounts', coalesce((
      select jsonb_agg(to_jsonb(la) || jsonb_build_object('shop_name', b.name))
      from loyalty_accounts la
      join barbershops b on b.id = la.barbershop_id
      where la.user_id = auth.uid()
    ), '[]'::jsonb),
    'loyalty', coalesce((
      select jsonb_agg(to_jsonb(l))
      from loyalty_ledger l
      where user_id = auth.uid()
    ), '[]'::jsonb),
    'loyalty_redemptions', coalesce((
      select jsonb_agg(to_jsonb(r) - 'resolved_by' || jsonb_build_object('shop_name', b.name)
        order by r.created_at desc)
      from loyalty_redemptions r
      join barbershops b on b.id = r.barbershop_id
      where r.user_id = auth.uid()
    ), '[]'::jsonb),
    'privacy', get_my_privacy(),
    'usage', coalesce((
      select jsonb_agg(e order by received_at)
      from customer_usage_events e
      where user_id = auth.uid()
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(r order by created_at desc)
      from privacy_requests r
      where user_id = auth.uid()
    ), '[]'::jsonb)
  );
end;
$function$;

notify pgrst, 'reload schema';
