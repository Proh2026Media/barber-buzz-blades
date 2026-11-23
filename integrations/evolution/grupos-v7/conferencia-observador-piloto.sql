-- Consulta interna. O cruzamento funciona mesmo se o celular receber antes do retorno do envio.
create or replace view evolution_api.bc_conferencia_envios_piloto as
select o."groupJid" as grupo, o."messageId" as mensagem, o."operationKey" as operacao, c.data->>'cycleId' as ciclo, o.state as aceite,
 o."updatedAt" as aceito_em, observado.instante as observado_em, recibo.instante as recibo_em,
 case when observado.instante is not null then 'observado_pelo_outro_numero'
 when recibo.instante is not null then 'recibo_do_outro_numero' else 'aguardando_observacao' end as situacao
from evolution_api."BcGroupOperation" o
join evolution_api."BcGroupCycle" c using ("groupJid")
left join lateral (
 select min(to_timestamp(m."messageTimestamp")) as instante
 from evolution_api."Message" m join evolution_api."Instance" i on i.id=m."instanceId"
 where m.key->>'remoteJid'=o."groupJid" and m.key->>'id'=o."messageId"
 and m.key->>'fromMe'='false'
 and c.data::jsonb->'platformJids' ? i."ownerJid"
 and exists(select 1 from jsonb_array_elements_text(c.data::jsonb->'platformJids') a(jid)
 where a.jid<>i."ownerJid" and a.jid=case
 when m.key->>'participant' like '%@s.whatsapp.net' then m.key->>'participant'
 when m.key->>'participant' like '%@lid' then m.key->>'participantAlt' end)
 and (length(trim(m.message->>'conversation'))>0 or length(trim(m.message->'extendedTextMessage'->>'text'))>0)
) observado on true
left join lateral (
 select min(e."createdAt" at time zone 'UTC') as instante from evolution_api."BcGroupEvidence" e
 where e."groupJid"=o."groupJid" and e."messageId"=o."messageId" and e.author<>e.observer
 and c.data::jsonb->'platformJids' ? e.author and c.data::jsonb->'platformJids' ? e.observer
) recibo on true
where c.data->'brand'->>'slug'='loja-teste-b'
and o.state in ('code_accepted','message_accepted','notice_accepted') and o."messageId" is not null;
revoke all on evolution_api.bc_conferencia_envios_piloto from public;

-- Persiste apenas o comprovante. Reentrega e chegada fora de ordem não o duplicam.
create table evolution_api.bc_log_observacao_piloto (
 grupo text not null, mensagem text not null, operacao text not null,
 ciclo text, observado_em timestamptz, recibo_em timestamptz, registrado_em timestamptz not null default clock_timestamp(),
 primary key(grupo,mensagem,operacao)
);
revoke all on evolution_api.bc_log_observacao_piloto from public;
create function evolution_api.bc_registrar_observacao_piloto() returns trigger
language plpgsql set search_path=evolution_api as $$
declare jid text; chave text;
begin
 if tg_table_name='Message' then
  jid:=new.key->>'remoteJid'; chave:=new.key->>'id';
 else
  jid:=new."groupJid"; chave:=new."messageId";
 end if;
 -- Serializa os dois caminhos para enxergar o commit anterior em READ COMMITTED.
 if chave is null or not exists(select 1 from "BcGroupCycle" c where c."groupJid"=jid
 and c.data->'brand'->>'slug'='loja-teste-b') then return null; end if;
 perform pg_advisory_xact_lock(hashtextextended(jid||'/'||chave,2311));
 insert into bc_log_observacao_piloto(grupo,mensagem,operacao,ciclo,observado_em,recibo_em)
 select grupo,mensagem,operacao,ciclo,observado_em,recibo_em from bc_conferencia_envios_piloto
 where grupo=jid and mensagem=chave and (observado_em is not null or recibo_em is not null)
 on conflict(grupo,mensagem,operacao) do update set
 observado_em=coalesce(bc_log_observacao_piloto.observado_em,excluded.observado_em),
 recibo_em=coalesce(bc_log_observacao_piloto.recibo_em,excluded.recibo_em);
 return null;
end $$;
create trigger bc_observar_texto_piloto after insert or update of message,key on evolution_api."Message"
for each row when(new.key->>'fromMe'='false' and new.key->>'remoteJid' like '%@g.us')
execute function evolution_api.bc_registrar_observacao_piloto();
create trigger bc_observar_recibo_piloto after insert on evolution_api."BcGroupEvidence"
for each row when(new.author<>new.observer)
execute function evolution_api.bc_registrar_observacao_piloto();
create trigger bc_observar_aceite_piloto after insert or update of state,"messageId" on evolution_api."BcGroupOperation"
for each row when(new.state in ('message_accepted','code_accepted','notice_accepted') and new."messageId" is not null)
execute function evolution_api.bc_registrar_observacao_piloto();
insert into evolution_api.bc_log_observacao_piloto(grupo,mensagem,operacao,ciclo,observado_em,recibo_em)
select grupo,mensagem,operacao,ciclo,observado_em,recibo_em from evolution_api.bc_conferencia_envios_piloto
where observado_em is not null or recibo_em is not null on conflict do nothing;
