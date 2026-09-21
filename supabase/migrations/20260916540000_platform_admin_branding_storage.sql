-- Platform admins may manage any barbershop logo; shop admins keep access to their own folder.
drop policy if exists "Shop admins upload their logo" on storage.objects;
create policy "Shop admins upload their logo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'barbershop-logos'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
    )
  );

drop policy if exists "Shop admins update their logo" on storage.objects;
create policy "Shop admins update their logo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'barbershop-logos'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
    )
  )
  with check (
    bucket_id = 'barbershop-logos'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
    )
  );

drop policy if exists "Shop admins delete their logo" on storage.objects;
create policy "Shop admins delete their logo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'barbershop-logos'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
    )
  );

notify pgrst, 'reload schema';
