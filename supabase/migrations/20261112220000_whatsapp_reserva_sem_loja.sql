-- Nº 116. Requer nº 115. Não escolhe números reais, altera ambiente ou configura grupos.
begin;
create or replace function public.configure_whatsapp_number_internal(
  p_id uuid,p_version bigint,p_backup_instance text,p_mode text,p_reason text,p_return_enabled boolean
) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_channels%rowtype; result public.whatsapp_channels%rowtype;
  backup_name text:=nullif(trim(p_backup_instance),'');
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  select * into c from public.whatsapp_channels where id=p_id for update;
  if c.id is null or c.routing_version is distinct from p_version then raise exception 'WA_STALE' using errcode='40001'; end if;
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

alter function public.platform_whatsapp_directory() rename to platform_whatsapp_directory_before_unassigned_reserve;
revoke all on function public.platform_whatsapp_directory_before_unassigned_reserve() from public,anon,authenticated,service_role;
create function public.platform_whatsapp_directory() returns jsonb
language sql security definer set search_path=public as $$
 select public.platform_whatsapp_directory_before_unassigned_reserve() || jsonb_build_object('unassigned_reserves',true);
$$;
revoke all on function public.platform_whatsapp_directory() from public,anon,service_role;
grant execute on function public.platform_whatsapp_directory() to authenticated;
commit;
