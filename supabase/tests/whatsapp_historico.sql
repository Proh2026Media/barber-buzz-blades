-- Banco descartável; agrega sem conteúdo, nunca acessa um número real.
begin;
create temporary table history_fixture as select gen_random_uuid() id;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.platform_create_whatsapp_channel(id,'Histórico fictício') from history_fixture;
update public.whatsapp_channels set status='open',display_phone='+5511900000666' where id=(select id from history_fixture);
update public.whatsapp_activity_identity set observed_since=now()-interval '60 days' where channel_id=(select id from history_fixture);
insert into public.whatsapp_send_attempts(challenge_id,instance_name,state,started_at)
select gen_random_uuid(),'bc-'||id,'accepted',now()-interval '40 days' from history_fixture union all
select gen_random_uuid(),'bc-'||id,'accepted',now()-interval '40 days' from history_fixture union all
select gen_random_uuid(),'bc-'||id,'unknown',now()-interval '1 day' from history_fixture;
do $$declare n uuid; history jsonb; begin
 select id into n from history_fixture;
 perform public.snapshot_whatsapp_activity_history(n);
 perform public.snapshot_whatsapp_activity_history(n);
 if (select sum(accepted) from public.whatsapp_activity_daily_history where channel_id=n)<>2 then raise exception 'Snapshot duplicou contagem';end if;
 raise notice 'PASS: snapshots repetidos não duplicam totais';
 perform public.purge_whatsapp_send_audit();
 perform public.purge_whatsapp_send_audit();
 if exists(select 1 from public.whatsapp_send_attempts where instance_name='bc-'||n and started_at<now()-interval '30 days') then raise exception 'Diário antigo não expurgado';end if;
 if (select sum(accepted) from public.whatsapp_activity_daily_history where channel_id=n)<>2 then raise exception 'Expurgo perdeu agregados';end if;
 raise notice 'PASS: retenção minimizada do diário preserva totais históricos';
 update public.whatsapp_channels set display_phone='+5511900000555' where id=n;
 history:=public.platform_whatsapp_number_history();
 if not exists(select 1 from jsonb_array_elements(history) h where h->>'display_phone'='5511900000666' and (h->>'historyAccepted')::int=0 and h->>'historyScope'='groups') then raise exception 'Telefone anterior desapareceu';end if;
 raise notice 'PASS: telefone anterior preservado; destinos desconhecidos não viram contagem de grupos';
 delete from public.whatsapp_channels where id=n;
 if not exists(select 1 from jsonb_array_elements(public.platform_whatsapp_directory()->'archived_numbers') h where h->>'display_phone'='5511900000666' and (h->>'historyAccepted')::int=0 and h->>'historyScope'='groups' and h->>'status'='archived') then raise exception 'Registro removido não aparece no histórico';end if;
 raise notice 'PASS: exclusão técnica não apaga catálogo; agregados desconhecidos permanecem privados';
 if has_function_privilege('authenticated','public.snapshot_whatsapp_activity_history(uuid)','execute') or has_table_privilege('authenticated','public.whatsapp_activity_daily_history','select') then raise exception 'Histórico interno exposto diretamente';end if;
 if has_function_privilege('service_role','public.purge_whatsapp_send_audit_before_history()','execute') then raise exception 'Expurgo antigo exposto';end if;
 raise notice 'PASS: acessos internos e expurgo antigo bloqueados';
end $$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$begin
 begin perform public.platform_whatsapp_number_history();raise exception 'Cliente leu histórico';exception when insufficient_privilege then raise notice 'PASS: somente administrador lê histórico';end;
end $$;
rollback;
