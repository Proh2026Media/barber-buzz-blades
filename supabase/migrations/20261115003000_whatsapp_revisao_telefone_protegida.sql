-- P-122: revisão explícita, com prova do WhatsApp e conciliação durável. Somente local.
-- Requer 02000; não liga políticas nem reescreve telefones existentes na instalação.
do $$declare k text;v text;begin
 for k,v in select key,value from jsonb_each_text($bases${"care_cycle_job(uuid)":"bcb8143e366f255e6416938a05fc641d","care_group_read(uuid,uuid)":"4c47f2de2b82279d69e571458dbc1df3","care_access_valid(uuid,uuid)":"0ddd9e4d1ada7b7fd69c24012a268aa3","care_group_phone_eligible(uuid)":"b3c57f91fc197633d72cc583fe4f0647","whatsapp_operational_number(uuid)":"f951257e263d6a81a5a9cbda741c277b","care_cycle_available(uuid,boolean)":"b25e50411be408b4d124301d0759c040","apply_verified_whatsapp(uuid,text,boolean)":"ca9d8a787e6941a64b23c8c89477d0fa","care_group_begin(uuid,boolean,uuid[],text)":"d2219ef72de4e11636f6bef5b170661d","check_whatsapp_group_phone(uuid,text,text)":"febfbf9efc36c79b52bf3cbfd52e6f53","request_whatsapp_group_login(text,text,uuid)":"91691cae03cf0cec55bd3a1dfe44c578","request_whatsapp_group_phone(uuid,text,text,uuid)":"a93590f4be6b2baf997d722b58b5015f","care_access_start(uuid,text,uuid[],boolean,uuid,bigint)":"21f07b30f0ee596ccb437a06cd81b672","whatsapp_group_login_context_before_cycles(uuid,text,boolean)":"2b671c85d44a34933be07f3e310bc911","purge_care_group_audit()":"ea35a126c5561376e77daa155fa540c5"}$bases$::jsonb) loop
 if (select md5(prosrc) from pg_proc where oid=k::regprocedure) is distinct from v then raise exception 'BC_TELEFONE_BASE_DIVERGENTE: %',k;end if;end loop;
end $$;

do $$begin
 if not exists(select 1 from public.whatsapp_send_controls where scope='global' and paused) or exists(select 1 from public.whatsapp_care_cycle_policy where enabled)
 then raise exception 'BC_PAUSAR_GRUPOS_ANTES_DO_AJUSTE';end if;
 if exists(select 1 from public.whatsapp_care_cycles where lease_until>clock_timestamp()) or exists(select 1 from public.whatsapp_care_access where lease_until>clock_timestamp()) then raise exception 'BC_AGUARDAR_OPERACOES_EM_ANDAMENTO';end if;
end $$;
create table public.whatsapp_phone_revisions (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid references public.profiles(id) on delete set null,
 barbershop_id uuid references public.barbershops(id) on delete set null,
 group_id uuid references public.whatsapp_care_groups(id) on delete set null,
 cycle_id uuid not null references public.whatsapp_care_cycles(id) on delete cascade,
 cycle_revision bigint not null,old_admission_id uuid not null,admission_id uuid not null default gen_random_uuid(),
 old_phone text not null,declared_phone text not null,resolved_phone text,
 profile_phone text,profile_verified_at timestamptz,numbers jsonb not null,
 phase text not null default 'requested' check(phase in('requested','waiting','binding','bound','committed','aborted')),
 request_hash text,commit_token uuid not null default gen_random_uuid(),
 proof jsonb,invite_url text,invite_until timestamptz,abort_requested boolean not null default false,
 requested_at timestamptz not null default clock_timestamp(),deadline timestamptz not null default clock_timestamp()+interval '20 minutes',
 lease_token uuid,lease_until timestamptz,next_at timestamptz not null default clock_timestamp(),verified_at timestamptz
);
create unique index whatsapp_phone_revision_open on public.whatsapp_phone_revisions(cycle_id) where phase<>'aborted';
create index whatsapp_phone_revision_owner on public.whatsapp_phone_revisions(customer_id,requested_at);
create table public.whatsapp_phone_aliases (
 id uuid primary key default gen_random_uuid(),
 revision_id uuid unique references public.whatsapp_phone_revisions(id) on delete set null,
 customer_id uuid not null references public.profiles(id) on delete cascade,
 declared_phone text not null,physical_phone text not null,proof_hash text not null,verified_at timestamptz,
 unique(customer_id,declared_phone)
);
alter table public.whatsapp_phone_revisions enable row level security;
alter table public.whatsapp_phone_aliases enable row level security;
revoke all on public.whatsapp_phone_revisions,public.whatsapp_phone_aliases from public,anon,authenticated,service_role;

-- Nunca normaliza por aparência. Alias vem exclusivamente da consulta privada e, para
-- uso em outras lojas/login, do OTP consumido do titular. Pendente só vale no grupo conciliado.
create function public.care_verified_physical(p_user uuid,p_phone text) returns text
language sql stable security definer set search_path=public as $$
 select coalesce((select physical_phone from public.whatsapp_phone_aliases a join public.profiles p on p.id=a.customer_id
  where a.customer_id=p_user and a.declared_phone=p_phone and a.verified_at is not null and p.whatsapp_e164=p_phone and p.whatsapp_verified_at is not null),p_phone);
