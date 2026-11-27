-- Instalação administrativa. Executar com psql -1 -v ON_ERROR_STOP=1.
-- As tabelas são privadas. Nenhuma função de escrita é oferecida pela API.
create schema if not exists manutencao;
revoke all on schema manutencao from public, anon, authenticated;

create table if not exists manutencao.espelho_externa_fonte (
  id text primary key,
  gid integer not null,
  cabecalho jsonb not null
);
create table if not exists manutencao.espelho_externa_linhas (
  chave text primary key,
  registro jsonb not null,
  presente boolean not null default true,
  situacao text not null check (situacao in ('pendente','vinculada','excluida')),
  motivo text,
  agendamento_id uuid unique,
  legado_n integer unique,
  origem_aplicada jsonb,
  versao_agenda jsonb,
  modificado_em timestamptz not null default now()
);
create table if not exists manutencao.espelho_externa_fichas (
  ficha_id uuid primary key,
  telefone text unique not null,
  nome_origem text not null,
  nome_aplicado text
);
create table if not exists manutencao.espelho_externa_gatilhos (
  nome name primary key,
  definicao_original text not null,
  definicao_instalada text not null
);
revoke all on manutencao.espelho_externa_fonte, manutencao.espelho_externa_linhas,
  manutencao.espelho_externa_fichas, manutencao.espelho_externa_gatilhos from public,anon,authenticated,service_role;

-- A conexão de importação marca só sua transação. Todas as outras conexões passam pelas
-- regras e avisos de sempre. O papel vindo da API não consegue imitar SESSION_USER.
-- FKs, exclusão de sobreposição, isolamento de loja, histórico e fatos ficam ativos.
do $$
declare
  t record;
  original text;
  guardada text;
  condicao text;
  indice int;
  eventos text;
  exclusao text;
  marcador constant text := 'coalesce(SESSION_USER = ''postgres'' AND current_setting(''aurset.espelho_externa'',true) = ''a5c2b03b-1e30-4446-b013-8cb8a9d8c447'',false)';
begin
  for t in
    select x.oid,x.tgname,x.tgqual,x.tgtype from pg_trigger x
    where x.tgrelid='public.appointments'::regclass and not x.tgisinternal and x.tgname in
      ('appointments_google_push_trg','appointments_web_push_notify_trg','appointments_whatsapp_notify_trg',
       'appointments_availability_signal','appointments_award_points','wake_care_cycle_appointment','appointments_validate_booking_trg')
  loop
    original := pg_get_triggerdef(t.oid);
    select g.definicao_instalada into guardada from manutencao.espelho_externa_gatilhos g where g.nome=t.tgname;
    if guardada is not null then
      if guardada <> original then raise exception 'Regra de agenda alterada; revise o espelho antes de reinstalar'; end if;
      continue;
    end if;
    if t.tgqual is not null or position(' FOR EACH ROW EXECUTE FUNCTION ' in original)=0 then
      raise exception 'Formato de gatilho inesperado: %',t.tgname;
    end if;
    eventos := original;
    -- Um WHEN multievento com DELETE não pode ler NEW. Separar o DELETE preserva seu
    -- comportamento integral, inclusive quando ocorre na conexão de importação.
    if (t.tgtype::integer & 8)<>0 then
      if original not like '% AFTER INSERT OR DELETE OR UPDATE OF %' then
        raise exception 'Eventos de % não reconhecidos',t.tgname;
      end if;
      exclusao := format('CREATE TRIGGER %I AFTER DELETE ON public.appointments FOR EACH ROW %s',
        t.tgname || '_delete',substr(original,strpos(original,'EXECUTE FUNCTION ')));
      execute exclusao;
      insert into manutencao.espelho_externa_gatilhos
        select x.tgname,original,pg_get_triggerdef(x.oid) from pg_trigger x
        where x.tgrelid='public.appointments'::regclass and x.tgname=t.tgname || '_delete';
      eventos := replace(original,' AFTER INSERT OR DELETE OR UPDATE OF ',' AFTER INSERT OR UPDATE OF ');
    end if;
    condicao := marcador || ' AND NEW.barbershop_id = ''a5c2b03b-1e30-4446-b013-8cb8a9d8c447''::uuid';
    if t.tgname='appointments_validate_booking_trg' then
      condicao := condicao || ' AND NEW.starts_at <= statement_timestamp()';
    end if;
    indice := strpos(eventos,' FOR EACH ROW EXECUTE FUNCTION ');
    execute replace(left(eventos,indice-1),'CREATE TRIGGER ','CREATE OR REPLACE TRIGGER ')
      || ' FOR EACH ROW WHEN (NOT (' || condicao || '))'
      || substr(eventos,indice+length(' FOR EACH ROW'));
    insert into manutencao.espelho_externa_gatilhos
      select t.tgname,original,pg_get_triggerdef(x.oid) from pg_trigger x
      where x.tgrelid='public.appointments'::regclass and x.tgname=t.tgname;
  end loop;
end $$;

create or replace function manutencao.espelho_externa_versao(a public.appointments) returns jsonb
language sql stable set search_path='' as $$
  select to_jsonb(a) - 'public_token' - 'updated_at';
$$;
revoke all on function manutencao.espelho_externa_versao(public.appointments) from public,anon,authenticated,service_role;
