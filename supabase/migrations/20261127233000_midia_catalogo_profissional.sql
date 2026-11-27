-- O link do profissional apresenta somente o titular. A vitrine da loja lista a equipe.
create or replace function public.perfil_publico_profissional(p_host text,p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with origem as (select public.resolve_shop_by_host(lower(p_host)) as dados)
  select jsonb_build_object(
    'loja', jsonb_build_object(
      'id', b.id, 'slug', b.slug, 'nome', coalesce(nullif(trim(cfg.display_name),''),b.name),
      'logo', cfg.logo_url, 'fundoLogo', cfg.logo_background_color, 'capa', cfg.login_image_url, 'cantos', cfg.corner_style,
      'primaria', cfg.primary_color, 'destaque', cfg.accent_color, 'fonte', cfg.font_family,
      'arquivoFonte', cfg.custom_font_url, 'peso', cfg.header_font_weight, 'estilo', cfg.header_font_style),
    'profissional', jsonb_build_object('slug',p.booking_slug,'nome',p.display_name,'foto',p.avatar_url,'capa',p.cover_url,'bio',p.bio),
    -- Clientes de versões anteriores ainda consultam equipe.length.
    'equipe', '[]'::jsonb,
    'servicos', case when coalesce((cfg.landing->>'show_services')::boolean,true) then coalesce((
      select jsonb_agg(jsonb_build_object('id',s.id,'nome',s.name,'icone',coalesce(nullif(ss.icon,''),s.icon),'descricao',s.description,'minutos',t.duration_minutes,'centavos',t.price_cents)
                       order by s.name,s.id)
      from public.services s cross join lateral public.staff_service_terms(p.id,s.id) t
      left join public.staff_services ss on ss.staff_id=p.id and ss.service_id=s.id and ss.active
      where s.barbershop_id=b.id and s.active), '[]'::jsonb) else '[]'::jsonb end
  )
  from origem join public.barbershops b on b.id=(origem.dados->>'shop_id')::uuid
  join public.barbershop_settings cfg on cfg.barbershop_id=b.id
  join public.staff p on p.barbershop_id=b.id and p.booking_slug=lower(trim(p_slug)) and p.active
  where (origem.dados->>'canonical_host')=lower(p_host) and b.status='active'
    and coalesce((cfg.landing->>'enabled')::boolean,true)
    and coalesce((cfg.landing->>'show_staff')::boolean,true);
$$;
