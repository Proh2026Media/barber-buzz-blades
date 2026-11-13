-- Nº 117. Requer nº 116. Catálogo operacional, sem apagar lojas nem vínculos históricos.
begin;
alter function public.platform_whatsapp_directory() rename to platform_whatsapp_directory_before_complete_shops;
revoke all on function public.platform_whatsapp_directory_before_complete_shops() from public,anon,authenticated,service_role;
create function public.platform_whatsapp_directory() returns jsonb
language plpgsql security definer set search_path=public as $$
declare d jsonb; valid_shops uuid[];
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  d := public.platform_whatsapp_directory_before_complete_shops();
  -- Mesma estrutura mínima criada atomicamente no cadastro: identificação, configurações e dono.
  -- Não exigir logo, equipe, serviços ou WhatsApp: uma loja nova legítima ainda pode configurá-los.
  select coalesce(array_agg(b.id),array[]::uuid[]) into valid_shops
  from public.barbershops b where b.status='active' and nullif(trim(b.name),'') is not null
    and nullif(trim(b.slug),'') is not null
    and exists(select 1 from public.barbershop_settings s where s.barbershop_id=b.id)
    and exists(select 1 from public.shop_members m where m.barbershop_id=b.id and m.role='owner' and m.active);
  return d || jsonb_build_object(
    'complete_shops_only',true,
    'shops',coalesce((select jsonb_agg(item order by item->>'name') from jsonb_array_elements(d->'shops') item where (item->>'id')::uuid=any(valid_shops)),'[]'::jsonb),
    'staff',coalesce((select jsonb_agg(item) from jsonb_array_elements(d->'staff') item where (item->>'shop_id')::uuid=any(valid_shops)),'[]'::jsonb)
  );
end $$;
revoke all on function public.platform_whatsapp_directory() from public,anon,service_role;
grant execute on function public.platform_whatsapp_directory() to authenticated;
notify pgrst,'reload schema';
commit;
