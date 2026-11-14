-- D4 local, conjunto indivisível com 03000 e integração do worker. Não publicar parcial.
-- A janela real será revisada depois do ensaio conjunto; nenhuma flag é ligada aqui.
create function public.care_cycle_sync_accounts(p_cycle uuid) returns void
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_care_cycles%rowtype;g public.whatsapp_care_groups%rowtype;ids uuid[];identities jsonb;creator uuid;
begin
 select * into c from public.whatsapp_care_cycles where id=p_cycle;
 select * into g from public.whatsapp_care_groups where id=c.group_id;
 if g.id is null then raise exception 'GROUP_STALE';end if;
 insert into public.whatsapp_group_accounts(barbershop_id,channel_id,authorized_by)
 select g.barbershop_id,(n->>'id')::uuid,(select platform_control_verified_by from public.whatsapp_channels where id=(n->>'id')::uuid)
 from jsonb_array_elements(c.consented_numbers) n on conflict(barbershop_id,channel_id) do update set enabled=true;
 select array_agg(a.id order by a.id),jsonb_object_agg(a.id::text,jsonb_build_object('phone',n.display_phone,'instance',n.instance_name)) into ids,identities
 from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.barbershop_id=g.barbershop_id and exists(select 1 from jsonb_array_elements(c.consented_numbers) item where item->>'id'=n.id::text);
 select a.id into creator from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.barbershop_id=g.barbershop_id and n.instance_name=public.care_cycle_sender_instance(g.barbershop_id) and a.id=any(ids);
 update public.whatsapp_care_groups set approved_accounts=ids,approved_account_identities=identities,account_id=creator where id=g.id;
end $$;

