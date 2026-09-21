-- Custom web fonts with deliberately limited visual scope per barbershop.
alter table public.barbershop_settings
  add column custom_font_url text
    check (custom_font_url is null or char_length(custom_font_url) <= 2048),
  add column custom_font_name text
    check (custom_font_name is null or char_length(btrim(custom_font_name)) between 1 and 120),
  add column font_scope text not null default 'header'
    check (font_scope in ('header', 'titles'));

grant update (
  tagline,
  booking_instructions,
  booking_horizon_days,
  survey_program_enabled,
  display_name,
  logo_url,
  font_family,
  custom_font_url,
  custom_font_name,
  font_scope,
  primary_color,
  accent_color
) on public.barbershop_settings to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'barbershop-fonts',
  'barbershop-fonts',
  true,
  5242880,
  array[
    'font/woff2',
    'font/woff',
    'font/ttf',
    'font/otf',
    'application/font-woff',
    'application/x-font-ttf',
    'application/x-font-opentype',
    'application/vnd.ms-opentype'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can view barbershop fonts"
  on storage.objects for select
  using (bucket_id = 'barbershop-fonts');

create policy "Authorized admins upload barbershop fonts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'barbershop-fonts'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
    )
  );

create policy "Authorized admins update barbershop fonts"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'barbershop-fonts'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
    )
  )
  with check (
    bucket_id = 'barbershop-fonts'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
    )
  );

create policy "Authorized admins delete barbershop fonts"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'barbershop-fonts'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
    )
  );

notify pgrst, 'reload schema';
