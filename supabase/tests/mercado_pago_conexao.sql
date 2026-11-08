-- P-49: conexão Mercado Pago. Executar só em BEGIN … ROLLBACK após migration 100.
-- Cifras abaixo são envelopes SINTÉTICOS válidos estruturalmente, sem token ou conta real.
create temporary table mp_ctx as select gen_random_uuid() shop_a,gen_random_uuid() shop_b,gen_random_uuid() shop_c,
 gen_random_uuid() owner_a,gen_random_uuid() owner_b,gen_random_uuid() admin_id,
 gen_random_uuid() employee_id,gen_random_uuid() customer_id,
 gen_random_uuid() staff_a,gen_random_uuid() staff_b,gen_random_uuid() staff_ca,gen_random_uuid() staff_cb,
 gen_random_uuid() staff_employee;
grant select on mp_ctx to authenticated,service_role;
create temporary table mp_results(label text primary key,result jsonb);
grant all on mp_results to authenticated,service_role;
create function pg_temp.mp_check(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.mp_error(statement text,expected text,label text) returns void language plpgsql as $$
declare actual text;
begin
 begin execute statement; exception when others then get stacked diagnostics actual=message_text; end;
 perform pg_temp.mp_check(actual=expected,label);
end $$;
create function pg_temp.mp_denied(statement text,label text) returns void language plpgsql as $$
declare actual text;
begin
 begin execute statement; exception when others then get stacked diagnostics actual=returned_sqlstate; end;
 perform pg_temp.mp_check(actual='42501',label);
end $$;
create function pg_temp.mp_cipher() returns text language sql as $$ select 'mp1.'||repeat('A',16)||'.'||repeat('B',43) $$;
create function pg_temp.mp_start(p_shop uuid,p_actor uuid,p_hash text,p_scope text default 'shop',p_staff uuid default null) returns jsonb language sql as $$
 select public.begin_mercado_pago_connection(p_shop,p_actor,p_hash,pg_temp.mp_cipher(),
  coalesce((select connection_revision from public.mercado_pago_connections where barbershop_id=p_shop and receiver_scope=p_scope
   and (p_scope='shop' or professional_user_id=p_actor)),0),'test',p_scope,p_staff,
  coalesce((select id from public.mercado_pago_connections where barbershop_id=p_shop and receiver_scope=p_scope
   and (p_scope='shop' or professional_user_id=p_actor)),gen_random_uuid()))
$$;
create function pg_temp.mp_finish(p_attempt uuid,p_actor uuid,p_collector text default '123456') returns jsonb language sql as $$
 select public.finish_mercado_pago_connection(p_attempt,p_actor,p_collector,pg_temp.mp_cipher(),pg_temp.mp_cipher(),clock_timestamp()+interval '1 hour',false)
$$;
insert into public.barbershops(id,name,slug)
select shop_a,'MP teste A','mp-a-'||shop_a from mp_ctx union all
select shop_b,'MP teste B','mp-b-'||shop_b from mp_ctx union all
select shop_c,'MP teste compartilhado','mp-c-'||shop_c from mp_ctx;
insert into auth.users(id,email,raw_user_meta_data)
select u.id,u.id||'@example.invalid','{}'::jsonb from mp_ctx c
cross join lateral unnest(array[c.owner_a,c.owner_b,c.admin_id,c.employee_id,c.customer_id]) u(id);
insert into public.staff(id,barbershop_id,user_id,display_name)
select staff_a,shop_a,owner_a,'Dono A' from mp_ctx union all
select staff_b,shop_b,owner_b,'Dono B' from mp_ctx union all
select staff_ca,shop_c,owner_a,'Dono C' from mp_ctx union all
select staff_cb,shop_c,owner_b,'Sócio C' from mp_ctx union all
select staff_employee,shop_a,employee_id,'Equipe A' from mp_ctx;
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select shop_a,owner_a,staff_a,'owner'::public.shop_member_role,100 from mp_ctx union all
select shop_b,owner_b,staff_b,'owner'::public.shop_member_role,100 from mp_ctx union all
select shop_c,owner_a,staff_ca,'owner'::public.shop_member_role,50 from mp_ctx union all
select shop_c,owner_b,staff_cb,'partner'::public.shop_member_role,50 from mp_ctx union all
select shop_a,employee_id,staff_employee,'employee'::public.shop_member_role,null from mp_ctx;
insert into public.memberships(user_id,barbershop_id,role)
select admin_id,null,'platform_admin'::public.app_role from mp_ctx union all
select customer_id,shop_a,'customer'::public.app_role from mp_ctx;
select * from mp_ctx \gset

select pg_temp.mp_check(not has_table_privilege('anon','public.mercado_pago_connections','select')
 and not has_table_privilege('authenticated','public.mercado_pago_connections','select')
 and not has_table_privilege('authenticated','public.mercado_pago_oauth_requests','select')
 and (select relrowsecurity from pg_class where oid='public.mercado_pago_connections'::regclass)
 and (select relrowsecurity from pg_class where oid='public.mercado_pago_oauth_requests'::regclass),
 'MP: tabelas privadas sem leitura pública e com RLS');
select pg_temp.mp_check(not has_function_privilege('anon','public.get_mercado_pago_connection(uuid,text,uuid)','execute')
 and not has_function_privilege('authenticated','public.begin_mercado_pago_connection(uuid,uuid,text,text,bigint,text,text,uuid,uuid)','execute')
 and not has_function_privilege('authenticated','public.consume_mercado_pago_connection(text,uuid)','execute')
 and not has_function_privilege('authenticated','public.finish_mercado_pago_connection(uuid,uuid,text,text,text,timestamptz,boolean)','execute')
 and not has_function_privilege('authenticated','public.disconnect_mercado_pago_connection(uuid,uuid,bigint,text,uuid)','execute')
 and has_function_privilege('service_role','public.begin_mercado_pago_connection(uuid,uuid,text,text,bigint,text,text,uuid,uuid)','execute'),
 'MP: somente servidor inicia consome conclui ou desliga');
select set_config('request.jwt.claim.sub',:'owner_a',true); set local role authenticated;
insert into mp_results values('status-inicial',public.get_mercado_pago_connection(:'shop_a'));
select pg_temp.mp_check((select (result->>'can_manage')::boolean and result->>'status'='disconnected'
 and result->>'connection_revision'='0' and not (result->>'financial_enabled')::boolean
 and result->>'shop_name'='MP teste A' and result->>'actor_id' is not null
 from mp_results where label='status-inicial'),'MP: dono consulta preparação sem ativação financeira');
select pg_temp.mp_check((public.get_mercado_pago_connection(:'shop_c')->>'management_blocked_reason')='shared_governance',
 'MP: sociedade 50/50 não conecta por atalho');
select pg_temp.mp_denied(format('select public.get_mercado_pago_connection(%L)',:'shop_b'),
 'MP: dono de outra loja não lê conexão');
select set_config('request.jwt.claim.sub',:'employee_id',true);
select pg_temp.mp_denied(format('select public.get_mercado_pago_connection(%L)',:'shop_a'),
 'MP: funcionário não consulta conexão financeira');
select set_config('request.jwt.claim.sub',:'customer_id',true);
select pg_temp.mp_denied(format('select public.get_mercado_pago_connection(%L)',:'shop_a'),
 'MP: cliente não consulta conexão da loja');
select set_config('request.jwt.claim.sub',:'admin_id',true);
select pg_temp.mp_check(not (public.get_mercado_pago_connection(:'shop_a')->>'can_manage')::boolean
 and public.get_mercado_pago_connection(:'shop_a')->>'actor_id' is null,
 'MP: plataforma vê preparação sem ganhar poder nem vínculo de dono');
reset role; select set_config('request.jwt.claim.sub','',true); set local role service_role;
select pg_temp.mp_error(format('select pg_temp.mp_start(%L,%L,repeat(''a'',64))',:'shop_a',:'admin_id'),
 'mp_connection_not_allowed','MP: servidor também recusa admin sem sociedade');
select pg_temp.mp_error(format('select pg_temp.mp_start(%L,%L,repeat(''a'',64))',:'shop_c',:'owner_a'),
 'mp_connection_not_allowed','MP: servidor também recusa 50/50');
select pg_temp.mp_error(format($q$select public.begin_mercado_pago_connection(%L,%L,repeat('a',64),'TOKEN_CRU_FICTICIO',0,'test','shop',null,gen_random_uuid())$q$,:'shop_a',:'owner_a'),
 'mp_connection_invalid','MP: token cru não entra como verifier cifrado');
insert into mp_results values('a1',pg_temp.mp_start(:'shop_a',:'owner_a',repeat('a',64)));
select pg_temp.mp_check((select result->>'connection_revision'='1' from mp_results where label='a1')
 and (select expires_at-created_at=interval '10 minutes' from public.mercado_pago_oauth_requests where state_hash=repeat('a',64)),
 'MP: tentativa tem revisão e dez minutos exatos');
select pg_temp.mp_error(format('select public.consume_mercado_pago_connection(repeat(''a'',64),%L)',:'owner_b'),
 'mp_connection_state_invalid','MP: outro usuário não consome nonce alheio');
select pg_temp.mp_check((select consumed_at is null and verifier_ciphertext is not null
 from public.mercado_pago_oauth_requests where state_hash=repeat('a',64)),'MP: tentativa de outro ator não inutiliza nonce');
select pg_temp.mp_error(format($q$select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='a1'),%L)$q$,:'owner_a'),
 'mp_connection_state_invalid','MP: conclusão antes do consumo é recusada');
