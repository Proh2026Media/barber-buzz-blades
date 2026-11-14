-- Nº 112 — eventos nativos de configuração não são prova de divergência.
-- Não ignorar todos os eventos durante um lease/janela: uma remoção pode ser real.
-- Aceitar somente deltas explícitos que reforçam controles ou mudam só o nome.
-- Não ativa grupo, não renova observação, não concede consentimento e não cria convite.
begin;

create or replace function public.care_group_event(p_instance text,p_group_jid text,p_event_key text,p_kind text,
  p_sender text default null,p_stop text default null,p_from_me boolean default false) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  return public.care_group_event_before_integration(p_instance,p_group_jid,p_event_key,
    case when p_kind='group.join-request' then 'group-participants.update' else p_kind end,
    p_sender,p_stop,case when p_kind='messages.upsert' then p_from_me else false end);
end $$;

create function public.care_group_metadata_event(p_instance text,p_group_jid text,p_event_key text,p_update jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_group uuid; v_safe boolean := false; v_inserted integer;
begin
  -- Lista fechada conferida no emitGroupUpdate da revisão Baileys usada pela Evolution.
  -- author/authorPn são apenas metadados, nunca prova de autorização.
  if jsonb_typeof(p_update)='object' then
    v_safe := p_update->>'id'=p_group_jid
      and not exists(select 1 from jsonb_object_keys(p_update) k where k not in
        ('id','author','authorPn','subject','restrict','memberAddMode','joinApprovalMode'))
      and p_update ?| array['subject','restrict','memberAddMode','joinApprovalMode']
      and (not p_update ? 'subject' or (jsonb_typeof(p_update->'subject')='string' and length(p_update->>'subject') between 1 and 256))
      and (not p_update ? 'restrict' or p_update->'restrict'='true'::jsonb)
      and (not p_update ? 'memberAddMode' or p_update->'memberAddMode'='false'::jsonb)
      and (not p_update ? 'joinApprovalMode' or p_update->'joinApprovalMode'='true'::jsonb)
      and (not p_update ? 'author' or jsonb_typeof(p_update->'author') in ('string','null'))
      and (not p_update ? 'authorPn' or jsonb_typeof(p_update->'authorPn') in ('string','null'));
  end if;
  if v_safe is not true then
    -- Campo novo, snapshot completo, downgrade, participante ou evento incompleto:
    -- interromper mesmo durante execução e mesmo que o envelope alegue fromMe.
    return public.care_group_event(p_instance,p_group_jid,p_event_key,'groups.update');
  end if;
  select g.id into v_group from public.whatsapp_care_groups g
    join public.whatsapp_group_accounts a on a.id=g.account_id
    join public.whatsapp_channels n on n.id=a.channel_id
    where g.group_jid=p_group_jid and n.instance_name=p_instance for update of g;
  if v_group is null or p_event_key is null or length(p_event_key)>128 then return false; end if;
  -- Mesma trava e chave de deduplicação do caminho conservador. Não gravar payload/nome.
  insert into public.whatsapp_care_events(event_key,group_id,kind)
    values(p_event_key,v_group,'groups.update.safe') on conflict do nothing;
  get diagnostics v_inserted=row_count;
  return v_inserted>0;
end $$;
revoke all on function public.care_group_metadata_event(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.care_group_metadata_event(text,text,text,jsonb) to service_role;
comment on function public.care_group_metadata_event(text,text,text,jsonb) is
  'Nº 112: registra deltas restritivos/renomeação sem reativar estado; qualquer ambiguidade invalida.';
commit;
