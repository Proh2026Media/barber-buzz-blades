-- Per-shop visual identity and logo storage.
alter table public.barbershop_settings
  add column display_name text
    check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  add column logo_url text
    check (logo_url is null or char_length(logo_url) <= 2048),
  add column primary_color text not null default '#292925'
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column accent_color text not null default '#8A602F'
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$');

grant update (
  tagline,
  booking_instructions,
  booking_horizon_days,
  survey_program_enabled,
  display_name,
  logo_url,
  primary_color,
  accent_color
) on public.barbershop_settings to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'barbershop-logos',
  'barbershop-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can view barbershop logos"
  on storage.objects for select
  using (bucket_id = 'barbershop-logos');

create policy "Shop admins upload their logo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'barbershop-logos'
    and public.has_shop_role(
      ((storage.foldername(name))[1])::uuid,
      array['shop_admin']::public.app_role[]
    )
  );

create policy "Shop admins update their logo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'barbershop-logos'
    and public.has_shop_role(
      ((storage.foldername(name))[1])::uuid,
      array['shop_admin']::public.app_role[]
    )
  )
  with check (
    bucket_id = 'barbershop-logos'
    and public.has_shop_role(
      ((storage.foldername(name))[1])::uuid,
      array['shop_admin']::public.app_role[]
    )
  );

create policy "Shop admins delete their logo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'barbershop-logos'
    and public.has_shop_role(
      ((storage.foldername(name))[1])::uuid,
      array['shop_admin']::public.app_role[]
    )
  );

notify pgrst, 'reload schema';
