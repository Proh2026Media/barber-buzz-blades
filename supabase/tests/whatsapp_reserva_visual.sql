-- P-118: somente bancada fictícia, sempre em BEGIN/ROLLBACK.
create temporary table wa118 as select gen_random_uuid() shop,gen_random_uuid() other_shop,
 gen_random_uuid() owner,gen_random_uuid() staff,gen_random_uuid() main,
 gen_random_uuid() other_main,gen_random_uuid() reserve,gen_random_uuid() extra_reserve;
grant select on wa118 to authenticated;
create function pg_temp.check118(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
insert into auth.users(id,email,raw_user_meta_data) select owner,owner||'@example.invalid','{}' from wa118;
insert into public.barbershops(id,name,slug) select shop,'Teste reserva','wa118-'||shop from wa118
 union all select other_shop,'Outra teste','wa118-'||other_shop from wa118;
insert into public.staff(id,barbershop_id,display_name,user_id,booking_slug)
 select staff,shop,'Barbeiro fictício',owner,'teste' from wa118;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.platform_create_whatsapp_channel(id,'Número fictício') from wa118,
 lateral unnest(array[main,other_main,reserve,extra_reserve]) id;
select public.platform_assign_whatsapp_channel(main,0,shop,staff,true) from wa118;
select public.platform_assign_whatsapp_channel(other_main,0,other_shop,null,true) from wa118;
select pg_temp.check118((public.platform_whatsapp_directory()->>'number_reserves')::boolean,'Central anuncia suporte instalado');
select pg_temp.check118(not has_function_privilege('anon','public.platform_configure_whatsapp_number(uuid,bigint,uuid,text,boolean,boolean,boolean)','execute'),'Anônimo sem configuração');
select pg_temp.check118(not has_function_privilege('authenticated','public.configure_whatsapp_number_internal(uuid,bigint,text,text,text,boolean)','execute'),'Helper interno fechado');
select set_config('request.jwt.claim.sub',owner::text,true) from wa118;
do $$ declare c record; begin select * into c from wa118;
 begin perform public.platform_configure_whatsapp_number(c.main,1,c.reserve,'primary',false,false); raise exception 'FAIL: usuário comum configurou';
 exception when insufficient_privilege then raise notice 'PASS: usuário comum recusado'; end;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select pg_temp.check118(public.platform_configure_whatsapp_number(main,1,reserve,'primary',false,false)->>'backup_instance_name'='bc-'||reserve,'Reserva visual do barbeiro configurada') from wa118;
reset role;
select pg_temp.check118((select delivery_mode='primary' and routing_version=2 from public.whatsapp_channels where id=main),'Vincular reserva não ativa troca') from wa118;
select pg_temp.check118((select barbershop_id is null and not enabled and routing_version=1 from public.whatsapp_channels where id=reserve),'Reserva continua livre de destino e ganha versão') from wa118;
select pg_temp.check118((select count(*)=1 from public.whatsapp_number_config_history where channel_id=main),'Configuração auditada') from wa118;
select pg_temp.check118(public.whatsapp_route_channel(shop,jsonb_build_object('staff_id',staff))=main,'Rota profissional continua no principal lógico') from wa118;
do $$ declare c record; begin select * into c from wa118;
 begin perform public.platform_configure_whatsapp_number(c.other_main,1,c.reserve,'primary',false,false); raise exception 'FAIL: reserva compartilhada';
 exception when check_violation then raise notice 'PASS: reserva exclusiva'; end;
 begin perform public.platform_configure_whatsapp_number(c.main,2,c.main,'primary',false,false); raise exception 'FAIL: auto reserva';
 exception when check_violation then raise notice 'PASS: número não é sua própria reserva'; end;
 begin perform public.platform_configure_whatsapp_number(c.main,2,c.other_main,'primary',false,false); raise exception 'FAIL: principal virou reserva';
 exception when check_violation then raise notice 'PASS: outro principal não pode ser reserva'; end;
 begin perform public.platform_configure_whatsapp_number(c.main,1,c.reserve,'primary',false,false); raise exception 'FAIL: versão antiga';
 exception when serialization_failure then raise notice 'PASS: versão antiga recusada'; end;
 begin perform public.platform_assign_whatsapp_channel(c.reserve,1,c.shop,null,true); raise exception 'FAIL: reserva distribuída';
 exception when check_violation then raise notice 'PASS: reserva não ganha loja'; end;
 begin perform public.platform_configure_whatsapp_number(c.main,2,c.reserve,'backup',false,false); raise exception 'FAIL: trocou sem confirmação';
 exception when invalid_parameter_value then raise notice 'PASS: troca exige confirmação técnica'; end;
 begin perform public.platform_configure_whatsapp_number(c.main,2,null,'backup',true,false); raise exception 'FAIL: backup sem reserva';
 exception when invalid_parameter_value then raise notice 'PASS: troca exige reserva'; end;
 begin perform public.platform_configure_whatsapp_number(c.main,2,gen_random_uuid(),'primary',false,false); raise exception 'FAIL: reserva inexistente';
 exception when invalid_parameter_value then raise notice 'PASS: reserva inexistente recusada'; end;
end $$;
select pg_temp.check118(public.platform_configure_whatsapp_number(main,2,reserve,'backup',true,false)->>'delivery_mode'='backup','Troca manual para reserva aceita') from wa118;
select pg_temp.check118((select instance_name='bc-'||main and barbershop_id=shop and staff_id=staff from public.whatsapp_channels where id=main),'Troca preserva principal e destino') from wa118;
-- Uma resposta em aberto impede nova troca, sem reenvio automático.
insert into public.whatsapp_outbox(barbershop_id,channel_id,to_e164,body,template_key,status,dedupe_key)
select shop,main,'+5511999999999','Teste fictício','customer.notice','sending','wa118-busy' from wa118;
select pg_temp.check118((select public.prepare_whatsapp_delivery(id)->>'instance_name'='bc-'||(select reserve from wa118) from public.whatsapp_outbox where dedupe_key='wa118-busy'),'Despacho prepara número reserva cadastrado, sem enviar');
do $$ declare c record; begin select * into c from wa118;
 begin perform public.platform_configure_whatsapp_number(c.main,3,c.reserve,'primary',false,false); raise exception 'FAIL: mudou durante envio';
 exception when object_not_in_prerequisite_state then raise notice 'PASS: envio em andamento bloqueia troca'; end;
end $$;
update public.whatsapp_outbox set status='failed',delivery_started_at=now() where dedupe_key='wa118-busy';
do $$ declare c record; begin select * into c from wa118;
 begin perform public.platform_configure_whatsapp_number(c.main,3,null,'primary',false,false); raise exception 'FAIL: retirou reserva com incerteza';
 exception when object_not_in_prerequisite_state then raise notice 'PASS: resultado incerto bloqueia liberação'; end;
end $$;
update public.whatsapp_outbox set provider_message_id='ficticio-conferido' where dedupe_key='wa118-busy';
select pg_temp.check118(public.platform_configure_whatsapp_number(main,3,null,'primary',false,false)->>'backup_instance_name' is null,'Reserva pode ser retirada após conferência') from wa118;
select pg_temp.check118((select routing_version=2 from public.whatsapp_channels where id=reserve),'Liberação invalida formulário antigo da reserva') from wa118;
select pg_temp.check118(public.platform_assign_whatsapp_channel(reserve,2,shop,null,false)->>'barbershop_id'=shop::text,'Número liberado pode virar principal geral') from wa118;
-- Legado: permanece operável e não é convertido nem apagado automaticamente.
select pg_temp.check118(public.configure_shop_whatsapp_delivery(other_shop,'reserva-legada-ficticia','primary','review',false)->>'backup_instance_name'='reserva-legada-ficticia','Configuração legada preservada') from wa118;
select pg_temp.check118(public.platform_configure_whatsapp_number(other_main,2,null,'paused',false,false,true)->>'backup_instance_name'='reserva-legada-ficticia','Central mantém reserva legada ao pausar') from wa118;
select pg_temp.check118(public.platform_configure_whatsapp_number(other_main,3,extra_reserve,'primary',false,false)->>'backup_instance_name'='bc-'||extra_reserve,'Reserva legada pode ser substituída explicitamente') from wa118;
set local role authenticated;
do $$ declare c record; begin select * into c from wa118;
 begin update public.whatsapp_channels set delivery_mode='paused' where id=c.main; raise exception 'FAIL: admin direto mudou rota';
 exception when insufficient_privilege then raise notice 'PASS: configuração direta não pula versão e histórico'; end;
 begin update public.whatsapp_channels set enabled=true where id=c.extra_reserve; raise exception 'FAIL: reserva habilitada diretamente';
 exception when check_violation then raise notice 'PASS: atualização direta não habilita reserva'; end;
end $$;
reset role;
select pg_temp.check118(not has_table_privilege('anon','public.whatsapp_number_config_history','select'),'Histórico indisponível para anônimo');
select set_config('request.jwt.claim.sub',owner::text,true) from wa118;
set local role authenticated;
select pg_temp.check118((select count(*)=0 from public.whatsapp_number_config_history),'Histórico oculto de usuário comum');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.check118(jsonb_array_length(public.platform_whatsapp_directory()->'configuration_history')>0,'Central mostra histórico administrativo');
