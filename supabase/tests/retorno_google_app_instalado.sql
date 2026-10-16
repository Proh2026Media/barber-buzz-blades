-- Login com Google no app instalado (20261016120000_retorno_google_app_instalado.sql).
-- Rodar numa transação, sempre com ROLLBACK: BEGIN; \i este arquivo; ROLLBACK;
-- Dados fictícios com IDs aleatórios.
create temporary table gr_ctx as
select gen_random_uuid() relay_id, gen_random_uuid() other_id,
       'b9f4a7f2-6c2e-4a53-9d0a-5c7f1a2b3c4d'::text code;
select * from gr_ctx \gset

create function pg_temp.check_gr(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

-- Códigos emitidos pelo Auth (fictícios; somem no ROLLBACK): um recente e um velho.
insert into auth.flow_state (id, auth_code, provider_type, authentication_method, created_at,
  auth_code_issued_at)
values
  (gen_random_uuid(), :'code', 'google', 'oauth', now(), now()),
  (gen_random_uuid(), 'b9f4a7f2-6c2e-4a53-9d0a-000000000002', 'google', 'oauth', now(), now()),
  (gen_random_uuid(), 'c0d16e5e-velho-0000-0000-000000000000', 'google', 'oauth',
   now() - interval '30 minutes', now() - interval '30 minutes');

-- A janela do Google não tem sessão: chama como visitante.
set local role anon;
select pg_temp.check_gr(
  public.oauth_relay_put(:'relay_id', :'code') = true,
  'Visitante entrega o código ao id combinado');
select pg_temp.check_gr(
  public.oauth_relay_put(:'relay_id', 'b9f4a7f2-6c2e-4a53-9d0a-000000000002') = false,
  'O mesmo id não é sobrescrito (nem por outro código válido)');
select pg_temp.check_gr(
  public.oauth_relay_put(:'other_id', 'curto') = false
  and public.oauth_relay_put(:'other_id', 'tem espaço e é inválido') = false,
  'Código com formato estranho é recusado');
select pg_temp.check_gr(
  public.oauth_relay_put(:'other_id', 'inventado-por-um-visitante-123') = false,
  'Código que o Auth não emitiu é recusado (ninguém lota a tabela)');
select pg_temp.check_gr(
  public.oauth_relay_put(:'other_id', 'c0d16e5e-velho-0000-0000-000000000000') = false,
  'Código emitido há mais de 10 minutos é recusado');
select pg_temp.check_gr(
  public.oauth_relay_take(:'other_id') is null,
  'Id sem código devolve vazio');
select pg_temp.check_gr(
  public.oauth_relay_put(:'other_id', :'code') = false
  and public.oauth_relay_put(gen_random_uuid(), :'code') = false,
  'O mesmo código não entra em outro id');
select pg_temp.check_gr(
  public.oauth_relay_take(:'relay_id') = :'code',
  'O app retira o código uma vez');
select pg_temp.check_gr(
  public.oauth_relay_take(:'relay_id') is null,
  'Na segunda vez o código já não existe');
reset role;

-- Código vencido (mais de 10 minutos) não é entregue.
insert into public.oauth_code_relay (id, code, created_at)
select other_id, code, now() - interval '11 minutes' from gr_ctx;
set local role anon;
select pg_temp.check_gr(
  public.oauth_relay_take(:'other_id') is null,
  'Código com mais de 10 minutos não é entregue');
reset role;

select pg_temp.check_gr(
  not has_table_privilege('anon', 'public.oauth_code_relay', 'select')
  and not has_table_privilege('authenticated', 'public.oauth_code_relay', 'select')
  and not has_table_privilege('anon', 'public.oauth_code_relay', 'insert'),
  'A tabela não é lida nem gravada direto pela API');
select pg_temp.check_gr(
  has_function_privilege('anon', 'public.oauth_relay_put(uuid, text)', 'execute')
  and has_function_privilege('anon', 'public.oauth_relay_take(uuid)', 'execute'),
  'As duas funções são liberadas para quem ainda não entrou');
