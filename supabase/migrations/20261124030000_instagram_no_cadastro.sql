-- O gatilho existente barbershop_auto_slug_trg resolve colisões e endereços reservados.
create or replace function public.preparar_slug_do_cadastro() returns trigger
language plpgsql set search_path = public as $$
declare
  sugestao text := nullif(current_setting('app.cadastro_slug_sugerido', true), '');
begin
  if new.slug is null and sugestao is not null and new.founded_by_user_id = auth.uid() then
    new.slug := sugestao;
  end if;
  return new;
end $$;
drop trigger if exists antes_do_slug_de_cadastro on public.barbershops;
create trigger antes_do_slug_de_cadastro before insert on public.barbershops
for each row execute function public.preparar_slug_do_cadastro();

create or replace function public.register_my_barbershop(
  p_request_id uuid, p_name text, p_timezone text, p_society_intent text,
  p_terms_accepted boolean, p_terms_version text, p_privacy_version text, p_dpa_version text,
  p_instagram text, p_usar_instagram boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  perfil text := nullif(lower(trim(p_instagram)), '');
  anterior text := current_setting('app.cadastro_slug_sugerido', true);
  resultado jsonb;
  repetido boolean;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(hashtextextended('shop-registration:'||auth.uid()::text,0));
  select exists(select 1 from public.shop_registration_requests where user_id=auth.uid()
    and request_id=p_request_id) into repetido;
  if not repetido and ((perfil is not null and (perfil !~ '^[a-z0-9._]{1,30}$' or perfil !~ '[a-z0-9]'))
    or (p_usar_instagram and perfil is null)) then
    raise exception 'Informe um perfil válido do Instagram.' using errcode='22023';
  end if;
  if p_usar_instagram and not repetido then
    perform pg_advisory_xact_lock(hashtextextended('cadastro-subdominio:'||public.slugify_pt(perfil),0));
    perform set_config('app.cadastro_slug_sugerido', public.slugify_pt(perfil), true);
  end if;
  resultado := public.register_my_barbershop(p_request_id,p_name,p_timezone,p_society_intent,
    p_terms_accepted,p_terms_version,p_privacy_version,p_dpa_version);
  perform set_config('app.cadastro_slug_sugerido', coalesce(anterior,''), true);
  if perfil is not null and not repetido then
    update public.barbershop_settings set landing = landing || jsonb_build_object('instagram',perfil)
    where barbershop_id=(resultado->>'shop_id')::uuid;
    if not found then raise exception 'Configuração da barbearia indisponível.'; end if;
  end if;
  return resultado;
end $$;
revoke all on function public.register_my_barbershop(uuid,text,text,text,boolean,text,text,text,text,boolean) from public, anon;
grant execute on function public.register_my_barbershop(uuid,text,text,text,boolean,text,text,text,text,boolean) to authenticated;
notify pgrst,'reload schema';
