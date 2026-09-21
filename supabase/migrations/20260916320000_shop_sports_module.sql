alter table public.barbershop_settings add column sports_enabled boolean not null default false;
create function public.set_shop_sports_module(p_shop_id uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not is_platform_admin() then raise exception 'Not allowed'; end if;
  if p_enabled is null then raise exception 'Enabled is required'; end if;
  update barbershop_settings set sports_enabled=p_enabled where barbershop_id=p_shop_id;
  if not found then raise exception 'Shop not found'; end if;
end $$;
revoke all on function public.set_shop_sports_module(uuid,boolean) from public,anon;
grant execute on function public.set_shop_sports_module(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
