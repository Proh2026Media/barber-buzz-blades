-- P-78: desfaz somente o aviso antecipado de falha do login Google.
-- Não altera códigos PKCE, sessões, contas nem a ponte de login existente.
begin;
drop function if exists public.oauth_relay_failure_put(uuid);
drop function if exists public.oauth_relay_failure_take(uuid);
drop table if exists public.oauth_failure_relay;
notify pgrst, 'reload schema';
commit;
