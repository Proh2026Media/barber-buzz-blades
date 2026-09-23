-- Fidelidade por barbearia + join_shop_as_customer (multi-loja por link).

-- ---------------------------------------------------------------------------
-- 1. loyalty_accounts: (user_id, barbershop_id)
-- ---------------------------------------------------------------------------

alter table public.loyalty_accounts
  add column if not exists barbershop_id uuid references public.barbershops (id) on delete cascade;

-- Backfill: primeira membership customer do usuário.
update public.loyalty_accounts la
set barbershop_id = sub.shop_id
from (
  select distinct on (m.user_id)
    m.user_id,
    m.barbershop_id as shop_id
  from public.memberships m
  where m.role = 'customer'
    and m.barbershop_id is not null
  order by m.user_id, m.created_at asc
) sub
where la.user_id = sub.user_id
  and la.barbershop_id is null;

-- Contas sem membership: descarta (não cria órfãs).
delete from public.loyalty_accounts where barbershop_id is null;

alter table public.loyalty_accounts
  alter column barbershop_id set not null;

alter table public.loyalty_accounts drop constraint if exists loyalty_accounts_pkey;

-- Pode haver duplicata user+shop se backfill colidir; consolidar.
with ranked as (
  select
    ctid,
    row_number() over (
      partition by user_id, barbershop_id
      order by points desc, updated_at desc nulls last
    ) as rn,
    sum(points) over (partition by user_id, barbershop_id) as total_points
  from public.loyalty_accounts
)
update public.loyalty_accounts la
set points = ranked.total_points
from ranked
where la.ctid = ranked.ctid
  and ranked.rn = 1;

delete from public.loyalty_accounts la
using (
  select ctid,
    row_number() over (
      partition by user_id, barbershop_id
      order by points desc, updated_at desc nulls last
    ) as rn
  from public.loyalty_accounts
) d
where la.ctid = d.ctid
  and d.rn > 1;

alter table public.loyalty_accounts
  add primary key (user_id, barbershop_id);

create index if not exists loyalty_accounts_barbershop_idx
  on public.loyalty_accounts (barbershop_id);

