-- Exclusivamente na bancada local, psql -f scripts/externa/teste.sql. Tudo é revertido.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if exists(select from public.barbershops where slug='externabarbearia') then
    raise exception 'Esta prova só roda em bancada vazia para a Externa';
  end if;
end $$;
\ir instalar.sql
\ir instalar.sql
create table manutencao.importacao_externa(tipo text,id uuid,n integer);
insert into public.barbershops(id,name,slug) values('a5c2b03b-1e30-4446-b013-8cb8a9d8c447','Unidade fictícia','externabarbearia');
insert into public.staff(barbershop_id,display_name,booking_slug)
values('a5c2b03b-1e30-4446-b013-8cb8a9d8c447','Profissional fictício','ezequiel') returning id as st \gset
insert into public.services(barbershop_id,name,duration_minutes,price_cents)
values('a5c2b03b-1e30-4446-b013-8cb8a9d8c447','Corte',30,6000) returning id as sv \gset
insert into public.staff_services(barbershop_id,service_id,staff_id,duration_minutes,price_cents)
values('a5c2b03b-1e30-4446-b013-8cb8a9d8c447',:'sv',:'st',30,6000);
create temp table espelho_meta(registro jsonb);
create temp table espelho_linhas(registro jsonb);
insert into espelho_meta values ('{"planilha":"1fqb5vW5Y1vJ7-OCbK6vs8LN2SolXsjjbU5bRt3ESqUc","gid":0,"headers":["Service Name","Start Date","End Date","Booking Page","Name","Phone Number","Email","Booking Date"],"total_linhas":3}');
insert into espelho_linhas values
(jsonb_build_object('linha',2,'chave',repeat('a',64),'bruto',jsonb_build_array('Corte','27/01/2024 09:30'),'profissional','ezequiel',
  'servico','Corte','inicio','2024-01-27T09:30:00','fim','2024-01-27T10:00:00','criado','2024-01-22T22:40:00',
  'nome_cliente','Cliente fictício','telefone','+5511990000000')),