$$;
create function public.care_group_physical(p_user uuid,p_phone text,p_group uuid,p_pending boolean default false) returns text
language sql stable security definer set search_path=public as $$
 select coalesce((select a.physical_phone from public.whatsapp_phone_aliases a join public.whatsapp_phone_revisions r on r.id=a.revision_id
  join public.whatsapp_care_groups g on g.id=r.group_id join public.whatsapp_care_cycles c on c.id=r.cycle_id
  where a.customer_id=p_user and a.declared_phone=p_phone and g.id=p_group and g.customer_id=p_user and g.current_cycle_id=c.id
   and r.phase='committed' and c.admission_id=r.admission_id and c.customer_phone=a.physical_phone and g.customer_phone=a.physical_phone
   and (a.verified_at is not null or p_pending)),public.care_verified_physical(p_user,p_phone));
$$;
create function public.care_physical_owned_elsewhere(p_user uuid,p_phone text) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id<>p_user and whatsapp_verified_at is not null and public.care_verified_physical(id,whatsapp_e164)=p_phone);
$$;
create function public.care_phone_revision_start(p_shop uuid,p_group uuid,p_version bigint,p_phone text,p_accounts uuid[],p_accept boolean) returns uuid
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;c public.whatsapp_care_cycles%rowtype;p public.profiles%rowtype;r public.whatsapp_phone_revisions%rowtype;phone text;expected uuid[];supplied uuid[];
begin
 if auth.uid() is null or not exists(select 1 from public.memberships where user_id=auth.uid() and barbershop_id=p_shop and role='customer') then raise exception 'Sem permissão' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));perform pg_advisory_xact_lock(hashtextextended('group-enrollment',120));
 if p_accept is distinct from true or not public.care_cycle_policy_allows(p_shop,auth.uid()) or public.whatsapp_sending_paused('',false)
  or not exists(select 1 from public.whatsapp_care_cycle_policy where singleton and assisted_access_enabled) or not public.whatsapp_complete_shop(p_shop) then raise exception 'GROUP_UNAVAILABLE';end if;
 select * into g from public.whatsapp_care_groups where id=p_group and barbershop_id=p_shop and customer_id=auth.uid() for update;
 if g.id is null or g.version is distinct from p_version then raise exception 'GROUP_STALE';end if;
 select * into c from public.whatsapp_care_cycles where id=g.current_cycle_id for update;select * into p from public.profiles where id=auth.uid();
 phone:=public.normalize_br_whatsapp(p_phone);
 if phone is null or p.whatsapp_verified_at is not null or public.care_physical_owned_elsewhere(p.id,phone) then raise exception 'GROUP_PHONE_UNAVAILABLE';end if;
 if c.id is null or c.group_jid is null or c.created_at is null or c.expires_at<=clock_timestamp() or c.state in('closing','closed','creation_unknown','customer_left')
  or g.revoked_at is not null or g.reason='operator_pause' or c.reason='operator_pause' then raise exception 'GROUP_REVIEW_REQUIRED';end if;
 if c.lease_until>clock_timestamp() or exists(select 1 from public.whatsapp_care_access where customer_id=p.id and barbershop_id=p_shop and lease_until>clock_timestamp()) then raise exception 'GROUP_BUSY';end if;
 if exists(select 1 from public.whatsapp_send_attempts where activity_group_id=g.id and state in('started','unknown'))
  or exists(select 1 from public.auth_otp_challenges x join public.whatsapp_group_login_routes y on y.challenge_id=x.id where y.group_id=g.id and x.consumed_at is null and x.expires_at>clock_timestamp()) then raise exception 'GROUP_REVIEW_REQUIRED';end if;
 if c.consented_numbers is distinct from public.care_cycle_composition(p_shop,c.id) or not public.care_cycle_composition_valid(c.consented_numbers,false) then raise exception 'GROUP_PARTICIPANTS_CHANGED';end if;
 select array_agg((n->>'id')::uuid order by (n->>'id')::uuid) into expected from jsonb_array_elements(c.consented_numbers) n;select array_agg(x order by x) into supplied from unnest(p_accounts) x;
 if supplied is distinct from expected or exists(select 1 from jsonb_array_elements(c.consented_numbers) n where n->>'phone'=phone) then raise exception 'GROUP_PARTICIPANTS_CHANGED';end if;
 select * into r from public.whatsapp_phone_revisions where cycle_id=c.id and phase<>'aborted' for update;
 if r.id is not null then
  if r.declared_phone=phone and r.profile_phone is not distinct from p.whatsapp_e164 and r.profile_verified_at is not distinct from p.whatsapp_verified_at then return r.id;end if;
  raise exception 'GROUP_REVIEW_REQUIRED';
 end if;
 if exists(select 1 from public.whatsapp_phone_revisions where customer_id=p.id and phase in('requested','waiting','binding','bound')) then raise exception 'GROUP_REVIEW_REQUIRED';end if;
 if (select count(*) from public.whatsapp_phone_revisions where customer_id=p.id and requested_at>now()-interval '1 hour')>=5 then raise exception 'WA_RATE_LIMIT';end if;
 insert into public.whatsapp_phone_revisions(customer_id,barbershop_id,group_id,cycle_id,cycle_revision,old_admission_id,old_phone,declared_phone,profile_phone,profile_verified_at,numbers)
 values(p.id,p_shop,g.id,c.id,c.revision,c.admission_id,g.customer_phone,phone,p.whatsapp_e164,p.whatsapp_verified_at,c.consented_numbers) returning id into r.id;
 delete from public.whatsapp_care_invites where group_id=g.id;
 insert into public.whatsapp_care_audit(group_id,actor,action,detail) values(g.id,p.id,'phone_revision_requested',jsonb_build_object('revision_id',r.id,'source','application'));
 if not public.care_phone_revision_valid(r.id,p.id) then raise exception 'GROUP_UNAVAILABLE';end if;
 return r.id;
