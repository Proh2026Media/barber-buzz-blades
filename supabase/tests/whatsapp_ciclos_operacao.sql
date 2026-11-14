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
select pg_temp.check_d4((select jsonb_array_length(public.care_cycle_composition(shop))=2 from d4),'Composição da loja usa dois telefones físicos com controle confirmado');
insert into auth.users(id,email,raw_user_meta_data) select person,person||'@example.invalid','{}' from d4;
insert into public.memberships(user_id,barbershop_id,role) select person,shop,'customer' from d4;
insert into public.whatsapp_care_groups(id,barbershop_id,customer_id,customer_phone) select grp,shop,person,'+5511999999999' from d4;
insert into public.whatsapp_group_enrollments(group_id,profile_phone,profile_verified_at) select grp,null,null from d4;
insert into public.whatsapp_care_cycles(id,group_id,customer_phone,consented_numbers,creator_channel_id,creator_instance)
 select cycle,grp,'+5511999999999',public.care_cycle_composition(shop),(public.care_cycle_composition(shop)->0->>'id')::uuid,public.care_cycle_composition(shop)->0->>'instance' from d4;
update public.whatsapp_care_groups set current_cycle_id=(select cycle from d4) where id=(select grp from d4);
select pg_temp.check_d4((select not public.care_cycle_available(cycle) from d4),'Ter números e consentimento não ignora política desligada');
update public.whatsapp_care_cycle_policy set enabled=true;
select pg_temp.check_d4((select public.care_cycle_available(cycle) from d4),'Composição e adesão autenticada elegíveis para preparar, sem confirmar telefone');

-- Registro deve ser confirmado na versão atual antes da liberação administrativa.
select public.care_cycle_registry_ack(instance_name,source_version,true) from public.whatsapp_care_registry;
select pg_temp.check_d4((public.care_group_admin('read')->>'cycle_contract')='bc-groups-v3','Painel administrativo anuncia contrato protegido');
select public.care_group_admin('enrollment',jsonb_build_object('enabled',true,'version',1,'confirmed',true));
do $$begin begin perform public.care_group_admin('enrollment','{"enabled":false,"version":1}');raise exception 'FAIL: versão antiga aceita';exception when others then if sqlerrm like 'FAIL:%' then raise;end if;raise notice 'PASS: versão antiga não altera habilitação';end;end $$;
select pg_temp.check_d4((select enabled and version=2 from public.whatsapp_care_cycle_policy),'Habilitação explícita conserva controle de versão');
select public.care_cycle_registry_ack(instance_name,source_version-1,true) from public.whatsapp_care_registry;
select pg_temp.check_d4(not exists(select 1 from public.whatsapp_care_registry where enabled and acknowledged_version is distinct from source_version),'Ack atrasado não regride registro');

update public.whatsapp_care_cycle_policy set pilot_shop_id=(select shop from d4),pilot_customer_id=(select person from d4);
select pg_temp.check_d4((select public.care_cycle_policy_allows(shop,person) and not public.care_cycle_policy_allows(shop,gen_random_uuid()) from d4),'Piloto restringe criação e envio ao cliente e loja escolhidos');
update public.whatsapp_care_cycle_policy set pilot_shop_id=null,pilot_customer_id=null;

-- Reserva 2 manual é um emissor legítimo; não existe alternância automática.
select public.platform_set_whatsapp_route(shop,null,(select version from public.whatsapp_number_links where barbershop_id=d4.shop and staff_id is null),a,b,null,'backup',false,false,true) from d4;
select pg_temp.check_d4((select public.care_cycle_sender_instance(shop)='bc-'||b from d4),'Emissor segue reserva escolhida manualmente');
select public.platform_set_whatsapp_route(shop,null,(select version from public.whatsapp_number_links where barbershop_id=d4.shop and staff_id is null),a,null,b,'backup2',false,false,true) from d4;
select pg_temp.check_d4((select public.care_cycle_sender_instance(shop)='bc-'||b from d4),'Segunda reserva também pode ser escolhida manualmente');
select public.platform_set_whatsapp_route(shop,null,(select version from public.whatsapp_number_links where barbershop_id=d4.shop and staff_id is null),a,b,null,'primary',false,false,false) from d4;

