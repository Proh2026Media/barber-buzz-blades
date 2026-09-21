-- Regressão da matriz de permissões por papel.
-- Rodar depois de 20260917150000_shop_role_permissions.sql, na mesma transação, sempre com ROLLBACK.
create temporary table perm_test_context as
select gen_random_uuid() single_shop, gen_random_uuid() equal_shop,
  gen_random_uuid() owner_id, gen_random_uuid() partner_a, gen_random_uuid() partner_b,
  gen_random_uuid() associate_id, gen_random_uuid() employee_id,
  gen_random_uuid() owner_staff, gen_random_uuid() staff_a, gen_random_uuid() staff_b,
  gen_random_uuid() associate_staff, gen_random_uuid() employee_staff;
grant select on perm_test_context to authenticated;

create function pg_temp.check_perm(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'PASS: %',label;
end $$;

create function pg_temp.expect_perm_error(statement text,expected text,label text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; exception when others then get stacked diagnostics actual=returned_sqlstate; end;
  perform pg_temp.check_perm(actual=expected,label);
end $$;

insert into public.barbershops(id,name,slug)
select single_shop,'Permissões single','perm-single-'||single_shop from perm_test_context union all
select equal_shop,'Permissões equal','perm-equal-'||equal_shop from perm_test_context;

insert into auth.users(id,email,raw_user_meta_data)
select user_id,user_id||'@example.invalid','{}'::jsonb from perm_test_context c
cross join lateral unnest(array[c.owner_id,c.partner_a,c.partner_b,c.associate_id,c.employee_id]) u(user_id);

insert into public.staff(id,barbershop_id,display_name,user_id,booking_slug)
select owner_staff,single_shop,'Owner',owner_id,'owner' from perm_test_context union all
select associate_staff,single_shop,'Associate',associate_id,'associate' from perm_test_context union all
select employee_staff,single_shop,'Employee',employee_id,'employee' from perm_test_context union all
select staff_a,equal_shop,'Partner A',partner_a,'partner-a' from perm_test_context union all
select staff_b,equal_shop,'Partner B',partner_b,'partner-b' from perm_test_context;

-- Loja A: um dono único (governança 'single', aplica mudanças sozinho).
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select single_shop,owner_id,owner_staff,'owner'::public.shop_member_role,100 from perm_test_context union all
select single_shop,associate_id,associate_staff,'associate'::public.shop_member_role,null from perm_test_context union all
select single_shop,employee_id,employee_staff,'employee'::public.shop_member_role,null from perm_test_context;

-- Loja B: dois sócios 50/50 (governança 'equal', ninguém aplica sozinho).
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select equal_shop,partner_a,staff_a,'partner'::public.shop_member_role,50 from perm_test_context union all
select equal_shop,partner_b,staff_b,'partner'::public.shop_member_role,50 from perm_test_context;

select single_shop as shop, equal_shop as eq_shop, owner_id as owner_user,
  partner_a as partner_a_user, associate_id as associate_user, employee_id as employee_user
from perm_test_context \gset

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Os padrões precisam reproduzir exatamente o comportamento anterior.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', :'owner_user', true);
select pg_temp.check_perm(can_view_full_shop(:'shop'),'Dono vê a agenda completa por padrão');
select pg_temp.check_perm(shop_can_view_financials(:'shop'),'Dono vê o caixa por padrão');
select pg_temp.check_perm(shop_can_manage_team(:'shop'),'Dono gerencia a equipe por padrão');
select pg_temp.check_perm(shop_can_manage_services(:'shop'),'Dono gerencia o catálogo por padrão');
select pg_temp.check_perm(not shop_permission_granted(:'shop','view_reports_anonymized'),'Dono não depende do recorte anonimizado');

select set_config('request.jwt.claim.sub', :'associate_user', true);
select pg_temp.check_perm(not can_view_full_shop(:'shop'),'Parceiro NÃO vê a agenda completa por padrão');
select pg_temp.check_perm(not shop_can_view_financials(:'shop'),'Parceiro NÃO vê os relatórios financeiros da loja por padrão');
select pg_temp.check_perm(shop_permission_granted(:'shop','view_money'),'Parceiro vê valores do dia e próprios recebimentos por padrão');
select pg_temp.check_perm(shop_can_manage_own_services(:'shop'),'Parceiro gerencia os próprios serviços por padrão');
select pg_temp.check_perm(shop_permission_granted(:'shop','view_reports_anonymized'),'Parceiro recebe indicadores anonimizados por padrão');

select set_config('request.jwt.claim.sub', :'employee_user', true);
select pg_temp.check_perm(not can_view_full_shop(:'shop'),'Contratado NÃO vê a agenda completa por padrão');
select pg_temp.check_perm(not shop_can_manage_own_services(:'shop'),'Contratado NÃO edita catálogo por padrão');
select pg_temp.check_perm(not shop_permission_granted(:'shop','view_money'),'Contratado NÃO vê valores por padrão');
select pg_temp.check_perm(shop_permission_granted(:'shop','view_own_score'),'Contratado vê o próprio score por padrão');

-- Sem linha na tabela, nada foi sobrescrito.
select pg_temp.check_perm(
  (select count(*)=0 from public.shop_role_permissions),
  'Padrões não gravam linhas na tabela');

-- ---------------------------------------------------------------------------
-- Autorização para gravar
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', :'associate_user', true);
select pg_temp.expect_perm_error(
  format('select save_shop_permissions(%L,%L::jsonb)', :'shop', '{"associate":{"view_agenda_all":true}}'),
  '42501','Parceiro não pode regravar a matriz');

select set_config('request.jwt.claim.sub', :'employee_user', true);
select pg_temp.expect_perm_error(
  format('select get_shop_permissions(%L)', :'shop'),
  '42501','Contratado não pode ler a matriz');

-- Sociedade igualitária: nenhum sócio aplica sozinho.
select set_config('request.jwt.claim.sub', :'partner_a_user', true);
select pg_temp.expect_perm_error(
  format('select save_shop_permissions(%L,%L::jsonb)', :'eq_shop', '{"partner":{"manage_team":false}}'),
  '42501','Sócio igualitário não aplica sozinho');

-- ---------------------------------------------------------------------------
-- Sobrescrita muda o acesso de verdade
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', :'owner_user', true);
select pg_temp.check_perm(
  (save_shop_permissions(:'shop','{"owner":{"manage_permissions":true},"associate":{"view_agenda_all":true}}'::jsonb)
    ->'matrix'->'associate'->>'view_agenda_all')::boolean,
  'Gravação devolve a matriz atualizada');

select pg_temp.check_perm(
  (select count(*)=1 from public.shop_role_permissions where permission='view_agenda_all'),
  'Só a diferença em relação ao padrão é armazenada');

select set_config('request.jwt.claim.sub', :'associate_user', true);
select pg_temp.check_perm(can_view_full_shop(:'shop'),'Sobrescrita concede agenda completa ao parceiro');

-- Revogar uma permissão que o padrão concede também funciona.
select set_config('request.jwt.claim.sub', :'owner_user', true);
select save_shop_permissions(:'shop','{"owner":{"manage_permissions":true},"associate":{"view_agenda_all":false}}'::jsonb);
select set_config('request.jwt.claim.sub', :'associate_user', true);
select pg_temp.check_perm(not can_view_full_shop(:'shop'),'Revogação vale mesmo quando o padrão concedia');

-- ---------------------------------------------------------------------------
-- Proteções da gravação
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', :'owner_user', true);
select pg_temp.expect_perm_error(
  format('select save_shop_permissions(%L,%L::jsonb)', :'shop', '{"owner":{"manage_permissions":false}}'),
  '22023','Dono não pode revogar a própria gestão de permissões');

select pg_temp.expect_perm_error(
  format('select save_shop_permissions(%L,%L::jsonb)', :'shop', '{"owner":{"permissoes_inexistentes":true}}'),
  '22023','Permissão desconhecida é recusada');

select pg_temp.expect_perm_error(
  format('select save_shop_permissions(%L,%L::jsonb)', :'shop', '{"gerente":{"manage_team":true}}'),
  '22023','Papel desconhecido é recusado');

select pg_temp.expect_perm_error(
  format('select save_shop_permissions(%L,%L::jsonb)', :'shop', '{"partner":{"manage_team":"sim"}}'),
  '22023','Valor não booleano é recusado');

-- Um envio inválido não pode ter deixado efeito parcial.
select pg_temp.check_perm(
  (select count(*)=0 from public.shop_role_permissions where permission='permissoes_inexistentes'),
  'Envio inválido não grava nada');

-- Gravação parcial não apaga os outros papéis.
select save_shop_permissions(:'shop','{"associate":{"view_agenda_all":true}}'::jsonb);
select pg_temp.check_perm(
  (select count(*)=1 from public.shop_role_permissions where role='associate' and permission='view_agenda_all'),
  'Gravação parcial reaplica a permissão do parceiro');

-- ---------------------------------------------------------------------------
-- Leitura da matriz
-- ---------------------------------------------------------------------------

select pg_temp.check_perm(
  jsonb_array_length(get_shop_permissions(:'shop')->'catalog')=11,
  'Catálogo devolve as onze permissões');
select pg_temp.check_perm(
  get_shop_permissions(:'shop')->'roles' = '["owner","partner","associate","employee"]'::jsonb,
  'Matriz devolve os quatro papéis');
select pg_temp.check_perm(
  (get_shop_permissions(:'shop')->'matrix'->'employee'->>'manage_team')::boolean is false,
  'Matriz devolve o valor efetivo por papel');

select set_config('request.jwt.claim.sub', :'associate_user', true);
select pg_temp.expect_perm_error(
  format('select save_shop_permissions(%L,%L::jsonb)', :'shop', '{"associate":{"manage_operations":true}}'),
  '42501','Parceiro continua sem poder regravar a matriz');

-- ---------------------------------------------------------------------------
-- Leitura das próprias permissões (é o que a interface usa)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', :'associate_user', true);
select pg_temp.check_perm(
  (get_my_shop_permissions(:'shop')->>'role') = 'associate',
  'Leitura própria devolve o papel do usuário');
select pg_temp.check_perm(
  (get_my_shop_permissions(:'shop')->'permissions'->>'view_agenda_all')::boolean is true,
  'Leitura própria reflete a permissão concedida ao parceiro');
select pg_temp.check_perm(
  (get_my_shop_permissions(:'shop')->'permissions'->>'manage_team')::boolean is false,
  'Leitura própria mantém negado o que não foi concedido');
select pg_temp.check_perm(
  (get_my_shop_permissions(:'shop')->'permissions'->>'view_financial_all')::boolean is false,
  'Leitura própria não expõe relatórios financeiros ao parceiro');

select set_config('request.jwt.claim.sub', :'employee_user', true);
select pg_temp.check_perm(
  (get_my_shop_permissions(:'shop')->'permissions'->>'view_money')::boolean is false,
  'Contratado lê a própria permissão de valores');
select pg_temp.check_perm(
  (get_my_shop_permissions(:'shop')->'permissions'->>'view_own_score')::boolean is true,
  'Contratado lê a própria permissão de score');

-- Quem não é membro não lê nada da barbearia.
select set_config('request.jwt.claim.sub', :'partner_a_user', true);
select pg_temp.expect_perm_error(
  format('select get_my_shop_permissions(%L)', :'shop'),
  '42501','Quem não é membro não lê permissões da loja');

-- Devolve o papel da sessão para não afetar outras regressões que rodem em seguida
-- na mesma transação (elas criam fixtures antes de assumir `authenticated`).
reset role;
