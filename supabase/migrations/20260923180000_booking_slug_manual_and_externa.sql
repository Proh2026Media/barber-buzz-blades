-- Slug de barbeiro editável + reset Externa Barbearia (admin).

-- ---------------------------------------------------------------------------
-- Trigger: permite booking_slug manual; nome sozinho não sobrescreve o slug
-- ---------------------------------------------------------------------------

create or replace function public.trg_staff_auto_booking_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_slug text;
  shop_slug text;
  owner uuid;
  locked_hit boolean;
  base text;
begin
  select b.slug into shop_slug from public.barbershops b where b.id = new.barbershop_id;
  owner := new.user_id;

  if tg_op = 'INSERT' then
    base := coalesce(nullif(btrim(new.booking_slug), ''), new.display_name);
    new.booking_slug := public.allocate_booking_slug(new.barbershop_id, base, null);
    return new;
  end if;

  -- Edição explícita do slug (UI / apply_shop_change)
  if new.booking_slug is distinct from old.booking_slug then
    next_slug := public.allocate_booking_slug(
      new.barbershop_id,
      coalesce(nullif(btrim(new.booking_slug), ''), new.display_name),
      new.id
    );

    if next_slug is distinct from old.booking_slug and old.booking_slug is not null then
      select exists (
        select 1 from public.staff_slug_redirects r
        where r.from_shop_slug = shop_slug
          and r.from_booking_slug = old.booking_slug
          and r.deleted_at is null
          and r.locked
      ) into locked_hit;
      if locked_hit then
        raise exception 'Link do profissional travado na barbearia; não é possível alterar'
          using errcode = '42501';
      end if;
      if owner is null then
        select sm.user_id into owner
        from public.shop_members sm
        where sm.staff_id = new.id and sm.active
        limit 1;
      end if;
      if owner is not null then
        insert into public.staff_slug_redirects (
          from_shop_slug, from_booking_slug, staff_id, owner_user_id, locked
        )
        select shop_slug, old.booking_slug, new.id, owner, false
        where not exists (
          select 1 from public.staff_slug_redirects r
          where r.from_shop_slug = shop_slug
            and r.from_booking_slug = old.booking_slug
            and r.deleted_at is null
        );
      end if;
    end if;

    new.booking_slug := next_slug;
    return new;
  end if;

  -- Só mudou o nome: mantém o slug (editável independentemente)
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_shop_change: persiste booking_slug em create/update
-- ---------------------------------------------------------------------------

