-- D4 local. Não instalar isoladamente: requer D1/D2/D3 e o fechamento da integração.
-- Não herdar flags de pilotos anteriores: o contrato novo exige comprovação própria.
create table public.whatsapp_care_cycle_policy (
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,
 pilot_shop_id uuid,pilot_customer_id uuid,
 check((pilot_shop_id is null)=(pilot_customer_id is null)),
 version bigint not null default 1,changed_at timestamptz not null default now(),changed_by uuid references auth.users(id) on delete set null
);
insert into public.whatsapp_care_cycle_policy default values;
create function public.care_cycle_policy_allows(p_shop uuid,p_customer uuid) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select enabled and (pilot_shop_id is null or (pilot_shop_id=p_shop and pilot_customer_id=p_customer)) from public.whatsapp_care_cycle_policy),false);
$$;
revoke all on function public.care_cycle_policy_allows(uuid,uuid) from public,anon,authenticated,service_role;

create table public.whatsapp_care_cycles (
 id uuid primary key default gen_random_uuid(),group_id uuid references public.whatsapp_care_groups(id) on delete set null,
 group_jid text unique check(group_jid ~ '^[0-9-]+@g\.us$'),
 state text not null default 'draft' check(state in ('draft','creating','creation_unknown','preparing','waiting_customer','active','customer_left','paused','closing','closed')),
 customer_phone text not null check(customer_phone ~ '^\+[1-9][0-9]{7,14}$'),
 consented_numbers jsonb not null check(jsonb_typeof(consented_numbers)='array'),
 creator_channel_id uuid,creator_instance text not null,provider_creator_id text,
 creation_operation uuid not null default gen_random_uuid() unique,creation_body jsonb,creation_hash text check(creation_hash ~ '^[a-f0-9]{64}$'),
 creation_issued_at timestamptz,created_at timestamptz,expires_at timestamptz,
 revision bigint not null default 1,admission_id uuid not null default gen_random_uuid(),
 prepared boolean not null default false,first_received boolean not null default false,first_message_id text,
 observed_at timestamptz,observation jsonb,invite_expires_at timestamptz,
 reason text not null default 'preparation_required',next_run_at timestamptz not null default now(),
 legacy_closing boolean not null default false,cleanup_pending boolean not null default true,cleanup_state jsonb not null default '{}',
 lease_token uuid,lease_until timestamptz,lease_revision bigint,closed_at timestamptz,
 requested_at timestamptz not null default now(),
 check((created_at is null)=(expires_at is null)),check(expires_at is null or expires_at>created_at),
 check(creation_body is null or (jsonb_typeof(creation_body)='object' and creation_hash is not null))
);
create unique index whatsapp_care_one_open_cycle on public.whatsapp_care_cycles(group_id) where state<>'closed';
alter table public.whatsapp_care_groups add column current_cycle_id uuid references public.whatsapp_care_cycles(id) on delete set null;
create table public.whatsapp_care_cycle_steps (
 id uuid primary key default gen_random_uuid(),cycle_id uuid not null references public.whatsapp_care_cycles(id) on delete cascade,
 phase text not null check(phase in ('create','prepare','welcome','pin','close_start','close_leave','close_final','close_withdraw','close_delete')),
 revision text not null check(length(revision) between 1 and 200),instance_name text not null,
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 state text not null default 'started' check(state in ('started','accepted','unknown')),
 provider_id text check(length(provider_id)<=200),started_at timestamptz not null default now(),finished_at timestamptz,
 unique(cycle_id,phase,revision)
);
do $$declare n text;begin foreach n in array array['whatsapp_care_cycle_policy','whatsapp_care_cycles','whatsapp_care_cycle_steps'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',n);
end loop;end $$;

-- Identidade e controle são mais duráveis que uma observação de conexão. Fechamento pode
-- precisar retirar uma conta offline; isso não lhe concede licença para transmitir.
create function public.care_cycle_number_valid(p_id uuid,p_identity jsonb,p_live boolean default true) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_channels c where c.id=p_id
  and public.whatsapp_operational_number(c.id)
  and p_identity=jsonb_build_object('id',c.id,'phone','+'||regexp_replace(c.display_phone,'[^0-9]','','g'),'instance',c.instance_name)
  and c.platform_control_identity=jsonb_build_object('phone',regexp_replace(c.display_phone,'[^0-9]','','g'),'instance',c.instance_name)
  and (not p_live or (c.status='open' and c.connection_observed_at>clock_timestamp()-interval '2 minutes'
   and not public.whatsapp_sending_paused(c.instance_name,false))));
