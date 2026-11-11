-- Somente dados fictícios, BEGIN/ROLLBACK no banco local com a migration nº 105.
create temporary table wa120 as select gen_random_uuid() shop,gen_random_uuid() other_shop,
  gen_random_uuid() customer,gen_random_uuid() other_customer,gen_random_uuid() owner,
  gen_random_uuid() staff,gen_random_uuid() service,gen_random_uuid() appointment,
  '+55119'||lpad((floor(random()*100000000))::bigint::text,8,'0') phone;
grant select on wa120 to authenticated;
create function pg_temp.check_wa120(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
insert into auth.users(id,email,raw_user_meta_data)
select u,u||'@example.invalid','{}'::jsonb from wa120 c cross join lateral unnest(array[c.customer,c.other_customer,c.owner]) u;
insert into public.barbershops(id,name,slug)
select shop,'Loja fictícia','w120-'||shop from wa120 union all select other_shop,'Outra fictícia','w120-'||other_shop from wa120;
insert into public.staff(id,barbershop_id,display_name,user_id,booking_slug)
select staff,shop,'Profissional fictício',owner,'teste' from wa120;
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select shop,owner,staff,'owner',100 from wa120;
insert into public.services(id,barbershop_id,name,duration_minutes,price_cents)
select service,shop,'Corte fictício',30,1000 from wa120;
select set_config('request.jwt.claim.role','service_role',true);
select public.apply_verified_whatsapp(customer,phone,true) is not null from wa120;
select set_config('request.jwt.claim.role','',true);
insert into public.whatsapp_channels(barbershop_id,instance_name,status)
select shop,'teste-'||shop,'open'::public.whatsapp_channel_status from wa120 union all select other_shop,'teste-'||other_shop,'open' from wa120;




update public.whatsapp_send_controls set paused=false;
update public.whatsapp_group_settings set enrollment_enabled=true;
update public.whatsapp_channels set display_phone='+5511888888888';
insert into public.whatsapp_group_accounts(barbershop_id,channel_id)
  select c.shop,n.id from wa120 c join public.whatsapp_channels n on n.barbershop_id=c.shop;
select set_config('request.jwt.claim.role','service_role',true);
select public.apply_verified_whatsapp(owner,'+5511777777777',true) is not null from wa120;
select set_config('request.jwt.claim.role','',true);
select set_config('request.jwt.claim.sub',customer::text,true) from wa120;
select public.care_group_request(shop,true,array(select id from public.whatsapp_group_accounts)) is not null from wa120;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.care_group_admin('propose_participant',jsonb_build_object('group_id',g.id,'version',g.version,'user_id',c.owner)) is not null
  from public.whatsapp_care_groups g cross join wa120 c;
select set_config('request.jwt.claim.sub',customer::text,true) from wa120;
select public.care_group_customer_update(g.id,g.version,'approve_participant',jsonb_build_object('user_id',c.owner)) is not null
  from public.whatsapp_care_groups g cross join wa120 c;
select set_config('request.jwt.claim.sub','',true);

select pg_temp.check_wa120((select approved_phone='+5511777777777' from public.whatsapp_care_participants),'Aprovação captura telefone verificado da pessoa');
select pg_temp.check_wa120(not has_function_privilege('authenticated','public.authorize_care_group_step(uuid,uuid,text)','execute'),'Usuário não autoriza etapas do worker');
select pg_temp.check_wa120(not has_function_privilege('authenticated','public.recover_care_group_creation(uuid,text)','execute'),'Usuário não associa grupo externo');
select pg_temp.check_wa120(not has_function_privilege('service_role','public.care_group_event_before_integration(text,text,text,text,text,text,boolean)','execute'),'Serviço não chama receptor legado diretamente');
create temporary table care_job107 as select public.claim_care_group_operation(o.id,true) job
 from public.whatsapp_care_operations o join public.whatsapp_care_groups g on g.id=o.group_id and g.version=o.version;
select pg_temp.check_wa120((select job->>'token' is not null from care_job107),'Operação recebe autorização com contexto completo');
select pg_temp.check_wa120((select job->'approved_phones' ? '+5511777777777' from care_job107),'Contexto contém somente equipe aprovada');
select pg_temp.check_wa120(public.authorize_care_group_step((job->>'id')::uuid,(job->>'token')::uuid,'create') is not null,'Etapa confere posse e consentimento novamente') from care_job107;
do $$ begin
 begin perform public.authorize_care_group_step((select (job->>'id')::uuid from care_job107),gen_random_uuid(),'create'); raise exception 'FAIL: token de outra posse';
 exception when raise_exception then if sqlerrm<>'GROUP_STALE' then raise; end if; end;
 raise notice 'PASS: token alheio não autoriza chamada';
 begin update public.whatsapp_group_settings set enrollment_enabled=false;
 perform public.authorize_care_group_step((select (job->>'id')::uuid from care_job107),(select (job->>'token')::uuid from care_job107),'create');
 raise exception 'FAIL: flag desligada permitiu chamada'; exception when raise_exception then if sqlerrm<>'GROUP_STALE' then raise; end if; end;
 raise notice 'PASS: flag desligada entre etapas bloqueia chamada';
 begin update public.whatsapp_care_groups set version=version+1;
 perform public.authorize_care_group_step((select (job->>'id')::uuid from care_job107),(select (job->>'token')::uuid from care_job107),'create');
 raise exception 'FAIL: versão antiga permitiu chamada'; exception when raise_exception then if sqlerrm<>'GROUP_STALE' then raise; end if; end;
 raise notice 'PASS: versão antiga impede etapa seguinte';
 begin update public.whatsapp_care_operations set lease_until=now()-interval '1 second' where state='running';
 perform public.authorize_care_group_step((select (job->>'id')::uuid from care_job107),(select (job->>'token')::uuid from care_job107),'create');
 raise exception 'FAIL: posse vencida permitiu chamada'; exception when raise_exception then if sqlerrm<>'GROUP_STALE' then raise; end if; end;
 raise notice 'PASS: posse vencida impede etapa seguinte';
end $$;
select public.finish_care_group_creation((job->>'id')::uuid,(job->>'token')::uuid,'12345-67890@g.us') from care_job107;
select public.complete_care_group_operation((job->>'id')::uuid,(job->>'token')::uuid,
 '{"id":"12345-67890@g.us","locked":true,"adminsAddOnly":true,"approvalRequired":true,"participants":[{"jid":"5511888888888@s.whatsapp.net","admin":true}]}',
 'https://chat.whatsapp.com/FICTICIO123456789') from care_job107;
select pg_temp.check_wa120((select state='waiting_customer' and controls_verified and not use_group from public.whatsapp_care_groups),'Grupo configurado aguarda Cliente sem fingir entrada');
select set_config('request.jwt.claim.sub',customer::text,true) from wa120;
select pg_temp.check_wa120(public.care_group_invite(id)='https://chat.whatsapp.com/FICTICIO123456789','Cliente correto obtém convite verificado') from public.whatsapp_care_groups;
select set_config('request.jwt.claim.sub',owner::text,true) from wa120;
do $$ begin
 begin perform public.care_group_invite((select id from public.whatsapp_care_groups)); raise exception 'FAIL: equipe obteve convite';
 exception when raise_exception then if sqlerrm<>'GROUP_INVITE_UNAVAILABLE' then raise; end if; end;
 raise notice 'PASS: equipe aprovada não recebe convite administrativo';
end $$;
select set_config('request.jwt.claim.sub',customer::text,true) from wa120;
select public.care_group_customer_update(id,version,'close') is not null from public.whatsapp_care_groups;
select pg_temp.check_wa120((select count(*)=0 from public.whatsapp_care_invites),'Encerramento elimina convite disponível no sistema');
select set_config('request.jwt.claim.sub','',true);
truncate care_job107;
insert into care_job107 select public.claim_care_group_operation(o.id,true) from public.whatsapp_care_operations o join public.whatsapp_care_groups g on g.id=o.group_id and g.version=o.version;
select pg_temp.check_wa120((select job->>'kind'='close' from care_job107),'Encerramento recebe operação de limpeza sem reativar consentimento');
select public.complete_care_group_operation((job->>'id')::uuid,(job->>'token')::uuid,
 '{"id":"12345-67890@g.us","participants":[{"jid":"5511888888888@s.whatsapp.net","admin":true}]}') from care_job107;
select pg_temp.check_wa120((select state='closed' and reason='closed_confirmed' and not controls_verified from public.whatsapp_care_groups),'Limpeza confirma encerramento sem ativar grupo');
-- Mudança de identidade conserva telefone antigo para remoção e invalida nova inclusão.
select set_config('request.jwt.claim.role','service_role',true);
select public.apply_verified_whatsapp(owner,'+5511666666666',true) is not null from wa120;
select pg_temp.check_wa120((select approved_phone='+5511777777777' and approved_at is null from public.whatsapp_care_participants),'Telefone novo não substitui identidade aprovada antiga');
-- Recuperar exige operação anterior iniciada/incerta e nunca ativa o grupo encerrado.
update public.whatsapp_care_groups set group_jid=null;
truncate care_job107;
insert into care_job107 select jsonb_build_object('id',id) from public.whatsapp_care_operations where provider_creation_started;
update public.whatsapp_care_operations set state='unknown' where provider_creation_started;
select pg_temp.check_wa120(public.care_group_recovery_context((job->>'id')::uuid) is not null,'Diário incerto fornece somente identidade exata da tentativa') from care_job107;
select public.recover_care_group_creation((job->>'id')::uuid,'98765@g.us') from care_job107;
select pg_temp.check_wa120((select group_jid='98765@g.us' and state='closed' and not controls_verified from public.whatsapp_care_groups),'ID recuperado não restaura autorização retirada');
select pg_temp.check_wa120(public.care_group_recovery_context((job->>'id')::uuid) is null,'Operação recuperada não pode reassociar outro grupo') from care_job107;

-- Falha atrasada do worker não desfaz a saída registrada numa versão nova.
update public.whatsapp_care_groups set state='active',use_group=true,revoked_at=null,entry_pending=false,version=version+1;
insert into public.whatsapp_care_operations(group_id,kind,version,state,lease_token,lease_until,started_at)
  select id,'reconcile',version,'running',gen_random_uuid(),now()+interval '2 minutes',now() from public.whatsapp_care_groups;
truncate care_job107;
insert into care_job107 select jsonb_build_object('id',id,'token',lease_token) from public.whatsapp_care_operations where state='running';
select public.care_group_removed_members('teste-'||shop,'98765@g.us','saida-tardia',jsonb_build_array(substring(phone from 2)||'@s.whatsapp.net')) from wa120;
select public.fail_care_group_operation((job->>'id')::uuid,(job->>'token')::uuid,'98765@g.us') from care_job107;
select pg_temp.check_wa120((select state='customer_left' and not entry_pending from public.whatsapp_care_groups),'Falha de worker antigo não apaga saída do Cliente');
select pg_temp.check_wa120((select count(*)=0 from public.whatsapp_care_invites),'Saída invalida convite ainda que webhook posterior chegue');
-- Confirmação de criação tardia conserva uma pausa administrativa de versão posterior.
update public.whatsapp_care_groups set group_jid=null,state='paused_unavailable',reason='operator_pause',version=version+1;
select public.finish_care_group_creation((job->>'id')::uuid,(job->>'token')::uuid,'98765@g.us') from care_job107;
select pg_temp.check_wa120((select group_jid='98765@g.us' and state='paused_unavailable' and reason='operator_pause' from public.whatsapp_care_groups),'ID tardio é guardado sem desfazer pausa do operador');

insert into public.whatsapp_care_operations(group_id,kind,version) select id,'reconcile',version from public.whatsapp_care_groups on conflict do nothing;
select pg_temp.check_wa120(public.claim_care_group_operation(o.id,true) is null,'Worker não toma posse de grupo pausado pelo operador')
 from public.whatsapp_care_operations o join public.whatsapp_care_groups g on g.id=o.group_id and g.version=o.version;
select pg_temp.check_wa120((select reason='operator_pause' from public.whatsapp_care_groups),'Tentativa bloqueada não apaga motivo da pausa');
update public.whatsapp_care_groups set version=version+1,reason='review_required';
insert into public.whatsapp_care_operations(group_id,kind,version) select id,'reconcile',version from public.whatsapp_care_groups;
truncate care_job107;
insert into care_job107 select public.claim_care_group_operation(o.id,true) from public.whatsapp_care_operations o
  join public.whatsapp_care_groups g on g.id=o.group_id and g.version=o.version;
select public.fail_care_group_operation((job->>'id')::uuid,(job->>'token')::uuid,'98765@g.us','participants_changed') from care_job107;
select pg_temp.check_wa120((select state='paused_divergence' and reason='participants_changed' from public.whatsapp_care_groups),'Participante divergente é distinguido de indisponibilidade técnica');
