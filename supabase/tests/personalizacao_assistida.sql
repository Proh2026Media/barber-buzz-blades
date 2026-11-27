-- Executar em BEGIN … ROLLBACK sobre a migration de personalização assistida.
-- Os dados e as contas desta prova são fictícios.
create temporary table ensaio_marca as
select gen_random_uuid() loja, gen_random_uuid() outra, gen_random_uuid() suspensa,
       gen_random_uuid() gerente, gen_random_uuid() dono, gen_random_uuid() admin;
grant select on ensaio_marca to authenticated;
select * from ensaio_marca \gset
create temporary table pedidos_marca (resposta jsonb not null);
grant select,insert on pedidos_marca to authenticated;

create function pg_temp.conferir(ok boolean, legenda text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', legenda; end if;
  raise notice 'PASS: %', legenda;
end $$;

create function pg_temp.exigir_recusa(comando text, legenda text) returns void language plpgsql as $$
begin
  begin
    execute comando;
  exception when insufficient_privilege or invalid_parameter_value or check_violation then
    raise notice 'PASS: %', legenda;
    return;
  end;
  raise exception 'FAIL: operação permitida: %', legenda;
end $$;

create function pg_temp.exigir_recusa_marca(loja uuid, alteracoes jsonb, legenda text)
returns void language sql as $$
  select pg_temp.exigir_recusa(format('select public.request_shop_change(%L,''identity.update'',%L)',
    loja, jsonb_build_object('changes',alteracoes)),legenda);
$$;

insert into public.barbershops(id,name,slug,status) values
  (:'loja','Loja de ensaio','marca-' || :'loja','active'),
  (:'outra','Loja independente','marca-' || :'outra','active'),
  (:'suspensa','Loja suspensa','marca-' || :'suspensa','suspended');
insert into auth.users(id,email,raw_user_meta_data)
select id, id || '@example.invalid','{}'::jsonb
from ensaio_marca cross join lateral unnest(array[gerente,dono,admin]) usuarios(id);
insert into public.memberships(user_id,role) values
  (:'gerente','account_manager'),(:'admin','platform_admin');
insert into public.account_manager_shops(user_id,barbershop_id)
values (:'gerente',:'loja'),(:'gerente',:'suspensa');
insert into public.staff(barbershop_id,display_name,user_id,booking_slug)
values (:'loja','Dono do ensaio',:'dono','dono') returning id as staff_dono \gset
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
values (:'loja',:'dono',:'staff_dono','owner',100);
update public.barbershop_settings set tagline='Frase original' where barbershop_id=:'loja';
insert into storage.objects(bucket_id,name) values ('barbershop-logos',:'outra' || '/logo-1');
select 'https://supabasebeauty.contheiner.digital/storage/v1/object/public/' as origem \gset
select :'origem' || 'barbershop-logos/' || :'loja' || '/logo-1?v=1' as logo,
       :'origem' || 'barbershop-logos/' || :'loja' || '/login-background-1.webp?v=1' as fundo,
       :'origem' || 'barbershop-fonts/' || :'loja' || '/family/1-0-fonte.woff2?v=1' as fonte \gset

select pg_temp.conferir(
  not has_function_privilege('anon','public.list_managed_brand_shops()','EXECUTE') and
  not has_function_privilege('anon','public.get_managed_brand_settings(uuid)','EXECUTE'),
  'Visitantes não têm acesso às funções de gestão');

set local role authenticated;
select set_config('request.jwt.claim.sub', :'gerente', true);
select pg_temp.conferir(count(*)=1 and bool_and(id=:'loja'),'A lista do gerente contém apenas sua loja ativa')
from public.list_managed_brand_shops();
select pg_temp.conferir(
  (to_jsonb(d)->>'tagline')='Frase original' and to_jsonb(d) ? 'landing'
  and not to_jsonb(d) ?| array['booking_horizon_days','survey_program_enabled'],
  'O formulário projeta a marca e a página pública da loja autorizada')
from public.get_managed_brand_settings(:'loja') d;
select pg_temp.exigir_recusa(format('select public.get_managed_brand_settings(%L)', :'outra'),
  'A leitura de identidade exige vínculo com a loja');
select pg_temp.exigir_recusa(format('select public.get_managed_brand_settings(%L)', :'suspensa'),
  'A leitura de identidade exige loja ativa');
insert into storage.objects (bucket_id,name) values
  ('barbershop-logos',:'loja' || '/logo-1'),
  ('barbershop-logos',:'loja' || '/login-background-1.webp'),
  ('barbershop-fonts',:'loja' || '/family/1-0-fonte.woff2');
select pg_temp.conferir(count(*)=3,'A loja atribuída aceita imagens e fontes novas com versão')
from storage.objects where split_part(name,'/',1)=:'loja';
select pg_temp.exigir_recusa(
  format('insert into storage.objects(bucket_id,name) values (''barbershop-logos'',%L)', :'outra' || '/logo-1'),
  'Um gerente não envia arquivos à loja de outro gerente');
select pg_temp.exigir_recusa(
  format('insert into storage.objects(bucket_id,name) values (''barbershop-logos'',%L)', :'loja' || '/logo'),
  'O gerente só pode enviar arte para um caminho versionado');
with alteradas as (
  update storage.objects set metadata='{"alterado":true}' where name=:'loja' || '/logo-1' returning id
)
select pg_temp.conferir(count(*)=0,'O gerente não sobrescreve a arte publicada') from alteradas;

select public.request_shop_change(:'loja','identity.update', jsonb_build_object('changes',jsonb_build_object(
  'logo_url',:'logo','login_image_url',:'fundo','custom_font_url',:'fonte',
  'custom_font_faces',jsonb_build_array(jsonb_build_object(
    'url',:'fonte','file_name','fonte.woff2','weight',400,'style','normal')),
  'landing',jsonb_build_object('enabled',true,'headline','Horários da barbearia')
)))->>'request_id' as pedido_arte \gset
select pg_temp.conferir(:'pedido_arte' is not null,
  'O formulário aceita logo, fundo, família de fontes e página pública da própria loja');
select pg_temp.exigir_recusa_marca(:'loja', jsonb_build_object('logo_url',
  replace(:'logo', :'loja', :'outra')), 'Uma imagem existente de outra loja é recusada');
select pg_temp.exigir_recusa_marca(:'loja', jsonb_build_object('logo_url',
  replace(:'logo', 'supabasebeauty.contheiner.digital', 'exemplo.invalid')), 'A origem externa da arte é recusada');
select pg_temp.exigir_recusa_marca(:'loja', jsonb_build_object('logo_url',
  replace(:'logo', 'logo-1?', 'logo-2?')), 'Uma imagem que não existe no bucket é recusada');
select pg_temp.exigir_recusa_marca(:'loja', jsonb_build_object('custom_font_faces',jsonb_build_array(
  jsonb_build_object('url',:'fonte'),jsonb_build_object('url','https://exemplo.invalid/fonte.woff2'))),
  'Cada URL da família de fontes é conferida');
select pg_temp.exigir_recusa_marca(:'loja', '{"landing":{"show_staff":"sim"}}',
  'A solicitação rejeita configuração inválida da página pública');
select pg_temp.exigir_recusa(
  format('select public.request_shop_change(%L,''identity.update'',''{"changes":{"booking_horizon_days":60}}'')', :'loja'),
  'O pedido rejeita configuração operacional fora do escopo de identidade');
select pg_temp.exigir_recusa(
  format('select public.request_shop_change(%L,''identity.update'',''{"changes":{"tagline":"Sem vínculo"}}'')', :'outra'),
  'Um gerente não solicita mudança em loja sem vínculo');
select pg_temp.exigir_recusa(
  format('select public.request_shop_change(%L,''identity.update'',''{"changes":{"tagline":"Suspensa"}}'')', :'suspensa'),
  'Loja suspensa não recebe pedido do gerente');

insert into pedidos_marca select public.request_shop_change(:'loja','identity.update',
  '{"changes":{"tagline":"Frase aprovada"}}');
select pg_temp.conferir(resposta->>'status'='pending' and resposta ? 'request_id',
  'Gerente cria um pedido pendente de aprovação') from pedidos_marca;
select pg_temp.exigir_recusa(
  format('select public.decide_shop_change(%L,true)', (select resposta->>'request_id' from pedidos_marca)),
  'O gerente não aprova o próprio pedido');
with alteradas as (
  update public.barbershop_settings set tagline='Atualização indevida' where barbershop_id=:'loja'
  returning barbershop_id
)
select pg_temp.conferir(count(*)=0,'A RLS impede a edição direta pelo gerente') from alteradas;

reset role;
select pg_temp.conferir((select tagline from public.barbershop_settings where barbershop_id=:'loja')='Frase original',
  'A loja conserva a frase enquanto aguarda aprovação');
set local role authenticated;
select set_config('request.jwt.claim.sub', :'dono', true);
select public.decide_shop_change((select (resposta->>'request_id')::uuid from pedidos_marca),true);
select pg_temp.conferir(public.decide_shop_change(:'pedido_arte',true)->>'status'='approved',
  'O dono aprova a identidade com as imagens e fontes verificadas');
reset role;
select pg_temp.conferir((select tagline from public.barbershop_settings where barbershop_id=:'loja')='Frase aprovada',
  'A decisão do dono aplica a identidade solicitada');
select pg_temp.conferir((select logo_url=:'logo' and login_image_url=:'fundo'
  and custom_font_faces->0->>'url'=:'fonte' and landing->>'headline'='Horários da barbearia'
  from public.barbershop_settings where barbershop_id=:'loja'),
  'A decisão aplica os arquivos e o conteúdo público do mesmo pedido');

set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin', true);
update public.barbershop_settings set tagline='Atualização da plataforma' where barbershop_id=:'loja';
select pg_temp.conferir(exists (
  select 1 from public.shop_identity_audit
  where actor_id=:'admin' and barbershop_id=:'loja' and to_jsonb(changed_fields) ? 'tagline'
), 'A edição direta do administrador registra responsável, loja e campo');

select set_config('request.jwt.claim.sub', :'gerente', true);
select pg_temp.conferir(not exists(select from public.shop_identity_audit),
  'O histórico de auditoria fica restrito ao administrador da plataforma');
select public.request_shop_change(:'loja','identity.update',
  '{"changes":{"tagline":"Frase mais recente"}}')->>'request_id' as pedido_frase \gset
select public.request_shop_change(:'loja','identity.update',
  '{"changes":{"display_name":"Nome exibido"}}')->>'request_id' as pedido_nome \gset
select public.request_shop_change(:'loja','identity.update',
  '{"changes":{"tagline":"Frase concorrente"}}')->>'request_id' as pedido_conflito \gset
select set_config('request.jwt.claim.sub', :'dono', true);
select public.decide_shop_change(:'pedido_frase',true);
select public.decide_shop_change(:'pedido_nome',true);
create function pg_temp.exigir_conflito(pedido uuid) returns void language plpgsql as $$
begin
  begin
    perform public.decide_shop_change(pedido,true);
  exception when serialization_failure then
    raise notice 'PASS: o conflito no mesmo campo impede a aprovação desatualizada';
    return;
  end;
  raise exception 'FAIL: a aprovação desatualizada foi aceita';
end $$;
select pg_temp.exigir_conflito(:'pedido_conflito');
select pg_temp.conferir(public.decide_shop_change(:'pedido_conflito',false)->>'status'='rejected',
  'O dono pode recusar o pedido após conflito');
reset role;
select pg_temp.conferir((select tagline='Frase mais recente' and display_name='Nome exibido'
  from public.barbershop_settings where barbershop_id=:'loja'),
  'Duas aprovações em campos diferentes preservam ambas as alterações');

set local role authenticated;
select set_config('request.jwt.claim.sub', :'gerente', true);
select public.request_shop_change(:'loja','identity.update',
  '{"changes":{"tagline":"Proposta anterior à revogação"}}')->>'request_id' as pedido_revogado \gset
reset role;
delete from public.account_manager_shops where user_id=:'gerente' and barbershop_id=:'loja';
set local role authenticated;
select set_config('request.jwt.claim.sub', :'gerente', true);
select pg_temp.conferir(count(*)=0,'Revogar o vínculo remove o estabelecimento da lista') from public.list_managed_brand_shops();
select pg_temp.exigir_recusa(
  format('select public.request_shop_change(%L,''identity.update'',''{"changes":{"tagline":"Vínculo encerrado"}}'')', :'loja'),
  'Uma sessão existente perde a capacidade de solicitar após a revogação');
select set_config('request.jwt.claim.sub', :'dono', true);
select pg_temp.exigir_recusa(format('select public.decide_shop_change(%L,true)', :'pedido_revogado'),
  'A aprovação também confere se o vínculo do gerente ainda está ativo');
reset role;
