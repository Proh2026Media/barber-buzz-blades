-- Apaga a "Loja Teste" (e a "Loja Teste B", se existir) e as contas @loja-teste.invalid.
-- Roteiro: docs/testes-reais-loja-teste.md. Pré-requisito: migration 20261003220000_ajustes_finais
-- aplicada (sem ela, apagar a loja inteira esbarra na trava de dono ativo e nada é apagado).
-- Só toca essas lojas e essas contas. Aborta sem apagar nada se achar vínculo com loja real.
-- Ensaio: trocar o "commit;" do fim por "rollback;".
\set ON_ERROR_STOP on
begin;

create temporary table lt_lojas on commit drop as
select b.id from public.barbershops b
where (b.slug, b.name) in (('loja-teste', 'Loja Teste'), ('loja-teste-b', 'Loja Teste B'));

create temporary table lt_users on commit drop as
select u.id from auth.users u where lower(u.email) like '%@loja-teste.invalid';

do $$
declare n_lojas int; n_users int; n_fora int; n_reais int; n_admin int; n_fotos int;
begin
  select count(*) into n_lojas from lt_lojas;
  select count(*) into n_users from lt_users;
  -- contas de teste com equipe, profissional, reserva ou aviso em loja real
  select count(*) into n_fora from (
    select 1 from public.shop_members sm where sm.user_id in (select id from lt_users) and sm.barbershop_id not in (select id from lt_lojas)
    union all select 1 from public.staff s where s.user_id in (select id from lt_users) and s.barbershop_id not in (select id from lt_lojas)
    union all select 1 from public.appointments a where a.customer_id in (select id from lt_users) and a.barbershop_id not in (select id from lt_lojas)
    union all select 1 from public.staff_client_notices n where n.sent_by in (select id from lt_users) and n.barbershop_id not in (select id from lt_lojas)
  ) x;
  -- pessoas de verdade que reservaram ou entraram na equipe da loja de teste
  select count(*) into n_reais from (
    select 1 from public.appointments a where a.barbershop_id in (select id from lt_lojas)
      and a.customer_id is not null and a.customer_id not in (select id from lt_users)
    union all select 1 from public.shop_members sm where sm.barbershop_id in (select id from lt_lojas)
      and sm.user_id not in (select id from lt_users)
    union all select 1 from public.memberships m where m.barbershop_id in (select id from lt_lojas)
      and m.user_id not in (select id from lt_users)
  ) y;
  select count(*) into n_admin from public.memberships m
  where m.user_id in (select id from lt_users) and m.role in ('platform_admin', 'account_manager');
  select count(*) into n_fotos from storage.objects o
  where split_part(o.name, '/', 1) in (select id::text from lt_lojas);
  raise notice 'lojas=% contas=% vinculos_em_loja_real=% pessoas_reais_na_loja_teste=% admins=% fotos_no_storage=%',
    n_lojas, n_users, n_fora, n_reais, n_admin, n_fotos;
  if n_lojas not between 1 and 2 or n_users not between 1 and 20 or n_fora <> 0 or n_reais <> 0 or n_admin <> 0 then
    raise exception 'ABORTADO: o banco não está no estado esperado; nada foi apagado';
  end if;
  if n_fotos > 0 then
    raise exception 'ABORTADO: apague antes as fotos enviadas nos testes (pelo app ou pela API do Storage); nada foi apagado';
  end if;
end $$;

-- filas que ainda não saíram (e-mail a endereço .invalid não pode ser enviado)
delete from public.email_outbox where barbershop_id in (select id from lt_lojas)
  or lower(to_email) like '%@loja-teste.invalid';
delete from public.whatsapp_outbox where barbershop_id in (select id from lt_lojas);
-- reservas das lojas de teste (histórico, fatos e cópias Google vão junto)
delete from public.appointments where barbershop_id in (select id from lt_lojas);
-- a loja inteira (equipe, profissionais, serviços, horários, ajustes e pedidos vão junto)
delete from public.barbershops where id in (select id from lt_lojas);
-- as contas (perfis, vínculos de cliente e contas de pontos vão junto)
delete from auth.users where id in (select id from lt_users);
-- sinais de atualização da agenda gerados pelas exclusões
delete from public.availability_signals where barbershop_id in (select id from lt_lojas);

do $$
begin
  if exists (select 1 from public.barbershops where id in (select id from lt_lojas))
     or exists (select 1 from auth.users where lower(email) like '%@loja-teste.invalid')
     or exists (select 1 from public.profiles p where p.id not in (select id from auth.users))
     or exists (select 1 from public.availability_signals where barbershop_id in (select id from lt_lojas)) then
    raise exception 'ABORTADO: sobrou resíduo; nada foi apagado';
  end if;
  raise notice 'LOJA TESTE APAGADA';
end $$;

commit;
