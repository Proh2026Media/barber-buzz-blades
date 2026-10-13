-- Convite com link, boas-vindas e regras de papel (20261013210000_convite_boas_vindas_papeis.sql):
-- P-02, P-03, P-05, P-06, P-08, P-09, P-13, P-15, P-17 e P-66.
-- Rodar numa transação, sempre com ROLLBACK: BEGIN; \i este arquivo; ROLLBACK;
-- Dados fictícios com IDs aleatórios.
create temporary table cb_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() bare_id, gen_random_uuid() equal_id,
  gen_random_uuid() owner_id, gen_random_uuid() owner_staff,
  gen_random_uuid() employee_id, gen_random_uuid() employee_staff,
  gen_random_uuid() colleague_id, gen_random_uuid() colleague_staff,
  gen_random_uuid() card_staff, gen_random_uuid() card_user,
  gen_random_uuid() admin_id, gen_random_uuid() first_owner_id, gen_random_uuid() second_owner_id,
  gen_random_uuid() eq_a, gen_random_uuid() eq_a_staff, gen_random_uuid() eq_b, gen_random_uuid() eq_b_staff,
  gen_random_uuid() invited_id, gen_random_uuid() cust_id, gen_random_uuid() corte,
  gen_random_uuid() ap_employee, gen_random_uuid() ap_colleague;
grant select on cb_ctx to authenticated;
select * from cb_ctx \gset

create function pg_temp.check_cb(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_cb_error(statement text, label text, expected_state text default null, expected_text text default null)
returns void language plpgsql as $$
declare failed boolean := false; state text; msg text;
begin
  begin execute statement;
  exception when others then
    failed := true;
    get stacked diagnostics state = returned_sqlstate, msg = message_text;
  end;
  if failed and ((expected_state is not null and state is distinct from expected_state)
     or (expected_text is not null and msg not ilike '%' || expected_text || '%')) then
    raise notice 'recebido: % (%)', msg, state;
    failed := false;
  end if;
  perform pg_temp.check_cb(failed, label);
end $$;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true)
$$;

insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{"full_name":"Pessoa CB"}'::jsonb
from cb_ctx c
cross join lateral unnest(array[c.owner_id, c.employee_id, c.colleague_id, c.card_user, c.admin_id,
  c.first_owner_id, c.second_owner_id, c.eq_a, c.eq_b, c.invited_id, c.cust_id]) u;
insert into public.barbershops(id, name, slug, timezone, founded_by_user_id)
select shop_id, 'Convite CB', 'cb-' || shop_id, 'America/Sao_Paulo', owner_id from cb_ctx union all
select bare_id, 'Sem dono CB', 'cb-bare-' || bare_id, 'America/Sao_Paulo', null from cb_ctx union all
select equal_id, 'Iguais CB', 'cb-eq-' || equal_id, 'America/Sao_Paulo', eq_a from cb_ctx;
insert into public.memberships(user_id, barbershop_id, role)
select admin_id, null, 'platform_admin'::public.app_role from cb_ctx union all
select cust_id, shop_id, 'customer'::public.app_role from cb_ctx;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono CB', owner_id, 'dono' from cb_ctx union all
select employee_staff, shop_id, 'Contratado CB', employee_id, 'contratado' from cb_ctx union all
select colleague_staff, shop_id, 'Colega CB', colleague_id, 'colega' from cb_ctx union all
select card_staff, shop_id, 'Ana só na agenda', null, 'ana' from cb_ctx union all
select eq_a_staff, equal_id, 'Sócio A', eq_a, 'socio-a' from cb_ctx union all
select eq_b_staff, equal_id, 'Sócio B', eq_b, 'socio-b' from cb_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from cb_ctx union all
select shop_id, employee_id, employee_staff, 'employee'::public.shop_member_role, null from cb_ctx union all
select shop_id, colleague_id, colleague_staff, 'employee'::public.shop_member_role, null from cb_ctx union all
select equal_id, eq_a, eq_a_staff, 'owner'::public.shop_member_role, 50 from cb_ctx union all
select equal_id, eq_b, eq_b_staff, 'owner'::public.shop_member_role, 50 from cb_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select corte, shop_id, 'Corte', 30, 5000 from cb_ctx;
insert into public.barbershop_settings(barbershop_id) select shop_id from cb_ctx on conflict do nothing;
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select shop_id, w, true, '00:00', '23:59' from cb_ctx cross join generate_series(0, 6) w
on conflict (barbershop_id, weekday) do update set is_open = true, opens_at = '00:00', closes_at = '23:59';
-- Reservas daqui a 2 dias (fuso da loja): Contratado às 13h, colega às 14h.
insert into public.appointments(id, barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status)
select x.ap, c.shop_id, c.cust_id, c.corte, x.st,
  (((now() at time zone 'America/Sao_Paulo')::date + 2) + x.h) at time zone 'America/Sao_Paulo',
  (((now() at time zone 'America/Sao_Paulo')::date + 2) + x.h + interval '30 minutes') at time zone 'America/Sao_Paulo',
  'confirmed'
