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



-- Aceitação de grupos: somente fixtures, transação externa com rollback.
select pg_temp.check_wa120(not (select enrollment_enabled from public.whatsapp_group_settings),'Grupos nascem desativados');
select set_config('request.jwt.claim.sub',customer::text,true) from wa120;
do $$ begin
  begin perform public.care_group_request((select shop from wa120),true,'{}'); raise exception 'FAIL: adesão com flag desligada';
  exception when raise_exception then if sqlerrm<>'GROUP_UNAVAILABLE' then raise; end if; end;
  raise notice 'PASS: flag desligada bloqueia adesão no servidor';
end $$;
select pg_temp.check_wa120((public.care_group_admin('enrollment','{"enabled":true}') ->>'denied')::boolean,'Cliente não administra');
select pg_temp.check_wa120((select count(*)=1 from public.whatsapp_care_audit where action='denied_admin'),'Tentativa administrativa negada fica auditada');
select set_config('request.jwt.claim.sub',owner::text,true) from wa120;
select pg_temp.check_wa120((public.care_group_admin('promote','{}')->>'denied')::boolean,'Dono não promove participantes');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.care_group_admin('enrollment','{"enabled":true}') is not null;
update public.whatsapp_channels set display_phone='+5511888888888' where barbershop_id=(select shop from wa120);
select public.care_group_admin('authorize_account',jsonb_build_object('shop_id',c.shop,'channel_id',n.id,'platform_owned',true)) is not null
  from wa120 c join public.whatsapp_channels n on n.barbershop_id=c.shop;
select set_config('request.jwt.claim.role','service_role',true);
select public.apply_verified_whatsapp(owner,'+5511777777777',true) is not null from wa120;
select set_config('request.jwt.claim.role','',true);
select set_config('request.jwt.claim.sub',customer::text,true) from wa120;
select public.care_group_request(shop,true,array(select id from public.whatsapp_group_accounts)) is not null from wa120;
select public.care_group_request(shop,true,array(select id from public.whatsapp_group_accounts)) is not null from wa120;
select pg_temp.check_wa120((select count(*)=1 from public.whatsapp_care_groups),'Dois cliques mantêm um vínculo');
select pg_temp.check_wa120((select count(*)=1 from public.whatsapp_care_operations),'Dois cliques mantêm uma operação');
select pg_temp.check_wa120((select monthly_marketing=0 from public.whatsapp_customer_contact_preferences),'Adesão não ativa marketing');
select pg_temp.check_wa120(not has_table_privilege('authenticated','public.whatsapp_care_invites','select'),'Convite não é tabela pública');
select pg_temp.check_wa120(not has_function_privilege('authenticated','public.claim_care_group_operation(uuid,boolean)','execute'),'Cliente não chama worker nem escolhe capacidade');
select pg_temp.check_wa120(not has_table_privilege('service_role','public.whatsapp_delivery_channels','insert'),'View compartilhada sem escrita preventiva');
select set_config('request.jwt.claim.sub',other_customer::text,true) from wa120;
do $$ begin
  begin perform public.care_group_read((select shop from wa120),(select customer from wa120)); raise exception 'FAIL: outro cliente leu grupo';
  exception when insufficient_privilege then raise notice 'PASS: outro cliente não lê grupo'; end;
end $$;
select set_config('request.jwt.claim.sub',owner::text,true) from wa120;
do $$ begin
  begin perform public.care_group_read((select shop from wa120),(select customer from wa120)); raise exception 'FAIL: dono não atribuído leu grupo';
  exception when insufficient_privilege then raise notice 'PASS: Dono sem atribuição não vê conversa'; end;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.care_group_admin('propose_participant',jsonb_build_object('group_id',g.id,'version',g.version,'user_id',c.owner)) is not null
  from public.whatsapp_care_groups g cross join wa120 c;
select set_config('request.jwt.claim.sub',owner::text,true) from wa120;
do $$ begin
  begin perform public.care_group_read((select shop from wa120),(select customer from wa120)); raise exception 'FAIL: proposta equivaleu a aprovação';
  exception when insufficient_privilege then raise notice 'PASS: proposta não concede acesso antes da aprovação'; end;
end $$;
select set_config('request.jwt.claim.sub',customer::text,true) from wa120;
select public.care_group_customer_update(g.id,g.version,'approve_participant',jsonb_build_object('user_id',c.owner)) is not null from public.whatsapp_care_groups g cross join wa120 c;
select set_config('request.jwt.claim.sub',owner::text,true) from wa120;
select pg_temp.check_wa120(public.care_group_read(shop,customer)->'group' is not null,'Participante aprovado e vinculado acessa apenas a ficha permitida') from wa120;
select set_config('request.jwt.claim.sub',customer::text,true) from wa120;
do $$ begin
  begin perform public.care_group_customer_update((select id from public.whatsapp_care_groups),null,'close'); raise exception 'FAIL: versão nula aceita';
  exception when raise_exception then if sqlerrm<>'GROUP_STALE' then raise; end if; end;
  raise notice 'PASS: versão ausente não ignora concorrência';
