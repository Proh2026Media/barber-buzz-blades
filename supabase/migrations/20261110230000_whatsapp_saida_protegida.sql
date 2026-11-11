-- Auditoria local: saída única, pausa persistente, tentativas e posse temporária.
-- Implantar com os emissores parados. Nasce pausado; retomada é decisão explícita.
-- Ajustes internos pelo serviço/operador; não são limites oficiais do WhatsApp.
create table public.whatsapp_send_policy (
  singleton boolean primary key default true check(singleton),
  per_instance_minute integer not null default 5 check(per_instance_minute between 1 and 30),
  otp_requests_hour integer not null default 120 check(otp_requests_hour between 1 and 600)
);
insert into public.whatsapp_send_policy default values;
alter table public.whatsapp_send_policy enable row level security;
revoke all on public.whatsapp_send_policy from public,anon,authenticated;
grant select,update on public.whatsapp_send_policy to service_role;
create table public.whatsapp_send_controls (
  scope text primary key,
  paused boolean not null default true,
  reason text not null check (reason in ('review','restriction','maintenance','resumed')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  version bigint not null default 1
);
insert into public.whatsapp_send_controls(scope,reason) values('global','review');
create table public.whatsapp_send_control_history (
  id uuid primary key default gen_random_uuid(), scope text not null,
  paused boolean not null, reason text not null, changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.whatsapp_send_attempts (
  id uuid primary key default gen_random_uuid(),
  -- Sem FK: a limpeza de desafios não apaga a correlação operacional minimizada.
  challenge_id uuid unique, outbox_id uuid unique,
  instance_name text not null,
  state text not null default 'started' check(state in ('started','accepted','unknown')),
  started_at timestamptz not null default now(), finished_at timestamptz,
  provider_message_id text,
  check ((challenge_id is null) <> (outbox_id is null))
);
create index whatsapp_send_attempts_instance_time on public.whatsapp_send_attempts(instance_name,started_at);
alter table public.whatsapp_send_controls enable row level security;
alter table public.whatsapp_send_control_history enable row level security;
alter table public.whatsapp_send_attempts enable row level security;
revoke all on public.whatsapp_send_controls,public.whatsapp_send_control_history,public.whatsapp_send_attempts from public,anon,authenticated;
grant select,insert,update,delete on public.whatsapp_send_controls,public.whatsapp_send_control_history,public.whatsapp_send_attempts to service_role;

create function public.set_whatsapp_send_pause(p_scope text,p_paused boolean,p_reason text,p_version bigint default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_send_controls%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  if p_scope is null or (p_scope not in ('global','platform') and not exists(select 1 from public.whatsapp_channels where id::text=p_scope))
     or p_paused is null or p_reason is null or p_reason not in ('review','restriction','maintenance','resumed')
     or (p_paused and p_reason='resumed') or (not p_paused and p_reason<>'resumed') then
    raise exception 'WA_CONTROL_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  select * into c from public.whatsapp_send_controls where scope=p_scope for update;
  if coalesce(c.version,0)<>p_version then raise exception 'WA_STALE'; end if;
  insert into public.whatsapp_send_controls(scope,paused,reason,changed_by)
    values(p_scope,p_paused,p_reason,auth.uid())
    on conflict(scope) do update set paused=excluded.paused,reason=excluded.reason,changed_by=excluded.changed_by,
      changed_at=clock_timestamp(),version=whatsapp_send_controls.version+1 returning * into c;
  insert into public.whatsapp_send_control_history(scope,paused,reason,changed_by) values(p_scope,p_paused,p_reason,auth.uid());
  return to_jsonb(c);
end $$;

create function public.whatsapp_sending_paused(p_instance text,p_platform boolean default false)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.whatsapp_send_controls c where c.paused and
    (c.scope='global' or (p_platform and c.scope='platform') or exists(
      select 1 from public.whatsapp_channels n where n.id::text=c.scope and
        (n.instance_name=p_instance or n.backup_instance_name=p_instance))));
$$;

create function public.whatsapp_send_dashboard() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  return jsonb_build_object(
    'controls',coalesce((select jsonb_agg(to_jsonb(c)) from public.whatsapp_send_controls c),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_send_control_history order by created_at desc limit 20) h),'[]'::jsonb),
    'accepted_24h',(select count(*) from public.whatsapp_send_attempts where state='accepted' and started_at>now()-interval '1 day'),
    'unknown_24h',(select count(*) from public.whatsapp_send_attempts where (state='unknown' or (state='started' and started_at<now()-interval '2 minutes')) and started_at>now()-interval '1 day'),
    'in_flight',(select count(*) from public.whatsapp_send_attempts where state='started' and started_at>=now()-interval '2 minutes'),
    'pending',(select count(*) from public.whatsapp_outbox where status='pending'),
    'oldest_pending_at',(select min(created_at) from public.whatsapp_outbox where status='pending'));
