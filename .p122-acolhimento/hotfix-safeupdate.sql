-- P-122: filtro explícito dos registros singleton; nenhuma política é ativada.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create temporary table bc_hotfix_function_identity on commit drop as select oid,proowner,proacl from pg_proc where oid in ('public.care_group_admin(text,jsonb)'::regprocedure,'public.platform_set_whatsapp_automatic(boolean,bigint)'::regprocedure);
do $guard$ begin
 if not exists(select 1 from public.whatsapp_send_controls where scope='global' and paused) then raise exception 'BC_HOTFIX_EXIGE_PAUSA';end if;
 if exists(select 1 from public.whatsapp_care_cycle_policy where enabled) or exists(select 1 from public.whatsapp_distribution_policy where enabled) then raise exception 'BC_HOTFIX_EXIGE_POLITICAS_DESLIGADAS';end if;
 if exists(select 1 from public.whatsapp_outbox where status='sending') or exists(select 1 from public.whatsapp_send_attempts where state='started' and started_at>clock_timestamp()-interval '2 minutes') then raise exception 'BC_HOTFIX_ENVIO_EM_ANDAMENTO';end if;
 if (select md5(prosrc) from pg_proc where oid='public.care_group_admin(text,jsonb)'::regprocedure) not in ('e233ec1503b516c389653f735f77484a','6a15e4fead26e0347dbba94e15757cdb') then raise exception 'BC_HOTFIX_BASE_DIVERGENTE: care_group_admin';end if;
 if (select md5(prosrc) from pg_proc where oid='public.platform_set_whatsapp_automatic(boolean,bigint)'::regprocedure) not in ('b4e0cc3317eefd75cb11b8ed6bd95411','efe97b1fbc2e68ab67c4fe8630d539fd') then raise exception 'BC_HOTFIX_BASE_DIVERGENTE: platform_set_whatsapp_automatic';end if;
 if (select count(*) from public.whatsapp_care_cycle_policy where singleton)<>1 or (select count(*) from public.whatsapp_group_settings where singleton)<>1 or (select count(*) from public.whatsapp_distribution_policy where singleton)<>1 then raise exception 'BC_HOTFIX_SINGLETON_AUSENTE';end if;
end $guard$;

