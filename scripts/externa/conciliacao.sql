-- Instalar depois de instalar.sql; funções e dados de identidade ficam privados.
create or replace function manutencao.nome_para_conciliacao(text) returns text
language sql immutable strict parallel safe set search_path='' as $$
  select trim(regexp_replace(translate(lower($1),
    'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn'), '[[:space:]]+', ' ', 'g'))
$$;

create table if not exists manutencao.externa_historico_vinculado (
  reserva uuid primary key, ficha uuid not null, conta uuid not null,
  criterio text not null, vinculado_em timestamptz not null default now()
);
create table if not exists manutencao.externa_historico_revisao (
  telefone text primary key, linha integer not null, motivo text not null
);
revoke all on manutencao.externa_historico_vinculado, manutencao.externa_historico_revisao
  from public, anon, authenticated, service_role;

-- Toda linha da pessoa participa da decisão, inclusive uma linha ainda em revisão.
-- O nome original da reserva não é o nome que o importador elegeu para a ficha do balcão.
create or replace view manutencao.externa_cruzamento as
with linhas as materialized (
  select l.registro->>'telefone' telefone, lower(trim(coalesce(l.registro->>'email',''))) email,
    manutencao.nome_para_conciliacao(coalesce(l.registro->>'nome','')) nome,
    (l.registro->>'linha')::integer linha
  from manutencao.espelho_externa_linhas l
  where l.presente and l.situacao<>'excluida' and
    coalesce(l.registro->>'motivo','') not in ('teste','profissional','repetido')
), grupos as (
  select telefone,min(linha) linha,array_agg(distinct nome) nomes,array_remove(array_agg(distinct email),'') emails,
    bool_and(email<>'') email_em_todas
  from linhas where telefone ~ '^\+[1-9][0-9]{7,14}$' group by telefone
), compartilhados as (
  select email from linhas where email<>'' group by email having count(distinct telefone)>1 or bool_or(telefone is null)
), identidades as (
  select u.id conta,manutencao.nome_para_conciliacao(coalesce(p.full_name,'')) nome,
    case when u.email_confirmed_at is not null then nullif(lower(trim(u.email)),'') end email,
    case when p.whatsapp_verified_at is not null then p.whatsapp_e164 end tel_perfil,
    case when u.phone_confirmed_at is not null and u.phone ~ '^\+?[1-9][0-9]{7,14}$'
      then '+'||ltrim(u.phone,'+') end tel_auth,
    (u.banned_until is null or u.banned_until<=now()) and exists(select from public.memberships m where m.user_id=u.id and m.role='customer'
      and m.barbershop_id='a5c2b03b-1e30-4446-b013-8cb8a9d8c447') as cliente
  from auth.users u left join public.profiles p on p.id=u.id
  where u.deleted_at is null and u.is_anonymous is not true
), candidatos as (
  select g.*,i.*, coalesce(i.email=any(g.emails),false) email_ok,
    coalesce(g.telefone in (i.tel_perfil,i.tel_auth),false) tel_ok,
    i.nome=g.nomes[1] and i.nome ~ '^[[:alpha:]][[:alpha:]’''-]+( [[:alpha:]][[:alpha:]’''-]*)+$'
      and (select count(*) from unnest(string_to_array(i.nome,' ')) palavra
        where length(palavra)>=2 and palavra not in ('da','das','de','do','dos','e'))>=2 nome_ok,
    count(*) over(partition by telefone) contas, count(*) over(partition by conta) fichas
  from grupos g join identidades i on i.email=any(g.emails) or g.telefone in (i.tel_perfil,i.tel_auth)
), evidencias as (
  -- O e-mail vale como prova para a ficha inteira apenas se estiver em cada reserva.
  -- O mesmo telefone confirmado em duas tabelas continua valendo um único ponto.
  select c.*, email_ok and email_em_todas email_comum from candidatos c
), regras as (
  select c.*, case
    when contas<>1 or fichas<>1 or exists(select from compartilhados x where x.email=any(c.emails))
      then 'contato_compartilhado'
    when cardinality(nomes)<>1 or cardinality(emails)>1 or nomes[1]='' or (nome<>'' and nome<>nomes[1])
      then 'identidade_divergente'
    when (email is not null and emails[1]<>'' and not email_ok)
      or (tel_perfil is not null and tel_perfil<>telefone) or (tel_auth is not null and tel_auth<>telefone)
      then 'contato_divergente'
    when email_comum::int + tel_ok::int + nome_ok::int < 2
      then 'prova_insuficiente'
  end motivo
  from evidencias c where cliente
)
select telefone,linha,conta,motivo,case when motivo is null then
  case when email_comum and tel_ok then 'email_telefone' when email_comum then 'email_nome' else 'telefone_nome' end
end criterio from regras;
revoke all on manutencao.externa_cruzamento from public, anon, authenticated, service_role;

-- O vinculador legado continua atendendo fichas nativas. Fichas do espelho passam
-- exclusivamente pela conciliação, inclusive no ingresso via membership e nas confirmações antigas.
do $$
declare
  definicao text := pg_get_functiondef('public.link_shop_clients_to_profile(uuid,text,uuid)'::regprocedure);
  origem constant text := 'and (p_shop_id is null or sc.barbershop_id = p_shop_id)';
  regra constant text := $trecho$
      and not (sc.barbershop_id='a5c2b03b-1e30-4446-b013-8cb8a9d8c447' and exists (
        select from manutencao.espelho_externa_linhas hist where
          hist.origem_aplicada->>'shop_client_id'=sc.id::text or hist.registro->>'telefone'=sc.whatsapp_e164
          or hist.agendamento_id in (select a.id from public.appointments a where a.shop_client_id=sc.id)
          or exists(select from public.shop_clients destino where destino.barbershop_id=sc.barbershop_id
            and destino.profile_id=p_user_id and hist.origem_aplicada->>'shop_client_id'=destino.id::text)
      ))$trecho$;
