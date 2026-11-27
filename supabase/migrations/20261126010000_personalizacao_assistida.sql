-- A equipe usa a sua própria sessão. O vínculo é conferido ao listar, solicitar e aplicar.
create function public.shop_identity_fields() returns text[]
language sql immutable set search_path = '' as $$
  select array['display_name','tagline','logo_url','logo_background_color','login_image_url','login_layout',
    'font_family','custom_font_url','custom_font_name','custom_font_faces','font_scope','header_font_weight',
    'header_font_style','corner_style','floating_chrome','primary_color','accent_color','landing']::text[];
$$;
revoke all on function public.shop_identity_fields() from public, anon, authenticated;

create function public.list_managed_brand_shops()
returns table(id uuid, name text, slug text, timezone text, custom_domain text, custom_domain_status public.shop_domain_status)
language sql stable security definer set search_path = '' as $$
  select b.id,b.name,b.slug,b.timezone,b.custom_domain,b.custom_domain_status
  from public.account_manager_shops a join public.barbershops b on b.id=a.barbershop_id
  where a.user_id=auth.uid() and b.status='active' and public.is_account_manager_of(b.id)
  order by b.name,b.id;
$$;

create function public.get_managed_brand_settings(p_shop_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.list_managed_brand_shops() where id=p_shop_id) then
    raise exception 'Sem acesso a esta loja' using errcode='42501';
  end if;
  return (select jsonb_object_agg(e.key,e.value)
    from public.barbershop_settings s, lateral jsonb_each(to_jsonb(s)) e
    where s.barbershop_id=p_shop_id and
      e.key=any(public.shop_identity_fields() || array['barbershop_id','updated_at']));
end $$;
revoke all on function public.list_managed_brand_shops(), public.get_managed_brand_settings(uuid) from public,anon;
grant execute on function public.list_managed_brand_shops(), public.get_managed_brand_settings(uuid) to authenticated;

-- Arquivos novos são versionados. O envio do rascunho não precisa sobrescrever a arte publicada.
create policy "Gerente envia arte nova para unidade atribuida" on storage.objects
for insert to authenticated with check (
  (bucket_id='barbershop-logos' and name ~ '^[0-9a-f-]+/(logo-[0-9]+|login-background-[0-9]+[.]webp)$'
   or bucket_id='barbershop-fonts' and name ~ '^[0-9a-f-]+/family/[0-9]+-[0-9]+-[a-z0-9.-]+$')
  and exists(select 1 from public.list_managed_brand_shops() m where m.id::text=split_part(storage.objects.name,'/',1))
);

-- Só a arte existente no bucket da unidade pode entrar por uma solicitação da equipe.
create function public.managed_shop_asset_valid(shop_id uuid, field text, url text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from storage.objects o
    where split_part(o.name,'/',1)=shop_id::text
      and case field
        when 'logo_url' then o.bucket_id='barbershop-logos' and o.name ~ '/logo-[0-9]+$'
        when 'login_image_url' then o.bucket_id='barbershop-logos' and o.name ~ '/login-background-[0-9]+[.]webp$'
        when 'custom_font_url' then o.bucket_id='barbershop-fonts' and o.name ~ '/family/[0-9]+-[0-9]+-[a-z0-9.-]+$'
        else false end
      and split_part(url,'?',1) = any(array(
        select origin || '/storage/v1/object/public/' || o.bucket_id || '/' || o.name
        from unnest(array['https://supabasebeauty.contheiner.digital','https://supabase-barbearia.proh.media',
          nullif(current_setting('app.settings.storage_public_origin',true),'')]) origin
      ))
      and url ~ '^[^?#]+([?]v=[0-9]+)?$'
  );
$$;
revoke all on function public.managed_shop_asset_valid(uuid,text,text) from public,anon,authenticated;

create function public.prepare_managed_brand_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  changes jsonb := new.payload->'changes';
  settings jsonb;
  field text;
begin
  if new.requested_by is distinct from auth.uid() or new.source <> 'account_manager'
     or new.status <> 'pending' then
    raise exception 'Use o pedido de personalização da loja atribuída' using errcode='42501';
  end if;
  settings := public.get_managed_brand_settings(new.barbershop_id);
  if settings is null or jsonb_typeof(changes) is distinct from 'object' or changes='{}' then
    raise exception 'Informe as alterações de aparência' using errcode='22023';
  end if;
  if exists(select from jsonb_object_keys(changes) k where not k=any(public.shop_identity_fields())) then
    raise exception 'Campo fora da personalização' using errcode='22023';
  end if;
  foreach field in array array['logo_url','login_image_url','custom_font_url'] loop
    if changes->>field is not null and changes->field is distinct from settings->field
       and not public.managed_shop_asset_valid(new.barbershop_id,field,changes->>field) then
      raise exception 'Selecione um arquivo enviado para esta loja' using errcode='22023';
    end if;
  end loop;
  if changes ? 'custom_font_faces' then
    if jsonb_typeof(changes->'custom_font_faces') is distinct from 'array' then
      raise exception 'Família de fontes inválida' using errcode='22023';
    end if;
    if jsonb_array_length(changes->'custom_font_faces') > 12 or exists (
      select from jsonb_array_elements(changes->'custom_font_faces') face where
        not public.managed_shop_asset_valid(new.barbershop_id,'custom_font_url',face->>'url')
    ) then raise exception 'Selecione fontes enviadas para esta loja' using errcode='22023'; end if;
  end if;
  if changes ? 'landing' and not public.landing_config_valid(changes->'landing') then
    raise exception 'Revise as informações da página pública' using errcode='22023';
  end if;
  new.expires_at := least(coalesce(new.expires_at, now()+interval '30 minutes'), now()+interval '30 minutes');
  new.payload := jsonb_build_object('changes',changes,'previous',
    (select jsonb_object_agg(k,settings->k) from jsonb_object_keys(changes) k));
  return new;
