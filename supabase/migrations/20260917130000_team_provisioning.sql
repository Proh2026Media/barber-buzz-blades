-- Transactional platform provisioning for professional accounts.
create or replace function public.platform_add_shop_member(
  p_shop_id uuid,
  p_user_id uuid,
  p_role public.shop_member_role,
  p_ownership_percent numeric default null,
  p_display_name text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare staffid uuid; memberid uuid; owner_share numeric;
begin
  if not public.is_platform_admin() then raise exception 'Platform admin required' using errcode='42501'; end if;
  if p_role='owner' then raise exception 'Use the ownership transfer flow to replace an owner' using errcode='22023'; end if;
  if exists(select 1 from public.shop_members where barbershop_id=p_shop_id and user_id=p_user_id) then
    raise exception 'This account already belongs to the professional team' using errcode='23505';
  end if;
  select id into staffid from public.staff where barbershop_id=p_shop_id and user_id=p_user_id;
  if staffid is null then
    insert into public.staff(barbershop_id,user_id,display_name,active)
    values(p_shop_id,p_user_id,coalesce(nullif(trim(p_display_name),''),(select full_name from public.profiles where id=p_user_id),'Profissional'),true)
    returning id into staffid;
  end if;
  if p_role='partner' then
    if p_ownership_percent is null or p_ownership_percent<=0 or p_ownership_percent>=100 then
      raise exception 'Partner ownership must be between 0 and 100' using errcode='22023';
    end if;
    select ownership_percent into owner_share from public.shop_members
    where barbershop_id=p_shop_id and role='owner' and active for update;
    if owner_share is null or owner_share<=p_ownership_percent then
      raise exception 'The owner does not have enough participation to transfer' using errcode='23514';
    end if;
    update public.shop_members set ownership_percent=ownership_percent-p_ownership_percent
    where barbershop_id=p_shop_id and role='owner' and active;
  elsif p_ownership_percent is not null then
    raise exception 'Only partners receive ownership percentage' using errcode='22023';
  end if;
  insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
  values(p_shop_id,p_user_id,staffid,p_role,case when p_role='partner' then p_ownership_percent else null end)
  returning id into memberid;
  return memberid;
end $$;

revoke all on function public.platform_add_shop_member(uuid,uuid,public.shop_member_role,numeric,text) from public,anon;
grant execute on function public.platform_add_shop_member(uuid,uuid,public.shop_member_role,numeric,text) to authenticated;
notify pgrst,'reload schema';
