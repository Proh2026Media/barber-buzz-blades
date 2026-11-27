-- Fixture de scripts/externa/teste.sql. Não contém contatos reais.
\ir contatos.sql
select 'a5c2b03b-1e30-4446-b013-8cb8a9d8c447'::uuid as loja,gen_random_uuid() as dono,
       gen_random_uuid() as administrador,gen_random_uuid() as gerente,gen_random_uuid() as titular \gset
insert into auth.users(id,email,raw_user_meta_data)
select id,id || '@example.invalid','{}'::jsonb from unnest(array[:'dono'::uuid,:'administrador',:'gerente',:'titular']) id;
insert into public.memberships(user_id,role) values(:'administrador','platform_admin'),(:'gerente','account_manager');
insert into public.staff(barbershop_id,display_name,user_id,booking_slug)
values (:'loja','Dono do teste',:'dono','dono') returning id as staff_dono \gset
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
values(:'loja',:'dono',:'staff_dono','owner',100);
insert into public.account_manager_shops(user_id,barbershop_id) values(:'gerente',:'loja');
update manutencao.espelho_externa_linhas set registro=registro || '{"email":"reserva@example.invalid"}'
 where chave in (repeat('d',64),repeat('e',64));
select pg_temp.conferir(not has_function_privilege('anon','public.emails_informados_agendamentos_externa(uuid,uuid,uuid)','execute'),'sem consulta anônima');
set local role authenticated;
select set_config('request.jwt.claim.sub',:'administrador',true);
select pg_temp.conferir(count(*)=2 and count(distinct reserva)=2,'admin vê e-mail associado a duas reservas')
  from public.emails_informados_agendamentos_externa(:'loja',:'ficha',null);
select pg_temp.conferir(count(*)=0,'admin não atravessa o isolamento de loja ou de ficha')
  from public.emails_informados_agendamentos_externa(gen_random_uuid(),:'ficha',null);
select pg_temp.conferir(count(*)=0,'admin não enumera as fichas sem informar uma')
  from public.emails_informados_agendamentos_externa(:'loja',null,null);
select set_config('request.jwt.claim.sub',:'gerente',true);
select pg_temp.conferir(count(*)=0,'gerente atribuído não recebe e-mails das reservas')
  from public.emails_informados_agendamentos_externa(:'loja',:'ficha',null);
select set_config('request.jwt.claim.sub',:'dono',true);
select pg_temp.conferir(count(*)=2,'dono ativo da Externa pode consultar a própria ficha')
  from public.emails_informados_agendamentos_externa(:'loja',:'ficha',null);
reset role;
update manutencao.espelho_externa_linhas set presente=false where chave=repeat('d',64);
update manutencao.espelho_externa_linhas set situacao='pendente',motivo='conflito_identidade' where chave=repeat('e',64);
select pg_temp.conferir(count(*)=0,'linha ausente e identidade em revisão não expõem o e-mail')
  from public.emails_informados_agendamentos_externa(:'loja',:'ficha',null);
update manutencao.espelho_externa_linhas set presente=true where chave=repeat('d',64);
update public.shop_clients set profile_id=:'titular' where id=:'ficha';
update public.appointments set customer_id=:'titular' where id=:'legado';
select pg_temp.conferir(count(*)=0,'após vínculo com conta, o caminho antigo do balcão não apresenta o dado')
  from public.emails_informados_agendamentos_externa(:'loja',:'ficha',null);
select pg_temp.conferir(count(*)=1,'a ficha vinculada exige a mesma conta na reserva')
  from public.emails_informados_agendamentos_externa(:'loja',null,:'titular');
select pg_temp.conferir(count(*)=0,'a consulta de outra conta não empresta o contato')
  from public.emails_informados_agendamentos_externa(:'loja',null,:'gerente');
update public.shop_clients set whatsapp_e164='+5511988888888' where id=:'ficha';
select pg_temp.conferir(count(*)=0,'troca do telefone da ficha interrompe a associação anterior')
  from public.emails_informados_agendamentos_externa(:'loja',null,:'titular');
