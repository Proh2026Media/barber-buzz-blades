-- Identidade observada: não atribui registros anteriores a um telefone sem prova.
create table public.whatsapp_activity_identity (
 channel_id uuid primary key references public.whatsapp_channels(id) on delete cascade,
 phone text not null, observed_since timestamptz not null default now()
);
alter table public.whatsapp_activity_identity enable row level security;
revoke all on public.whatsapp_activity_identity from public,anon,authenticated,service_role;
insert into public.whatsapp_activity_identity(channel_id,phone)
 select id,regexp_replace(display_phone,'[^0-9]','','g') from public.whatsapp_channels
 where status='open' and display_phone ~ '^\+?[1-9][0-9]{7,14}$';
create function public.whatsapp_track_activity_identity() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.status='open' and new.display_phone ~ '^\+?[1-9][0-9]{7,14}$' then
  insert into public.whatsapp_activity_identity(channel_id,phone,observed_since)
   values(new.id,regexp_replace(new.display_phone,'[^0-9]','','g'),clock_timestamp())
   on conflict(channel_id) do update set phone=excluded.phone,observed_since=excluded.observed_since
   where whatsapp_activity_identity.phone is distinct from excluded.phone;
 end if;
 return new;
end $$;
revoke all on function public.whatsapp_track_activity_identity() from public,anon,authenticated,service_role;
create trigger whatsapp_track_activity_identity after insert or update of status,display_phone on public.whatsapp_channels
 for each row execute function public.whatsapp_track_activity_identity();

-- Somente preparação local: estatísticas minimizadas dos registros existentes, sem enviar.
create function public.platform_whatsapp_number_activity() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 -- São aceites pelo provedor, não comprovantes de entrega. O diário retém 30 dias.
 with metrics as (
  select c.id,
   count(a.id) filter(where a.state='accepted') as accepted,
   count(a.id) filter(where a.state='unknown' or (a.state='started' and a.started_at<now()-interval '2 minutes')) as uncertain,
   count(distinct (a.started_at at time zone 'UTC')::date) filter(where a.state='accepted') as active_days,
   least(30,coalesce((now() at time zone 'UTC')::date-min((a.started_at at time zone 'UTC')::date)+1,0)) as observed_days,
   public.whatsapp_sending_paused(c.instance_name,false) as paused
  from public.whatsapp_channels c left join public.whatsapp_activity_identity i on i.channel_id=c.id and i.phone=regexp_replace(c.display_phone,'[^0-9]','','g')
  left join public.whatsapp_send_attempts a
    on a.instance_name=c.instance_name and a.started_at>=i.observed_since and a.started_at>=(((now() at time zone 'UTC')::date-29)::timestamp at time zone 'UTC') and a.started_at<=now()
  group by c.id,c.instance_name
 ) select coalesce(jsonb_object_agg(id::text,jsonb_build_object('accepted',accepted,'uncertain',uncertain,
   'activeDays',active_days,'observedDays',observed_days,'sampledAt',now(),'source','dispatch','paused',paused)),'{}') into result from metrics;
 return result;
end $$;
revoke all on function public.platform_whatsapp_number_activity() from public,anon,service_role;
grant execute on function public.platform_whatsapp_number_activity() to authenticated;

alter function public.platform_whatsapp_directory() rename to platform_whatsapp_directory_before_activity;
revoke all on function public.platform_whatsapp_directory_before_activity() from public,anon,authenticated,service_role;
create function public.platform_whatsapp_directory() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 return public.platform_whatsapp_directory_before_activity() || jsonb_build_object('number_activity',public.platform_whatsapp_number_activity());
end $$;
revoke all on function public.platform_whatsapp_directory() from public,anon,service_role;
grant execute on function public.platform_whatsapp_directory() to authenticated;
