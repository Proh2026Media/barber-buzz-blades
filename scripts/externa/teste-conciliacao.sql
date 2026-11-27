-- Roda dentro da bancada fictícia de teste.sql. O estado das demais provas é restaurado.
savepoint antes_do_cruzamento;
select 'a5c2b03b-1e30-4446-b013-8cb8a9d8c447'::uuid loja,gen_random_uuid() titular,gen_random_uuid() rival \gset
update espelho_linhas set registro=registro||'{"nome":"Lúcia  Almeida","nome_cliente":"Lucia Almeida","email":" CLIENTE@example.invalid "}'
  where registro->>'linha'='2';
select pg_temp.proximo();
\ir sincronizar.sql
insert into auth.users(id,email,raw_user_meta_data) values(:'titular','cliente@example.invalid','{"full_name":"Lucia Almeida"}'),
  (:'rival','outra@example.invalid','{"full_name":"Outra Pessoa"}');
update public.profiles set full_name='Lucia Almeida', whatsapp_e164='+5511990000000' where id=:'titular';
insert into public.memberships(user_id,barbershop_id,role) values(:'titular',:'loja','customer');
select pg_temp.conferir(not exists(select from manutencao.externa_cruzamento),'dados digitados não provam contato');
select pg_temp.conferir(public.link_shop_clients_to_profile(:'rival','+5511990000000',null)=0,'vinculador antigo não absorve a ficha importada');
update auth.users set email_confirmed_at=now() where id=:'titular';
select pg_temp.conferir((select criterio='email_nome' from manutencao.externa_cruzamento),'e-mail confirmado e nome original normalizado');
savepoint candidato_seguro;
update public.profiles set full_name='Lucia' where id=:'titular';
select pg_temp.conferir((select motivo is not null from manutencao.externa_cruzamento),'nome parcial insuficiente');
rollback to candidato_seguro;

update auth.users set phone='5511990000000',phone_confirmed_at=now() where id=:'rival';
select pg_temp.conferir((select motivo='contato_compartilhado' from manutencao.externa_cruzamento),'contatos confirmados apontam para contas diferentes, mesmo fora da loja');
rollback to candidato_seguro;
insert into manutencao.espelho_externa_linhas(chave,registro,situacao)
select repeat('6',64),registro||'{"telefone":"+5511991234567","linha":100}','pendente' from espelho_linhas where registro->>'linha'='2';
select manutencao.conciliar_historico_externa();
select pg_temp.conferir(exists(select from manutencao.externa_historico_revisao where motivo='contato_compartilhado')
  and not exists(select from public.appointments where customer_id=:'titular'),'e-mail compartilhado bloqueia inclusive a outra ficha pendente');
rollback to candidato_seguro;
insert into manutencao.espelho_externa_linhas(chave,registro,situacao)
select repeat('6',64),registro||'{"nome":"Outra Pessoa","linha":101}','pendente' from espelho_linhas where registro->>'linha'='2';
select pg_temp.conferir((select motivo='identidade_divergente' from manutencao.externa_cruzamento),'nome original diferente bloqueia mesmo com o nome consolidado igual');
rollback to candidato_seguro;
update public.shop_clients set profile_id=:'rival' where barbershop_id=:'loja';
select manutencao.conciliar_historico_externa();
select pg_temp.conferir(exists(select from manutencao.externa_historico_revisao where motivo='ficha_com_titular')
 and not exists(select from public.appointments where customer_id=:'titular'),'não transfere uma ficha já atribuída');
rollback to candidato_seguro;
delete from public.memberships where user_id=:'titular' and barbershop_id=:'loja';
select pg_temp.conferir(not exists(select from manutencao.externa_cruzamento),'conta sem vínculo com a Externa não recebe histórico');
rollback to candidato_seguro;
update auth.users set email_confirmed_at=null,phone='5511990000000',phone_confirmed_at=now() where id=:'titular';
select pg_temp.conferir((select criterio='telefone_nome' from manutencao.externa_cruzamento),'telefone confirmado com nome completo');
update public.profiles set full_name='' where id=:'titular';
select pg_temp.conferir((select motivo='prova_insuficiente' from manutencao.externa_cruzamento),'telefone confirmado sozinho não revela reservas');
update auth.users set email_confirmed_at=now() where id=:'titular';
select pg_temp.conferir((select criterio='email_telefone' from manutencao.externa_cruzamento),'dois contatos confirmados sem contradição');
rollback to candidato_seguro;
select pg_temp.proximo();
\ir sincronizar.sql
select pg_temp.conferir((select count(*)=1 from public.appointments where barbershop_id=:'loja' and customer_id=:'titular')
 and (select count(*)=1 from manutencao.externa_historico_vinculado where conta=:'titular' and criterio='email_nome'),'atualização do cadastro reconhecida sem alteração na planilha');
select count(*) as sinais_antes from public.availability_signals where barbershop_id=:'loja' \gset
select manutencao.conciliar_historico_externa();
select pg_temp.conferir((select count(*)=:'sinais_antes' from public.availability_signals where barbershop_id=:'loja'),'repetição sem novo sinal');
select pg_temp.conferir((select count(*)=1 from manutencao.externa_historico_vinculado),'repetição sem duplicidade');
insert into espelho_linhas select registro||jsonb_build_object('chave',repeat('9',64),'linha',5,'inicio','2024-02-10T12:00:00','fim','2024-02-10T12:30:00') from espelho_linhas where registro->>'linha'='2';
update espelho_meta set registro=registro||'{"total_linhas":4}';
select pg_temp.proximo();
\ir sincronizar.sql
select pg_temp.conferir((select count(*)=2 from manutencao.externa_historico_vinculado where conta=:'titular') and
  (select count(*)=2 from public.appointments where customer_id=:'titular'),'nova reserva coerente também entra no histórico');
set local role authenticated;
select set_config('request.jwt.claim.sub',:'titular',true);
select pg_temp.conferir((select count(*)=2 from public.appointments where barbershop_id=:'loja' and customer_id=auth.uid()),'histórico consultável com as permissões do cliente');
reset role;
select pg_temp.conferir(not exists(select from public.web_push_queue q join public.appointments a on a.id=q.appointment_id where a.barbershop_id=:'loja') and
  not exists(select from public.email_outbox where barbershop_id=:'loja') and not exists(select from public.loyalty_ledger where barbershop_id=:'loja'),'histórico sem avisos nem pontos retroativos');
select pg_temp.conferir(not has_function_privilege('authenticated','manutencao.conciliar_historico_externa()','execute'),'cliente não executa conciliação administrativa');
rollback to antes_do_cruzamento;
