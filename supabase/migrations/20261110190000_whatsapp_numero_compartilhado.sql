-- P-119: conexão física independente dos vínculos com lojas/profissionais.
-- Preserva destinos, preferências, fila e reserva existentes. Nenhum envio/conexão.
create table public.whatsapp_number_links (
 id uuid primary key default gen_random_uuid(), channel_id uuid not null references public.whatsapp_channels(id) on delete cascade,
 barbershop_id uuid not null references public.barbershops(id) on delete cascade, staff_id uuid references public.staff(id) on delete cascade,
 enabled boolean not null default false, notify_booking boolean not null default true,
 notify_reminder boolean not null default true, reminder_hours_before integer not null default 24 check(reminder_hours_before between 1 and 168),
 return_notice_enabled boolean not null default false, version bigint not null default 0,
 removed_at timestamptz, created_at timestamptz not null default now()
);
create unique index whatsapp_link_shop on public.whatsapp_number_links(barbershop_id) where staff_id is null and removed_at is null;
create unique index whatsapp_link_staff on public.whatsapp_number_links(barbershop_id,staff_id) where staff_id is not null and removed_at is null;
create index whatsapp_link_channel on public.whatsapp_number_links(channel_id) where removed_at is null;
alter table public.whatsapp_number_links enable row level security;
revoke all on public.whatsapp_number_links from public,anon,authenticated,service_role;
grant select on public.whatsapp_number_links to authenticated;
create policy whatsapp_links_admin on public.whatsapp_number_links for select to authenticated using(public.is_platform_admin());

insert into public.whatsapp_number_links(id,channel_id,barbershop_id,staff_id,enabled,notify_booking,notify_reminder,reminder_hours_before,return_notice_enabled)
 select id,id,barbershop_id,staff_id,enabled,notify_booking,notify_reminder,reminder_hours_before,return_notice_enabled
 from public.whatsapp_channels where barbershop_id is not null;
alter table public.whatsapp_outbox add column number_link_id uuid references public.whatsapp_number_links(id) on delete set null;
update public.whatsapp_outbox o set number_link_id=b.id from public.whatsapp_number_links b
 where o.channel_id=b.channel_id and o.barbershop_id=b.barbershop_id;
create index whatsapp_outbox_number_link on public.whatsapp_outbox(number_link_id);
create table public.whatsapp_number_link_history (
 id uuid primary key default gen_random_uuid(),channel_id uuid not null,link_id uuid not null,
 actor_id uuid references public.profiles(id) on delete set null,action text not null,
 before_config jsonb,after_config jsonb,created_at timestamptz not null default now()
);
alter table public.whatsapp_number_link_history enable row level security;
revoke all on public.whatsapp_number_link_history from public,anon,authenticated,service_role;
grant select on public.whatsapp_number_link_history to authenticated;
create policy whatsapp_link_history_admin on public.whatsapp_number_link_history for select to authenticated using(public.is_platform_admin());

