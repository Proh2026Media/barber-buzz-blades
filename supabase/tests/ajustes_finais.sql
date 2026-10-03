-- Ajustes finais de 03/10/2026 (20261003220000_ajustes_finais.sql).
-- Rodar depois da migration, numa transação; sempre ROLLBACK.
-- Usuários, loja e números fictícios, gerados aqui (não depende de dados reais).
create temporary table fin_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() keep_shop_id,
  gen_random_uuid() owner_id, gen_random_uuid() keeper_id,
  gen_random_uuid() owner_staff, gen_random_uuid() keeper_staff,
  gen_random_uuid() holder_id, gen_random_uuid() prober_id,
  'teste-otp-' || gen_random_uuid() as otp_dest,
  '+55119' || lpad((floor(random() * 100000000))::bigint::text, 8, '0') as phone_taken,
  '+55219' || lpad((floor(random() * 100000000))::bigint::text, 8, '0') as phone_free;
grant select on fin_ctx to authenticated;

create function pg_temp.check_fin(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_fin_error(statement text, label text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute statement; exception when others then failed := true; end;
  perform pg_temp.check_fin(failed, label);
end $$;
create function pg_temp.expect_fin_ok(statement text, label text) returns void language plpgsql as $$
declare ok boolean := true; msg text;
begin
  begin execute statement; exception when others then ok := false; msg := sqlerrm; end;
  if not ok then raise notice 'erro: %', msg; end if;
  perform pg_temp.check_fin(ok, label);
end $$;

-- Os números sorteados não podem estar em uso (nem por acaso).
select pg_temp.check_fin(
  not exists (
    select 1 from public.profiles p join fin_ctx c
      on p.whatsapp_e164 in (c.phone_taken, c.phone_free)),
  'Números de teste livres');

-- ---------------------------------------------------------------------------
-- 1. Apagar uma barbearia inteira não esbarra na regra de dono ativo
-- ---------------------------------------------------------------------------

insert into public.barbershops(id, name, slug)
select shop_id, 'Ajustes apagar', 'ajustes-del-' || shop_id from fin_ctx union all
select keep_shop_id, 'Ajustes manter', 'ajustes-keep-' || keep_shop_id from fin_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{}'::jsonb
from fin_ctx c
cross join lateral unnest(array[c.owner_id, c.keeper_id, c.holder_id, c.prober_id]) u;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono', owner_id, 'dono' from fin_ctx union all
select keeper_staff, keep_shop_id, 'Dono', keeper_id, 'dono' from fin_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from fin_ctx union all
select keep_shop_id, keeper_id, keeper_staff, 'owner'::public.shop_member_role, 100 from fin_ctx;

-- Confere agora os gatilhos adiados (o que o COMMIT faria).
select pg_temp.expect_fin_ok('set constraints all immediate', 'Lojas de teste válidas (um dono com 100%)');
set constraints all deferred;

delete from public.barbershops b using fin_ctx c where b.id = c.shop_id;
select pg_temp.expect_fin_ok('set constraints all immediate',
  'Apagar a barbearia inteira não recusa por falta de dono ativo');
set constraints all deferred;
select pg_temp.check_fin(
  not exists (select 1 from public.shop_members m join fin_ctx c on m.barbershop_id = c.shop_id),
  'Sócios da barbearia apagada removidos em cascata');

-- Controle: loja que continua existindo ainda exige dono ativo.
set constraints all immediate;
select pg_temp.expect_fin_error(
  'update public.shop_members m set active = false from fin_ctx c
     where m.barbershop_id = c.keep_shop_id and m.user_id = c.keeper_id',
  'Loja existente sem dono ativo continua recusada');
select pg_temp.expect_fin_error(
  'update public.shop_members m set ownership_percent = 60 from fin_ctx c
     where m.barbershop_id = c.keep_shop_id and m.user_id = c.keeper_id',
  'Loja existente com participações fora de 100% continua recusada');
set constraints all deferred;

-- ---------------------------------------------------------------------------
-- 2. save_my_whatsapp não revela número confirmado em outra conta
-- ---------------------------------------------------------------------------

-- O dono real confirma o número (como faria o auth-otp).
select set_config('request.jwt.claim.role', 'service_role', true);
select public.apply_verified_whatsapp(c.holder_id, c.phone_taken, true) from fin_ctx c;
select set_config('request.jwt.claim.role', '', true);

select set_config('request.jwt.claim.sub', prober_id::text, true) from fin_ctx;
set local role authenticated;
select pg_temp.expect_fin_ok(
  'select public.save_my_whatsapp((select phone_taken from fin_ctx), true)',
  'Gravar número confirmado em outra conta não dá erro (não revela a conta)');
reset role;

select pg_temp.check_fin(
  (select p.whatsapp_e164 = c.phone_taken and p.whatsapp_verified_at is null
   from public.profiles p join fin_ctx c on p.id = c.prober_id),
  'Número gravado como NÃO verificado');
select pg_temp.check_fin(
  (select p.whatsapp_e164 = c.phone_taken and p.whatsapp_verified_at is not null
   from public.profiles p join fin_ctx c on p.id = c.holder_id),
  'Conta do dono real continua com o número confirmado');

-- Mesma resposta para número livre e número de outra conta.
select set_config('request.jwt.claim.sub', prober_id::text, true) from fin_ctx;
set local role authenticated;
select pg_temp.expect_fin_ok(
  'select public.save_my_whatsapp((select phone_free from fin_ctx), true)',
  'Gravar número livre também não dá erro');
select pg_temp.expect_fin_ok(
  'select public.save_my_whatsapp((select phone_taken from fin_ctx), false)',
  'Gravar de novo o número da outra conta não dá erro');
-- Validação de formato continua.
select pg_temp.expect_fin_error(
  'select public.save_my_whatsapp(''123'', true)',
  'Número inválido com avisos ligados continua recusado');
reset role;

-- A recusa continua na confirmação por código.
select set_config('request.jwt.claim.role', 'service_role', true);
select pg_temp.expect_fin_error(
  'select public.apply_verified_whatsapp((select prober_id from fin_ctx), (select phone_taken from fin_ctx), true)',
  'Confirmar por código número de outra conta continua recusado');
select set_config('request.jwt.claim.role', '', true);
select pg_temp.check_fin(
  (select count(*) = 1 from public.profiles p join fin_ctx c on p.whatsapp_e164 = c.phone_taken
   where p.whatsapp_verified_at is not null),
  'Número continua confirmado em uma só conta');

-- ---------------------------------------------------------------------------
-- 3. Limpeza de desafios de código antigos
-- ---------------------------------------------------------------------------

insert into public.auth_otp_challenges(
  user_id, barbershop_id, channel, destination, code_hash, purpose,
  expires_at, consumed_at, created_at)
select null, null, 'whatsapp', c.otp_dest || ':' || v.tag, 'hash-teste', 'login',
  v.expires_at, v.consumed_at, v.created_at
from fin_ctx c
cross join (values
  ('velho-consumido', now() - interval '8 days', now() - interval '8 days', now() - interval '8 days' + interval '10 minutes'),
  ('velho-vencido', now() - interval '8 days', null::timestamptz, now() - interval '8 days' + interval '10 minutes'),
  ('velho-aberto', now() - interval '8 days', null::timestamptz, now() + interval '10 minutes'),
  ('recente-consumido', now() - interval '1 day', now() - interval '1 day', now() - interval '1 day' + interval '10 minutes'),
  ('recente-aberto', now(), null::timestamptz, now() + interval '10 minutes')
) as v(tag, created_at, consumed_at, expires_at);

select pg_temp.check_fin(public.purge_auth_otp_challenges() >= 2, 'Limpeza informa quantos apagou');
select pg_temp.check_fin(
  not exists (select 1 from public.auth_otp_challenges a join fin_ctx c
    on a.destination in (c.otp_dest || ':velho-consumido', c.otp_dest || ':velho-vencido')),
  'Desafios vencidos ou consumidos há mais de 7 dias apagados');
select pg_temp.check_fin(
  (select count(*) = 3 from public.auth_otp_challenges a join fin_ctx c
    on a.destination in (c.otp_dest || ':velho-aberto', c.otp_dest || ':recente-consumido',
                         c.otp_dest || ':recente-aberto')),
  'Desafios recentes ou ainda válidos preservados');
select pg_temp.check_fin(public.purge_auth_otp_challenges() >= 0, 'Segunda limpeza sem erro');

select pg_temp.check_fin(
  not has_function_privilege('anon', 'public.purge_auth_otp_challenges()', 'execute')
  and not has_function_privilege('authenticated', 'public.purge_auth_otp_challenges()', 'execute')
  and has_function_privilege('service_role', 'public.purge_auth_otp_challenges()', 'execute'),
  'Limpeza só para o servidor (service_role)');
select pg_temp.check_fin(
  has_function_privilege('authenticated', 'public.save_my_whatsapp(text, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.save_my_whatsapp(text, boolean)', 'execute'),
  'save_my_whatsapp mantém os privilégios');

-- ---------------------------------------------------------------------------
-- 5. Aviso por WhatsApp não vai para número confirmado em outra conta
-- ---------------------------------------------------------------------------

select pg_temp.check_fin(
  exists (select 1 from public.profiles p join fin_ctx c on p.id = c.holder_id
    where p.whatsapp_e164 = c.phone_taken and p.whatsapp_verified_at is not null),
  'Dono real do número continua confirmado (pré-condição do envio)');

insert into public.whatsapp_channels(barbershop_id, instance_name, status, enabled)
select keep_shop_id, 'teste-fin-' || substr(replace(keep_shop_id::text, '-', ''), 1, 20), 'open', true
from fin_ctx;

select pg_temp.check_fin(
  (select public.enqueue_whatsapp_message(c.keep_shop_id, c.phone_taken, 'customer.notice', 'Teste',
     'teste-fin-outro:' || c.prober_id, jsonb_build_object('customer_id', c.prober_id)) from fin_ctx c) is null,
  'Aviso de outra conta não vai para número confirmado por outra pessoa');
select pg_temp.check_fin(
  (select public.enqueue_whatsapp_message(c.keep_shop_id, c.phone_taken, 'customer.notice', 'Teste',
     'teste-fin-dono:' || c.holder_id, jsonb_build_object('customer_id', c.holder_id)) from fin_ctx c) is not null,
  'Aviso do próprio dono do número continua saindo');
select pg_temp.check_fin(
  (select public.enqueue_whatsapp_message(c.keep_shop_id, c.phone_free, 'customer.notice', 'Teste',
     'teste-fin-livre:' || c.prober_id, jsonb_build_object('customer_id', c.prober_id)) from fin_ctx c) is not null,
  'Número sem dono confirmado continua recebendo como antes');
select pg_temp.check_fin(
  not has_function_privilege('authenticated',
    'public.enqueue_whatsapp_message(uuid, text, text, text, text, jsonb, timestamptz)', 'execute'),
  'Fila do WhatsApp segue só para o servidor');
