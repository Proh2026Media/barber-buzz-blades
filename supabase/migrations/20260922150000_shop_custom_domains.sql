-- Domínios por barbearia: subdomínio da plataforma + domínio próprio verificado.

create type public.shop_domain_status as enum (
  'none',
  'pending_dns',
  'active',
  'error'
);

alter table public.barbershops
  add column if not exists custom_domain text,
  add column if not exists custom_domain_status public.shop_domain_status not null default 'none',
  add column if not exists domain_verify_token text,
  add column if not exists domain_verified_at timestamptz,
  add column if not exists domain_last_error text;

alter table public.barbershops
  drop constraint if exists barbershops_custom_domain_format;

alter table public.barbershops
  add constraint barbershops_custom_domain_format check (
    custom_domain is null
    or custom_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  );

create unique index if not exists barbershops_custom_domain_uidx
  on public.barbershops (custom_domain)
  where custom_domain is not null;

-- ---------------------------------------------------------------------------
-- Config / helpers
-- ---------------------------------------------------------------------------

create or replace function public.app_platform_base_host()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('app.platform_base_host', true), ''),
    'beauty.contheiner.digital'
  );
$$;

create or replace function public.normalize_hostname(p_host text)
returns text
language plpgsql
immutable
as $$
declare
  h text := lower(btrim(coalesce(p_host, '')));
begin
  h := split_part(h, ':', 1);
  if h like 'www.%' then
    h := substring(h from 5);
  end if;
  return nullif(h, '');
end;
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

  -- Subdomínio da plataforma: {slug}.beauty.contheiner.digital
  if host = base then
    return null;
  end if;
  if host like '%.' || base then
    sub := left(host, length(host) - length(base) - 1);
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

