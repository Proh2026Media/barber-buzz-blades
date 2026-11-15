-- D4 local. Registro técnico, sem credenciais; exclusões ficam como revogações versionadas.
create sequence public.whatsapp_care_registry_version;
create table public.whatsapp_care_registry (
 instance_name text primary key,owner_jid text,enabled boolean not null,source_version bigint not null,
 acknowledged_version bigint,attempt_after timestamptz not null default now(),changed_at timestamptz not null default now()
);
alter table public.whatsapp_care_registry enable row level security;
revoke all on public.whatsapp_care_registry from public,anon,authenticated,service_role;
revoke all on sequence public.whatsapp_care_registry_version from public,anon,authenticated,service_role;
create function public.care_cycle_registry_write(p_instance text,p_owner text,p_enabled boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 insert into public.whatsapp_care_registry(instance_name,owner_jid,enabled,source_version)
 values(p_instance,p_owner,p_enabled,nextval('public.whatsapp_care_registry_version'))
 on conflict(instance_name) do update set owner_jid=excluded.owner_jid,enabled=excluded.enabled,source_version=excluded.source_version,attempt_after=now(),changed_at=now()
 where whatsapp_care_registry.owner_jid is distinct from excluded.owner_jid or whatsapp_care_registry.enabled is distinct from excluded.enabled;
end $$;
create function public.care_cycle_registry_change() returns trigger language plpgsql security definer set search_path=public as $$
declare owner text;enabled boolean;
begin
 if tg_op='DELETE' then
  update public.whatsapp_care_cycles c set state=case when c.state='closed' then c.state else 'closing' end,revision=revision+1,reason='number_removed',next_run_at=now() where exists(select 1 from jsonb_array_elements(c.consented_numbers) n where n->>'id'=old.id::text);
  update public.whatsapp_care_groups g set controls_verified=false,revoked_at=now(),state='closed',reason='number_removed' from public.whatsapp_care_cycles c where c.id=g.current_cycle_id and c.reason='number_removed';
  perform public.care_cycle_registry_write(old.instance_name,null,false);return old;
 end if;
 if tg_op='UPDATE' and old.instance_name<>new.instance_name then perform public.care_cycle_registry_write(old.instance_name,null,false);end if;
 owner:=case when new.display_phone ~ '^\+?[1-9][0-9]{7,14}$' then regexp_replace(new.display_phone,'[^0-9]','','g')||'@s.whatsapp.net' end;
 enabled:=public.care_cycle_number_valid(new.id,jsonb_build_object('id',new.id,'phone','+'||regexp_replace(new.display_phone,'[^0-9]','','g'),'instance',new.instance_name),false);
 perform public.care_cycle_registry_write(new.instance_name,case when enabled then owner end,enabled);
 return new;
end $$;
create trigger care_cycle_registry_change after insert or update of display_phone,instance_name,personal_number,platform_control_identity or delete on public.whatsapp_channels for each row execute function public.care_cycle_registry_change();
select public.care_cycle_registry_write(c.instance_name,case when public.care_cycle_number_valid(c.id,jsonb_build_object('id',c.id,'phone','+'||regexp_replace(c.display_phone,'[^0-9]','','g'),'instance',c.instance_name),false) then regexp_replace(c.display_phone,'[^0-9]','','g')||'@s.whatsapp.net' end,public.care_cycle_number_valid(c.id,jsonb_build_object('id',c.id,'phone','+'||regexp_replace(c.display_phone,'[^0-9]','','g'),'instance',c.instance_name),false)) from public.whatsapp_channels c;
create function public.care_cycle_registry_pending() returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(todo)),'[]') from (select instance_name,owner_jid,enabled,source_version from public.whatsapp_care_registry where acknowledged_version is distinct from source_version and attempt_after<=now() order by attempt_after,source_version limit 25) todo;
$$;
create function public.care_cycle_registry_ack(p_instance text,p_version bigint,p_ok boolean) returns void language sql security definer set search_path=public as $$
 update public.whatsapp_care_registry set acknowledged_version=case when p_ok then p_version else acknowledged_version end,attempt_after=now()+interval '1 minute' where instance_name=p_instance and source_version=p_version;
$$;

create function public.care_cycle_route_changed() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if (tg_op='INSERT' or new.channel_id is distinct from old.channel_id or new.backup_channel_id is distinct from old.backup_channel_id or new.backup2_channel_id is distinct from old.backup2_channel_id or new.removed_at is distinct from old.removed_at or new.delivery_mode is distinct from old.delivery_mode) then
  update public.whatsapp_care_cycles c set state='paused',reason='numbers_changed',prepared=false,revision=revision+1,next_run_at=now()
  from public.whatsapp_care_groups g where g.current_cycle_id=c.id and g.barbershop_id=new.barbershop_id and c.state not in ('closed','closing');
  perform public.care_cycle_sync_accounts(c.id) from public.whatsapp_care_cycles c join public.whatsapp_care_groups g on g.current_cycle_id=c.id where g.barbershop_id=new.barbershop_id and c.state not in ('closing','closed');
  update public.whatsapp_care_groups set controls_verified=false,reason=case when reason='operator_pause' then reason else 'numbers_changed' end,version=version+1
  where barbershop_id=new.barbershop_id and current_cycle_id is not null and state not in ('closed','customer_left');
 end if;
 return new;
end $$;
create trigger care_cycle_route_changed after insert or update on public.whatsapp_number_links for each row execute function public.care_cycle_route_changed();
revoke all on function public.care_cycle_registry_write(text,text,boolean),public.care_cycle_registry_change(),public.care_cycle_registry_pending(),public.care_cycle_registry_ack(text,bigint,boolean),public.care_cycle_route_changed() from public,anon,authenticated,service_role;
grant execute on function public.care_cycle_registry_pending(),public.care_cycle_registry_ack(text,bigint,boolean) to service_role;
notify pgrst,'reload schema';
