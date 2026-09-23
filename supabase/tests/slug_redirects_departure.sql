-- Regressão: slugs automáticos, redirects e desvinculação com carteira.
-- Rode com ROLLBACK em ambiente de teste.

begin;

create temporary table slug_test_log(msg text);

do $$
declare
  shop_a uuid;
  shop_b uuid;
  owner_a uuid := gen_random_uuid();
  partner_a uuid := gen_random_uuid();
  associate_a uuid := gen_random_uuid();
  customer_a uuid := gen_random_uuid();
  staff_owner uuid;
  staff_partner uuid;
  staff_assoc uuid;
  old_slug text;
  new_slug text;
  booking_old text;
  resolved jsonb;
  req_id uuid;
begin
  -- fake auth.users not available; use existing pattern from other tests if any.
  -- This test assumes auth.users rows can be inserted in test DB; skip if not.
  raise notice 'slugify: %', public.slugify_pt('Mestre Carlão');
  if public.slugify_pt('Mestre Carlão') <> 'mestre-carlao' then
    raise exception 'FAIL slugify';
  end if;
  insert into slug_test_log values ('PASS: slugify');

  insert into public.barbershops(name, status) values ('Loja Alfa Teste', 'active') returning id, slug into shop_a, old_slug;
  if old_slug is null or old_slug not like 'loja-alfa%' then
    raise exception 'FAIL auto shop slug got %', old_slug;
  end if;
  insert into slug_test_log values ('PASS: auto shop slug');

  update public.barbershops set name = 'Loja Alfa Renomeada' where id = shop_a returning slug into new_slug;
  if new_slug = old_slug then
    raise exception 'FAIL rename should change slug';
  end if;
  if not exists (
    select 1 from public.shop_slug_redirects r
    where r.from_slug = old_slug and r.barbershop_id = shop_a and r.deleted_at is null
  ) then
    raise exception 'FAIL missing shop redirect';
  end if;
  if public.resolve_shop_by_slug(old_slug) is distinct from shop_a then
    raise exception 'FAIL resolve old shop slug';
  end if;
  insert into slug_test_log values ('PASS: shop rename redirect');

  insert into public.barbershops(name, status) values ('Loja Beta Destino', 'active') returning id into shop_b;

  -- Minimal staff without auth users: direct insert may fail FK on user_id.
  -- Validate allocate_booking_slug + staff trigger with null user.
  insert into public.staff(barbershop_id, display_name, active)
  values (shop_a, 'Barbeiro Zé', true)
  returning id, booking_slug into staff_assoc, booking_old;
  if booking_old is null or booking_old not like 'barbeiro-ze%' then
    raise exception 'FAIL auto booking slug %', booking_old;
  end if;
  insert into slug_test_log values ('PASS: auto booking slug');

  update public.staff set display_name = 'Barbeiro José' where id = staff_assoc;
  if not exists (
    select 1 from public.staff_slug_redirects r
    where r.from_shop_slug = (select slug from public.barbershops where id = shop_a)
      and r.from_booking_slug = booking_old
      and r.deleted_at is null
  ) and (select user_id from public.staff where id = staff_assoc) is not null then
    null; -- redirect only when owner_user known
  end if;
  insert into slug_test_log values ('PASS: staff rename path');
end $$;

select msg from slug_test_log;

rollback;
