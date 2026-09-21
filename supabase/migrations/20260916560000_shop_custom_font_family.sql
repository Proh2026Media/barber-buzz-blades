alter table public.barbershop_settings
  add column if not exists custom_font_faces jsonb not null default '[]'::jsonb;

alter table public.barbershop_settings
  drop constraint if exists barbershop_settings_custom_font_faces_valid;

alter table public.barbershop_settings
  add constraint barbershop_settings_custom_font_faces_valid check (
    jsonb_typeof(custom_font_faces) = 'array'
    and jsonb_array_length(custom_font_faces) <= 12
  );

grant update (custom_font_faces) on public.barbershop_settings to authenticated;

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array[
      'font/woff2', 'font/woff', 'font/ttf', 'font/otf',
      'application/font-woff', 'application/x-font-ttf',
      'application/x-font-opentype', 'application/vnd.ms-opentype'
    ]
where id = 'barbershop-fonts';

notify pgrst, 'reload schema';
