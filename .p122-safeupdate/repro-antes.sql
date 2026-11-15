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
select pg_temp.check_d4(public.record_whatsapp_distribution_connection(id,instance_name,display_phone,routing_version,'open',display_phone),'Observação fictícia atual aceita pelo contrato original') from public.whatsapp_channels where id in(select a from d4 union all select b from d4);
select pg_temp.check_d4((select count(*)=2 from public.whatsapp_distribution_candidates()),'Dois candidatos fictícios com observação fresca');
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
update public.whatsapp_care_cycle_policy set pilot_shop_id=(select shop from d4),pilot_customer_id=(select person from d4) where singleton;
select pg_temp.check_d4(public.care_cycle_registry_ready(),'Capacidade fictícia comprovada antes da reprodução');
reset role;
load 'safeupdate';
set role postgres;
set safeupdate.enabled=1;
select pg_temp.check_d4(current_setting('safeupdate.enabled')::boolean,'safeupdate ativo com papel postgres');
select public.care_group_admin('enrollment',jsonb_build_object('enabled',true,'version',1,'confirmed',true));
rollback;