insert into mp_results values('consume-a1',public.consume_mercado_pago_connection(repeat('a',64),:'owner_a'));
select pg_temp.mp_check((select result->>'verifier_ciphertext'=pg_temp.mp_cipher() and result->>'environment'='test'
 from mp_results where label='consume-a1') and (select verifier_ciphertext is null and consumed_at is not null
 from public.mercado_pago_oauth_requests where state_hash=repeat('a',64)), 'MP: consumo entrega cifra uma vez e remove da tentativa');
select pg_temp.mp_error(format('select public.consume_mercado_pago_connection(repeat(''a'',64),%L)',:'owner_a'),
 'mp_connection_state_invalid','MP: replay de nonce é recusado');
select pg_temp.mp_error(format($q$select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='a1'),%L)$q$,:'owner_b'),
 'mp_connection_state_invalid','MP: conclusão exige o mesmo ator');
select pg_temp.mp_error(format($q$select public.finish_mercado_pago_connection((select (result->>'attempt_id')::uuid from mp_results where label='a1'),%L,'123456',pg_temp.mp_cipher(),pg_temp.mp_cipher(),clock_timestamp()+interval '1 hour',true)$q$,:'owner_a'),
 'mp_connection_environment_mismatch','MP: ambiente do token precisa corresponder ao OAuth');
