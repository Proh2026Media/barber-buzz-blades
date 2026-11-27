-- A agenda pública só expõe a oferta que a loja permite mostrar no site.
create or replace function public.consultar_agenda_publica(
  p_host text, p_servico uuid default null, p_profissional text default null, p_dia date default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  origem jsonb := public.resolve_shop_by_host(p_host);
  loja uuid := (origem->>'shop_id')::uuid;
  hoje date;
  dias integer;
  fuso text;
  cantos text;
  equipe uuid;
begin
  select public.shop_tz(b.id), greatest(1, coalesce(s.booking_horizon_days, 14)), s.corner_style
    into fuso, dias, cantos
    from public.barbershops b
    join public.barbershop_settings s on s.barbershop_id = b.id
   where b.id = loja and origem->>'canonical_host' = lower(p_host) and b.status = 'active'
     and coalesce((s.landing->>'enabled')::boolean, true)
     and coalesce((s.landing->>'show_staff')::boolean, true)
     and coalesce((s.landing->>'show_services')::boolean, true)
     and coalesce((s.landing->>'show_today')::boolean, true);
  if not found then return null; end if;
  hoje := (now() at time zone fuso)::date;

  if p_servico is null and p_profissional is null and p_dia is null then
    return jsonb_build_object('cantos', cantos, 'inicio', hoje, 'fim', hoje + dias - 1, 'opcoes', coalesce((
      select jsonb_agg(jsonb_build_object('servico', v.id, 'nome', v.name,
        'profissional', f.booking_slug, 'pessoa', f.display_name, 'duracao', t.duration_minutes)
        order by v.name, f.display_name, v.id, f.id)
      from public.services v
      join public.staff f on f.barbershop_id = v.barbershop_id and f.active and f.booking_slug is not null
      cross join lateral public.staff_service_terms(f.id, v.id) t
      where v.barbershop_id = loja and v.active
    ), '[]'::jsonb));
  end if;
  if p_dia is null or p_dia < hoje or p_dia >= hoje + dias then return '[]'::jsonb; end if;
  select f.id into equipe from public.staff f
    join public.services v on v.barbershop_id = f.barbershop_id and v.id = p_servico and v.active
   where f.barbershop_id = loja and f.active and f.booking_slug = p_profissional;
  if equipe is null or not exists (select 1 from public.staff_service_terms(equipe,p_servico)) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_char(h.starts_at at time zone fuso, 'HH24:MI') order by h.starts_at)
    from public.available_slots_internal(equipe, p_servico, p_dia) h
    where h.starts_at > now()), '[]'::jsonb);
end $$;
revoke all on function public.consultar_agenda_publica(text,uuid,text,date) from public;
grant execute on function public.consultar_agenda_publica(text,uuid,text,date) to anon, authenticated;
notify pgrst, 'reload schema';
