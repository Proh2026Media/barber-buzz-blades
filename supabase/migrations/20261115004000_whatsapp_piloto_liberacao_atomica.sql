do $$begin if md5(pg_get_functiondef('public.care_group_admin(text,jsonb)'::regprocedure))<>'4c7c2eba770ee87628eb5e8e86d7f619' then raise exception 'BC_BASE_PILOTO_DIVERGENTE';end if;end $$;
-- Guarda da base v7 exata, antes de qualquer DDL.
do $$begin if md5(pg_get_functiondef('public.care_cycle_policy_allows(uuid,uuid)'::regprocedure))<>'a894f986e4e8751e506c62f4766b82f0' then raise exception 'BC_BASE_PILOTO_DIVERGENTE';end if;end $$;
do $$begin
 if md5(pg_get_functiondef('public.claim_whatsapp_outbox(integer)'::regprocedure))<>'55c2f0f70436fcffb898730becaf3356' then raise exception 'BC_BASE_PILOTO_DIVERGENTE';end if;
 if md5(pg_get_functiondef('public.guard_whatsapp_otp_request()'::regprocedure))<>'5c87483c9b7d04bc6ac8826c301c38ad' then raise exception 'BC_BASE_PILOTO_DIVERGENTE';end if;
 if md5(pg_get_functiondef('public.request_whatsapp_login_once(text,text,uuid)'::regprocedure))<>'2db88dda0989d288b0b3ac6440a0f7cf' then raise exception 'BC_BASE_PILOTO_DIVERGENTE';end if;
 if md5(pg_get_functiondef('public.whatsapp_send_candidate(uuid,uuid,uuid,text,text)'::regprocedure))<>'4baa34c5d96c5808ad9e3e04ed113206' then raise exception 'BC_BASE_PILOTO_DIVERGENTE';end if;
 if md5(pg_get_functiondef('public.whatsapp_group_notice_context(uuid,uuid)'::regprocedure))<>'d45d51e3ea809916126d90b8a41a2926' then raise exception 'BC_BASE_PILOTO_DIVERGENTE';end if;
 if md5(pg_get_functiondef('public.whatsapp_group_login_context(uuid,text,boolean)'::regprocedure))<>'081a9358cd2a746ae5e65a21f5e83a54' then raise exception 'BC_BASE_PILOTO_DIVERGENTE';end if;
 if md5(pg_get_functiondef('public.claim_care_cycle(uuid)'::regprocedure))<>'3fe09ad5cae512070dd4fd10575f13a1' then raise exception 'BC_BASE_PILOTO_DIVERGENTE';end if;
 if md5(pg_get_functiondef('public.authorize_care_cycle(uuid,uuid,boolean,uuid)'::regprocedure))<>'16818f21781ea84187b86829c766d22a' then raise exception 'BC_BASE_PILOTO_DIVERGENTE';end if;
 if md5(pg_get_functiondef('public.whatsapp_destination_route_current(uuid)'::regprocedure))<>'4d711e30bbd6068e1a1309a30d1142da' then raise exception 'BC_BASE_PILOTO_DIVERGENTE';end if;
end $$;

-- P-122: liberação singular atômica. Somente local até janela autorizada.
-- Complemento da v7; não ignora pausa em nenhum autorizador de transmissão.
-- Instalar na mesma transação do verificador de base exata entregue no pacote.
do $$begin
 if to_regprocedure('public.care_pilot_admin(text,jsonb)') is not null then raise exception 'BC_PILOTO_JA_INSTALADO';end if;
 if not exists(select 1 from public.whatsapp_send_controls where scope='global' and paused)
  or exists(select 1 from public.whatsapp_care_cycle_policy where enabled or assisted_access_enabled)
  or exists(select 1 from public.whatsapp_distribution_policy where enabled)
  or exists(select 1 from public.whatsapp_care_cycles where lease_until>clock_timestamp())
  or exists(select 1 from public.whatsapp_send_attempts where state in('started','unknown'))
  or exists(select 1 from public.whatsapp_outbox where status='sending') then raise exception 'BC_PAUSAR_ANTES_DO_AJUSTE';end if;