end $$;
select public.care_group_customer_update(id,version,'preferences','{"notifications":true,"review_invites":true,"monthly_marketing":1}') is not null from public.whatsapp_care_groups;
select pg_temp.check_wa120((select monthly_marketing=1 from public.whatsapp_customer_contact_preferences),'Preferência explícita registra teto mensal');
select set_config('request.jwt.claim.sub','',true);
-- Operação criada para o estado atual; integração atual informa capacidade ausente.
select pg_temp.check_wa120(exists(select 1 from public.whatsapp_care_operations o join public.whatsapp_care_groups g on g.id=o.group_id and g.version=o.version),'Salvar preferência mantém operação da versão atual');
select pg_temp.check_wa120(public.claim_care_group_operation(id,false) is null,'Capacidade ausente não autoriza criação') from public.whatsapp_care_operations where version=(select version from public.whatsapp_care_groups);
select pg_temp.check_wa120((select count(*)=0 from public.whatsapp_care_operations where started_at is not null),'Bloqueio não finge transmissão');
update public.whatsapp_send_controls set paused=false;
create temporary table care_test_job as select public.claim_care_group_operation(id,true) job from public.whatsapp_care_operations where version=(select version from public.whatsapp_care_groups);
select pg_temp.check_wa120((select job->>'token' is not null from care_test_job),'Bancada com capacidade fictícia obtém posse única');
select pg_temp.check_wa120(public.claim_care_group_operation((select (job->>'id')::uuid from care_test_job),true) is null,'Mesma operação não recebe segunda licença');
select public.finish_care_group_creation((job->>'id')::uuid,(job->>'token')::uuid,'12345-67890@g.us') from care_test_job;
create temporary table care_snapshot as select jsonb_build_object('id','12345-67890@g.us','locked',true,'adminsAddOnly',true,'approvalRequired',true,
  'participants',jsonb_build_array(jsonb_build_object('jid','5511888888888@s.whatsapp.net','admin',true),jsonb_build_object('jid',substring(phone from 2)||'@s.whatsapp.net','admin',false),jsonb_build_object('jid','5511777777777@s.whatsapp.net','admin',false))) value from wa120;
select public.observe_care_group((job->>'id')::uuid,(job->>'token')::uuid,(select value from care_snapshot)) from care_test_job;
select pg_temp.check_wa120((select state='active' and use_group from public.whatsapp_care_groups),'Snapshot completo ativa apenas grupo correto na bancada');
-- Texto de profissional jamais modifica preferências do Cliente.
select public.care_group_event('teste-'||shop,'12345-67890@g.us','evento-equipe','messages.upsert','+5511777777777','marketing',false) from wa120;
select pg_temp.check_wa120((select monthly_marketing=1 from public.whatsapp_customer_contact_preferences),'Equipe não altera consentimento do cliente pelo texto');
select public.care_group_event('teste-'||shop,'12345-67890@g.us','evento-cliente','messages.upsert',phone,'marketing',false) from wa120;
select pg_temp.check_wa120((select monthly_marketing=0 from public.whatsapp_customer_contact_preferences),'Descadastro confirmado alcança todas as rotas');
select pg_temp.check_wa120(not public.care_group_event('teste-'||shop,'12345-67890@g.us','evento-cliente','messages.upsert',phone,'marketing',false),'Webhook repetido é ignorado') from wa120;
select public.care_group_event('teste-'||shop,'12345-67890@g.us','evento-atrasado','group-participants.update',null,null,false) from wa120;
select pg_temp.check_wa120((select state='paused_divergence' and not controls_verified from public.whatsapp_care_groups),'Evento fora de ordem pausa, nunca reativa');
select set_config('request.jwt.claim.sub',customer::text,true) from wa120;
select public.care_group_customer_update(g.id,g.version,'remove_participant',jsonb_build_object('user_id',c.owner)) is not null from public.whatsapp_care_groups g cross join wa120 c;
select set_config('request.jwt.claim.sub',owner::text,true) from wa120;
do $$ begin
  begin perform public.care_group_read((select shop from wa120),(select customer from wa120)); raise exception 'FAIL: removido ainda lê';
  exception when insufficient_privilege then raise notice 'PASS: remoção revoga acesso interno imediatamente'; end;
