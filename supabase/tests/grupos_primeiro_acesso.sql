-- Banco descartável, executor envolve em BEGIN/ROLLBACK. Sem provedor real.
create temporary table bootstrap_fixture as select gen_random_uuid() shop,gen_random_uuid() person,gen_random_uuid() other;
create function pg_temp.check_bootstrap(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
insert into auth.users(id,email,raw_user_meta_data) select id,id||'@example.invalid','{}'::jsonb from bootstrap_fixture cross join lateral unnest(array[person,other]) id;
insert into barbershops(id,name,slug) select shop,'Fictícia','bootstrap-'||shop from bootstrap_fixture;
insert into memberships(user_id,barbershop_id,role) select person,shop,'customer' from bootstrap_fixture;
insert into whatsapp_channels(barbershop_id,instance_name,status,display_phone) select shop,'bootstrap-'||shop,'open','+5511888888888' from bootstrap_fixture;
insert into whatsapp_group_accounts(barbershop_id,channel_id) select shop,n.id from bootstrap_fixture f join whatsapp_channels n on n.barbershop_id=f.shop;
update whatsapp_group_settings set enrollment_enabled=true,login_enabled=true;
update whatsapp_send_controls set paused=false;
select set_config('request.jwt.claim.sub',person::text,true) from bootstrap_fixture;
select save_my_whatsapp('+5511999999999',true) is not null;
select care_group_begin(shop,true,array(select id from whatsapp_group_accounts),'+5511999999999') is not null from bootstrap_fixture;
select pg_temp.check_bootstrap((select whatsapp_verified_at is null from profiles where id=(select person from bootstrap_fixture)),'Adesão não confirma telefone');
select pg_temp.check_bootstrap(care_group_phone_eligible(id),'Adesão autenticada permite criar grupo provisório') from whatsapp_care_groups;
select care_group_begin(shop,true,array(select id from whatsapp_group_accounts),'+5511999999999') is not null from bootstrap_fixture;
select pg_temp.check_bootstrap((select count(*)=1 from whatsapp_care_operations),'Retomar não duplica criação');
select pg_temp.check_bootstrap(not has_table_privilege('authenticated','whatsapp_group_enrollments','select'),'Telefone provisório privado');
select pg_temp.check_bootstrap(not has_function_privilege('authenticated','request_whatsapp_group_phone(uuid,text,text,uuid)','execute'),'Navegador não emite desafio de outro titular');
do $$ begin
 begin update whatsapp_group_enrollments set expires_at=now()-interval '1 second';perform pg_temp.check_bootstrap(not (select care_group_phone_eligible(id) from whatsapp_care_groups),'Adesão vencida bloqueia');raise exception 'reverter';exception when raise_exception then if sqlerrm<>'reverter' then raise;end if;end;
 begin update profiles set whatsapp_e164='+5511777777777' where id=(select person from bootstrap_fixture);perform pg_temp.check_bootstrap(not (select care_group_phone_eligible(id) from whatsapp_care_groups),'Alterar perfil invalida adesão anterior');raise exception 'reverter';exception when raise_exception then if sqlerrm<>'reverter' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',other::text,true) from bootstrap_fixture;
do $$ begin
 begin perform care_group_begin(shop,true,array(select id from whatsapp_group_accounts),'+5511666666666') from bootstrap_fixture;raise exception 'FAIL: sem vínculo criou';exception when insufficient_privilege then raise notice 'PASS: sem vínculo não cria grupo';end;
end $$;
select set_config('request.jwt.claim.sub','',true);
set local request.jwt.claim.role='service_role';
update whatsapp_care_groups set account_id=(select id from whatsapp_group_accounts limit 1),group_jid='77777@g.us',state='active',entry_pending=false,use_group=true,controls_verified=true;
create temporary table bootstrap_challenge as select request_whatsapp_group_phone(person,'+5511999999999',repeat('a',64),gen_random_uuid()) result from bootstrap_fixture;
select pg_temp.check_bootstrap(whatsapp_group_login_context((result->>'challenge_id')::uuid,repeat('a',64))->>'purpose'='verify_phone','Provisório só recebe finalidade de confirmação') from bootstrap_challenge;
select pg_temp.check_bootstrap(check_whatsapp_group_phone(other,'+5511999999999',repeat('a',64)) is null,'Outra conta não consome confirmação') from bootstrap_fixture;
select authorize_whatsapp_group_login((result->>'challenge_id')::uuid,repeat('a',64),whatsapp_group_login_context((result->>'challenge_id')::uuid,repeat('a',64))) is not null from bootstrap_challenge;
select pg_temp.check_bootstrap(check_whatsapp_group_phone(person,'+5511999999999',repeat('a',64))->>'whatsapp_verified_at' is not null,'Código autoriza confirmação atômica do titular') from bootstrap_fixture;
select pg_temp.check_bootstrap(check_whatsapp_group_phone(person,'+5511999999999',repeat('a',64)) is null,'Confirmação não se repete') from bootstrap_fixture;
select pg_temp.check_bootstrap((select whatsapp_opt_in_at is not null from profiles where id=(select person from bootstrap_fixture)),'Confirmação conserva consentimento que o titular já escolheu');
select pg_temp.check_bootstrap((select count(*)=0 from whatsapp_group_enrollments),'Prova encerra adesão provisória');

-- Uma pessoa, um telefone, dois vínculos: nunca exigir outro número por loja.
create temporary table second_shop as select gen_random_uuid() id;
insert into barbershops(id,name,slug) select id,'Segunda fictícia','segunda-'||id from second_shop;
insert into whatsapp_channels(barbershop_id,instance_name,status,display_phone) select id,'segunda-'||id,'open','+5511666666666' from second_shop;
insert into whatsapp_group_accounts(barbershop_id,channel_id) select s.id,n.id from second_shop s join whatsapp_channels n on n.barbershop_id=s.id;
insert into loyalty_accounts(user_id,barbershop_id,points) select person,shop,75 from bootstrap_fixture on conflict(user_id,barbershop_id) do update set points=75;
select set_config('request.jwt.claim.sub',person::text,true) from bootstrap_fixture;
select join_shop_as_customer(id::text) from second_shop;
select join_shop_as_customer(id::text) from second_shop;
select pg_temp.check_bootstrap((select count(*)=2 from memberships where user_id=(select person from bootstrap_fixture) and role='customer'),'Mesma conta participa de duas lojas sem duplicar vínculo');
select pg_temp.check_bootstrap((select whatsapp_e164='+5511999999999' and whatsapp_verified_at is not null from profiles where id=(select person from bootstrap_fixture)),'Outra loja conserva telefone e confirmação');
select pg_temp.check_bootstrap((select points=75 from loyalty_accounts where barbershop_id=(select shop from bootstrap_fixture)) and (select points=0 from loyalty_accounts where barbershop_id=(select id from second_shop)),'Pontos independentes por loja');
select care_group_begin(id,true,array(select a.id from whatsapp_group_accounts a where a.barbershop_id=second_shop.id),'+5511999999999') from second_shop;
select pg_temp.check_bootstrap((select count(*)=2 from whatsapp_care_groups where customer_id=(select person from bootstrap_fixture) and customer_phone='+5511999999999'),'Mesmo telefone tem grupo independente em outra loja');
select pg_temp.check_bootstrap((select count(*)=0 from shop_members where user_id=(select person from bootstrap_fixture)),'Vínculo de cliente não cria privilégio profissional');
