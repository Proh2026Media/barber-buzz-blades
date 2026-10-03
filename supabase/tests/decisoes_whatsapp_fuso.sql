-- Decisões de 03/10/2026 (20261003230000_decisoes_whatsapp_fuso.sql): avisos por WhatsApp
-- só para número confirmado e fuso horário da barbearia.
-- Rodar depois da migration, numa transação: BEGIN; \i este arquivo; ROLLBACK;
-- Usuários, lojas e números fictícios, gerados aqui (não depende de dados reais).
create temporary table dec_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() equal_shop_id,
  gen_random_uuid() owner_id, gen_random_uuid() owner_staff,
  gen_random_uuid() worker_id, gen_random_uuid() worker_staff,
  gen_random_uuid() eq_a_id, gen_random_uuid() eq_a_staff,
  gen_random_uuid() eq_b_id, gen_random_uuid() eq_b_staff,
  gen_random_uuid() outsider_id,
  gen_random_uuid() cust_ok, gen_random_uuid() cust_pending,
  gen_random_uuid() service_id, gen_random_uuid() appt_ok, gen_random_uuid() appt_pending,
  '+55119' || lpad((floor(random() * 100000000))::bigint::text, 8, '0') as phone_ok,
  '+55219' || lpad((floor(random() * 100000000))::bigint::text, 8, '0') as phone_pending,
  '+55319' || lpad((floor(random() * 100000000))::bigint::text, 8, '0') as phone_team;
grant select on dec_ctx to authenticated;

