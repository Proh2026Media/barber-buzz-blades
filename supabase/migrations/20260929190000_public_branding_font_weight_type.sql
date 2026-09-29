-- header_font_weight é smallint na tabela; as funções anunciam integer e o banco recusava
-- o resultado (42804) para toda loja existente, então o login nunca mostrava a marca da loja.

create or replace function public.get_public_shop_branding_v2(p_shop_ref text)
returns table(
  shop_id uuid, shop_name text, display_name text, logo_url text, logo_background_color text,
  font_family text, custom_font_url text, header_font_weight integer, header_font_style text,
  corner_style text, primary_color text, accent_color text, login_layout text, login_image_url text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare sid uuid;
begin
  if nullif(btrim(p_shop_ref), '') is null then return; end if;
  if p_shop_ref ~* '^[0-9a-f-]{36}$' then
    sid := p_shop_ref::uuid;
  else
    sid := public.resolve_shop_by_slug(p_shop_ref);
  end if;
  if sid is null then return; end if;
  return query
  select
    b.id, b.name, s.display_name, s.logo_url, s.logo_background_color,
    s.font_family, s.custom_font_url, s.header_font_weight::integer, s.header_font_style,
    s.corner_style, s.primary_color, s.accent_color, s.login_layout, s.login_image_url
  from public.barbershops b
  left join public.barbershop_settings s on s.barbershop_id = b.id
  where b.id = sid and b.status = 'active'
  limit 1;
end;
$$;

create or replace function public.get_public_shop_branding(p_shop_ref text)
returns table(
  shop_id uuid, shop_name text, display_name text, logo_url text, logo_background_color text,
  font_family text, custom_font_url text, header_font_weight integer, header_font_style text,
  corner_style text, primary_color text, accent_color text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare sid uuid;
begin
  if nullif(btrim(p_shop_ref), '') is null then return; end if;
  if p_shop_ref ~* '^[0-9a-f-]{36}$' then
    sid := p_shop_ref::uuid;
  else
    sid := public.resolve_shop_by_slug(p_shop_ref);
  end if;
  if sid is null then return; end if;
  return query
  select
    b.id, b.name, s.display_name, s.logo_url, s.logo_background_color,
    s.font_family, s.custom_font_url, s.header_font_weight::integer, s.header_font_style,
    s.corner_style, s.primary_color, s.accent_color
  from public.barbershops b
  left join public.barbershop_settings s on s.barbershop_id = b.id
  where b.id = sid and b.status = 'active'
  limit 1;
end;
$$;

grant execute on function public.get_public_shop_branding_v2(text) to anon, authenticated;
grant execute on function public.get_public_shop_branding(text) to anon, authenticated;

notify pgrst, 'reload schema';
