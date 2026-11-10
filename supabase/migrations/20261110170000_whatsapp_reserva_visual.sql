-- P-118: escolher a reserva pelo número cadastrado, na mesma central do principal.
-- Preserva configurações existentes; não conecta números nem envia mensagens.
create table public.whatsapp_number_config_history (
  id uuid primary key default gen_random_uuid(), channel_id uuid not null,
  actor_id uuid references public.profiles(id) on delete set null,
  before_config jsonb not null, after_config jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.whatsapp_number_config_history enable row level security;
revoke all on public.whatsapp_number_config_history from public,anon,authenticated;
grant select on public.whatsapp_number_config_history to authenticated;
create policy whatsapp_number_config_admin on public.whatsapp_number_config_history for select
  to authenticated using(public.is_platform_admin());

-- Uma reserva cadastrada fica livre de loja/profissional, pausada e exclusiva de um principal.
-- A conexão/status pode continuar sendo atualizada pelo endpoint existente.
create or replace function public.guard_whatsapp_delivery_config() returns trigger
language plpgsql security definer set search_path=public as $$
declare candidate public.whatsapp_channels%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  if auth.uid() is not null and not public.is_platform_admin() and (
    (tg_op='INSERT' and (new.backup_instance_name is not null or new.delivery_mode<>'primary' or new.return_notice_enabled))
    or (tg_op='UPDATE' and (new.instance_name is distinct from old.instance_name
    or new.barbershop_id is distinct from old.barbershop_id or new.staff_id is distinct from old.staff_id
    or new.status is distinct from old.status or new.display_phone is distinct from old.display_phone
    or new.backup_instance_name is distinct from old.backup_instance_name or new.delivery_mode is distinct from old.delivery_mode
    or new.return_notice_enabled is distinct from old.return_notice_enabled or new.delivery_reason is distinct from old.delivery_reason))
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
end $$;

-- Único gravador das configurações, compartilhado com o formulário legado da loja.
create function public.configure_whatsapp_number_internal(
  p_id uuid,p_version bigint,p_backup_instance text,p_mode text,p_reason text,p_return_enabled boolean
) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_channels%rowtype; result public.whatsapp_channels%rowtype;
  backup_name text:=nullif(trim(p_backup_instance),'');
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  select * into c from public.whatsapp_channels where id=p_id for update;
  if c.id is null or c.routing_version is distinct from p_version then raise exception 'WA_STALE' using errcode='40001'; end if;
  if c.barbershop_id is null or exists(select 1 from public.whatsapp_channels where backup_instance_name=c.instance_name) then
    raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
  if p_mode is null or p_mode not in ('primary','backup','paused') then raise exception 'WA_TARGET_INVALID' using errcode='22023'; end if;
  if p_mode='backup' and (backup_name is null or p_reason is distinct from 'technical_failure') then
    raise exception 'WA_TECHNICAL_REQUIRED' using errcode='22023'; end if;
  if p_reason='blocked' and p_mode<>'paused' then raise exception 'WA_TECHNICAL_REQUIRED' using errcode='22023'; end if;
  -- O trabalhador fixa a instância ao preparar; não alterar rota enquanto há resultado em aberto.
  if exists(select 1 from public.whatsapp_outbox where
    (channel_id=c.id or (channel_id is null and barbershop_id=c.barbershop_id)) and
    (status='sending' or (status='failed' and delivery_started_at is not null and provider_message_id is null))) then
    raise exception 'WA_DELIVERY_BUSY' using errcode='55000'; end if;
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
revoke all on function public.configure_whatsapp_number_internal(uuid,bigint,text,text,text,boolean) from public,anon,authenticated,service_role;

create function public.platform_configure_whatsapp_number(
  p_id uuid,p_version bigint,p_backup_id uuid,p_mode text,p_technical boolean,p_return_enabled boolean,p_keep_legacy boolean default false
) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_channels%rowtype; backup_name text;
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  select * into c from public.whatsapp_channels where id=p_id;
  if p_keep_legacy then
    if p_backup_id is not null or c.backup_instance_name is null or
      exists(select 1 from public.whatsapp_channels where instance_name=c.backup_instance_name) then
      raise exception 'WA_BACKUP_UNAVAILABLE' using errcode='22023'; end if;
    backup_name:=c.backup_instance_name;
  elsif p_backup_id is not null then
    select instance_name into backup_name from public.whatsapp_channels where id=p_backup_id;
    if backup_name is null then raise exception 'WA_BACKUP_UNAVAILABLE' using errcode='22023'; end if;
  end if;
  return public.configure_whatsapp_number_internal(p_id,p_version,backup_name,p_mode,
    case when p_technical then 'technical_failure' else 'review' end,p_return_enabled);
end $$;
revoke all on function public.platform_configure_whatsapp_number(uuid,bigint,uuid,text,boolean,boolean,boolean) from public,anon;
grant execute on function public.platform_configure_whatsapp_number(uuid,bigint,uuid,text,boolean,boolean,boolean) to authenticated;

-- Compatibilidade com a ficha antiga: mesma assinatura, agora versiona e audita a configuração.
create or replace function public.configure_shop_whatsapp_delivery(
  p_shop_id uuid,p_backup_instance text,p_mode text,p_reason text,p_return_enabled boolean
) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_channels%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  select * into c from public.whatsapp_channels where barbershop_id=p_shop_id and staff_id is null;
  return public.configure_whatsapp_number_internal(c.id,c.routing_version,p_backup_instance,p_mode,p_reason,p_return_enabled);
end $$;

create or replace function public.platform_whatsapp_directory() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  return jsonb_build_object(
    'number_reserves',true,
    'channels',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.whatsapp_channels c),'[]'::jsonb),
    'shops',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.barbershops where status='active'),'[]'::jsonb),
    'staff',coalesce((select jsonb_agg(jsonb_build_object('id',id,'shop_id',barbershop_id,'name',display_name) order by display_name) from public.staff where active),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_channel_movements order by created_at desc,id limit 30) h),'[]'::jsonb),
    'configuration_history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_number_config_history order by created_at desc,id limit 30) h),'[]'::jsonb)
  );
end $$;

create or replace function public.guard_whatsapp_assignment() returns trigger
language plpgsql set search_path=public as $$
begin
  if current_user in ('authenticated','anon','service_role') and
    (new.barbershop_id is distinct from old.barbershop_id or new.staff_id is distinct from old.staff_id
     or new.instance_name is distinct from old.instance_name or new.routing_version is distinct from old.routing_version
     or new.backup_instance_name is distinct from old.backup_instance_name or new.delivery_mode is distinct from old.delivery_mode
     or new.delivery_reason is distinct from old.delivery_reason or new.return_notice_enabled is distinct from old.return_notice_enabled) then
    raise exception 'Use a central de números' using errcode='42501'; end if;
  return new;
end $$;
