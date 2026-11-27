-- A chamada fornece BEGIN e as duas temporárias espelho_meta/espelho_linhas(registro jsonb).
-- O resultado do ciclo fica em pg_temp.espelho_resultado, na mesma transação.
\set ON_ERROR_STOP on
set local time zone 'UTC';
set local lock_timeout='5s';
set local aurset.espelho_externa='a5c2b03b-1e30-4446-b013-8cb8a9d8c447';

create temporary table espelho_resultado (resumo jsonb not null) on commit drop;
do $$
declare
  meta jsonb;
  n integer;
begin
  if session_user <> 'postgres' or current_user <> 'postgres' or to_regclass('pg_temp.espelho_resultado') is null then
    raise exception 'O espelho exige uma única transação administrativa';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('espelho-externa-elfsight',0)) then
    raise exception 'Consulta concorrente, tente no próximo ciclo';
  end if;
  select registro into strict meta from pg_temp.espelho_meta;
  select count(*) into n from pg_temp.espelho_linhas;
  if (meta->>'planilha') is distinct from '1fqb5vW5Y1vJ7-OCbK6vs8LN2SolXsjjbU5bRt3ESqUc'
     or (meta->>'gid')::integer is distinct from 0 or n=0 or (meta->>'total_linhas')::integer is distinct from n
     or jsonb_typeof(meta->'headers') is distinct from 'array'
     or not (meta->'headers' @> '["Service Name","Start Date","End Date","Booking Page","Name","Phone Number","Email","Booking Date"]') then
    raise exception 'Fonte, cabeçalho ou quantidade não conferem. O espelho anterior foi preservado';
  end if;
  if not exists(select from public.barbershops where id='a5c2b03b-1e30-4446-b013-8cb8a9d8c447'
       and slug='externabarbearia' and timezone='America/Sao_Paulo') then
    raise exception 'Estabelecimento de destino divergente';
  end if;
  if exists(select from pg_temp.espelho_linhas where (registro->>'chave') is null
       or (registro->>'chave') !~ '^[0-9a-f]{64}$' or jsonb_typeof(registro->'bruto') is distinct from 'array'
       or coalesce((registro->>'linha')::integer,0)<2) then
    raise exception 'Linhas de origem inválidas';
  end if;
  if not exists(select from manutencao.espelho_externa_gatilhos where nome='appointments_validate_booking_trg')
     or exists (select from manutencao.espelho_externa_gatilhos g
       left join pg_trigger t on t.tgrelid='public.appointments'::regclass and t.tgname=g.nome
       where t.tgenabled is distinct from 'O' or pg_get_triggerdef(t.oid) is distinct from g.definicao_instalada)
     or exists(select from pg_trigger t where not t.tgisinternal and t.tgrelid='public.appointments'::regclass
       and (t.tgtype::int & 2)=0 and t.tgname not in
       ('capture_appointment_facts','appointments_waiting_restoration','appointments_series_cancel_exception_trg')
       and not exists(select from manutencao.espelho_externa_gatilhos g where g.nome=t.tgname)) then
    raise exception 'Os gatilhos de agenda mudaram; reavaliar os efeitos antes de sincronizar';
  end if;
  insert into manutencao.espelho_externa_fonte(id,gid,cabecalho) values(meta->>'planilha',0,meta->'headers')
    on conflict(id) do update set cabecalho=excluded.cabecalho
    where espelho_externa_fonte.cabecalho is distinct from excluded.cabecalho;
end $$;

create temp table ext_entrada on commit drop as
select registro->>'chave' as chave,(registro->>'linha')::int as linha,(registro->>'legado_n')::int as legado_n,registro
from pg_temp.espelho_linhas;
alter table ext_entrada add primary key(chave), add unique(linha), add unique(legado_n);

-- Identifica o catálogo da carga original pela unidade e pelo profissional.
create temp table ext_catalogo on commit drop as
select lower(sv.name) servico,
  case when lower(st.booking_slug) in ('thiago','tiago') or lower(st.display_name) similar to '(tiago|thiago)%' then 'tiago'
       when lower(st.booking_slug)='ezequiel' or lower(st.display_name) like 'ezequiel%' then 'ezequiel'
       else lower(st.booking_slug) end profissional,
  sv.id service_id,st.id staff_id,coalesce(ss.price_cents,sv.price_cents) preco,
  st.active and sv.active and ss.active as ativo
from public.staff_services ss join public.services sv on sv.id=ss.service_id and sv.barbershop_id=ss.barbershop_id
join public.staff st on st.id=ss.staff_id and st.barbershop_id=ss.barbershop_id
where ss.barbershop_id='a5c2b03b-1e30-4446-b013-8cb8a9d8c447';
create index on ext_catalogo(profissional,servico);