create or replace function public.apply_shop_change(p_shop_id uuid, p_kind text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  row_data jsonb;
begin
  perform set_config('app.approved_shop_change', 'on', true);
  case p_kind
    when 'service.create' then
      insert into public.services(barbershop_id, name, duration_minutes, price_cents, active)
      values (
        p_shop_id,
        p_payload->>'name',
        (p_payload->>'duration_minutes')::int,
        (p_payload->>'price_cents')::int,
        coalesce((p_payload->>'active')::boolean, true)
      );
    when 'service.update' then
      target := (p_payload->>'id')::uuid;
      update public.services
      set
        name = p_payload->>'name',
        duration_minutes = (p_payload->>'duration_minutes')::int,
        price_cents = (p_payload->>'price_cents')::int,
        active = coalesce((p_payload->>'active')::boolean, active)
      where id = target and barbershop_id = p_shop_id;
    when 'service.toggle' then
      update public.services
      set active = (p_payload->>'active')::boolean
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'service.delete' then
      delete from public.services where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.create' then
      insert into public.staff(barbershop_id, display_name, booking_slug, active)
      values (
        p_shop_id,
        p_payload->>'display_name',
        nullif(p_payload->>'booking_slug', ''),
        coalesce((p_payload->>'active')::boolean, true)
      );
    when 'staff.update' then
      update public.staff
      set
        display_name = p_payload->>'display_name',
        booking_slug = coalesce(nullif(p_payload->>'booking_slug', ''), booking_slug),
        active = coalesce((p_payload->>'active')::boolean, active)
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.toggle' then
      update public.staff
      set active = (p_payload->>'active')::boolean
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.delete' then
      delete from public.staff where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'hours.replace' then
      for row_data in select value from jsonb_array_elements(p_payload->'hours') loop
        insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
        values (
          p_shop_id,
          (row_data->>'weekday')::int,
          (row_data->>'is_open')::boolean,
          (row_data->>'opens_at')::time,
          (row_data->>'closes_at')::time
        )
        on conflict (barbershop_id, weekday) do update
        set is_open = excluded.is_open, opens_at = excluded.opens_at, closes_at = excluded.closes_at;
      end loop;
    when 'availability.create' then
      insert into public.availability_blocks(barbershop_id, staff_id, starts_at, ends_at, reason)
      values (
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
        survey_program_enabled = coalesce((p_payload->>'survey_program_enabled')::boolean, survey_program_enabled),
        waiting_enabled = coalesce((p_payload->>'waiting_enabled')::boolean, waiting_enabled),
        waiting_cutoff_minutes = coalesce((p_payload->>'waiting_cutoff_minutes')::int, waiting_cutoff_minutes)
      where barbershop_id = p_shop_id;
    when 'member.update' then
      update public.shop_members set
        role = (p_payload->>'role')::public.shop_member_role,
        ownership_percent = case
          when (p_payload->>'role') in ('owner', 'partner') then (p_payload->>'ownership_percent')::numeric
          else null
        end,
        active = coalesce((p_payload->>'active')::boolean, active)
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    else
      raise exception 'Unsupported change kind: %', p_kind using errcode = '22023';
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC pública: existe barbeiro com este slug nesta loja? (redirect de path)
-- ---------------------------------------------------------------------------

create or replace function public.shop_has_booking_slug(p_shop_id uuid, p_booking_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff s
    where s.barbershop_id = p_shop_id
      and s.active
      and s.booking_slug = lower(btrim(p_booking_slug))
  )
  or exists (
    select 1
    from public.staff_slug_redirects r
    join public.barbershops b on b.slug = r.from_shop_slug
    where b.id = p_shop_id
      and r.from_booking_slug = lower(btrim(p_booking_slug))
      and r.deleted_at is null
  );
$$;

revoke all on function public.shop_has_booking_slug(uuid, text) from public, anon, authenticated;
grant execute on function public.shop_has_booking_slug(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: limpa equipe/serviços/agenda da Externa e cria Ezequiel + Tiago
-- ---------------------------------------------------------------------------

create or replace function public.admin_reset_externa_barbearia(p_confirm text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_id uuid;
  shop_slug text;
  ezequiel_id uuid;
  tiago_id uuid;
  deleted_appts int := 0;
  deleted_services int := 0;
  deleted_staff int := 0;
  platform_host text := public.app_platform_base_host();
  public_origin text;
begin
  if not public.is_platform_admin() then
    raise exception 'Somente admin da plataforma' using errcode = '42501';
  end if;
  if p_confirm is distinct from 'RESET_EXTERNA' then
    raise exception 'Confirmação inválida. Use RESET_EXTERNA.' using errcode = '22023';
  end if;

  -- Loja no app (não usa o site WordPress externabarbearia.com.br — esse é só referência).
  select b.id, b.slug into shop_id, shop_slug
  from public.barbershops b
  where b.slug in ('externa-barbearia', 'externa', 'externabarbearia')
     or lower(b.name) in ('externa barbearia', 'externa')
  order by
    case when b.slug = 'externa-barbearia' then 0
         when b.slug = 'externa' then 1
         else 2 end
  limit 1;

  if shop_id is null then
    insert into public.barbershops (name, slug, status)
    values ('Externa Barbearia', 'externa-barbearia', 'active')
    returning id, slug into shop_id, shop_slug;

    insert into public.barbershop_settings (barbershop_id, display_name)
    values (shop_id, 'Externa Barbearia')
    on conflict (barbershop_id) do update
      set display_name = excluded.display_name;
  end if;

  -- Agenda e dependências leves
  begin
    delete from public.waiting_events we
    using public.slot_waits sw
    where sw.id = we.wait_id and sw.barbershop_id = shop_id;
  exception when undefined_table then null;
  end;
  begin
    delete from public.slot_waits where barbershop_id = shop_id;
  exception when undefined_table then null;
  end;

  delete from public.appointments where barbershop_id = shop_id;
  get diagnostics deleted_appts = row_count;

  -- Catálogo
  delete from public.staff_services where barbershop_id = shop_id;
  delete from public.services where barbershop_id = shop_id;
  get diagnostics deleted_services = row_count;

  delete from public.availability_blocks where barbershop_id = shop_id;

  -- Redirects de slug da loja
  delete from public.staff_slug_redirects where from_shop_slug = shop_slug;

  -- Membros ligados a staff (mantém owners/partners sem staff se existirem)
  update public.shop_members
  set staff_id = null
  where barbershop_id = shop_id and staff_id is not null;

  delete from public.staff where barbershop_id = shop_id;
  get diagnostics deleted_staff = row_count;

  insert into public.staff (barbershop_id, display_name, booking_slug, active)
  values (shop_id, 'Ezequiel', 'ezequiel', true)
  returning id into ezequiel_id;

  insert into public.staff (barbershop_id, display_name, booking_slug, active)
  values (shop_id, 'Tiago', 'tiago', true)
  returning id into tiago_id;

  update public.barbershops
  set
    name = 'Externa Barbearia',
    updated_at = now()
  where id = shop_id;

  -- Links no endereço do sistema (*.beauty…). Domínio próprio só quando a loja configurar no Ajustes.
  public_origin := 'https://' || shop_slug || '.' || platform_host;

  return jsonb_build_object(
    'shop_id', shop_id,
    'shop_slug', shop_slug,
    'deleted_appointments', deleted_appts,
    'deleted_services', deleted_services,
    'deleted_staff', deleted_staff,
    'staff', jsonb_build_array(
      jsonb_build_object('id', ezequiel_id, 'name', 'Ezequiel', 'booking_slug', 'ezequiel'),
      jsonb_build_object('id', tiago_id, 'name', 'Tiago', 'booking_slug', 'tiago')
    ),
    'public_links', jsonb_build_array(
      public_origin || '/app?barber=ezequiel',
      public_origin || '/app?barber=tiago',
      public_origin || '/ezequiel',
      public_origin || '/tiago'
    ),
    'note', 'externabarbearia.com.br é só referência do site antigo; não foi configurado como domínio do app.'
  );
end;
$$;

revoke all on function public.admin_reset_externa_barbearia(text) from public, anon, authenticated;
grant execute on function public.admin_reset_externa_barbearia(text) to authenticated;