$$;

create function public.care_cycle_sender_instance(p_shop uuid) returns text language sql stable security definer set search_path=public as $$
 select case when delivery_mode='primary' then instance_name when delivery_mode='backup' and delivery_reason='technical_failure' then backup_instance_name end
 from public.whatsapp_delivery_channels where barbershop_id=p_shop and staff_id is null;
$$;
revoke all on function public.care_cycle_sender_instance(uuid) from public,anon,authenticated,service_role;

-- Composição das contas DE ENVIO da loja e de seus profissionais (nunca usuários da equipe).
-- A união é mostrada inteira ao cliente para consentimento; inclui o criador histórico.
-- Limite operacional de 20 contas: excedentes exigem simplificar a distribuição, nunca truncar.
create function public.care_cycle_composition(p_shop uuid,p_cycle uuid default null) returns jsonb
language sql stable security definer set search_path=public as $$
 with route as(select l.* from public.whatsapp_number_links l where l.barbershop_id=p_shop and l.removed_at is null),
 ids as(select unnest(array[channel_id,backup_channel_id,backup2_channel_id]) id from route
  union select creator_channel_id from public.whatsapp_care_cycles where id=p_cycle and state<>'closed'),
 numbers as(select c.id,'+'||regexp_replace(c.display_phone,'[^0-9]','','g') phone,c.instance_name instance,
  case when exists(select 1 from route where staff_id is null and channel_id=c.id) then 0 when exists(select 1 from route where staff_id is null and backup_channel_id=c.id) then 1 when exists(select 1 from route where staff_id is null and backup2_channel_id=c.id) then 2 else 3 end position
  from ids join public.whatsapp_channels c on c.id=ids.id
  where public.care_cycle_number_valid(c.id,jsonb_build_object('id',c.id,'phone','+'||regexp_replace(c.display_phone,'[^0-9]','','g'),'instance',c.instance_name),false))
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'phone',phone,'instance',instance) order by position,id),'[]') from numbers;
$$;
create function public.care_cycle_composition_valid(p_numbers jsonb,p_live boolean default true) returns boolean
language sql stable security definer set search_path=public as $$
 select case when jsonb_typeof(p_numbers)<>'array' then false else
  jsonb_array_length(p_numbers) between 2 and 20
  and not exists(select 1 from jsonb_array_elements(p_numbers) n where not public.care_cycle_number_valid((n->>'id')::uuid,n,false) or public.whatsapp_number_restricted((n->>'id')::uuid))
  and (not p_live or (select count(*)>=2 from jsonb_array_elements(p_numbers) n where public.care_cycle_number_valid((n->>'id')::uuid,n,true)))
  and (select count(*)=count(distinct n->>'phone') and count(*)=count(distinct n->>'instance') from jsonb_array_elements(p_numbers) n) end;