end $$;
create function public.care_phone_revision_valid(p_id uuid,p_user uuid) returns boolean
language sql volatile security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_phone_revisions r join public.profiles p on p.id=r.customer_id join auth.users u on u.id=p.id
 join public.whatsapp_care_groups g on g.id=r.group_id join public.whatsapp_care_cycles c on c.id=r.cycle_id
 where r.id=p_id and r.customer_id=p_user and r.phase in('requested','waiting','binding','bound') and g.current_cycle_id=c.id and c.group_id=g.id
 and (r.deadline>clock_timestamp() or r.phase in('binding','bound') or r.abort_requested) and c.expires_at>clock_timestamp()
 and c.state not in('closed','closing','customer_left','creation_unknown') and g.revoked_at is null and g.reason<>'operator_pause' and c.reason<>'operator_pause'
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp())
 and p.whatsapp_verified_at is null and p.whatsapp_e164 is not distinct from r.profile_phone and p.whatsapp_verified_at is not distinct from r.profile_verified_at
 and public.care_cycle_policy_allows(r.barbershop_id,r.customer_id) and not public.whatsapp_sending_paused('',false)
 and exists(select 1 from public.whatsapp_care_cycle_policy where singleton and assisted_access_enabled)
 and public.whatsapp_complete_shop(r.barbershop_id) and exists(select 1 from public.memberships where user_id=p.id and barbershop_id=r.barbershop_id and role='customer')
 and r.numbers=c.consented_numbers and r.numbers=public.care_cycle_composition(r.barbershop_id,c.id) and public.care_cycle_composition_valid(r.numbers,false)
 and not exists(select 1 from jsonb_array_elements(r.numbers) n where public.whatsapp_sending_paused(n->>'instance',false))
 and c.customer_phone=case when r.phase='bound' then r.resolved_phone else r.old_phone end and g.customer_phone=c.customer_phone
 and c.admission_id=case when r.phase='bound' then r.admission_id else r.old_admission_id end
 and c.revision=r.cycle_revision+case when r.phase='bound' then 1 else 0 end
 and not public.care_physical_owned_elsewhere(p.id,coalesce(r.resolved_phone,r.declared_phone)));
