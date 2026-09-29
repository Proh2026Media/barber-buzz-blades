-- Parceiro/contratado voltam a cuidar do que é deles (bloqueios, serviços próprios e perfil).
-- A governança societária seguia recusando essas linhas antes das políticas próprias valerem.
-- As políticas RLS e guard_staff_profile_update continuam decidindo capacidade e colunas.

create or replace function public.guard_protected_shop_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  is_visual boolean := false;
  my_staff uuid;
  old_owner text;
  new_owner text;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if current_setting('app.approved_shop_change', true) = 'on' or public.is_platform_admin() then
    return coalesce(new, old);
  end if;
  -- Gerente de conta: nunca aplica direto (só via pedido aprovado).
  if public.is_account_manager_of(coalesce(new.barbershop_id, old.barbershop_id))
    and not public.is_platform_admin() then
    raise exception 'Gerente de conta precisa de aprovação do dono' using errcode='42501',
      hint='Use request_shop_change';
  end if;
  sid := coalesce(new.barbershop_id, old.barbershop_id);

  if tg_table_name in ('availability_blocks', 'staff_services', 'staff')
    and not public.has_shop_member_role(sid, array['owner','partner']::public.shop_member_role[]) then
    my_staff := public.current_staff_id(sid);
    if my_staff is not null then
      if tg_table_name = 'staff' then
        old_owner := case when old is null then null else to_jsonb(old)->>'id' end;
        new_owner := case when new is null then null else to_jsonb(new)->>'id' end;
      else
        old_owner := case when old is null then null else to_jsonb(old)->>'staff_id' end;
        new_owner := case when new is null then null else to_jsonb(new)->>'staff_id' end;
      end if;
      if (tg_op = 'INSERT' and new_owner = my_staff::text)
        or (tg_op = 'UPDATE' and old_owner = my_staff::text and new_owner = my_staff::text)
        or (tg_op = 'DELETE' and old_owner = my_staff::text) then
        return coalesce(new, old);
      end if;
    end if;
  end if;

  if tg_table_name = 'barbershop_settings' and tg_op = 'UPDATE' then
    is_visual := public.settings_change_is_visual(old, new);
  end if;
  -- Visual só para dono/co-dono (não parceiro).
  if is_visual and public.has_shop_member_role(
    sid, array['owner','partner']::public.shop_member_role[]
  ) then
    if public.can_apply_protected_change(sid) then return new; end if;
    if public.shop_governance_mode(sid) in ('equal', 'majority') then
      raise exception 'Esta mudança precisa da aprovação do outro sócio' using errcode='42501',
        hint='Use request_shop_change';
    end if;
    raise exception 'Somente o sócio majoritário pode realizar esta mudança' using errcode='42501';
  end if;
  if public.has_shop_member_role(sid, array['owner','partner']::public.shop_member_role[]) then
    if public.can_apply_protected_change(sid) then return coalesce(new, old); end if;
    if public.shop_governance_mode(sid) in ('equal', 'majority') then
      raise exception 'Esta mudança precisa da aprovação do outro sócio' using errcode='42501',
        hint='Use request_shop_change';
    end if;
    raise exception 'Somente o sócio majoritário pode realizar esta mudança' using errcode='42501';
  end if;
  raise exception 'Sem permissão para alterar este item' using errcode='42501';
end $$;
