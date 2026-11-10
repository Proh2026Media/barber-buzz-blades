-- P-118: reverter em transação; não apaga números, configurações ou histórico.
do $$ begin
 if exists(select 1 from public.whatsapp_channels a join public.whatsapp_channels b on a.backup_instance_name=b.instance_name)
 or exists(select 1 from public.whatsapp_outbox where status='sending' or (status='failed' and delivery_started_at is not null and provider_message_id is null))
 then raise exception 'Retire reservas cadastradas e confira envios em aberto antes de reverter'; end if;
end $$;
create or replace function public.configure_shop_whatsapp_delivery(
  p_shop_id uuid, p_backup_instance text, p_mode text, p_reason text, p_return_enabled boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.whatsapp_channels%rowtype; backup_name text := nullif(trim(p_backup_instance), '');
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing', 116));
  select * into c from public.whatsapp_channels where barbershop_id=p_shop_id and staff_id is null for update;
  if c.id is null then raise exception 'Conecte o canal principal primeiro' using errcode='22023'; end if;
  if p_mode is null or p_mode not in ('primary','backup','paused') then
    raise exception 'Canal inválido' using errcode='22023';
  end if;
  if backup_name is not null and (backup_name = c.instance_name or exists (
    select 1 from public.whatsapp_channels x where x.instance_name=backup_name
      or (x.id<>c.id and x.backup_instance_name=backup_name)
  )) then raise exception 'Esta reserva já pertence a outro canal' using errcode='22023'; end if;
  if p_mode='backup' and (backup_name is null or p_reason is distinct from 'technical_failure') then
    raise exception 'A reserva exige falha técnica confirmada' using errcode='22023';
  end if;
  if p_reason='blocked' and p_mode<>'paused' then
    raise exception 'Canal bloqueado exige pausa e revisão' using errcode='22023';
  end if;
  update public.whatsapp_channels set backup_instance_name=backup_name, delivery_mode=p_mode,
    delivery_reason=case when p_mode='backup' then 'technical_failure'
                        when p_mode='paused' then 'review' else null end,
    return_notice_enabled=coalesce(p_return_enabled,false)
  where id=c.id returning * into c;
  return to_jsonb(c);
end $$;
create or replace function public.guard_whatsapp_delivery_config() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
  if auth.uid() is not null and not public.is_platform_admin() and (
    (tg_op='INSERT' and (new.backup_instance_name is not null or new.delivery_mode<>'primary' or new.return_notice_enabled))
    or (tg_op='UPDATE' and (new.instance_name is distinct from old.instance_name
    or new.barbershop_id is distinct from old.barbershop_id
    or new.staff_id is distinct from old.staff_id
    or new.status is distinct from old.status
    or new.display_phone is distinct from old.display_phone
    or new.backup_instance_name is distinct from old.backup_instance_name
    or new.delivery_mode is distinct from old.delivery_mode
    or new.delivery_reason is distinct from old.delivery_reason
    or new.return_notice_enabled is distinct from old.return_notice_enabled))
  ) then raise exception 'Somente a administração configura os canais' using errcode='42501'; end if;
  if new.backup_instance_name is not null and exists (
    select 1 from public.whatsapp_channels where instance_name=new.backup_instance_name
  ) then raise exception 'Reserva não pode ser o principal de outro canal' using errcode='23514'; end if;
  if exists (select 1 from public.whatsapp_channels where backup_instance_name=new.instance_name and id<>new.id) then
    raise exception 'Principal já reservado por outro canal' using errcode='23514';
  end if;
  return new;
end $$;
create or replace function public.platform_whatsapp_directory() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
  return jsonb_build_object(
    'channels',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.whatsapp_channels c),'[]'::jsonb),
    'shops',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.barbershops where status='active'),'[]'::jsonb),
    'staff',coalesce((select jsonb_agg(jsonb_build_object('id',id,'shop_id',barbershop_id,'name',display_name) order by display_name) from public.staff where active),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.whatsapp_channel_movements order by created_at desc,id limit 30) h),'[]'::jsonb)
  );
end $$;
drop function public.platform_configure_whatsapp_number(uuid,bigint,uuid,text,boolean,boolean,boolean);
drop function public.configure_whatsapp_number_internal(uuid,bigint,text,text,text,boolean);
create or replace function public.guard_whatsapp_assignment() returns trigger
language plpgsql set search_path=public as $$
begin
  if current_user in ('authenticated','anon','service_role') and
    (new.barbershop_id is distinct from old.barbershop_id or new.staff_id is distinct from old.staff_id
     or new.instance_name is distinct from old.instance_name or new.routing_version is distinct from old.routing_version) then
    raise exception 'Use a central de canais' using errcode='42501'; end if;
  return new;
end $$;
