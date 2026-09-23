-- CNAME target for custom domains (domain-manager / Traefik host).

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
  cname_target text := coalesce(
    nullif(current_setting('app.domain_cname_target', true), ''),
    'dominios.' || base
  );
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
        'cname_target', cname_target,
        'txt_host', '_barba-verify.' || row.custom_domain,
        'txt_value', 'barba-verify=' || coalesce(row.domain_verify_token, '')
      )
    end
  );
end;
$$;