from cb_ctx c
cross join lateral (values (c.ap_employee, c.employee_staff, time '13:00'),
  (c.ap_colleague, c.colleague_staff, time '14:00')) x(ap, st, h);

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

select pg_temp.check_cb(
  not has_function_privilege('authenticated', 'public.apply_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.apply_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.shop_add_member(uuid, uuid, public.shop_member_role, numeric, text, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.shop_add_member(uuid, uuid, public.shop_member_role, numeric, text, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.platform_add_shop_member(uuid, uuid, public.shop_member_role, numeric, text, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.apply_shop_change(uuid, text, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.save_shop_permissions(uuid, jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.mark_shop_welcome_seen(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.mark_shop_welcome_seen(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.get_my_pending_shop_invites()', 'execute')
  and not has_function_privilege('anon', 'public.get_my_pending_shop_invites()', 'execute')
  and not has_table_privilege('authenticated', 'public.shop_invite_links', 'select')
  and not has_table_privilege('anon', 'public.shop_invite_links', 'select')
  and has_table_privilege('service_role', 'public.shop_invite_links', 'insert'),
  'Funções novas só para quem entrou; links de convite só para o servidor');

select pg_temp.check_cb(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('apply_add_shop_member', 'shop_add_member', 'platform_add_shop_member')) = 3,
  'Uma versão só de cada função de entrada na equipe (sem PGRST203)');

-- ---------------------------------------------------------------------------
-- P-17. Boas-vindas por vínculo
-- ---------------------------------------------------------------------------

select pg_temp.check_cb(
  (select welcome_seen_at is null from public.shop_members where barbershop_id = :'shop_id' and user_id = :'employee_id'),
  'Vínculo novo nasce sem ter visto as boas-vindas');

select pg_temp.check_cb(
  (select welcome_seen_at is not null from public.shop_members where barbershop_id = :'shop_id' and user_id = :'owner_id'),
  'Quem abriu a barbearia não recebe boas-vindas');

select pg_temp.as_user(:'employee_id');
set local role authenticated;
select pg_temp.check_cb(public.mark_shop_welcome_seen(:'shop_id') and not public.mark_shop_welcome_seen(:'shop_id'),
  'Contratado marca as boas-vindas como vistas uma vez');
reset role;
select pg_temp.check_cb(
  (select welcome_seen_at is not null from public.shop_members where barbershop_id = :'shop_id' and user_id = :'employee_id'),
  'A marca fica gravada no vínculo');

update public.appointments set status = 'cancelled' where id = :'ap_colleague';
update public.shop_members set active = false where barbershop_id = :'shop_id' and user_id = :'colleague_id';
update public.shop_members set welcome_seen_at = now() where barbershop_id = :'shop_id' and user_id = :'colleague_id';
update public.shop_members set active = true where barbershop_id = :'shop_id' and user_id = :'colleague_id';
select pg_temp.check_cb(
  (select welcome_seen_at is null from public.shop_members where barbershop_id = :'shop_id' and user_id = :'colleague_id'),
  'Voltar à equipe mostra as boas-vindas de novo');
update public.appointments set status = 'confirmed' where id = :'ap_colleague';

-- ---------------------------------------------------------------------------
-- P-06. Primeiro dono de loja sem dono
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'admin_id');
set local role authenticated;
select pg_temp.expect_cb_error(
  format('select public.platform_add_shop_member(%L, %L, ''owner'', 50, ''Primeiro'')', :'bare_id', :'first_owner_id'),
  'Primeiro dono com parte menor que 100% é recusado', '22023');
select public.platform_add_shop_member(:'bare_id', :'first_owner_id', 'owner', null, 'Primeiro dono');
reset role;
select pg_temp.check_cb(
  (select ownership_percent = 100 and active and welcome_seen_at is null
   from public.shop_members where barbershop_id = :'bare_id' and user_id = :'first_owner_id'),
  'Loja sem dono recebe o primeiro dono com 100% (e boas-vindas)');