$$;
create function public.claim_care_phone_revision(p_user uuid,p_shop uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.whatsapp_phone_revisions%rowtype;targets jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 select * into r from public.whatsapp_phone_revisions where customer_id=p_user and barbershop_id=p_shop and phase in('requested','waiting','binding','bound') order by requested_at desc limit 1 for update;
 if r.id is null then return null;end if;
 if not public.care_phone_revision_valid(r.id,p_user) then return jsonb_build_object('blocked',true);end if;
 if r.lease_until>clock_timestamp() or r.next_at>clock_timestamp() then return jsonb_build_object('waiting',true);end if;
 update public.whatsapp_phone_revisions set lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',next_at=clock_timestamp()+interval '10 seconds' where id=r.id returning * into r;
 select jsonb_agg(n||jsonb_build_object('version',w.routing_version)) into targets from jsonb_array_elements(r.numbers) n join public.whatsapp_channels w on w.id=(n->>'id')::uuid;
 return jsonb_build_object('id',r.id,'token',r.lease_token,'shop',r.barbershop_id,'cycle_id',r.cycle_id,'group_jid',(select group_jid from public.whatsapp_care_cycles where id=r.cycle_id),
 'phase',r.phase,'abort',r.abort_requested,'targets',targets,'creator_instance',(select creator_instance from public.whatsapp_care_cycles where id=r.cycle_id),
 'payload',jsonb_build_object('action','prepare','revisionId',r.id,'cycleId',r.cycle_id,'admissionId',r.admission_id,'oldCustomerJid',substring(r.old_phone from 2)||'@s.whatsapp.net',
 'declaredJid',substring(r.declared_phone from 2)||'@s.whatsapp.net','platformJids',(select jsonb_agg(substring(n->>'phone' from 2)||'@s.whatsapp.net' order by n->>'phone') from jsonb_array_elements(r.numbers) n),
 'deadline',r.deadline,'commitHash',encode(extensions.digest(to_jsonb(r.commit_token::text)::text,'sha256'),'hex')),
 'commit_token',case when r.phase='bound' then r.commit_token end);
end $$;
create function public.record_care_phone_revision_connections(p_id uuid,p_user uuid,p_token uuid,p_observations jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare r public.whatsapp_phone_revisions%rowtype;o jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into r from public.whatsapp_phone_revisions where id=p_id and customer_id=p_user and lease_token=p_token and lease_until>clock_timestamp() for update;
 if r.id is null or not public.care_phone_revision_valid(r.id,p_user) then raise exception 'GROUP_STALE';end if;
 if jsonb_typeof(p_observations) is distinct from 'array' or jsonb_array_length(p_observations)<>jsonb_array_length(r.numbers)
 or (select count(distinct n->>'id') from jsonb_array_elements(p_observations) n)<>jsonb_array_length(r.numbers) then raise exception 'GROUP_STALE';end if;
 for o in select value from jsonb_array_elements(p_observations) loop
  if not exists(select 1 from jsonb_array_elements(r.numbers) n join public.whatsapp_channels w on w.id=(n->>'id')::uuid where n->>'id'=o->>'id' and n->>'phone'=o->>'phone' and n->>'instance'=o->>'instance' and w.routing_version=(o->>'version')::bigint) then raise exception 'GROUP_STALE';end if;
  perform public.record_whatsapp_distribution_connection((o->>'id')::uuid,o->>'instance',o->>'phone',(o->>'version')::bigint,o->>'status',o->>'observed_phone');
 end loop;
end $$;
create function public.record_care_phone_revision(p_id uuid,p_user uuid,p_token uuid,p_proof jsonb,p_invite text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.whatsapp_phone_revisions%rowtype;c public.whatsapp_care_cycles%rowtype;expected text[];supplied text[];physical text;phase text;empty_abort boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));perform pg_advisory_xact_lock(hashtextextended('group-enrollment',120));
 select * into r from public.whatsapp_phone_revisions where id=p_id and customer_id=p_user and lease_token=p_token and lease_until>clock_timestamp() for update;
 if r.id is null or not public.care_phone_revision_valid(r.id,p_user) or not public.care_cycle_composition_valid(r.numbers) then raise exception 'GROUP_STALE';end if;
 select * into c from public.whatsapp_care_cycles where id=r.cycle_id for update;
 empty_abort:=p_proof->>'phase'='aborted' and p_proof->>'unprepared'='true';
 select array_agg(substring(n->>'phone' from 2)||'@s.whatsapp.net' order by n->>'phone') into expected from jsonb_array_elements(r.numbers) n;
 select array_agg(x order by x) into supplied from jsonb_array_elements_text(p_proof->'platformJids') x;
 if jsonb_typeof(p_proof) is distinct from 'object' or p_proof->>'id' is distinct from r.id::text or p_proof->>'cycleId' is distinct from r.cycle_id::text or p_proof->>'groupJid' is distinct from c.group_jid
 or p_proof->>'admissionId' is distinct from r.admission_id::text or p_proof->>'oldCustomerJid' is distinct from substring(r.old_phone from 2)||'@s.whatsapp.net'
 or p_proof->>'declaredJid' is distinct from substring(r.declared_phone from 2)||'@s.whatsapp.net' or (p_proof->>'deadline')::timestamptz is distinct from r.deadline
 or (p_proof->>'createdAt')::timestamptz is distinct from c.created_at or (p_proof->>'expiresAt')::timestamptz is distinct from c.expires_at
 or (not coalesce(empty_abort,false) and (p_proof->>'lookupAt' is null or (p_proof->>'lookupAt')::timestamptz>clock_timestamp()+interval '30 seconds' or (p_proof->>'lookupAt')::timestamptz<r.requested_at-interval '30 seconds'))
 or p_proof->>'commitHash' is distinct from encode(extensions.digest(to_jsonb(r.commit_token::text)::text,'sha256'),'hex') or supplied is distinct from expected
 or coalesce(p_proof->>'requestHash','') !~ '^[a-f0-9]{64}$' or (r.request_hash is not null and r.request_hash<>p_proof->>'requestHash')
 or (not coalesce(empty_abort,false) and coalesce(p_proof->>'resolvedJid','') !~ '^[1-9][0-9]{7,14}@s\.whatsapp\.net$') then raise exception 'GROUP_PHONE_PROOF_INVALID';end if;
 if empty_abort then
  if r.phase<>'requested' or r.request_hash is not null or r.resolved_phone is not null or p_proof->>'resolvedJid' is not null or p_proof->>'lookupAt' is not null then raise exception 'GROUP_PHONE_PROOF_INVALID';end if;
  update public.whatsapp_phone_revisions set phase='aborted',proof=p_proof,request_hash=p_proof->>'requestHash',invite_url=null,invite_until=null where id=r.id;
  return jsonb_build_object('commit_token',null);
 end if;
 physical:='+'||split_part(p_proof->>'resolvedJid','@',1);phase:=p_proof->>'phase';
 if r.resolved_phone is not null and r.resolved_phone<>physical then raise exception 'GROUP_PHONE_PROOF_INVALID';end if;
 if physical in(select n->>'phone' from jsonb_array_elements(r.numbers) n) or public.care_physical_owned_elsewhere(p_user,physical)
 or exists(select 1 from public.whatsapp_channels where not personal_number and regexp_replace(display_phone,'[^0-9]','','g')=substring(physical from 2)) then raise exception 'GROUP_PHONE_UNAVAILABLE';end if;
 if phase='committed' and r.phase<>'bound' then raise exception 'GROUP_PHONE_PROOF_INVALID';end if;
 if phase='aborted' and r.phase in('requested','waiting','binding') then
  update public.whatsapp_phone_revisions set phase='aborted',resolved_phone=physical,proof=p_proof,request_hash=p_proof->>'requestHash',invite_url=null,invite_until=null where id=r.id;
 elsif phase='pending' and r.phase in('requested','waiting','binding') then
  if p_invite is not null and (p_invite !~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{8,200}$') then raise exception 'GROUP_PHONE_PROOF_INVALID';end if;
  update public.whatsapp_phone_revisions set phase=case when r.phase='binding' then 'binding' else 'waiting' end,resolved_phone=physical,proof=p_proof,request_hash=p_proof->>'requestHash',invite_url=p_invite,invite_until=case when p_invite is not null then least(r.deadline,clock_timestamp()+interval '30 seconds') end where id=r.id;
 elsif phase in('bound','committed') then
  if r.phase in('requested','waiting','binding') then
   delete from public.whatsapp_care_access where customer_id=p_user and barbershop_id=r.barbershop_id;
   update public.whatsapp_care_groups set customer_phone=physical,entry_pending=true,controls_verified=false,state='waiting_customer',version=version+1,reason='preparation_required',observed_at=null where id=r.group_id;
   update public.whatsapp_care_cycles set customer_phone=physical,admission_id=r.admission_id,admission_welcome_id=null,admission_welcome_message_id=null,revision=revision+1,prepared=false,state='preparing',reason='preparation_required',observed_at=null,next_run_at=clock_timestamp() where id=r.cycle_id;
   insert into public.whatsapp_group_enrollments(group_id,profile_phone,profile_verified_at) values(r.group_id,r.profile_phone,r.profile_verified_at)
    on conflict(group_id) do update set expires_at=clock_timestamp()+interval '1 hour' where whatsapp_group_enrollments.profile_phone is not distinct from r.profile_phone and whatsapp_group_enrollments.profile_verified_at is not distinct from r.profile_verified_at;
   if not found then raise exception 'GROUP_PHONE_UNAVAILABLE';end if;
   insert into public.whatsapp_phone_aliases(revision_id,customer_id,declared_phone,physical_phone,proof_hash) values(r.id,p_user,r.declared_phone,physical,p_proof->>'requestHash');
   update public.whatsapp_phone_revisions set phase='bound',resolved_phone=physical,proof=p_proof,request_hash=p_proof->>'requestHash',invite_url=null,invite_until=null where id=r.id;
   insert into public.whatsapp_care_audit(group_id,actor,action,detail) values(r.group_id,p_user,'phone_revision_bound',jsonb_build_object('revision_id',r.id));
  end if;
  if phase='committed' then update public.whatsapp_phone_revisions set phase='committed',proof=p_proof where id=r.id;end if;
 else raise exception 'GROUP_PHONE_PROOF_INVALID';end if;
 return jsonb_build_object('commit_token',case when phase in('bound','committed') then r.commit_token end);
end $$;
create function public.authorize_care_phone_binding(p_id uuid,p_user uuid,p_token uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 if not public.care_phone_revision_valid(p_id,p_user) then raise exception 'GROUP_STALE';end if;
 update public.whatsapp_phone_revisions set phase='binding' where id=p_id and customer_id=p_user and lease_token=p_token and lease_until>clock_timestamp()
  and phase in('requested','waiting','binding') and request_hash is not null and resolved_phone is not null and deadline>clock_timestamp() and not abort_requested;
 if not found then raise exception 'GROUP_STALE';end if;
end $$;
create function public.finish_care_phone_revision(p_id uuid,p_user uuid,p_token uuid,p_failed boolean default false) returns void
language sql security definer set search_path=public as $$
 update public.whatsapp_phone_revisions set lease_token=null,lease_until=null,next_at=clock_timestamp()+case when p_failed then interval '30 seconds' else interval '10 seconds' end
 where id=p_id and customer_id=p_user and lease_token=p_token;
$$;
create function public.care_phone_revision_abort(p_shop uuid,p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sem permissão' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 update public.whatsapp_phone_revisions set abort_requested=true,next_at=clock_timestamp() where id=p_id and customer_id=auth.uid() and barbershop_id=p_shop and phase in('requested','waiting');
 if not found then raise exception 'GROUP_REVIEW_REQUIRED';end if;
end $$;
create function public.care_phone_revision_invite(p_shop uuid,p_id uuid) returns text
language sql security definer set search_path=public as $$
 select invite_url from public.whatsapp_phone_revisions where id=p_id and customer_id=auth.uid() and barbershop_id=p_shop and phase='waiting'
 and invite_until>clock_timestamp() and public.care_phone_revision_valid(id,auth.uid());
$$;

create function public.verify_care_phone_alias(p_user uuid,p_phone text,p_challenge uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.auth_otp_challenges x where x.id=p_challenge and x.user_id=p_user and x.destination=p_phone and x.purpose='verify_phone' and x.consumed_at is not null) then raise exception 'GROUP_PHONE_PROOF_INVALID';end if;
 update public.whatsapp_phone_aliases a set verified_at=clock_timestamp() from public.whatsapp_phone_revisions r,public.whatsapp_group_login_routes route,public.whatsapp_care_groups g,public.whatsapp_care_cycles c
 where r.id=a.revision_id and a.customer_id=p_user and a.declared_phone=p_phone and r.phase='committed' and route.challenge_id=p_challenge and route.group_id=r.group_id
 and g.id=r.group_id and g.current_cycle_id=c.id and c.id=r.cycle_id and c.admission_id=r.admission_id and c.customer_phone=a.physical_phone;
 update public.whatsapp_phone_revisions r set verified_at=a.verified_at from public.whatsapp_phone_aliases a where a.revision_id=r.id and a.customer_id=p_user and a.declared_phone=p_phone and a.verified_at is not null;
 -- O gatilho de identidade continua pausando os grupos. Só a janela já aceita deste
 -- desafio recebe o snapshot confirmado e pode conferir ao vivo novamente, sem novo prazo.
 update public.whatsapp_care_access a set profile_phone=p.whatsapp_e164,profile_verified_at=p.whatsapp_verified_at,next_at=clock_timestamp()
 from public.profiles p,public.whatsapp_group_login_routes route,public.whatsapp_care_groups g,public.whatsapp_care_cycles c
 where p.id=p_user and p.whatsapp_e164=p_phone and p.whatsapp_verified_at is not null and route.challenge_id=p_challenge and g.id=route.group_id
 and g.customer_id=p_user and g.current_cycle_id=c.id and c.group_id=g.id and c.state not in('closing','closed','customer_left','creation_unknown')
 and public.care_verified_physical(p_user,p_phone)=c.customer_phone and a.customer_id=p_user and a.group_id=g.id and a.cycle_id=c.id
 and a.admission_id=c.admission_id and a.phone=c.customer_phone and a.numbers=c.consented_numbers and a.expires_at>clock_timestamp();
end $$;
revoke all on function public.verify_care_phone_alias(uuid,text,uuid) from public,anon,authenticated,service_role;

-- Adesão provisória continua sem confirmar o perfil. Alias verificado é tratado como
-- a mesma identidade física em qualquer loja; nunca equivale formatos por heurística.
create or replace function public.care_group_phone_eligible(p_group uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_care_groups g join public.profiles p on p.id=g.customer_id join auth.users u on u.id=p.id
 left join public.whatsapp_group_enrollments e on e.group_id=g.id where g.id=p_group and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 and not public.care_physical_owned_elsewhere(p.id,g.customer_phone)
 and ((public.care_verified_physical(p.id,p.whatsapp_e164)=g.customer_phone and p.whatsapp_verified_at is not null)
 or (e.expires_at>now() and p.whatsapp_e164 is not distinct from e.profile_phone and p.whatsapp_verified_at is not distinct from e.profile_verified_at)));
$$;
create function pg_temp.bc_phone_patch(sig text,old text,new text) returns void language plpgsql as $$
declare definition text;begin
 definition:=pg_get_functiondef(sig::regprocedure);
 if position(old in definition)=0 then raise exception 'BC_TELEFONE_TRECHO_DIVERGENTE: %',sig;end if;
 execute replace(definition,old,new);
end $$;
select pg_temp.bc_phone_patch('public.care_group_begin(uuid,boolean,uuid[],text)',$from$phone:=public.normalize_br_whatsapp(p_phone);$from$,$to$phone:=public.normalize_br_whatsapp(p_phone);phone:=public.care_group_physical(p.id,phone,(select id from public.whatsapp_care_groups where barbershop_id=p_shop and customer_id=p.id),true);$to$);
select pg_temp.bc_phone_patch('public.care_group_begin(uuid,boolean,uuid[],text)',$from$p.whatsapp_e164 is distinct from phone$from$,$to$public.care_verified_physical(p.id,p.whatsapp_e164) is distinct from phone$to$);
select pg_temp.bc_phone_patch('public.care_group_begin(uuid,boolean,uuid[],text)',$from$exists(select 1 from public.profiles where id<>p.id and whatsapp_e164=phone and whatsapp_verified_at is not null)$from$,$to$public.care_physical_owned_elsewhere(p.id,phone)$to$);
select pg_temp.bc_phone_patch('public.care_access_start(uuid,text,uuid[],boolean,uuid,bigint)',$from$phone:=public.normalize_br_whatsapp(p_phone);$from$,$to$phone:=public.normalize_br_whatsapp(p_phone);phone:=public.care_group_physical(p.id,phone,(select id from public.whatsapp_care_groups where barbershop_id=p_shop and customer_id=p.id),true);$to$);
select pg_temp.bc_phone_patch('public.care_access_start(uuid,text,uuid[],boolean,uuid,bigint)',$from$p.whatsapp_e164 is distinct from phone$from$,$to$public.care_verified_physical(p.id,p.whatsapp_e164) is distinct from phone$to$);
select pg_temp.bc_phone_patch('public.care_access_start(uuid,text,uuid[],boolean,uuid,bigint)',$from$exists(select 1 from public.profiles where id<>p.id and whatsapp_e164=phone and whatsapp_verified_at is not null)$from$,$to$public.care_physical_owned_elsewhere(p.id,phone)$to$);
select pg_temp.bc_phone_patch('public.care_access_valid(uuid,uuid)',$from$and not exists(select 1 from public.profiles where id<>a.customer_id and whatsapp_e164=a.phone and whatsapp_verified_at is not null)$from$,$to$and not public.care_physical_owned_elsewhere(a.customer_id,a.phone) and not exists(select 1 from public.whatsapp_phone_revisions r where r.group_id=a.group_id and r.phase in('requested','waiting','binding','bound'))$to$);
select pg_temp.bc_phone_patch('public.request_whatsapp_group_phone(uuid,text,text,uuid)',$from$x.customer_phone=p_destination$from$,$to$x.customer_phone=public.care_group_physical(p_user,p_destination,x.id,true)$to$);
select pg_temp.bc_phone_patch('public.request_whatsapp_group_login(text,text,uuid)',$from$x.customer_phone=p_destination$from$,$to$x.customer_phone=public.care_group_physical((result->>'user_id')::uuid,p_destination,x.id,false)$to$);
select pg_temp.bc_phone_patch('public.whatsapp_group_login_context_before_cycles(uuid,text,boolean)',$from$customer_id=c.user_id and customer_phone=c.destination$from$,$to$customer_id=c.user_id and customer_phone=public.care_group_physical(c.user_id,c.destination,id,c.purpose='verify_phone')$to$);
select pg_temp.bc_phone_patch('public.whatsapp_group_login_context_before_cycles(uuid,text,boolean)',$from$'customer_phone',c.destination$from$,$to$'customer_phone',g.customer_phone$to$);
select pg_temp.bc_phone_patch('public.whatsapp_group_login_context_before_cycles(uuid,text,boolean)',$from$c.destination=any(platforms)$from$,$to$g.customer_phone=any(platforms)$to$);
select pg_temp.bc_phone_patch('public.check_whatsapp_group_phone(uuid,text,text)',$from$ delete from public.whatsapp_group_enrollments$from$,$to$ perform public.verify_care_phone_alias(p_user,p_destination,(result->>'challenge_id')::uuid);
 delete from public.whatsapp_group_enrollments$to$);
select pg_temp.bc_phone_patch('public.check_whatsapp_group_phone(uuid,text,text)',$from$customer_id=p_user and customer_phone=p_destination$from$,$to$customer_id=p_user and customer_phone=public.care_group_physical(p_user,p_destination,id,true)$to$);
select pg_temp.bc_phone_patch('public.whatsapp_operational_number(uuid)',$from$and not exists(select 1 from public.profiles p where regexp_replace(p.whatsapp_e164,'[^0-9]','','g')=regexp_replace(c.display_phone,'[^0-9]','','g'))$from$,$to$and not exists(select 1 from public.profiles p where regexp_replace(p.whatsapp_e164,'[^0-9]','','g')=regexp_replace(c.display_phone,'[^0-9]','','g')) and not exists(select 1 from public.whatsapp_phone_aliases a where regexp_replace(c.display_phone,'[^0-9]','','g') in(substring(a.physical_phone from 2),substring(a.declared_phone from 2)))$to$);

-- Wrapper sem mudar OID/ACL: congela o motor normal enquanto as duas camadas divergem.
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.care_cycle_available(uuid,boolean)'::regprocedure);
 execute replace(definition,'CREATE OR REPLACE FUNCTION public.care_cycle_available(','CREATE OR REPLACE FUNCTION public.care_cycle_available_before_phone_revision(');
 definition:=pg_get_functiondef('public.care_group_read(uuid,uuid)'::regprocedure);
 execute replace(definition,'CREATE OR REPLACE FUNCTION public.care_group_read(','CREATE OR REPLACE FUNCTION public.care_group_read_before_phone_revision(');
 definition:=pg_get_functiondef('public.apply_verified_whatsapp(uuid,text,boolean)'::regprocedure);
 execute replace(definition,'CREATE OR REPLACE FUNCTION public.apply_verified_whatsapp(','CREATE OR REPLACE FUNCTION public.apply_verified_whatsapp_before_phone_revision(');
end $$;
revoke all on function public.care_cycle_available_before_phone_revision(uuid,boolean),public.care_group_read_before_phone_revision(uuid,uuid),public.apply_verified_whatsapp_before_phone_revision(uuid,text,boolean) from public,anon,authenticated,service_role;
create or replace function public.care_cycle_available(p_cycle uuid,p_live boolean default true) returns boolean
language sql stable security definer set search_path=public as $$
 select public.care_cycle_available_before_phone_revision(p_cycle,p_live) and not exists(select 1 from public.whatsapp_phone_revisions where cycle_id=p_cycle and phase in('requested','waiting','binding','bound'));
$$;
create or replace function public.apply_verified_whatsapp(p_user_id uuid,p_whatsapp text,p_opt_in boolean default true) returns public.profiles
language plpgsql security definer set search_path=public as $$
declare result public.profiles;phone text;physical text;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 phone:=public.normalize_br_whatsapp(p_whatsapp);physical:=public.care_verified_physical(p_user_id,phone);
 select physical_phone into physical from public.whatsapp_phone_aliases a join public.whatsapp_phone_revisions r on r.id=a.revision_id where a.customer_id=p_user_id and a.declared_phone=phone and r.phase='committed';
 physical:=coalesce(physical,public.care_verified_physical(p_user_id,phone));
 if public.care_physical_owned_elsewhere(p_user_id,physical) then raise exception 'Este WhatsApp já está em outra conta' using errcode='23505';end if;
 result:=public.apply_verified_whatsapp_before_phone_revision(p_user_id,phone,p_opt_in);
 return result;
end $$;
create or replace function public.care_group_read(p_shop uuid,p_customer uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;r public.whatsapp_phone_revisions%rowtype;p public.profiles%rowtype;g public.whatsapp_care_groups%rowtype;allowed boolean;
begin
 result:=public.care_group_read_before_phone_revision(p_shop,p_customer);
 select * into p from public.profiles where id=auth.uid();select * into g from public.whatsapp_care_groups where barbershop_id=p_shop and customer_id=p.id;
 select * into r from public.whatsapp_phone_revisions where group_id=g.id order by requested_at desc limit 1;
 allowed:=(result->'access'->>'enabled')::boolean and p.whatsapp_verified_at is null and g.id is not null and g.group_jid is not null and g.state<>'active' and g.revoked_at is null and g.reason<>'operator_pause' and result->'group'->>'cycle_state' not in('closing','closed','customer_left','creation_unknown') and not coalesce((result->'group'->>'numbers_changed')::boolean,false) and not coalesce((result->'group'->>'closing')::boolean,false);
 return result||jsonb_build_object('phone',case when r.phase in('requested','waiting','bound','committed') then r.declared_phone when p.whatsapp_verified_at is not null and public.care_verified_physical(p.id,p.whatsapp_e164)=g.customer_phone then p.whatsapp_e164 else result->>'phone' end,
 'phone_confirmed',p.whatsapp_verified_at is not null and public.care_verified_physical(p.id,p.whatsapp_e164)=g.customer_phone,
 'phone_revision',jsonb_build_object('contract','bc-phone-revision-v1','enabled',coalesce(allowed,false),'id',r.id,'phase',r.phase,
 'active',coalesce(public.care_phone_revision_valid(r.id,p.id),false),'expired',r.phase in('requested','waiting') and r.deadline<=clock_timestamp(),
 'old_phone',coalesce(r.profile_phone,r.old_phone,g.customer_phone),'declared_phone',r.declared_phone,'next_check_at',r.next_at,'deadline',r.deadline,
 'pending',coalesce(r.phase in('requested','waiting','binding','bound'),false)));
end $$;
revoke all on function public.care_verified_physical(uuid,text),public.care_group_physical(uuid,text,uuid,boolean),public.care_physical_owned_elsewhere(uuid,text),public.care_phone_revision_valid(uuid,uuid),public.care_phone_revision_start(uuid,uuid,bigint,text,uuid[],boolean),public.claim_care_phone_revision(uuid,uuid),public.record_care_phone_revision_connections(uuid,uuid,uuid,jsonb),public.record_care_phone_revision(uuid,uuid,uuid,jsonb,text),public.finish_care_phone_revision(uuid,uuid,uuid,boolean),public.authorize_care_phone_binding(uuid,uuid,uuid),public.care_phone_revision_abort(uuid,uuid),public.care_phone_revision_invite(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.care_phone_revision_start(uuid,uuid,bigint,text,uuid[],boolean),public.care_phone_revision_abort(uuid,uuid),public.care_phone_revision_invite(uuid,uuid) to authenticated;
grant execute on function public.claim_care_phone_revision(uuid,uuid),public.record_care_phone_revision_connections(uuid,uuid,uuid,jsonb),public.record_care_phone_revision(uuid,uuid,uuid,jsonb,text),public.finish_care_phone_revision(uuid,uuid,uuid,boolean),public.authorize_care_phone_binding(uuid,uuid,uuid) to service_role;
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.care_cycle_job(uuid)'::regprocedure);
 execute replace(definition,'CREATE OR REPLACE FUNCTION public.care_cycle_job(','CREATE OR REPLACE FUNCTION public.care_cycle_job_before_phone_revision(');
end $$;
revoke all on function public.care_cycle_job_before_phone_revision(uuid) from public,anon,authenticated,service_role;
create or replace function public.care_cycle_job(p_cycle uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select public.care_cycle_job_before_phone_revision(p_cycle)||jsonb_build_object('phone_revision',
 (select jsonb_build_object('id',r.id,'cycleId',r.cycle_id,'admissionId',r.admission_id,'oldCustomerJid',substring(r.old_phone from 2)||'@s.whatsapp.net',
 'declaredJid',substring(r.declared_phone from 2)||'@s.whatsapp.net','commitHash',encode(extensions.digest(to_jsonb(r.commit_token::text)::text,'sha256'),'hex'))
 from public.whatsapp_phone_revisions r where r.cycle_id=p_cycle and phase<>'aborted' order by requested_at desc limit 1));
$$;
notify pgrst,'reload schema';

create function public.continue_care_phone_revision(p_shop uuid,p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare r public.whatsapp_phone_revisions%rowtype;g public.whatsapp_care_groups%rowtype;a uuid;
begin
 select * into r from public.whatsapp_phone_revisions where id=p_id and customer_id=auth.uid() and barbershop_id=p_shop and phase='committed' and deadline>clock_timestamp();
 if r.id is null then return;end if;
 select * into g from public.whatsapp_care_groups where id=r.group_id and current_cycle_id=r.cycle_id;
 if g.id is null then raise exception 'GROUP_STALE';end if;
 a:=public.care_access_start(p_shop,r.declared_phone,array(select (n->>'id')::uuid from jsonb_array_elements(r.numbers) n),true,g.id,g.version);
 update public.whatsapp_care_access set expires_at=least(expires_at,r.deadline) where id=a and customer_id=auth.uid();
end $$;
revoke all on function public.continue_care_phone_revision(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.continue_care_phone_revision(uuid,uuid) to authenticated;

-- Retenção não apaga diário de vínculo incerto. Alias já verificado sobrevive ao grupo
-- encerrado para a mesma conta poder usar outras lojas; é apagado com o perfil.
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.purge_care_group_audit()'::regprocedure);
 execute replace(definition,'CREATE OR REPLACE FUNCTION public.purge_care_group_audit(','CREATE OR REPLACE FUNCTION public.purge_care_group_audit_before_phone_revision(');
end $$;
revoke all on function public.purge_care_group_audit_before_phone_revision() from public,anon,authenticated,service_role;
create or replace function public.purge_care_group_audit() returns void
language plpgsql security definer set search_path=public as $$
begin
 perform public.purge_care_group_audit_before_phone_revision();
 update public.whatsapp_phone_revisions set invite_url=null,invite_until=null where invite_until<=clock_timestamp();
 delete from public.whatsapp_phone_revisions r where (r.phase='aborted' and r.requested_at<now()-interval '30 days')
  or exists(select 1 from public.whatsapp_care_cycles c where c.id=r.cycle_id and c.state='closed' and not c.cleanup_pending and c.closed_at<now()-interval '90 days');
 delete from public.whatsapp_phone_aliases where revision_id is null and verified_at is null;
end $$;

-- Duas cascatas do mesmo auth.users alcançam auditoria: perfil/grupo remove a linha,
-- actor SET NULL pode tentar atualizá-la depois. Destacar o ator antes das cascatas
-- preserva a semântica original de privacidade e não apaga prova de ciclo incerto.
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.whatsapp_care_audit'::regclass and conname='whatsapp_care_audit_actor_fkey' and confrelid='auth.users'::regclass and confdeltype='n')
  or not exists(select 1 from pg_constraint where conrelid='public.whatsapp_care_audit'::regclass and conname='whatsapp_care_audit_group_id_fkey' and confdeltype='c') then raise exception 'BC_AUDITORIA_BASE_DIVERGENTE';end if;
end $$;
create function public.care_detach_deleted_audit_actor() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.whatsapp_care_audit set actor=null where actor=old.id;
 return old;
end $$;
revoke all on function public.care_detach_deleted_audit_actor() from public,anon,authenticated,service_role;
create trigger care_detach_deleted_audit_actor before delete on auth.users for each row execute function public.care_detach_deleted_audit_actor();
