-- Leitura das próprias permissões.
--
-- A matriz completa (`get_shop_permissions`) é restrita a quem administra a loja.
-- Cada membro, porém, precisa saber o que pode fazer para a interface mostrar ou
-- esconder as áreas certas. Esta função devolve apenas as permissões efetivas do
-- usuário atual, sem expor a configuração dos outros papéis.

create or replace function public.get_my_shop_permissions(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor_role public.shop_member_role; platform boolean; entries jsonb;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  platform := public.is_platform_admin();
  actor_role := public.current_shop_role(p_shop_id);

  -- Admin Global não depende da matriz: tem tudo.
  if platform then
    select coalesce(jsonb_object_agg(c.permission, true), '{}'::jsonb) into entries
    from public.shop_permission_catalog() c;
    return jsonb_build_object('role', null, 'platform_admin', true, 'permissions', entries);
  end if;

  if actor_role is null then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  select coalesce(jsonb_object_agg(
    c.permission,
    public.shop_role_permission_value(p_shop_id, actor_role, c.permission)
  ), '{}'::jsonb) into entries
  from public.shop_permission_catalog() c;

  return jsonb_build_object(
    'role', actor_role::text,
    'platform_admin', false,
    'permissions', entries
  );
end $$;

grant execute on function public.get_my_shop_permissions(uuid) to authenticated;