create temp table ext_processar on commit drop as
select i.*,m.chave is null as nova
from ext_entrada i left join manutencao.espelho_externa_linhas m using(chave)
where m.chave is null or not m.presente or m.registro is distinct from i.registro or m.situacao='pendente'
   or (m.agendamento_id is not null and not exists(select from public.appointments a where a.id=m.agendamento_id));
update manutencao.espelho_externa_linhas m set presente=false,modificado_em=now()
where presente and not exists(select from ext_entrada i where i.chave=m.chave);
insert into manutencao.espelho_externa_linhas(chave,registro,legado_n,situacao)
select chave,registro,legado_n,'pendente' from ext_processar
on conflict(chave) do update set registro=excluded.registro,presente=true,modificado_em=now()
where not espelho_externa_linhas.presente or espelho_externa_linhas.registro is distinct from excluded.registro;

do $$
declare
  loja constant uuid := 'a5c2b03b-1e30-4446-b013-8cb8a9d8c447';
  r record; j jsonb; m manutencao.espelho_externa_linhas%rowtype;
  a public.appointments%rowtype; c public.shop_clients%rowtype; anterior public.shop_clients%rowtype;
  fc manutencao.espelho_externa_fichas%rowtype;
  cat record; cat_anterior record;
  inicio timestamptz; fim timestamptz; criado timestamptz;
  tel text; nome text; campo text; causa text; orig jsonb; destino jsonb; base jsonb; real_atual jsonb;
  criar boolean; guardar_ficha boolean; alteracoes text[]; novo_status public.appointment_status;
  criadas int:=0; atualizadas int:=0; novas_fichas int:=0; nomes_atualizados int:=0;
  criou_ficha boolean; mudou_nome boolean; mudou_agenda boolean; existe_legado boolean;