select pg_temp.mp_error(format($q$select public.finish_mercado_pago_connection((select (result->>'attempt_id')::uuid from mp_results where label='a1'),%L,'123456','TOKEN_CRU_FICTICIO',pg_temp.mp_cipher(),clock_timestamp()+interval '1 hour',false)$q$,:'owner_a'),
 'mp_connection_invalid','MP: token cru não entra na conexão');
insert into mp_results values('finish-a1',pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='a1'),:'owner_a'));
select pg_temp.mp_check((select result->>'status'='connected' and result->>'connection_revision'='2'
 and not (result->>'financial_enabled')::boolean from mp_results where label='finish-a1')
 and (select access_token_ciphertext=pg_temp.mp_cipher() and refresh_token_ciphertext=pg_temp.mp_cipher()
 from public.mercado_pago_connections where barbershop_id=:'shop_a'), 'MP: conclusão atômica conserva somente envelopes cifrados');
select pg_temp.mp_error(format($q$select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='a1'),%L)$q$,:'owner_a'),
 'mp_connection_state_invalid','MP: conclusão não é aplicada duas vezes');
select pg_temp.mp_error(format('select pg_temp.mp_start(%L,%L,repeat(''b'',64))',:'shop_a',:'owner_a'),
 'mp_connection_already_connected','MP: conexão existente não é substituída por novo início');
select pg_temp.mp_check((select connection_revision=2 and collector_id='123456' and access_token_ciphertext=pg_temp.mp_cipher()
 from public.mercado_pago_connections where barbershop_id=:'shop_a'),'MP: falha de reconexão preserva conta e credenciais');
reset role; select set_config('request.jwt.claim.sub',:'owner_a',true); set local role authenticated;
insert into mp_results values('status-conectado',public.get_mercado_pago_connection(:'shop_a'));
select pg_temp.mp_check((select result->>'status'='connected' and result->>'connection_revision'='2'
 and not result ?| array['collector_id','access_token_ciphertext','refresh_token_ciphertext','verifier_ciphertext','state_hash']
 and not (result->>'financial_enabled')::boolean from mp_results where label='status-conectado'),
 'MP: status autenticado não expõe conta tokens ou nonce nem ativa financeiro');
