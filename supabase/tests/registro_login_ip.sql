-- Registro de acessos com IP (20261014120000_registro_login_ip.sql): P-29.
-- Rodar numa transação, sempre com ROLLBACK: BEGIN; \i este arquivo; ROLLBACK;
-- Dados fictícios com IDs aleatórios.
create temporary table li_ctx as
select gen_random_uuid() user_id, gen_random_uuid() session_id, gen_random_uuid() session_two;
select * from li_ctx \gset

create function pg_temp.check_li(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

insert into auth.users(id, email) select user_id, user_id || '@example.invalid' from li_ctx;

insert into auth.sessions(id, user_id, created_at, updated_at, ip)
select session_id, user_id, now(), now(), inet '203.0.113.7' from li_ctx;

select pg_temp.check_li(
  exists (select 1 from public.login_access_log l join li_ctx c on l.session_id = c.session_id
          where l.user_id = c.user_id and l.ip = inet '203.0.113.7'),
  'Login novo grava conta, sessão e IP');

insert into public.login_access_log(user_id, session_id, ip, created_at)
select user_id, gen_random_uuid(), inet '203.0.113.8', now() - interval '181 days' from li_ctx;

insert into auth.sessions(id, user_id, created_at, updated_at, ip)
select session_two, user_id, now(), now(), null from li_ctx;

select pg_temp.check_li(
  not exists (select 1 from public.login_access_log l join li_ctx c on l.user_id = c.user_id
              where l.created_at < now() - interval '180 days'),
  'Linhas com mais de 180 dias são apagadas');

select pg_temp.check_li(
  exists (select 1 from public.login_access_log l join li_ctx c on l.session_id = c.session_two
          where l.ip is null),
  'Sessão sem IP não impede o login');

select pg_temp.check_li(
  not has_table_privilege('anon', 'public.login_access_log', 'select')
  and not has_table_privilege('authenticated', 'public.login_access_log', 'select')
  and not has_function_privilege('authenticated', 'public.record_login_access()', 'execute'),
  'Registro fora da API para visitantes e contas');

delete from auth.users where id = :'user_id';

select pg_temp.check_li(
  exists (select 1 from public.login_access_log l join li_ctx c on l.session_id = c.session_id),
  'Registro continua depois que a conta é apagada');