end $$;
select set_config('request.jwt.claim.sub',customer::text,true) from wa120;
select public.care_group_customer_update(id,version,'close') is not null from public.whatsapp_care_groups;
select pg_temp.check_wa120((select state='closed' and use_group and not notifications from public.whatsapp_care_groups),'Encerramento não redireciona automaticamente para conversa individual');
do $$ begin
  begin perform public.care_group_invite((select id from public.whatsapp_care_groups)); raise exception 'FAIL: grupo encerrado entrega convite';
  exception when raise_exception then if sqlerrm<>'GROUP_INVITE_UNAVAILABLE' then raise; end if; end;
  raise notice 'PASS: convite indisponível após encerramento';
end $$;
update public.whatsapp_customer_contact_preferences set monthly_marketing=3;
update public.customer_privacy set marketing=true where user_id=(select customer from wa120);
select public.care_group_customer_update(id,version,'rejoin',jsonb_build_object('accept',true,'accounts',to_jsonb(approved_accounts))) is not null from public.whatsapp_care_groups;
select pg_temp.check_wa120((select state='waiting_customer' and not notifications from public.whatsapp_care_groups),'Retorno exige nova conferência sem reativar avisos');
select pg_temp.check_wa120((select monthly_marketing=0 from public.whatsapp_customer_contact_preferences),'Retorno não restaura marketing');
select pg_temp.check_wa120((select not marketing from public.customer_privacy where user_id=(select customer from wa120)),'Retorno não mantém consentimento legado de ofertas');
select pg_temp.check_wa120((select count(*)=1 from public.whatsapp_care_groups),'Retorno preserva o vínculo permanente');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.check_wa120((select not (public.care_group_admin('read')->>'capabilities_ready')::boolean),'A interface nunca anuncia controles inexistentes');

-- Cada variação abaixo usa apenas a fixture desta transação.
update public.whatsapp_care_groups set state='active',revoked_at=null;
update public.whatsapp_care_participants set approved_at=now(),revoked_at=null;
update public.shop_members set active=false where user_id=(select owner from wa120);
select pg_temp.check_wa120((select approved_at is null and revoked_at is not null from public.whatsapp_care_participants),'Saída da equipe revoga aprovação antiga');
select pg_temp.check_wa120((select not controls_verified and state='paused_divergence' from public.whatsapp_care_groups),'Mudança de equipe pausa até conferir remoção');
update public.shop_members set active=true where user_id=(select owner from wa120);
select pg_temp.check_wa120((select approved_at is null from public.whatsapp_care_participants),'Recontratar não recupera ciência antiga');
update public.whatsapp_care_participants set approved_at=now(),revoked_at=null;
select set_config('request.jwt.claim.role','service_role',true);
update public.profiles set whatsapp_verified_at=null where id=(select owner from wa120);
select pg_temp.check_wa120((select approved_at is null and revoked_at is not null from public.whatsapp_care_participants),'Perder telefone confirmado revoga identidade comercial');
update public.whatsapp_channels set display_phone='+5511666666666' where barbershop_id=(select shop from wa120);
select pg_temp.check_wa120((select not enabled from public.whatsapp_group_accounts),'Número alterado não herda autorização da Plataforma');
-- Expiração não abre licença para criar em outra versão, mesmo antes da limpeza.
update public.whatsapp_care_groups set group_jid=null,state='requested',version=version+1;
update public.whatsapp_care_operations set state='running',lease_until=now()-interval '1 minute' where started_at is not null;
insert into public.whatsapp_care_operations(group_id,kind,version) select id,'reconcile',version from public.whatsapp_care_groups;
select pg_temp.check_wa120(public.claim_care_group_operation(o.id,true) is null,'Nova versão não cria outro grupo após tentativa expirada')
from public.whatsapp_care_operations o join public.whatsapp_care_groups g on g.id=o.group_id and g.version=o.version;
select pg_temp.check_wa120((select state='creation_unknown' from public.whatsapp_care_groups),'Tentativa anterior sem ID exige revisão operacional');
-- Teto global não muda com estabelecimento/remetente; resultado incerto continua consumido.
update public.whatsapp_customer_contact_preferences set monthly_marketing=3,proactive_paused=false;
update public.customer_privacy set marketing=true where user_id=(select customer from wa120);
insert into public.client_communication_budget(event_key,customer_id,barbershop_id,kind,attempted_at)
select 'historico-'||i,customer,shop,'marketing',date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
from wa120 cross join generate_series(1,3) i;
select pg_temp.check_wa120(not public.reserve_client_communication(other_shop,customer,'marketing','outra-loja'),'Três tentativas no mês bloqueiam oferta em outra loja') from wa120;
select pg_temp.check_wa120(public.care_marketing_allowed(customer,'historico-3'),'Conferência da própria tentativa não soma uma quarta cota') from wa120;
select pg_temp.check_wa120(not has_function_privilege('service_role','public.reserve_client_communication_before_groups(uuid,uuid,text,text)','execute'),'Serviço não contorna teto chamando a função antiga');
