-- Expose only the visual identity required before authentication.
-- Operational settings and inactive shops remain private.
create or replace function public.get_public_shop_branding(p_shop_ref text)
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
  accent_color text
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
    s.accent_color
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

revoke all on function public.get_public_shop_branding(text) from public;
grant execute on function public.get_public_shop_branding(text) to anon, authenticated;

comment on function public.get_public_shop_branding(text) is
  'Returns the public visual identity of one active shop for the pre-authentication screen.';

notify pgrst, 'reload schema';
