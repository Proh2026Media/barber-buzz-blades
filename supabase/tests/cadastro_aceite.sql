-- Cadastro: nome, WhatsApp e aceite dos documentos (20261003200000_cadastro_aceite.sql).
-- Rodar depois da migration, numa transação; sempre ROLLBACK.
-- Usuários e números fictícios, gerados aqui (não depende de dados reais).
create temporary table cad_ctx as
select gen_random_uuid() full_id, gen_random_uuid() bare_id, gen_random_uuid() google_id,
  gen_random_uuid() junk_id, gen_random_uuid() owner_id, gen_random_uuid() copy_id,
  gen_random_uuid() quiet_id, gen_random_uuid() sneaky_id, gen_random_uuid() twin_id,
  gen_random_uuid() pt_id,
  '55119' || lpad((floor(random() * 100000000))::bigint::text, 8, '0') as phone_a,
  '55119' || lpad((floor(random() * 100000000))::bigint::text, 8, '0') as phone_b,
  '55219' || lpad((floor(random() * 100000000))::bigint::text, 8, '0') as phone_c,
  '3519' || lpad((floor(random() * 100000000))::bigint::text, 8, '0') as phone_pt;
grant select on cad_ctx to authenticated;

create function pg_temp.check_cad(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_cad_error(statement text, label text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute statement; exception when others then failed := true; end;
  perform pg_temp.check_cad(failed, label);
end $$;

-- Os números sorteados não podem estar em uso (nem por acaso).
select pg_temp.check_cad(
  not exists (
    select 1 from public.profiles p join cad_ctx c
      on p.whatsapp_e164 in ('+' || c.phone_a, '+' || c.phone_b, '+' || c.phone_c, '+' || c.phone_pt)),
  'Números de teste livres');

-- Cadastro completo por e-mail.
insert into auth.users(id, email, raw_user_meta_data)
select full_id, full_id || '@example.invalid', jsonb_build_object(
  'full_name', '  João da Silva  ',
  'whatsapp', phone_a,
  'whatsapp_opt_in', true,
  'terms_version', '2026-10-03',
  'privacy_version', '2026-10-03',
  'terms_accepted_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'age_confirmed', true)
from cad_ctx;

select pg_temp.check_cad(
  (select p.full_name = 'João da Silva' from public.profiles p join cad_ctx c on p.id = c.full_id),
  'Nome do cadastro vira o nome do perfil');
select pg_temp.check_cad(
  (select p.terms_version = '2026-10-03' and p.privacy_version = '2026-10-03'
      and p.dpa_version is null
      and p.terms_accepted_at is not null and p.terms_accepted_at <= now()
      and p.age_confirmed_at is not null
   from public.profiles p join cad_ctx c on p.id = c.full_id),
  'Aceite dos documentos e da idade gravados no cadastro');
select pg_temp.check_cad(
  (select p.whatsapp_e164 = '+' || c.phone_a and p.whatsapp_verified_at is null
      and p.whatsapp_opt_in_at is not null
   from public.profiles p join cad_ctx c on p.id = c.full_id),
  'WhatsApp do cadastro gravado como NÃO verificado, com aceite de avisos');

-- Cadastro sem metadados (fluxos antigos).
insert into auth.users(id, email, raw_user_meta_data)
select bare_id, 'pessoa.teste.' || left(bare_id::text, 8) || '@example.invalid', '{}'::jsonb from cad_ctx;
select pg_temp.check_cad(
  (select p.full_name = 'pessoa.teste.' || left(c.bare_id::text, 8)
      and p.terms_version is null and p.terms_accepted_at is null
      and p.age_confirmed_at is null and p.whatsapp_e164 is null
   from public.profiles p join cad_ctx c on p.id = c.bare_id),
  'Sem metadados: nome pelo e-mail e nenhum aceite inventado');

-- Google: costuma mandar só "name".
insert into auth.users(id, email, raw_user_meta_data)
select google_id, google_id || '@example.invalid', jsonb_build_object('name', 'Maria Souza') from cad_ctx;
select pg_temp.check_cad(
  (select p.full_name = 'Maria Souza' from public.profiles p join cad_ctx c on p.id = c.google_id),
  'Nome do Google aproveitado');

-- Metadados estranhos não impedem a conta.
insert into auth.users(id, email, raw_user_meta_data)
select junk_id, junk_id || '@example.invalid', jsonb_build_object(
  'full_name', 'Teste Lixo',
  'whatsapp', 'abc',
  'whatsapp_opt_in', 'talvez',
  'terms_version', 'versão com espaço; drop table',
  'privacy_version', repeat('x', 200),
  'terms_accepted_at', 'ontem',
  'age_confirmed', 'sim')
from cad_ctx;
select pg_temp.check_cad(
  (select p.full_name = 'Teste Lixo' and p.terms_version is null and p.privacy_version is null
      and p.terms_accepted_at is null and p.age_confirmed_at is null and p.whatsapp_e164 is null
   from public.profiles p join cad_ctx c on p.id = c.junk_id),
  'Metadados inválidos são ignorados e a conta nasce');

-- Data de aceite fora do plausível vira a hora do servidor.
insert into auth.users(id, email, raw_user_meta_data)
select quiet_id, quiet_id || '@example.invalid', jsonb_build_object(
  'full_name', 'Sem Avisos',
  'whatsapp', phone_b,
  'whatsapp_opt_in', false,
  'terms_version', '2026-10-03',
  'privacy_version', '2026-10-03',
  'terms_accepted_at', '2001-01-01T00:00:00Z')
from cad_ctx;
select pg_temp.check_cad(
  (select p.terms_accepted_at = now() and p.age_confirmed_at is null
      and p.whatsapp_e164 = '+' || c.phone_b and p.whatsapp_opt_in_at is null
   from public.profiles p join cad_ctx c on p.id = c.quiet_id),
  'Data antiga é trocada pela do servidor; avisos desligados ficam desligados');

-- Número confirmado em outra conta não é copiado no cadastro.
insert into auth.users(id, email, raw_user_meta_data)
select owner_id, owner_id || '@example.invalid', '{}'::jsonb from cad_ctx;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.apply_verified_whatsapp(c.owner_id, '+' || c.phone_b, true) from cad_ctx c;
select set_config('request.jwt.claim.role', '', true);
select pg_temp.check_cad(
  (select p.whatsapp_verified_at is not null from public.profiles p join cad_ctx c on p.id = c.owner_id),
  'Preparação: número confirmado na conta do dono');
insert into auth.users(id, email, raw_user_meta_data)
select copy_id, copy_id || '@example.invalid',
  jsonb_build_object('full_name', 'Copiador', 'whatsapp', phone_b, 'whatsapp_opt_in', true)
from cad_ctx;
select pg_temp.check_cad(
  (select p.whatsapp_e164 is null and p.full_name = 'Copiador'
   from public.profiles p join cad_ctx c on p.id = c.copy_id),
  'WhatsApp confirmado por outra conta não é copiado no cadastro');

-- Número só gravado (não verificado) em outra conta não bloqueia o cadastro:
-- a unicidade vale só entre números confirmados.
insert into auth.users(id, email, raw_user_meta_data)
select twin_id, twin_id || '@example.invalid',
  jsonb_build_object('full_name', 'Gêmeo', 'whatsapp', phone_a, 'whatsapp_opt_in', true)
from cad_ctx;
select pg_temp.check_cad(
  (select p.whatsapp_e164 = '+' || c.phone_a and p.whatsapp_verified_at is null
   from public.profiles p join cad_ctx c on p.id = c.twin_id),
  'Número não verificado em outra conta não impede o cadastro');

-- Portugal: só dígitos com DDI (contrato do app) vira +351….
insert into auth.users(id, email, raw_user_meta_data)
select pt_id, pt_id || '@example.invalid',
  jsonb_build_object('full_name', 'Pessoa de Portugal', 'whatsapp', phone_pt, 'whatsapp_opt_in', false)
from cad_ctx;
select pg_temp.check_cad(
  (select p.whatsapp_e164 = '+' || c.phone_pt and p.whatsapp_verified_at is null
   from public.profiles p join cad_ctx c on p.id = c.pt_id),
  'WhatsApp de Portugal com DDI é aceito, sem verificação');

-- Metadados controlados pelo usuário não marcam verificação, papel nem loja.
insert into auth.users(id, email, raw_user_meta_data)
select sneaky_id, sneaky_id || '@example.invalid', jsonb_build_object(
  'full_name', E'   ',
  'name', E'Nome\nCom Quebra',
  'whatsapp', phone_c,
  'whatsapp_verified_at', '2026-01-01T00:00:00Z',
  'whatsapp_verified', true,
  'role', 'owner',
  'is_platform_admin', true,
  'barbershop_id', gen_random_uuid(),
  'dpa_version', 'dpa-falso')
from cad_ctx;
select pg_temp.check_cad(
  (select p.whatsapp_e164 = '+' || c.phone_c and p.whatsapp_verified_at is null
      and p.full_name = 'Nome Com Quebra'
      and p.terms_version is null and p.terms_accepted_at is null and p.dpa_version is null
   from public.profiles p join cad_ctx c on p.id = c.sneaky_id),
  'Metadados não marcam WhatsApp verificado; nome vazio cai para name sem quebra de linha');
select pg_temp.check_cad(
  (select not exists (select 1 from public.memberships m where m.user_id = c.sneaky_id)
      and not exists (select 1 from public.shop_members s where s.user_id = c.sneaky_id)
   from cad_ctx c),
  'Metadados não criam vínculo, papel nem loja');
select pg_temp.check_cad(
  (select not exists (select 1 from public.memberships m where m.user_id = c.full_id)
   from cad_ctx c),
  'Sem loja nos metadados = sem vínculo');

-- Colunas do aceite sem UPDATE direto para anon/authenticated.
select pg_temp.check_cad(
  not exists (
    select 1
    from unnest(array['terms_version', 'privacy_version', 'dpa_version',
                      'terms_accepted_at', 'age_confirmed_at',
                      'whatsapp_e164', 'whatsapp_verified_at', 'whatsapp_opt_in_at']) col
    cross join unnest(array['anon', 'authenticated']) r
    where has_column_privilege(r, 'public.profiles', col, 'UPDATE')),
  'Aceite e WhatsApp sem UPDATE direto por column grant');

-- Proteção: o usuário não grava o aceite por UPDATE direto, mas muda o próprio nome.
select set_config('request.jwt.claim.sub', bare_id::text, true) from cad_ctx;
set local role authenticated;
select pg_temp.expect_cad_error(
  $q$update public.profiles p set terms_version = 'falso' from cad_ctx c where p.id = c.bare_id$q$,
  'Aceite não muda por UPDATE direto no perfil');
select pg_temp.expect_cad_error(
  $q$update public.profiles p set age_confirmed_at = now() from cad_ctx c where p.id = c.bare_id$q$,
  'Confirmação de idade não muda por UPDATE direto no perfil');
update public.profiles p set full_name = 'Pessoa Renomeada' from cad_ctx c where p.id = c.bare_id;
reset role;
select pg_temp.check_cad(
  (select p.full_name = 'Pessoa Renomeada' from public.profiles p join cad_ctx c on p.id = c.bare_id),
  'Usuário continua mudando o próprio nome');

-- record_my_terms_acceptance.
select pg_temp.check_cad(
  not has_function_privilege('anon', 'public.record_my_terms_acceptance(text, text, text, boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.record_my_terms_acceptance(text, text, text, boolean)', 'execute'),
  'Aceite pela função só com login');

select set_config('request.jwt.claim.sub', bare_id::text, true) from cad_ctx;
set local role authenticated;
select public.record_my_terms_acceptance('2026-10-03', '2026-10-03', 'dpa-1', true);
select pg_temp.expect_cad_error(
  $q$select public.record_my_terms_acceptance('', '2026-10-03')$q$,
  'Versão vazia é recusada');
select pg_temp.expect_cad_error(
  $q$select public.record_my_terms_acceptance('2026-10-03', '2026-10-03', 'acordo inválido')$q$,
  'Versão inválida do acordo de dados é recusada');
reset role;
select pg_temp.check_cad(
  (select p.terms_version = '2026-10-03' and p.privacy_version = '2026-10-03'
      and p.dpa_version = 'dpa-1' and p.terms_accepted_at = now() and p.age_confirmed_at = now()
   from public.profiles p join cad_ctx c on p.id = c.bare_id),
  'Função grava versões, data e idade');

-- Aceite antigo da mesma versão não é "rejuvenescido"; versão nova grava data nova.
update public.profiles p
   set terms_accepted_at = now() - interval '2 days',
       age_confirmed_at = now() - interval '2 days'
  from cad_ctx c where p.id = c.bare_id;
select set_config('request.jwt.claim.sub', bare_id::text, true) from cad_ctx;
set local role authenticated;
select public.record_my_terms_acceptance('2026-10-03', '2026-10-03');
reset role;
select pg_temp.check_cad(
  (select p.terms_accepted_at = now() - interval '2 days' and p.dpa_version = 'dpa-1'
      and p.age_confirmed_at = now() - interval '2 days'
   from public.profiles p join cad_ctx c on p.id = c.bare_id),
  'Mesma versão mantém a data do aceite e o acordo de dados');

select set_config('request.jwt.claim.sub', bare_id::text, true) from cad_ctx;
set local role authenticated;
select public.record_my_terms_acceptance('2027-01-01', '2026-10-03', null, false);
reset role;
select pg_temp.check_cad(
  (select p.terms_version = '2027-01-01' and p.terms_accepted_at = now()
      and p.dpa_version = 'dpa-1' and p.age_confirmed_at = now() - interval '2 days'
   from public.profiles p join cad_ctx c on p.id = c.bare_id),
  'Versão nova grava a data de agora e não apaga a idade confirmada');

-- Sem login a função recusa (papel authenticated, mas sem conta no token).
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select pg_temp.expect_cad_error(
  $q$select public.record_my_terms_acceptance('2026-10-03', '2026-10-03')$q$,
  'Sem login a função recusa');
reset role;

-- A função só mexe no perfil de quem chamou.
select pg_temp.check_cad(
  (select p.terms_version is null and p.terms_accepted_at is null
   from public.profiles p join cad_ctx c on p.id = c.owner_id),
  'Aceite pela função não vaza para outra conta');
