-- Histórico minimizado: preserva catálogo e totais diários, não mensagens/destinatários.
create table public.whatsapp_number_history (
 channel_id uuid primary key, label text, display_phone text, instance_name text not null,
 captured_at timestamptz not null default now(), restricted boolean not null default false
);
create table public.whatsapp_activity_daily_history (
 channel_id uuid not null, phone text not null, identity_since timestamptz not null,
 day date not null, accepted bigint not null, uncertain bigint not null,
 primary key(channel_id,phone,identity_since,day)
);
alter table public.whatsapp_number_history enable row level security;
alter table public.whatsapp_activity_daily_history enable row level security;
revoke all on public.whatsapp_number_history,public.whatsapp_activity_daily_history from public,anon,authenticated,service_role;

create function public.snapshot_whatsapp_activity_history(p_id uuid default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 insert into public.whatsapp_number_history(channel_id,label,display_phone,instance_name,restricted)
 select c.id,c.label,c.display_phone,c.instance_name,exists(select 1 from public.whatsapp_send_controls s where s.scope=c.id::text and s.reason='restriction' and s.paused)
 from public.whatsapp_channels c where (p_id is null or c.id=p_id) and c.display_phone ~ '^\+?[1-9][0-9]{7,14}$'
 on conflict(channel_id) do update set label=excluded.label,display_phone=excluded.display_phone,
  instance_name=excluded.instance_name,captured_at=now(),restricted=excluded.restricted;
 insert into public.whatsapp_activity_daily_history(channel_id,phone,identity_since,day,accepted,uncertain)
 select c.id,i.phone,i.observed_since,(a.started_at at time zone 'UTC')::date,
  count(*) filter(where a.state='accepted'),
  count(*) filter(where a.state='unknown' or (a.state='started' and a.started_at<now()-interval '2 minutes'))
 from public.whatsapp_channels c join public.whatsapp_activity_identity i on i.channel_id=c.id
 join public.whatsapp_send_attempts a on a.instance_name=c.instance_name and a.started_at>=i.observed_since and a.started_at<=now()
 where p_id is null or c.id=p_id
 group by c.id,i.phone,i.observed_since,(a.started_at at time zone 'UTC')::date
 on conflict(channel_id,phone,identity_since,day) do update set accepted=excluded.accepted,uncertain=excluded.uncertain;
end $$;
revoke all on function public.snapshot_whatsapp_activity_history(uuid) from public,anon,authenticated,service_role;

create function public.whatsapp_history_before_identity_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 perform public.snapshot_whatsapp_activity_history(old.id);
 return old;
end $$;
revoke all on function public.whatsapp_history_before_identity_change() from public,anon,authenticated,service_role;
create trigger whatsapp_history_before_delete before delete on public.whatsapp_channels
 for each row execute function public.whatsapp_history_before_identity_change();
-- UPDATE deve devolver NEW; captura OLD antes de a identidade ser substituída.
create function public.whatsapp_history_before_phone_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.display_phone is distinct from old.display_phone then perform public.snapshot_whatsapp_activity_history(old.id); end if;
 return new;
end $$;
revoke all on function public.whatsapp_history_before_phone_change() from public,anon,authenticated,service_role;
create trigger whatsapp_history_before_phone_change before update of display_phone on public.whatsapp_channels
 for each row execute function public.whatsapp_history_before_phone_change();

alter function public.purge_whatsapp_send_audit() rename to purge_whatsapp_send_audit_before_history;
revoke all on function public.purge_whatsapp_send_audit_before_history() from public,anon,authenticated,service_role;
create function public.purge_whatsapp_send_audit() returns void
language plpgsql security definer set search_path=public as $$
begin
 perform public.snapshot_whatsapp_activity_history();
 perform public.purge_whatsapp_send_audit_before_history();
end $$;
revoke all on function public.purge_whatsapp_send_audit() from public,anon,authenticated;
grant execute on function public.purge_whatsapp_send_audit() to service_role;

create function public.platform_whatsapp_number_history() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 with historical as (
  select d.channel_id,d.phone,sum(d.accepted) accepted,sum(d.uncertain) uncertain
  from public.whatsapp_activity_daily_history d
  where not exists(select 1 from public.whatsapp_channels c where c.id=d.channel_id and regexp_replace(c.display_phone,'[^0-9]','','g')=d.phone)
  group by d.channel_id,d.phone
 ), entries as (
  select h.channel_id,h.label,d.phone,h.restricted,d.accepted,d.uncertain from historical d
  join public.whatsapp_number_history h on h.channel_id=d.channel_id
  union all
  select h.channel_id,h.label,regexp_replace(h.display_phone,'[^0-9]','','g'),h.restricted,0,0
  from public.whatsapp_number_history h where not exists(select 1 from public.whatsapp_channels c where c.id=h.channel_id)
   and not exists(select 1 from historical d where d.channel_id=h.channel_id and d.phone=regexp_replace(h.display_phone,'[^0-9]','','g'))
 ) select coalesce(jsonb_agg(jsonb_build_object('id','history:'||channel_id||':'||phone,'label',label,'display_phone',phone,
  'status',case when restricted then 'restricted' else 'archived' end,
  'historyAccepted',accepted,'historyUncertain',uncertain)),'[]') into result from entries;
 return result;
end $$;
revoke all on function public.platform_whatsapp_number_history() from public,anon,service_role;
grant execute on function public.platform_whatsapp_number_history() to authenticated;
alter function public.platform_whatsapp_directory() rename to platform_whatsapp_directory_before_history;
revoke all on function public.platform_whatsapp_directory_before_history() from public,anon,authenticated,service_role;
create function public.platform_whatsapp_directory() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 return public.platform_whatsapp_directory_before_history() || jsonb_build_object('archived_numbers',public.platform_whatsapp_number_history());
end $$;
revoke all on function public.platform_whatsapp_directory() from public,anon,service_role;
grant execute on function public.platform_whatsapp_directory() to authenticated;
