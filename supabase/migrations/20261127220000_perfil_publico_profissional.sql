-- O retrato permanece em avatar_url e fornece a miniatura nas listas.
alter table public.staff add column cover_url text;

-- Conservar as demais operações e as aprovações da governança já instaladas.
do $migration$
declare
  original text := pg_get_functiondef('public.apply_shop_change(uuid,text,jsonb)'::regprocedure);
  atualizado text;
  colunas constant text := 'barbershop_id, display_name, active, avatar_url, bio, booking_slug';
  valor constant text := 'nullif(p_payload->>''avatar_url'', ''''),';
  edicao constant text := 'avatar_url = case when p_payload ? ''avatar_url'' then nullif(p_payload->>''avatar_url'', '''') else avatar_url end,';
begin
  if strpos(original,colunas)=0 or strpos(original,valor)=0 or strpos(original,edicao)=0 then
    raise exception 'A definição de governança da equipe precisa ser conferida.';
  end if;
  atualizado := replace(original,colunas,'barbershop_id, display_name, active, avatar_url, cover_url, bio, booking_slug');
  atualizado := replace(atualizado,valor,valor || E'\n        nullif(p_payload->>''cover_url'', ''''),');
  atualizado := replace(atualizado,edicao,edicao || E'\n        cover_url = case when p_payload ? ''cover_url'' then nullif(p_payload->>''cover_url'', '''') else cover_url end,');
  execute atualizado;
end $migration$;

create function public.perfil_publico_profissional(p_host text,p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with origem as (select public.resolve_shop_by_host(lower(p_host)) as dados)
  select jsonb_build_object(
    'loja', jsonb_build_object(
      'id', b.id, 'slug', b.slug, 'nome', coalesce(nullif(trim(cfg.display_name),''),b.name),
      'logo', cfg.logo_url, 'capa', cfg.login_image_url, 'cantos', cfg.corner_style,
      'primaria', cfg.primary_color, 'destaque', cfg.accent_color, 'fonte', cfg.font_family,
      'arquivoFonte', cfg.custom_font_url, 'peso', cfg.header_font_weight, 'estilo', cfg.header_font_style),
    'profissional', jsonb_build_object('slug',p.booking_slug,'nome',p.display_name,'foto',p.avatar_url,'capa',p.cover_url,'bio',p.bio),
    'equipe', (select jsonb_agg(jsonb_build_object('slug',f.booking_slug,'nome',f.display_name,'foto',f.avatar_url) order by f.display_name,f.id)
                from public.staff f where f.barbershop_id=b.id and f.active and f.booking_slug is not null),
    'servicos', case when coalesce((cfg.landing->>'show_services')::boolean,true) then coalesce((
      select jsonb_agg(jsonb_build_object('id',s.id,'nome',s.name,'minutos',t.duration_minutes,'centavos',t.price_cents)
                       order by s.name,s.id)
      from public.services s cross join lateral public.staff_service_terms(p.id,s.id) t
      where s.barbershop_id=b.id and s.active), '[]'::jsonb) else '[]'::jsonb end
  )
  from origem join public.barbershops b on b.id=(origem.dados->>'shop_id')::uuid
  join public.barbershop_settings cfg on cfg.barbershop_id=b.id
  join public.staff p on p.barbershop_id=b.id and p.booking_slug=lower(trim(p_slug)) and p.active
  where (origem.dados->>'canonical_host')=lower(p_host) and b.status='active'
    and coalesce((cfg.landing->>'enabled')::boolean,true)
    and coalesce((cfg.landing->>'show_staff')::boolean,true);
$$;
revoke all on function public.perfil_publico_profissional(text,text) from public;
grant execute on function public.perfil_publico_profissional(text,text) to anon, authenticated;
notify pgrst, 'reload schema';
