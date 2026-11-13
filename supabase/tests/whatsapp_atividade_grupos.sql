begin;
create temporary table group_metric_fixture as select gen_random_uuid() n,gen_random_uuid() shop,gen_random_uuid() g,gen_random_uuid() challenge;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.platform_create_whatsapp_channel(n,'Grupo fictício') from group_metric_fixture;
update public.whatsapp_channels set status='open',display_phone='+5511900000333' where id=(select n from group_metric_fixture);
update public.whatsapp_activity_identity set observed_since=now()-interval '10 days' where channel_id=(select n from group_metric_fixture);
insert into public.barbershops(id,name,slug) select shop,'Grupo métrica teste','metric-'||shop from group_metric_fixture;
insert into public.whatsapp_care_groups(id,barbershop_id,customer_id,customer_phone,group_jid)
 select g,shop,'11111111-1111-4111-8111-111111111111','+5511900000222','9999999999999-123@g.us' from group_metric_fixture;
insert into public.auth_otp_challenges(id,user_id,barbershop_id,channel,destination,code_hash,purpose,expires_at)
 select challenge,'11111111-1111-4111-8111-111111111111',shop,'whatsapp','+5511900000222',repeat('a',64),'login',now()+interval '1 minute' from group_metric_fixture;
insert into public.whatsapp_group_login_routes(challenge_id,group_id,version,instance_name)
 select challenge,g,1,'bc-'||n from group_metric_fixture;
insert into public.whatsapp_send_attempts(challenge_id,instance_name,state,started_at)
 select challenge,'bc-'||n,'accepted',now()-interval '1 day' from group_metric_fixture;
-- Tentativa sem rota comprovada não pode se declarar de grupo no próprio payload.
insert into public.whatsapp_send_attempts(challenge_id,instance_name,state,started_at,destination_kind,activity_group_id)
 select gen_random_uuid(),'bc-'||n,'accepted',now(), 'groups',g from group_metric_fixture;
do $$declare f record;m jsonb;begin
 select * into f from group_metric_fixture;
 if (select count(*) from public.whatsapp_send_attempts where instance_name='bc-'||f.n and destination_kind='groups')<>1 then raise exception 'Escopo forjado aceito';end if;
 m:=public.platform_whatsapp_number_activity()->f.n::text;
 if (m->>'accepted')::int<>1 or m->>'scope'<>'groups' then raise exception 'Privado/desconhecido entrou no cálculo: %',m;end if;
 raise notice 'PASS: somente envio de grupo comprovado entra no perfil';
 delete from public.auth_otp_challenges where id=f.challenge;
 if ((public.platform_whatsapp_number_activity()->f.n::text)->>'accepted')::int<>1 then raise exception 'Expurgo OTP apagou prova do envio';end if;
 raise notice 'PASS: prova de destino sobrevive ao expurgo do OTP';
 perform public.snapshot_whatsapp_activity_history(f.n);
 if (select sum(accepted) from public.whatsapp_activity_daily_history where channel_id=f.n and scope='groups')<>1 then raise exception 'Resumo de grupos incorreto';end if;
 if (select sum(accepted) from public.whatsapp_activity_daily_history where channel_id=f.n and scope='unknown')<>1 then raise exception 'Histórico desconhecido não preservado separadamente';end if;
 raise notice 'PASS: agregados de grupo e desconhecido permanecem separados';
end $$;
-- Mesmo grupo, três outros códigos válidos em momentos anteriores simulados.
-- Só a fixture recua created_at para exercer a guarda real sem esperar 60 s.
do $$declare f record;c uuid; m jsonb;begin
 select * into f from group_metric_fixture;
 for k in 1..3 loop
  update public.auth_otp_challenges set created_at=now()-interval '2 hours' where destination='+5511900000222';
  c:=gen_random_uuid();
  insert into public.auth_otp_challenges(id,user_id,barbershop_id,channel,destination,code_hash,purpose,expires_at)
  values(c,'11111111-1111-4111-8111-111111111111',f.shop,'whatsapp','+5511900000222',repeat('b',64),'login',now()+interval '1 minute');
  insert into public.whatsapp_group_login_routes values(c,f.g,1,'bc-'||f.n);
  insert into public.whatsapp_send_attempts(challenge_id,instance_name,state,started_at)
  values(c,'bc-'||f.n,case when k=3 then 'unknown' else 'accepted' end,now()-interval '3 days');
 end loop;
 m:=public.platform_whatsapp_number_activity()->f.n::text;
 if (m->>'accepted')::int<>3 or (m->>'activeDays')::int<>2 or (m->>'observedDays')::int<>4 or (m->>'uncertain')::int<>1 then raise exception 'Agregação de grupos incorreta: %',m;end if;
 raise notice 'PASS: volume, dias ativos distintos, janela e incertos de grupos';
 update public.whatsapp_send_attempts set state='accepted' where instance_name='bc-'||f.n and state='accepted';
 -- Simula expurgo parcial de um dia. Recalcular não pode reduzir os totais.
 delete from public.whatsapp_send_attempts where id=(select id from public.whatsapp_send_attempts where instance_name='bc-'||f.n and destination_kind='groups' and state='accepted' limit 1);
 perform public.snapshot_whatsapp_activity_history(f.n);
 perform public.snapshot_whatsapp_activity_history(f.n);
 if (select sum(accepted) from public.whatsapp_activity_daily_history where channel_id=f.n and scope='groups')<>3 then raise exception 'Total histórico perdido ou duplicado';end if;
 update public.whatsapp_channels set display_phone='+5511900000444' where id=f.n;
 if not exists(select 1 from jsonb_array_elements(public.platform_whatsapp_number_history()) h where h->>'display_phone'='5511900000333' and (h->>'historyAccepted')::int=3) then raise exception 'Histórico de grupos perdeu telefone anterior';end if;
 raise notice 'PASS: histórico de grupos conserva totais após reentrega, expurgo parcial e troca de telefone';
end $$;
rollback;