create or replace function public.get_shop_domain_settings(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  row public.barbershops;
  base text := public.app_platform_base_host();
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not (
    public.is_platform_admin()
    or public.has_shop_member_role(p_shop_id, array['owner', 'partner']::public.shop_member_role[])
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into row from public.barbershops where id = p_shop_id;
  if row.id is null then raise exception 'Shop not found' using errcode = 'P0002'; end if;

  return jsonb_build_object(
    'shop_id', row.id,
    'shop_slug', row.slug,
    'platform_base_host', base,
    'platform_subdomain', row.slug || '.' || base,
    'platform_url', 'https://' || row.slug || '.' || base,
    'custom_domain', row.custom_domain,
    'custom_domain_status', row.custom_domain_status,
    'domain_verify_token', row.domain_verify_token,
    'domain_verified_at', row.domain_verified_at,
    'domain_last_error', row.domain_last_error,
    'dns_instructions', case
      when row.custom_domain is null then null
      else jsonb_build_object(
        'cname_host', row.custom_domain,
        'cname_target', base,
        'txt_host', '_barba-verify.' || row.custom_domain,
        'txt_value', 'barba-verify=' || coalesce(row.domain_verify_token, '')
      )
    end
  );
end;
$$;

create or replace function public.set_shop_custom_domain(p_shop_id uuid, p_domain text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  domain text := public.normalize_hostname(p_domain);
  base text := public.app_platform_base_host();
  token text;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not (
    public.is_platform_admin()
    or public.has_shop_member_role(p_shop_id, array['owner', 'partner']::public.shop_member_role[])
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if domain is null then
    raise exception 'Informe o domínio' using errcode = '22023';
  end if;
  if domain = base or domain like '%.' || base then
    raise exception 'Use um domínio próprio, não o subdomínio da plataforma' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.barbershops b
    where b.custom_domain = domain and b.id <> p_shop_id
  ) then
    raise exception 'Este domínio já está em uso por outra barbearia' using errcode = '23505';
  end if;

  token := encode(gen_random_bytes(16), 'hex');

  update public.barbershops set
    custom_domain = domain,
    custom_domain_status = 'pending_dns',
    domain_verify_token = token,
    domain_verified_at = null,
    domain_last_error = null,
    updated_at = now()
  where id = p_shop_id;

  return public.get_shop_domain_settings(p_shop_id);
end;
$$;

create or replace function public.clear_shop_custom_domain(p_shop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not (
    public.is_platform_admin()
    or public.has_shop_member_role(p_shop_id, array['owner', 'partner']::public.shop_member_role[])
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.barbershops set
    custom_domain = null,
    custom_domain_status = 'none',
    domain_verify_token = null,
    domain_verified_at = null,
    domain_last_error = null,
    updated_at = now()
  where id = p_shop_id;

  return public.get_shop_domain_settings(p_shop_id);
end;
$$;

-- Verificação: a Edge Function / sync confere DNS e chama esta RPC.
create or replace function public.mark_shop_domain_status(
  p_shop_id uuid,
  p_status public.shop_domain_status,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.barbershops;
  base text := public.app_platform_base_host();
begin
  -- Chamável por service role (sem auth.uid) ou dono/sócio
  if auth.uid() is not null
     and not public.is_platform_admin()
     and not public.has_shop_member_role(p_shop_id, array['owner', 'partner']::public.shop_member_role[])
  then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.barbershops set
    custom_domain_status = p_status,
    domain_verified_at = case when p_status = 'active' then now() else domain_verified_at end,
    domain_last_error = nullif(trim(coalesce(p_error, '')), ''),
    updated_at = now()
  where id = p_shop_id
    and custom_domain is not null
  returning * into row;

  if row.id is null then
    raise exception 'Shop/domain not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'shop_id', row.id,
    'shop_slug', row.slug,
    'platform_base_host', base,
    'platform_subdomain', row.slug || '.' || base,
    'custom_domain', row.custom_domain,
    'custom_domain_status', row.custom_domain_status,
    'domain_verify_token', row.domain_verify_token,
    'domain_verified_at', row.domain_verified_at,
    'domain_last_error', row.domain_last_error
  );
end;
$$;

-- Branding público também por host
create or replace function public.get_public_shop_branding_by_host(p_host text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved jsonb;
  sid uuid;
  brand record;
begin
  resolved := public.resolve_shop_by_host(p_host);
  if resolved is null then return null; end if;
  sid := (resolved->>'shop_id')::uuid;
  select
    b.id as shop_id,
    b.name as shop_name,
    b.slug as shop_slug,
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
    s.login_image_url,
    resolved->>'kind' as host_kind,
    resolved->>'canonical_host' as canonical_host
  into brand
  from public.barbershops b
  left join public.barbershop_settings s on s.barbershop_id = b.id
  where b.id = sid and b.status = 'active';

  if brand.shop_id is null then return null; end if;
  return to_jsonb(brand);
end;
$$;

-- Lista lojas com domínio próprio (para sync Traefik / cron)
create or replace function public.list_active_custom_domains()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- service role only in practice; allow platform admin too
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'shop_id', b.id,
      'shop_slug', b.slug,
      'custom_domain', b.custom_domain,
      'status', b.custom_domain_status,
      'verify_token', b.domain_verify_token
    ) order by b.custom_domain)
    from public.barbershops b
    where b.custom_domain is not null
      and b.status = 'active'
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.app_platform_base_host() to anon, authenticated;
grant execute on function public.normalize_hostname(text) to anon, authenticated;
grant execute on function public.resolve_shop_by_host(text) to anon, authenticated;
grant execute on function public.get_public_shop_branding_by_host(text) to anon, authenticated;
grant execute on function public.get_shop_domain_settings(uuid) to authenticated;
grant execute on function public.set_shop_custom_domain(uuid, text) to authenticated;
grant execute on function public.clear_shop_custom_domain(uuid) to authenticated;
grant execute on function public.mark_shop_domain_status(uuid, public.shop_domain_status, text) to authenticated;
grant execute on function public.list_active_custom_domains() to authenticated;