select pg_temp.mp_denied('select * from public.mercado_pago_connections','MP: SELECT direto recusa leitura até do dono');
reset role; select set_config('request.jwt.claim.sub','',true); set local role service_role;
select pg_temp.mp_error(format('select public.disconnect_mercado_pago_connection(%L,%L,1)',:'shop_a',:'owner_a'),
 'mp_connection_conflict','MP: desligamento antigo não altera conexão nova');
select pg_temp.mp_error(format('select public.disconnect_mercado_pago_connection(%L,%L,2)',:'shop_a',:'owner_b'),
 'mp_connection_not_allowed','MP: dono de outra loja não desliga conexão');
select public.disconnect_mercado_pago_connection(:'shop_a',:'owner_a',2);
select pg_temp.mp_check((select status='disconnected' and access_token_ciphertext is null and refresh_token_ciphertext is null
 and connection_revision=3 from public.mercado_pago_connections where barbershop_id=:'shop_a'),
 'MP: desligamento limpa segredos e incrementa revisão');
insert into mp_results values('a2',pg_temp.mp_start(:'shop_a',:'owner_a',repeat('b',64)));
select public.consume_mercado_pago_connection(repeat('b',64),:'owner_a');
select public.disconnect_mercado_pago_connection(:'shop_a',:'owner_a',4);
select pg_temp.mp_error(format($q$select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='a2'),%L)$q$,:'owner_a'),
 'mp_connection_state_invalid','MP: desligamento invalida tentativa já consumida');
insert into mp_results values('a3',pg_temp.mp_start(:'shop_a',:'owner_a',repeat('c',64)));
insert into mp_results values('a4',pg_temp.mp_start(:'shop_a',:'owner_a',repeat('d',64)));
select pg_temp.mp_error(format('select public.consume_mercado_pago_connection(repeat(''c'',64),%L)',:'owner_a'),
 'mp_connection_state_invalid','MP: início mais novo invalida nonce anterior');
select pg_temp.mp_error(format($q$select public.begin_mercado_pago_connection(%L,%L,repeat('e',64),pg_temp.mp_cipher(),0,'test','shop',null,gen_random_uuid())$q$,:'shop_a',:'owner_a'),
 'mp_connection_conflict','MP: início com revisão antiga é recusado');
reset role;
with t as (select clock_timestamp() as instant)
update public.mercado_pago_oauth_requests set created_at=t.instant-interval '11 minutes',expires_at=t.instant-interval '1 minute'
 from t where state_hash=repeat('d',64);
set local role service_role;
select pg_temp.mp_error(format('select public.consume_mercado_pago_connection(repeat(''d'',64),%L)',:'owner_a'),
 'mp_connection_state_invalid','MP: nonce expirado é recusado');
insert into mp_results values('a5',pg_temp.mp_start(:'shop_a',:'owner_a',repeat('e',64)));
select public.consume_mercado_pago_connection(repeat('e',64),:'owner_a');
reset role;
-- Simula mudança de papel pelo servidor durante o consentimento. Nenhuma escrita real.
insert into public.memberships(user_id,barbershop_id,role) values(:'owner_a',null,'account_manager');
insert into public.account_manager_shops(user_id,barbershop_id) values(:'owner_a',:'shop_a');
set local role service_role;
select pg_temp.mp_error(format($q$select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='a5'),%L)$q$,:'owner_a'),
 'mp_connection_not_allowed','MP: dono que passou a gerente não conclui autorização antiga');
select pg_temp.mp_check((select revoked_at is not null from public.mercado_pago_oauth_requests where state_hash=repeat('e',64)),
 'MP: vínculo de gerente revoga estado já consumido');
reset role;
delete from public.account_manager_shops where user_id=:'owner_a' and barbershop_id=:'shop_a';
delete from public.memberships where user_id=:'owner_a' and role='account_manager';
set local role service_role;
select pg_temp.mp_error(format($q$select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='a5'),%L)$q$,:'owner_a'),
 'mp_connection_state_invalid','MP: restaurar papel não reativa nonce revogado');