$$;
create function public.care_cycle_content_context(p_cycle uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('shop_id',b.id,'shop_name',coalesce(nullif(trim(s.display_name),''),b.name),
  'customer_name',case when p.full_name like '%@%' then 'Cliente' else coalesce(nullif(trim(p.full_name),''),'Cliente') end,
  'slug',b.slug,'timezone',b.timezone,'logo_url',s.logo_url,
  'starts_at',(select min(a.starts_at) from public.appointments a where a.barbershop_id=b.id and a.customer_id=g.customer_id and a.status='confirmed' and a.starts_at>now()))
 from public.whatsapp_care_cycles c join public.whatsapp_care_groups g on g.id=c.group_id
 join public.barbershops b on b.id=g.barbershop_id join public.barbershop_settings s on s.barbershop_id=b.id join public.profiles p on p.id=g.customer_id where c.id=p_cycle;
$$;

-- Tabelas privadas; todos os caminhos de autorização revalidam o perfil e a composição.
create function public.care_cycle_available(p_cycle uuid,p_live boolean default true) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_care_cycles c join public.whatsapp_care_groups g on g.id=c.group_id
  join public.whatsapp_care_cycle_policy policy on policy.singleton and policy.enabled
  where c.id=p_cycle and g.current_cycle_id=c.id and c.state not in ('closing','closed')
   and (c.expires_at is null or c.expires_at>clock_timestamp()) and g.revoked_at is null and g.reason<>'operator_pause'
   and public.care_cycle_policy_allows(g.barbershop_id,g.customer_id)
   and public.whatsapp_complete_shop(g.barbershop_id) and public.care_group_phone_eligible(g.id)
   and exists(select 1 from public.memberships m where m.user_id=g.customer_id and m.barbershop_id=g.barbershop_id and m.role='customer')
   and g.customer_phone=c.customer_phone and not exists(select 1 from jsonb_array_elements(c.consented_numbers) n where n->>'phone'=c.customer_phone)
   and public.care_cycle_composition_valid(c.consented_numbers,false)
   and exists(select 1 from jsonb_array_elements(c.consented_numbers) n where n->>'instance'=public.care_cycle_sender_instance(g.barbershop_id) and public.care_cycle_number_valid((n->>'id')::uuid,n,p_live))
   and c.consented_numbers=public.care_cycle_composition(g.barbershop_id,c.id));
$$;

create function public.care_cycle_job(p_cycle uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',c.id,'token',c.lease_token,'revision',c.revision,'group_id',c.group_id,'group_jid',c.group_jid,
  'state',c.state,'legacy_closing',c.legacy_closing,'cleanup_pending',c.cleanup_pending,'cleanup_state',c.cleanup_state,'customer_phone',c.customer_phone,'numbers',c.consented_numbers,'creator_channel_id',c.creator_channel_id,
  'creator_instance',c.creator_instance,'provider_creator_id',c.provider_creator_id,'creation_operation',c.creation_operation,
  'creation_body',c.creation_body,'creation_hash',c.creation_hash,'creation_issued_at',c.creation_issued_at,'admission_id',c.admission_id,
  'created_at',c.created_at,'expires_at',c.expires_at,'content',public.care_cycle_content_context(c.id),
  'entry_pending',coalesce(g.entry_pending,false),'steps',coalesce((select jsonb_agg(to_jsonb(s)-'cycle_id' order by s.started_at,s.id) from public.whatsapp_care_cycle_steps s where s.cycle_id=c.id),'[]'))
 from public.whatsapp_care_cycles c left join public.whatsapp_care_groups g on g.id=c.group_id where c.id=p_cycle;