begin
  if strpos(definicao,regra)=0 then
    if array_length(string_to_array(definicao,origem),1)<>2 then raise exception 'Revisar o vinculador de fichas antes de instalar'; end if;
    execute replace(definicao,origem,origem||regra);
  end if;
end $$;

create or replace function manutencao.conciliar_historico_externa() returns void
language plpgsql set search_path='' as $$
declare
  loja constant uuid:='a5c2b03b-1e30-4446-b013-8cb8a9d8c447';
  r record; c public.shop_clients%rowtype; v_conta uuid; motivo text; v_criterio text; total integer; atualizou boolean:=false;
begin
  if session_user<>'postgres' or current_user<>'postgres' then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(hashtextextended('espelho-externa-elfsight',0));
  -- O marcador operacional só vigora enquanto a atualização de histórico é executada.
  if current_setting('aurset.espelho_externa',true) is distinct from loja::text then
    raise exception 'Executar no ciclo do espelho da Externa';
  end if;
  delete from manutencao.externa_historico_revisao;
  for r in select x.telefone,min(x.linha) linha,array_agg(x.conta order by x.conta) contas,
    min(x.motivo) motivo,min(x.criterio) criterio from manutencao.externa_cruzamento x group by x.telefone order by x.telefone loop
    -- Um grupo já atribuído ao próprio titular não precisa ser reivindicado novamente.
    if not exists(select from manutencao.espelho_externa_linhas l
      left join public.appointments a on a.id=l.agendamento_id and a.barbershop_id=loja
      left join public.shop_clients f on f.id=a.shop_client_id and f.barbershop_id=loja
      where l.presente and l.situacao<>'excluida' and l.registro->>'telefone'=r.telefone
      and (a.customer_id is distinct from r.contas[1] or f.profile_id is distinct from a.customer_id
        or cardinality(r.contas)<>1 or (r.motivo is not null and exists(
          select from manutencao.externa_historico_vinculado v where v.reserva=a.id)))) then continue; end if;
    v_conta:=r.contas[1]; motivo:=r.motivo; v_criterio:=r.criterio;
    if motivo is null then
      perform 1 from auth.users u join public.profiles p on p.id=u.id join public.memberships m on m.user_id=u.id
        where u.id=v_conta and m.barbershop_id=loja and m.role='customer' for share of u,p,m;
      if not found then motivo:='contato_divergente'; end if;
    end if;
    if motivo is null then
      select count(*) into total from public.shop_clients f where f.barbershop_id=loja and f.whatsapp_e164=r.telefone;
      if total<>1 then motivo:='ficha_em_revisao';
      else
        select * into strict c from public.shop_clients f where f.barbershop_id=loja and f.whatsapp_e164=r.telefone for update;
        perform 1 from public.appointments a where a.barbershop_id=loja and a.shop_client_id=c.id order by a.id for update;
        if (c.profile_id is not null and c.profile_id<>v_conta) or exists(select from public.shop_clients f
          where f.barbershop_id=loja and f.profile_id=v_conta and f.id<>c.id)
          or exists(select from public.appointments a where a.shop_client_id=c.id and a.customer_id is not null and a.customer_id<>v_conta)
          then motivo:='ficha_com_titular';
        elsif exists(select from public.appointments a where a.shop_client_id=c.id and not exists(
          select from manutencao.espelho_externa_linhas l where l.agendamento_id=a.id and l.presente and l.situacao='vinculada'
          and l.motivo is null and l.registro->>'telefone'=r.telefone and l.origem_aplicada->>'shop_client_id'=c.id::text
          and manutencao.nome_para_conciliacao(l.registro->>'nome')=manutencao.nome_para_conciliacao(c.full_name)))
          or exists(select from manutencao.espelho_externa_linhas l left join public.appointments a on a.id=l.agendamento_id
            where l.presente and l.situacao<>'excluida' and l.registro->>'telefone'=r.telefone and
            (l.situacao<>'vinculada' or l.motivo is not null or a.barbershop_id is distinct from loja or a.shop_client_id is distinct from c.id))
          or exists(select from manutencao.externa_historico_vinculado v join public.appointments a on a.id=v.reserva
            where a.shop_client_id=c.id and (v.ficha<>c.id or v.conta<>v_conta or a.customer_id is distinct from v.conta))
          then motivo:='ficha_em_revisao';
        end if;
      end if;
    end if;
    if motivo is not null then
      insert into manutencao.externa_historico_revisao values(r.telefone,r.linha,motivo);
      continue;
    end if;
    begin
      update public.shop_clients set profile_id=v_conta where id=c.id and profile_id is null;
      with movidas as (
        update public.appointments set customer_id=v_conta
        where barbershop_id=loja and shop_client_id=c.id and customer_id is null returning id
      ) insert into manutencao.externa_historico_vinculado(reserva,ficha,conta,criterio)
        select id,c.id,v_conta,v_criterio from movidas;
      if found then atualizou:=true; end if;
    exception when integrity_constraint_violation or sqlstate '22023' then
      insert into manutencao.externa_historico_revisao values(r.telefone,r.linha,'ficha_em_revisao');
    end;
  end loop;
  if atualizou then
    -- Um sinal sem identificadores de clientes faz o app aberto reler a própria agenda.
    insert into public.availability_signals(barbershop_id) values(loja);
  end if;
end $$;
revoke all on function manutencao.nome_para_conciliacao(text), manutencao.conciliar_historico_externa()
  from public, anon, authenticated, service_role;