create function pg_temp.check_dec(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
-- Com expected_state, a recusa precisa vir com esse código (e não por outro erro qualquer).
create function pg_temp.expect_dec_error(statement text, label text, expected_state text default null)
returns void language plpgsql as $$
declare failed boolean := false; state text;
begin
  begin execute statement; exception when others then failed := true; state := sqlstate; end;
  if failed and expected_state is not null and state is distinct from expected_state then
    raise notice 'código recebido: %', state;
    failed := false;
  end if;
  perform pg_temp.check_dec(failed, label);
end $$;
create function pg_temp.expect_dec_ok(statement text, label text) returns void language plpgsql as $$
declare ok boolean := true; msg text;
begin
  begin execute statement; exception when others then ok := false; msg := sqlerrm; end;
  if not ok then raise notice 'erro: %', msg; end if;
  perform pg_temp.check_dec(ok, label);
end $$;

select pg_temp.check_dec(
  not exists (
    select 1 from public.profiles p join dec_ctx c
      on p.whatsapp_e164 in (c.phone_ok, c.phone_pending, c.phone_team)),
  'Números de teste livres');

-- ---------------------------------------------------------------------------
-- Cenário: loja de um dono (com um funcionário) e loja de dois sócios 50/50
-- ---------------------------------------------------------------------------

insert into public.barbershops(id, name, slug)
select shop_id, 'Decisões dono', 'dec-dono-' || shop_id from dec_ctx union all
select equal_shop_id, 'Decisões sócios', 'dec-socios-' || equal_shop_id from dec_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{}'::jsonb
from dec_ctx c
cross join lateral unnest(array[c.owner_id, c.worker_id, c.eq_a_id, c.eq_b_id,
  c.outsider_id, c.cust_ok, c.cust_pending]) u;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono', owner_id, 'dono' from dec_ctx union all
select worker_staff, shop_id, 'Funcionário', worker_id, 'func' from dec_ctx union all
select eq_a_staff, equal_shop_id, 'Sócio A', eq_a_id, 'socio-a' from dec_ctx union all
select eq_b_staff, equal_shop_id, 'Sócio B', eq_b_id, 'socio-b' from dec_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from dec_ctx union all
select shop_id, worker_id, worker_staff, 'employee'::public.shop_member_role, null from dec_ctx union all
select equal_shop_id, eq_a_id, eq_a_staff, 'owner'::public.shop_member_role, 50 from dec_ctx union all
select equal_shop_id, eq_b_id, eq_b_staff, 'partner'::public.shop_member_role, 50 from dec_ctx;
select pg_temp.expect_dec_ok('set constraints all immediate', 'Lojas de teste válidas');
set constraints all deferred;

-- ---------------------------------------------------------------------------
-- 1. Avisos por WhatsApp só para número confirmado do destinatário
-- ---------------------------------------------------------------------------

-- Cliente A confirma o número por código (como faria o auth-otp).
select set_config('request.jwt.claim.role', 'service_role', true);
select public.apply_verified_whatsapp(c.cust_ok, c.phone_ok, true) from dec_ctx c;
select set_config('request.jwt.claim.role', '', true);

-- Cliente B grava o número pela tela, sem código (fica não confirmado).
select set_config('request.jwt.claim.sub', cust_pending::text, true) from dec_ctx;
set local role authenticated;
select public.save_my_whatsapp((select phone_pending from dec_ctx), true);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select pg_temp.check_dec(
  (select p.whatsapp_verified_at is not null and p.whatsapp_opt_in_at is not null
     from public.profiles p join dec_ctx c on p.id = c.cust_ok)
  and (select p.whatsapp_e164 = c.phone_pending and p.whatsapp_verified_at is null
         and p.whatsapp_opt_in_at is not null
       from public.profiles p join dec_ctx c on p.id = c.cust_pending),
  'Pré-condição: um cliente confirmado e outro só com aceite');

insert into public.whatsapp_channels(barbershop_id, instance_name, status, enabled)
select shop_id, 'teste-dec-' || substr(replace(shop_id::text, '-', ''), 1, 20), 'open', true
from dec_ctx;

-- Pelo customer_id
select pg_temp.check_dec(
  (select public.enqueue_whatsapp_message(c.shop_id, c.phone_pending, 'customer.notice', 'Teste',
     'teste-dec-pend:' || c.cust_pending, jsonb_build_object('customer_id', c.cust_pending))
   from dec_ctx c) is null,
  'Aviso não sai para número NÃO confirmado do próprio cliente');
select pg_temp.check_dec(
  (select public.enqueue_whatsapp_message(c.shop_id, c.phone_ok, 'customer.notice', 'Teste',
     'teste-dec-ok:' || c.cust_ok, jsonb_build_object('customer_id', c.cust_ok))
   from dec_ctx c) is not null,
  'Aviso sai para número confirmado do próprio cliente');
select pg_temp.check_dec(
  (select public.enqueue_whatsapp_message(c.shop_id, c.phone_team, 'customer.notice', 'Teste',
     'teste-dec-outro-num:' || c.cust_ok, jsonb_build_object('customer_id', c.cust_ok))
   from dec_ctx c) is null,
  'Aviso não sai para número que não é o confirmado do cliente');
select pg_temp.check_dec(
  (select public.enqueue_whatsapp_message(c.shop_id, c.phone_ok, 'customer.notice', 'Teste',
     'teste-dec-alheio:' || c.cust_pending, jsonb_build_object('customer_id', c.cust_pending))
   from dec_ctx c) is null,
  'Aviso de um cliente não vai para o número confirmado de outro');

-- Pela reserva (appointment_id), como faz queue_appointment_whatsapp.
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select service_id, shop_id, 'Corte Decisões', 30, 5000 from dec_ctx;
set local session_replication_role = replica;
insert into public.appointments(id, barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status)
select appt_ok, shop_id, cust_ok, service_id, owner_staff,
  now() + interval '1 day', now() + interval '1 day 30 minutes', 'confirmed'::public.appointment_status
from dec_ctx
union all
select appt_pending, shop_id, cust_pending, service_id, owner_staff,
  now() + interval '2 days', now() + interval '2 days 30 minutes', 'confirmed'::public.appointment_status
from dec_ctx;
set local session_replication_role = origin;

select pg_temp.check_dec(
  (select public.enqueue_whatsapp_message(c.shop_id, c.phone_pending, 'customer.notice', 'Teste',
     'teste-dec-appt-pend:' || c.appt_pending, jsonb_build_object('appointment_id', c.appt_pending))
   from dec_ctx c) is null,
  'Aviso da reserva não sai para número não confirmado');
select pg_temp.check_dec(
  (select public.enqueue_whatsapp_message(c.shop_id, c.phone_ok, 'customer.notice', 'Teste',
     'teste-dec-appt-ok:' || c.appt_ok, jsonb_build_object('appointment_id', c.appt_ok))
   from dec_ctx c) is not null,
  'Aviso da reserva sai para número confirmado');

-- Destinatário desconhecido (aviso à equipe/dono): comportamento anterior.
select pg_temp.check_dec(
  (select public.enqueue_whatsapp_message(c.shop_id, c.phone_team, 'team.notice', 'Teste',
     'teste-dec-equipe:' || c.shop_id, '{}'::jsonb)
   from dec_ctx c) is not null,
  'Destinatário desconhecido: aviso sai como antes');
select pg_temp.check_dec(
  (select public.enqueue_whatsapp_message(c.shop_id, c.phone_team, 'team.notice', 'Teste',
     'teste-dec-equipe-staff:' || c.shop_id, jsonb_build_object('staff_id', c.owner_staff))
   from dec_ctx c) is not null,
  'Destinatário desconhecido com staff_id: aviso sai como antes');

-- Canal desligado continua barrando (regra antiga intacta).
update public.whatsapp_channels w set enabled = false from dec_ctx c where w.barbershop_id = c.shop_id;
select pg_temp.check_dec(
  (select public.enqueue_whatsapp_message(c.shop_id, c.phone_ok, 'customer.notice', 'Teste',
     'teste-dec-off:' || c.cust_ok, jsonb_build_object('customer_id', c.cust_ok))
   from dec_ctx c) is null,
  'Canal desligado continua sem enviar');
update public.whatsapp_channels w set enabled = true from dec_ctx c where w.barbershop_id = c.shop_id;

select pg_temp.check_dec(
  not has_function_privilege('anon',
    'public.enqueue_whatsapp_message(uuid, text, text, text, text, jsonb, timestamptz)', 'execute')
  and not has_function_privilege('authenticated',
    'public.enqueue_whatsapp_message(uuid, text, text, text, text, jsonb, timestamptz)', 'execute')
  and has_function_privilege('service_role',
    'public.enqueue_whatsapp_message(uuid, text, text, text, text, jsonb, timestamptz)', 'execute'),
  'Fila do WhatsApp segue só para o servidor');

-- Limpeza da fila ao aplicar a migration: repete o UPDATE da 20261003230000 sobre avisos
-- pendentes criados à moda antiga (direto na tabela, como antes da regra nova).
insert into public.whatsapp_outbox(barbershop_id, to_e164, template_key, body, payload, dedupe_key)
select c.shop_id, c.phone_pending, 'customer.notice', 'Antigo', jsonb_build_object('customer_id', c.cust_pending),
  'teste-dec-fila-pend:' || c.cust_pending from dec_ctx c union all
select c.shop_id, c.phone_pending, 'booking.reminder', 'Antigo', jsonb_build_object('appointment_id', c.appt_pending),
  'teste-dec-fila-appt:' || c.appt_pending from dec_ctx c union all
select c.shop_id, c.phone_team, 'team.notice', 'Antigo', '{}'::jsonb,
  'teste-dec-fila-equipe:' || c.shop_id from dec_ctx c union all
select c.shop_id, c.phone_team, 'team.notice', 'Antigo', jsonb_build_object('customer_id', 'não-é-uuid'),
  'teste-dec-fila-lixo:' || c.shop_id from dec_ctx c;
with queued as (
  select
    o.id,
    o.to_e164,
    coalesce(
      case when o.payload->>'customer_id'
             ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (o.payload->>'customer_id')::uuid end,
      (select a.customer_id
         from public.appointments a
        where a.id = case when o.payload->>'appointment_id'
                            ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                       then (o.payload->>'appointment_id')::uuid end)
    ) as recipient
  from public.whatsapp_outbox o
  where o.status = 'pending'
)
update public.whatsapp_outbox o
set status = 'failed',
    error = 'WhatsApp do destinatário não confirmado (20261003230000)'
from queued q
where o.id = q.id
  and q.recipient is not null
  and not exists (
    select 1 from public.profiles p
    where p.id = q.recipient
      and p.whatsapp_e164 = q.to_e164
      and p.whatsapp_verified_at is not null
  );
select pg_temp.check_dec(
  (select count(*) = 2 from public.whatsapp_outbox o join dec_ctx c on o.barbershop_id = c.shop_id
    where o.dedupe_key like 'teste-dec-fila-%' and o.status = 'failed'
      and o.dedupe_key in ('teste-dec-fila-pend:' || c.cust_pending, 'teste-dec-fila-appt:' || c.appt_pending)),
  'Fila antiga: avisos pendentes a número não confirmado (cliente e reserva) não saem');
select pg_temp.check_dec(
  (select count(*) = 2 from public.whatsapp_outbox o join dec_ctx c on o.barbershop_id = c.shop_id
    where o.dedupe_key like 'teste-dec-fila-%' and o.status = 'pending'),
  'Fila antiga: avisos sem destinatário conhecido (equipe, pacote estranho) seguem pendentes');
select pg_temp.check_dec(
  (select count(*) = 0 from public.whatsapp_outbox o join dec_ctx c on o.barbershop_id = c.shop_id
    where o.dedupe_key not like 'teste-dec-fila-%' and o.status <> 'pending'),
  'Fila antiga: avisos já aceitos pela regra nova não são tocados');
select pg_temp.check_dec(
  (select p.prosecdef and p.proconfig @> array['search_path=public']
   from pg_proc p where p.oid = 'public.enqueue_whatsapp_message(uuid, text, text, text, text, jsonb, timestamptz)'::regprocedure),
  'enqueue_whatsapp_message segue SECURITY DEFINER com search_path');

-- ---------------------------------------------------------------------------
-- 2. Validação do fuso horário
-- ---------------------------------------------------------------------------

select pg_temp.check_dec(
  public.is_valid_shop_timezone('America/Sao_Paulo')
  and public.is_valid_shop_timezone('America/Manaus')
  and public.is_valid_shop_timezone('America/Noronha')
  and public.is_valid_shop_timezone('America/Rio_Branco')
  and public.is_valid_shop_timezone('America/Fortaleza')
  and public.is_valid_shop_timezone('Europe/Lisbon')
  and public.is_valid_shop_timezone('Atlantic/Azores')
  and public.is_valid_shop_timezone('Atlantic/Madeira')
  and public.is_valid_shop_timezone('Brazil/East')
  and public.is_valid_shop_timezone('UTC'),
  'Fusos do Brasil, de Portugal, nome antigo e UTC aceitos');
select pg_temp.check_dec(
  not coalesce(public.is_valid_shop_timezone(null), false)
  and not public.is_valid_shop_timezone('')
  and not public.is_valid_shop_timezone('EST')
  and not public.is_valid_shop_timezone('Etc/GMT+3')
  and not public.is_valid_shop_timezone('posix/America/Sao_Paulo')
  and not public.is_valid_shop_timezone('Lua/Base_Alfa')
  and not public.is_valid_shop_timezone('America/Sao_Paulo; drop table x'),
  'Nulo, vazio, abreviação, Etc/, posix/, inexistente e lixo recusados');

-- ---------------------------------------------------------------------------
-- 3. set_shop_timezone
-- ---------------------------------------------------------------------------

select pg_temp.check_dec(
  (select b.timezone = 'America/Sao_Paulo' from public.barbershops b join dec_ctx c on b.id = c.shop_id),
  'Loja nasce no padrão (America/Sao_Paulo)');

select set_config('request.jwt.claim.sub', owner_id::text, true) from dec_ctx;
set local role authenticated;
select pg_temp.check_dec(
  (select public.set_shop_timezone(c.shop_id, ' Europe/Lisbon ')->>'status' from dec_ctx c) = 'applied',
  'Dono troca o fuso para um válido (aplicado na hora)');
select pg_temp.check_dec(
  (select public.set_shop_timezone(c.shop_id, 'Europe/Lisbon')->>'status' from dec_ctx c) = 'unchanged',
  'Mesmo fuso de novo: nada muda');
select pg_temp.expect_dec_error(
  'select public.set_shop_timezone((select shop_id from dec_ctx), ''Lua/Base_Alfa'')',
  'Fuso inexistente recusado', '22023');
select pg_temp.expect_dec_error(
  'select public.set_shop_timezone((select shop_id from dec_ctx), ''EST'')',
  'Abreviação recusada', '22023');
select pg_temp.expect_dec_error(
  'select public.set_shop_timezone((select shop_id from dec_ctx), null)',
  'Fuso nulo recusado', '22023');
-- request_shop_change é chamável pelo dono com qualquer tipo: o ramo 'shop.timezone' de
-- apply_shop_change confere o fuso de novo, sem depender de set_shop_timezone.
select pg_temp.expect_dec_error(
  'select public.request_shop_change((select shop_id from dec_ctx), ''shop.timezone'',
     jsonb_build_object(''timezone'', ''EST''))',
  'Fuso inválido recusado também pela chamada direta a request_shop_change', '22023');
