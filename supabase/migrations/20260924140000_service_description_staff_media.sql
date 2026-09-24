-- Descrição do serviço, persistência de icon/avatar no apply_shop_change,
-- e Storage alinhado a dono/sócio/parceiro (como logos).

alter table public.services
  add column if not exists description text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'services_description_length'
  ) then
    alter table public.services
      add constraint services_description_length
      check (description is null or char_length(description) <= 500);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- apply_shop_change: icon + description no serviço; avatar/bio no staff
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
      insert into public.services(
        barbershop_id, name, duration_minutes, price_cents, active, icon, description
      )
      values (
        p_shop_id,
        p_payload->>'name',
        (p_payload->>'duration_minutes')::int,
        (p_payload->>'price_cents')::int,
        coalesce((p_payload->>'active')::boolean, true),
        nullif(p_payload->>'icon', ''),
        nullif(btrim(coalesce(p_payload->>'description', '')), '')
      );
    when 'service.update' then
      target := (p_payload->>'id')::uuid;
      update public.services
      set
        name = p_payload->>'name',
        duration_minutes = (p_payload->>'duration_minutes')::int,
        price_cents = (p_payload->>'price_cents')::int,
        active = coalesce((p_payload->>'active')::boolean, active),
        icon = coalesce(nullif(p_payload->>'icon', ''), icon),
        description = case
          when p_payload ? 'description' then nullif(btrim(coalesce(p_payload->>'description', '')), '')
          else description
        end
      where id = target and barbershop_id = p_shop_id;
    when 'service.toggle' then
      update public.services
      set active = (p_payload->>'active')::boolean
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'service.delete' then
      delete from public.services where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.create' then
      insert into public.staff(
        barbershop_id, display_name, booking_slug, active, bio, avatar_url
      )
      values (
        p_shop_id,
        p_payload->>'display_name',
        nullif(p_payload->>'booking_slug', ''),
        coalesce((p_payload->>'active')::boolean, true),
        nullif(btrim(coalesce(p_payload->>'bio', '')), ''),
        nullif(p_payload->>'avatar_url', '')
      );
    when 'staff.update' then
      update public.staff
      set
        display_name = p_payload->>'display_name',
        booking_slug = coalesce(nullif(p_payload->>'booking_slug', ''), booking_slug),
        active = coalesce((p_payload->>'active')::boolean, active),
        bio = case
          when p_payload ? 'bio' then nullif(btrim(coalesce(p_payload->>'bio', '')), '')
          else bio
        end,
        avatar_url = case
          when p_payload ? 'avatar_url' then nullif(p_payload->>'avatar_url', '')
          else avatar_url
        end
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
        set
          is_open = excluded.is_open,
          opens_at = excluded.opens_at,
          closes_at = excluded.closes_at;
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
        survey_program_enabled = coalesce(
          (p_payload->>'survey_program_enabled')::boolean,
          survey_program_enabled
        ),
        waiting_enabled = coalesce((p_payload->>'waiting_enabled')::boolean, waiting_enabled),
        waiting_cutoff_minutes = coalesce(
          (p_payload->>'waiting_cutoff_minutes')::int,
          waiting_cutoff_minutes
        )
      where barbershop_id = p_shop_id;
    when 'member.update' then
      update public.shop_members set
        role = (p_payload->>'role')::public.shop_member_role,
        ownership_percent = case
          when (p_payload->>'role') in ('owner', 'partner')
            then (p_payload->>'ownership_percent')::numeric
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
-- Storage: dono/sócio/parceiro explícitos no bucket de serviços (como logos)
-- ---------------------------------------------------------------------------

drop policy if exists "Authorized users upload service images" on storage.objects;
create policy "Authorized users upload service images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'barbershop-services'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
      or public.has_shop_member_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner', 'partner', 'associate']::public.shop_member_role[]
      )
      or public.shop_can_manage_services(((storage.foldername(name))[1])::uuid)
      or public.shop_can_manage_own_services(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists "Authorized users update service images" on storage.objects;
create policy "Authorized users update service images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'barbershop-services'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
      or public.has_shop_member_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner', 'partner', 'associate']::public.shop_member_role[]
      )
      or public.shop_can_manage_services(((storage.foldername(name))[1])::uuid)
      or public.shop_can_manage_own_services(((storage.foldername(name))[1])::uuid)
    )
  )
  with check (
    bucket_id = 'barbershop-services'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
      or public.has_shop_member_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner', 'partner', 'associate']::public.shop_member_role[]
      )
      or public.shop_can_manage_services(((storage.foldername(name))[1])::uuid)
      or public.shop_can_manage_own_services(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists "Authorized users delete service images" on storage.objects;
create policy "Authorized users delete service images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'barbershop-services'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
      or public.has_shop_member_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner', 'partner', 'associate']::public.shop_member_role[]
      )
      or public.shop_can_manage_services(((storage.foldername(name))[1])::uuid)
      or public.shop_can_manage_own_services(((storage.foldername(name))[1])::uuid)
    )
  );

notify pgrst, 'reload schema';
