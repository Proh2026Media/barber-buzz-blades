-- Complete the service-image feature in environments where the original icon
-- migration was not applied, and align Storage access with current permissions.

alter table public.services add column if not exists icon text;
alter table public.staff_services add column if not exists icon text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'barbershop-services',
  'barbershop-services',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public Service Icons" on storage.objects;
drop policy if exists "Shop Admins Manage Service Icons" on storage.objects;
drop policy if exists "Public can view service images" on storage.objects;
drop policy if exists "Authorized users upload service images" on storage.objects;
drop policy if exists "Authorized users update service images" on storage.objects;
drop policy if exists "Authorized users delete service images" on storage.objects;

create policy "Public can view service images"
  on storage.objects for select
  using (bucket_id = 'barbershop-services');

create policy "Authorized users upload service images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'barbershop-services'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
      or public.shop_can_manage_services(((storage.foldername(name))[1])::uuid)
      or public.shop_can_manage_own_services(((storage.foldername(name))[1])::uuid)
    )
  );

create policy "Authorized users update service images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'barbershop-services'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
      or public.shop_can_manage_services(((storage.foldername(name))[1])::uuid)
      or public.shop_can_manage_own_services(((storage.foldername(name))[1])::uuid)
    )
  )
  with check (
    bucket_id = 'barbershop-services'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
      or public.shop_can_manage_services(((storage.foldername(name))[1])::uuid)
      or public.shop_can_manage_own_services(((storage.foldername(name))[1])::uuid)
    )
  );

create policy "Authorized users delete service images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'barbershop-services'
    and (
      public.is_platform_admin()
      or public.has_shop_role(
        ((storage.foldername(name))[1])::uuid,
        array['shop_admin']::public.app_role[]
      )
      or public.shop_can_manage_services(((storage.foldername(name))[1])::uuid)
      or public.shop_can_manage_own_services(((storage.foldername(name))[1])::uuid)
    )
  );

notify pgrst, 'reload schema';