drop policy if exists "Users read own loyalty account" on public.loyalty_accounts;
create policy "Users read own loyalty account"
  on public.loyalty_accounts for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
    or public.has_shop_member_role(
      barbershop_id,
      array['owner', 'partner', 'associate']::public.shop_member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- 2. loyalty_ledger: barbershop_id
-- ---------------------------------------------------------------------------

alter table public.loyalty_ledger
  add column if not exists barbershop_id uuid references public.barbershops (id) on delete cascade;

update public.loyalty_ledger l
set barbershop_id = a.barbershop_id
from public.appointments a
where l.appointment_id = a.id
  and l.barbershop_id is null;

update public.loyalty_ledger l
set barbershop_id = sub.shop_id
from (
  select distinct on (m.user_id)
    m.user_id,
    m.barbershop_id as shop_id
  from public.memberships m
  where m.role = 'customer'
    and m.barbershop_id is not null
  order by m.user_id, m.created_at asc
) sub
where l.user_id = sub.user_id
  and l.barbershop_id is null;

delete from public.loyalty_ledger where barbershop_id is null;

alter table public.loyalty_ledger
  alter column barbershop_id set not null;

create index if not exists loyalty_ledger_user_shop_idx
  on public.loyalty_ledger (user_id, barbershop_id);

drop policy if exists "Users read own loyalty ledger" on public.loyalty_ledger;
create policy "Users read own loyalty ledger"
  on public.loyalty_ledger for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
    or public.has_shop_member_role(
      barbershop_id,
      array['owner', 'partner', 'associate']::public.shop_member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Premiação por loja do atendimento
-- ---------------------------------------------------------------------------

create or replace function public.award_points_on_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    insert into public.loyalty_ledger (user_id, barbershop_id, delta, reason, appointment_id)
    values (new.customer_id, new.barbershop_id, 50, 'appointment_completed', new.id)
    on conflict (appointment_id)
      where reason = 'appointment_completed' and appointment_id is not null
      do nothing;

    if found then
      insert into public.loyalty_accounts (user_id, barbershop_id, points)
      values (new.customer_id, new.barbershop_id, 50)
      on conflict (user_id, barbershop_id) do update
        set points = public.loyalty_accounts.points + 50,
            updated_at = now();
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Signup: loyalty só na loja vinculada
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

  if shop_ref is not null then
    target_shop_id := public.resolve_shop_by_slug(shop_ref);
  end if;

  if target_shop_id is null then
    select id into target_shop_id
    from public.barbershops
    where slug = 'arena-barber'
    limit 1;
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
-- 5. Join shop as customer (confirmação do link)
-- ---------------------------------------------------------------------------

create or replace function public.join_shop_as_customer(p_shop_ref text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  shop_row public.barbershops;
  already boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  sid := public.resolve_shop_by_slug(p_shop_ref);
  if sid is null then
    -- aceita uuid direto
    begin
      sid := p_shop_ref::uuid;
    exception when others then
      sid := null;
    end;
  end if;

  if sid is null then
    raise exception 'Barbearia não encontrada' using errcode = 'P0002';
  end if;

  select * into shop_row from public.barbershops where id = sid and status = 'active';
  if shop_row.id is null then
    raise exception 'Barbearia indisponível' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.barbershop_id = sid
      and m.role = 'customer'
  ) into already;

  if not already then
    insert into public.memberships (user_id, barbershop_id, role)
    values (auth.uid(), sid, 'customer');
  end if;

  insert into public.loyalty_accounts (user_id, barbershop_id, points)
  values (auth.uid(), sid, 0)
  on conflict (user_id, barbershop_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'already_member', already,
    'shop_id', shop_row.id,
    'shop_slug', shop_row.slug,
    'shop_name', shop_row.name
  );
end;
$$;

grant execute on function public.join_shop_as_customer(text) to authenticated;

create or replace function public.get_shop_join_preview(p_shop_ref text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sid uuid;
  shop_row public.barbershops;
  is_member boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  sid := public.resolve_shop_by_slug(p_shop_ref);
  if sid is null then
    begin
      sid := p_shop_ref::uuid;
    exception when others then
      sid := null;
    end;
  end if;
  if sid is null then
    return jsonb_build_object('found', false);
  end if;

  select * into shop_row from public.barbershops where id = sid and status = 'active';
  if shop_row.id is null then
    return jsonb_build_object('found', false);
  end if;

  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.barbershop_id = sid
      and m.role = 'customer'
  ) into is_member;

  return jsonb_build_object(
    'found', true,
    'shop_id', shop_row.id,
    'shop_slug', shop_row.slug,
    'shop_name', shop_row.name,
    'is_member', is_member
  );
end;
$$;

grant execute on function public.get_shop_join_preview(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Levar carteira: mover/mesclar pontos origem → destino
-- ---------------------------------------------------------------------------

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

      -- mover/mesclar pontos da loja origem → destino
      select points into origin_points
      from public.loyalty_accounts
      where user_id = cust and barbershop_id = req.barbershop_id;

      if coalesce(origin_points, 0) > 0 then
        insert into public.loyalty_accounts (user_id, barbershop_id, points)
        values (cust, req.dest_shop_id, origin_points)
        on conflict (user_id, barbershop_id) do update
          set points = public.loyalty_accounts.points + excluded.points,
              updated_at = now();

        update public.loyalty_ledger
        set barbershop_id = req.dest_shop_id
        where user_id = cust
          and barbershop_id = req.barbershop_id;

        delete from public.loyalty_accounts
        where user_id = cust and barbershop_id = req.barbershop_id;
      else
        delete from public.loyalty_accounts
        where user_id = cust and barbershop_id = req.barbershop_id;
      end if;
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

-- ---------------------------------------------------------------------------
-- 7. Export privacy: loyalty já inclui barbershop_id via to_jsonb das linhas
-- ---------------------------------------------------------------------------

create or replace function public.export_my_data() returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

notify pgrst, 'reload schema';