insert into mp_results values('b1',pg_temp.mp_start(:'shop_b',:'owner_b',repeat('f',64)));
select public.consume_mercado_pago_connection(repeat('f',64),:'owner_b');
reset role;
-- Uma mudança da sociedade invalida a autorização da conta da loja.
update public.shop_members set ownership_percent=ownership_percent where barbershop_id=:'shop_b' and role='owner';
set local role service_role;
select pg_temp.mp_check((select revoked_at is not null from public.mercado_pago_oauth_requests where state_hash=repeat('f',64)),
 'MP: mudança da sociedade invalida autorização da loja');
select pg_temp.mp_error(format($q$select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='b1'),%L)$q$,:'owner_b'),
 'mp_connection_state_invalid','MP: mudança da sociedade impede conclusão antiga');
-- Conectar novamente depois de desligar aceita outro coletor de forma explícita.
insert into mp_results values('a6',pg_temp.mp_start(:'shop_a',:'owner_a',repeat('1',64)));
select public.consume_mercado_pago_connection(repeat('1',64),:'owner_a');
select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='a6'),:'owner_a','789012');
select pg_temp.mp_check((select collector_id='789012' and status='connected' from public.mercado_pago_connections where barbershop_id=:'shop_a')
 and (select status='disconnected' from public.mercado_pago_connections where barbershop_id=:'shop_b'),
 'MP: nova conta só depois de desligar e sem alterar outra loja');
reset role;

-- Parceiro independente = associate (não o sócio partner). A mesma pessoa pode atuar em lojas distintas.
create temporary table mp_prof as select gen_random_uuid() staff_a,gen_random_uuid() staff_b,
 gen_random_uuid() staff_c,gen_random_uuid() staff_other,gen_random_uuid() new_user;
grant select on mp_prof to authenticated,service_role;
insert into auth.users(id,email,raw_user_meta_data) select new_user,new_user||'@example.invalid','{}'::jsonb from mp_prof;
insert into public.staff(id,barbershop_id,user_id,display_name)
select p.staff_a,c.shop_a,c.customer_id,'Parceiro independente A' from mp_prof p cross join mp_ctx c union all
select p.staff_b,c.shop_b,c.customer_id,'Parceiro independente B' from mp_prof p cross join mp_ctx c union all
select p.staff_c,c.shop_c,c.customer_id,'Parceiro independente C' from mp_prof p cross join mp_ctx c union all
select p.staff_other,c.shop_a,c.owner_b,'Outro parceiro A' from mp_prof p cross join mp_ctx c;
insert into public.shop_members(barbershop_id,user_id,staff_id,role)
select c.shop_a,c.customer_id,p.staff_a,'associate'::public.shop_member_role from mp_ctx c cross join mp_prof p union all
select c.shop_b,c.customer_id,p.staff_b,'associate'::public.shop_member_role from mp_ctx c cross join mp_prof p union all
select c.shop_c,c.customer_id,p.staff_c,'associate'::public.shop_member_role from mp_ctx c cross join mp_prof p union all
select c.shop_a,c.owner_b,p.staff_other,'associate'::public.shop_member_role from mp_ctx c cross join mp_prof p;
select set_config('request.jwt.claim.sub',:'customer_id',true); set local role authenticated;
select pg_temp.mp_check((public.get_mercado_pago_connection(:'shop_c','professional')->>'can_manage')::boolean
 and public.get_mercado_pago_connection(:'shop_c','professional')->>'receiver_name'='Parceiro independente C'
 and public.get_mercado_pago_connection(:'shop_c','professional')->>'receiver_scope'='professional',
 'MP: parceiro independente configura conta própria mesmo em sociedade 50/50');
select pg_temp.mp_check(public.get_mercado_pago_connection(:'shop_a','professional')->>'staff_id'=(select staff_a::text from mp_prof),
 'MP: servidor deriva profissional da identidade autenticada');
select pg_temp.mp_denied(format($q$select public.get_mercado_pago_connection(%L,'professional',%L)$q$,:'shop_a',(select staff_other from mp_prof)),
 'MP: parceiro não escolhe staff de colega');
select set_config('request.jwt.claim.sub',:'owner_a',true);
select pg_temp.mp_denied(format($q$select public.get_mercado_pago_connection(%L,'professional',%L)$q$,:'shop_a',(select staff_a from mp_prof)),
 'MP: dono não conecta em nome de parceiro');
select set_config('request.jwt.claim.sub',:'employee_id',true);
select pg_temp.mp_denied(format($q$select public.get_mercado_pago_connection(%L,'professional')$q$,:'shop_a'),
 'MP: contratado não recebe conexão pessoal');
