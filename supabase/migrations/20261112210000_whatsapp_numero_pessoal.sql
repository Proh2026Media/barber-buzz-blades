-- Nº 115. Independente das nº 113/114. Não classifica nem altera contas reais automaticamente.
begin;
alter table public.whatsapp_channels
 add column personal_number boolean not null default false,
 add column personal_owner_id uuid references public.profiles(id) on delete set null,
 add column personal_phone text,
 add column personal_marked_at timestamptz,
 add column personal_marked_by uuid references public.profiles(id) on delete set null,
 add constraint whatsapp_personal_metadata check(not personal_number or (personal_phone ~ '^\+[1-9][0-9]{7,14}$' and personal_phone is not null and personal_marked_at is not null));

create function public.guard_whatsapp_personal_channel() returns trigger
language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
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
create trigger whatsapp_personal_channel_guard before insert or update on public.whatsapp_channels
 for each row execute function public.guard_whatsapp_personal_channel();

create function public.guard_whatsapp_personal_binding() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 if exists(select 1 from public.whatsapp_channels where id=new.channel_id and personal_number) then
   if tg_table_name='whatsapp_number_links' then
     if new.removed_at is null then raise exception 'WA_PERSONAL_NUMBER' using errcode='23514'; end if;
   else raise exception 'WA_PERSONAL_NUMBER' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger whatsapp_personal_link_guard before insert or update on public.whatsapp_number_links
 for each row execute function public.guard_whatsapp_personal_binding();
create trigger whatsapp_personal_group_guard before insert or update on public.whatsapp_group_accounts
 for each row execute function public.guard_whatsapp_personal_binding();

create function public.platform_mark_whatsapp_personal(p_id uuid,p_owner uuid,p_version bigint) returns void
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_channels%rowtype; phone text;
begin
 if coalesce(auth.role(),'')<>'service_role' and not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
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
   or exists(select 1 from public.whatsapp_number_links where channel_id=c.id and removed_at is null)
   or exists(select 1 from public.whatsapp_group_accounts where channel_id=c.id)
   or exists(select 1 from public.whatsapp_send_attempts where instance_name=c.instance_name and state in ('started','unknown'))
   or exists(select 1 from public.whatsapp_outbox where channel_id=c.id and status in ('pending','sending')) then
   raise exception 'WA_PERSONAL_REVIEW_REQUIRED'; end if;
 update public.whatsapp_channels set personal_number=true,personal_owner_id=p_owner,personal_phone=phone,
   personal_marked_at=clock_timestamp(),personal_marked_by=auth.uid(),routing_version=routing_version+1 where id=c.id;
 -- Não altera perfil, verificação, histórico, pausa existente ou sessão no aparelho/Evolution.
end $$;

alter function public.platform_whatsapp_directory() rename to platform_whatsapp_directory_before_personal;
revoke all on function public.platform_whatsapp_directory_before_personal() from public,anon,authenticated,service_role;
create function public.platform_whatsapp_directory() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 result:=public.platform_whatsapp_directory_before_personal();
 return jsonb_set(result,'{channels}',coalesce((select jsonb_agg(row.value order by row.ord)
   from jsonb_array_elements(result->'channels') with ordinality row(value,ord)
   where coalesce((row.value->>'personal_number')::boolean,false)=false),'[]'::jsonb));
end $$;

create or replace function public.whatsapp_sending_paused(p_instance text,p_platform boolean default false)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_channels where instance_name=p_instance and personal_number)
 or exists(select 1 from public.whatsapp_send_controls c where c.paused and
    (c.scope='global' or (p_platform and c.scope='platform') or exists(
      select 1 from public.whatsapp_channels n where n.id::text=c.scope and
        (n.instance_name=p_instance or n.backup_instance_name=p_instance))));
$$;
revoke all on function public.guard_whatsapp_personal_channel(),public.guard_whatsapp_personal_binding(),
 public.platform_mark_whatsapp_personal(uuid,uuid,bigint),public.platform_whatsapp_directory() from public,anon,authenticated,service_role;
grant execute on function public.platform_mark_whatsapp_personal(uuid,uuid,bigint) to authenticated,service_role;
grant execute on function public.platform_whatsapp_directory() to authenticated;
commit;