end $$;

-- O mesmo pedido HTTP não cria um segundo desafio, mesmo após a espera mínima.
alter table public.auth_otp_challenges add column request_id uuid not null default gen_random_uuid();
create unique index auth_otp_request_once on public.auth_otp_challenges(request_id);

-- Limites atômicos em TODOS os pontos que inserem desafios; não dependem de contagem HTTP.
create function public.guard_whatsapp_otp_request() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.channel<>'whatsapp' then return new; end if;
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
end $$;
create trigger guard_whatsapp_otp_request before insert on public.auth_otp_challenges
for each row execute function public.guard_whatsapp_otp_request();

create or replace function public.request_whatsapp_login(p_destination text,p_code_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare person uuid; challenge uuid;
begin
  if p_destination is null or p_destination !~ '^\+[1-9][0-9]{7,14}$' or p_code_hash is null or p_code_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Entrada inválida' using errcode='22023'; end if;
  select p.id into person from public.profiles p join auth.users u on u.id=p.id
    where p.whatsapp_e164=p_destination and p.whatsapp_verified_at is not null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=now()) and nullif(u.email,'') is not null;
  insert into public.auth_otp_challenges(user_id,channel,destination,code_hash,purpose,expires_at)
    values(person,'whatsapp',p_destination,p_code_hash,'login',clock_timestamp()+interval '10 minutes') returning id into challenge;
  return jsonb_build_object('challenge_id',challenge,'user_id',person);
end $$;

