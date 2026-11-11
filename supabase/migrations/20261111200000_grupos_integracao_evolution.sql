-- Nº 107. Integração LOCAL com bc-groups-v1. Depende das nº 105/106, ainda não instaladas.
-- Não liga a flag nem agenda operações. Não executa qualquer chamada externa.
alter table public.whatsapp_care_operations add column provider_creation_started boolean not null default false;
alter table public.whatsapp_care_groups add column entry_pending boolean not null default true;
update public.whatsapp_care_groups set entry_pending=false where use_group or state in ('closed','customer_left');
alter table public.whatsapp_care_participants add column approved_phone text
  check(approved_phone ~ '^\+[1-9][0-9]{7,14}$');
-- Identidade é registrada na aprovação, não reconstruída posteriormente pela identidade atual.
create function public.care_participant_capture_identity() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.approved_at is not null and (tg_op='INSERT' or new.approved_at is distinct from old.approved_at) then
    select whatsapp_e164 into new.approved_phone from public.profiles
      where id=new.user_id and whatsapp_verified_at is not null;
    if new.approved_phone is null then raise exception 'GROUP_PHONE_REQUIRED'; end if;
  end if;
  return new;
end $$;
create trigger care_participant_capture_identity before insert or update of approved_at
  on public.whatsapp_care_participants for each row execute function public.care_participant_capture_identity();
revoke all on function public.care_participant_capture_identity() from public,anon,authenticated,service_role;

