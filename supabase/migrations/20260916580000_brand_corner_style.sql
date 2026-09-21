-- Let each shop choose a consistent corner language for its customer and staff apps.
alter table public.barbershop_settings
  add column if not exists corner_style text not null default 'soft';

alter table public.barbershop_settings
  drop constraint if exists barbershop_settings_corner_style_valid;

alter table public.barbershop_settings
  add constraint barbershop_settings_corner_style_valid
    check (corner_style in ('square', 'soft', 'round'));

grant update (corner_style)
  on public.barbershop_settings to authenticated;