-- Conserva o formato externo, mas identifica explicitamente o contrato protegido novo.
create or replace function public.care_group_read(p_shop uuid,p_customer uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;c public.whatsapp_care_cycles%rowtype;numbers jsonb;own_profile public.profiles%rowtype;
begin
 if auth.uid() is null or coalesce(p_customer,auth.uid())<>auth.uid() then raise exception 'Sem permissão' using errcode='42501';end if;
 select * into g from public.whatsapp_care_groups where barbershop_id=p_shop and customer_id=auth.uid();
 select * into own_profile from public.profiles where id=auth.uid();
 select * into c from public.whatsapp_care_cycles where id=g.current_cycle_id;
 numbers:=public.care_cycle_composition(p_shop,case when c.state<>'closed' then c.id end);
 return jsonb_build_object('cycle_contract','bc-groups-v3','enabled',public.care_cycle_policy_allows(p_shop,auth.uid()),
  'group',case when g.id is null then null else jsonb_build_object('id',g.id,'state',g.state,'version',g.version,'notifications',g.notifications,'review_invites',g.review_invites,'return_on',g.return_on,'reason',coalesce(c.reason,g.reason),'observed_at',g.observed_at,
   'cycle_id',c.id,'cycle_state',c.state,'expires_at',c.expires_at,'numbers_changed',c.consented_numbers is distinct from numbers,'closing',c.state='closing') end,
  'preferences',(select to_jsonb(p)-'customer_id' from public.whatsapp_customer_contact_preferences p where customer_id=auth.uid()),
  'participants','[]'::jsonb,'platform_participants',coalesce((select jsonb_agg(jsonb_build_object('id',n->>'id','phone',n->>'phone','name',null)) from jsonb_array_elements(numbers) n),'[]'),
  'phone',coalesce(g.customer_phone,own_profile.whatsapp_e164),'phone_confirmed',own_profile.whatsapp_verified_at is not null and own_profile.whatsapp_e164=g.customer_phone,
  'phone_ready',coalesce(public.care_cycle_send_ready(g.id),false),
  'enrollment_expired',exists(select 1 from public.whatsapp_group_enrollments e where e.group_id=g.id and e.expires_at<=now()),
  'can_return',coalesce(c.state='customer_left' and c.expires_at>clock_timestamp(),false));
end $$;

create function public.create_care_cycle_internal(p_group uuid,p_numbers jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;c uuid;
begin
 select * into g from public.whatsapp_care_groups where id=p_group for update;
 if not public.care_cycle_composition_valid(p_numbers) or g.customer_phone in(select n->>'phone' from jsonb_array_elements(p_numbers) n) then raise exception 'GROUP_PARTICIPANTS_CHANGED';end if;
 if exists(select 1 from public.whatsapp_care_cycles where group_id=g.id and state<>'closed') then raise exception 'GROUP_REVIEW_REQUIRED';end if;
 if g.group_jid is not null and not exists(select 1 from public.whatsapp_care_cycles where group_id=g.id and group_jid=g.group_jid and state='closed') then raise exception 'GROUP_LEGACY_REVIEW_REQUIRED';end if;
 insert into public.whatsapp_care_cycles(group_id,customer_phone,consented_numbers,creator_channel_id,creator_instance)
 values(g.id,g.customer_phone,p_numbers,(select (n->>'id')::uuid from jsonb_array_elements(p_numbers) n where n->>'instance'=public.care_cycle_sender_instance(g.barbershop_id)),public.care_cycle_sender_instance(g.barbershop_id)) returning id into c;
 update public.whatsapp_care_groups set current_cycle_id=c,group_jid=null,state='requested',reason='preparation_required',controls_verified=false,entry_pending=true,observed_at=null,observed_participants='[]',revoked_at=null,version=version+1,consent_version='grupos-2026-11-14' where id=g.id;
 perform public.care_cycle_sync_accounts(c);
 insert into public.whatsapp_care_audit(group_id,actor,action,detail) values(g.id,auth.uid(),'cycle_requested',jsonb_build_object('cycle_id',c,'numbers',p_numbers,'consent_version','grupos-2026-11-14'));
 return c;
end $$;
create or replace function public.care_group_begin(p_shop uuid,p_accept boolean,p_accounts uuid[],p_phone text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype;g public.whatsapp_care_groups%rowtype;numbers jsonb;expected uuid[];supplied uuid[];phone text;
begin
 if auth.uid() is null or not exists(select 1 from public.memberships where user_id=auth.uid() and barbershop_id=p_shop and role='customer') then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_accept is distinct from true or not public.care_cycle_policy_allows(p_shop,auth.uid()) or not public.whatsapp_complete_shop(p_shop) then raise exception 'GROUP_UNAVAILABLE';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 perform pg_advisory_xact_lock(hashtextextended('group-enrollment',120));
 select * into p from public.profiles where id=auth.uid();phone:=public.normalize_br_whatsapp(p_phone);
 if phone is null or (p.whatsapp_verified_at is not null and p.whatsapp_e164 is distinct from phone)
  or exists(select 1 from public.profiles where id<>p.id and whatsapp_e164=phone and whatsapp_verified_at is not null) then raise exception 'GROUP_PHONE_UNAVAILABLE';end if;
 select * into g from public.whatsapp_care_groups where barbershop_id=p_shop and customer_id=p.id for update;
 numbers:=public.care_cycle_composition(p_shop,g.current_cycle_id);
 select array_agg((n->>'id')::uuid order by (n->>'id')::uuid) into expected from jsonb_array_elements(numbers) n;
 select array_agg(x order by x) into supplied from unnest(p_accounts) x;
 if supplied is distinct from expected or not public.care_cycle_composition_valid(numbers) then raise exception 'GROUP_PARTICIPANTS_CHANGED';end if;
 if g.id is not null and g.customer_phone<>phone then raise exception 'GROUP_PHONE_UNAVAILABLE';end if;
 if g.id is null then
  if (select count(*) from public.whatsapp_care_groups where customer_id=p.id and requested_at>now()-interval '1 hour')>=5 then raise exception 'WA_RATE_LIMIT';end if;
  insert into public.whatsapp_care_groups(barbershop_id,customer_id,customer_phone) values(p_shop,p.id,phone) returning * into g;
 end if;
 if g.current_cycle_id is null then perform public.create_care_cycle_internal(g.id,numbers);
 elsif exists(select 1 from public.whatsapp_care_cycles where id=g.current_cycle_id and state in ('closing','closed','customer_left')) then raise exception 'GROUP_REVIEW_REQUIRED';end if;
 insert into public.whatsapp_group_enrollments(group_id,profile_phone,profile_verified_at) values(g.id,p.whatsapp_e164,p.whatsapp_verified_at)
 on conflict(group_id) do update set expires_at=now()+interval '1 hour' where whatsapp_group_enrollments.profile_phone is not distinct from p.whatsapp_e164 and whatsapp_group_enrollments.profile_verified_at is not distinct from p.whatsapp_verified_at;
 update public.whatsapp_care_cycles set next_run_at=now() where id=(select current_cycle_id from public.whatsapp_care_groups where id=g.id);
 insert into public.whatsapp_customer_contact_preferences(customer_id) values(p.id) on conflict do nothing;
 return public.care_group_read(p_shop);
end $$;

create or replace function public.care_group_customer_update(p_group uuid,p_version bigint,p_action text,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;c public.whatsapp_care_cycles%rowtype;numbers jsonb;expected uuid[];supplied uuid[];cap integer;p public.profiles%rowtype;
begin
 if auth.uid() is null then raise exception 'Sem permissão' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into g from public.whatsapp_care_groups where id=p_group and customer_id=auth.uid() for update;
 if g.id is null then raise exception 'Sem permissão' using errcode='42501';end if;
 if g.version is distinct from p_version then raise exception 'GROUP_STALE';end if;
 select * into c from public.whatsapp_care_cycles where id=g.current_cycle_id for update;
 if p_action='preferences' then
  if c.id is null or c.state in ('closing','closed') then raise exception 'GROUP_INVALID';end if;
  cap:=(p_values->>'monthly_marketing')::integer;
  if cap is null or cap not in (0,1,3) or (p_values->>'return_on')::date<(now() at time zone 'America/Sao_Paulo')::date then raise exception 'GROUP_INVALID';end if;
  update public.whatsapp_care_groups set notifications=coalesce((p_values->>'notifications')::boolean,false),review_invites=coalesce((p_values->>'review_invites')::boolean,false),return_on=(p_values->>'return_on')::date where id=g.id;
  insert into public.whatsapp_customer_contact_preferences(customer_id,monthly_marketing,proactive_paused) values(g.customer_id,cap,coalesce((p_values->>'proactive_paused')::boolean,false))
   on conflict(customer_id) do update set monthly_marketing=excluded.monthly_marketing,proactive_paused=excluded.proactive_paused,changed_at=now();
  insert into public.customer_privacy(user_id,marketing) values(g.customer_id,cap>0) on conflict(user_id) do update set marketing=excluded.marketing;
 elsif p_action='close' then
  if c.id is null then raise exception 'GROUP_LEGACY_REVIEW_REQUIRED';end if;
  update public.whatsapp_care_cycles set state=case when state='closed' then state else 'closing' end,revision=revision+1,reason='customer_request',next_run_at=now() where id=c.id;
  update public.whatsapp_care_groups set state='closed',revoked_at=now(),notifications=false,review_invites=false,return_on=null,controls_verified=false,reason='customer_request' where id=g.id;
  delete from public.whatsapp_care_invites where group_id=g.id;
 elsif p_action in ('rejoin','approve_numbers') then
  if g.reason='operator_pause' then raise exception 'GROUP_UNAVAILABLE';end if;
  if p_values->>'accept' is distinct from 'true' or not public.care_cycle_policy_allows(g.barbershop_id,g.customer_id) then raise exception 'GROUP_UNAVAILABLE';end if;
  if (c.creation_issued_at is not null and c.group_jid is null) or c.id is null or c.state='closing' or (c.state<>'closed' and c.expires_at<=clock_timestamp()) then raise exception 'GROUP_REVIEW_REQUIRED';end if;
  if p_action='rejoin' and c.state not in ('customer_left','closed') then raise exception 'GROUP_INVALID';end if;
  numbers:=public.care_cycle_composition(g.barbershop_id,case when c.state<>'closed' then c.id end);
  select array_agg((n->>'id')::uuid order by (n->>'id')::uuid) into expected from jsonb_array_elements(numbers) n;
  select array_agg(x::uuid order by x::uuid) into supplied from jsonb_array_elements_text(p_values->'accounts') x;
  if expected is distinct from supplied or not public.care_cycle_composition_valid(numbers) then raise exception 'GROUP_PARTICIPANTS_CHANGED';end if;
  if exists(select 1 from public.whatsapp_send_attempts where activity_group_id=g.id and state in ('started','unknown')) then raise exception 'GROUP_SEND_UNRESOLVED';end if;
  if c.state='closed' then perform public.create_care_cycle_internal(g.id,numbers);
  else
   update public.whatsapp_care_cycles set consented_numbers=numbers,revision=revision+1,state=case when group_jid is null then 'draft' else 'preparing' end,
    admission_id=case when p_action='rejoin' then gen_random_uuid() else admission_id end,prepared=false,reason='preparation_required',next_run_at=now() where id=c.id;
   perform public.care_cycle_sync_accounts(c.id);
   update public.whatsapp_care_groups set entry_pending=entry_pending or p_action='rejoin',revoked_at=null,controls_verified=false,state=case when group_jid is null then 'requested' else 'waiting_customer' end,reason='preparation_required' where id=g.id;
  end if;
  -- Voltar não altera avisos, cap mensal, privacidade ou pausa proativa.
  select * into p from public.profiles where id=g.customer_id;
  insert into public.whatsapp_group_enrollments(group_id,profile_phone,profile_verified_at) values(g.id,p.whatsapp_e164,p.whatsapp_verified_at)
   on conflict(group_id) do update set expires_at=now()+interval '1 hour' where whatsapp_group_enrollments.profile_phone is not distinct from p.whatsapp_e164 and whatsapp_group_enrollments.profile_verified_at is not distinct from p.whatsapp_verified_at;
 else raise exception 'GROUP_INVALID';end if;
 update public.whatsapp_care_groups set version=version+1 where id=g.id;
 insert into public.whatsapp_care_audit(group_id,actor,action,detail) values(g.id,auth.uid(),p_action,jsonb_build_object('cycle_id',c.id,'source','application'));
 return public.care_group_read(g.barbershop_id);
end $$;

create function public.record_care_cycle_observation(p_cycle uuid,p_token uuid,p_cycle_proof jsonb,p_snapshot jsonb,p_invite text default null) returns void
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_care_cycles%rowtype;g public.whatsapp_care_groups%rowtype;m jsonb;phones text[]:='{}';expected text[];phone text;present boolean:=false;ready boolean;first public.whatsapp_care_cycle_steps%rowtype;
begin
 perform public.authorize_care_cycle(p_cycle,p_token);
 select * into c from public.whatsapp_care_cycles where id=p_cycle for update;
 select * into g from public.whatsapp_care_groups where id=c.group_id for update;
 select array_agg(n->>'phone' order by n->>'phone') into expected from jsonb_array_elements(c.consented_numbers) n;
 if p_cycle_proof->>'cycleId' is distinct from c.id::text or p_cycle_proof->>'groupJid' is distinct from c.group_jid
  or p_cycle_proof->>'customerJid' is distinct from substring(c.customer_phone from 2)||'@s.whatsapp.net'
  or (p_cycle_proof->>'createdAt')::timestamptz is distinct from c.created_at or (p_cycle_proof->>'expiresAt')::timestamptz is distinct from c.expires_at
  or p_snapshot->>'id' is distinct from c.group_jid or p_snapshot->>'locked' is distinct from 'true' or p_snapshot->>'adminsAddOnly' is distinct from 'true'
  or p_snapshot->>'approvalRequired' is distinct from 'true' or jsonb_typeof(p_snapshot->'participants') is distinct from 'array'
  or p_cycle_proof->>'closing' is distinct from 'false' or p_cycle_proof->>'closed' is distinct from 'false' or p_cycle_proof->>'firstViolation' is distinct from 'false' then raise exception 'GROUP_UNVERIFIABLE';end if;
 for m in select value from jsonb_array_elements(p_snapshot->'participants') loop
  if m->>'jid' is null or m->>'jid' !~ '^[1-9][0-9]{7,14}@s\.whatsapp\.net$' then raise exception 'GROUP_UNVERIFIABLE';end if;
  phone:='+'||split_part(m->>'jid','@',1);
  if phone=c.customer_phone then
   if present or m->>'admin' is distinct from 'false' then raise exception 'GROUP_DIVERGENCE';end if;present:=true;
  else
   if not phone=any(expected) or phone=any(phones) or m->>'admin' is distinct from 'true' then raise exception 'GROUP_DIVERGENCE';end if;phones:=array_append(phones,phone);
  end if;
 end loop;
 if (select array_agg(x order by x) from unnest(phones) x) is distinct from expected then raise exception 'GROUP_UNVERIFIABLE';end if;
 select * into first from public.whatsapp_care_cycle_steps where cycle_id=c.id and phase='welcome' and revision='initial' and state='accepted';
 ready:=p_cycle_proof->>'prepared'='true' and p_cycle_proof->>'logoApplied'='true' and p_cycle_proof->>'firstReceived'='true'
  and p_cycle_proof->>'firstMessageId'=first.provider_id and p_cycle_proof->>'firstWelcomeOperation'=first.id::text
  and first.instance_name<>c.creator_instance and p_cycle_proof->>'descriptionHash' ~ '^[a-f0-9]{64}$'
  and p_cycle_proof->>'pinAccepted'='true' and (p_cycle_proof->>'pinExpiresAt')::timestamptz>clock_timestamp();
 if ready is distinct from true then raise exception 'GROUP_PREPARATION_REQUIRED';end if;
 update public.whatsapp_care_cycles set prepared=true,first_received=true,first_message_id=first.provider_id,observed_at=clock_timestamp(),
  observation=jsonb_build_object('participants',p_snapshot->'participants','pin_expires_at',p_cycle_proof->>'pinExpiresAt','logo_hash',p_cycle_proof->>'logoHash'),
  state=case when present then 'active' when g.use_group and not g.entry_pending then 'customer_left' else 'waiting_customer' end,
  reason=case when present then 'verified' else 'customer_absent' end where id=c.id;
 update public.whatsapp_care_groups set observed_at=clock_timestamp(),controls_verified=true,observed_participants=p_snapshot->'participants',
  state=case when present then 'active' when use_group and not entry_pending then 'customer_left' else 'waiting_customer' end,
  use_group=use_group or present,entry_pending=case when present then false else entry_pending end,reason=case when present then 'verified' else 'customer_absent' end where id=g.id;
 if p_invite is not null then
  if present or not g.entry_pending or p_invite !~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{10,100}$' then raise exception 'GROUP_INVITE_UNAVAILABLE';end if;
  insert into public.whatsapp_care_invites(group_id,invite_url,expires_at,version) values(g.id,p_invite,least(c.expires_at,clock_timestamp()+interval '10 minutes'),g.version)
   on conflict(group_id) do update set invite_url=excluded.invite_url,expires_at=excluded.expires_at,version=excluded.version;
 end if;
end $$;

create or replace function public.care_group_invite(p_group uuid) returns text language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;url text;
begin
 select * into g from public.whatsapp_care_groups where id=p_group and customer_id=auth.uid();
 if g.id is null then raise exception 'Sem permissão' using errcode='42501';end if;
 if g.state<>'waiting_customer' or not g.entry_pending or not public.care_cycle_available(g.current_cycle_id) then raise exception 'GROUP_INVITE_UNAVAILABLE';end if;
 select invite_url into url from public.whatsapp_care_invites where group_id=g.id and version=g.version and expires_at>clock_timestamp();
 -- Não exigir observação de 30s para abrir convite: ele não autentica nem aprova a entrada.
 if url is null then
  update public.whatsapp_care_cycles set next_run_at=now() where id=g.current_cycle_id;
  return null;
 end if;
 return url;
end $$;
create function public.release_care_cycle(p_cycle uuid,p_token uuid,p_reason text default null,p_closed boolean default false) returns void
language plpgsql security definer set search_path=public as $$
begin
 if p_closed and not exists(select 1 from public.whatsapp_care_cycles c where c.id=p_cycle and c.state in ('closing','closed') and ((c.group_jid is null and c.creation_issued_at is null) or exists(select 1 from public.whatsapp_care_cycle_steps s where s.cycle_id=c.id and s.phase='close_final' and s.state='accepted'))) then raise exception 'GROUP_CLOSURE_UNPROVEN';end if;
 if p_reason is not null and p_reason not in ('operation_unknown','preparation_required','review_required','waiting_first_receipt','customer_absent','closed','cleanup_pending') then raise exception 'GROUP_INVALID';end if;
 update public.whatsapp_care_cycles set lease_token=null,lease_until=null,lease_revision=null,next_run_at=case when state='active' and p_reason is null then least(expires_at,coalesce((observation->>'pin_expires_at')::timestamptz-interval '1 day',now()+interval '4 hours'),now()+interval '4 hours') when state='waiting_customer' then now()+interval '1 minute' else now()+interval '30 seconds' end,
  reason=coalesce(p_reason,reason),state=case when p_closed then 'closed' when p_reason='operation_unknown' and group_jid is null and creation_issued_at is not null then 'creation_unknown' when p_reason in ('operation_unknown','review_required','preparation_required') and state not in ('closed','closing','customer_left') then 'paused' else state end,
  cleanup_pending=case when p_closed and group_jid is null then false else cleanup_pending end,closed_at=case when p_closed then coalesce(closed_at,now()) else closed_at end,creation_body=case when p_closed then null else creation_body end
 where id=p_cycle and lease_token=p_token;
 if found and p_reason in ('operation_unknown','review_required','preparation_required') then
  update public.whatsapp_care_groups g set controls_verified=false,observed_at=null,reason=p_reason,state=case when g.state in ('closed','customer_left','creation_unknown') then g.state when g.group_jid is null then g.state else 'paused_unavailable' end from public.whatsapp_care_cycles c where c.id=p_cycle and g.id=c.group_id;
 end if;
end $$;
create function public.queue_care_cycles() returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_agg(id),'[]') from (select c.id from public.whatsapp_care_cycles c where (c.state<>'closed' or c.cleanup_pending) and c.next_run_at<=now() and (c.lease_until is null or c.lease_until<=now())
 and ((select enabled from public.whatsapp_care_cycle_policy) or c.state in ('closing','closed') or c.group_id is null or c.expires_at<=now()) order by case when c.state in ('closing','closed') or c.expires_at<=now() or c.group_id is null then 0 else 1 end,c.next_run_at,c.id limit 5) todo;
$$;

-- Mensagens recebidas nunca alteram preferências. Tampouco guardamos seu conteúdo.
create or replace function public.care_group_event(p_instance text,p_group_jid text,p_event_key text,p_kind text,p_sender text default null,p_stop text default null,p_from_me boolean default false) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 return public.care_group_event_before_integration(p_instance,p_group_jid,p_event_key,
  case when p_kind='group.join-request' then 'group-participants.update' else p_kind end,p_sender,null,case when p_kind='messages.upsert' then p_from_me else false end);
end $$;
revoke all on function public.care_cycle_sync_accounts(uuid),public.create_care_cycle_internal(uuid,jsonb),public.record_care_cycle_observation(uuid,uuid,jsonb,jsonb,text),public.release_care_cycle(uuid,uuid,text,boolean),public.queue_care_cycles() from public,anon,authenticated,service_role;
grant execute on function public.record_care_cycle_observation(uuid,uuid,jsonb,jsonb,text),public.release_care_cycle(uuid,uuid,text,boolean),public.queue_care_cycles() to service_role;
notify pgrst,'reload schema';

-- O trabalhador antigo não pode reconstruir a preparação com um único administrador.
create or replace function public.claim_care_group_operation(p_operation uuid,p_capable boolean) returns jsonb language sql security definer set search_path=public as $$select null::jsonb;$$;
create or replace function public.queue_care_group_reconciliation() returns jsonb language sql security definer set search_path=public as $$select '[]'::jsonb;$$;

-- A prova nova vincula boas-vindas ao ciclo antes da transmissão, sem contar fixação.
create function public.whatsapp_capture_cycle_activity_scope() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.care_operation_id is not null and new.activity_group_id is null then
  select c.group_id into new.activity_group_id from public.whatsapp_care_cycle_steps s join public.whatsapp_care_cycles c on c.id=s.cycle_id
   where s.id=new.care_operation_id and s.phase='welcome' and s.state='started' and s.instance_name=new.instance_name and c.group_jid ~ '^[0-9-]+@g\.us$';
  if new.activity_group_id is not null then new.destination_kind:='groups';end if;
 end if;
 return new;
end $$;
create trigger zz_whatsapp_capture_cycle_activity_scope before insert on public.whatsapp_send_attempts for each row execute function public.whatsapp_capture_cycle_activity_scope();
revoke all on function public.whatsapp_capture_cycle_activity_scope() from public,anon,authenticated,service_role;

create function public.record_care_cycle_cleanup(p_cycle uuid,p_token uuid,p_number uuid,p_state text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if p_state not in ('accepted','pending','unknown') then raise exception 'GROUP_INVALID';end if;
 perform public.authorize_care_cycle(p_cycle,p_token,true);
 update public.whatsapp_care_cycles set cleanup_state=cleanup_state||jsonb_build_object(p_number::text,p_state)
 where id=p_cycle and state='closed' and exists(select 1 from jsonb_array_elements(consented_numbers) n where n->>'id'=p_number::text);
 update public.whatsapp_care_cycles set cleanup_pending=exists(select 1 from jsonb_array_elements(consented_numbers) n where cleanup_state->>(n->>'id') is distinct from 'accepted') where id=p_cycle and state='closed';
end $$;
revoke all on function public.record_care_cycle_cleanup(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_care_cycle_cleanup(uuid,uuid,uuid,text) to service_role;