create function public.authorize_care_group_step(p_operation uuid,p_token uuid,p_action text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_care_operations%rowtype; g public.whatsapp_care_groups%rowtype;
  n public.whatsapp_channels%rowtype; platforms text[]; approved text[]; removed text[];
begin
  if p_action not in ('create','configure','participants','invite','observe','close') then raise exception 'GROUP_INVALID'; end if;
  select * into o from public.whatsapp_care_operations where id=p_operation and lease_token=p_token
    and state='running' and lease_until>now() for update;
  if o.id is null then raise exception 'GROUP_STALE'; end if;
  select * into g from public.whatsapp_care_groups where id=o.group_id for update;
  if g.version<>o.version or g.reason='operator_pause' or not (select enrollment_enabled from public.whatsapp_group_settings)
    or (o.kind='close' and (p_action<>'close' or g.state<>'closed'))
    or (o.kind<>'close' and (p_action='close' or g.revoked_at is not null or g.state in ('closed','customer_left','creation_unknown')))
    or (p_action='create' and g.group_jid is not null) then raise exception 'GROUP_STALE'; end if;
  select n0.* into n from public.whatsapp_group_accounts a join public.whatsapp_channels n0 on n0.id=a.channel_id
    where a.id=g.account_id and a.id=any(g.approved_accounts) and a.enabled and a.barbershop_id=g.barbershop_id
      and g.approved_account_identities->a.id::text=jsonb_build_object('phone',n0.display_phone,'instance',n0.instance_name);
  if n.id is null or n.status<>'open' or public.whatsapp_sending_paused(n.instance_name,false) then raise exception 'GROUP_STALE'; end if;
  if exists(select 1 from unnest(g.approved_accounts) expected(id) left join public.whatsapp_group_accounts a on a.id=expected.id
      left join public.whatsapp_channels c on c.id=a.channel_id
      where a.id is null or not a.enabled or a.barbershop_id<>g.barbershop_id or
        g.approved_account_identities->a.id::text is distinct from jsonb_build_object('phone',c.display_phone,'instance',c.instance_name)) then raise exception 'GROUP_STALE'; end if;
  select array_agg('+'||regexp_replace(c.display_phone,'[^0-9]','','g')) into platforms
    from public.whatsapp_group_accounts a join public.whatsapp_channels c on c.id=a.channel_id where a.id=any(g.approved_accounts);
  if platforms is null or array_length(platforms,1)<>(select count(distinct x) from unnest(platforms) x)
    or g.customer_phone=any(platforms) then raise exception 'GROUP_INVALID'; end if;
  if o.kind<>'close' and not exists(select 1 from public.profiles where id=g.customer_id and whatsapp_e164=g.customer_phone and whatsapp_verified_at is not null) then raise exception 'GROUP_STALE'; end if;
  if o.kind<>'close' and exists(select 1 from public.whatsapp_care_participants p join public.profiles u on u.id=p.user_id
    where p.group_id=g.id and p.approved_at is not null and p.revoked_at is null and
      (p.approved_phone is null or u.whatsapp_e164 is distinct from p.approved_phone or not public.care_group_member_valid(g.id,p.user_id))) then raise exception 'GROUP_STALE'; end if;
  select coalesce(array_agg(p.approved_phone),'{}') into approved from public.whatsapp_care_participants p
    where p.group_id=g.id and p.approved_at is not null and p.revoked_at is null and p.approved_phone is not null
      and public.care_group_member_valid(g.id,p.user_id);
  select coalesce(array_agg(distinct p.approved_phone),'{}') into removed from public.whatsapp_care_participants p
    where p.group_id=g.id and p.approved_phone is not null;
  if exists(select 1 from unnest(removed) phone where phone=any(platforms) or phone=g.customer_phone)
    or array_length(approved,1)<>(select count(distinct x) from unnest(approved) x) then raise exception 'GROUP_INVALID'; end if;
  if p_action='create' then
    if o.provider_creation_started then raise exception 'GROUP_STALE'; end if;
    update public.whatsapp_care_operations set provider_creation_started=true where id=o.id;
  end if;
  return jsonb_build_object('id',o.id,'token',o.lease_token,'instance',n.instance_name,'group_jid',g.group_jid,
    'subject','Atendimento · Barba & Cabelo','kind',o.kind,'platform_phones',platforms,'customer_phone',g.customer_phone,
    'approved_phones',approved,'removable_phones',removed,'use_group',g.use_group,'entry_pending',g.entry_pending);
end $$;

create or replace function public.claim_care_group_operation(p_operation uuid,p_capable boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_care_operations%rowtype; g public.whatsapp_care_groups%rowtype;
  a public.whatsapp_group_accounts%rowtype; n public.whatsapp_channels%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  select * into o from public.whatsapp_care_operations where id=p_operation for update;
  if o.id is null or o.state not in ('pending','blocked') or o.started_at is not null then return null; end if;
  select * into g from public.whatsapp_care_groups where id=o.group_id for update;
  if g.version<>o.version or (g.state in ('customer_left','creation_unknown') or (g.state='closed' and o.kind<>'close')) then return null; end if;
  if g.reason='operator_pause' then return null; end if;
  if g.group_jid is null and exists(select 1 from public.whatsapp_care_operations previous
      where previous.group_id=g.id and previous.started_at is not null) then
    update public.whatsapp_care_groups set state='creation_unknown',controls_verified=false,reason='operation_unknown' where id=g.id;
    update public.whatsapp_care_operations set state='blocked' where id=o.id;
    return null;
  end if;
  if not (select enrollment_enabled from public.whatsapp_group_settings) or p_capable is distinct from true
    or o.kind not in ('create','reconcile','remove','close') then
    update public.whatsapp_care_operations set state='blocked' where id=o.id;
    update public.whatsapp_care_groups set reason='capabilities_unavailable' where id=g.id;
    return null;
  end if;
  select a0.* into a from public.whatsapp_group_accounts a0 join public.whatsapp_channels n0 on n0.id=a0.channel_id
    where a0.id=any(g.approved_accounts) and a0.barbershop_id=g.barbershop_id and a0.enabled
      and (g.account_id is null or a0.id=g.account_id)
      and g.approved_account_identities->a0.id::text=jsonb_build_object('phone',n0.display_phone,'instance',n0.instance_name)
    order by a0.authorized_at,a0.id limit 1;
  select * into n from public.whatsapp_channels where id=a.channel_id;
  if exists(select 1 from public.whatsapp_care_operations x join public.whatsapp_care_groups y on y.id=x.group_id where y.account_id=a.id and x.state='running' and x.lease_until>now()) then return null; end if;
  if a.id is null or n.status<>'open' or public.whatsapp_sending_paused(n.instance_name,false) then return null; end if;
  if o.kind<>'close' and not exists(select 1 from public.profiles where id=g.customer_id and whatsapp_e164=g.customer_phone and whatsapp_verified_at is not null) then return null; end if;
  -- Uma operação ganha posse, mas a autorização de criação não pode ser recuperada após incerteza.
  update public.whatsapp_care_operations set state='running',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',started_at=now()
    where id=o.id returning * into o;
  update public.whatsapp_care_groups set account_id=a.id,state=case when group_jid is null then 'creating' else state end where id=g.id;
  return public.authorize_care_group_step(o.id,o.lease_token,case when o.kind='close' then 'close' else 'observe' end);
end $$;

create function public.complete_care_group_operation(p_operation uuid,p_token uuid,p_snapshot jsonb,p_invite text default null) returns void
language plpgsql security definer set search_path=public as $$
declare context jsonb; o public.whatsapp_care_operations%rowtype; g public.whatsapp_care_groups%rowtype;
begin
  select * into o from public.whatsapp_care_operations where id=p_operation;
  context:=public.authorize_care_group_step(p_operation,p_token,case when o.kind='close' then 'close' else 'observe' end);
  select * into g from public.whatsapp_care_groups where id=o.group_id for update;
  if p_snapshot->>'id' is distinct from g.group_jid or jsonb_typeof(p_snapshot->'participants') is distinct from 'array' then raise exception 'GROUP_INVALID'; end if;
  if o.kind='close' then
    if jsonb_array_length(p_snapshot->'participants')=0 or exists(select 1 from jsonb_array_elements(p_snapshot->'participants') m
      where m->>'jid' is null or m->>'jid' !~ '^[1-9][0-9]{7,14}@s\.whatsapp\.net$'
        or not (context->'platform_phones' ? ('+'||split_part(m->>'jid','@',1)))) then raise exception 'GROUP_REMOVAL_UNCONFIRMED'; end if;
    delete from public.whatsapp_care_invites where group_id=g.id;
    update public.whatsapp_care_groups set entry_pending=false,controls_verified=false,observed_at=now(),observed_participants=p_snapshot->'participants',reason='closed_confirmed' where id=g.id;
    update public.whatsapp_care_operations set state='accepted' where id=o.id;
    insert into public.whatsapp_care_audit(group_id,action) values(g.id,'closed_confirmed');
    return;
  end if;
  perform public.observe_care_group(p_operation,p_token,p_snapshot);
  if g.entry_pending and g.revoked_at is null then
    update public.whatsapp_care_groups set state='waiting_customer' where id=g.id and state='customer_left' and controls_verified;
  end if;
  update public.whatsapp_care_groups set entry_pending=false where id=o.group_id and state in ('active','customer_left','closed');
  select * into g from public.whatsapp_care_groups where id=o.group_id;
  delete from public.whatsapp_care_invites where group_id=g.id;
  if p_invite is not null then
    if g.state<>'waiting_customer' or not g.controls_verified or g.revoked_at is not null or not g.entry_pending
      or p_invite !~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{10,100}$' then raise exception 'GROUP_INVITE_UNAVAILABLE'; end if;
    insert into public.whatsapp_care_invites(group_id,invite_url,expires_at,version)
      values(g.id,p_invite,now()+interval '10 minutes',g.version);
  end if;
end $$;

-- Recuperação guarda o ID mesmo se houve revogação. Não restaura consentimento ou ativa grupo.
create function public.care_group_recovery_context(p_operation uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_care_operations%rowtype; g public.whatsapp_care_groups%rowtype; n public.whatsapp_channels%rowtype;
begin
  select * into o from public.whatsapp_care_operations where id=p_operation and started_at is not null and provider_creation_started and kind in ('create','reconcile')
    and (state='unknown' or (state='running' and lease_until<=now()));
  if o.id is null then return null; end if;
  select * into g from public.whatsapp_care_groups where id=o.group_id;
  if g.group_jid is not null then return null; end if;
  select c.* into n from public.whatsapp_group_accounts a join public.whatsapp_channels c on c.id=a.channel_id
    where a.id=g.account_id and g.approved_account_identities->a.id::text=jsonb_build_object('phone',c.display_phone,'instance',c.instance_name);
  if n.id is null then return null; end if;
  return jsonb_build_object('id',o.id,'instance',n.instance_name,'subject','Atendimento · Barba & Cabelo');
end $$;
create function public.recover_care_group_creation(p_operation uuid,p_group_jid text) returns void
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_care_operations%rowtype;
begin
  select * into o from public.whatsapp_care_operations where id=p_operation for update;
  if public.care_group_recovery_context(p_operation) is null or p_group_jid is null or p_group_jid !~ '^[0-9-]+@g\.us$' then raise exception 'GROUP_STALE'; end if;
  update public.whatsapp_care_groups set group_jid=p_group_jid,controls_verified=false,
    state=case when state in ('closed','customer_left') then state else 'paused_unavailable' end,reason='recovered_review_required',version=version+1
    where id=o.group_id and group_jid is null;
  if not found then raise exception 'GROUP_STALE'; end if;
  insert into public.whatsapp_care_audit(group_id,action) values(o.group_id,'creation_recovered');
end $$;

-- Pedidos de entrada apenas solicitam leitura autoritativa. O webhook não aprova ninguém.
alter function public.care_group_event(text,text,text,text,text,text,boolean) rename to care_group_event_before_integration;
create function public.care_group_event(p_instance text,p_group_jid text,p_event_key text,p_kind text,
  p_sender text default null,p_stop text default null,p_from_me boolean default false) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  return public.care_group_event_before_integration(p_instance,p_group_jid,p_event_key,
    case when p_kind='group.join-request' then 'group-participants.update' else p_kind end,p_sender,p_stop,p_from_me);
end $$;
revoke all on function public.care_group_event_before_integration(text,text,text,text,text,text,boolean) from public,anon,authenticated,service_role;
revoke all on function public.authorize_care_group_step(uuid,uuid,text),public.complete_care_group_operation(uuid,uuid,jsonb,text),
  public.care_group_recovery_context(uuid),public.recover_care_group_creation(uuid,text),
  public.care_group_event(text,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.authorize_care_group_step(uuid,uuid,text),public.complete_care_group_operation(uuid,uuid,jsonb,text),
  public.care_group_recovery_context(uuid),public.recover_care_group_creation(uuid,text),
  public.care_group_event(text,text,text,text,text,text,boolean) to service_role;

-- Invocação pelo worker de serviço; nenhuma tarefa agendada é instalada aqui.
create function public.queue_care_group_reconciliation() returns jsonb
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype; ids jsonb;
begin
  if not (select enrollment_enabled from public.whatsapp_group_settings) then return '[]'::jsonb; end if;
  for g in select * from public.whatsapp_care_groups x where x.group_jid is not null
    and x.state in ('active','waiting_customer') and x.reason<>'operator_pause'
    and (x.observed_at is null or x.observed_at<now()-interval '30 seconds')
    and not exists(select 1 from public.whatsapp_care_operations o where o.group_id=x.id and
      ((o.state='running' and o.lease_until>now()) or (o.version=x.version and o.state in ('pending','blocked') and o.started_at is null)))
    order by x.observed_at nulls first,x.id limit 5 for update skip locked loop
    update public.whatsapp_care_groups set version=version+1,controls_verified=false where id=g.id;
    insert into public.whatsapp_care_operations(group_id,kind,version) values(g.id,'reconcile',g.version+1) on conflict do nothing;
  end loop;
  select coalesce(jsonb_agg(id),'[]') into ids from (select o.id from public.whatsapp_care_operations o
    join public.whatsapp_care_groups g on g.id=o.group_id where g.version=o.version and o.state in ('pending','blocked')
      and o.started_at is null and g.reason<>'operator_pause'
      and (g.state not in ('closed','customer_left','creation_unknown') or (g.state='closed' and o.kind='close'))
    order by o.created_at,o.id limit 5) todo;
  return ids;
end $$;
revoke all on function public.queue_care_group_reconciliation() from public,anon,authenticated;
grant execute on function public.queue_care_group_reconciliation() to service_role;

-- Voltar é consentimento explícito novo, separado do histórico que impede fallback individual.
alter function public.care_group_customer_update(uuid,bigint,text,jsonb) rename to care_group_customer_update_before_integration;
create function public.care_group_customer_update(p_group uuid,p_version bigint,p_action text,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  perform public.care_group_customer_update_before_integration(p_group,p_version,p_action,p_values);
  if p_action in ('rejoin','close') then
    update public.whatsapp_care_groups set entry_pending=p_action='rejoin' where id=p_group and customer_id=auth.uid();
  end if;
  return public.care_group_read((select barbershop_id from public.whatsapp_care_groups where id=p_group));
end $$;
revoke all on function public.care_group_customer_update_before_integration(uuid,bigint,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.care_group_customer_update(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.care_group_customer_update(uuid,bigint,text,jsonb) to authenticated;

-- Evidência negativa de saída não espera a reconciliação, nem reativa por chegada posterior.
create function public.care_group_removed_members(p_instance text,p_group_jid text,p_event_key text,p_jids jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;
begin
  if jsonb_typeof(p_jids) is distinct from 'array' or jsonb_array_length(p_jids)>50 or p_event_key is null or length(p_event_key)>128 then raise exception 'GROUP_INVALID'; end if;
  select g0.* into g from public.whatsapp_care_groups g0 join public.whatsapp_group_accounts a on a.id=g0.account_id
    join public.whatsapp_channels n on n.id=a.channel_id where g0.group_jid=p_group_jid and n.instance_name=p_instance for update of g0;
  if g.id is null then return; end if;
  if not (p_jids ? (substring(g.customer_phone from 2)||'@s.whatsapp.net')) and not exists(
    select 1 from jsonb_array_elements(g.observed_participants) m where m->>'jid'=substring(g.customer_phone from 2)||'@s.whatsapp.net'
      and p_jids ? (m->>'providerJid')) then return; end if;
  insert into public.whatsapp_care_events(event_key,group_id,kind) values(p_event_key,g.id,'customer.departure') on conflict do nothing;
  if not found then return; end if;
  update public.whatsapp_care_groups set controls_verified=false,entry_pending=false,version=version+1,
    state=case when state='closed' then state else 'customer_left' end,reason='customer_absent' where id=g.id;
  delete from public.whatsapp_care_invites where group_id=g.id;
  insert into public.whatsapp_care_audit(group_id,action) values(g.id,'customer_departure');
end $$;
revoke all on function public.care_group_removed_members(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.care_group_removed_members(text,text,text,jsonb) to service_role;

-- A identidade anterior permanece removível; não aguardar webhook ao mudar telefone de equipe.
create function public.care_group_queue_identity_removal() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.whatsapp_e164 is not distinct from old.whatsapp_e164 and new.whatsapp_verified_at is not distinct from old.whatsapp_verified_at then return null; end if;
  insert into public.whatsapp_care_operations(group_id,kind,version)
    select g.id,'remove',g.version from public.whatsapp_care_groups g
      where g.group_jid is not null and g.state not in ('closed','customer_left','creation_unknown')
      and exists(select 1 from public.whatsapp_care_participants p where p.group_id=g.id and p.user_id=old.id and p.approved_phone is not null)
      on conflict do nothing;
  return null;
end $$;
create trigger zz_care_group_queue_identity_removal after update of whatsapp_e164,whatsapp_verified_at on public.profiles
  for each row execute function public.care_group_queue_identity_removal();
revoke all on function public.care_group_queue_identity_removal() from public,anon,authenticated,service_role;

-- Uma resposta antiga não pode apagar saída/encerramento nem sobrescrever uma versão posterior.
create or replace function public.fail_care_group_operation(p_operation uuid,p_token uuid,p_known_group text default null) returns void
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_care_operations%rowtype;
begin
  select * into o from public.whatsapp_care_operations where id=p_operation and lease_token=p_token and state='running' for update;
  if o.id is null then return; end if;
  update public.whatsapp_care_operations set state='unknown' where id=o.id;
  update public.whatsapp_care_groups set controls_verified=false,
    state=case when state in ('closed','customer_left') then state when group_jid is null then 'creation_unknown' else 'paused_unavailable' end,
    reason=case when state in ('closed','customer_left') then reason else 'operation_unknown' end
    where id=o.group_id and version=o.version;
  insert into public.whatsapp_care_audit(group_id,action) values(o.group_id,'operation_unknown');
end $$;

create function public.fail_care_group_operation(p_operation uuid,p_token uuid,p_known_group text,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.fail_care_group_operation(p_operation,p_token,p_known_group);
  if p_reason='participants_changed' then
    update public.whatsapp_care_groups g set state='paused_divergence',reason=p_reason,controls_verified=false
      from public.whatsapp_care_operations o where o.id=p_operation and o.lease_token=p_token
        and o.group_id=g.id and o.version=g.version and g.state='paused_unavailable';
  end if;
end $$;
revoke all on function public.fail_care_group_operation(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.fail_care_group_operation(uuid,uuid,text,text) to service_role;

-- Gravar ID conhecido não desfaz uma pausa, revogação ou versão posterior à chamada.
create or replace function public.finish_care_group_creation(p_operation uuid,p_token uuid,p_group_jid text) returns void
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_care_operations%rowtype;
begin
  select * into o from public.whatsapp_care_operations where id=p_operation and lease_token=p_token
    and state in ('running','unknown') and started_at is not null for update;
  if o.id is null or p_group_jid is null or p_group_jid !~ '^[0-9-]+@g\.us$' then raise exception 'GROUP_STALE'; end if;
  update public.whatsapp_care_groups set group_jid=p_group_jid,
    state=case when version=o.version and revoked_at is null and state='creating' then 'waiting_customer' else state end,
    reason=case when version=o.version and revoked_at is null and state='creating' then 'awaiting_verification' else reason end
    where id=o.group_id and (group_jid is null or group_jid=p_group_jid);
  if not found then raise exception 'GROUP_CONFLICT'; end if;
end $$;