-- Rotas específicas nunca autorizam usuários da equipe a entrar nas conversas.
alter table d4 add column professional uuid default gen_random_uuid();alter table d4 add column extra uuid default gen_random_uuid();
insert into public.staff(id,barbershop_id,display_name) select professional,shop,'Profissional de teste' from d4;
select public.platform_create_whatsapp_channel(extra,'Ciclo C') from d4;
update public.whatsapp_channels set display_phone='+5511800000333',status='open' where id=(select extra from d4);
select public.platform_confirm_whatsapp_control(id,routing_version,display_phone,instance_name,true) from public.whatsapp_channels where id=(select extra from d4);
select public.platform_set_whatsapp_route(shop,professional,0,extra,b,null,'primary',false,false,false) from d4;
select pg_temp.check_d4((select jsonb_array_length(public.care_cycle_composition(shop,cycle))=3 and not public.care_cycle_available(cycle) from d4),'Número de profissional entra na proposta e exige novo consentimento');
select pg_temp.check_d4((select reason='numbers_changed' from public.whatsapp_care_groups,d4 where id=grp),'Mudança específica não passa despercebida ao cliente');
update public.whatsapp_care_cycles set consented_numbers=public.care_cycle_composition((select shop from d4),id) where id=(select cycle from d4);
select pg_temp.check_d4((select public.care_cycle_available(cycle) from d4),'Composição consentida pode conter rotas compartilhadas e profissionais');

-- Webhook é só pista: sem conteúdo nem preferências por texto e sem quebrar a posse.
insert into public.whatsapp_customer_contact_preferences(customer_id,monthly_marketing,proactive_paused) select person,1,false from d4 on conflict(customer_id) do update set monthly_marketing=1,proactive_paused=false;
update d4 set job=public.claim_care_cycle(cycle);
update public.whatsapp_care_cycles set group_jid='99887766-5555@g.us',state='active' where id=(select cycle from d4);
select public.care_group_event('bc-'||a,'99887766-5555@g.us','texto-ficticio','messages.upsert','5511999999999@s.whatsapp.net','stop',false) from d4;
select pg_temp.check_d4((select monthly_marketing=1 and not proactive_paused from public.whatsapp_customer_contact_preferences,d4 where customer_id=person),'Texto stop não muda preferências do aplicativo');
select public.care_group_event('bc-'||b,'99887766-5555@g.us','estrutura-ficticia','groups.update',null,null,true) from d4;
select pg_temp.check_d4((select c.revision=(d4.job->>'revision')::bigint and c.lease_token=(d4.job->>'token')::uuid and c.observed_at is null from public.whatsapp_care_cycles c,d4 where c.id=d4.cycle),'Evento estrutural invalida prova sem trocar a revisão/posse');
select public.care_group_removed_members('bc-'||b,'99887766-5555@g.us','saida-ficticia','["5511999999999@s.whatsapp.net"]') from d4;
select pg_temp.check_d4((select state='customer_left' and not entry_pending from public.whatsapp_care_groups,d4 where id=grp),'Saída vista pela reserva encerra a intenção de entrada');
select public.care_group_admin('pause',jsonb_build_object('group_id',grp,'version',(select version from public.whatsapp_care_groups where id=grp))) from d4;
select set_config('request.jwt.claim.sub',(select person::text from d4),true);
do $$begin begin perform public.care_group_customer_update(grp,(select version from public.whatsapp_care_groups where id=grp),'rejoin',jsonb_build_object('accept',true,'accounts','[]'::jsonb)) from d4;raise exception 'FAIL: pausa ignorada';exception when others then if sqlerrm like 'FAIL:%' then raise;end if;raise notice 'PASS: cliente não contorna pausa do operador';end;end $$;
select pg_temp.check_d4(public.care_group_admin('read')->>'denied'='true','Cliente não enumera grupos administrativos');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);

-- Exclusão não pode impedir apagar a conta/loja; conserva encerramento e revogação.
delete from public.whatsapp_number_links where barbershop_id=(select shop from d4);
delete from public.whatsapp_group_accounts where channel_id=(select extra from d4);
delete from public.whatsapp_channels where id=(select extra from d4);
select pg_temp.check_d4((select state='closing' and reason='number_removed' from public.whatsapp_care_cycles,d4 where id=cycle),'Excluir número conserva tarefa de fechamento do grupo');
select pg_temp.check_d4(exists(select 1 from public.whatsapp_care_registry,d4 where instance_name='bc-'||extra and not enabled),'Exclusão conserva revogação versionada para reentregas');
update public.whatsapp_care_cycles set state='closed',cleanup_pending=false,closed_at=now()-interval '91 days' where id=(select cycle from d4);
select public.purge_care_group_audit();
select pg_temp.check_d4((select customer_phone is null and consented_numbers='[]'::jsonb and group_jid='99887766-5555@g.us' from public.whatsapp_care_cycles,d4 where id=cycle),'Retenção apaga cópias pessoais e preserva lápide do JID');
update public.whatsapp_care_cycle_policy set enabled=true,pilot_shop_id=(select shop from d4),pilot_customer_id=(select person from d4);
delete from auth.users where id=(select person from d4);
select pg_temp.check_d4((select not enabled and pilot_shop_id is null and pilot_customer_id is null from public.whatsapp_care_cycle_policy),'Excluir cliente do piloto desliga a política e não libera todos os demais');
select pg_temp.check_d4(not has_function_privilege('authenticated','public.purge_care_group_audit()','execute'),'Cliente não executa expurgo');
rollback;
