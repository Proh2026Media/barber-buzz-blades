begin;
create temporary table activity_fixture as select gen_random_uuid() id;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.platform_create_whatsapp_channel(id,'Atividade fictícia') from activity_fixture;
update public.whatsapp_channels set status='open',display_phone='+5511900000888' where id=(select id from activity_fixture);
-- Somente fixture: simula prova de identidade já observada por 20 dias.
update public.whatsapp_activity_identity set observed_since=now()-interval '20 days' where channel_id=(select id from activity_fixture);
insert into public.whatsapp_send_attempts(challenge_id,instance_name,state,started_at)
select gen_random_uuid(),'bc-'||id,'accepted',now()-interval '3 days' from activity_fixture union all
select gen_random_uuid(),'bc-'||id,'accepted',now()-interval '3 days' from activity_fixture union all
select gen_random_uuid(),'bc-'||id,'accepted',now()-interval '1 day' from activity_fixture union all
select gen_random_uuid(),'bc-'||id,'unknown',now()-interval '1 day' from activity_fixture union all
select gen_random_uuid(),'bc-'||id,'started',now()-interval '10 minutes' from activity_fixture union all
select gen_random_uuid(),'bc-'||id,'accepted',now()-interval '40 days' from activity_fixture;
do $$declare n uuid; m jsonb;begin
 select id into n from activity_fixture;
 m:=public.platform_whatsapp_number_activity()->n::text;
 if (m->>'accepted')::int<>3 or (m->>'uncertain')::int<>2 or (m->>'activeDays')::int<>2 or (m->>'observedDays')::int<>4 then raise exception 'Agregação incorreta: %',m;end if;
 if public.platform_whatsapp_directory()->'number_activity'->n::text is distinct from m then raise exception 'Diretório sem métricas';end if;
 if has_function_privilege('anon','public.platform_whatsapp_number_activity()','execute') then raise exception 'Anônimo autorizado';end if;
 if has_function_privilege('authenticated','public.platform_whatsapp_directory_before_activity()','execute') then raise exception 'Wrapper anterior exposto';end if;
 raise notice 'PASS: aceites, incertos, dias distintos, janela, diretório e privilégios';
 update public.whatsapp_channels set display_phone='+5511900000777' where id=n;
 if ((public.platform_whatsapp_number_activity()->n::text)->>'accepted')::int<>0 then raise exception 'Telefone novo herdou atividade antiga';end if;
 raise notice 'PASS: troca de telefone não herda atividade anterior';
end $$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$begin
 begin perform public.platform_whatsapp_number_activity();raise exception 'Acesso indevido';exception when insufficient_privilege then raise notice 'PASS: não administrador impedido';end;
end $$;
rollback;