-- Compatibilidade: primeira associação espelhada nos campos antigos, sem mudar a conexão.
create function public.whatsapp_sync_legacy_anchor(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare b public.whatsapp_number_links%rowtype; c public.whatsapp_channels%rowtype;
begin
 select * into c from public.whatsapp_channels where id=p_id;
 select * into b from public.whatsapp_number_links where channel_id=p_id and removed_at is null
 order by (barbershop_id=c.barbershop_id and staff_id is not distinct from c.staff_id) desc nulls last,created_at,id limit 1;
 update public.whatsapp_channels set barbershop_id=b.barbershop_id,staff_id=b.staff_id,
 enabled=coalesce(b.enabled,false),notify_booking=coalesce(b.notify_booking,true),notify_reminder=coalesce(b.notify_reminder,true),
 reminder_hours_before=coalesce(b.reminder_hours_before,24),return_notice_enabled=coalesce(b.return_notice_enabled,false),
 routing_version=routing_version+1 where id=p_id;
end $$;
revoke all on function public.whatsapp_sync_legacy_anchor(uuid) from public,anon,authenticated,service_role;

-- Inserções legadas e preferências do primeiro vínculo continuam coerentes. Não replica status como dado por loja.
create function public.whatsapp_sync_legacy_preferences() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.barbershop_id is null then return new; end if;
 if tg_op='INSERT' then
   insert into public.whatsapp_number_links(id,channel_id,barbershop_id,staff_id,enabled,notify_booking,notify_reminder,reminder_hours_before,return_notice_enabled)
   values(new.id,new.id,new.barbershop_id,new.staff_id,new.enabled,new.notify_booking,new.notify_reminder,new.reminder_hours_before,new.return_notice_enabled);
 else
   update public.whatsapp_number_links set enabled=new.enabled,notify_booking=new.notify_booking,notify_reminder=new.notify_reminder,
     reminder_hours_before=new.reminder_hours_before,return_notice_enabled=new.return_notice_enabled,version=version+1
   where channel_id=new.id and barbershop_id=new.barbershop_id and staff_id is not distinct from new.staff_id and removed_at is null
     and (enabled,notify_booking,notify_reminder,reminder_hours_before,return_notice_enabled) is distinct from
       (new.enabled,new.notify_booking,new.notify_reminder,new.reminder_hours_before,new.return_notice_enabled);
 end if;
 return new;
end $$;
create trigger whatsapp_legacy_preferences after insert or update on public.whatsapp_channels
 for each row execute function public.whatsapp_sync_legacy_preferences();
revoke all on function public.whatsapp_sync_legacy_preferences() from public,anon,authenticated,service_role;

create function public.whatsapp_link_not_busy(p_link uuid) returns void
language plpgsql security definer set search_path=public as $$
declare b public.whatsapp_number_links%rowtype;
begin
 select * into b from public.whatsapp_number_links where id=p_link;
 if exists(select 1 from public.whatsapp_outbox where
   (number_link_id=p_link or (number_link_id is null and channel_id=b.channel_id and barbershop_id=b.barbershop_id))
   and (status='sending' or (status='failed' and delivery_started_at is not null and provider_message_id is null)))
 then raise exception 'WA_DELIVERY_BUSY' using errcode='55000'; end if;
end $$;
revoke all on function public.whatsapp_link_not_busy(uuid) from public,anon,authenticated,service_role;

create function public.platform_add_whatsapp_link(p_id uuid,p_version bigint,p_shop uuid,p_staff uuid,p_enabled boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_channels%rowtype;b public.whatsapp_number_links%rowtype;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into c from public.whatsapp_channels where id=p_id for update;
 if c.id is null or c.routing_version is distinct from p_version then raise exception 'WA_STALE' using errcode='40001'; end if;
 if exists(select 1 from public.whatsapp_channels where backup_instance_name=c.instance_name) then raise exception 'WA_NUMBER_RESERVED' using errcode='23514'; end if;
 if not exists(select 1 from public.barbershops where id=p_shop and status='active') or
   (p_staff is not null and not exists(select 1 from public.staff where id=p_staff and barbershop_id=p_shop and active))
 then raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
 if exists(select 1 from public.whatsapp_number_links where barbershop_id=p_shop and staff_id is not distinct from p_staff and removed_at is null)
 then raise exception 'WA_TARGET_OCCUPIED' using errcode='23505'; end if;
 insert into public.whatsapp_number_links(channel_id,barbershop_id,staff_id,enabled)
 values(p_id,p_shop,p_staff,coalesce(p_enabled,false)) returning * into b;
 insert into public.whatsapp_number_link_history(channel_id,link_id,actor_id,action,after_config) values(p_id,b.id,auth.uid(),'added',to_jsonb(b));
 perform public.whatsapp_sync_legacy_anchor(p_id);
 return to_jsonb(b);
end $$;

create function public.platform_update_whatsapp_link(p_link uuid,p_version bigint,p_enabled boolean,p_returns boolean,p_remove boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.whatsapp_number_links%rowtype; r public.whatsapp_number_links%rowtype;c public.whatsapp_channels%rowtype;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into b from public.whatsapp_number_links where id=p_link for update;
 if b.id is null or b.removed_at is not null or b.version is distinct from p_version then raise exception 'WA_STALE' using errcode='40001'; end if;
 perform public.whatsapp_link_not_busy(b.id);
 select * into c from public.whatsapp_channels where id=b.channel_id;
 if p_remove and (c.backup_instance_name is not null or c.delivery_mode<>'primary') and
   (select count(*) from public.whatsapp_number_links where channel_id=b.channel_id and removed_at is null)=1
 then raise exception 'WA_RESERVE_ASSIGNED' using errcode='22023'; end if;
 if p_remove then
   update public.whatsapp_outbox set status='failed',error='Vínculo removido; aviso não enviado'
   where (number_link_id=b.id or (number_link_id is null and channel_id=b.channel_id and barbershop_id=b.barbershop_id)) and status='pending';
 end if;
 update public.whatsapp_number_links set enabled=case when p_remove then false else coalesce(p_enabled,false) end,
   return_notice_enabled=coalesce(p_returns,false),removed_at=case when p_remove then now() end,version=version+1
 where id=b.id returning * into r;
 insert into public.whatsapp_number_link_history(channel_id,link_id,actor_id,action,before_config,after_config)
 values(b.channel_id,b.id,auth.uid(),case when p_remove then 'removed' else 'updated' end,to_jsonb(b),to_jsonb(r));
 perform public.whatsapp_sync_legacy_anchor(b.channel_id);
 return to_jsonb(r);
end $$;
revoke all on function public.platform_add_whatsapp_link(uuid,bigint,uuid,uuid,boolean),public.platform_update_whatsapp_link(uuid,bigint,boolean,boolean,boolean) from public,anon;
grant execute on function public.platform_add_whatsapp_link(uuid,bigint,uuid,uuid,boolean),public.platform_update_whatsapp_link(uuid,bigint,boolean,boolean,boolean) to authenticated;

create view public.whatsapp_delivery_channels with (security_invoker=true) as select b.barbershop_id,c.instance_name,c.status,c.display_phone,b.enabled,b.notify_booking,b.notify_reminder,b.reminder_hours_before,c.last_error,c.created_at,c.updated_at,b.staff_id,c.id,c.backup_instance_name,c.delivery_mode,c.delivery_reason,b.return_notice_enabled,c.label,c.routing_version,b.id as number_link_id,b.version as link_version from public.whatsapp_channels c join public.whatsapp_number_links b on b.channel_id=c.id and b.removed_at is null;
revoke all on public.whatsapp_delivery_channels from public,anon,authenticated;
grant select on public.whatsapp_delivery_channels,public.whatsapp_number_links to service_role;
CREATE OR REPLACE FUNCTION public.whatsapp_route_link(p_shop uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare professional uuid; result uuid;
begin
  if nullif(p_payload->>'appointment_id','') is not null then
    select staff_id into professional from public.appointments
      where id=(p_payload->>'appointment_id')::uuid and barbershop_id=p_shop;
  elsif nullif(p_payload->>'staff_id','') is not null then
    select id into professional from public.staff where id=(p_payload->>'staff_id')::uuid and barbershop_id=p_shop and active;
  end if;
  if professional is not null then
    select id into result from public.whatsapp_number_links where removed_at is null and barbershop_id=p_shop and staff_id=professional;
  end if;
  if result is null then select id into result from public.whatsapp_number_links where removed_at is null and barbershop_id=p_shop and staff_id is null; end if;
  return result;
exception when invalid_text_representation then return null;
end $function$
;
revoke all on function public.whatsapp_route_link(uuid,jsonb) from public,anon,authenticated;
create or replace function public.whatsapp_route_channel(p_shop uuid,p_payload jsonb) returns uuid language sql stable security definer set search_path=public as $$
select channel_id from public.whatsapp_number_links where id=public.whatsapp_route_link(p_shop,p_payload)
$$;
create function public.whatsapp_identify_shop(p_channel uuid,p_shop uuid,p_body text) returns text language sql stable security definer set search_path=public as $$
 select case when (select count(*) from public.whatsapp_number_links where channel_id=p_channel and removed_at is null)>1
 and left(p_body,length('['||name||']'||chr(10)))<>('['||name||']'||chr(10)) then '['||name||']'||chr(10)||p_body else p_body end
 from public.barbershops where id=p_shop
$$;
revoke all on function public.whatsapp_identify_shop(uuid,uuid,text) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_message(p_shop_id uuid, p_to_e164 text, p_template_key text, p_body text, p_dedupe_key text, p_payload jsonb DEFAULT '{}'::jsonb, p_scheduled_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.whatsapp_delivery_channels%rowtype; message_id uuid; recipient uuid;
  kind text:=public.whatsapp_message_kind(p_template_key); event_key text;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  if p_to_e164 is null or p_to_e164 !~ '^\+[1-9][0-9]{7,14}$' then return null; end if;
  if not public.whatsapp_recipient_allowed(p_shop_id,p_to_e164,p_payload) then return null; end if;
  if p_body is null or length(trim(p_body))=0 or p_dedupe_key is null then return null; end if;
  if exists(select 1 from public.whatsapp_outbox where dedupe_key=p_dedupe_key) then return null; end if;
  -- Canal do profissional do atendimento; geral da loja quando não há vínculo próprio.
  select * into c from public.whatsapp_delivery_channels where number_link_id=public.whatsapp_route_link(p_shop_id,p_payload);
  if c.id is null or not c.enabled or c.delivery_mode='paused' then return null; end if;
  if p_template_key='booking.reminder' and not c.notify_reminder then return null; end if;
  if p_template_key in ('booking.confirmed','booking.cancelled','booking.rescheduled') and not c.notify_booking then return null; end if;
  if kind<>'transactional' then
    recipient:=public.whatsapp_recipient(p_shop_id,p_payload);
    event_key:=coalesce(nullif(p_payload->>'communication_key',''),p_dedupe_key);
    if coalesce(p_scheduled_at,now())>now()+interval '24 hours' then return null; end if;
    if not public.reserve_client_communication(p_shop_id,recipient,kind,event_key) then return null; end if;
  end if;
  insert into public.whatsapp_outbox(barbershop_id,to_e164,template_key,body,payload,dedupe_key,scheduled_at,channel_id,communication_key,number_link_id)
    values(p_shop_id,p_to_e164,p_template_key,public.whatsapp_identify_shop(c.id,p_shop_id,p_body),coalesce(p_payload,'{}'),p_dedupe_key,coalesce(p_scheduled_at,now()),c.id,event_key,c.number_link_id)
    on conflict(dedupe_key) do nothing returning id into message_id;
  return message_id;
end $function$
;
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
  if not public.whatsapp_recipient_allowed(o.barbershop_id,o.to_e164,o.payload) then
    update public.whatsapp_outbox set status='failed',error='Preferência ou destinatário alterado' where id=p_id; return null;
  end if;
  begin
    select * into appt from public.appointments where id=nullif(o.payload->>'appointment_id','')::uuid and barbershop_id=o.barbershop_id;
  exception when invalid_text_representation then
    update public.whatsapp_outbox set status='failed',error='Aviso com referência inválida' where id=p_id; return null; end;
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
CREATE OR REPLACE FUNCTION public.process_whatsapp_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  queued int := 0;
  candidate record;
  message_id uuid;
begin
  for candidate in
    select
      a.id as appointment_id,
      a.starts_at - make_interval(hours => coalesce(c.reminder_hours_before, 24)) as remind_at
    from public.appointments a
    left join lateral (
      select ch.reminder_hours_before, ch.notify_reminder
      from public.whatsapp_delivery_channels ch
      where ch.number_link_id = public.whatsapp_route_link(a.barbershop_id,jsonb_build_object('appointment_id',a.id))
      order by ch.staff_id nulls first
      limit 1
    ) c on true
    where a.status in ('pending', 'confirmed')
      and (a.customer_id is not null or a.shop_client_id is not null)
      and coalesce(c.notify_reminder, true)
      and a.starts_at > now()
      and a.starts_at - make_interval(hours => coalesce(c.reminder_hours_before, 24)) <= now()
      and a.starts_at - make_interval(hours => coalesce(c.reminder_hours_before, 24))
        > now() - interval '2 hours'
  loop
    message_id := public.queue_appointment_whatsapp(
      candidate.appointment_id,
      'booking.reminder',
      candidate.remind_at
    );
    if message_id is not null then
      queued := queued + 1;
    end if;
  end loop;
  return queued;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.process_whatsapp_return_notices()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; message_id uuid; total integer:=0; origin text; body text;
begin
  for r in
    with visits as (
      select a.barbershop_id,a.customer_id,(a.starts_at at time zone public.shop_tz(a.barbershop_id))::date as day
      from public.appointments a join public.customer_privacy p on p.user_id=a.customer_id and p.marketing and p.analytics
      join public.whatsapp_delivery_channels c on c.barbershop_id=a.barbershop_id and c.staff_id is null
        and c.enabled and c.return_notice_enabled and c.delivery_mode<>'paused'
      where a.status='completed' and a.starts_at>now()-interval '365 days' and a.starts_at<=now()
      group by a.barbershop_id,a.customer_id,day
    ), rhythm as (
      select barbershop_id,customer_id,max(day) as last_day,
        greatest(7,least(180,ceil((max(day)-min(day))::numeric/(count(*)-1))))::int as interval_days
      from visits group by barbershop_id,customer_id having count(*)>=3
    )
    select x.*,p.whatsapp_e164,s.name
    from rhythm x join public.profiles p on p.id=x.customer_id
    join public.barbershops s on s.id=x.barbershop_id
    where p.whatsapp_opt_in_at is not null and p.whatsapp_verified_at is not null
      and x.last_day+x.interval_days<=(now() at time zone public.shop_tz(x.barbershop_id))::date
      and not exists(select 1 from public.appointments a where a.barbershop_id=x.barbershop_id and a.customer_id=x.customer_id
        and a.status in ('pending','confirmed') and a.starts_at>now())
      and not exists(select 1 from public.client_communication_budget b where b.customer_id=x.customer_id
        and (b.attempted_at>now()-interval '7 days' or (b.attempted_at is null and b.expires_at>now())) and b.kind='return')
      and (select count(*) from public.client_communication_budget b where b.customer_id=x.customer_id
        and (b.attempted_at>now()-interval '7 days' or (b.attempted_at is null and b.expires_at>now())))<2
    order by x.last_day,x.barbershop_id,x.customer_id limit 100
  loop
    origin:=public.shop_public_origin(r.barbershop_id);
    if origin is null or origin !~ '^https://' then continue; end if;
    body:=format(E'Barba & Cabelo — %s\nQuer marcar seu próximo atendimento? Veja os horários: %s/app\n\nPara parar de receber convites, desative Receber ofertas em Conta → Privacidade: %s/app?tab=conta',r.name,origin,origin);
    message_id:=public.enqueue_whatsapp_message(r.barbershop_id,r.whatsapp_e164,'notice.return_visit',body,
      'return:'||r.barbershop_id||':'||r.customer_id||':'||to_char(now() at time zone 'UTC','YYYY-MM-DD'),
      jsonb_build_object('customer_id',r.customer_id),now());
    if message_id is not null then total:=total+1; end if;
  end loop;
  return total;
end $function$
;
CREATE OR REPLACE FUNCTION public.platform_assign_whatsapp_channel(p_id uuid, p_version bigint, p_shop uuid, p_staff uuid, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.whatsapp_channels%rowtype; moved boolean;
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  select * into c from public.whatsapp_channels where id=p_id for update;
  if c.id is null or c.routing_version is distinct from p_version then
    raise exception 'WA_STALE' using errcode='40001'; end if;
  if p_shop is not null and not exists(select 1 from public.barbershops where id=p_shop and status='active') then
    raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
  if p_staff is not null and not exists(select 1 from public.staff where id=p_staff and barbershop_id=p_shop and active) then
    raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
  if p_shop is null and (p_staff is not null or coalesce(p_enabled,false)) then
    raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
  if exists(select 1 from public.whatsapp_number_links where channel_id<>p_id and removed_at is null and barbershop_id=p_shop and staff_id is not distinct from p_staff) then
    raise exception 'WA_TARGET_OCCUPIED' using errcode='23505'; end if;
  if (select count(*) from public.whatsapp_number_links where channel_id=p_id and removed_at is null)>1 then raise exception 'WA_SHARED_MANAGE' using errcode='22023'; end if;
  moved:=c.barbershop_id is distinct from p_shop or c.staff_id is distinct from p_staff;
  if moved and (c.backup_instance_name is not null or c.delivery_mode<>'primary') then
    raise exception 'WA_RESERVE_ASSIGNED' using errcode='22023'; end if;
  if exists(select 1 from public.whatsapp_outbox where
    (channel_id=p_id or (channel_id is null and barbershop_id=c.barbershop_id)) and
    (status='sending' or (status='failed' and delivery_started_at is not null and provider_message_id is null))) then
    raise exception 'WA_DELIVERY_BUSY' using errcode='55000'; end if;
  if moved then
    -- Não levar fila antiga ao novo vínculo nem reencaminhar pendências para outro número.
    update public.whatsapp_outbox set status='failed',error='Vínculo do canal alterado; aviso não enviado'
      where (channel_id=p_id or (channel_id is null and barbershop_id=c.barbershop_id)) and status='pending';
    insert into public.whatsapp_channel_movements(channel_id,actor_id,old_shop_id,new_shop_id,old_staff_id,new_staff_id)
      values(p_id,auth.uid(),c.barbershop_id,p_shop,c.staff_id,p_staff);
  end if;
  if moved then
    update public.whatsapp_number_links set removed_at=now(),enabled=false,version=version+1 where channel_id=p_id and removed_at is null;
    if p_shop is not null then
      insert into public.whatsapp_number_links(channel_id,barbershop_id,staff_id,enabled,notify_booking,notify_reminder,reminder_hours_before)
      values(p_id,p_shop,p_staff,coalesce(p_enabled,false),c.notify_booking,c.notify_reminder,c.reminder_hours_before);
    end if;
  end if;
  update public.whatsapp_channels set barbershop_id=p_shop,staff_id=p_staff,enabled=coalesce(p_enabled,false),
    return_notice_enabled=case when moved then false else return_notice_enabled end,
    routing_version=routing_version+1 where id=p_id returning * into c;
  return to_jsonb(c);
end $function$
;
CREATE OR REPLACE FUNCTION public.platform_whatsapp_directory()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  return jsonb_build_object(
    'number_reserves',true,'number_sharing',true,
    'links',coalesce((select jsonb_agg(to_jsonb(b) order by created_at,id) from public.whatsapp_number_links b where removed_at is null),'[]'::jsonb),
    'link_history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_number_link_history order by created_at desc,id limit 30) h),'[]'::jsonb),
    'channels',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.whatsapp_channels c),'[]'::jsonb),
    'shops',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.barbershops where status='active'),'[]'::jsonb),
    'staff',coalesce((select jsonb_agg(jsonb_build_object('id',id,'shop_id',barbershop_id,'name',display_name) order by display_name) from public.staff where active),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_channel_movements order by created_at desc,id limit 30) h),'[]'::jsonb),
    'configuration_history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_number_config_history order by created_at desc,id limit 30) h),'[]'::jsonb)
  );
