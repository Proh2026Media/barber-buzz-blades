-- P-10: pausa fixa semanal (ex.: almoço de segunda a sábado, 12:00–13:00).
--
-- A regra fica em `availability_block_rules` e vira bloqueios comuns em `availability_blocks`
-- (coluna `rule_id`) para os próximos 120 dias. Assim a lista de horários livres, a validação da
-- reserva, a agenda e a página pública continuam lendo só a tabela de bloqueios, sem mudança.
--   * Criar a regra gera os bloqueios na hora; `extend_availability_block_rules()` (chamada de hora
--     em hora pela função whatsapp-dispatch) estende a janela sem recriar dias já gerados, então
--     apagar o bloqueio de um dia ("hoje não tem almoço") vale só para aquele dia.
--   * Apagar a regra apaga os bloqueios futuros dela; os passados ficam como histórico.
--   * Mesmas permissões dos bloqueios: o profissional só na própria agenda (`manage_own_blocks`);
--     a loja inteira e os colegas, quem aplica mudanças e gerencia o funcionamento, o `shop_admin`
--     antigo e o admin da plataforma. Sociedade que exige aprovação não cria pausa da loja
--     (a tela avisa); a regra não passa pela fila de pedidos.

create table if not exists public.availability_block_rules (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  weekdays smallint[] not null,
  start_time time not null,
  end_time time not null,
  reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  materialized_until date,
  constraint availability_block_rules_time_order check (end_time > start_time),
  constraint availability_block_rules_weekdays check (
    cardinality(weekdays) between 1 and 7
    and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  constraint availability_block_rules_reason_len check (reason is null or char_length(reason) <= 120)
);

create index if not exists availability_block_rules_shop_idx
  on public.availability_block_rules (barbershop_id);

alter table public.availability_block_rules enable row level security;

alter table public.availability_blocks
  add column if not exists rule_id uuid
  references public.availability_block_rules(id) on delete set null;

create index if not exists availability_blocks_rule_idx
  on public.availability_blocks (rule_id, starts_at)
  where rule_id is not null;

-- ---------------------------------------------------------------------------
-- Permissões da regra (iguais às dos bloqueios)
-- ---------------------------------------------------------------------------

drop policy if exists "Team reads block rules" on public.availability_block_rules;
create policy "Team reads block rules"
  on public.availability_block_rules for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
    or public.can_view_full_shop(barbershop_id)
    or (
      public.has_shop_member_role(
        barbershop_id,
        array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
      )
      and (staff_id is null or staff_id = public.current_staff_id(barbershop_id))
    )
  );

drop policy if exists "Professionals manage own block rules" on public.availability_block_rules;
create policy "Professionals manage own block rules"
  on public.availability_block_rules for all to authenticated
  using (
    staff_id = public.current_staff_id(barbershop_id)
    and public.shop_permission_granted(barbershop_id, 'manage_own_blocks')
  )
  with check (
    staff_id = public.current_staff_id(barbershop_id)
    and public.shop_permission_granted(barbershop_id, 'manage_own_blocks')
  );

drop policy if exists "Team managers manage block rules" on public.availability_block_rules;
create policy "Team managers manage block rules"
  on public.availability_block_rules for all to authenticated
  using (
    public.can_apply_protected_change(barbershop_id)
    and public.shop_can_manage_operations(barbershop_id)
  )
  with check (
    public.can_apply_protected_change(barbershop_id)
    and public.shop_can_manage_operations(barbershop_id)
  );

drop policy if exists "Admins manage block rules" on public.availability_block_rules;
create policy "Admins manage block rules"
  on public.availability_block_rules for all to authenticated
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  );

revoke all on public.availability_block_rules from anon;
grant select, insert, delete on public.availability_block_rules to authenticated;
grant all on public.availability_block_rules to service_role;

-- ---------------------------------------------------------------------------
-- Regra → bloqueios
-- ---------------------------------------------------------------------------

create or replace function public.materialize_block_rule(p_rule_id uuid, p_horizon_days integer default 120)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.availability_block_rules;
  tz text;
  today date;
  from_day date;
  to_day date;
  d date;
  starts timestamptz;
  ends timestamptz;
  created integer := 0;
  previous text := current_setting('app.approved_shop_change', true);
