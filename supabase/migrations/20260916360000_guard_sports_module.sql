create function public.guard_shop_sports_module() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if (tg_op='INSERT' and new.sports_enabled) or (tg_op='UPDATE' and new.sports_enabled is distinct from old.sports_enabled) then
    if auth.uid() is null or not is_platform_admin() then raise exception 'Only platform admins can change sports module' using errcode='42501'; end if;
  end if;
  return new;
end $$;
create trigger barbershop_settings_guard_sports before insert or update on public.barbershop_settings
for each row execute function public.guard_shop_sports_module();
notify pgrst,'reload schema';