reset role;

select pg_temp.check_dec(
  (select b.timezone = 'Europe/Lisbon' from public.barbershops b join dec_ctx c on b.id = c.shop_id)
  and (select public.shop_tz(c.shop_id) = 'Europe/Lisbon' from dec_ctx c),
  'Fuso gravado e lido por shop_tz (horários, agenda, avisos)');
select pg_temp.check_dec(
  exists (select 1 from public.shop_change_requests r join dec_ctx c on r.barbershop_id = c.shop_id
    where r.kind = 'shop.timezone' and r.status = 'approved' and r.source = 'majority_log'),
  'Troca registrada no histórico de mudanças da loja');

-- Funcionário e pessoa de fora não mudam o fuso.
select set_config('request.jwt.claim.sub', worker_id::text, true) from dec_ctx;
set local role authenticated;
select pg_temp.expect_dec_error(
  'select public.set_shop_timezone((select shop_id from dec_ctx), ''America/Manaus'')',
  'Funcionário não muda o fuso', '42501');
reset role;
select set_config('request.jwt.claim.sub', outsider_id::text, true) from dec_ctx;
set local role authenticated;
select pg_temp.expect_dec_error(
  'select public.set_shop_timezone((select shop_id from dec_ctx), ''America/Manaus'')',
  'Pessoa de fora não muda o fuso', '42501');