end $$;

-- Escopo persistente da política, INDEPENDENTE de enabled. Nem desligar ciclos
-- nem usar um emissor legado libera um contexto diferente do par do piloto.
-- A exclusão do titular pode limpar os IDs; o marcador continua exigindo escopo.
alter table public.whatsapp_care_cycle_policy add column pilot_isolation_required boolean not null default false;
update public.whatsapp_care_cycle_policy set pilot_isolation_required=pilot_shop_id is not null or pilot_customer_id is not null where singleton;
create function public.whatsapp_pilot_context_allows(p_shop uuid,p_customer uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce((select case when not pilot_isolation_required and pilot_shop_id is null and pilot_customer_id is null then true
  else pilot_shop_id=p_shop and pilot_customer_id=p_customer end from public.whatsapp_care_cycle_policy where singleton),false);
$$;
create function public.whatsapp_pilot_challenge_allows(p_customer uuid,p_shop uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce((select case when not pilot_isolation_required and pilot_shop_id is null and pilot_customer_id is null then true
  else pilot_customer_id=p_customer and (p_shop is null or pilot_shop_id=p_shop) end from public.whatsapp_care_cycle_policy where singleton),false);
$$;

-- Prontidão de PREPARAÇÃO: a pausa GLOBAL pode continuar ligada. Identidade,
-- restrições locais, duas conexões reais recentes e registro continuam obrigatórios.
-- Esta função não participa dos autorizadores de envio nem concede licença.
create function public.care_pilot_preparation_ready() returns boolean
language plpgsql stable security definer set search_path=public as $$
declare p public.whatsapp_care_cycle_policy%rowtype;g public.whatsapp_care_groups%rowtype;numbers jsonb;
begin
 select * into p from public.whatsapp_care_cycle_policy where singleton;
 if p.pilot_shop_id is null or p.pilot_customer_id is null or not public.whatsapp_complete_shop(p.pilot_shop_id)
  or not exists(select 1 from public.memberships m join public.profiles f on f.id=m.user_id join auth.users u on u.id=f.id
   where m.barbershop_id=p.pilot_shop_id and m.user_id=p.pilot_customer_id and m.role='customer'
    and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp())) then return false;end if;
 select * into g from public.whatsapp_care_groups where barbershop_id=p.pilot_shop_id and customer_id=p.pilot_customer_id;
 numbers:=public.care_cycle_composition(p.pilot_shop_id,g.current_cycle_id);
 if not public.care_cycle_composition_valid(numbers,false) then return false;end if;
 return not exists(select 1 from jsonb_array_elements(numbers) n left join public.whatsapp_channels c on c.id=(n->>'id')::uuid
  where c.id is null or c.status<>'open' or c.connection_observed_at is null or c.connection_observed_at<=clock_timestamp()-interval '2 minutes'
   or not public.care_cycle_number_valid(c.id,n,false) or public.whatsapp_number_restricted(c.id)
   or exists(select 1 from public.whatsapp_send_controls s where s.paused and s.scope in('platform',c.id::text))
   or not exists(select 1 from public.whatsapp_care_registry r where r.instance_name=c.instance_name and r.enabled and r.acknowledged_version=r.source_version)
   or exists(select 1 from public.whatsapp_send_attempts a where a.state in('started','unknown') and (a.instance_name=c.instance_name or a.activity_phone=regexp_replace(c.display_phone,'[^0-9]','','g'))));
end $$;

-- Única operação administrativa: mesmas travas, controles originais, CAS de
-- ambas as políticas e auditorias. Qualquer falha desfaz também a despausa.
create function public.care_pilot_admin(p_action text,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.whatsapp_care_cycle_policy%rowtype;s public.whatsapp_send_controls%rowtype;v bigint;ready boolean;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_action not in('read','activate','pause') or p_action is null then raise exception 'GROUP_INVALID';end if;
 if p_action<>'read' then
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 end if;
 select * into p from public.whatsapp_care_cycle_policy where singleton;
 select * into s from public.whatsapp_send_controls where scope='global';
 if p_action<>'read' then
  if (p_values->>'policy_version')::bigint is distinct from p.version or (p_values->>'pause_version')::bigint is distinct from s.version
   or (p_values->>'shop_id')::uuid is distinct from p.pilot_shop_id or (p_values->>'customer_id')::uuid is distinct from p.pilot_customer_id then raise exception 'GROUP_STALE';end if;
  if p.pilot_shop_id is null or p.pilot_customer_id is null or p_values->>'confirmed' is distinct from 'true' then raise exception 'GROUP_INVALID';end if;
  if p_action='activate' then
   if not s.paused or p.enabled or p.assisted_access_enabled then raise exception 'GROUP_STALE';end if;
   if not public.care_pilot_preparation_ready() then raise exception 'GROUP_CAPABILITY_REQUIRED';end if;
   if exists(select 1 from public.whatsapp_distribution_policy where enabled)
    or exists(select 1 from public.whatsapp_send_attempts where state in('started','unknown'))
    or exists(select 1 from public.whatsapp_care_cycles where lease_until>clock_timestamp())
    or exists(select 1 from public.whatsapp_care_operations where state='running' and lease_until>clock_timestamp())
    or exists(select 1 from public.whatsapp_outbox where status='sending') then raise exception 'GROUP_SEND_UNRESOLVED';end if;
   -- Ordem interna necessária ao gate; não há COMMIT entre estas operações.
   update public.whatsapp_care_cycle_policy set pilot_isolation_required=true where singleton;
   perform public.set_whatsapp_send_pause('global',false,'resumed',s.version);
   v:=public.care_access_admin(true,p.version);
   perform public.care_group_admin('enrollment',jsonb_build_object('enabled',true,'confirmed',true,'version',v));
   if not public.care_cycle_registry_ready() then raise exception 'GROUP_CAPABILITY_REQUIRED';end if;
  else
   perform public.set_whatsapp_send_pause('global',true,'maintenance',s.version);
   perform public.care_group_admin('enrollment',jsonb_build_object('enabled',false,'version',p.version));
   v:=public.care_access_admin(false,p.version+1);
  end if;
  insert into public.whatsapp_care_audit(group_id,actor,action,detail)
   select g.id,auth.uid(),'pilot_'||p_action,jsonb_build_object('policy_version_before',p.version,'pause_version_before',s.version)
   from public.whatsapp_care_groups g where g.barbershop_id=p.pilot_shop_id and g.customer_id=p.pilot_customer_id;
 end if;
 select * into p from public.whatsapp_care_cycle_policy where singleton;
 select * into s from public.whatsapp_send_controls where scope='global';
 ready:=public.care_pilot_preparation_ready();
 return jsonb_build_object('contract','bc-pilot-release-v1','isolated',p.pilot_isolation_required,'scoped',p.pilot_shop_id is not null and p.pilot_customer_id is not null,
  'shop_id',p.pilot_shop_id,'customer_id',p.pilot_customer_id,'shop_name',(select name from public.barbershops where id=p.pilot_shop_id),
  'customer_name',(select case when full_name like '%@%' then 'Cliente' else coalesce(nullif(trim(full_name),''),'Cliente') end from public.profiles where id=p.pilot_customer_id),
  'policy_version',p.version,'pause_version',s.version,'paused',s.paused,'cycles',p.enabled,'assistance',p.assisted_access_enabled,'preparation_ready',ready);
end $$;
revoke all on function public.whatsapp_pilot_context_allows(uuid,uuid),public.whatsapp_pilot_challenge_allows(uuid,uuid),public.care_pilot_preparation_ready(),public.care_pilot_admin(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.care_pilot_admin(text,jsonb) to authenticated;

-- As alterações dos emissores abaixo são aplicadas no bloco de base exata.

-- claim_whatsapp_outbox(integer); conserva OID/proprietário/ACL.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_outbox(p_limit integer DEFAULT 20)
 RETURNS SETOF whatsapp_outbox
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  -- Só recupera trabalho que comprovadamente não recebeu licença de transmissão.
  update public.whatsapp_outbox o set status='pending',lease_token=null,lease_until=null
    where o.status='sending' and o.lease_until<clock_timestamp() and o.delivery_started_at is null
      and not exists(select 1 from public.whatsapp_send_attempts a where a.outbox_id=o.id);
  update public.whatsapp_send_attempts set state='unknown',finished_at=clock_timestamp()
    where state='started' and started_at<clock_timestamp()-interval '2 minutes';
  if public.whatsapp_sending_paused(null,false) then return; end if;
  return query with picked as (
    select o.id from public.whatsapp_outbox o where public.whatsapp_pilot_context_allows(o.barbershop_id,public.whatsapp_recipient(o.barbershop_id,o.payload)) and o.status='pending' and o.scheduled_at<=now()
      and o.attempts<5 and o.delivery_started_at is null
      and not exists(select 1 from public.whatsapp_send_attempts a where a.outbox_id=o.id)
      and not exists(select 1 from public.whatsapp_send_controls p where p.paused and p.scope=o.channel_id::text)
      and not exists(select 1 from public.whatsapp_delivery_channels c where c.number_link_id=o.number_link_id
        and public.whatsapp_sending_paused(case when c.delivery_mode='backup' then c.backup_instance_name else c.instance_name end,false))
    order by case when public.whatsapp_message_kind(o.template_key)='transactional' then 0 else 1 end,o.scheduled_at,o.created_at,o.id
    limit greatest(1,least(coalesce(p_limit,5),5)) for update skip locked
  ), claimed as (update public.whatsapp_outbox o set status='sending',attempts=o.attempts+1,
      lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes'
    from picked where o.id=picked.id returning o.*)
  select * from claimed;
end $function$
;

-- guard_whatsapp_otp_request(); conserva OID/proprietário/ACL.
CREATE OR REPLACE FUNCTION public.guard_whatsapp_otp_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.channel<>'whatsapp' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  if not public.whatsapp_pilot_challenge_allows(new.user_id,new.barbershop_id) then raise exception 'WA_SENDING_PAUSED';end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-otp-request',120));
  if exists(select 1 from public.auth_otp_challenges where request_id=new.request_id) then raise exception 'WA_RATE_LIMIT'; end if;
  if public.whatsapp_sending_paused(null,true) then raise exception 'WA_SENDING_PAUSED'; end if;
  if new.destination !~ '^\+[1-9][0-9]{7,14}$' or new.code_hash !~ '^[a-f0-9]{64}$' then raise exception 'WA_OTP_INVALID'; end if;
  if exists(select 1 from public.auth_otp_challenges where channel='whatsapp' and destination=new.destination and created_at>clock_timestamp()-interval '60 seconds')
    or (select count(*) from public.auth_otp_challenges where channel='whatsapp' and destination=new.destination and created_at>clock_timestamp()-interval '15 minutes')>=3
    or (new.purpose='verify_phone' and new.user_id is not null and (select count(*) from public.auth_otp_challenges where channel='whatsapp' and purpose='verify_phone' and user_id=new.user_id and created_at>clock_timestamp()-interval '1 hour')>=6)
    -- Teto de capacidade do serviço; não é promessa contra restrições do WhatsApp.
    or (select count(*) from public.auth_otp_challenges where channel='whatsapp' and created_at>clock_timestamp()-interval '1 hour')>=coalesce((select otp_requests_hour from public.whatsapp_send_policy),0) then
    raise exception 'WA_RATE_LIMIT'; end if;
  update public.auth_otp_challenges set consumed_at=clock_timestamp()
    where channel='whatsapp' and destination=new.destination and purpose=new.purpose
      and barbershop_id is not distinct from new.barbershop_id and user_id is not distinct from new.user_id and consumed_at is null;
  new.created_at:=clock_timestamp();
  new.expires_at:=least(new.expires_at,new.created_at+interval '10 minutes');
  return new;
end $function$
;

-- request_whatsapp_login_once(text,text,uuid); conserva OID/proprietário/ACL.
CREATE OR REPLACE FUNCTION public.request_whatsapp_login_once(p_destination text, p_code_hash text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-otp-request',120));
  if p_request_id is not null and exists(select 1 from public.auth_otp_challenges where request_id=p_request_id) then raise exception 'WA_RATE_LIMIT'; end if;
  result:=public.request_whatsapp_login(p_destination,p_code_hash);
  if p_request_id is not null then update public.auth_otp_challenges set request_id=p_request_id where id=(result->>'challenge_id')::uuid; end if;
  return result;
end $function$
;

-- whatsapp_send_candidate(uuid,uuid,uuid,text,text); conserva OID/proprietário/ACL.
CREATE OR REPLACE FUNCTION public.whatsapp_send_candidate(p_outbox_id uuid DEFAULT NULL::uuid, p_lease_token uuid DEFAULT NULL::uuid, p_challenge_id uuid DEFAULT NULL::uuid, p_instance text DEFAULT NULL::text, p_code_hash text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if p_outbox_id is not null and not exists(select 1 from public.whatsapp_outbox o where o.id=p_outbox_id and public.whatsapp_pilot_context_allows(o.barbershop_id,public.whatsapp_recipient(o.barbershop_id,o.payload))) then return null;end if;
 if p_challenge_id is not null and not exists(select 1 from public.auth_otp_challenges c join public.whatsapp_group_login_routes r on r.challenge_id=c.id join public.whatsapp_care_groups g on g.id=r.group_id and g.customer_id=c.user_id where c.id=p_challenge_id and public.whatsapp_pilot_context_allows(g.barbershop_id,g.customer_id)) then return null;end if;
 if p_outbox_id is not null and not public.whatsapp_destination_route_current(p_outbox_id) then return null; end if;
 return public.whatsapp_send_candidate_before_destinations(p_outbox_id,p_lease_token,p_challenge_id,p_instance,p_code_hash);
end $function$
;

-- whatsapp_group_notice_context(uuid,uuid); conserva OID/proprietário/ACL.
CREATE OR REPLACE FUNCTION public.whatsapp_group_notice_context(p_outbox_id uuid, p_lease_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare result jsonb;c public.whatsapp_care_cycles%rowtype;
begin
 result:=public.whatsapp_group_notice_context_before_post_entry(p_outbox_id,p_lease_token);
 if result is null or not exists(select 1 from public.whatsapp_care_groups g where g.id=(result->>'group_id')::uuid and public.whatsapp_pilot_context_allows(g.barbershop_id,g.customer_id)) then return null;end if;
 select * into c from public.whatsapp_care_cycles where id=(result->>'cycle_id')::uuid;
 return result||jsonb_build_object('admission_id',c.admission_id,'welcome_message_id',c.admission_welcome_message_id);
end $function$
;

-- whatsapp_group_login_context(uuid,text,boolean); conserva OID/proprietário/ACL.
CREATE OR REPLACE FUNCTION public.whatsapp_group_login_context(p_challenge_id uuid, p_code_hash text, p_unused boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare result jsonb;c public.whatsapp_care_cycles%rowtype;
begin
 result:=public.whatsapp_group_login_context_before_post_entry(p_challenge_id,p_code_hash,p_unused);
 if result is null or not exists(select 1 from public.whatsapp_care_groups g where g.id=(result->>'group_id')::uuid and public.whatsapp_pilot_context_allows(g.barbershop_id,g.customer_id)) then return null;end if;
 select * into c from public.whatsapp_care_cycles where id=(result->>'cycle_id')::uuid;
 return result||jsonb_build_object('admission_id',c.admission_id,'welcome_message_id',c.admission_welcome_message_id);
end $function$
;

-- claim_care_cycle(uuid); conserva OID/proprietário/ACL.
CREATE OR REPLACE FUNCTION public.claim_care_cycle(p_cycle uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.whatsapp_care_cycles%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 if public.whatsapp_sending_paused(null,false) or not public.whatsapp_pilot_context_allows((select g.barbershop_id from public.whatsapp_care_cycles x join public.whatsapp_care_groups g on g.id=x.group_id where x.id=p_cycle),(select g.customer_id from public.whatsapp_care_cycles x join public.whatsapp_care_groups g on g.id=x.group_id where x.id=p_cycle)) then return null;end if;
 select * into c from public.whatsapp_care_cycles where id=p_cycle for update;
 if c.id is null or (c.state='closed' and not c.cleanup_pending) or c.lease_until>clock_timestamp() then return null;end if;
 if c.state='closed' then null;
 elsif c.expires_at<=clock_timestamp() or c.group_id is null then
  update public.whatsapp_care_cycles set state='closing',reason='cycle_expired',revision=revision+1 where id=c.id;
 elsif c.state<>'closing' and not public.care_cycle_available(c.id) then
  update public.whatsapp_care_cycles set state=case when state='creation_unknown' then state else 'paused' end,reason='review_required',next_run_at=now()+interval '1 hour' where id=c.id;
  return null;
 end if;
 update public.whatsapp_care_cycles set lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',lease_revision=revision where id=c.id;
 return public.care_cycle_job(c.id);
end $function$
;

-- authorize_care_cycle(uuid,uuid,boolean,uuid); conserva OID/proprietário/ACL.
CREATE OR REPLACE FUNCTION public.authorize_care_cycle(p_cycle uuid, p_token uuid, p_closing boolean DEFAULT false, p_step uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.whatsapp_care_cycles%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 if public.whatsapp_sending_paused(null,false) or not public.whatsapp_pilot_context_allows((select g.barbershop_id from public.whatsapp_care_cycles x join public.whatsapp_care_groups g on g.id=x.group_id where x.id=p_cycle),(select g.customer_id from public.whatsapp_care_cycles x join public.whatsapp_care_groups g on g.id=x.group_id where x.id=p_cycle)) then raise exception 'GROUP_UNAVAILABLE';end if;
 select * into c from public.whatsapp_care_cycles where id=p_cycle and lease_token=p_token and lease_until>clock_timestamp() for update;
 if c.id is null or c.revision<>c.lease_revision then raise exception 'GROUP_STALE';end if;
 if p_closing then
  if c.state not in ('closing','closed') or c.group_jid is null then raise exception 'GROUP_STALE';end if;
 else
  if not public.care_cycle_available(c.id) then raise exception 'GROUP_STALE';end if;
  if exists(select 1 from public.whatsapp_send_attempts a where a.activity_group_id=c.group_id and a.state in ('started','unknown') and not (a.state='started' and a.care_operation_id=p_step and exists(select 1 from public.whatsapp_care_cycle_steps s where s.id=p_step and s.cycle_id=c.id))) then raise exception 'GROUP_SEND_UNRESOLVED';end if;
 end if;
 return public.care_cycle_job(c.id);
end $function$
;

-- whatsapp_destination_route_current(uuid); conserva OID/proprietário/ACL.
CREATE OR REPLACE FUNCTION public.whatsapp_destination_route_current(p_outbox uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select exists(select 1 from public.whatsapp_outbox o join public.whatsapp_number_links b on b.id=o.number_link_id
  where public.whatsapp_pilot_context_allows(o.barbershop_id,public.whatsapp_recipient(o.barbershop_id,o.payload)) and o.id=p_outbox and b.removed_at is null and b.channel_id=o.channel_id and b.barbershop_id=o.barbershop_id
   and exists(select 1 from public.whatsapp_channels active_number where active_number.id=case b.delivery_mode when 'backup' then b.backup_channel_id when 'backup2' then b.backup2_channel_id else b.channel_id end and active_number.status='open' and not public.whatsapp_sending_paused(active_number.instance_name,false))
   and b.version=o.number_link_version and o.number_route_identity=b.number_identities and public.whatsapp_route_numbers_valid(b.channel_id,b.backup_channel_id,b.backup2_channel_id)
   and b.number_identities=(select coalesce(jsonb_object_agg(c.id::text,jsonb_build_object('phone',regexp_replace(c.display_phone,'[^0-9]','','g'),'instance',c.instance_name)),'{}') from public.whatsapp_channels c where c.id in(b.channel_id,b.backup_channel_id,b.backup2_channel_id))
   and not (b.delivery_mode in ('backup','backup2') and public.whatsapp_number_restricted(b.channel_id)));
$function$
;

notify pgrst,'reload schema';

create or replace function public.care_cycle_policy_allows(p_shop uuid,p_customer uuid) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select enabled and (pilot_shop_id is null or (pilot_shop_id=p_shop and pilot_customer_id=p_customer)) from public.whatsapp_care_cycle_policy),false)
  and public.whatsapp_pilot_context_allows(p_shop,p_customer);
$$;

CREATE OR REPLACE FUNCTION public.care_group_admin(p_action text, p_values jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 return jsonb_build_object('cycle_contract','bc-groups-v3','pilot',(select pilot_isolation_required or pilot_shop_id is not null from public.whatsapp_care_cycle_policy),'enabled',(select p.enabled from public.whatsapp_care_cycle_policy p),'policy_version',(select version from public.whatsapp_care_cycle_policy),
 'capabilities_ready',public.care_cycle_registry_ready(),
 'registry_pending',(select count(*) from public.whatsapp_care_registry where acknowledged_version is distinct from source_version),'accounts','[]'::jsonb,
 'groups',coalesce((select jsonb_agg(jsonb_build_object('id',listed_g.id,'shop_id',listed_g.barbershop_id,'shop_name',b.name,'customer_name',case when p.full_name like '%@%' then 'Cliente' else coalesce(nullif(trim(p.full_name),''),'Cliente') end,
  'state',listed_g.state,'ready',public.care_cycle_send_ready(listed_g.id),'version',listed_g.version,'cycle_id',listed_c.id,'cycle_state',listed_c.state,'expires_at',listed_c.expires_at,'reason',coalesce(listed_c.reason,listed_g.reason),'cleanup_pending',listed_c.cleanup_pending,'legacy',listed_c.id is null and listed_g.group_jid is not null,
  'approved_count',jsonb_array_length(coalesce(listed_c.consented_numbers,'[]')),'observed_count',jsonb_array_length(listed_g.observed_participants),'numbers_changed',listed_c.consented_numbers is distinct from public.care_cycle_composition(listed_g.barbershop_id,listed_c.id)) order by listed_g.requested_at desc)
 from public.whatsapp_care_groups listed_g join public.barbershops b on b.id=listed_g.barbershop_id join public.profiles p on p.id=listed_g.customer_id left join public.whatsapp_care_cycles listed_c on listed_c.id=listed_g.current_cycle_id),'[]'),
 'cleanup_orphans',(select count(*) from public.whatsapp_care_cycles where group_id is null and (state<>'closed' or cleanup_pending)));
end $function$;
