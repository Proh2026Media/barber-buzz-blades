-- Distribuição por destino, somente local. Não pareia, reconecta ou envia mensagens.
-- Papéis principal/reserva pertencem ao vínculo, nunca à conexão física.
alter table public.whatsapp_number_links
  add column backup_channel_id uuid references public.whatsapp_channels(id) on delete restrict,
  add column backup_legacy_instance text,
  add column delivery_mode text not null default 'primary' check(delivery_mode in ('primary','backup','paused')),
  add column delivery_reason text,
  add constraint whatsapp_link_different_numbers check(backup_channel_id is null or backup_channel_id<>channel_id);

-- Conserva a decisão anterior em cada destino, inclusive reserva histórica sem catálogo.
update public.whatsapp_number_links b set
  backup_channel_id=(select r.id from public.whatsapp_channels r where r.instance_name=c.backup_instance_name),
  backup_legacy_instance=case when not exists(select 1 from public.whatsapp_channels r where r.instance_name=c.backup_instance_name)
    then c.backup_instance_name end,
  delivery_mode=c.delivery_mode,delivery_reason=c.delivery_reason
from public.whatsapp_channels c where c.id=b.channel_id;

create or replace view public.whatsapp_delivery_channels with (security_invoker=true) as
select b.barbershop_id,c.instance_name,c.status,c.display_phone,b.enabled,b.notify_booking,b.notify_reminder,
 b.reminder_hours_before,c.last_error,c.created_at,c.updated_at,b.staff_id,c.id,
 coalesce(r.instance_name,b.backup_legacy_instance) as backup_instance_name,
 b.delivery_mode,b.delivery_reason,b.return_notice_enabled,c.label,c.routing_version,
 b.id as number_link_id,b.version as link_version
from public.whatsapp_channels c join public.whatsapp_number_links b on b.channel_id=c.id and b.removed_at is null
left join public.whatsapp_channels r on r.id=b.backup_channel_id;

-- A mensagem pendente pertence à versão da rota em que foi pedida.
alter table public.whatsapp_outbox add column number_link_version bigint;
update public.whatsapp_outbox o set number_link_version=b.version from public.whatsapp_number_links b
 where b.id=o.number_link_id and b.channel_id=o.channel_id and b.barbershop_id=o.barbershop_id;
create function public.whatsapp_snapshot_route_version() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.number_link_id is not null then
   select version into new.number_link_version from public.whatsapp_number_links
   where id=new.number_link_id and channel_id=new.channel_id and barbershop_id=new.barbershop_id and removed_at is null;
 end if;
 return new;
end $$;
create trigger whatsapp_snapshot_route_version before insert on public.whatsapp_outbox
 for each row execute function public.whatsapp_snapshot_route_version();
revoke all on function public.whatsapp_snapshot_route_version() from public,anon,authenticated,service_role;

-- A ligação entre perfis pessoais e números operacionais nunca concede autorização de envio.
create function public.whatsapp_operational_number(p_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_channels c where c.id=p_id
 and c.display_phone ~ '^\+?[1-9][0-9]{7,14}$'
 and not exists(select 1 from public.profiles p where
 regexp_replace(p.whatsapp_e164,'[^0-9]','','g')=regexp_replace(c.display_phone,'[^0-9]','','g')));
$$;
revoke all on function public.whatsapp_operational_number(uuid) from public,anon,authenticated,service_role;

