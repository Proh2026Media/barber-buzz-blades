-- D1 somente local. Pré-requisitos: base D0 (111/112/115/116/117) e incrementais 01000–04000.
-- Aplicar o conjunto novo em UMA transação; nunca publicar as etapas intermediárias.
do $$begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='whatsapp_channels' and column_name='personal_number') then
  raise exception 'BC_D0_BASE_REQUIRED';end if;
 if exists(select 1 from public.whatsapp_outbox where status='sending') then raise exception 'BC_DELIVERY_IN_FLIGHT';end if;
end $$;
alter table public.whatsapp_number_links add column backup2_channel_id uuid references public.whatsapp_channels(id) on delete restrict,
 add column number_identities jsonb not null default '{}';
alter table public.whatsapp_number_links drop constraint whatsapp_number_links_delivery_mode_check;
alter table public.whatsapp_number_links add constraint whatsapp_number_links_delivery_mode_check check(delivery_mode in ('primary','backup','backup2','paused')),
 add constraint whatsapp_link_three_distinct check(backup2_channel_id is null or (backup2_channel_id<>channel_id and backup2_channel_id is distinct from backup_channel_id));

alter table public.whatsapp_number_history add column personal_number boolean not null default false;
update public.whatsapp_number_history h set personal_number=true where exists(select 1 from public.whatsapp_channels c where c.personal_number and regexp_replace(c.personal_phone,'[^0-9]','','g')=h.phone);

-- Sem backfill de identidade da fila: a configuração atual não prova o emissor antigo.
alter table public.whatsapp_outbox add column number_route_identity jsonb;
create or replace function public.whatsapp_snapshot_route_version() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 new.number_link_version:=null;new.number_route_identity:=null;
 if new.number_link_id is not null then
  select version,number_identities into new.number_link_version,new.number_route_identity
   from public.whatsapp_number_links where id=new.number_link_id and channel_id=new.channel_id and barbershop_id=new.barbershop_id and removed_at is null;
 end if;
 return new;
end $$;
-- Conserva o conteúdo/histórico, sem transmitir avisos da configuração anterior por suposição.
update public.whatsapp_outbox set status='failed',error='Aviso anterior à atualização de rota; revisão necessária'
 where status='pending' and number_route_identity is null;

create function public.whatsapp_complete_shop(p_shop uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.barbershops b where b.id=p_shop and b.status='active'
  and nullif(btrim(b.name),'') is not null and nullif(btrim(b.slug),'') is not null
  and exists(select 1 from public.barbershop_settings s where s.barbershop_id=b.id)
  and exists(select 1 from public.shop_members m where m.barbershop_id=b.id and m.role='owner' and m.active));
$$;
create or replace function public.whatsapp_operational_number(p_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_channels c where c.id=p_id and not c.personal_number
  and c.display_phone ~ '^\+?[1-9][0-9]{7,14}$'
  and not exists(select 1 from public.whatsapp_channels p where p.personal_number and regexp_replace(p.personal_phone,'[^0-9]','','g')=regexp_replace(c.display_phone,'[^0-9]','','g'))
  and not exists(select 1 from public.whatsapp_number_history h where h.personal_number and h.phone=regexp_replace(c.display_phone,'[^0-9]','','g'))
  and not exists(select 1 from public.profiles p where regexp_replace(p.whatsapp_e164,'[^0-9]','','g')=regexp_replace(c.display_phone,'[^0-9]','','g')));
