-- Modelos fotográficos da página de autenticação por barbearia.
-- Idempotente: pode ser executada novamente sem recriar dados ou políticas.
alter table public.barbershop_settings
  add column if not exists login_layout text not null default 'split',
  add column if not exists login_image_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'barbershop_settings_login_layout_valid'
      and conrelid = 'public.barbershop_settings'::regclass
  ) then
    alter table public.barbershop_settings
      add constraint barbershop_settings_login_layout_valid
      check (login_layout in ('cover', 'split', 'card'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'barbershop_settings_login_image_url_length'
      and conrelid = 'public.barbershop_settings'::regclass
  ) then
    alter table public.barbershop_settings
      add constraint barbershop_settings_login_image_url_length
      check (login_image_url is null or char_length(login_image_url) <= 4096);
  end if;
end $$;

grant update (login_layout, login_image_url)
  on public.barbershop_settings to authenticated;

-- Os novos campos seguem a mesma governança visual de logo, cores e cantos.
create or replace function public.settings_change_is_visual(
  old_row public.barbershop_settings,
  new_row public.barbershop_settings
) returns boolean language sql immutable set search_path=public as $$
  select old_row.barbershop_id = new_row.barbershop_id
    and (to_jsonb(old_row) - array[
      'display_name','logo_url','logo_background_color','login_layout','login_image_url',
      'font_family','custom_font_url','custom_font_name','custom_font_faces','font_scope',
      'header_font_weight','header_font_style','corner_style','floating_chrome',
      'primary_color','accent_color','tagline','updated_at'
    ]) = (to_jsonb(new_row) - array[
      'display_name','logo_url','logo_background_color','login_layout','login_image_url',
      'font_family','custom_font_url','custom_font_name','custom_font_faces','font_scope',
      'header_font_weight','header_font_style','corner_style','floating_chrome',
      'primary_color','accent_color','tagline','updated_at'
    ])
$$;

-- RPC v2: é separada da versão legada para que frontends e bancos possam ser
-- atualizados em qualquer ordem. O auth tenta esta versão e recua para a antiga.
create or replace function public.get_public_shop_branding_v2(p_shop_ref text)
returns table (
  shop_id uuid,
  shop_name text,
  display_name text,
  logo_url text,
  logo_background_color text,
  font_family text,
  custom_font_url text,
  header_font_weight integer,
  header_font_style text,
  corner_style text,
  primary_color text,
  accent_color text,
  login_layout text,
  login_image_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id,
    b.name,
    s.display_name,
    s.logo_url,
    s.logo_background_color,
    s.font_family,
    s.custom_font_url,
    s.header_font_weight,
    s.header_font_style,
    s.corner_style,
    s.primary_color,
    s.accent_color,
    s.login_layout,
    s.login_image_url
  from public.barbershops b
  left join public.barbershop_settings s on s.barbershop_id = b.id
  where b.status = 'active'
    and nullif(btrim(p_shop_ref), '') is not null
    and (
      lower(b.slug) = lower(btrim(p_shop_ref))
      or b.id::text = btrim(p_shop_ref)
    )
  limit 1
$$;

revoke all on function public.get_public_shop_branding_v2(text) from public;
grant execute on function public.get_public_shop_branding_v2(text) to anon, authenticated;

comment on function public.get_public_shop_branding_v2(text) is
  'Returns public visual identity and login presentation for one active shop before authentication.';

-- A foto usa o bucket visual já existente. Atualiza as políticas para os
-- papéis profissionais atuais, preservando também o papel legado shop_admin.
drop policy if exists "Shop admins upload their logo" on storage.objects;
create policy "Shop admins upload their logo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'barbershop-logos'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
      or public.has_shop_member_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner','partner','associate']::public.shop_member_role[]
      )
    )
  );

drop policy if exists "Shop admins update their logo" on storage.objects;
create policy "Shop admins update their logo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'barbershop-logos'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
      or public.has_shop_member_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner','partner','associate']::public.shop_member_role[]
      )
    )
  )
  with check (
    bucket_id = 'barbershop-logos'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
      or public.has_shop_member_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner','partner','associate']::public.shop_member_role[]
      )
    )
  );

drop policy if exists "Shop admins delete their logo" on storage.objects;
create policy "Shop admins delete their logo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'barbershop-logos'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
      or public.has_shop_member_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner','partner','associate']::public.shop_member_role[]
      )
    )
  );

notify pgrst, 'reload schema';