create or replace function public.care_group_admin(p_action text,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;c public.whatsapp_care_cycles%rowtype;policy_enabled boolean;policy public.whatsapp_care_cycle_policy%rowtype;numbers jsonb;creator uuid;instance text;
begin
 if not public.is_platform_admin() then return jsonb_build_object('denied',true);end if;
 if p_action<>'read' then
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 end if;
 if p_action='enrollment' then
  select * into policy from public.whatsapp_care_cycle_policy for update;
  policy_enabled:=(p_values->>'enabled')::boolean;
  if policy_enabled is null or (p_values->>'version')::bigint is distinct from policy.version then raise exception 'GROUP_STALE';end if;
  if policy_enabled and (p_values->>'confirmed' is distinct from 'true' or not public.care_cycle_registry_ready()) then raise exception 'GROUP_CAPABILITY_REQUIRED';end if;
  update public.whatsapp_care_cycle_policy set enabled=policy_enabled,version=version+1,changed_by=auth.uid(),changed_at=now() where singleton;
  -- O mesmo ato explícito permite as finalidades novas; o gate v3 permanece obrigatório.
  if policy_enabled then update public.whatsapp_group_settings set enrollment_enabled=true,login_enabled=true where singleton;end if;
 elsif p_action in ('pause','review','close_legacy') then
  select * into g from public.whatsapp_care_groups where id=(p_values->>'group_id')::uuid for update;
  if g.id is null or g.version is distinct from (p_values->>'version')::bigint then raise exception 'GROUP_STALE';end if;
  select * into c from public.whatsapp_care_cycles where id=g.current_cycle_id for update;
  if p_action='close_legacy' then
   if p_values->>'confirmed' is distinct from 'true' or c.id is not null or g.group_jid is null then raise exception 'GROUP_INVALID';end if;
   select jsonb_agg(jsonb_build_object('id',n.id,'phone','+'||regexp_replace(n.display_phone,'[^0-9]','','g'),'instance',n.instance_name) order by a.id) into numbers
   from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id
   where a.id=any(g.approved_accounts) and g.approved_account_identities->a.id::text=jsonb_build_object('phone',n.display_phone,'instance',n.instance_name)
    and public.care_cycle_number_valid(n.id,jsonb_build_object('id',n.id,'phone','+'||regexp_replace(n.display_phone,'[^0-9]','','g'),'instance',n.instance_name),false);
   select a.channel_id,n.instance_name into creator,instance from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.id=g.account_id and exists(select 1 from jsonb_array_elements(numbers) item where item->>'id'=n.id::text);
   if creator is null or jsonb_array_length(numbers) not between 1 and 20 then raise exception 'GROUP_LEGACY_REVIEW_REQUIRED';end if;
   insert into public.whatsapp_care_cycles(group_id,group_jid,state,customer_phone,consented_numbers,creator_channel_id,creator_instance,legacy_closing)
   values(g.id,g.group_jid,'closing',g.customer_phone,numbers,creator,instance,true) returning * into c;
   update public.whatsapp_care_groups set current_cycle_id=c.id,state='closed',controls_verified=false,revoked_at=now(),reason='legacy_closing' where id=g.id;
   delete from public.whatsapp_care_invites where group_id=g.id;
  elsif c.id is null then raise exception 'GROUP_LEGACY_REVIEW_REQUIRED';
  elsif p_action='pause' then
   if c.state in ('closed','closing') then raise exception 'GROUP_INVALID';end if;
   update public.whatsapp_care_cycles set reason='operator_pause',state='paused',revision=revision+1 where id=c.id;
   update public.whatsapp_care_groups set reason='operator_pause',controls_verified=false where id=g.id;
  else
   update public.whatsapp_care_cycles set reason=case when state in ('closed','closing') then reason else 'review_required' end,revision=revision+1,next_run_at=now() where id=c.id;
   update public.whatsapp_care_groups set reason=case when state='closed' then reason else 'review_required' end,controls_verified=false where id=g.id;
  end if;
  update public.whatsapp_care_groups set version=version+1 where id=g.id;
  insert into public.whatsapp_care_audit(group_id,actor,action,detail) values(g.id,auth.uid(),p_action,jsonb_build_object('cycle_id',c.id));
 elsif p_action<>'read' then raise exception 'GROUP_PROTECTED_CONTRACT_REQUIRED';end if;
 return jsonb_build_object('cycle_contract','bc-groups-v3','pilot',(select pilot_shop_id is not null from public.whatsapp_care_cycle_policy),'enabled',(select p.enabled from public.whatsapp_care_cycle_policy p),'policy_version',(select version from public.whatsapp_care_cycle_policy),
 'capabilities_ready',public.care_cycle_registry_ready(),
 'registry_pending',(select count(*) from public.whatsapp_care_registry where acknowledged_version is distinct from source_version),'accounts','[]'::jsonb,
 'groups',coalesce((select jsonb_agg(jsonb_build_object('id',listed_g.id,'shop_id',listed_g.barbershop_id,'shop_name',b.name,'customer_name',case when p.full_name like '%@%' then 'Cliente' else coalesce(nullif(trim(p.full_name),''),'Cliente') end,
  'state',listed_g.state,'ready',public.care_cycle_send_ready(listed_g.id),'version',listed_g.version,'cycle_id',listed_c.id,'cycle_state',listed_c.state,'expires_at',listed_c.expires_at,'reason',coalesce(listed_c.reason,listed_g.reason),'cleanup_pending',listed_c.cleanup_pending,'legacy',listed_c.id is null and listed_g.group_jid is not null,
  'approved_count',jsonb_array_length(coalesce(listed_c.consented_numbers,'[]')),'observed_count',jsonb_array_length(listed_g.observed_participants),'numbers_changed',listed_c.consented_numbers is distinct from public.care_cycle_composition(listed_g.barbershop_id,listed_c.id)) order by listed_g.requested_at desc)
 from public.whatsapp_care_groups listed_g join public.barbershops b on b.id=listed_g.barbershop_id join public.profiles p on p.id=listed_g.customer_id left join public.whatsapp_care_cycles listed_c on listed_c.id=listed_g.current_cycle_id),'[]'),
 'cleanup_orphans',(select count(*) from public.whatsapp_care_cycles where group_id is null and (state<>'closed' or cleanup_pending)));
end $$;

create or replace function public.platform_set_whatsapp_automatic(p_enabled boolean,p_version bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.whatsapp_distribution_policy%rowtype;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_enabled is null then raise exception 'WA_TARGET_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into p from public.whatsapp_distribution_policy for update;
 if p.version is distinct from p_version then raise exception 'WA_STALE' using errcode='40001';end if;
 update public.whatsapp_distribution_policy set enabled=p_enabled,version=version+1,changed_by=auth.uid(),changed_at=clock_timestamp() where singleton returning * into p;
 insert into public.whatsapp_distribution_audit(actor,action,detail) values(auth.uid(),'automatic_policy',jsonb_build_object('enabled',p.enabled,'version',p.version));
 return to_jsonb(p);
end $$;

do $guard$ begin
 if (select md5(prosrc) from pg_proc where oid='public.care_group_admin(text,jsonb)'::regprocedure) is distinct from '6a15e4fead26e0347dbba94e15757cdb' then raise exception 'BC_HOTFIX_FONTE_NAO_CONFIRMADA';end if;
 if (select md5(prosrc) from pg_proc where oid='public.platform_set_whatsapp_automatic(boolean,bigint)'::regprocedure) is distinct from 'efe97b1fbc2e68ab67c4fe8630d539fd' then raise exception 'BC_HOTFIX_FONTE_NAO_CONFIRMADA';end if;
 if exists(select 1 from bc_hotfix_function_identity b join pg_proc p on p.oid=b.oid where p.proowner is distinct from b.proowner or p.proacl is distinct from b.proacl) then raise exception 'BC_HOTFIX_PRIVILEGIOS_ALTERADOS';end if;
end $guard$;
notify pgrst,'reload schema';
commit;