select set_config('request.jwt.claim.sub',:'owner_b',true);
select pg_temp.mp_denied(format($q$select public.get_mercado_pago_connection(%L,'professional')$q$,:'shop_c'),
 'MP: sócio partner não é confundido com Parceiro independente');
reset role; select set_config('request.jwt.claim.sub','',true); set local role service_role;
insert into mp_results values('pa',pg_temp.mp_start(:'shop_a',:'customer_id',repeat('2',64),'professional'));
insert into mp_results values('pb',pg_temp.mp_start(:'shop_b',:'customer_id',repeat('3',64),'professional'));
insert into mp_results values('other',pg_temp.mp_start(:'shop_a',:'owner_b',repeat('4',64),'professional'));
select pg_temp.mp_check((select count(*)=3 from public.mercado_pago_oauth_requests where state_hash in (repeat('2',64),repeat('3',64),repeat('4',64)) and revoked_at is null)
 and (select status='connected' and collector_id='789012' from public.mercado_pago_connections where barbershop_id=:'shop_a' and receiver_scope='shop'),
 'MP: iniciar contas pessoais não altera outro parceiro nem conta da loja');
insert into mp_results values('consume-pa',public.consume_mercado_pago_connection(repeat('2',64),:'customer_id'));
select pg_temp.mp_check((select result->>'receiver_scope'='professional'
 and result->>'staff_id'=(select staff_a::text from mp_prof)
 and result->>'connection_id'=(select result->>'connection_id' from mp_results where label='pa')
 from mp_results where label='consume-pa'),'MP: nonce mantém conexão escopo profissional e ator para AAD');
select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='pa'),:'customer_id','444444');
select public.consume_mercado_pago_connection(repeat('3',64),:'customer_id');
select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='pb'),:'customer_id','444444');
select pg_temp.mp_check((select count(*)=2 from public.mercado_pago_connections where receiver_scope='professional'
 and professional_user_id=:'customer_id' and status='connected' and collector_id='444444'),
 'MP: mesmo titular pode usar própria conta em duas lojas sem misturar conexões');
select pg_temp.mp_error(format($q$select public.disconnect_mercado_pago_connection(%L,%L,2,'professional',%L)$q$,:'shop_a',:'owner_a',(select staff_a from mp_prof)),
 'mp_connection_not_allowed','MP: dono não desliga conta pessoal alheia');
select public.disconnect_mercado_pago_connection(:'shop_a',:'customer_id',2,'professional');
select pg_temp.mp_check((select status='connected' from public.mercado_pago_connections where barbershop_id=:'shop_b' and receiver_scope='professional' and professional_user_id=:'customer_id')
 and (select status='connected' from public.mercado_pago_connections where barbershop_id=:'shop_a' and receiver_scope='shop')
 and (select revoked_at is null from public.mercado_pago_oauth_requests where state_hash=repeat('4',64)),
 'MP: desligar pessoal só afeta o próprio alvo naquela loja');
insert into mp_results values('pa2',pg_temp.mp_start(:'shop_a',:'customer_id',repeat('5',64),'professional'));
select public.consume_mercado_pago_connection(repeat('5',64),:'customer_id');
select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='pa2'),:'customer_id','444444');
reset role;
-- Reatribuir staff/vínculo a outra pessoa nunca transfere a conta MP antiga.
update public.staff set user_id=(select new_user from mp_prof) where id=(select staff_a from mp_prof);
update public.shop_members set user_id=(select new_user from mp_prof)
 where barbershop_id=:'shop_a' and user_id=:'customer_id';
select pg_temp.mp_check((select status='disconnected' and access_token_ciphertext is null and refresh_token_ciphertext is null
 and collector_id='444444' and id=(select (result->>'connection_id')::uuid from mp_results where label='pa')
 from public.mercado_pago_connections where barbershop_id=:'shop_a' and receiver_scope='professional' and professional_user_id=:'customer_id'),
 'MP: reatribuir staff limpa credenciais pessoais e preserva auditoria do antigo titular');
select set_config('request.jwt.claim.sub',(select new_user::text from mp_prof),true); set local role authenticated;
select pg_temp.mp_check(public.get_mercado_pago_connection(:'shop_a','professional')->>'connection_id' is null
 and public.get_mercado_pago_connection(:'shop_a','professional')->>'status'='disconnected',
 'MP: novo ocupante do staff não herda conexão nem coletor anterior');
