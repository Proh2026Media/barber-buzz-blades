-- Incremental sobre o conjunto P-122/v5. Não reaplicar as 14 migrations anteriores.
-- Instalação somente com política pausada; nunca recria grupo nem reinicia seu prazo.
do $$begin
 if to_regclass('public.whatsapp_care_cycles') is null then raise exception 'BC_BASE_P122_REQUIRED';end if;
 if exists(select 1 from public.whatsapp_care_cycle_policy where enabled) then raise exception 'BC_PAUSAR_GRUPOS_ANTES_DO_AJUSTE';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 if exists(select 1 from public.whatsapp_care_cycles where lease_until>clock_timestamp())
  or exists(select 1 from public.whatsapp_outbox where status='sending')
  or exists(select 1 from public.whatsapp_send_attempts where state='started' and started_at>clock_timestamp()-interval '2 minutes') then raise exception 'BC_AGUARDAR_OPERACOES_EM_ANDAMENTO';end if;
end $$;
alter table public.whatsapp_care_cycles add column admission_welcome_id uuid,
 add column admission_welcome_message_id text check(length(admission_welcome_message_id) between 1 and 200);
alter function public.record_care_cycle_observation(uuid,uuid,jsonb,jsonb,text) rename to record_care_cycle_observation_before_post_entry;
revoke all on function public.record_care_cycle_observation_before_post_entry(uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated,service_role;
create function public.record_care_cycle_observation(p_cycle uuid,p_token uuid,p_cycle_proof jsonb,p_snapshot jsonb,p_invite text default null) returns void
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_care_cycles%rowtype;g public.whatsapp_care_groups%rowtype;m jsonb;phones text[]:='{}';expected text[];phone text;present boolean:=false;ready boolean;welcomed public.whatsapp_care_cycle_steps%rowtype;first public.whatsapp_care_cycle_steps%rowtype;
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
 if p_cycle_proof->>'prepared' is distinct from 'true' or p_cycle_proof->>'logoApplied' is distinct from 'true' then raise exception 'GROUP_PREPARATION_REQUIRED';end if;
 select * into first from public.whatsapp_care_cycle_steps where cycle_id=c.id and phase='welcome' and revision='initial' and state='accepted';
 select * into welcomed from public.whatsapp_care_cycle_steps where cycle_id=c.id and phase='welcome' and state='accepted'
  and id=(p_cycle_proof->'welcomeAdmissions'->>c.admission_id::text)::uuid
  and id::text=p_cycle_proof->>'lastWelcomeOperation' and provider_id=p_cycle_proof->>'lastWelcomeMessageId' and instance_name<>c.creator_instance;
 ready:=present and p_cycle_proof->>'firstReceived'='true' and p_cycle_proof->>'firstMessageId'=first.provider_id
  and p_cycle_proof->>'firstWelcomeOperation'=first.id::text and first.instance_name<>c.creator_instance
  and welcomed.id is not null and p_cycle_proof->>'lastWelcomeAdmissionId'=c.admission_id::text
  and p_cycle_proof->>'lastWelcomeReceived'='true' and p_cycle_proof->>'descriptionHash' ~ '^[a-f0-9]{64}$'
  and p_cycle_proof->>'pinAccepted'='true' and (p_cycle_proof->>'pinExpiresAt')::timestamptz>clock_timestamp();
 update public.whatsapp_care_cycles set prepared=true,
  first_received=case when ready then true else first_received end,first_message_id=case when ready then first.provider_id else first_message_id end,
  admission_welcome_id=case when ready then c.admission_id else null end,admission_welcome_message_id=case when ready then welcomed.provider_id else null end,
  observed_at=clock_timestamp(),observation=jsonb_build_object('participants',p_snapshot->'participants','pin_expires_at',p_cycle_proof->>'pinExpiresAt','logo_hash',p_cycle_proof->>'logoHash'),
  state=case when ready then 'active' when present then 'preparing' when g.use_group and not g.entry_pending then 'customer_left' else 'waiting_customer' end,
  reason=case when ready then 'verified' when present then 'waiting_first_receipt' else 'customer_absent' end where id=c.id;
 update public.whatsapp_care_groups set observed_at=clock_timestamp(),controls_verified=ready is true,observed_participants=p_snapshot->'participants',
  state=case when ready then 'active' when present then 'creating' when use_group and not entry_pending then 'customer_left' else 'waiting_customer' end,
  use_group=use_group or present,entry_pending=case when ready then false else entry_pending end,
  reason=case when ready then 'verified' when present then 'waiting_first_receipt' else 'customer_absent' end where id=g.id;
 if p_invite is not null then
  if present or not g.entry_pending or p_invite !~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{10,100}$' then raise exception 'GROUP_INVITE_UNAVAILABLE';end if;
  insert into public.whatsapp_care_invites(group_id,invite_url,expires_at,version) values(g.id,p_invite,least(c.expires_at,clock_timestamp()+interval '10 minutes'),g.version)
   on conflict(group_id) do update set invite_url=excluded.invite_url,expires_at=excluded.expires_at,version=excluded.version;
 end if;
end $$;

revoke all on function public.record_care_cycle_observation(uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.record_care_cycle_observation(uuid,uuid,jsonb,jsonb,text) to service_role;
alter function public.care_cycle_send_ready(uuid) rename to care_cycle_send_ready_before_post_entry;
revoke all on function public.care_cycle_send_ready_before_post_entry(uuid) from public,anon,authenticated,service_role;
create function public.care_cycle_send_ready(p_group uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.care_cycle_send_ready_before_post_entry(p_group) and exists(select 1 from public.whatsapp_care_groups g join public.whatsapp_care_cycles c on c.id=g.current_cycle_id where g.id=p_group and c.admission_welcome_id=c.admission_id and c.admission_welcome_message_id is not null);
$$;
revoke all on function public.care_cycle_send_ready(uuid) from public,anon,authenticated,service_role;
alter function public.whatsapp_group_login_context(uuid,text,boolean) rename to whatsapp_group_login_context_before_post_entry;
revoke all on function public.whatsapp_group_login_context_before_post_entry(uuid,text,boolean) from public,anon,authenticated,service_role;
create function public.whatsapp_group_login_context(p_challenge_id uuid,p_code_hash text,p_unused boolean default true) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;c public.whatsapp_care_cycles%rowtype;
begin
 result:=public.whatsapp_group_login_context_before_post_entry(p_challenge_id,p_code_hash,p_unused);
 if result is null then return null;end if;
 select * into c from public.whatsapp_care_cycles where id=(result->>'cycle_id')::uuid;
 return result||jsonb_build_object('admission_id',c.admission_id,'welcome_message_id',c.admission_welcome_message_id);
end $$;
alter function public.whatsapp_group_notice_context(uuid,uuid) rename to whatsapp_group_notice_context_before_post_entry;
revoke all on function public.whatsapp_group_notice_context_before_post_entry(uuid,uuid) from public,anon,authenticated,service_role;
create function public.whatsapp_group_notice_context(p_outbox_id uuid,p_lease_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;c public.whatsapp_care_cycles%rowtype;
begin
 result:=public.whatsapp_group_notice_context_before_post_entry(p_outbox_id,p_lease_token);
 if result is null then return null;end if;
 select * into c from public.whatsapp_care_cycles where id=(result->>'cycle_id')::uuid;
 return result||jsonb_build_object('admission_id',c.admission_id,'welcome_message_id',c.admission_welcome_message_id);
end $$;
revoke all on function public.whatsapp_group_login_context(uuid,text,boolean),public.whatsapp_group_notice_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.whatsapp_group_login_context(uuid,text,boolean),public.whatsapp_group_notice_context(uuid,uuid) to service_role;
-- Revalidação viva, com o mesmo JID, datas, admissão e preferências. Nenhuma mensagem aqui.
update public.whatsapp_care_cycles set prepared=false,revision=revision+1,lease_token=null,lease_until=null,lease_revision=null,reason='preparation_required',next_run_at=now() where state not in ('closing','closed');
update public.whatsapp_care_groups set controls_verified=false,version=version+1,reason='preparation_required' where current_cycle_id in(select id from public.whatsapp_care_cycles where state not in ('closing','closed'));
notify pgrst,'reload schema';