create function public.request_whatsapp_login_once(p_destination text,p_code_hash text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-otp-request',120));
  if p_request_id is not null and exists(select 1 from public.auth_otp_challenges where request_id=p_request_id) then raise exception 'WA_RATE_LIMIT'; end if;
  result:=public.request_whatsapp_login(p_destination,p_code_hash);
  if p_request_id is not null then update public.auth_otp_challenges set request_id=p_request_id where id=(result->>'challenge_id')::uuid; end if;
  return result;
end $$;
revoke all on function public.request_whatsapp_login_once(text,text,uuid) from public,anon,authenticated;
grant execute on function public.request_whatsapp_login_once(text,text,uuid) to service_role;

alter table public.whatsapp_outbox add column lease_token uuid,add column lease_until timestamptz;
create or replace function public.claim_whatsapp_outbox(p_limit int default 20)
returns setof public.whatsapp_outbox language plpgsql security definer set search_path=public as $$
begin
  -- Só recupera trabalho que comprovadamente não recebeu licença de transmissão.
  update public.whatsapp_outbox o set status='pending',lease_token=null,lease_until=null
    where o.status='sending' and o.lease_until<clock_timestamp() and o.delivery_started_at is null
      and not exists(select 1 from public.whatsapp_send_attempts a where a.outbox_id=o.id);
  update public.whatsapp_send_attempts set state='unknown',finished_at=clock_timestamp()
    where state='started' and started_at<clock_timestamp()-interval '2 minutes';
  if public.whatsapp_sending_paused(null,false) then return; end if;
  return query with picked as (
    select o.id from public.whatsapp_outbox o where o.status='pending' and o.scheduled_at<=now()
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
end $$;

-- Prévia sem reservar transmissão. A função final refaz regras e rota após a consulta de conexão.
create function public.whatsapp_send_candidate(p_outbox_id uuid default null,p_lease_token uuid default null,
  p_challenge_id uuid default null,p_instance text default null,p_code_hash text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_outbox%rowtype; c public.whatsapp_delivery_channels%rowtype; instance text;
begin
  if (p_outbox_id is null)=(p_challenge_id is null) then return null; end if;
  if p_challenge_id is not null then
    if nullif(p_instance,'') is null or public.whatsapp_sending_paused(p_instance,true) or not exists(
      select 1 from public.auth_otp_challenges where id=p_challenge_id and channel='whatsapp' and code_hash=p_code_hash
        and consumed_at is null and expires_at>clock_timestamp()) then return null; end if;
    instance:=p_instance;
  else
    select * into o from public.whatsapp_outbox where id=p_outbox_id and status='sending' and lease_token=p_lease_token
      and lease_until>clock_timestamp() and delivery_started_at is null;
    if o.id is null then return null; end if;
    if o.number_link_id is not null then
      select * into c from public.whatsapp_delivery_channels where number_link_id=o.number_link_id and id=o.channel_id and barbershop_id=o.barbershop_id;
    elsif o.channel_id is not null then
      select * into c from public.whatsapp_delivery_channels where id=o.channel_id and barbershop_id=o.barbershop_id
        and (number_link_id=public.whatsapp_route_link(o.barbershop_id,o.payload) or (select count(*) from public.whatsapp_delivery_channels where id=o.channel_id and barbershop_id=o.barbershop_id)=1);
    else
      select * into c from public.whatsapp_delivery_channels where number_link_id=public.whatsapp_route_link(o.barbershop_id,o.payload);
    end if;
    instance:=case when c.enabled and c.delivery_mode='primary' then c.instance_name
      when c.enabled and c.delivery_mode='backup' and c.delivery_reason='technical_failure' then c.backup_instance_name end;
    if instance is null or public.whatsapp_sending_paused(instance,false) then return null; end if;
  end if;
  return jsonb_build_object('instance_name',instance);
end $$;

create function public.authorize_whatsapp_send(p_expected_instance text,p_outbox_id uuid default null,p_lease_token uuid default null,
  p_challenge_id uuid default null,p_instance text default null,p_code_hash text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare candidate jsonb; target jsonb; a uuid; c public.auth_otp_challenges%rowtype; o public.whatsapp_outbox%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  -- Mesma ordem de trava usada pelo roteamento; evita inversão ao pausar/mover números.
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  candidate:=public.whatsapp_send_candidate(p_outbox_id,p_lease_token,p_challenge_id,p_instance,p_code_hash);
  if candidate is null or candidate->>'instance_name' is distinct from p_expected_instance then return jsonb_build_object('reason','unavailable'); end if;
  if exists(select 1 from public.whatsapp_send_attempts where challenge_id=p_challenge_id or outbox_id=p_outbox_id) then return jsonb_build_object('reason','duplicate'); end if;
  if (select count(*) from public.whatsapp_send_attempts where instance_name=p_expected_instance
    and started_at>clock_timestamp()-interval '15 minutes' and (state='unknown' or (state='started' and started_at<clock_timestamp()-interval '2 minutes')))>=3 then
    insert into public.whatsapp_send_controls(scope,paused,reason)
      values(case when p_challenge_id is not null then 'platform' else coalesce((select id::text from public.whatsapp_channels
        where instance_name=p_expected_instance or backup_instance_name=p_expected_instance limit 1),'global') end,true,'review')
      on conflict(scope) do update set paused=true,reason='review',changed_by=null,changed_at=clock_timestamp(),version=whatsapp_send_controls.version+1;
    insert into public.whatsapp_send_control_history(scope,paused,reason)
      values(case when p_challenge_id is not null then 'platform' else coalesce((select id::text from public.whatsapp_channels
        where instance_name=p_expected_instance or backup_instance_name=p_expected_instance limit 1),'global') end,true,'review');
    return jsonb_build_object('reason','review');
  end if;
  -- Uma transmissão por vez/conta e teto conservador de capacidade, compartilhado pelos emissores.
  if exists(select 1 from public.whatsapp_send_attempts where instance_name=p_expected_instance and state='started' and started_at>clock_timestamp()-interval '2 minutes')
    or (select count(*) from public.whatsapp_send_attempts where instance_name=p_expected_instance and started_at>clock_timestamp()-interval '1 minute')>=coalesce((select per_instance_minute from public.whatsapp_send_policy),0) then
    return jsonb_build_object('reason','capacity'); end if;
  if p_challenge_id is not null then
    select * into c from public.auth_otp_challenges where id=p_challenge_id for update;
    if c.consumed_at is not null or c.expires_at<=clock_timestamp() or c.code_hash is distinct from p_code_hash then return null; end if;
    if c.purpose not in ('login','recovery','verify_phone','signup') then return null; end if;
    if c.purpose in ('login','recovery') and not exists(select 1 from public.profiles p join auth.users u on u.id=p.id
      where p.id=c.user_id and p.whatsapp_e164=c.destination and p.whatsapp_verified_at is not null and u.deleted_at is null
        and (u.banned_until is null or u.banned_until<=now()) and nullif(u.email,'') is not null) then return null; end if;
    if c.purpose='verify_phone' and (c.user_id is null or exists(select 1 from public.profiles where id<>c.user_id and whatsapp_e164=c.destination and whatsapp_verified_at is not null)) then return null; end if;
    if c.barbershop_id is not null and not exists(select 1 from public.barbershops where id=c.barbershop_id and status='active') then return null; end if;
    target:=jsonb_build_object('instance_name',p_instance,'to_e164',c.destination);
  else
    select * into o from public.whatsapp_outbox where id=p_outbox_id for update;
    if o.lease_token is distinct from p_lease_token or o.lease_until<=clock_timestamp() then return null; end if;
    target:=public.prepare_whatsapp_delivery(p_outbox_id);
    if target is null then return null; end if;
    if target->>'instance_name' is distinct from p_expected_instance then raise exception 'WA_ROUTE_CHANGED'; end if;
  end if;
  insert into public.whatsapp_send_attempts(challenge_id,outbox_id,instance_name)
    values(p_challenge_id,p_outbox_id,p_expected_instance) returning id into a;
  return target||jsonb_build_object('attempt_id',a);
end $$;

create function public.defer_whatsapp_send(p_id uuid,p_lease_token uuid) returns void
language plpgsql security definer set search_path=public as $$
declare paused boolean;
begin
  -- Pausa administrativa não esgota o orçamento de tentativas de uma mensagem ainda pendente.
  select public.whatsapp_sending_paused(case when c.delivery_mode='backup' then c.backup_instance_name else c.instance_name end,false)
    into paused from public.whatsapp_outbox o left join public.whatsapp_channels c on c.id=o.channel_id where o.id=p_id;
  update public.whatsapp_outbox o set status=case when coalesce(paused,false) or attempts<5 then 'pending'::public.whatsapp_outbox_status else 'failed'::public.whatsapp_outbox_status end,
    attempts=case when coalesce(paused,false) then greatest(0,attempts-1) else attempts end,
    scheduled_at=clock_timestamp()+interval '5 minutes',lease_token=null,lease_until=null,error='Envio adiado antes da transmissão'
    where id=p_id and status='sending' and lease_token=p_lease_token and delivery_started_at is null
      and not exists(select 1 from public.whatsapp_send_attempts a where a.outbox_id=o.id);
end $$;

create function public.finish_whatsapp_send(p_attempt_id uuid,p_provider_id text default null) returns void
language plpgsql security definer set search_path=public as $$
declare a public.whatsapp_send_attempts%rowtype;
begin
  select * into a from public.whatsapp_send_attempts where id=p_attempt_id for update;
  if a.id is null or a.state='accepted' then return; end if;
  if p_provider_id is not null and (length(p_provider_id)=0 or length(p_provider_id)>200) then raise exception 'WA_RECEIPT_INVALID'; end if;
  update public.whatsapp_send_attempts set state=case when p_provider_id is null then 'unknown' else 'accepted' end,
    provider_message_id=p_provider_id,finished_at=clock_timestamp() where id=a.id;
  if a.outbox_id is not null then
    perform public.complete_whatsapp_outbox(a.outbox_id,p_provider_id is not null,p_provider_id,'Resultado desconhecido; sem reenvio automático');
  end if;
end $$;

-- Regras antigas só podem ser usadas internamente pelo autorizador, não por workers antigos.
revoke execute on function public.prepare_whatsapp_delivery(uuid),public.defer_whatsapp_delivery(uuid),public.complete_whatsapp_outbox(uuid,boolean,text,text) from service_role;
revoke all on function public.set_whatsapp_send_pause(text,boolean,text,bigint),public.whatsapp_send_dashboard() from public,anon;
grant execute on function public.set_whatsapp_send_pause(text,boolean,text,bigint),public.whatsapp_send_dashboard() to authenticated;
revoke all on function public.whatsapp_sending_paused(text,boolean),public.guard_whatsapp_otp_request(),
  public.whatsapp_send_candidate(uuid,uuid,uuid,text,text),public.authorize_whatsapp_send(text,uuid,uuid,uuid,text,text),
  public.defer_whatsapp_send(uuid,uuid),public.finish_whatsapp_send(uuid,text) from public,anon,authenticated;
grant execute on function public.whatsapp_sending_paused(text,boolean),public.whatsapp_send_candidate(uuid,uuid,uuid,text,text),
  public.authorize_whatsapp_send(text,uuid,uuid,uuid,text,text),public.defer_whatsapp_send(uuid,uuid),public.finish_whatsapp_send(uuid,text) to service_role;

-- Retenção minimizada. Tentativas sem conteúdo sobrevivem ao expurgo dos códigos por 30 dias.
create function public.purge_whatsapp_send_audit() returns void
language plpgsql security definer set search_path=public as $$
begin
  delete from public.whatsapp_send_attempts a where started_at<now()-interval '30 days'
    and (outbox_id is null or not exists(select 1 from public.whatsapp_outbox o where o.id=a.outbox_id and o.status in ('pending','sending')));
  delete from public.whatsapp_send_control_history where created_at<now()-interval '180 days';
end $$;
revoke all on function public.purge_whatsapp_send_audit() from public,anon,authenticated;
grant execute on function public.purge_whatsapp_send_audit() to service_role;

-- Revalida também eventos excluídos e avisos envelhecidos.
CREATE OR REPLACE FUNCTION public.prepare_whatsapp_delivery(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.whatsapp_outbox%rowtype; c public.whatsapp_delivery_channels%rowtype;
  b public.client_communication_budget%rowtype; recipient uuid; instance text; appt public.appointments%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  select * into o from public.whatsapp_outbox where id=p_id for update;
  if o.id is null or o.status<>'sending' or o.delivery_started_at is not null then return null; end if;
  if o.scheduled_at<now()-interval '24 hours' then
    update public.whatsapp_outbox set status='failed',error='Aviso expirado antes do envio' where id=p_id; return null; end if;
  if not public.whatsapp_recipient_allowed(o.barbershop_id,o.to_e164,o.payload) then
    update public.whatsapp_outbox set status='failed',error='Preferência ou destinatário alterado' where id=p_id; return null;
  end if;
  begin
    select * into appt from public.appointments where id=nullif(o.payload->>'appointment_id','')::uuid and barbershop_id=o.barbershop_id;
  exception when invalid_text_representation then
    update public.whatsapp_outbox set status='failed',error='Aviso com referência inválida' where id=p_id; return null; end;
  if appt.id is null and (o.payload ? 'appointment_id' or o.template_key like 'booking.%') then
    update public.whatsapp_outbox set status='failed',error='Agendamento não existe mais; aviso cancelado' where id=p_id; return null; end if;
  if appt.id is not null and (
    (o.template_key in ('booking.confirmed','booking.rescheduled','booking.reminder','notice.reminder_next','notice.confirm_today') and (appt.status not in ('pending','confirmed') or appt.starts_at<=now()))
    or (o.template_key='booking.cancelled' and appt.status<>'cancelled')
    or (o.payload ? 'starts_at' and (o.payload->>'starts_at')::timestamptz<>appt.starts_at)
  ) then
    update public.whatsapp_outbox set status='failed',error='Agendamento alterado; aviso anterior descartado' where id=p_id; return null;
  end if;
  if o.number_link_id is not null then
    select * into c from public.whatsapp_delivery_channels where number_link_id=o.number_link_id and id=o.channel_id and barbershop_id=o.barbershop_id;
  elsif o.channel_id is not null then
    select * into c from public.whatsapp_delivery_channels where id=o.channel_id and barbershop_id=o.barbershop_id and (number_link_id=public.whatsapp_route_link(o.barbershop_id,o.payload) or (select count(*) from public.whatsapp_delivery_channels where id=o.channel_id and barbershop_id=o.barbershop_id)=1);
  else
    select * into c from public.whatsapp_delivery_channels where number_link_id=public.whatsapp_route_link(o.barbershop_id,o.payload);
  end if;
  if (appt.id is not null and c.staff_id is not null and c.staff_id<>appt.staff_id) or c.id is null or not c.enabled or c.delivery_mode='paused'
     or (o.template_key='booking.reminder' and not c.notify_reminder)
     or (o.template_key in ('booking.confirmed','booking.cancelled','booking.rescheduled') and not c.notify_booking) then
    update public.whatsapp_outbox set status='failed',error='Canal pausado ou aviso desativado' where id=p_id; return null;
  end if;
  instance:=case when c.delivery_mode='backup' and c.delivery_reason='technical_failure' then c.backup_instance_name
                 when c.delivery_mode='primary' then c.instance_name end;
  if instance is null then update public.whatsapp_outbox set status='failed',error='Rota não configurada' where id=p_id; return null; end if;
  if public.whatsapp_message_kind(o.template_key)<>'transactional' then
    recipient:=public.whatsapp_recipient(o.barbershop_id,o.payload);
    if recipient is null then update public.whatsapp_outbox set status='failed',error='Destinatário não identificado' where id=p_id; return null; end if;
    perform pg_advisory_xact_lock(hashtextextended(recipient::text,116));
    select * into b from public.client_communication_budget where event_key=o.communication_key;
    if b.event_key is null or b.expires_at<=now()
       or (b.kind='return' and (not c.return_notice_enabled or not exists(select 1 from public.customer_privacy where user_id=recipient and analytics)))
       or not exists(select 1 from public.customer_privacy where user_id=recipient and marketing)
       or (b.kind='return' and exists(select 1 from public.appointments where barbershop_id=o.barbershop_id and customer_id=recipient and status in ('pending','confirmed') and starts_at>now())) then
      update public.whatsapp_outbox set status='failed',error='Comunicação expirada, recusada ou sem necessidade' where id=p_id; return null;
    end if;
    -- Conta pela tentativa efetiva, não pela virada do calendário.
    if b.attempted_at is null and (select count(*) from public.client_communication_budget where customer_id=recipient
      and event_key<>b.event_key and attempted_at>now()-interval '7 days')>=2 then
      update public.whatsapp_outbox set status='failed',error='Limite de comunicações atingido' where id=p_id; return null;
    end if;
    update public.client_communication_budget set attempted_at=coalesce(attempted_at,now()) where event_key=b.event_key;
  end if;
  o.body:=public.whatsapp_identify_shop(c.id,o.barbershop_id,o.body);
  update public.whatsapp_outbox set delivery_started_at=now(),delivery_instance=instance,channel_id=c.id,number_link_id=c.number_link_id,body=o.body where id=p_id;
  return jsonb_build_object('instance_name',instance,'to_e164',o.to_e164,'body',o.body);
end $function$
;