select pg_temp.as_user(:'admin_id');
set local role authenticated;
select public.platform_add_shop_member(:'bare_id', :'second_owner_id', 'owner', 30, 'Segundo dono');
reset role;
select pg_temp.check_cb(
  (select ownership_percent = 70 from public.shop_members where barbershop_id = :'bare_id' and user_id = :'first_owner_id')
  and (select ownership_percent = 30 from public.shop_members where barbershop_id = :'bare_id' and user_id = :'second_owner_id'),
  'Com dono, a regra de ceder parte continua (70% + 30%)');

-- ---------------------------------------------------------------------------
-- P-08. Dar acesso ao painel liga ao cartão existente
-- ---------------------------------------------------------------------------

create temporary table cb_staff_count as
select count(*) n from public.staff where barbershop_id = (select shop_id from cb_ctx);
select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.check_cb(
  (public.shop_add_member(:'shop_id', :'card_user', 'employee', null, 'Ana', :'card_staff')->>'status') = 'applied',
  'Dono dá acesso ao painel pelo cartão da Ana');
reset role;
select pg_temp.check_cb(
  (select staff_id = :'card_staff'::uuid from public.shop_members where barbershop_id = :'shop_id' and user_id = :'card_user')
  and (select user_id = :'card_user'::uuid from public.staff where id = :'card_staff')
  and (select count(*) from public.staff where barbershop_id = :'shop_id') = (select n from cb_staff_count),
  'A conta fica ligada ao cartão que já existia, sem cartão novo');

select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.expect_cb_error(
  format('select public.shop_add_member(%L, %L, ''employee'', null, ''Outra'', %L)', :'shop_id', :'invited_id', :'card_staff'),
  'Cartão já ligado a outra conta é recusado', '23505', 'outra conta');
reset role;

-- ---------------------------------------------------------------------------
-- P-05. Convite aguardando aprovação, legível pela pessoa convidada
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'eq_a');
set local role authenticated;
select pg_temp.check_cb(
  (public.shop_add_member(:'equal_id', :'invited_id', 'associate', null, 'Convidado')->>'status') = 'pending',
  'Sociedade em partes iguais: o convite vai para aprovação');
reset role;

select pg_temp.as_user(:'invited_id');
set local role authenticated;
select pg_temp.check_cb(
  (select jsonb_array_length(public.get_my_pending_shop_invites()) = 1
     and public.get_my_pending_shop_invites()->0->>'role' = 'associate'
     and public.get_my_pending_shop_invites()->0->>'shop_name' = 'Iguais CB'),
  'A pessoa convidada vê o próprio convite aguardando (loja e papel)');
reset role;

select pg_temp.as_user(:'employee_id');
set local role authenticated;
select pg_temp.check_cb(jsonb_array_length(public.get_my_pending_shop_invites()) = 0,
  'Outra conta não vê o convite');
select pg_temp.expect_cb_error('select * from public.shop_invite_links',
  'Conta logada não lê os links de convite', '42501');
reset role;

-- ---------------------------------------------------------------------------
-- P-02 e P-66. Bloqueios
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'employee_id');
set local role authenticated;
select pg_temp.check_cb(
  (public.get_my_shop_permissions(:'shop_id')->'permissions'->>'manage_own_blocks')::boolean
  and not (public.get_my_shop_permissions(:'shop_id')->'permissions'->>'manage_own_services')::boolean,
  'Contratado com a matriz padrão: bloqueio próprio ligado, serviços próprios desligado');
insert into public.availability_blocks(barbershop_id, staff_id, starts_at, ends_at, reason)
values (:'shop_id', :'employee_staff', now() + interval '3 days', now() + interval '3 days 1 hour', 'Almoço');
select pg_temp.check_cb(
  (select count(*) = 1 from public.availability_blocks where barbershop_id = :'shop_id' and staff_id = :'employee_staff'),
  'Contratado cria o próprio bloqueio');
select pg_temp.expect_cb_error(
  format('insert into public.availability_blocks(barbershop_id, staff_id, starts_at, ends_at) values (%L, %L, now() + interval ''3 days'', now() + interval ''3 days 1 hour'')', :'shop_id', :'colleague_staff'),
  'Contratado não cria bloqueio na agenda do colega', '42501');
