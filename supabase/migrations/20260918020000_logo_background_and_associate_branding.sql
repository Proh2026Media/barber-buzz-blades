-- Fundo da logo e personalização da marca por parceiro.
--
-- 1. Nova coluna `logo_background_color`: cor de fundo do quadrado da logo no
--    cabeçalho do cliente. Útil para logos sem fundo (transparentes).
-- 2. Dono, sócio e parceiro passam a poder editar a identidade visual da
--    própria barbearia (antes só dono/sócio, e na interface só o admin global).

alter table public.barbershop_settings add column if not exists logo_background_color text;

-- A mudança de fundo da logo conta como mudança visual.
create or replace function public.settings_change_is_visual(
  old_row public.barbershop_settings,
  new_row public.barbershop_settings
) returns boolean language sql immutable set search_path=public as $$
  select old_row.barbershop_id = new_row.barbershop_id
    and (to_jsonb(old_row) - array[
      'display_name','logo_url','logo_background_color','font_family','custom_font_url',
      'custom_font_name','custom_font_faces','font_scope','header_font_weight',
      'header_font_style','corner_style','primary_color','accent_color','tagline','updated_at'
    ]) = (to_jsonb(new_row) - array[
      'display_name','logo_url','logo_background_color','font_family','custom_font_url',
      'custom_font_name','custom_font_faces','font_scope','header_font_weight',
      'header_font_style','corner_style','primary_color','accent_color','tagline','updated_at'
    ])
$$;

-- Dono, sócio e parceiro aplicam mudanças visuais livremente. Mudanças não
-- visuais continuam seguindo a governança societária (dono/sócio) ou são
-- recusadas (parceiro/contratado).
create or replace function public.guard_protected_shop_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare sid uuid; is_visual boolean := false;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if current_setting('app.approved_shop_change', true) = 'on' or public.is_platform_admin() then
    return coalesce(new, old);
  end if;
  sid := coalesce(new.barbershop_id, old.barbershop_id);
  if tg_table_name = 'barbershop_settings' and tg_op = 'UPDATE' then
    is_visual := public.settings_change_is_visual(old, new);
  end if;
  if is_visual and public.has_shop_member_role(
    sid, array['owner','partner','associate']::public.shop_member_role[]
  ) then
    return new;
  end if;
  if public.has_shop_member_role(sid, array['owner','partner']::public.shop_member_role[]) then
    if public.can_apply_protected_change(sid) then return coalesce(new, old); end if;
    if public.shop_governance_mode(sid) = 'equal' then
      raise exception 'Esta mudança precisa da aprovação do outro sócio' using errcode='42501',
        hint='Use request_shop_change';
    end if;
    raise exception 'Somente o sócio majoritário pode realizar esta mudança' using errcode='42501';
  end if;
  raise exception 'Sem permissão para alterar este item' using errcode='42501';
end $$;

-- A política de UPDATE em `barbershop_settings` passa a aceitar parceiro; o
-- trigger acima mantém a separação entre o que é visual e o que é operacional.
drop policy if exists "Owners partners update settings" on public.barbershop_settings;
drop policy if exists "Shop members update settings" on public.barbershop_settings;
create policy "Shop members update settings" on public.barbershop_settings for update to authenticated using(
  public.is_platform_admin()
  or public.has_shop_member_role(barbershop_id, array['owner','partner','associate']::public.shop_member_role[]))
with check(public.is_platform_admin()
  or public.has_shop_member_role(barbershop_id, array['owner','partner','associate']::public.shop_member_role[]));