reset role;
select pg_temp.check_dec(
  (select b.timezone = 'Europe/Lisbon' from public.barbershops b join dec_ctx c on b.id = c.shop_id),
  'Fuso continua o do dono após as recusas');

-- Sociedade igualitária: vira pedido pendente; aprovado pelo outro sócio, aplica.
select set_config('request.jwt.claim.sub', eq_a_id::text, true) from dec_ctx;
set local role authenticated;
select pg_temp.check_dec(
  (select public.set_shop_timezone(c.equal_shop_id, 'America/Manaus')->>'status' from dec_ctx c) = 'pending',
  'Sócio em sociedade igualitária abre pedido pendente');
reset role;
select pg_temp.check_dec(
  (select b.timezone = 'America/Sao_Paulo' from public.barbershops b join dec_ctx c on b.id = c.equal_shop_id),
  'Pedido pendente não muda o fuso');
select set_config('request.jwt.claim.sub', eq_b_id::text, true) from dec_ctx;
set local role authenticated;
select pg_temp.expect_dec_ok(
  'select public.decide_shop_change(
     (select r.id from public.shop_change_requests r join dec_ctx c on r.barbershop_id = c.equal_shop_id
      where r.kind = ''shop.timezone'' and r.status = ''pending'' limit 1), true, null)',
  'Outro sócio aprova o pedido');