delete from public.availability_blocks where barbershop_id = :'shop_id' and staff_id = :'employee_staff';
reset role;
select pg_temp.check_cb(
  (select count(*) = 0 from public.availability_blocks where barbershop_id = :'shop_id' and staff_id = :'employee_staff'),
  'Contratado apaga o próprio bloqueio');

select pg_temp.as_user(:'owner_id');
set local role authenticated;
insert into public.availability_blocks(barbershop_id, staff_id, starts_at, ends_at, reason)
values (:'shop_id', :'colleague_staff', now() + interval '4 days', now() + interval '4 days 1 hour', 'Folga');
reset role;
select pg_temp.check_cb(
  (select count(*) = 1 from public.availability_blocks where barbershop_id = :'shop_id' and staff_id = :'colleague_staff'),
  'Dono da equipe (sem shop_admin) bloqueia a agenda de um colega');

-- ---------------------------------------------------------------------------
-- P-13. Matriz do Contratado
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'owner_id');
set local role authenticated;
select public.save_shop_permissions(:'shop_id',
  '{"employee":{"manage_team":true,"manage_services":true,"view_money":true}}'::jsonb);
reset role;
select pg_temp.check_cb(
  not exists (select 1 from public.shop_role_permissions where barbershop_id = :'shop_id'
              and role = 'employee' and permission in ('manage_team', 'manage_services'))
  and exists (select 1 from public.shop_role_permissions where barbershop_id = :'shop_id'
              and role = 'employee' and permission = 'view_money' and allowed),
  'Permissões de gestão do Contratado ficam desligadas; as outras são gravadas');

-- ---------------------------------------------------------------------------
-- P-03. Foto do próprio perfil do Contratado
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'employee_id');
set local role authenticated;
insert into storage.objects(bucket_id, name)
values ('barbershop-services', :'shop_id' || '/staff/' || :'employee_staff' || '/foto.jpg');
select pg_temp.check_cb(
  exists (select 1 from storage.objects where bucket_id = 'barbershop-services'
          and name = :'shop_id' || '/staff/' || :'employee_staff' || '/foto.jpg'),
  'Contratado envia a foto na própria pasta');
select pg_temp.expect_cb_error(
  format('insert into storage.objects(bucket_id, name) values (''barbershop-services'', %L)', :'shop_id' || '/staff/' || :'colleague_staff' || '/foto.jpg'),
  'Contratado não envia foto na pasta do colega', '42501');
select pg_temp.expect_cb_error(
  format('insert into storage.objects(bucket_id, name) values (''barbershop-services'', %L)', :'shop_id' || '/servico.jpg'),
  'Contratado não envia foto de serviço', '42501');
reset role;

-- ---------------------------------------------------------------------------
-- P-09. Ficha do cliente pela agenda da equipe
-- ---------------------------------------------------------------------------

select pg_temp.as_user(:'employee_id');
set local role authenticated;
create temporary table cb_sched as
select public.get_team_schedule(:'shop_id', now(), now() + interval '5 days') j;
reset role;
select pg_temp.check_cb(
  (select bool_and(case when (e->>'id')::uuid = (select ap_employee from cb_ctx) then e->>'customer_id' = (select cust_id from cb_ctx)::text
                        when (e->>'id')::uuid = (select ap_colleague from cb_ctx) then e->'customer_id' = 'null'::jsonb
                        else true end)
   from cb_sched, jsonb_array_elements(j) e)
  and (select jsonb_array_length(j) = 2 from cb_sched),
  'Agenda da equipe: o Contratado recebe a ficha do próprio cliente e não a do colega');

select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.check_cb(
  (select bool_and(e->>'customer_id' = (select cust_id from cb_ctx)::text)
   from jsonb_array_elements(public.get_team_schedule(:'shop_id', now(), now() + interval '5 days')) e),
  'Agenda da equipe: o dono recebe a ficha de todos');
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- P-18: quem já tem conta abre a barbearia sem criar outra conta; entra como fundador.
set local role authenticated;
select pg_temp.as_user(:'cust_id');
select public.create_own_barbershop('Cliente vira dono CB') ->> 'shop_id' as own_shop \gset
reset role;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.check_cb(
  (select founded_by_user_id = :'cust_id'::uuid from public.barbershops where id = :'own_shop'),
  'Barbearia aberta com a conta: quem abriu fica como fundador');
select pg_temp.check_cb(
  (select role = 'owner' and ownership_percent = 100 and welcome_seen_at is not null
   from public.shop_members where barbershop_id = :'own_shop' and user_id = :'cust_id'),
  'Fundador entra como dono com 100%, sem janela de boas-vindas');
