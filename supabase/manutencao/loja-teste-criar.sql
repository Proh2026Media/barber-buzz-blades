-- Cria a "Loja Teste" (slug loja-teste) para os testes reais P-40/P-41.
-- Roteiro completo: docs/testes-reais-loja-teste.md. Pré-requisito: as migrations da noite de
-- 13/10/2026 aplicadas e a conta dono@loja-teste.invalid já criada pela API de administração do Auth.
-- A loja nasce pela mesma função do app (create_own_barbershop), com o dono simulado só nesta
-- transação. Não toca outras lojas. Aborta sem gravar nada se algo não bater.
\set ON_ERROR_STOP on
begin;

create temporary table lt_dono on commit drop as
select u.id from auth.users u where lower(u.email) = 'dono@loja-teste.invalid';

do $$
declare n_dono int; n_vinculos int;
begin
  select count(*) into n_dono from lt_dono;
  if n_dono <> 1 then
    raise exception 'ABORTADO: a conta dono@loja-teste.invalid não existe (passo 2 do roteiro); nada foi gravado';
  end if;
  select count(*) into n_vinculos from public.shop_members sm where sm.user_id in (select id from lt_dono);
  if n_vinculos > 0 then
    raise exception 'ABORTADO: a conta de teste já está na equipe de alguma loja; nada foi gravado';
  end if;
  if exists (select 1 from public.barbershops where slug = 'loja-teste')
     or exists (select 1 from public.shop_slug_redirects where from_slug = 'loja-teste' and deleted_at is null) then
    raise exception 'ABORTADO: o endereço loja-teste já está em uso; nada foi gravado';
  end if;
end $$;

select set_config('request.jwt.claim.sub', (select id::text from lt_dono), true);
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from lt_dono), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.create_own_barbershop('Loja Teste') as loja_criada;
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

do $$
declare v_slug text; n_owner int;
begin
  select b.slug into v_slug from public.barbershops b
  join public.shop_members sm on sm.barbershop_id = b.id and sm.role = 'owner' and sm.active
  where sm.user_id = (select id from lt_dono);
  select count(*) into n_owner from public.shop_members sm
  where sm.user_id = (select id from lt_dono) and sm.role = 'owner' and sm.ownership_percent = 100;
  raise notice 'slug=% dono_100=%', v_slug, n_owner;
  if v_slug is distinct from 'loja-teste' or n_owner <> 1 then
    raise exception 'ABORTADO: a loja não ficou como esperado; nada foi gravado';
  end if;
  raise notice 'LOJA TESTE CRIADA';
end $$;

commit;
