create or replace function public.app_platform_base_host()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('app.platform_base_host', true), ''),
    'aurset.app'
  );
$$;

create or replace function public.resolve_shop_by_host(p_host text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  host text := public.normalize_hostname(p_host);
  base text := public.app_platform_base_host();
  suffix text := base;
  sub text;
  sid uuid;
  row public.barbershops;
begin
  if host is null then
    return null;
  end if;

  -- Domínio próprio ativo
  select * into row
  from public.barbershops b
  where b.custom_domain = host
    and b.custom_domain_status = 'active'
    and b.status = 'active'
  limit 1;
  if row.id is not null then
    return jsonb_build_object(
      'shop_id', row.id,
      'shop_slug', row.slug,
      'shop_name', row.name,
      'kind', 'custom',
      'host', host,
      'canonical_host', row.custom_domain
    );
  end if;

  -- Aceita links antigos durante a transição e sempre devolve a loja canônica.
  if right(host, length('.beauty.contheiner.digital')) = '.beauty.contheiner.digital' then
    suffix := 'beauty.contheiner.digital';
  end if;
  if host = base then
    return null;
  end if;
  if right(host, length(suffix) + 1) = '.' || suffix then
    sub := left(host, length(host) - length(suffix) - 1);
    if sub ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and position('.' in sub) = 0 then
      sid := public.resolve_shop_by_slug(sub);
      if sid is null then return null; end if;
      select * into row from public.barbershops where id = sid and status = 'active';
      if row.id is null then return null; end if;
      return jsonb_build_object(
        'shop_id', row.id,
        'shop_slug', row.slug,
        'shop_name', row.name,
        'kind', 'subdomain',
        'host', host,
        'canonical_host', case
          when row.custom_domain is not null and row.custom_domain_status = 'active'
            then row.custom_domain
          else row.slug || '.' || base
        end
      );
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.shop_public_origin(p_shop_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  shop public.barbershops%rowtype;
  base_host text := public.app_platform_base_host();
begin
  select * into shop from public.barbershops where id = p_shop_id;
  if shop.id is null then return null; end if;
  if shop.custom_domain is not null and shop.custom_domain_status = 'active' then
    return 'https://' || shop.custom_domain;
  end if;
  return 'https://' || shop.slug || '.' || base_host;
end;
$$;
