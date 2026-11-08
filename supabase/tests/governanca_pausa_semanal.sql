-- P-70: executar após 20261107220000 em BEGIN … ROLLBACK. Só dados fictícios.
create temporary table p70_ctx as
select gen_random_uuid() shop_id,gen_random_uuid() owner_id,gen_random_uuid() partner_id,
  gen_random_uuid() associate_id,gen_random_uuid() employee_id,gen_random_uuid() customer_id,
  gen_random_uuid() owner_staff,gen_random_uuid() partner_staff,gen_random_uuid() associate_staff,
  gen_random_uuid() employee_staff,gen_random_uuid() service_id;
grant select on p70_ctx to authenticated;

create function pg_temp.p70_check(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'PASS: %',label;
end $$;
create function pg_temp.p70_error(statement text,expected text,label text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; exception when others then get stacked diagnostics actual=returned_sqlstate; end;
  perform pg_temp.p70_check(actual=expected,label);
end $$;

insert into public.barbershops(id,name,slug)
select shop_id,'Team governance test','team-'||shop_id from p70_ctx;
insert into auth.users(id,email,raw_user_meta_data)
select user_id,user_id||'@example.invalid','{}'::jsonb from p70_ctx c
cross join lateral unnest(array[c.owner_id,c.partner_id,c.associate_id,c.employee_id,c.customer_id]) u(user_id);
insert into public.staff(id,barbershop_id,display_name,user_id,booking_slug)
select owner_staff,shop_id,'Owner',owner_id,'owner' from p70_ctx union all
select partner_staff,shop_id,'Partner',partner_id,'partner' from p70_ctx union all
select associate_staff,shop_id,'Associate',associate_id,'associate' from p70_ctx union all
select employee_staff,shop_id,'Employee',employee_id,'employee' from p70_ctx;
insert into public.services(id,barbershop_id,name,duration_minutes,price_cents)
select service_id,shop_id,'Base service',30,5000 from p70_ctx;
insert into public.memberships(user_id,barbershop_id,role)
select customer_id,shop_id,'customer' from p70_ctx;
insert into public.shop_members(barbershop_id,user_id,staff_id,role,ownership_percent)
select shop_id,owner_id,owner_staff,'owner'::public.shop_member_role,50 from p70_ctx union all
select shop_id,partner_id,partner_staff,'partner'::public.shop_member_role,50 from p70_ctx union all
select shop_id,associate_id,associate_staff,'associate'::public.shop_member_role,null from p70_ctx union all
select shop_id,employee_id,employee_staff,'employee'::public.shop_member_role,null from p70_ctx;


select * from p70_ctx \gset
create function pg_temp.p70_payload(p_start text default '12:00', p_end text default '13:00')
returns jsonb language sql as $$
  select jsonb_build_object('operation_id',gen_random_uuid(),'version',public.get_weekly_break_governance(shop_id)->>'version',
    'weekdays',jsonb_build_array(1,2,3,4,5,6),'start_time',p_start,'end_time',p_end,'reason','Pausa fictícia') from p70_ctx
$$;
create temporary table p70_results(label text primary key, payload jsonb, result jsonb);
grant all on p70_results to authenticated;

select pg_temp.p70_check(
 not has_function_privilege('anon','public.request_weekly_break_change(uuid,text,jsonb)','execute')
 and not has_function_privilege('authenticated','public.apply_weekly_break_change(uuid,text,jsonb)','execute')
 and not has_function_privilege('authenticated','public.assert_weekly_break_version(uuid,jsonb)','execute')
 and not has_table_privilege('authenticated','public.shop_weekly_break_versions','update'),
 'P70: versões e aplicação ficam privadas; visitante não solicita');

-- Até com papel legado acumulado, sócio 50% não contorna a fila por RLS.
insert into public.memberships(user_id,barbershop_id,role) values(:'owner_id',:'shop_id','shop_admin');
select set_config('request.jwt.claim.sub',:'owner_id',true);
set local role authenticated;
select pg_temp.p70_check((public.get_weekly_break_governance(:'shop_id')->>'requires_approval')::boolean,
 'P70: 50% exige aprovação apesar do papel legado');
select pg_temp.p70_error(format($s$insert into public.availability_block_rules(barbershop_id,weekdays,start_time,end_time)
 values(%L,'{1}','12:00','13:00')$s$,:'shop_id'),'42501','P70: RLS bloqueia criação direta da loja');
insert into p70_results(label,payload) values('criar',pg_temp.p70_payload());
update p70_results set result=public.request_weekly_break_change(:'shop_id','create',payload) where label='criar';
select pg_temp.p70_check((select result->>'status'='pending' from p70_results where label='criar')
 and not exists(select 1 from public.availability_block_rules where barbershop_id=:'shop_id')
 and not exists(select 1 from public.availability_blocks where barbershop_id=:'shop_id'),
 'P70: pedido 50/50 não cria regra nem blocos');
select pg_temp.p70_check((select public.request_weekly_break_change(:'shop_id','create',payload)=result from p70_results where label='criar')
 and (select count(*)=1 from public.shop_change_requests where barbershop_id=:'shop_id'),
 'P70: repetir operação devolve mesmo pedido sem duplicar');
select pg_temp.p70_error(format($s$select public.request_weekly_break_change(%L,'create',
 (select payload||'{"end_time":"14:00"}'::jsonb from p70_results where label='criar'))$s$,:'shop_id'),'22023',
 'P70: mesma chave com conteúdo diferente é recusada');
select pg_temp.p70_check((public.request_shop_change(:'shop_id','weekly_break.create',pg_temp.p70_payload())->>'status')='pending'
 and (select count(*)=1 from public.shop_change_requests where barbershop_id=:'shop_id'),
 'P70: contrato genérico também valida e não duplica pedido equivalente');
select pg_temp.p70_error($s$select public.decide_shop_change((select (result->>'request_id')::uuid from p70_results where label='criar'),true)$s$,
 '42501','P70: solicitante não aprova a própria pausa');
select set_config('request.jwt.claim.sub',:'partner_id',true);
select public.decide_shop_change((select (result->>'request_id')::uuid from p70_results where label='criar'),true);
select pg_temp.p70_check((select count(*)=1 from public.availability_block_rules where barbershop_id=:'shop_id')
 and (select count(*)>90 from public.availability_blocks where barbershop_id=:'shop_id'),
 'P70: aprovação do outro dono cria uma regra e materializa futuro');
select pg_temp.p70_error($s$select public.decide_shop_change((select (result->>'request_id')::uuid from p70_results where label='criar'),true)$s$,
 'P0001','P70: decisão final não pode ser aplicada duas vezes');
select set_config('request.jwt.claim.sub',:'owner_id',true);
select pg_temp.p70_check((select public.request_weekly_break_change(:'shop_id','create',payload)->>'status'='applied'
 from p70_results where label='criar'), 'P70: repetição após aprovação recupera sucesso confirmado');
select pg_temp.p70_check(public.request_weekly_break_change(:'shop_id','create',pg_temp.p70_payload())->>'status'='unchanged',
 'P70: pausa já existente não é duplicada com nova chave');
reset role;
select public.extend_availability_block_rules();
select public.extend_availability_block_rules();
select pg_temp.p70_check(not exists(select 1 from public.availability_blocks where barbershop_id=:'shop_id'
 group by rule_id,starts_at having count(*)>1), 'P70: extensão repetida não duplica os dias');

-- Excluir só retira a pausa depois da aprovação, e recusar mantém tudo.
set local role authenticated;
insert into p70_results(label,payload) select 'remover-recusado',jsonb_build_object('operation_id',gen_random_uuid(),
 'version',public.get_weekly_break_governance(:'shop_id')->>'version','id',id)
 from public.availability_block_rules where barbershop_id=:'shop_id';
update p70_results set result=public.request_weekly_break_change(:'shop_id','delete',payload) where label='remover-recusado';
delete from public.availability_block_rules where barbershop_id=:'shop_id';
select pg_temp.p70_check((select count(*)=1 from public.availability_block_rules where barbershop_id=:'shop_id'),
 'P70: RLS não permite excluir a regra da loja antes da decisão');
select set_config('request.jwt.claim.sub',:'partner_id',true);
select public.decide_shop_change((select (result->>'request_id')::uuid from p70_results where label='remover-recusado'),false);
select pg_temp.p70_check((select count(*)=1 from public.availability_block_rules where barbershop_id=:'shop_id')
 and exists(select 1 from public.availability_blocks where barbershop_id=:'shop_id'),
 'P70: recusar exclusão conserva regra e blocos');
select set_config('request.jwt.claim.sub',:'owner_id',true);
insert into p70_results(label,payload) select 'remover',payload||jsonb_build_object('operation_id',gen_random_uuid())
 from p70_results where label='remover-recusado';
update p70_results set result=public.request_weekly_break_change(:'shop_id','delete',payload) where label='remover';
select pg_temp.p70_check((select result->>'status'='pending' from p70_results where label='remover')
 and exists(select 1 from public.availability_block_rules where barbershop_id=:'shop_id'), 'P70: remoção 50/50 fica pendente');
select set_config('request.jwt.claim.sub',:'partner_id',true);
select public.decide_shop_change((select (result->>'request_id')::uuid from p70_results where label='remover'),true);
select pg_temp.p70_check(not exists(select 1 from public.availability_block_rules where barbershop_id=:'shop_id')
 and not exists(select 1 from public.availability_blocks where barbershop_id=:'shop_id' and ends_at>now()),
 'P70: aprovação da remoção limpa a regra e os bloqueios futuros');

-- Versão protege também contra mudanças da sociedade, permissões e fuso entre pedido e decisão.
select set_config('request.jwt.claim.sub',:'owner_id',true);
insert into p70_results(label,payload) values('conflito',pg_temp.p70_payload());
update p70_results set result=public.request_weekly_break_change(:'shop_id','create',payload) where label='conflito';
reset role;
-- Simula uma atualização do servidor entre o pedido e a decisão, sem JWT do sócio.
select set_config('request.jwt.claim.sub','',true);
update public.barbershops set timezone='Europe/Lisbon' where id=:'shop_id';
select set_config('request.jwt.claim.sub',:'partner_id',true); set local role authenticated;
select pg_temp.p70_error($s$select public.decide_shop_change((select (result->>'request_id')::uuid from p70_results where label='conflito'),true)$s$,
 '40001','P70: mudar o fuso invalida aprovação antiga');
select pg_temp.p70_check(not exists(select 1 from public.availability_block_rules where barbershop_id=:'shop_id'),
 'P70: conflito não aplica parcialmente a pausa');
select public.decide_shop_change((select (result->>'request_id')::uuid from p70_results where label='conflito'),false);
select pg_temp.p70_check((select status='rejected' from public.shop_change_requests where id=
 (select (result->>'request_id')::uuid from p70_results where label='conflito')),
 'P70: pedido desatualizado ainda pode ser recusado');
select set_config('request.jwt.claim.sub',:'owner_id',true);
insert into p70_results(label,payload) values('sociedade',pg_temp.p70_payload());
update p70_results set result=public.request_weekly_break_change(:'shop_id','create',payload) where label='sociedade';
reset role;
select set_config('app.approved_shop_change','on',true);
update public.shop_members set ownership_percent=case when role='owner' then 40 else 60 end
 where barbershop_id=:'shop_id' and role in ('owner','partner');
select set_config('app.approved_shop_change','',true);
select set_config('request.jwt.claim.sub',:'partner_id',true); set local role authenticated;
select pg_temp.p70_error($s$select public.decide_shop_change((select (result->>'request_id')::uuid from p70_results where label='sociedade'),true)$s$,
 '40001','P70: nova participação não aproveita autorização antiga');
select public.decide_shop_change((select (result->>'request_id')::uuid from p70_results where label='sociedade'),false);
select set_config('request.jwt.claim.sub',:'owner_id',true);
insert into p70_results(label,payload) values('permissoes',pg_temp.p70_payload());
update p70_results set result=public.request_weekly_break_change(:'shop_id','create',payload) where label='permissoes';
reset role;
insert into public.shop_role_permissions(barbershop_id,role,permission,allowed)
 values(:'shop_id','owner','manage_operations',false);
select set_config('request.jwt.claim.sub',:'partner_id',true); set local role authenticated;
select pg_temp.p70_error($s$select public.decide_shop_change((select (result->>'request_id')::uuid from p70_results where label='permissoes'),true)$s$,
 '40001','P70: mudança de permissão invalida pedido anterior');
select set_config('request.jwt.claim.sub',:'owner_id',true);
select pg_temp.p70_error(format($s$select public.request_weekly_break_change(%L,'create',(select payload from p70_results where label='permissoes'))$s$,:'shop_id'),
 '42501','P70: perder gerência bloqueia novos pedidos apesar de shop_admin legado');
select set_config('request.jwt.claim.sub',:'partner_id',true);
select pg_temp.p70_check(public.request_weekly_break_change(:'shop_id','create',pg_temp.p70_payload())->>'status'='applied',
 'P70: sócio majoritário aplica diretamente com registro');

-- Cliente e colega não podem aproveitar a nova RPC; pausa própria continua operando.
select set_config('request.jwt.claim.sub',:'employee_id',true);
select pg_temp.p70_error(format($s$select public.request_weekly_break_change(%L,'create','{}')$s$,:'shop_id'),
 '42501','P70: contratado não solicita pausa da loja');
insert into public.availability_block_rules(barbershop_id,staff_id,weekdays,start_time,end_time)
 values(:'shop_id',:'employee_staff','{1,2,3,4,5}','14:00','14:30');
select pg_temp.p70_check(exists(select 1 from public.availability_block_rules where staff_id=:'employee_staff'),
 'P70: contratado mantém criação de pausa própria');
delete from public.availability_block_rules where staff_id=:'employee_staff';
select pg_temp.p70_check(not exists(select 1 from public.availability_block_rules where staff_id=:'employee_staff'),
 'P70: contratado mantém remoção de pausa própria');
select set_config('request.jwt.claim.sub',:'customer_id',true);
select pg_temp.p70_error(format($s$select public.get_weekly_break_governance(%L)$s$,:'shop_id'),
 '42501','P70: cliente não lê governança da pausa');
reset role;

-- Movimento administrativo entre lojas precisa invalidar origem e destino.
-- Usa apenas o papel do servidor nesta transação fictícia; clientes continuam sem UPDATE.
select set_config('request.jwt.claim.sub','',true);
create temporary table p70_move as select gen_random_uuid() shop_to, gen_random_uuid() member_id,
 gen_random_uuid() staff_from, gen_random_uuid() staff_to;
select * from p70_move \gset
insert into public.barbershops(id,name,slug) values(:'shop_to','Destino fictício','p70-'||:'shop_to');
insert into public.staff(id,barbershop_id,user_id,display_name,booking_slug)
 values(:'staff_from',:'shop_id',:'customer_id','Profissional de origem','origem-ficticia'),
 (:'staff_to',:'shop_to',:'customer_id','Profissional de destino','destino-ficticio');
insert into public.shop_members(id,barbershop_id,user_id,staff_id,role)
 values(:'member_id',:'shop_id',:'customer_id',:'staff_from','employee');
select coalesce((select revision from public.shop_weekly_break_versions where barbershop_id=:'shop_id'),0) old_revision,
 coalesce((select revision from public.shop_weekly_break_versions where barbershop_id=:'shop_to'),0) new_revision \gset
update public.shop_members set barbershop_id=:'shop_to', staff_id=:'staff_to' where id=:'member_id';
select pg_temp.p70_check((select revision>:'old_revision'::bigint from public.shop_weekly_break_versions where barbershop_id=:'shop_id')
 and (select revision>:'new_revision'::bigint from public.shop_weekly_break_versions where barbershop_id=:'shop_to'),
 'P70: transferir vínculo invalida versões da origem e do destino');
select revision old_revision from public.shop_weekly_break_versions where barbershop_id=:'shop_id' \gset
select revision new_revision from public.shop_weekly_break_versions where barbershop_id=:'shop_to' \gset
update public.shop_role_permissions set barbershop_id=:'shop_to' where barbershop_id=:'shop_id';
select pg_temp.p70_check((select revision>:'old_revision'::bigint from public.shop_weekly_break_versions where barbershop_id=:'shop_id')
 and (select revision>:'new_revision'::bigint from public.shop_weekly_break_versions where barbershop_id=:'shop_to'),
 'P70: transferir matriz invalida versões das duas lojas');
update public.shop_members set ownership_percent=50 where barbershop_id=:'shop_id' and role in ('owner','partner');
select set_config('request.jwt.claim.sub',:'owner_id',true); set local role authenticated;
insert into p70_results(label,payload) values('transferencia',pg_temp.p70_payload('16:00','17:00'));
update p70_results set result=public.request_weekly_break_change(:'shop_id','create',payload) where label='transferencia';
reset role; select set_config('request.jwt.claim.sub','',true);
select revision old_revision from public.shop_weekly_break_versions where barbershop_id=:'shop_id' \gset
select revision new_revision from public.shop_weekly_break_versions where barbershop_id=:'shop_to' \gset
update public.availability_block_rules set barbershop_id=:'shop_to' where barbershop_id=:'shop_id' and staff_id is null;
select pg_temp.p70_check((select revision>:'old_revision'::bigint from public.shop_weekly_break_versions where barbershop_id=:'shop_id')
 and (select revision>:'new_revision'::bigint from public.shop_weekly_break_versions where barbershop_id=:'shop_to'),
 'P70: transferir regra sem mudar horário invalida ambas as versões');
select set_config('request.jwt.claim.sub',:'partner_id',true); set local role authenticated;
select pg_temp.p70_error($s$select public.decide_shop_change((select (result->>'request_id')::uuid from p70_results where label='transferencia'),true)$s$,
 '40001','P70: transferência administrativa invalida pedido da origem');
reset role;

-- Compatibilidade com request_shop_change: dono que acumula gerente também espera30min.
select set_config('request.jwt.claim.sub','',true);
update public.shop_members set ownership_percent=case when role='owner' then 60 else 40 end
 where barbershop_id=:'shop_id' and role in ('owner','partner');
insert into public.memberships(user_id,role) values(:'owner_id','account_manager');
insert into public.account_manager_shops(user_id,barbershop_id) values(:'owner_id',:'shop_id');
select set_config('request.jwt.claim.sub',:'owner_id',true); set local role authenticated;
select pg_temp.p70_check((public.get_weekly_break_governance(:'shop_id')->>'requires_approval')::boolean,
 'P70: dono majoritário que acumula gerente vê aprovação obrigatória');
insert into p70_results(label,payload) values('gerente',pg_temp.p70_payload('18:00','19:00'));
update p70_results set result=public.request_shop_change(:'shop_id','weekly_break.create',payload) where label='gerente';
select pg_temp.p70_check((select result->>'status'='pending' from p70_results where label='gerente')
 and (select source='account_manager' and expires_at=now()+interval '30 minutes' from public.shop_change_requests
 where id=(select (result->>'request_id')::uuid from p70_results where label='gerente')),
 'P70: gerente conserva fonte account_manager e validade30min sem aplicar');
reset role; select set_config('request.jwt.claim.sub','',true);
insert into public.memberships(user_id,role) values(:'owner_id','platform_admin');
select set_config('request.jwt.claim.sub',:'owner_id',true); set local role authenticated;
select pg_temp.p70_check(not (public.get_weekly_break_governance(:'shop_id')->>'requires_approval')::boolean
 and public.request_weekly_break_change(:'shop_id','create',pg_temp.p70_payload('19:00','20:00'))->>'status'='applied',
 'P70: administrador da plataforma prevalece quando também é gerente');
reset role;
