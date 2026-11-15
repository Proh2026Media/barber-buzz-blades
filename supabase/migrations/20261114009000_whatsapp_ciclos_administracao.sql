-- D5 local. Somente administração global, sem acesso da equipe às conversas/grupos.
-- Números sem relação com o destino do piloto não bloqueiam sua habilitação.
create function public.care_cycle_registry_ready() returns boolean language sql stable security definer set search_path=public as $$
 select count(*)>=2 from public.whatsapp_distribution_candidates() d join public.whatsapp_channels n on n.id=d.id
 join public.whatsapp_care_registry r on r.instance_name=n.instance_name and r.enabled and r.acknowledged_version=r.source_version
 cross join public.whatsapp_care_cycle_policy p
 where p.pilot_shop_id is null or exists(select 1 from jsonb_array_elements(public.care_cycle_composition(p.pilot_shop_id)) selected where selected->>'id'=n.id::text);
$$;
revoke all on function public.care_cycle_registry_ready() from public,anon,authenticated,service_role;
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
  update public.whatsapp_care_cycle_policy set enabled=policy_enabled,version=version+1,changed_by=auth.uid(),changed_at=now();
  -- O mesmo ato explícito permite as finalidades novas; o gate v3 permanece obrigatório.
  if policy_enabled then update public.whatsapp_group_settings set enrollment_enabled=true,login_enabled=true;end if;
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

create function public.record_legacy_care_cycle_proof(p_cycle uuid,p_token uuid,p_proof jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_care_cycles%rowtype;creator uuid;instance text;created timestamptz;expires timestamptz;
begin
 perform public.authorize_care_cycle(p_cycle,p_token,true);
 select * into c from public.whatsapp_care_cycles where id=p_cycle and legacy_closing and state='closing' for update;
 if c.id is null or p_proof->>'cycleId' is distinct from c.id::text or p_proof->>'groupJid' is distinct from c.group_jid
  or p_proof->>'customerJid' is distinct from substring(c.customer_phone from 2)||'@s.whatsapp.net'
  or p_proof->>'closing' is distinct from 'true' or p_proof->>'closed' is distinct from 'false' or p_proof->>'firstViolation' is distinct from 'true'
  or p_proof->>'creatorInstanceId' is null then raise exception 'GROUP_CLOSURE_UNPROVEN';end if;
 select (n->>'id')::uuid,n->>'instance' into creator,instance from jsonb_array_elements(c.consented_numbers) n where substring(n->>'phone' from 2)||'@s.whatsapp.net'=p_proof->>'creatorJid';
 created:=(p_proof->>'createdAt')::timestamptz;expires:=(p_proof->>'expiresAt')::timestamptz;
 if creator is null or created is null or created>clock_timestamp() or expires is distinct from ((created at time zone 'UTC')+interval '1 year') at time zone 'UTC' then raise exception 'GROUP_CLOSURE_UNPROVEN';end if;
 update public.whatsapp_care_cycles set creator_channel_id=creator,creator_instance=instance,provider_creator_id=p_proof->>'creatorInstanceId',created_at=created,expires_at=expires where id=c.id;
 return public.care_cycle_job(c.id);
end $$;
revoke all on function public.record_legacy_care_cycle_proof(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_legacy_care_cycle_proof(uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';

-- Alterações cosméticas solicitam sincronização sem mudar consentimento nem reiniciar ciclo.
create function public.wake_care_cycle_cosmetics() returns trigger language plpgsql security definer set search_path=public as $$
declare shop uuid;person uuid;
begin
 if tg_table_name='appointments' then
  shop:=case when tg_op='DELETE' then old.barbershop_id else new.barbershop_id end;person:=case when tg_op='DELETE' then old.customer_id else new.customer_id end;
 elsif tg_table_name='profiles' then person:=new.id;
 elsif tg_table_name='barbershops' then shop:=new.id;
 else shop:=new.barbershop_id;end if;
 update public.whatsapp_care_cycles c set next_run_at=least(c.next_run_at,now()-interval '1 day') from public.whatsapp_care_groups g where g.current_cycle_id=c.id and c.state not in ('closed','closing') and (shop is null or g.barbershop_id=shop) and (person is null or g.customer_id=person);
 return null;
end $$;
create trigger wake_care_cycle_appointment after insert or update of starts_at,status,staff_id or delete on public.appointments for each row execute function public.wake_care_cycle_cosmetics();
create trigger wake_care_cycle_customer_name after update of full_name on public.profiles for each row when(new.full_name is distinct from old.full_name) execute function public.wake_care_cycle_cosmetics();
create trigger wake_care_cycle_shop_name after update of name on public.barbershops for each row when(new.name is distinct from old.name) execute function public.wake_care_cycle_cosmetics();
create trigger wake_care_cycle_brand after update of display_name,logo_url on public.barbershop_settings for each row when(new.display_name is distinct from old.display_name or new.logo_url is distinct from old.logo_url) execute function public.wake_care_cycle_cosmetics();
revoke all on function public.wake_care_cycle_cosmetics() from public,anon,authenticated,service_role;

-- Ciclos encerrados e limpos conservam apenas a lápide que impede reutilizar o JID.
-- Não apagar prova/tarefa de resultado incerto ou limpeza ainda pendente.
alter table public.whatsapp_care_cycles alter column customer_phone drop not null;
alter function public.purge_care_group_audit() rename to purge_care_group_audit_before_cycles;
revoke all on function public.purge_care_group_audit_before_cycles() from public,anon,authenticated,service_role;
create function public.purge_care_group_audit() returns void language plpgsql security definer set search_path=public as $$
begin
 perform public.purge_care_group_audit_before_cycles();
 delete from public.whatsapp_care_cycle_steps s using public.whatsapp_care_cycles c
  where c.id=s.cycle_id and c.state='closed' and not c.cleanup_pending and c.closed_at<now()-interval '90 days';
 update public.whatsapp_care_cycles set customer_phone=null,consented_numbers='[]',creator_channel_id=null,creator_instance='',provider_creator_id=null,creation_body=null,creation_hash=null,
  observation=null,cleanup_state='{}',first_message_id=null,lease_token=null,lease_until=null,lease_revision=null
  where state='closed' and not cleanup_pending and closed_at<now()-interval '90 days' and customer_phone is not null;
 delete from public.whatsapp_care_audit a where a.created_at<now()-interval '180 days' and exists(select 1 from public.whatsapp_care_cycles c where c.group_id=a.group_id and c.state='closed' and not c.cleanup_pending);
 -- Revogações são lápides de versão: removê-las permitiria reativação por uma entrega atrasada.
end $$;
revoke all on function public.purge_care_group_audit() from public,anon,authenticated;
grant execute on function public.purge_care_group_audit() to service_role;
notify pgrst,'reload schema';

-- Não deixar exclusão da conta/loja do piloto virar habilitação global por nulificação parcial.
create function public.clear_care_cycle_pilot() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.whatsapp_care_cycle_policy set enabled=false,pilot_shop_id=null,pilot_customer_id=null,version=version+1,changed_at=now() where (tg_table_name='barbershops' and pilot_shop_id=old.id) or (tg_table_name='users' and pilot_customer_id=old.id);
 return old;
end $$;
create trigger clear_care_cycle_pilot_shop before delete on public.barbershops for each row execute function public.clear_care_cycle_pilot();
create trigger clear_care_cycle_pilot_user before delete on auth.users for each row execute function public.clear_care_cycle_pilot();
revoke all on function public.clear_care_cycle_pilot() from public,anon,authenticated,service_role;