create function public.platform_set_whatsapp_route(
 p_shop uuid,p_staff uuid,p_version bigint,p_primary_id uuid,p_backup_id uuid,
 p_mode text,p_enabled boolean,p_returns boolean,p_technical boolean
) returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.whatsapp_number_links%rowtype;r public.whatsapp_number_links%rowtype; active_instance text;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 -- Ordem idêntica à autorização final de saída.
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 if p_version is null or p_version<0 or p_enabled is null or p_returns is null or p_mode is null
    or p_mode not in ('primary','backup','paused') then raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.barbershops where id=p_shop and status='active' and nullif(btrim(name),'') is not null) or
    (p_staff is not null and not exists(select 1 from public.staff where id=p_staff and barbershop_id=p_shop and active))
 then raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
 select * into b from public.whatsapp_number_links where barbershop_id=p_shop and staff_id is not distinct from p_staff and removed_at is null for update;
 if (b.id is null and p_version<>0) or (b.id is not null and b.version<>p_version) then
   raise exception 'WA_STALE' using errcode='40001'; end if;
 if p_primary_id is null then
   if p_backup_id is not null or p_mode<>'paused' or p_enabled then raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
   if b.id is null then return null; end if;
   perform public.whatsapp_link_not_busy(b.id);
   update public.whatsapp_outbox set status='failed',error='Vínculo removido; aviso anterior não enviado' where number_link_id=b.id and status='pending';
   update public.whatsapp_number_links set removed_at=now(),enabled=false,version=version+1 where id=b.id returning * into r;
   insert into public.whatsapp_number_link_history(channel_id,link_id,actor_id,action,before_config,after_config)
    values(b.channel_id,b.id,auth.uid(),'removed',to_jsonb(b),to_jsonb(r));
   return to_jsonb(r);
 end if;
 if not public.whatsapp_operational_number(p_primary_id) or
    (p_backup_id is not null and (p_backup_id=p_primary_id or not public.whatsapp_operational_number(p_backup_id)
     or exists(select 1 from public.whatsapp_channels x join public.whatsapp_channels y on y.id=p_backup_id
       where x.id=p_primary_id and regexp_replace(x.display_phone,'[^0-9]','','g')=regexp_replace(y.display_phone,'[^0-9]','','g'))))
 then raise exception 'WA_NUMBER_UNAVAILABLE' using errcode='22023'; end if;
 if p_mode='backup' and (p_backup_id is null or p_technical is distinct from true) then
   raise exception 'WA_TECHNICAL_REQUIRED' using errcode='22023'; end if;
 if p_mode='backup' and exists(select 1 from public.whatsapp_send_controls where scope=p_primary_id::text and paused and reason='restriction') then
   raise exception 'WA_TECHNICAL_REQUIRED' using errcode='22023'; end if;
 select instance_name into active_instance from public.whatsapp_channels where id=case when p_mode='backup' then p_backup_id else p_primary_id end;
 if p_enabled and p_mode<>'paused' and public.whatsapp_sending_paused(active_instance,false) then
   raise exception 'WA_CONTROL_PAUSED' using errcode='55000'; end if;
 if b.id is not null then
   perform public.whatsapp_link_not_busy(b.id);
   if (b.channel_id,b.backup_channel_id,b.backup_legacy_instance,b.delivery_mode,b.enabled,b.return_notice_enabled)
     is not distinct from (p_primary_id,p_backup_id,null::text,p_mode,p_enabled,p_returns) then return to_jsonb(b); end if;
   update public.whatsapp_outbox set status='failed',error='Distribuição alterada; aviso anterior não enviado'
    where number_link_id=b.id and status='pending';
   update public.whatsapp_number_links set channel_id=p_primary_id,backup_channel_id=p_backup_id,backup_legacy_instance=null,
    delivery_mode=p_mode,delivery_reason=case when p_mode='backup' then 'technical_failure' when p_mode='paused' then 'review' end,
    enabled=p_enabled,return_notice_enabled=p_returns,version=version+1 where id=b.id returning * into r;
 else
   insert into public.whatsapp_number_links(channel_id,barbershop_id,staff_id,backup_channel_id,delivery_mode,delivery_reason,enabled,return_notice_enabled,version)
   values(p_primary_id,p_shop,p_staff,p_backup_id,p_mode,
    case when p_mode='backup' then 'technical_failure' when p_mode='paused' then 'review' end,p_enabled,p_returns,1) returning * into r;
 end if;
 insert into public.whatsapp_number_link_history(channel_id,link_id,actor_id,action,before_config,after_config)
 values(r.channel_id,r.id,auth.uid(),case when b.id is null then 'added' else 'routed' end,
  case when b.id is not null then to_jsonb(b) end,to_jsonb(r));
 return to_jsonb(r);
end $$;
revoke all on function public.platform_set_whatsapp_route(uuid,uuid,bigint,uuid,uuid,text,boolean,boolean,boolean) from public,anon,service_role;
grant execute on function public.platform_set_whatsapp_route(uuid,uuid,bigint,uuid,uuid,text,boolean,boolean,boolean) to authenticated;

