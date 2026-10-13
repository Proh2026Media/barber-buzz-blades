-- Guia da loja no banco e e-mails da plataforma (20261013230000_guia_loja_e_emails.sql):
-- P-20 e P-12. Rodar numa transação, sempre com ROLLBACK: BEGIN; \i este arquivo; ROLLBACK;
-- Dados fictícios com IDs aleatórios.
create temporary table gl_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() other_shop, gen_random_uuid() owner_id,
  gen_random_uuid() owner_staff, gen_random_uuid() employee_id, gen_random_uuid() employee_staff,
  gen_random_uuid() admin_id, gen_random_uuid() stranger_id;
grant select on gl_ctx to authenticated;
select * from gl_ctx \gset

create function pg_temp.check_gl(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_gl_error(statement text, label text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute statement; exception when others then failed := true; end;
  perform pg_temp.check_gl(failed, label);
end $$;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true)
$$;

insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{"full_name":"Pessoa GL"}'::jsonb
from gl_ctx c cross join lateral unnest(array[c.owner_id, c.employee_id, c.admin_id, c.stranger_id]) u;
insert into public.barbershops(id, name, slug, timezone, founded_by_user_id)
select shop_id, 'Guia GL', 'gl-' || shop_id, 'America/Sao_Paulo', owner_id from gl_ctx union all
select other_shop, 'Outra GL', 'gl-o-' || other_shop, 'America/Sao_Paulo', null from gl_ctx;
insert into public.memberships(user_id, barbershop_id, role)
select admin_id, null, 'platform_admin'::public.app_role from gl_ctx;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono GL', owner_id, 'dono' from gl_ctx union all
select employee_staff, shop_id, 'Contratado GL', employee_id, 'contratado' from gl_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from gl_ctx union all
select shop_id, employee_id, employee_staff, 'employee'::public.shop_member_role, null from gl_ctx;

select pg_temp.check_gl(
  not has_table_privilege('authenticated', 'public.shop_setup_guides', 'select')
  and not has_function_privilege('anon', 'public.save_shop_setup_guide(uuid, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.platform_user_emails(uuid[])', 'execute'),
  'Guia só pelas funções; anônimo sem acesso');

-- ---------------------------------------------------------------------------
-- P-20
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.check_gl(public.get_shop_setup_guide(:'shop_id') = '{}'::jsonb, 'Loja sem guia salvo começa vazia');
select public.save_shop_setup_guide(:'shop_id', '{"hoursOk": true, "linkCopied": true, "x": 1, "teamOk": "sim"}');
select public.save_shop_setup_guide(:'shop_id', '{"hidden": true}');
select pg_temp.check_gl(
  public.get_shop_setup_guide(:'shop_id') = '{"hoursOk": true, "linkCopied": true, "hidden": true}'::jsonb,
  'Dono grava e junta só as chaves conhecidas com verdadeiro/falso');
select public.save_shop_setup_guide(:'shop_id', '{"hidden": false}');
select pg_temp.check_gl(
  (public.get_shop_setup_guide(:'shop_id')->>'hidden')::boolean = false
  and (public.get_shop_setup_guide(:'shop_id')->>'hoursOk')::boolean,
  'Mostrar o guia de novo mantém os passos marcados');
select pg_temp.expect_gl_error(
  format('select public.save_shop_setup_guide(%L, %L)', :'other_shop', '{"hidden": true}'),
  'Dono não grava o guia de outra loja');
select pg_temp.expect_gl_error(
  format('select public.save_shop_setup_guide(%L, %L)', :'shop_id', '[1]'),
  'Guia que não é objeto é recusado');
reset role;

select pg_temp.as_user(:'employee_id');
set local role authenticated;
select pg_temp.expect_gl_error(
  format('select public.get_shop_setup_guide(%L)', :'shop_id'),
  'Contratado não lê o guia');
select pg_temp.expect_gl_error(
  format('select public.save_shop_setup_guide(%L, %L)', :'shop_id', '{"hidden": true}'),
  'Contratado não grava o guia');
reset role;

select pg_temp.as_user(:'admin_id');
set local role authenticated;
select pg_temp.check_gl(
  (public.get_shop_setup_guide(:'shop_id')->>'linkCopied')::boolean,
  'Admin da plataforma lê o guia da loja');
reset role;

-- ---------------------------------------------------------------------------
-- P-12
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'admin_id');
set local role authenticated;
select pg_temp.check_gl(
  (select count(*) = 2 and bool_and(email like '%@example.invalid')
   from public.platform_user_emails(array[:'owner_id', :'employee_id']::uuid[])),
  'Admin da plataforma recebe o e-mail das pessoas pedidas');
reset role;

select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.expect_gl_error(
  format('select * from public.platform_user_emails(array[%L]::uuid[])', :'employee_id'),
  'Dono de loja não lê e-mails pela função da plataforma');
reset role;
select set_config('request.jwt.claim.sub', '', true);