reset role;
select pg_temp.check_dec(
  (select b.timezone = 'America/Manaus' from public.barbershops b join dec_ctx c on b.id = c.equal_shop_id),
  'Pedido aprovado aplica o fuso');

-- Gravação direta: usuário logado não troca o fuso fora do caminho aprovado.
-- apply_shop_change deixa app.approved_shop_change ligado até o fim da transação (no
-- app cada chamada é uma transação); aqui o teste desliga para simular uma chamada nova.
select set_config('app.approved_shop_change', 'off', true);
select set_config('request.jwt.claim.sub', owner_id::text, true) from dec_ctx;
select pg_temp.expect_dec_error(
  'update public.barbershops b set timezone = ''America/Manaus'' from dec_ctx c where b.id = c.shop_id',
  'Usuário logado não troca o fuso direto na tabela', '42501');
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_dec_error(
  'update public.barbershops b set timezone = ''Lua/Base_Alfa'' from dec_ctx c where b.id = c.shop_id',
  'Fuso inválido recusado também para o servidor', '22023');
select pg_temp.expect_dec_error(
  'insert into public.barbershops(name, slug, timezone) values (''Dec inválida'', ''dec-invalida-'' || gen_random_uuid(), ''EST'')',
  'Loja nova com fuso inválido recusada', '22023');
select pg_temp.expect_dec_ok(
  'update public.barbershops b set timezone = ''Atlantic/Azores'' from dec_ctx c where b.id = c.shop_id',
  'Servidor (sem usuário, como register-shop) grava fuso válido');
select pg_temp.expect_dec_ok(
  'update public.barbershops b set name = name from dec_ctx c where b.id = c.shop_id',
  'Atualizar outra coluna da loja não esbarra no fuso');

-- Privilégios
select pg_temp.check_dec(
  has_function_privilege('authenticated', 'public.set_shop_timezone(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.set_shop_timezone(uuid, text)', 'execute'),
  'set_shop_timezone só para usuário logado');
select pg_temp.check_dec(
  (select p.prosecdef and p.proconfig @> array['search_path=public']
   from pg_proc p where p.oid = 'public.set_shop_timezone(uuid, text)'::regprocedure),
  'set_shop_timezone SECURITY DEFINER com search_path');
select pg_temp.check_dec(
  not has_function_privilege('anon', 'public.is_valid_shop_timezone(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.apply_shop_change(uuid, text, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.apply_shop_change(uuid, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.guard_barbershop_timezone()', 'execute'),
  'Validação, aplicação e gatilho sem acesso indevido');
