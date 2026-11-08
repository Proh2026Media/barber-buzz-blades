-- Reversão pontual da base de conexão MP (nº 100), sem pg_restore e sem apagar dados.
-- Executar somente após interromper o handler OAuth correspondente, em uma transação.
-- Revoga autorizações em trânsito; preserva vínculos/cifras privados para auditoria e retomada.
-- Não modifica agenda, P-70, pagamentos ou dados pessoais fora destas duas tabelas.
update public.mercado_pago_oauth_requests
set revoked_at=clock_timestamp(), verifier_ciphertext=null
where finished_at is null and revoked_at is null;
update public.mercado_pago_connections
set connection_revision=connection_revision+1,updated_at=clock_timestamp();

drop trigger if exists mercado_pago_staff_changed on public.staff;
drop trigger if exists mercado_pago_members_changed on public.shop_members;
drop trigger if exists mercado_pago_managers_changed on public.account_manager_shops;
drop trigger if exists mercado_pago_manager_role_changed on public.memberships;
drop function if exists public.begin_mercado_pago_connection(uuid,uuid,text,text,bigint,text,text,uuid,uuid);
drop function if exists public.consume_mercado_pago_connection(text,uuid);
drop function if exists public.finish_mercado_pago_connection(uuid,uuid,text,text,text,timestamptz,boolean);
drop function if exists public.disconnect_mercado_pago_connection(uuid,uuid,bigint,text,uuid);
drop function if exists public.get_mercado_pago_connection(uuid,text,uuid);
drop function if exists public.invalidate_mercado_pago_authorizations();
drop function if exists public.mercado_pago_connection_target(uuid,uuid,text,uuid);
drop function if exists public.mercado_pago_management_block(uuid,uuid);
-- mercado_pago_cipher_valid continua como CHECK privado das tabelas preservadas.
revoke all on public.mercado_pago_connections,public.mercado_pago_oauth_requests from public,anon,authenticated;
revoke all on function public.mercado_pago_cipher_valid(text) from public,anon,authenticated;
notify pgrst,'reload schema';