end $function$
;

-- Leitura limitada à loja solicitada, sem enumerar outros destinos.
create function public.shop_whatsapp_channel(p_shop uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if coalesce(auth.role(),'')<>'service_role' and not coalesce(public.shop_can_manage_whatsapp(p_shop),false) then raise exception 'Sem permissão' using errcode='42501'; end if;
 return (select to_jsonb(c) from public.whatsapp_delivery_channels c where barbershop_id=p_shop and staff_id is null);
end $$;
create function public.shop_update_whatsapp_preferences(p_shop uuid,p_link uuid,p_version bigint,p_enabled boolean,p_booking boolean,p_reminder boolean,p_hours integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.whatsapp_number_links%rowtype;
begin
 if not coalesce(public.shop_can_manage_whatsapp(p_shop),false) then raise exception 'Sem permissão' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into b from public.whatsapp_number_links where id=p_link and barbershop_id=p_shop and staff_id is null and removed_at is null for update;
 if b.id is null or b.version is distinct from p_version then raise exception 'WA_STALE' using errcode='40001'; end if;
 perform public.whatsapp_link_not_busy(b.id);
 update public.whatsapp_number_links set enabled=p_enabled,notify_booking=p_booking,notify_reminder=p_reminder,reminder_hours_before=p_hours,version=version+1 where id=b.id;
 insert into public.whatsapp_number_link_history(channel_id,link_id,actor_id,action,before_config,after_config)
 select b.channel_id,b.id,auth.uid(),'updated',to_jsonb(b),to_jsonb(l) from public.whatsapp_number_links l where id=b.id;
 -- Preferências não mudam o destino nem a conexão compartilhada.
 update public.whatsapp_channels c set enabled=l.enabled,notify_booking=l.notify_booking,notify_reminder=l.notify_reminder,reminder_hours_before=l.reminder_hours_before,routing_version=c.routing_version+1
 from public.whatsapp_number_links l where c.id=b.channel_id and l.id=b.id and c.barbershop_id=l.barbershop_id and c.staff_id is not distinct from l.staff_id;
 return public.shop_whatsapp_channel(p_shop);
end $$;
revoke all on function public.shop_whatsapp_channel(uuid),public.shop_update_whatsapp_preferences(uuid,uuid,bigint,boolean,boolean,boolean,integer) from public,anon;
grant execute on function public.shop_whatsapp_channel(uuid) to authenticated,service_role;
grant execute on function public.shop_update_whatsapp_preferences(uuid,uuid,bigint,boolean,boolean,boolean,integer) to authenticated;
CREATE OR REPLACE FUNCTION public.configure_shop_whatsapp_delivery(p_shop_id uuid, p_backup_instance text, p_mode text, p_reason text, p_return_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.whatsapp_channels%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  select * into c from public.whatsapp_channels where barbershop_id=p_shop_id and staff_id is null;
  if (select count(*) from public.whatsapp_number_links where channel_id=c.id and removed_at is null)>1 then raise exception 'WA_SHARED_MANAGE' using errcode='22023'; end if;
  return public.configure_whatsapp_number_internal(c.id,c.routing_version,p_backup_instance,p_mode,p_reason,p_return_enabled);
end $function$
;

-- Identidade/retorno continuam protegidos contra escrita direta pelo guard_whatsapp_assignment
-- (SECURITY INVOKER). A sincronização interna também atende exclusão autorizada por dono.
CREATE OR REPLACE FUNCTION public.guard_whatsapp_delivery_config()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare candidate public.whatsapp_channels%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  if auth.uid() is not null and not public.is_platform_admin() and (
    (tg_op='INSERT' and (new.backup_instance_name is not null or new.delivery_mode<>'primary' or new.return_notice_enabled))
    or (tg_op='UPDATE' and (new.instance_name is distinct from old.instance_name
    or new.status is distinct from old.status or new.display_phone is distinct from old.display_phone
    or new.backup_instance_name is distinct from old.backup_instance_name or new.delivery_mode is distinct from old.delivery_mode
    or new.delivery_reason is distinct from old.delivery_reason))
  ) then raise exception 'Somente a administração configura os números' using errcode='42501'; end if;
  if new.backup_instance_name is not null then
    select * into candidate from public.whatsapp_channels where instance_name=new.backup_instance_name;
    if new.backup_instance_name=new.instance_name or
       (candidate.id is not null and (candidate.barbershop_id is not null or candidate.staff_id is not null
       or candidate.enabled or candidate.backup_instance_name is not null or candidate.delivery_mode<>'primary')) or
       exists(select 1 from public.whatsapp_channels where id<>new.id and backup_instance_name=new.backup_instance_name)
    then raise exception 'WA_BACKUP_UNAVAILABLE' using errcode='23514'; end if;
  end if;
  if exists(select 1 from public.whatsapp_channels where id<>new.id and backup_instance_name=new.instance_name)
     and (new.barbershop_id is not null or new.staff_id is not null or new.enabled
          or new.backup_instance_name is not null or new.delivery_mode<>'primary') then
    raise exception 'WA_NUMBER_RESERVED' using errcode='23514';
  end if;
  return new;
end $function$
;
-- A exclusão de uma loja/profissional não exclui a conexão usada por outros.
create function public.whatsapp_detach_deleted_destination() returns trigger language plpgsql security definer set search_path=public as $$
declare r record;
begin
 if tg_table_name='staff' then
   if not exists(select 1 from public.barbershops where id=old.barbershop_id) then return old; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 perform public.whatsapp_link_not_busy(id) from public.whatsapp_number_links where
   (tg_table_name='barbershops' and barbershop_id=old.id) or (tg_table_name='staff' and staff_id=old.id);
 if exists(select 1 from public.whatsapp_channels c where (c.backup_instance_name is not null or c.delivery_mode<>'primary')
   and exists(select 1 from public.whatsapp_number_links l where l.channel_id=c.id and l.removed_at is null and
     ((tg_table_name='barbershops' and l.barbershop_id=old.id) or (tg_table_name='staff' and l.staff_id=old.id)))
   and not exists(select 1 from public.whatsapp_number_links l where l.channel_id=c.id and l.removed_at is null and not
     ((tg_table_name='barbershops' and l.barbershop_id=old.id) or (tg_table_name='staff' and l.staff_id is not distinct from old.id))))
 then raise exception 'WA_RESERVE_ASSIGNED' using errcode='22023'; end if;
 for r in select distinct channel_id from public.whatsapp_number_links where
   (tg_table_name='barbershops' and barbershop_id=old.id) or (tg_table_name='staff' and staff_id=old.id)
 loop
   update public.whatsapp_outbox set status='failed',error='Destino removido; aviso não enviado' where status='pending' and number_link_id in
     (select id from public.whatsapp_number_links where channel_id=r.channel_id and ((tg_table_name='barbershops' and barbershop_id=old.id) or (tg_table_name='staff' and staff_id=old.id)));
   update public.whatsapp_number_links set removed_at=coalesce(removed_at,now()),enabled=false where channel_id=r.channel_id and
     ((tg_table_name='barbershops' and barbershop_id=old.id) or (tg_table_name='staff' and staff_id=old.id));
   perform public.whatsapp_sync_legacy_anchor(r.channel_id);
 end loop;
 return old;
end $$;
create trigger whatsapp_detach_shop before delete on public.barbershops for each row execute function public.whatsapp_detach_deleted_destination();
create trigger whatsapp_detach_staff before delete on public.staff for each row execute function public.whatsapp_detach_deleted_destination();
revoke all on function public.whatsapp_detach_deleted_destination() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
