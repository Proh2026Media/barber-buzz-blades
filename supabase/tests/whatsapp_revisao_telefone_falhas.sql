-- Bancada descartável. Nenhuma mensagem, nenhuma chamada de rede; rollback integral.
begin;
create temporary table d4 as select gen_random_uuid() shop,gen_random_uuid() person,gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() plan,gen_random_uuid() grp,gen_random_uuid() cycle,null::jsonb job,null::jsonb body,null::jsonb step;
create function pg_temp.check_d4(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.check_d4((select not enabled from public.whatsapp_care_cycle_policy),'Contrato novo não herda liberação do piloto anterior');
update public.whatsapp_send_controls set paused=false where scope='global';
update d4 set shop=(public.register_my_barbershop(gen_random_uuid(),'Ciclo Fictício','America/Sao_Paulo','single',true,'teste','teste','teste')->>'shop_id')::uuid;
select public.platform_create_whatsapp_channel(a,'Ciclo A') from d4;
select public.platform_create_whatsapp_channel(b,'Ciclo B') from d4;
update public.whatsapp_channels set display_phone=case id when (select a from d4) then '+5511800000111' else '+5511800000222' end,status='open' where id in(select a from d4 union all select b from d4);
select public.platform_confirm_whatsapp_control(id,routing_version,display_phone,instance_name,true) from public.whatsapp_channels where id in(select a from d4 union all select b from d4);
select public.platform_plan_whatsapp_distribution(plan,array[shop],false) from d4;
select public.platform_apply_whatsapp_distribution(plan) from d4;
-- Rota explícita da fixture: outros ensaios podem conservar números com a mesma identidade.
select public.platform_set_whatsapp_route(d.shop,null,(select version from public.whatsapp_number_links where barbershop_id=d.shop and staff_id is null and removed_at is null),d.a,d.b,null,'primary',false,false,false) from d4 d;
select pg_temp.check_d4((select jsonb_array_length(public.care_cycle_composition(shop))=2 from d4),'Composição da loja usa dois telefones físicos com controle confirmado');
insert into auth.users(id,email,raw_user_meta_data) select person,person||'@example.invalid','{}' from d4;
insert into public.memberships(user_id,barbershop_id,role) select person,shop,'customer' from d4;
insert into public.whatsapp_care_groups(id,barbershop_id,customer_id,customer_phone) select grp,shop,person,'+5511998888666' from d4;
insert into public.whatsapp_group_enrollments(group_id,profile_phone,profile_verified_at) select grp,null,null from d4;
insert into public.whatsapp_care_cycles(id,group_id,customer_phone,consented_numbers,creator_channel_id,creator_instance)
 select cycle,grp,'+5511998888666',public.care_cycle_composition(shop),(public.care_cycle_composition(shop)->0->>'id')::uuid,public.care_cycle_composition(shop)->0->>'instance' from d4;
update public.whatsapp_care_groups set current_cycle_id=(select cycle from d4) where id=(select grp from d4);
select pg_temp.check_d4((select not public.care_cycle_available(cycle) from d4),'Ter números e consentimento não ignora política desligada');
update public.whatsapp_care_cycle_policy set enabled=true;
select pg_temp.check_d4((select public.care_cycle_available(cycle) from d4),'Composição e adesão autenticada elegíveis para preparar, sem confirmar telefone');

create function pg_temp.denied(query text,expected text,label text) returns void language plpgsql as $$begin
 begin execute query;raise exception 'FAIL: %',label;exception when others then
 if sqlerrm like 'FAIL:%' or sqlerrm<>expected then raise;end if;raise notice 'PASS: %',label;end;
end $$;
create temporary table revision_test(id uuid,job jsonb,proof jsonb,ack jsonb);
insert into revision_test default values;
update public.whatsapp_care_cycle_policy set assisted_access_enabled=true where singleton;
update public.whatsapp_care_cycles set created_at=date_trunc('second',clock_timestamp())-interval '5 minutes',expires_at=(date_trunc('second',clock_timestamp())-interval '5 minutes') at time zone 'UTC'+interval '1 year',group_jid='98765-43210@g.us' where id=(select cycle from d4);
update public.whatsapp_care_groups set group_jid='98765-43210@g.us',state='waiting_customer',reason='customer_absent' where id=(select grp from d4);
select set_config('request.jwt.claim.sub',(select person::text from d4),true);
update revision_test set id=(select public.care_phone_revision_start(d.shop,d.grp,g.version,'+5511998888777',array[d.a,d.b],true) from d4 d join public.whatsapp_care_groups g on g.id=d.grp);
select pg_temp.check_d4((select count(*)=1 from public.whatsapp_phone_revisions where customer_id=(select person from d4)),'Uma intenção delimitada para o titular');
select pg_temp.check_d4((select customer_phone='+5511998888666' from public.whatsapp_care_groups where id=(select grp from d4)),'Pedido não troca telefone do grupo antes da prova');
select pg_temp.check_d4((select whatsapp_e164 is null and whatsapp_verified_at is null from public.profiles where id=(select person from d4)),'Pedido não troca nem verifica o perfil');
select pg_temp.check_d4((select not public.care_cycle_available(cycle) from d4),'Motor normal congela durante a revisão');
select pg_temp.check_d4((select public.care_verified_physical(person,'+5511998888777')='+5511998888777' from d4),'Sem prova não adiciona/remove nono dígito');

update public.whatsapp_send_controls set paused=true where scope='global';
select pg_temp.check_d4((select public.claim_care_phone_revision(person,shop)->>'blocked'='true' from d4),'Pausa bloqueia revisão antes de consultar WhatsApp');
update public.whatsapp_send_controls set paused=false where scope='global';
delete from public.memberships where user_id=(select person from d4) and barbershop_id=(select shop from d4);
select pg_temp.check_d4((select public.claim_care_phone_revision(person,shop)->>'blocked'='true' from d4),'Perda do vínculo da loja invalida revisão');
insert into public.memberships(user_id,barbershop_id,role) select person,shop,'customer' from d4;
update public.profiles set whatsapp_e164='+5511995555444' where id=(select person from d4);
select pg_temp.check_d4((select public.claim_care_phone_revision(person,shop)->>'blocked'='true' from d4),'Troca externa do perfil não é incorporada silenciosamente');
update public.profiles set whatsapp_e164=null where id=(select person from d4);
update public.whatsapp_care_groups set reason='customer_absent' where id=(select grp from d4);
insert into auth.users(id,email,raw_user_meta_data) values('99999999-1234-4234-8234-999999999999','outro-ficticio@example.invalid','{}');
select set_config('request.jwt.claim.role','service_role',true);
update public.profiles set whatsapp_e164='+5511998888777',whatsapp_verified_at=now() where id='99999999-1234-4234-8234-999999999999';
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.check_d4((select public.claim_care_phone_revision(person,shop)->>'blocked'='true' from d4),'Telefone verificado de outra conta não é tomado pela revisão');
delete from auth.users where id='99999999-1234-4234-8234-999999999999';
update public.whatsapp_phone_revisions set deadline=clock_timestamp()-interval '1 second' where id=(select id from revision_test);
select pg_temp.check_d4((select public.claim_care_phone_revision(person,shop)->>'blocked'='true' from d4),'Prazo expirado não permite iniciar bind');
select public.care_phone_revision_abort(d.shop,t.id) from d4 d,revision_test t;
update revision_test set job=(select public.claim_care_phone_revision(person,shop) from d4);
select pg_temp.check_d4((select job->>'token' is not null from revision_test),'Cancelar permite apenas conciliar o pedido expirado');
update revision_test t set proof=(select ((t.job->'payload')-'action'-'revisionId')||jsonb_build_object('id',t.id,'groupJid',c.group_jid,'phase','aborted','unprepared',true,'resolvedJid',null,'lookupAt',null,'createdAt',c.created_at,'expiresAt',c.expires_at,'requestHash',repeat('b',64)) from public.whatsapp_care_cycles c,d4 where c.id=d4.cycle);
select public.record_care_phone_revision(t.id,d.person,(t.job->>'token')::uuid,t.proof) from revision_test t,d4 d;
select pg_temp.check_d4((select phase='aborted' and resolved_phone is null from public.whatsapp_phone_revisions where id=(select id from revision_test)),'Cancelamento sem preparo não inventa identidade física');
select pg_temp.check_d4((select customer_phone='+5511998888666' from public.whatsapp_care_groups where id=(select grp from d4)),'Cancelar não altera destinatário ou cria outro grupo');
select pg_temp.check_d4((select count(*)=0 from public.whatsapp_phone_aliases where customer_id=(select person from d4)),'Ausência de prova não cria alias');
select pg_temp.check_d4((select public.care_cycle_available(cycle) from d4),'Abort comprovado libera somente o motor original');
rollback;
