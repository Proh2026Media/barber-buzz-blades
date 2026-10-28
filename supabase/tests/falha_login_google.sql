-- Rodar sempre dentro de BEGIN ... ROLLBACK, depois da migration 20261028190000.
create or replace function pg_temp.conferir(ok boolean, mensagem text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'FAIL: %',mensagem; end if; raise notice 'PASS: %',mensagem; end; $$;
select pg_temp.conferir(not oauth_relay_failure_put(null), 'id nulo recusado');
select pg_temp.conferir(not oauth_relay_failure_take(null), 'retirada nula vazia');
select pg_temp.conferir(not has_table_privilege('anon','oauth_failure_relay','SELECT'), 'sem leitura direta anônima');
select pg_temp.conferir(not has_table_privilege('authenticated','oauth_failure_relay','INSERT'), 'sem gravação direta autenticada');
select pg_temp.conferir(has_function_privilege('anon','oauth_relay_failure_put(uuid)','EXECUTE'), 'janela sem sessão pode entregar falha');
select pg_temp.conferir(has_function_privilege('anon','oauth_relay_failure_take(uuid)','EXECUTE'), 'app sem sessão pode retirar falha');
set local role anon;
select pg_temp.conferir(oauth_relay_failure_put('12345678-1234-4234-8234-123456789001'), 'entrega anônima aceita');
select pg_temp.conferir(oauth_relay_failure_put('12345678-1234-4234-8234-123456789001'), 'repetição idempotente');
select pg_temp.conferir(not oauth_relay_failure_take('12345678-1234-4234-8234-123456789002'), 'id diferente não retira');
select pg_temp.conferir(oauth_relay_failure_take('12345678-1234-4234-8234-123456789001'), 'app recebe a falha');
select pg_temp.conferir(not oauth_relay_failure_take('12345678-1234-4234-8234-123456789001'), 'retirada única');
reset role;
insert into oauth_failure_relay values('12345678-1234-4234-8234-123456789001',now()-interval '11 minutes');
select pg_temp.conferir(not oauth_relay_failure_take('12345678-1234-4234-8234-123456789001'), 'falha vencida não interrompe login');
insert into oauth_code_relay(id,code) values('12345678-1234-4234-8234-123456789001','codigo-valido-do-teste');
select pg_temp.conferir(not oauth_relay_failure_put('12345678-1234-4234-8234-123456789001'), 'sucesso entregue vence falha atrasada');
select pg_temp.conferir(oauth_relay_take('12345678-1234-4234-8234-123456789001') = 'codigo-valido-do-teste', 'código preservado e retirado normalmente');
insert into oauth_failure_relay(id) select gen_random_uuid() from generate_series(1,500);
select pg_temp.conferir(not oauth_relay_failure_put('12345678-1234-4234-8234-123456789003'), 'teto de marcadores impede enchimento');
select pg_temp.conferir((select count(*) from oauth_failure_relay)=500, 'fila limitada a 500');
update oauth_failure_relay set created_at=now()-interval '11 minutes';
select pg_temp.conferir(oauth_relay_failure_put('12345678-1234-4234-8234-123456789003'), 'limpeza permite nova tentativa');
select pg_temp.conferir((select count(*) from oauth_failure_relay)=1, 'limpeza remove vencidos');
