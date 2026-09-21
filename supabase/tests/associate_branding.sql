-- Regressão: parceiro edita identidade visual, não edita o operacional.
-- Rodar depois de 20260918020000_* na mesma transação; sempre ROLLBACK.
create temporary table brand_test_context as
select gen_random_uuid() shop_id, gen_random_uuid() owner_id, gen_random_uuid() associate_id,
  gen_random_uuid() owner_staff, gen_random_uuid() associate_staff;
grant select on brand_test_context to authenticated;

select shop_id, owner_id, associate_id, owner_staff, associate_staff
from brand_test_context \gset

create function pg_temp.check_brand(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_brand_error(statement text, expected text, label text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; exception when others then get stacked diagnostics actual = returned_sqlstate; end;
  perform pg_temp.check_brand(actual = expected, label);
end $$;

insert into public.barbershops(id, name, slug)
select shop_id, 'Brand test', 'brand-test-' || shop_id from brand_test_context;

insert into auth.users(id, email, raw_user_meta_data)
select user_id, user_id || '@example.invalid', '{}'::jsonb from brand_test_context c
cross join lateral unnest(array[c.owner_id, c.associate_id]) u(user_id);

insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Owner', owner_id, 'owner' from brand_test_context union all
select associate_staff, shop_id, 'Associate', associate_id, 'associate' from brand_test_context;

insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100::numeric from brand_test_context union all
select shop_id, associate_id, associate_staff, 'associate'::public.shop_member_role, null::numeric from brand_test_context;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Parceiro edita a identidade visual
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'associate_id', true);
update public.barbershop_settings
set display_name = 'Nova Marca', logo_background_color = '#112233'
where barbershop_id = :'shop_id';
select pg_temp.check_brand(
  (select display_name = 'Nova Marca' and logo_background_color = '#112233'
   from public.barbershop_settings where barbershop_id = :'shop_id'),
  'Parceiro edita nome e fundo da logo');

-- ---------------------------------------------------------------------------
-- Parceiro NÃO edita o operacional (fora da lista de visual)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'associate_id', true);
select pg_temp.expect_brand_error(
  format('update public.barbershop_settings set booking_horizon_days = 30 where barbershop_id = %L', :'shop_id'),
  '42501', 'Parceiro é bloqueado em mudança operacional');

-- ---------------------------------------------------------------------------
-- Dono continua editando visual livremente (governança single)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'owner_id', true);
update public.barbershop_settings set accent_color = '#556677' where barbershop_id = :'shop_id';
select pg_temp.check_brand(
  (select accent_color = '#556677' from public.barbershop_settings where barbershop_id = :'shop_id'),
  'Dono edita a cor de destaque');

reset role;