begin
  select * into r from public.availability_block_rules where id = p_rule_id;
  if not found then return 0; end if;

  tz := public.shop_tz(r.barbershop_id);
  today := (now() at time zone tz)::date;
  from_day := greatest(coalesce(r.materialized_until + 1, today), today);
  to_day := today + greatest(coalesce(p_horizon_days, 120), 1);
  if from_day > to_day then return 0; end if;

  -- Bloqueio gerado pela regra já autorizada: não passa de novo pela governança.
  perform set_config('app.approved_shop_change', 'on', true);
  for d in select generate_series(from_day, to_day, interval '1 day')::date loop
    if extract(dow from d)::smallint = any (r.weekdays) then
      starts := (d + r.start_time) at time zone tz;
      ends := (d + r.end_time) at time zone tz;
      if ends > now() and not exists (
        select 1 from public.availability_blocks b
        where b.rule_id = r.id and b.starts_at = starts
      ) then
        insert into public.availability_blocks (barbershop_id, staff_id, starts_at, ends_at, reason, rule_id)
        values (r.barbershop_id, r.staff_id, starts, ends, r.reason, r.id);
        created := created + 1;
      end if;
    end if;
  end loop;
  perform set_config('app.approved_shop_change', coalesce(previous, ''), true);

  update public.availability_block_rules set materialized_until = to_day where id = r.id;
  return created;
end;
$$;

create or replace function public.availability_block_rules_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.materialize_block_rule(new.id);
  return null;
end;
$$;

drop trigger if exists availability_block_rules_materialize on public.availability_block_rules;
create trigger availability_block_rules_materialize
  after insert on public.availability_block_rules
  for each row execute function public.availability_block_rules_after_insert();

create or replace function public.availability_block_rules_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  previous text := current_setting('app.approved_shop_change', true);
begin
  perform set_config('app.approved_shop_change', 'on', true);
  delete from public.availability_blocks
  where rule_id = old.id and ends_at > now();
  update public.availability_blocks set rule_id = null where rule_id = old.id;
  perform set_config('app.approved_shop_change', coalesce(previous, ''), true);
  return old;
end;
$$;

drop trigger if exists availability_block_rules_clear_future on public.availability_block_rules;
create trigger availability_block_rules_clear_future
  before delete on public.availability_block_rules
  for each row execute function public.availability_block_rules_before_delete();

create or replace function public.extend_availability_block_rules()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  total integer := 0;
begin
  for r in
    select id from public.availability_block_rules
    where materialized_until is null or materialized_until < current_date + 119
  loop
    total := total + public.materialize_block_rule(r.id);
  end loop;
  return total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lista de bloqueios com a regra (a tela agrupa os gerados por regra)
-- ---------------------------------------------------------------------------

drop function if exists public.list_shop_blocks(uuid, timestamptz);
create function public.list_shop_blocks(p_shop_id uuid, p_from timestamptz default now())
returns table (
  id uuid,
  barbershop_id uuid,
  staff_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  reason text,
  created_at timestamptz,
  staff_display_name text,
  rule_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_full boolean;
  v_own uuid;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  v_full := public.can_view_full_shop(p_shop_id);
  if not v_full and not public.has_shop_member_role(
    p_shop_id,
    array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_own := public.current_staff_id(p_shop_id);

  return query
  select b.id, b.barbershop_id, b.staff_id, b.starts_at, b.ends_at,
    case when v_full or b.staff_id is null or b.staff_id = v_own then b.reason end,
    b.created_at,
    case when v_full or b.staff_id = v_own then s.display_name end,
    b.rule_id
  from public.availability_blocks b
  left join public.staff s on s.id = b.staff_id
  where b.barbershop_id = p_shop_id
    and b.ends_at >= coalesce(p_from, now())
  order by b.starts_at;
end;
$$;

revoke all on function public.materialize_block_rule(uuid, integer) from public, anon, authenticated;
grant execute on function public.materialize_block_rule(uuid, integer) to service_role;
revoke all on function public.extend_availability_block_rules() from public, anon, authenticated;
grant execute on function public.extend_availability_block_rules() to service_role;
revoke all on function public.availability_block_rules_after_insert() from public, anon, authenticated;
revoke all on function public.availability_block_rules_before_delete() from public, anon, authenticated;
revoke all on function public.list_shop_blocks(uuid, timestamptz) from public, anon;
grant execute on function public.list_shop_blocks(uuid, timestamptz) to authenticated, service_role;

notify pgrst, 'reload schema';