end $$;
create trigger prepare_managed_brand_request before insert on public.shop_change_requests
for each row when (new.kind='identity.update') execute function public.prepare_managed_brand_request();
revoke all on function public.prepare_managed_brand_request() from public,anon,authenticated;

-- Entrada exclusivamente interna: a decisão de aprovação já travou e autorizou este pedido.
create function public.apply_managed_brand_request(req public.shop_change_requests) returns void
language plpgsql security definer set search_path = '' as $$
declare
  fields text;
  current_settings jsonb;
begin
  if req.source <> 'account_manager' or not exists (
    select from public.account_manager_shops a join public.barbershops b on b.id=a.barbershop_id
    join public.memberships m on m.user_id=a.user_id and m.role='account_manager'
    where a.user_id=req.requested_by and b.id=req.barbershop_id and b.status='active'
    for share of a,b,m
  ) then raise exception 'O vínculo desta loja não está ativo' using errcode='42501'; end if;
  select to_jsonb(s) into strict current_settings from public.barbershop_settings s
  where s.barbershop_id=req.barbershop_id for update;
  if exists(select from jsonb_each(req.payload->'previous') e where current_settings->e.key is distinct from e.value) then
    raise exception 'A aparência mudou após o pedido. Revise e solicite novamente.' using errcode='40001';
  end if;
  -- Somente identificadores da lista fechada entram na instrução. Valores seguem parametrizados.
  select string_agg(format('%I = patch.%I',k,k),', ') into fields
    from jsonb_object_keys(req.payload->'changes') k where k=any(public.shop_identity_fields());
  perform set_config('app.approved_shop_change','on',true);
  execute format('update public.barbershop_settings s set %s from jsonb_populate_record(null::public.barbershop_settings,$1) patch where s.barbershop_id=$2',fields)
    using req.payload->'changes', req.barbershop_id;
end $$;
revoke all on function public.apply_managed_brand_request(public.shop_change_requests) from public,anon,authenticated;

-- Guarda a autoria sem copiar imagens, fontes nem conteúdo da configuração.
create table public.shop_identity_audit (
  id bigint generated always as identity primary key,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  changed_fields text[] not null,
  created_at timestamptz not null default now()
);
alter table public.shop_identity_audit enable row level security;
revoke all on public.shop_identity_audit from anon, authenticated, public;
grant select on public.shop_identity_audit to authenticated;
create policy "Admin consulta historico da identidade" on public.shop_identity_audit
for select to authenticated using(public.is_platform_admin());
create function public.audit_shop_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  fields text[];
  before_row jsonb := to_jsonb(old);
  after_row jsonb := to_jsonb(new);
begin
  select array_agg(k order by k) into fields from unnest(public.shop_identity_fields()) k
  where before_row->k is distinct from after_row->k;
  if fields is not null then
    insert into public.shop_identity_audit(barbershop_id,actor_id,changed_fields)
    values(new.barbershop_id,auth.uid(),fields);
  end if;
  return null;
end $$;
revoke all on function public.audit_shop_identity() from public,anon,authenticated;
create trigger audit_shop_identity after update on public.barbershop_settings
for each row execute function public.audit_shop_identity();

-- A produção e a bancada têm revisões diferentes da governança das pausas semanais.
-- Estende só o despacho do pedido já autorizado, preservando a revisão de cada instalação.
do $migration$
declare
  definition text := pg_get_functiondef('public.decide_shop_change(uuid,boolean,text)'::regprocedure);
  original constant text := 'perform public.apply_shop_change(req.barbershop_id, req.kind, req.payload);';
  extended constant text := $dispatch$if req.kind = 'identity.update' then
    perform public.apply_managed_brand_request(req);
  else
    perform public.apply_shop_change(req.barbershop_id, req.kind, req.payload);
  end if;$dispatch$;
begin
  if array_length(string_to_array(definition,original),1) <> 2
     or position('apply_managed_brand_request' in definition) > 0 then
    raise exception 'Versão inesperada da aprovação de pedidos. Revise antes de aplicar.';
  end if;
  execute replace(definition,original,extended);
end $migration$;