$$;
create function public.whatsapp_route_numbers_valid(p_primary uuid,p_backup uuid,p_backup2 uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.whatsapp_operational_number(p_primary)
  and (p_backup is null or public.whatsapp_operational_number(p_backup))
  and (p_backup2 is null or public.whatsapp_operational_number(p_backup2))
  and (select count(*)=count(distinct regexp_replace(c.display_phone,'[^0-9]','','g')) from unnest(array[p_primary,p_backup,p_backup2]) role(id)
     join public.whatsapp_channels c on c.id=role.id where role.id is not null);
$$;
revoke all on function public.whatsapp_complete_shop(uuid),public.whatsapp_route_numbers_valid(uuid,uuid,uuid),public.whatsapp_operational_number(uuid) from public,anon,authenticated,service_role;

-- Os leitores legados continuam vendo modo backup e a reserva EFETIVA escolhida.
create or replace view public.whatsapp_delivery_channels with (security_invoker=true) as
select b.barbershop_id,c.instance_name,c.status,c.display_phone,b.enabled,b.notify_booking,b.notify_reminder,
 b.reminder_hours_before,c.last_error,c.created_at,c.updated_at,b.staff_id,c.id,
 coalesce(case when b.delivery_mode='backup2' then r2.instance_name else r.instance_name end,b.backup_legacy_instance) as backup_instance_name,
 case when b.delivery_mode='backup2' then 'backup' else b.delivery_mode end as delivery_mode,b.delivery_reason,b.return_notice_enabled,c.label,c.routing_version,
 b.id as number_link_id,b.version as link_version
from public.whatsapp_channels c join public.whatsapp_number_links b on b.channel_id=c.id and b.removed_at is null
left join public.whatsapp_channels r on r.id=b.backup_channel_id
left join public.whatsapp_channels r2 on r2.id=b.backup2_channel_id;

update public.whatsapp_number_links b set number_identities=(select coalesce(jsonb_object_agg(c.id::text,jsonb_build_object('phone',regexp_replace(c.display_phone,'[^0-9]','','g'),'instance',c.instance_name)),'{}')
 from public.whatsapp_channels c where c.id in (b.channel_id,b.backup_channel_id,b.backup2_channel_id));

create or replace function public.guard_whatsapp_personal_channel() returns trigger
language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' and current_user in ('authenticated','anon','service_role') and
   (new.personal_number is distinct from old.personal_number or new.personal_owner_id is distinct from old.personal_owner_id
    or new.personal_phone is distinct from old.personal_phone or new.personal_marked_at is distinct from old.personal_marked_at
    or new.personal_marked_by is distinct from old.personal_marked_by) then
   raise exception 'WA_PERSONAL_CLASSIFICATION_REQUIRED' using errcode='42501'; end if;
 if new.personal_number and (new.enabled or new.barbershop_id is not null or new.staff_id is not null
   or new.backup_instance_name is not null or new.delivery_mode<>'primary' or new.return_notice_enabled) then
   raise exception 'WA_PERSONAL_NUMBER' using errcode='23514'; end if;
 if new.backup_instance_name is not null and exists(select 1 from public.whatsapp_channels c where c.instance_name=new.backup_instance_name and c.personal_number) then
   raise exception 'WA_PERSONAL_NUMBER' using errcode='23514'; end if;
 if not new.personal_number and new.display_phone is not null and exists(select 1 from public.whatsapp_channels c where c.personal_number and c.personal_phone=new.display_phone) then
   raise exception 'WA_PERSONAL_NUMBER' using errcode='23514'; end if;
 return new;
end $$;

create or replace function public.guard_whatsapp_personal_binding() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='whatsapp_number_links' then
  if new.removed_at is null and exists(select 1 from public.whatsapp_channels where id in(new.channel_id,new.backup_channel_id,new.backup2_channel_id) and personal_number) then raise exception 'WA_PERSONAL_NUMBER' using errcode='23514';end if;
 elsif exists(select 1 from public.whatsapp_channels where id=new.channel_id and personal_number) then raise exception 'WA_PERSONAL_NUMBER' using errcode='23514';end if;
 return new;
end $$;
create or replace function public.platform_mark_whatsapp_personal(p_id uuid,p_owner uuid,p_version bigint) returns void
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_channels%rowtype; phone text;
begin
 if coalesce(auth.role(),'')<>'service_role' and not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into c from public.whatsapp_channels where id=p_id for update;
 if c.id is null then raise exception 'WA_STALE'; end if;
 if c.personal_number then
   if c.personal_owner_id=p_owner then return; end if;
   raise exception 'WA_PERSONAL_REVIEW_REQUIRED'; end if;
 if c.routing_version is distinct from p_version then raise exception 'WA_STALE'; end if;
 select whatsapp_e164 into phone from public.profiles where id=p_owner;
 if phone is null or phone is distinct from c.display_phone or phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'WA_PERSONAL_OWNER_MISMATCH'; end if;
 if c.enabled or c.barbershop_id is not null or c.staff_id is not null or c.backup_instance_name is not null
   or c.delivery_mode<>'primary' or c.return_notice_enabled
   or exists(select 1 from public.whatsapp_channels where backup_instance_name=c.instance_name)
   or exists(select 1 from public.whatsapp_number_links where c.id in (channel_id,backup_channel_id,backup2_channel_id) and removed_at is null)
   or exists(select 1 from public.whatsapp_group_accounts where channel_id=c.id)
   or exists(select 1 from public.whatsapp_send_attempts where instance_name=c.instance_name and state in ('started','unknown'))
   or exists(select 1 from public.whatsapp_outbox where channel_id=c.id and status in ('pending','sending')) then
   raise exception 'WA_PERSONAL_REVIEW_REQUIRED'; end if;
 update public.whatsapp_channels set personal_number=true,personal_owner_id=p_owner,personal_phone=phone,
   personal_marked_at=clock_timestamp(),personal_marked_by=auth.uid(),routing_version=routing_version+1 where id=c.id;
 update public.whatsapp_number_history h set personal_number=true where h.phone=regexp_replace(c.display_phone,'[^0-9]','','g');
 -- Não altera perfil, verificação, pausa existente ou sessão no aparelho/Evolution.
end $$;

create function public.platform_set_whatsapp_route(
 p_shop uuid,p_staff uuid,p_version bigint,p_primary_id uuid,p_backup_id uuid,p_backup2_id uuid,
 p_mode text,p_enabled boolean,p_returns boolean,p_technical boolean
) returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.whatsapp_number_links%rowtype;r public.whatsapp_number_links%rowtype; active_instance text; identities jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 -- Ordem idêntica à autorização final de saída.
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 if p_version is null or p_version<0 or p_enabled is null or p_returns is null or p_mode is null
    or p_mode not in ('primary','backup','backup2','paused') then raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
 if not public.whatsapp_complete_shop(p_shop) or
    (p_staff is not null and not exists(select 1 from public.staff where id=p_staff and barbershop_id=p_shop and active))
 then raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
 select * into b from public.whatsapp_number_links where barbershop_id=p_shop and staff_id is not distinct from p_staff and removed_at is null for update;
 if (b.id is null and p_version<>0) or (b.id is not null and b.version<>p_version) then
   raise exception 'WA_STALE' using errcode='40001'; end if;
 if p_primary_id is null then
   if p_backup_id is not null or p_backup2_id is not null or p_mode<>'paused' or p_enabled then raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
   if b.id is null then return null; end if;
   perform public.whatsapp_link_not_busy(b.id);
   update public.whatsapp_outbox set status='failed',error='Vínculo removido; aviso anterior não enviado' where number_link_id=b.id and status='pending';
   update public.whatsapp_number_links set removed_at=now(),enabled=false,version=version+1 where id=b.id returning * into r;
   insert into public.whatsapp_number_link_history(channel_id,link_id,actor_id,action,before_config,after_config)
    values(b.channel_id,b.id,auth.uid(),'removed',to_jsonb(b),to_jsonb(r));
   return to_jsonb(r);
 end if;
 if not public.whatsapp_route_numbers_valid(p_primary_id,p_backup_id,p_backup2_id) then
   raise exception 'WA_NUMBER_UNAVAILABLE' using errcode='22023'; end if;
 select jsonb_object_agg(c.id::text,jsonb_build_object('phone',regexp_replace(c.display_phone,'[^0-9]','','g'),'instance',c.instance_name)) into identities
 from public.whatsapp_channels c where c.id in (p_primary_id,p_backup_id,p_backup2_id);
 if (p_mode='backup' and p_backup_id is null) or (p_mode='backup2' and p_backup2_id is null) or (p_mode in ('backup','backup2') and p_technical is distinct from true) then
   raise exception 'WA_TECHNICAL_REQUIRED' using errcode='22023'; end if;
 if p_mode in ('backup','backup2') and public.whatsapp_number_restricted(p_primary_id) then
   raise exception 'WA_TECHNICAL_REQUIRED' using errcode='22023'; end if;
 select instance_name into active_instance from public.whatsapp_channels where id=case p_mode when 'backup' then p_backup_id when 'backup2' then p_backup2_id else p_primary_id end;
 if p_enabled and p_mode<>'paused' and (public.whatsapp_sending_paused(active_instance,false) or not exists(select 1 from public.whatsapp_channels where instance_name=active_instance and status='open')) then
   raise exception 'WA_CONTROL_PAUSED' using errcode='55000'; end if;
 if b.id is not null then
   perform public.whatsapp_link_not_busy(b.id);
   if (b.channel_id,b.backup_channel_id,b.backup_legacy_instance,b.delivery_mode,b.enabled,b.return_notice_enabled,b.backup2_channel_id,b.number_identities)
     is not distinct from (p_primary_id,p_backup_id,null::text,p_mode,p_enabled,p_returns,p_backup2_id,identities) then return to_jsonb(b); end if;
   update public.whatsapp_outbox set status='failed',error='Distribuição alterada; aviso anterior não enviado'
    where number_link_id=b.id and status='pending';
   update public.whatsapp_number_links set channel_id=p_primary_id,backup_channel_id=p_backup_id,backup_legacy_instance=null,backup2_channel_id=p_backup2_id,number_identities=identities,
    delivery_mode=p_mode,delivery_reason=case when p_mode in ('backup','backup2') then 'technical_failure' when p_mode='paused' then 'review' end,
    enabled=p_enabled,return_notice_enabled=p_returns,version=version+1 where id=b.id returning * into r;
 else
   insert into public.whatsapp_number_links(channel_id,barbershop_id,staff_id,backup_channel_id,delivery_mode,delivery_reason,enabled,return_notice_enabled,version,backup2_channel_id,number_identities)
   values(p_primary_id,p_shop,p_staff,p_backup_id,p_mode,
    case when p_mode in ('backup','backup2') then 'technical_failure' when p_mode='paused' then 'review' end,p_enabled,p_returns,1,p_backup2_id,identities) returning * into r;
 end if;
 insert into public.whatsapp_number_link_history(channel_id,link_id,actor_id,action,before_config,after_config)
 values(r.channel_id,r.id,auth.uid(),case when b.id is null then 'added' else 'routed' end,
  case when b.id is not null then to_jsonb(b) end,to_jsonb(r));
 return to_jsonb(r);
end $$;

revoke all on function public.platform_set_whatsapp_route(uuid,uuid,bigint,uuid,uuid,uuid,text,boolean,boolean,boolean) from public,anon,service_role;
grant execute on function public.platform_set_whatsapp_route(uuid,uuid,bigint,uuid,uuid,uuid,text,boolean,boolean,boolean) to authenticated;
-- Compatibilidade: um formulário antigo não descarta a segunda reserva nova.
create or replace function public.platform_set_whatsapp_route(p_shop uuid,p_staff uuid,p_version bigint,p_primary_id uuid,p_backup_id uuid,p_mode text,p_enabled boolean,p_returns boolean,p_technical boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 if exists(select 1 from public.whatsapp_number_links where barbershop_id=p_shop and staff_id is not distinct from p_staff and removed_at is null and backup2_channel_id is not null) then raise exception 'WA_ROUTE_UPGRADE_REQUIRED' using errcode='22023';end if;
 return public.platform_set_whatsapp_route(p_shop,p_staff,p_version,p_primary_id,p_backup_id,null,p_mode,p_enabled,p_returns,p_technical);
end $$;

-- Cadastro de conta autorizada também participa do protocolo de classificação pessoal.
create or replace function public.care_group_admin(p_action text,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then return public.care_group_admin_before_exclusive(p_action,p_values)-'eligible_staff';end if;
 if p_action<>'read' then
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 end if;
 if p_action='propose_participant' then raise exception 'GROUP_PLATFORM_ONLY' using errcode='42501';end if;
 return public.care_group_admin_before_exclusive(p_action,p_values)-'eligible_staff';
end $$;

create or replace function public.configure_whatsapp_number_internal(
  p_id uuid,p_version bigint,p_backup_instance text,p_mode text,p_reason text,p_return_enabled boolean
) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_channels%rowtype; result public.whatsapp_channels%rowtype;
  backup_name text:=nullif(trim(p_backup_instance),'');
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  select * into c from public.whatsapp_channels where id=p_id for update;
  if c.id is null or c.routing_version is distinct from p_version then raise exception 'WA_STALE' using errcode='40001'; end if;
  if c.barbershop_id is not null or exists(select 1 from public.whatsapp_number_links where removed_at is null and channel_id=c.id) then raise exception 'WA_ROUTE_EDITOR_REQUIRED' using errcode='22023';end if;
  if exists(select 1 from public.whatsapp_channels where backup_instance_name=c.instance_name) then
    raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
  -- Número sem loja pode reservar outro, sem liberar envio, trocar rota de grupo ou assumir por falha.
  if c.barbershop_id is null and (c.personal_number or c.display_phone is null
      or c.display_phone !~ '^\+[1-9][0-9]{7,14}$' or p_mode is distinct from 'primary'
      or coalesce(p_return_enabled,false)) then
    raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
  if c.barbershop_id is null and backup_name is not null and not exists(
      select 1 from public.whatsapp_channels b where b.instance_name=backup_name and not b.personal_number
      and b.display_phone ~ '^\+[1-9][0-9]{7,14}$') then
    raise exception 'WA_BACKUP_UNAVAILABLE' using errcode='22023'; end if;
  if p_mode is null or p_mode not in ('primary','backup','paused') then raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
  if p_mode='backup' and (backup_name is null or p_reason is distinct from 'technical_failure') then
    raise exception 'WA_TECHNICAL_REQUIRED' using errcode='22023'; end if;
  if p_reason='blocked' and p_mode<>'paused' then raise exception 'WA_TECHNICAL_REQUIRED' using errcode='22023'; end if;
  -- O trabalhador fixa a instância ao preparar; não alterar rota enquanto há resultado em aberto.
  if exists(select 1 from public.whatsapp_outbox where
    (channel_id=c.id or (channel_id is null and barbershop_id=c.barbershop_id)) and
    (status='sending' or (status='failed' and delivery_started_at is not null and provider_message_id is null))) then
    raise exception 'WA_DELIVERY_BUSY' using errcode='55000'; end if;
  if exists(select 1 from public.whatsapp_send_attempts where instance_name in (c.instance_name,c.backup_instance_name,backup_name) and state in ('started','unknown')) then raise exception 'WA_DELIVERY_BUSY' using errcode='55000'; end if;
  update public.whatsapp_channels set backup_instance_name=backup_name,delivery_mode=p_mode,
    delivery_reason=case when p_mode='backup' then 'technical_failure' when p_mode='paused' then 'review' else null end,
    return_notice_enabled=coalesce(p_return_enabled,false),routing_version=routing_version+1
    where id=c.id returning * into result;
  -- Também invalida formulários abertos dos números que ganharam/perderam o papel de reserva.
  if c.backup_instance_name is distinct from backup_name then
    update public.whatsapp_channels set routing_version=routing_version+1
      where instance_name in (c.backup_instance_name,backup_name) and id<>c.id;
  end if;
  insert into public.whatsapp_number_config_history(channel_id,actor_id,before_config,after_config)
    values(c.id,auth.uid(),jsonb_build_object('backup',c.backup_instance_name,'mode',c.delivery_mode,'returns',c.return_notice_enabled),
      jsonb_build_object('backup',result.backup_instance_name,'mode',result.delivery_mode,'returns',result.return_notice_enabled));
  return to_jsonb(result);
end $$;

create function public.whatsapp_number_restricted(p_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_channels c where c.id=p_id and (
  exists(select 1 from public.whatsapp_channels other join public.whatsapp_send_controls control on control.scope=other.id::text
   where control.paused and control.reason='restriction' and regexp_replace(other.display_phone,'[^0-9]','','g')=regexp_replace(c.display_phone,'[^0-9]','','g'))
  or exists(select 1 from public.whatsapp_number_history h where h.restricted and h.phone=regexp_replace(c.display_phone,'[^0-9]','','g'))));
$$;
revoke all on function public.whatsapp_number_restricted(uuid) from public,anon,authenticated,service_role;

create or replace function public.whatsapp_sending_paused(p_instance text,p_platform boolean default false) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_channels where instance_name=p_instance and (personal_number or public.whatsapp_number_restricted(id)))
 or exists(select 1 from public.whatsapp_send_controls c where c.paused and
  (c.scope='global' or (p_platform and c.scope='platform') or exists(select 1 from public.whatsapp_channels n where n.id::text=c.scope and n.instance_name=p_instance)));
$$;
create or replace function public.whatsapp_destination_route_current(p_outbox uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_outbox o join public.whatsapp_number_links b on b.id=o.number_link_id
  where o.id=p_outbox and b.removed_at is null and b.channel_id=o.channel_id and b.barbershop_id=o.barbershop_id
   and exists(select 1 from public.whatsapp_channels active_number where active_number.id=case b.delivery_mode when 'backup' then b.backup_channel_id when 'backup2' then b.backup2_channel_id else b.channel_id end and active_number.status='open' and not public.whatsapp_sending_paused(active_number.instance_name,false))
   and b.version=o.number_link_version and o.number_route_identity=b.number_identities and public.whatsapp_route_numbers_valid(b.channel_id,b.backup_channel_id,b.backup2_channel_id)
   and b.number_identities=(select coalesce(jsonb_object_agg(c.id::text,jsonb_build_object('phone',regexp_replace(c.display_phone,'[^0-9]','','g'),'instance',c.instance_name)),'{}') from public.whatsapp_channels c where c.id in(b.channel_id,b.backup_channel_id,b.backup2_channel_id))
   and not (b.delivery_mode in ('backup','backup2') and public.whatsapp_number_restricted(b.channel_id)));
$$;

create or replace function public.snapshot_whatsapp_activity_history(p_id uuid default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 insert into public.whatsapp_number_history(channel_id,phone,label,display_phone,instance_name,restricted)
 select c.id,regexp_replace(c.display_phone,'[^0-9]','','g'),c.label,c.display_phone,c.instance_name,exists(select 1 from public.whatsapp_send_controls s where s.scope=c.id::text and s.reason='restriction' and s.paused)
 from public.whatsapp_channels c where not c.personal_number and (p_id is null or c.id=p_id) and c.display_phone ~ '^\+?[1-9][0-9]{7,14}$'
 and exists(select 1 from public.whatsapp_activity_identity i where i.channel_id=c.id and i.phone=regexp_replace(c.display_phone,'[^0-9]','','g'))
 on conflict(channel_id,phone) do update set label=excluded.label,display_phone=excluded.display_phone,
  instance_name=excluded.instance_name,captured_at=now(),restricted=whatsapp_number_history.restricted or excluded.restricted;
 insert into public.whatsapp_activity_daily_history(channel_id,phone,identity_since,day,scope,accepted,uncertain)
 select c.id,i.phone,i.observed_since,(a.started_at at time zone 'UTC')::date,a.destination_kind,
  count(*) filter(where a.state='accepted'),
  count(*) filter(where a.state='unknown' or (a.state='started' and a.started_at<now()-interval '2 minutes'))
 from public.whatsapp_channels c join public.whatsapp_activity_identity i on i.channel_id=c.id
 join public.whatsapp_send_attempts a on a.instance_name=c.instance_name and a.started_at>=i.observed_since and a.started_at<=now()
 where not c.personal_number and (p_id is null or c.id=p_id) and a.destination_kind='unknown'
 group by c.id,i.phone,i.observed_since,(a.started_at at time zone 'UTC')::date,a.destination_kind
 on conflict(channel_id,phone,identity_since,day,scope) do update set accepted=greatest(whatsapp_activity_daily_history.accepted,excluded.accepted),uncertain=greatest(whatsapp_activity_daily_history.uncertain,excluded.uncertain);
end $$;
revoke all on function public.snapshot_whatsapp_activity_history(uuid) from public,anon,authenticated,service_role;

alter function public.platform_whatsapp_number_history() rename to platform_whatsapp_number_history_before_personal;
revoke all on function public.platform_whatsapp_number_history_before_personal() from public,anon,authenticated,service_role;
create function public.platform_whatsapp_number_history() returns jsonb
language plpgsql security definer set search_path=public as $$
declare d jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 d:=public.platform_whatsapp_number_history_before_personal();
 return coalesce((select jsonb_agg(item) from jsonb_array_elements(d) item
  where not exists(select 1 from public.whatsapp_number_history h where h.phone=item->>'display_phone' and h.personal_number)
  and not exists(select 1 from public.whatsapp_channels c where c.personal_number and regexp_replace(c.personal_phone,'[^0-9]','','g')=item->>'display_phone')),'[]'::jsonb);
end $$;
revoke all on function public.platform_whatsapp_number_history() from public,anon,service_role;
grant execute on function public.platform_whatsapp_number_history() to authenticated;

alter function public.platform_whatsapp_directory() rename to platform_whatsapp_directory_before_three_positions;
revoke all on function public.platform_whatsapp_directory_before_three_positions() from public,anon,authenticated,service_role;
create function public.platform_whatsapp_directory() returns jsonb
language plpgsql security definer set search_path=public as $$
declare d jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 d:=public.platform_whatsapp_directory_before_three_positions();
 return d||jsonb_build_object('second_reserve',true,'personal_numbers_excluded',true,'complete_shops_only',true,'unassigned_reserves',true,
  'channels',coalesce((select jsonb_agg(c) from jsonb_array_elements(d->'channels') c where not coalesce((c->>'personal_number')::boolean,false) and not exists(select 1 from public.whatsapp_number_history h where h.personal_number and h.phone=regexp_replace(c->>'display_phone','[^0-9]','','g'))),'[]'::jsonb),
  'shops',coalesce((select jsonb_agg(s) from jsonb_array_elements(d->'shops') s where public.whatsapp_complete_shop((s->>'id')::uuid)),'[]'::jsonb),
  'staff',coalesce((select jsonb_agg(s) from jsonb_array_elements(d->'staff') s where public.whatsapp_complete_shop((s->>'shop_id')::uuid)),'[]'::jsonb));
end $$;
revoke all on function public.platform_whatsapp_directory() from public,anon,service_role;
grant execute on function public.platform_whatsapp_directory() to authenticated;
notify pgrst,'reload schema';
