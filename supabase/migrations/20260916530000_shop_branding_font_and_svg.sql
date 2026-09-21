-- Extend per-shop branding with a curated font and safe SVG logo uploads.
alter table public.barbershop_settings
  add column font_family text not null default 'inter'
    check (
      font_family in (
        'inter',
        'manrope',
        'montserrat',
        'nunito-sans',
        'source-sans-3',
        'roboto'
      )
    );

grant update (
  tagline,
  booking_instructions,
  booking_horizon_days,
  survey_program_enabled,
  display_name,
  logo_url,
  font_family,
  primary_color,
  accent_color
) on public.barbershop_settings to authenticated;

update storage.buckets
set
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
where id = 'barbershop-logos';

notify pgrst, 'reload schema';
