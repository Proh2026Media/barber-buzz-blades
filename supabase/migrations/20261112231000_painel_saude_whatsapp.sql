-- Leitura operacional minimizada; não retorna QR, destinatários, mensagens ou segredos.
create function public.platform_whatsapp_health_data() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501'; end if;
 return jsonb_build_object('read_at',now(),'global_paused',exists(select 1 from whatsapp_send_controls where scope='global' and paused),
 'numbers',coalesce((select jsonb_agg(jsonb_build_object(
  'id',c.id,'name',coalesce(c.label,c.display_phone),'phone',c.display_phone,'instance_name',c.instance_name,
  'paused',not c.enabled or public.whatsapp_sending_paused(c.instance_name,c.barbershop_id is null),
  'unknown',(select count(*) from whatsapp_send_attempts a where a.instance_name=c.instance_name and a.started_at>now()-interval '24 hours' and (a.state='unknown' or (a.state='started' and a.started_at<now()-interval '2 minutes'))),
  'failed',(select count(*) from whatsapp_outbox o where o.channel_id=c.id and o.status='failed' and o.created_at>now()-interval '24 hours'),
  'pending',(select count(*) from whatsapp_outbox o where o.channel_id=c.id and o.status='pending' and o.scheduled_at<now()-interval '5 minutes'),
  'last_accepted_at',(select max(a.finished_at) from whatsapp_send_attempts a where a.instance_name=c.instance_name and a.state='accepted')
 ) order by c.display_phone) from whatsapp_channels c where c.id in (select (item->>'id')::uuid from jsonb_array_elements(public.platform_whatsapp_directory()->'channels') item) and regexp_replace(coalesce(c.display_phone,''),'[^0-9]','','g') ~ '^[1-9][0-9]{7,14}$'),'[]'::jsonb));
end $$;
revoke all on function public.platform_whatsapp_health_data() from public,anon;
grant execute on function public.platform_whatsapp_health_data() to authenticated;