-- As telas antigas não podem sobrescrever silenciosamente o modelo por destino.
create or replace function public.platform_add_whatsapp_link(p_id uuid,p_version bigint,p_shop uuid,p_staff uuid,p_enabled boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 raise exception 'WA_ROUTE_EDITOR_REQUIRED' using errcode='22023';
end $$;
create or replace function public.platform_assign_whatsapp_channel(p_id uuid,p_version bigint,p_shop uuid,p_staff uuid,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 raise exception 'WA_ROUTE_EDITOR_REQUIRED' using errcode='22023';
end $$;
create or replace function public.configure_whatsapp_number_internal(p_id uuid,p_version bigint,p_backup_instance text,p_mode text,p_reason text,p_return_enabled boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 raise exception 'WA_ROUTE_EDITOR_REQUIRED' using errcode='22023';
end $$;

-- Pausas de uma conta são próprias: A pausado não pausa B só porque B era sua reserva antiga.
create or replace function public.whatsapp_sending_paused(p_instance text,p_platform boolean default false)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_send_controls c where c.paused and
  (c.scope='global' or (p_platform and c.scope='platform') or exists(
   select 1 from public.whatsapp_channels n where n.id::text=c.scope and n.instance_name=p_instance)));
$$;

-- Preserva o autorizador de grupos/OTP. Só acrescenta proteção ao caminho de avisos da loja.
create function public.whatsapp_destination_route_current(p_outbox uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_outbox o join public.whatsapp_number_links b on b.id=o.number_link_id
  join public.whatsapp_channels c on c.id=case when b.delivery_mode='backup' then b.backup_channel_id else b.channel_id end
  where o.id=p_outbox and b.removed_at is null and b.channel_id=o.channel_id and b.barbershop_id=o.barbershop_id
   and o.number_link_version=b.version and public.whatsapp_operational_number(c.id)
   and not (b.delivery_mode='backup' and exists(select 1 from public.whatsapp_send_controls sc where sc.scope=b.channel_id::text and sc.paused and sc.reason='restriction'))
   and (b.backup_channel_id is null or exists(select 1 from public.whatsapp_channels x join public.whatsapp_channels y on y.id=b.backup_channel_id
     where x.id=b.channel_id and regexp_replace(x.display_phone,'[^0-9]','','g')<>regexp_replace(y.display_phone,'[^0-9]','','g'))));
$$;
revoke all on function public.whatsapp_destination_route_current(uuid) from public,anon,authenticated,service_role;
alter function public.prepare_whatsapp_delivery(uuid) rename to prepare_whatsapp_delivery_before_destinations;
create function public.prepare_whatsapp_delivery(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 if not public.whatsapp_destination_route_current(p_id) then
   update public.whatsapp_outbox set status='failed',error='Distribuição alterada; envio requer nova confirmação'
    where id=p_id and status='sending' and delivery_started_at is null;
   return null;
 end if;
 return public.prepare_whatsapp_delivery_before_destinations(p_id);
end $$;
revoke all on function public.prepare_whatsapp_delivery_before_destinations(uuid) from public,anon,authenticated,service_role;
revoke all on function public.prepare_whatsapp_delivery(uuid) from public,anon,authenticated,service_role;

alter function public.whatsapp_send_candidate(uuid,uuid,uuid,text,text) rename to whatsapp_send_candidate_before_destinations;
create function public.whatsapp_send_candidate(p_outbox_id uuid default null,p_lease_token uuid default null,p_challenge_id uuid default null,p_instance text default null,p_code_hash text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if p_outbox_id is not null and not public.whatsapp_destination_route_current(p_outbox_id) then return null; end if;
 return public.whatsapp_send_candidate_before_destinations(p_outbox_id,p_lease_token,p_challenge_id,p_instance,p_code_hash);
end $$;
revoke all on function public.whatsapp_send_candidate_before_destinations(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.whatsapp_send_candidate(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.whatsapp_send_candidate(uuid,uuid,uuid,text,text) to service_role;

create or replace function public.platform_whatsapp_directory() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 return jsonb_build_object('number_reserves',true,'number_sharing',true,'destination_routing',true,
  'links',coalesce((select jsonb_agg(to_jsonb(b) order by created_at,id) from public.whatsapp_number_links b where removed_at is null),'[]'::jsonb),
  'link_history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_number_link_history order by created_at desc,id limit 30) h),'[]'::jsonb),
  'channels',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.whatsapp_channels c),'[]'::jsonb),
  'shops',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.barbershops where status='active' and nullif(btrim(name),'') is not null),'[]'::jsonb),
  'staff',coalesce((select jsonb_agg(jsonb_build_object('id',id,'shop_id',barbershop_id,'name',display_name) order by display_name) from public.staff where active and exists(select 1 from public.barbershops s where s.id=barbershop_id and s.status='active' and nullif(btrim(s.name),'') is not null)),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_channel_movements order by created_at desc,id limit 30) h),'[]'::jsonb),
  'configuration_history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_number_config_history order by created_at desc,id limit 30) h),'[]'::jsonb));
end $$;

-- O status físico não pode copiar de volta preferências da primeira associação legada.
create or replace function public.whatsapp_sync_legacy_preferences() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' and new.barbershop_id is not null then
   insert into public.whatsapp_number_links(id,channel_id,barbershop_id,staff_id,enabled,notify_booking,notify_reminder,reminder_hours_before,return_notice_enabled)
   values(new.id,new.id,new.barbershop_id,new.staff_id,new.enabled,new.notify_booking,new.notify_reminder,new.reminder_hours_before,new.return_notice_enabled);
 end if;
 return new;
end $$;

-- Preferências e remoção antigas permanecem locais ao vínculo, sem mover a conexão.
create or replace function public.platform_update_whatsapp_link(p_link uuid,p_version bigint,p_enabled boolean,p_returns boolean,p_remove boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.whatsapp_number_links%rowtype;r public.whatsapp_number_links%rowtype;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into b from public.whatsapp_number_links where id=p_link and removed_at is null for update;
 if b.id is null or b.version is distinct from p_version then raise exception 'WA_STALE' using errcode='40001'; end if;
 perform public.whatsapp_link_not_busy(b.id);
 update public.whatsapp_outbox set status='failed',error='Preferências alteradas; aviso anterior não enviado' where number_link_id=b.id and status='pending';
 update public.whatsapp_number_links set enabled=case when p_remove then false else coalesce(p_enabled,false) end,
  return_notice_enabled=coalesce(p_returns,false),removed_at=case when p_remove then now() end,version=version+1 where id=b.id returning * into r;
 insert into public.whatsapp_number_link_history(channel_id,link_id,actor_id,action,before_config,after_config)
 values(b.channel_id,b.id,auth.uid(),case when p_remove then 'removed' else 'updated' end,to_jsonb(b),to_jsonb(r));
 return to_jsonb(r);
end $$;

create or replace function public.shop_update_whatsapp_preferences(p_shop uuid,p_link uuid,p_version bigint,p_enabled boolean,p_booking boolean,p_reminder boolean,p_hours integer)
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
 return public.shop_whatsapp_channel(p_shop);
end $$;

-- Pausa automática pertence à conta física que transmitiu, inclusive quando atende vários destinos.
create or replace function public.authorize_whatsapp_send_before_groups(p_expected_instance text,p_outbox_id uuid default null,p_lease_token uuid default null,
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
        where instance_name=p_expected_instance limit 1),'global') end,true,'review')
      on conflict(scope) do update set paused=true,reason='review',changed_by=null,changed_at=clock_timestamp(),version=whatsapp_send_controls.version+1;
    insert into public.whatsapp_send_control_history(scope,paused,reason)
      values(case when p_challenge_id is not null then 'platform' else coalesce((select id::text from public.whatsapp_channels
        where instance_name=p_expected_instance limit 1),'global') end,true,'review');
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
revoke all on function public.authorize_whatsapp_send_before_groups(text,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;

create or replace function public.defer_whatsapp_send(p_id uuid,p_lease_token uuid) returns void
language plpgsql security definer set search_path=public as $$
declare paused boolean; o public.whatsapp_outbox%rowtype;c public.whatsapp_delivery_channels%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into o from public.whatsapp_outbox where id=p_id;
 select * into c from public.whatsapp_delivery_channels where number_link_id=o.number_link_id and id=o.channel_id and barbershop_id=o.barbershop_id;
 paused:=public.whatsapp_sending_paused(case when c.delivery_mode='backup' then c.backup_instance_name else c.instance_name end,false)
   or (c.delivery_mode='backup' and exists(select 1 from public.whatsapp_send_controls sc where sc.scope=c.id::text and sc.paused and sc.reason='restriction'));
 update public.whatsapp_outbox x set status=case when coalesce(paused,false) or attempts<5 then 'pending'::public.whatsapp_outbox_status else 'failed'::public.whatsapp_outbox_status end,
   attempts=case when coalesce(paused,false) then greatest(0,attempts-1) else attempts end,
   scheduled_at=clock_timestamp()+interval '5 minutes',lease_token=null,lease_until=null,error='Envio adiado antes da transmissão'
   where id=p_id and status='sending' and lease_token=p_lease_token and delivery_started_at is null
     and not exists(select 1 from public.whatsapp_send_attempts a where a.outbox_id=x.id);
end $$;
