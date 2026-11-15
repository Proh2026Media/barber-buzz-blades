-- Bancada descartável. Nenhuma mensagem, nenhuma chamada de rede; rollback integral.
begin;
create temporary table d4 as select gen_random_uuid() shop,gen_random_uuid() person,gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() plan,gen_random_uuid() grp,gen_random_uuid() cycle,null::jsonb job,null::jsonb body,null::jsonb step;
create function pg_temp.check_d4(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.check_d4((select not enabled from public.whatsapp_care_cycle_policy),'Contrato novo não herda liberação do piloto anterior');
update public.whatsapp_send_controls set paused=false where scope='global';
update d4 set shop=(public.register_my_barbershop(gen_random_uuid(),'Ciclo Fictício','America/Sao_Paulo','single',true,'teste','teste','teste')->>'shop_id')::uuid;
select public.platform_create_whatsapp_channel(a,'Ciclo A') from d4;
select public.platform_create_whatsapp_channel(b,'Ciclo B') from d4;
update public.whatsapp_channels set display_phone=case id when (select a from d4) then '+5511800000111' else '+5511800000222' end,status='open' where id in(select a from d4 union all select b from d4);
select public.platform_confirm_whatsapp_control(id,routing_version,display_phone,instance_name,true) from public.whatsapp_channels where id in(select a from d4 union all select b from d4);
select public.platform_plan_whatsapp_distribution(plan,array[shop],false) from d4;
select public.platform_apply_whatsapp_distribution(plan) from d4;
select pg_temp.check_d4((select jsonb_array_length(public.care_cycle_composition(shop))=2 from d4),'Composição da loja usa dois telefones físicos com controle confirmado');
insert into auth.users(id,email,raw_user_meta_data) select person,person||'@example.invalid','{}' from d4;
insert into public.memberships(user_id,barbershop_id,role) select person,shop,'customer' from d4;
insert into public.whatsapp_care_groups(id,barbershop_id,customer_id,customer_phone) select grp,shop,person,'+5511999999999' from d4;
insert into public.whatsapp_group_enrollments(group_id,profile_phone,profile_verified_at) select grp,null,null from d4;
insert into public.whatsapp_care_cycles(id,group_id,customer_phone,consented_numbers,creator_channel_id,creator_instance)
 select cycle,grp,'+5511999999999',public.care_cycle_composition(shop),(public.care_cycle_composition(shop)->0->>'id')::uuid,public.care_cycle_composition(shop)->0->>'instance' from d4;
update public.whatsapp_care_groups set current_cycle_id=(select cycle from d4) where id=(select grp from d4);
select pg_temp.check_d4((select not public.care_cycle_available(cycle) from d4),'Ter números e consentimento não ignora política desligada');
update public.whatsapp_care_cycle_policy set enabled=true;
select pg_temp.check_d4((select public.care_cycle_available(cycle) from d4),'Composição e adesão autenticada elegíveis para preparar, sem confirmar telefone');

-- Registro deve ser confirmado na versão atual antes da liberação administrativa.
select public.care_cycle_registry_ack(instance_name,source_version,true) from public.whatsapp_care_registry;
update public.whatsapp_care_cycle_policy set pilot_shop_id=(select shop from d4),pilot_customer_id=(select person from d4) where singleton;
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
load 'safeupdate';
set safeupdate.enabled=1;
select public.care_group_admin('enrollment',jsonb_build_object('enabled',true,'version',1,'confirmed',true));
rollback;
