-- Limpeza da fixture "Loyalty test" (loyalty_program_module.sql rodado sem transação em 03/10/2026).
-- Só toca a loja de teste e os 5 usuários @example.invalid criados por ela. Aborta se achar algo diferente.
\set ON_ERROR_STOP on
begin;

create temporary table lixo_loja on commit drop as
select b.id from public.barbershops b
where b.name = 'Loyalty test' and b.slug = 'loy-' || b.id::text;

create temporary table lixo_users on commit drop as
select u.id from auth.users u
where u.email = u.id::text || '@example.invalid' and u.created_at is null;

do $$
declare n_loja int; n_users int; n_ligados int; n_fora int;
begin
  select count(*) into n_loja from lixo_loja;
  select count(*) into n_users from lixo_users;
  -- 4 dos 5 usuários têm vínculo direto com a loja de teste (dono, parceiro, 2 clientes)
  select count(distinct x.uid) into n_ligados from (
    select s.user_id uid from public.staff s where s.barbershop_id in (select id from lixo_loja)
    union all select m.user_id from public.memberships m where m.barbershop_id in (select id from lixo_loja)
  ) x where x.uid in (select id from lixo_users);
  -- nenhum deles pode ter reserva, membro de equipe ou staff em loja real
  select count(*) into n_fora from (
    select 1 from public.appointments a where a.customer_id in (select id from lixo_users) and a.barbershop_id not in (select id from lixo_loja)
    union all select 1 from public.shop_members sm where sm.user_id in (select id from lixo_users) and sm.barbershop_id not in (select id from lixo_loja)
    union all select 1 from public.staff s where s.user_id in (select id from lixo_users) and s.barbershop_id not in (select id from lixo_loja)
  ) y;
  raise notice 'loja=% usuarios=% ligados_a_loja=% vinculos_em_loja_real=%', n_loja, n_users, n_ligados, n_fora;
  if n_loja <> 1 or n_users <> 5 or n_ligados <> 4 or n_fora <> 0 then
    raise exception 'ABORTADO: o banco não está no estado esperado; nada foi apagado';
  end if;
end $$;

-- e-mail pendente gerado pela reserva de teste (não pode sair)
delete from public.email_outbox where barbershop_id in (select id from lixo_loja)
  or to_email in (select u.email from auth.users u where u.id in (select id from lixo_users));
delete from public.whatsapp_outbox where barbershop_id in (select id from lixo_loja);
-- reservas da loja de teste (histórico, fatos e cópias Google vão junto)
delete from public.appointments where barbershop_id in (select id from lixo_loja);
-- A trava "loja precisa de ao menos um dono ativo" (validate_shop_ownership, conferida no COMMIT)
-- não prevê a exclusão da loja inteira. Desligada só dentro desta transação, só para esta exclusão;
-- se algo falhar, o ROLLBACK a religa junto.
alter table public.shop_members disable trigger shop_ownership_total;
delete from public.barbershops where id in (select id from lixo_loja);
alter table public.shop_members enable trigger shop_ownership_total;
-- usuários de teste (perfis, vínculos na loja demo e contas de pontos vão junto)
delete from auth.users where id in (select id from lixo_users);

-- sinais de atualização da agenda gerados pela loja de teste (inclusive pelas exclusões acima)
delete from public.availability_signals where barbershop_id in (select id from lixo_loja);

-- conferência final
do $$
begin
  if exists (select 1 from public.barbershops where name = 'Loyalty test' and slug like 'loy-%')
     or exists (select 1 from auth.users u where u.email = u.id::text || '@example.invalid' and u.created_at is null)
     or exists (select 1 from public.profiles p where p.id not in (select id from auth.users))
     or exists (select 1 from public.availability_signals where barbershop_id in (select id from lixo_loja))
     or exists (select 1 from public.email_outbox where barbershop_id in (select id from lixo_loja)) then
    raise exception 'ABORTADO: sobrou resíduo; nada foi apagado';
  end if;
  raise notice 'LIMPEZA OK';
end $$;

commit;
