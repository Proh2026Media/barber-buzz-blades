-- Regressão: parceiro cuida dos próprios bloqueios e serviços, nunca dos de colegas.
-- Rode depois de 20260929170000_guard_own_professional_rows.sql, numa transação; sempre ROLLBACK.
create temporary table own_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() owner_id, gen_random_uuid() assoc_id,
  gen_random_uuid() owner_staff, gen_random_uuid() assoc_staff, gen_random_uuid() service_id,
  gen_random_uuid() block_id,
  ((current_date + 2)::timestamp + interval '15 hours') at time zone 'America/Sao_Paulo' as t;
grant select on own_ctx to authenticated;

create function pg_temp.check_own(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_own_error(statement text, label text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute statement; exception when others then failed := true; end;
  perform pg_temp.check_own(failed, label);
end $$;

insert into public.barbershops(id, name, slug) select shop_id, 'Own rows test', 'own-' || shop_id from own_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{}'::jsonb from own_ctx c cross join lateral unnest(array[c.owner_id, c.assoc_id]) u;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono', owner_id, 'dono' from own_ctx union all
select assoc_staff, shop_id, 'Parceiro', assoc_id, 'parceiro' from own_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select service_id, shop_id, 'Corte', 30, 5000 from own_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from own_ctx union all
select shop_id, assoc_id, assoc_staff, 'associate'::public.shop_member_role, null from own_ctx;

select set_config('request.jwt.claim.sub', assoc_id::text, true) from own_ctx;
set local role authenticated;

insert into public.availability_blocks(id, barbershop_id, staff_id, starts_at, ends_at, reason)
select block_id, shop_id, assoc_staff, t, t + interval '1 hour', 'Pausa' from own_ctx;
select pg_temp.check_own(
  exists (select 1 from public.availability_blocks b join own_ctx c on b.id = c.block_id),
  'Parceiro bloqueia a própria agenda');

select pg_temp.expect_own_error(
  $q$insert into public.availability_blocks(barbershop_id, staff_id, starts_at, ends_at, reason)
     select shop_id, owner_staff, t, t + interval '1 hour', 'x' from own_ctx$q$,
  'Parceiro não bloqueia a agenda do colega');

select pg_temp.expect_own_error(
  $q$update public.availability_blocks b set staff_id = c.owner_staff from own_ctx c where b.id = c.block_id$q$,
  'Parceiro não passa o próprio bloqueio para o colega');

insert into public.staff_services(barbershop_id, staff_id, service_id, display_name, duration_minutes, price_cents, active)
select shop_id, assoc_staff, service_id, 'Corte do parceiro', 40, 6000, true from own_ctx
on conflict (staff_id, service_id) do update set price_cents = excluded.price_cents;
select pg_temp.check_own(
  (select price_cents from public.staff_services s join own_ctx c on s.staff_id = c.assoc_staff and s.service_id = c.service_id) = 6000,
  'Parceiro ajusta o próprio preço do serviço');

select pg_temp.expect_own_error(
  $q$insert into public.staff_services(barbershop_id, staff_id, service_id, display_name, duration_minutes, price_cents, active)
     select shop_id, owner_staff, service_id, 'x', 30, 1, true from own_ctx$q$,
  'Parceiro não altera o serviço do colega');

delete from public.availability_blocks b using own_ctx c where b.id = c.block_id;
select pg_temp.check_own(
  not exists (select 1 from public.availability_blocks b join own_ctx c on b.id = c.block_id),
  'Parceiro remove o próprio bloqueio');

do $$ begin
  update public.services s set price_cents = 1 from own_ctx c where s.id = c.service_id;
exception when others then null; end $$;
reset role;
select pg_temp.check_own(
  (select price_cents from public.services s join own_ctx c on s.id = c.service_id) = 5000,
  'Parceiro continua sem alterar o catálogo da barbearia');
