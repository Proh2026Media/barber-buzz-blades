-- Preserve domain verify token when re-saving the same hostname (avoids TXT mismatch).

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
  prev public.barbershops;
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

  select * into prev from public.barbershops where id = p_shop_id;
  if prev.id is null then raise exception 'Shop not found' using errcode = 'P0002'; end if;

  -- Same domain: keep existing token so DNS TXT already published keeps working.
  if prev.custom_domain = domain and coalesce(prev.domain_verify_token, '') <> '' then
    token := prev.domain_verify_token;
  else
    token := encode(gen_random_bytes(16), 'hex');
  end if;

  update public.barbershops set
    custom_domain = domain,
    custom_domain_status = case
      when prev.custom_domain = domain and prev.custom_domain_status = 'active' then 'active'::public.shop_domain_status
      else 'pending_dns'::public.shop_domain_status
    end,
    domain_verify_token = token,
    domain_verified_at = case
      when prev.custom_domain = domain and prev.custom_domain_status = 'active' then prev.domain_verified_at
      else null
    end,
    domain_last_error = null,
    updated_at = now()
  where id = p_shop_id;

  return public.get_shop_domain_settings(p_shop_id);
end;
$$;
