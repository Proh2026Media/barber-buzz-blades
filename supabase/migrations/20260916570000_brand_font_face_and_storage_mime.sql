-- Let each shop choose the exact family face used in its header.
alter table public.barbershop_settings
  add column if not exists header_font_weight smallint not null default 700,
  add column if not exists header_font_style text not null default 'normal';

alter table public.barbershop_settings
  drop constraint if exists barbershop_settings_header_font_weight_valid,
  drop constraint if exists barbershop_settings_header_font_style_valid;

alter table public.barbershop_settings
  add constraint barbershop_settings_header_font_weight_valid
    check (header_font_weight between 100 and 900 and header_font_weight % 100 = 0),
  add constraint barbershop_settings_header_font_style_valid
    check (header_font_style in ('normal', 'italic'));

grant update (header_font_weight, header_font_style)
  on public.barbershop_settings to authenticated;

-- Safari/Finder and a few Chromium builds report valid local web-font files as
-- application/octet-stream. The app still validates extension, size and face data.
update storage.buckets
set allowed_mime_types = array[
  'font/woff2', 'font/woff', 'font/ttf', 'font/otf',
  'application/font-woff', 'application/x-font-ttf',
  'application/x-font-opentype', 'application/vnd.ms-opentype',
  'application/octet-stream'
]
where id = 'barbershop-fonts';