(jsonb_build_object('linha',3,'chave',repeat('b',64),'bruto',jsonb_build_array('teste'),'motivo','teste')),
(jsonb_build_object('linha',4,'chave',repeat('c',64),'bruto',jsonb_build_array('ilegível'),'motivo','telefone_invalido'));
create function pg_temp.conferir(ok boolean,texto text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Falhou: %',texto; end if; end $$;
create function pg_temp.proximo() returns void language plpgsql as $$
begin drop table espelho_resultado,ext_catalogo,ext_processar,ext_entrada; end $$;
\ir sincronizar.sql
select pg_temp.conferir(resumo @> '{"linhas":3,"criadas":1,"fichas_criadas":1,"pendentes":1,"excluidas_da_agenda":1}', 'primeiro ciclo completo') from espelho_resultado;
select pg_temp.conferir((select starts_at at time zone 'America/Sao_Paulo'=timestamp '2024-01-27 09:30'
  from public.appointments where barbershop_id='a5c2b03b-1e30-4446-b013-8cb8a9d8c447'),'hora civil da loja');
select pg_temp.conferir(not exists(select from public.email_outbox where barbershop_id='a5c2b03b-1e30-4446-b013-8cb8a9d8c447')
  and not exists(select from public.web_push_queue q join manutencao.espelho_externa_linhas l on l.agendamento_id=q.appointment_id)
  and not exists(select from public.google_calendar_pushes q join manutencao.espelho_externa_linhas l on l.agendamento_id=q.appointment_id)
  and not exists(select from public.loyalty_ledger q join manutencao.espelho_externa_linhas l on l.agendamento_id=q.appointment_id),'sem filas ou pontos');
select pg_temp.conferir(not has_table_privilege('authenticated','manutencao.espelho_externa_linhas','select')
  and not has_table_privilege('anon','manutencao.espelho_externa_linhas','select'),'leitura privada');
select pg_temp.proximo();
\ir sincronizar.sql
select pg_temp.conferir(resumo @> '{"criadas":0,"atualizadas":0,"fichas_criadas":0,"vinculadas":1}','repetição idempotente') from espelho_resultado;
select pg_temp.proximo();
update espelho_linhas set registro=registro || '{"inicio":"2024-01-27T10:00:00","fim":"2024-01-27T10:30:00","nome_cliente":"Nome corrigido"}'
where registro->>'linha'='2';
\ir sincronizar.sql
select pg_temp.conferir(resumo @> '{"criadas":0,"atualizadas":1,"fichas_atualizadas":1}','alteração de horário e nome') from espelho_resultado;
select pg_temp.proximo();
update public.appointments set ends_at=timestamptz '2024-01-27 10:29-03' where barbershop_id='a5c2b03b-1e30-4446-b013-8cb8a9d8c447';
update espelho_linhas set registro=registro || '{"fim":"2024-01-27T10:35:00"}' where registro->>'linha'='2';
\ir sincronizar.sql
select pg_temp.conferir(resumo @> '{"atualizadas":0,"pendencias_por_motivo":{"reserva_editada_no_sistema":1}}','conflito nativo preservado') from espelho_resultado;
select pg_temp.proximo();
delete from espelho_linhas where registro->>'linha'='2';
update espelho_meta set registro=registro || '{"total_linhas":2}';
\ir sincronizar.sql
select pg_temp.conferir(resumo @> '{"ausentes":1,"linhas":2}' and (select count(*)=1 from public.appointments where barbershop_id='a5c2b03b-1e30-4446-b013-8cb8a9d8c447'),'ausência não cancela') from espelho_resultado;

-- Vincula o ID que foi importado no dia 25 e corrige só o relógio cuja entrada trazia Z.
select pg_temp.proximo();
insert into public.shop_clients(barbershop_id,full_name,whatsapp_e164,notify_whatsapp)
values('a5c2b03b-1e30-4446-b013-8cb8a9d8c447','Ficha histórica fictícia','+5511990000001',false) returning id as ficha \gset
insert into public.appointments(barbershop_id,service_id,staff_id,shop_client_id,starts_at,ends_at,created_at,status)
values('a5c2b03b-1e30-4446-b013-8cb8a9d8c447',:'sv',:'st',:'ficha','2024-01-27 15:00Z','2024-01-27 15:30Z','2024-01-20 12:30Z','completed') returning id as legado \gset
insert into manutencao.importacao_externa values('agendamento',:'legado',1),('ficha',:'ficha',1);
insert into espelho_linhas values(jsonb_build_object('linha',5,'chave',repeat('d',64),'bruto','["Dado histórico"]'::jsonb,
  'profissional','ezequiel','profissional_legado','ezequiel','servico','Corte','servico_legado','Corte',
  'inicio','2024-01-27T15:00:00','fim','2024-01-27T15:30:00','criado','2024-01-20T12:30:00',
  'inicio_legado','2024-01-27T15:00:00Z','fim_legado','2024-01-27T15:30:00Z','criado_legado','2024-01-20T12:30:00Z',
  'nome_cliente','Ficha histórica fictícia','nome_legado','Ficha histórica fictícia','telefone','+5511990000001','telefone_legado','+5511990000001','legado_n',1));
update espelho_meta set registro=registro || '{"total_linhas":3}';
\ir sincronizar.sql
select pg_temp.conferir(resumo @> '{"criadas":0,"atualizadas":1,"vinculadas":1}' and
    (select agendamento_id=:'legado' from manutencao.espelho_externa_linhas where chave=repeat('d',64))
    and (select starts_at at time zone 'America/Sao_Paulo'=timestamp '2024-01-27 15:00' from public.appointments where id=:'legado'),
  'reuso do UUID histórico e interpretação civil de Z') from espelho_resultado;
select pg_temp.proximo();
insert into public.business_hours(barbershop_id,weekday,opens_at,closes_at,is_open)
values('a5c2b03b-1e30-4446-b013-8cb8a9d8c447',extract(dow from date '2099-02-03')::int,'08:00','18:00',true)
on conflict(barbershop_id,weekday) do update set opens_at=excluded.opens_at,closes_at=excluded.closes_at,is_open=true;
insert into espelho_linhas select registro || jsonb_build_object('linha',6,'chave',repeat('e',64),'legado_n',null,
  'inicio','2099-02-03T09:00:00','fim','2099-02-03T09:30:00') from espelho_linhas where registro->>'linha'='5';
insert into espelho_linhas select registro || jsonb_build_object('linha',7,'chave',repeat('f',64),'legado_n',null,
  'inicio','2099-02-03T04:00:00','fim','2099-02-03T04:30:00') from espelho_linhas where registro->>'linha'='5';
update espelho_meta set registro=registro || '{"total_linhas":5}';
\ir sincronizar.sql
select pg_temp.conferir(resumo @> '{"criadas":1,"atualizadas":0,"pendencias_por_motivo":{"regra_de_agenda_ou_cadastro":1}}'
  and (select status='confirmed' from public.appointments a join manutencao.espelho_externa_linhas l on l.agendamento_id=a.id where l.chave=repeat('e',64)),
  'futuro disponível é confirmado e expediente continua protegido') from espelho_resultado;
do $$
declare b uuid; st uuid; sv uuid;
begin
  insert into public.barbershops(name,slug) values('Outra unidade fictícia','outra-unidade-ficticia') returning id into b;
  insert into public.staff(barbershop_id,display_name) values(b,'Profissional da outra unidade') returning id into st;
  insert into public.services(barbershop_id,name,duration_minutes,price_cents) values(b,'Serviço teste',30,1000) returning id into sv;
  begin
    insert into public.appointments(barbershop_id,staff_id,service_id,starts_at,ends_at,status)
      values(b,st,sv,'2024-01-01 12:00-03','2024-01-01 12:30-03','completed');
    raise exception 'Uma outra unidade perdeu a validação';
  exception when sqlstate '22023' then null; end;
end $$;
\ir teste-contatos.sql
rollback;
