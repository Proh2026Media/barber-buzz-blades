-- Apenas PostgreSQL descartável; transação própria, nenhuma rede ou conta real.
begin;
create temporary table d1 as select gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() c,
 gen_random_uuid() x,gen_random_uuid() y,gen_random_uuid() z,gen_random_uuid() alias,
 gen_random_uuid() personal,gen_random_uuid() person,gen_random_uuid() staff;
create function pg_temp.d1_check(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
update d1 set a=(public.register_my_barbershop(gen_random_uuid(),'D1 Alfa','America/Sao_Paulo','single',true,'teste-d1','teste-d1','teste-d1')->>'shop_id')::uuid,
 b=(public.register_my_barbershop(gen_random_uuid(),'D1 Beta','America/Sao_Paulo','single',true,'teste-d1','teste-d1','teste-d1')->>'shop_id')::uuid;
update d1 set staff=(select m.staff_id from public.shop_members m where m.barbershop_id=d1.a and m.user_id='11111111-1111-4111-8111-111111111111');
insert into public.barbershops(id,name,slug) select c,'D1 incompleta','incompleta-'||c from d1;
select public.platform_create_whatsapp_channel(x,'D1 Principal') from d1;
select public.platform_create_whatsapp_channel(y,'D1 Reserva 1') from d1;
select public.platform_create_whatsapp_channel(z,'D1 Reserva 2') from d1;
select public.platform_create_whatsapp_channel(alias,'D1 Alias') from d1;
select public.platform_create_whatsapp_channel(personal,'D1 Pessoal') from d1;
update public.whatsapp_channels set status='open',display_phone=case id
 when (select x from d1) then '+5511900000111' when (select y from d1) then '+5511900000222'
 when (select z from d1) then '+5511900000333' when (select alias from d1) then '+5511900000111'
 else '+5511900000444' end where id in(select x from d1 union all select y from d1 union all select z from d1 union all select alias from d1 union all select personal from d1);
insert into auth.users(id,email,raw_user_meta_data) select person,person||'@example.invalid','{}' from d1;
update public.profiles set whatsapp_e164='+5511900000444' where id=(select person from d1);
select public.snapshot_whatsapp_activity_history(personal) from d1;
select public.platform_mark_whatsapp_personal(personal,person,0) from d1;
-- A classificação administrativa permanece válida mesmo sem telefone no perfil atual.
update public.profiles set whatsapp_e164=null where id=(select person from d1);
update public.whatsapp_send_controls set paused=false where scope='global';
select public.platform_set_whatsapp_route(a,null,0,x,y,z,'primary',true,false,false) from d1;
select public.platform_set_whatsapp_route(b,null,0,z,x,y,'primary',true,false,false) from d1;
select pg_temp.d1_check((select backup2_channel_id=z and version=1 from public.whatsapp_number_links,d1 where barbershop_id=a and staff_id is null),'Reserva 2 persiste no vínculo');
select pg_temp.d1_check((select count(*)=2 from public.whatsapp_number_links,d1 where barbershop_id in(a,b) and removed_at is null),'Mesmas contas compartilhadas em três papéis independentes');
select pg_temp.d1_check((public.platform_whatsapp_directory()->>'second_reserve')::boolean,'Diretório anuncia contrato de segunda reserva');
select pg_temp.d1_check((select public.whatsapp_route_link(a,jsonb_build_object('staff_id',staff))=(select id from public.whatsapp_number_links where barbershop_id=a and staff_id is null and removed_at is null) from d1),'Profissional sem vínculo próprio herda o geral de três posições');
select public.platform_set_whatsapp_route(a,staff,0,y,z,x,'paused',false,false,false) from d1;
select pg_temp.d1_check((select public.whatsapp_route_link(a,jsonb_build_object('staff_id',staff))=(select id from public.whatsapp_number_links where barbershop_id=a and staff_id=d1.staff and removed_at is null) from d1),'Vínculo próprio pausado prevalece sem fallback silencioso ao geral');

select pg_temp.d1_check((select exists(select 1 from jsonb_array_elements(public.platform_whatsapp_directory()->'links') r where (r->>'barbershop_id')::uuid=a and (r->>'backup2_channel_id')::uuid=z) from d1),'Releitura administrativa conserva a terceira posição');
select pg_temp.d1_check((select not exists(select 1 from jsonb_array_elements(public.platform_whatsapp_directory()->'channels') n where (n->>'id')::uuid=personal) from d1),'Número pessoal continua fora do catálogo');
select pg_temp.d1_check((select public.whatsapp_sending_paused('bc-'||personal,false) from d1),'Número pessoal continua bloqueado para envio');
select pg_temp.d1_check((select not exists(select 1 from jsonb_array_elements(public.platform_whatsapp_directory()->'shops') s where (s->>'id')::uuid=c) from d1),'Loja incompleta continua fora do diretório');
do $$declare f record;begin select * into f from d1;
 begin perform public.platform_set_whatsapp_route(f.a,null,1,f.x,f.y,'primary',true,false,false);raise exception 'FAIL: leitor antigo apagou reserva 2';exception when invalid_parameter_value then raise notice 'PASS: formulário antigo não descarta reserva 2';end;
 begin perform public.platform_set_whatsapp_route(f.a,null,1,f.x,f.y,f.alias,'primary',true,false,false);raise exception 'FAIL: telefone duplicado';exception when invalid_parameter_value then raise notice 'PASS: dois IDs do mesmo telefone não contam como números distintos';end;
 begin perform public.platform_set_whatsapp_route(f.a,null,1,f.x,f.y,f.personal,'primary',true,false,false);raise exception 'FAIL: reserva pessoal';exception when invalid_parameter_value then raise notice 'PASS: classificação pessoal protege também reserva 2';end;
 begin insert into public.whatsapp_group_accounts(barbershop_id,channel_id,authorized_by) values(f.a,f.personal,'11111111-1111-4111-8111-111111111111');raise exception 'FAIL: pessoal em grupo';exception when check_violation then raise notice 'PASS: número pessoal não vira conta autorizada de grupo';end;
 begin perform public.platform_set_whatsapp_route(f.c,null,0,f.x,f.y,f.z,'primary',false,false,false);raise exception 'FAIL: loja incompleta';exception when invalid_parameter_value then raise notice 'PASS: loja incompleta não ganha rota';end;
 begin perform public.platform_set_whatsapp_route(f.a,null,1,f.x,f.y,f.z,'backup2',true,false,false);raise exception 'FAIL: sem confirmação';exception when invalid_parameter_value then raise notice 'PASS: reserva 2 exige confirmação técnica';end;
 begin perform public.platform_set_whatsapp_route(f.a,null,0,f.x,f.y,f.z,'primary',true,false,false);raise exception 'FAIL: versão antiga';exception when serialization_failure then raise notice 'PASS: versão antiga recusada sem sobrescrever';end;
end $$;
insert into public.whatsapp_send_controls(scope,paused,reason) select x::text,true,'restriction' from d1;
select pg_temp.d1_check((select public.whatsapp_sending_paused('bc-'||alias,false) from d1),'Restrição do telefone também bloqueia outra instância do mesmo número');
do $$declare f record;begin select * into f from d1;
 begin perform public.platform_set_whatsapp_route(f.a,null,1,f.alias,f.y,f.z,'primary',true,false,false);raise exception 'FAIL: alias contornou restrição';exception when object_not_in_prerequisite_state then raise notice 'PASS: troca de ID não ativa telefone com restrição';end;
end $$;
delete from public.whatsapp_send_controls where scope=(select x::text from d1);
select public.platform_set_whatsapp_route(a,null,1,x,y,z,'backup2',true,false,true) from d1;
select pg_temp.d1_check((select delivery_mode='backup' and backup_instance_name='bc-'||z from public.whatsapp_delivery_channels,d1 where barbershop_id=a and staff_id is null),'Leitores antigos resolvem a reserva 2 efetiva sem enviar pelo principal');
select pg_temp.d1_check((select version=1 and channel_id=y and backup2_channel_id=x from public.whatsapp_number_links,d1 where barbershop_id=a and staff_id=d1.staff and removed_at is null),'Alterar geral conserva números e versão do profissional personalizado');
select pg_temp.d1_check((select delivery_mode='primary' and version=1 from public.whatsapp_number_links,d1 where barbershop_id=b),'Usar reserva 2 em Alfa não altera Beta');
select public.enqueue_whatsapp_message(a,'+5511999999999','customer.notice','Fixture offline sem envio','d1-offline') from d1;
update public.whatsapp_outbox set status='sending',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes' where dedupe_key='d1-offline';
update public.whatsapp_channels set status='disconnected' where id=(select z from d1);
select pg_temp.d1_check((select public.whatsapp_send_candidate(o.id,o.lease_token) is null from public.whatsapp_outbox o where dedupe_key='d1-offline'),'Reserva 2 desconectada não é candidata a transmissão');
select pg_temp.d1_check((select public.authorize_whatsapp_send('bc-'||z,o.id,o.lease_token)->>'reason'='unavailable' from public.whatsapp_outbox o,d1 where dedupe_key='d1-offline'),'Autorização bloqueia reserva conhecida como desconectada');
select pg_temp.d1_check((select not exists(select 1 from public.whatsapp_send_attempts where outbox_id=o.id) from public.whatsapp_outbox o where dedupe_key='d1-offline'),'Bloqueio offline não consome uma tentativa de transmissão');
update public.whatsapp_channels set status='open' where id=(select z from d1);
update public.whatsapp_outbox set status='failed' where dedupe_key='d1-offline';
select public.enqueue_whatsapp_message(a,'+5511999999999','customer.notice','Fixture legada sem envio','d1-legacy') from d1;
update public.whatsapp_outbox set number_route_identity=null,status='sending',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes' where dedupe_key='d1-legacy';
select pg_temp.d1_check((select public.whatsapp_send_candidate(o.id,o.lease_token) is null from public.whatsapp_outbox o where dedupe_key='d1-legacy'),'Fila antiga sem prova de identidade não recebe autorização retrospectiva');
update public.whatsapp_outbox set status='failed' where dedupe_key='d1-legacy';
select public.enqueue_whatsapp_message(a,'+5511999999999','customer.notice','Fixture sem envio','d1-message') from d1;
update public.whatsapp_outbox set status='sending',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes' where dedupe_key='d1-message';
select pg_temp.d1_check((select public.whatsapp_send_candidate(o.id,o.lease_token)->>'instance_name'='bc-'||z from public.whatsapp_outbox o,d1 where dedupe_key='d1-message'),'Trabalhador seleciona a reserva 2 configurada');
select pg_temp.d1_check((select public.prepare_whatsapp_delivery(o.id)->>'instance_name'='bc-'||z from public.whatsapp_outbox o,d1 where dedupe_key='d1-message'),'Autorização final conserva reserva 2');
-- A nova identidade observada não herda a autorização de uma rota antiga.
update public.whatsapp_channels set display_phone='+5511900000555' where id=(select z from d1);
select pg_temp.d1_check((select public.whatsapp_send_candidate(o.id,o.lease_token) is null from public.whatsapp_outbox o where dedupe_key='d1-message'),'Troca do telefone pareado invalida a fila anterior');
select pg_temp.d1_check((select public.prepare_whatsapp_delivery(o.id) is null from public.whatsapp_outbox o where dedupe_key='d1-message'),'Preparação recusa identidade não confirmada');
select pg_temp.d1_check((select exists(select 1 from public.whatsapp_number_link_history h where (h.after_config->>'backup2_channel_id')::uuid=z) from d1),'Histórico inclui reserva 2');
select pg_temp.d1_check(not has_function_privilege('anon','public.platform_set_whatsapp_route(uuid,uuid,bigint,uuid,uuid,uuid,text,boolean,boolean,boolean)','execute'),'Anônimo sem RPC de três posições');
select set_config('request.jwt.claim.sub',person::text,true) from d1;
do $$declare f record;begin select * into f from d1;
 begin perform public.platform_set_whatsapp_route(f.a,null,2,f.x,f.y,f.z,'primary',false,false,false);raise exception 'FAIL: cliente distribuiu';exception when insufficient_privilege then raise notice 'PASS: somente admin da plataforma altera distribuição';end;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.platform_set_whatsapp_route(a,staff,1,null,null,null,'paused',false,false,false) from d1;
select pg_temp.d1_check((select public.whatsapp_route_link(a,jsonb_build_object('staff_id',staff))=(select id from public.whatsapp_number_links where barbershop_id=a and staff_id is null and removed_at is null) from d1),'Remover personalização restaura a herança sem alterar o geral');
delete from public.whatsapp_channels where id=(select personal from d1);
select pg_temp.d1_check((select not exists(select 1 from jsonb_array_elements(public.platform_whatsapp_number_history()) h where h->>'display_phone'='5511900000444')),'Número pessoal não reaparece pelo histórico após exclusão técnica');
update public.whatsapp_channels set display_phone='+5511900000444' where id=(select alias from d1);
select pg_temp.d1_check((select not public.whatsapp_operational_number(alias) from d1),'Classificação pessoal permanece para o telefone físico em outra conexão');
select pg_temp.d1_check((select not exists(select 1 from jsonb_array_elements(public.platform_whatsapp_directory()->'channels') n where (n->>'id')::uuid=alias) from d1),'Outra conexão do telefone pessoal não reaparece no catálogo operacional');

rollback;