$$;
create function public.claim_care_cycle(p_cycle uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_care_cycles%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
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
end $$;
create function public.authorize_care_cycle(p_cycle uuid,p_token uuid,p_closing boolean default false,p_step uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_care_cycles%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 select * into c from public.whatsapp_care_cycles where id=p_cycle and lease_token=p_token and lease_until>clock_timestamp() for update;
 if c.id is null or c.revision<>c.lease_revision then raise exception 'GROUP_STALE';end if;
 if p_closing then
  if c.state not in ('closing','closed') or c.group_jid is null then raise exception 'GROUP_STALE';end if;
 else
  if not public.care_cycle_available(c.id) then raise exception 'GROUP_STALE';end if;
  if exists(select 1 from public.whatsapp_send_attempts a where a.activity_group_id=c.group_id and a.state in ('started','unknown') and not (a.state='started' and a.care_operation_id=p_step and exists(select 1 from public.whatsapp_care_cycle_steps s where s.id=p_step and s.cycle_id=c.id))) then raise exception 'GROUP_SEND_UNRESOLVED';end if;
 end if;
 return public.care_cycle_job(c.id);
end $$;

-- Requisição de criação imutável ANTES da chamada. Não é reconstruída com um nome/rota novo
-- depois de incerteza. Ausência no diário remoto não autoriza segunda criação.
create function public.seal_care_cycle_creation(p_cycle uuid,p_token uuid,p_instance_id text,p_body jsonb,p_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_care_cycles%rowtype; expected text[]; supplied text[];
begin
 perform public.authorize_care_cycle(p_cycle,p_token);
 select * into c from public.whatsapp_care_cycles where id=p_cycle for update;
 if c.creation_body is not null then
  if c.creation_body<>p_body or c.creation_hash<>p_hash or c.provider_creator_id<>p_instance_id then raise exception 'GROUP_STALE';end if;
  return public.care_cycle_job(c.id);
 end if;
 select array_agg(substring(n->>'phone' from 2)||'@s.whatsapp.net' order by substring(n->>'phone' from 2)||'@s.whatsapp.net') into expected
 from jsonb_array_elements(c.consented_numbers) n where n->>'instance'<>c.creator_instance;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_instance_id is null or p_instance_id !~ '^[A-Za-z0-9_-]{1,191}$' or jsonb_typeof(p_body) is distinct from 'object'
  or p_body->>'cycleId' is distinct from c.id::text or p_body->>'operationId' is distinct from c.creation_operation::text
  or p_body->>'customerJid' is distinct from substring(c.customer_phone from 2)||'@s.whatsapp.net'
  or jsonb_typeof(p_body->'participants') is distinct from 'array' or exists(select 1 from jsonb_object_keys(p_body) k where k not in ('cycleId','operationId','subject','participants','customerJid','brand')) then raise exception 'GROUP_INVALID';end if;
 select array_agg(x order by x) into supplied from jsonb_array_elements_text(p_body->'participants') x;
 if expected is distinct from supplied then raise exception 'GROUP_PARTICIPANTS_CHANGED';end if;
 update public.whatsapp_care_cycles set creation_body=p_body,creation_hash=p_hash,provider_creator_id=p_instance_id where id=c.id;
 return public.care_cycle_job(c.id);
end $$;
create function public.start_care_cycle_step(p_cycle uuid,p_token uuid,p_phase text,p_revision text,p_instance text,p_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_care_cycles%rowtype;s public.whatsapp_care_cycle_steps%rowtype;
begin
 perform public.authorize_care_cycle(p_cycle,p_token,p_phase like 'close_%');
 select * into c from public.whatsapp_care_cycles where id=p_cycle for update;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or not exists(select 1 from jsonb_array_elements(c.consented_numbers) n where n->>'instance'=p_instance) then raise exception 'GROUP_INVALID';end if;
 select * into s from public.whatsapp_care_cycle_steps where cycle_id=c.id and phase=p_phase and revision=p_revision for update;
 if s.id is not null then
  if s.instance_name<>p_instance or s.request_hash<>p_hash then raise exception 'GROUP_STALE';end if;
  return to_jsonb(s)||jsonb_build_object('execute',false);
 end if;
 if p_phase='create' then
  if c.creation_body is null or c.creation_issued_at is not null or c.group_jid is not null or c.creator_instance<>p_instance or p_hash<>c.creation_hash then raise exception 'GROUP_STALE';end if;
  update public.whatsapp_care_cycles set creation_issued_at=clock_timestamp(),state='creating' where id=c.id;
 elsif c.group_jid is null then raise exception 'GROUP_STALE';
 end if;
 insert into public.whatsapp_care_cycle_steps(id,cycle_id,phase,revision,instance_name,request_hash)
 values(case when p_phase='create' then c.creation_operation else gen_random_uuid() end,c.id,p_phase,p_revision,p_instance,p_hash) returning * into s;
 if p_phase='welcome' then
  if exists(select 1 from public.whatsapp_send_attempts where instance_name=p_instance and state='started' and started_at>clock_timestamp()-interval '2 minutes') or (select count(*) from public.whatsapp_send_attempts where instance_name=p_instance and started_at>clock_timestamp()-interval '1 minute')>=coalesce((select per_instance_minute from public.whatsapp_send_policy),0) then raise exception 'GROUP_CAPACITY';end if;
  insert into public.whatsapp_send_attempts(care_operation_id,instance_name) values(s.id,p_instance);
 end if;
 return to_jsonb(s)||jsonb_build_object('execute',true);
end $$;
create function public.finish_care_cycle_step(p_cycle uuid,p_token uuid,p_step uuid,p_accepted boolean,p_provider_id text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.whatsapp_care_cycles where id=p_cycle and lease_token=p_token and lease_until>clock_timestamp() and revision=lease_revision) then raise exception 'GROUP_STALE';end if;
 update public.whatsapp_care_cycle_steps set state=case when p_accepted then 'accepted' else 'unknown' end,
 provider_id=case when p_accepted then p_provider_id else provider_id end,finished_at=clock_timestamp()
 where id=p_step and cycle_id=p_cycle and (state<>'accepted' or p_accepted);
 perform public.finish_whatsapp_send(a.id,case when p_accepted then p_provider_id else null end) from public.whatsapp_send_attempts a where a.care_operation_id=p_step;
end $$;

-- O vencimento vem da criação provada, não de requested_at nem da última reentrada.
create function public.record_care_cycle_creation(p_cycle uuid,p_token uuid,p_jid text,p_created_at timestamptz,p_expires_at timestamptz) returns void
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_care_cycles%rowtype;
begin
 perform public.authorize_care_cycle(p_cycle,p_token);
 select * into c from public.whatsapp_care_cycles where id=p_cycle for update;
 if p_jid is null or p_created_at is null or p_expires_at is null or p_jid !~ '^[0-9-]+@g\.us$' or p_created_at>clock_timestamp() or p_created_at<c.requested_at-interval '2 minutes'
  or p_expires_at is distinct from ((p_created_at at time zone 'UTC')+interval '1 year') at time zone 'UTC'
  or c.creation_issued_at is null or (c.group_jid is not null and (c.group_jid<>p_jid or c.created_at<>p_created_at or c.expires_at<>p_expires_at)) then raise exception 'GROUP_CREATION_UNPROVEN';end if;
 update public.whatsapp_care_cycles set group_jid=p_jid,created_at=p_created_at,expires_at=p_expires_at,state='preparing' where id=c.id;
 update public.whatsapp_care_groups set group_jid=p_jid,state='creating',controls_verified=false,reason='preparation_required' where id=c.group_id;
end $$;

-- Exclusão de conta/loja conserva apenas a tarefa de encerramento e seus identificadores.
create function public.detach_care_cycles() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.whatsapp_care_cycles set state=case when state='closed' then state else 'closing' end,
  reason='account_removed',revision=revision+1,lease_token=null,lease_until=null,creation_body=null,next_run_at=now() where group_id=old.id;
 return old;
end $$;
create trigger detach_care_cycles before delete on public.whatsapp_care_groups for each row execute function public.detach_care_cycles();

-- Privilégios explícitos: navegador não ganha acesso às tabelas ou passos do provedor.
revoke all on function public.care_cycle_number_valid(uuid,jsonb,boolean),public.care_cycle_composition(uuid,uuid),public.care_cycle_composition_valid(jsonb,boolean),public.care_cycle_content_context(uuid),public.care_cycle_available(uuid,boolean),public.care_cycle_job(uuid),public.claim_care_cycle(uuid),public.authorize_care_cycle(uuid,uuid,boolean,uuid),public.seal_care_cycle_creation(uuid,uuid,text,jsonb,text),public.start_care_cycle_step(uuid,uuid,text,text,text,text),public.finish_care_cycle_step(uuid,uuid,uuid,boolean,text),public.record_care_cycle_creation(uuid,uuid,text,timestamptz,timestamptz),public.detach_care_cycles() from public,anon,authenticated,service_role;
grant execute on function public.claim_care_cycle(uuid),public.authorize_care_cycle(uuid,uuid,boolean,uuid),public.seal_care_cycle_creation(uuid,uuid,text,jsonb,text),public.start_care_cycle_step(uuid,uuid,text,text,text,text),public.finish_care_cycle_step(uuid,uuid,uuid,boolean,text),public.record_care_cycle_creation(uuid,uuid,text,timestamptz,timestamptz) to service_role;