begin
  for r in select * from ext_processar order by (legado_n is null),linha loop
    j:=r.registro;
    select * into strict m from manutencao.espelho_externa_linhas where chave=r.chave;
    causa:=nullif(j->>'motivo','');
    if causa is not null then
      update manutencao.espelho_externa_linhas set
        situacao=case when causa in ('teste','repetido','profissional') and agendamento_id is null then 'excluida' else 'pendente' end,
        motivo=causa,modificado_em=now() where chave=r.chave;
      continue;
    end if;
    criou_ficha:=false; mudou_nome:=false; mudou_agenda:=false;
    begin
      tel:=j->>'telefone'; nome:=nullif(trim(j->>'nome_cliente'),'');
      if tel is null or tel !~ '^\+[1-9][0-9]{7,14}$' or nome is null then raise exception using errcode='P1201',message='cliente_invalido'; end if;
      if exists (select from unnest(array['inicio','fim','criado']) k
                 where coalesce(j->>k,'') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?$') then
        raise exception using errcode='P1201',message='hora_civil_invalida';
      end if;
      inicio:=(j->>'inicio')::timestamp at time zone 'America/Sao_Paulo';
      fim:=(j->>'fim')::timestamp at time zone 'America/Sao_Paulo';
      criado:=(j->>'criado')::timestamp at time zone 'America/Sao_Paulo';
      if fim<=inicio then raise exception using errcode='P1201',message='intervalo_invalido'; end if;
      select * into strict cat from ext_catalogo where profissional=j->>'profissional' and servico=lower(j->>'servico');
      existe_legado:=r.legado_n is not null;
      if existe_legado and m.agendamento_id is null then
        select id into m.agendamento_id from manutencao.importacao_externa where tipo='agendamento' and n=r.legado_n;
        if m.agendamento_id is null then raise exception using errcode='P1201',message='legado_ausente'; end if;
      end if;
      criar:=m.agendamento_id is null;
      a:=null; anterior:=null; orig:=m.origem_aplicada; base:=m.versao_agenda;
      if not criar then
        select * into a from public.appointments where id=m.agendamento_id and barbershop_id=loja for update;
        if not found then raise exception using errcode='P1201',message='reserva_removida_no_sistema'; end if;
        select * into anterior from public.shop_clients where id=a.shop_client_id and barbershop_id=loja;
      elsif exists(select from manutencao.espelho_externa_linhas x where not presente and
        x.registro->>'telefone'=tel and x.agendamento_id is not null) then
        raise exception using errcode='P1201',message='possivel_troca_de_identidade';
      end if;
      if m.legado_n is distinct from r.legado_n then raise exception using errcode='P1201',message='identidade_legada_divergente'; end if;
      if not cat.ativo and (criar or a.service_id is distinct from cat.service_id or a.staff_id is distinct from cat.staff_id)
        then raise exception using errcode='P1201',message='catalogo_inativo'; end if;

      c:=null; guardar_ficha:=false;
      if not criar and anterior.id is not null and
         (anterior.whatsapp_e164=tel or (existe_legado and tel=j->>'telefone_legado') or m.origem_aplicada->>'telefone'=tel) then
        c:=anterior;
      else
        if (select count(*) from public.shop_clients where barbershop_id=loja and whatsapp_e164=tel)>1 then
          raise exception using errcode='P1201',message='vinculo_duplicado';
        end if;
        select * into c from public.shop_clients where barbershop_id=loja and whatsapp_e164=tel for update;
        if c.profile_id is not null or exists(select from public.profiles p join public.memberships mb on mb.user_id=p.id
           where mb.barbershop_id=loja and p.whatsapp_e164=tel) then
          if not criar or not exists(select from manutencao.externa_cruzamento x where x.telefone=tel and x.motivo is null
            and (c.profile_id is null or c.profile_id=x.conta)
            and not exists(select from public.shop_clients outra where outra.barbershop_id=loja and outra.profile_id=x.conta
              and outra.id is distinct from c.id)) then
            raise exception using errcode='P1201',message='telefone_com_conta';
          end if;
        end if;
        if c.id is null then
          insert into public.shop_clients(barbershop_id,full_name,whatsapp_e164,notify_whatsapp)
            values(loja,nome,tel,false) returning * into c;
          criou_ficha:=true; guardar_ficha:=true;
        end if;
      end if;
      if criar and c.profile_id is not null and manutencao.nome_para_conciliacao(c.full_name)
         is distinct from manutencao.nome_para_conciliacao(j->>'nome') then
        raise exception using errcode='P1201',message='identidade_divergente';
      end if;
      if criar and c.profile_id is not null and exists(select from public.appointments ap where ap.shop_client_id=c.id and
        (ap.customer_id is distinct from c.profile_id or not exists(select from manutencao.espelho_externa_linhas el
          where el.agendamento_id=ap.id and el.presente and el.situacao='vinculada' and el.motivo is null and el.registro->>'telefone'=tel))) then
        raise exception using errcode='P1201',message='telefone_com_conta';
      end if;
      select * into fc from manutencao.espelho_externa_fichas where ficha_id=c.id for update;
      if fc.ficha_id is null and (guardar_ficha or (existe_legado and c.whatsapp_e164=tel and
        exists(select from manutencao.importacao_externa where tipo='ficha' and id=c.id))) then
        insert into manutencao.espelho_externa_fichas(ficha_id,telefone,nome_origem,nome_aplicado)
          values(c.id,tel,coalesce(j->>'nome_legado',nome),coalesce(j->>'nome_legado',nome)) returning * into fc;
      end if;
      if fc.ficha_id is not null and fc.nome_origem is distinct from nome then
        update public.shop_clients set full_name=nome where id=c.id and barbershop_id=loja
          and profile_id is null and full_name is not distinct from fc.nome_aplicado and whatsapp_e164=tel;
        if not found then raise exception using errcode='P1201',message='ficha_editada_no_sistema'; end if;
        update manutencao.espelho_externa_fichas set nome_origem=nome,nome_aplicado=nome where ficha_id=c.id;
        mudou_nome:=true;
      end if;

      destino:=jsonb_build_object('shop_client_id',c.id,'telefone',tel,'service_id',cat.service_id,'staff_id',cat.staff_id,
                  'starts_at',inicio,'ends_at',fim,'created_at',criado);
      if criar then
        if exists(select from public.appointments where barbershop_id=loja and shop_client_id=c.id and staff_id=cat.staff_id
                    and starts_at=inicio) then raise exception using errcode='P1201',message='reserva_ja_existe_no_sistema'; end if;
        novo_status:=case when inicio<=statement_timestamp() then 'completed' else 'confirmed' end;
        insert into public.appointments(barbershop_id,service_id,staff_id,shop_client_id,starts_at,ends_at,created_at,booked_price_cents,status)
          values(loja,cat.service_id,cat.staff_id,c.id,inicio,fim,criado,cat.preco,novo_status) returning * into a;
        if a.status='completed' then update public.appointment_facts set finished_at=fim where appointment_id=a.id; end if;
      else
        if orig is null then
          if not existe_legado or anterior.id is null then raise exception using errcode='P1201',message='vinculo_legado_inconclusivo'; end if;
          select * into strict cat_anterior from ext_catalogo where profissional=j->>'profissional_legado' and servico=lower(j->>'servico_legado');
          orig:=jsonb_build_object('shop_client_id',anterior.id,'telefone',j->>'telefone_legado','service_id',cat_anterior.service_id,
                     'staff_id',cat_anterior.staff_id,'starts_at',(j->>'inicio_legado')::timestamptz,
                     'ends_at',(j->>'fim_legado')::timestamptz,'created_at',(j->>'criado_legado')::timestamptz);
          base:=orig;
        end if;
        real_atual:=manutencao.espelho_externa_versao(a);
        alteracoes:='{}';
        foreach campo in array array['shop_client_id','service_id','staff_id','starts_at','ends_at','created_at'] loop
          if destino->campo is distinct from orig->campo and destino->campo is distinct from real_atual->campo then
            if base->campo is distinct from real_atual->campo then
              raise exception using errcode='P1201',message='reserva_editada_no_sistema';
            end if;
            alteracoes:=array_append(alteracoes,campo);
          end if;
        end loop;
        if cardinality(alteracoes)>0 then
          if alteracoes && array['shop_client_id','service_id','staff_id','starts_at','ends_at'] and
            (a.customer_id is not null or a.booked_by is not null or a.series_id is not null or a.status not in ('confirmed','completed','pending')
             or (base ? 'status' and base->>'status' <> a.status::text)) then
            raise exception using errcode='P1201',message='reserva_editada_no_sistema';
          end if;
          update public.appointments set
            shop_client_id=case when 'shop_client_id'=any(alteracoes) then c.id else shop_client_id end,
            staff_id=case when 'staff_id'=any(alteracoes) then cat.staff_id else staff_id end,
            service_id=case when 'service_id'=any(alteracoes) then cat.service_id else service_id end,
            starts_at=case when 'starts_at'=any(alteracoes) then inicio else starts_at end,
            ends_at=case when 'ends_at'=any(alteracoes) then fim else ends_at end,
            created_at=case when 'created_at'=any(alteracoes) then criado else created_at end,
            booked_price_cents=case when 'service_id'=any(alteracoes) then cat.preco else booked_price_cents end
            where id=a.id and barbershop_id=loja returning * into a;
          if a.status='completed' and 'ends_at'=any(alteracoes) then
            update public.appointment_facts set finished_at=fim where appointment_id=a.id and recorded_by is null
              and finished_at=(base->>'ends_at')::timestamptz;
          end if;
          mudou_agenda:=true;
        end if;
      end if;
      -- A base de comparação guarda o que a fonte aplicou. Campos já editados na agenda
      -- continuam divergentes para não serem sobrescritos numa edição futura da planilha.
      real_atual:=manutencao.espelho_externa_versao(a);
      update manutencao.espelho_externa_linhas set agendamento_id=a.id,origem_aplicada=destino,
        versao_agenda=real_atual || (destino-'telefone'),situacao='vinculada',motivo=null,modificado_em=now() where chave=r.chave;
      if criar then criadas:=criadas+1; end if;
      if mudou_agenda then atualizadas:=atualizadas+1; end if;
      if criou_ficha then novas_fichas:=novas_fichas+1; end if;
      if mudou_nome then nomes_atualizados:=nomes_atualizados+1; end if;
    exception
      when sqlstate 'P1201' then causa:=sqlerrm;
      when no_data_found or too_many_rows then causa:='catalogo_ausente_ou_ambiguo';
      when exclusion_violation then causa:='horario_ocupado';
      when unique_violation then causa:='vinculo_duplicado';
      when check_violation or sqlstate '22023' then causa:='regra_de_agenda_ou_cadastro';
    end;
    if causa is not null then
      update manutencao.espelho_externa_linhas set situacao='pendente',motivo=causa,modificado_em=now() where chave=r.chave;
    end if;
  end loop;
  insert into pg_temp.espelho_resultado select jsonb_build_object(
    'linhas',(select count(*) from ext_entrada),'espelhadas',count(*) filter(where presente),'vinculadas',count(*) filter(where presente and situacao='vinculada'),
    'criadas',criadas,'atualizadas',atualizadas,'fichas_criadas',novas_fichas,'fichas_atualizadas',nomes_atualizados,
    'pendentes',count(*) filter(where presente and situacao='pendente'),'ausentes',count(*) filter(where not presente),
    'excluidas_da_agenda',count(*) filter(where presente and situacao='excluida'),
    'pendencias_por_motivo',coalesce((select jsonb_object_agg(p.motivo,p.total) from (
      select l.motivo,count(*) as total from manutencao.espelho_externa_linhas l where l.presente and l.situacao='pendente' group by l.motivo
    ) p),'{}'::jsonb))
  from manutencao.espelho_externa_linhas;
end $$;
-- Após todas as linhas, inclusive nos ciclos sem edição da planilha.
select manutencao.conciliar_historico_externa();
select resumo from pg_temp.espelho_resultado;