reset role; select set_config('request.jwt.claim.sub','',true);
update public.staff set active=false where id=(select staff_b from mp_prof);
select pg_temp.mp_check((select status='disconnected' and access_token_ciphertext is null
 from public.mercado_pago_connections where barbershop_id=:'shop_b' and receiver_scope='professional' and professional_user_id=:'customer_id'),
 'MP: profissional inativo perde credencial local');
update public.staff set active=true where id=(select staff_b from mp_prof);
set local role service_role;
insert into mp_results values('pb2',pg_temp.mp_start(:'shop_b',:'customer_id',repeat('6',64),'professional'));
select public.consume_mercado_pago_connection(repeat('6',64),:'customer_id');
reset role;
update public.shop_members set role='employee' where barbershop_id=:'shop_b' and user_id=:'customer_id';
set local role service_role;
select pg_temp.mp_error(format($q$select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='pb2'),%L)$q$,:'customer_id'),
 'mp_connection_not_allowed','MP: parceiro que virou contratado não conclui OAuth pessoal antigo');
select pg_temp.mp_check((select revoked_at is not null from public.mercado_pago_oauth_requests where state_hash=repeat('6',64)),
 'MP: mudança do papel pessoal revoga nonce consumido');
reset role;

-- Mover um vínculo pessoal revoga OLD e NEW sem interferir no recebedor da loja.
set local role service_role;
insert into mp_results values('pc',pg_temp.mp_start(:'shop_c',:'customer_id',repeat('7',64),'professional'));
select public.consume_mercado_pago_connection(repeat('7',64),:'customer_id');
insert into mp_results select 'old-personal-revision',jsonb_build_object('revision',connection_revision)
 from public.mercado_pago_connections where barbershop_id=:'shop_a' and receiver_scope='professional' and professional_user_id=:'customer_id';
reset role;
insert into public.staff(barbershop_id,user_id,display_name) values(:'shop_a',:'customer_id','Parceiro transferido');
update public.shop_members set barbershop_id=:'shop_a',staff_id=(select id from public.staff where barbershop_id=:'shop_a' and user_id=:'customer_id')
 where barbershop_id=:'shop_c' and user_id=:'customer_id';
select pg_temp.mp_check((select revoked_at is not null from public.mercado_pago_oauth_requests where state_hash=repeat('7',64))
 and (select connection_revision>(select (result->>'revision')::bigint from mp_results where label='old-personal-revision')
 from public.mercado_pago_connections where barbershop_id=:'shop_a' and receiver_scope='professional' and professional_user_id=:'customer_id'),
 'MP: mover vínculo pessoal invalida loja de origem e destino');
set local role service_role;
select pg_temp.mp_error(format($q$select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='pc'),%L)$q$,:'customer_id'),
 'mp_connection_not_allowed','MP: OAuth da loja anterior não conclui após transferência');
-- Desvincular staff_id impede usar a conexão anterior mesmo antes de uma nova atribuição.
select public.consume_mercado_pago_connection(repeat('4',64),:'owner_b');
select pg_temp.mp_finish((select (result->>'attempt_id')::uuid from mp_results where label='other'),:'owner_b','555555');
reset role;
insert into public.staff(barbershop_id,display_name,booking_slug) values(:'shop_a','Novo profissional sem titular','mp-sem-titular');
update public.shop_members set staff_id=(select id from public.staff where barbershop_id=:'shop_a' and booking_slug='mp-sem-titular')
 where barbershop_id=:'shop_a' and user_id=:'owner_b';
select pg_temp.mp_check((select status='disconnected' and access_token_ciphertext is null
 from public.mercado_pago_connections where barbershop_id=:'shop_a' and receiver_scope='professional' and professional_user_id=:'owner_b'),
 'MP: troca de staff no vínculo elimina credencial do vínculo anterior');
-- Corrida de criação: cifra de um target UUID nunca é associada ao UUID de outro início.
set local role service_role;
select pg_temp.mp_error(format($q$select public.begin_mercado_pago_connection(%L,%L,repeat('8',64),pg_temp.mp_cipher(),
 (select connection_revision from public.mercado_pago_connections where barbershop_id=%L and receiver_scope='shop'),'test','shop',null,gen_random_uuid())$q$,:'shop_b',:'owner_b',:'shop_b'),
 'mp_connection_conflict','MP: target UUID divergente é recusado sem transplantar cifra');
reset role;
