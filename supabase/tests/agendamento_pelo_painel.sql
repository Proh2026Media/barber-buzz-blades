-- Agendamento pelo painel, cliente do balcão, apelido e recorrência
-- (20261016130000_agendamento_pelo_painel.sql).
-- Rodar numa transação, sempre com ROLLBACK: BEGIN; \i este arquivo; ROLLBACK;
-- Dados fictícios com IDs aleatórios. A loja abre todos os dias de 00:00 a 23:59; os horários
-- ficam daqui a 2 dias (fuso da loja), exceto o do lembrete (daqui a ~23 h).
create temporary table ap_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() other_shop,
  gen_random_uuid() owner_id, gen_random_uuid() owner_staff,
  gen_random_uuid() employee_id, gen_random_uuid() employee_staff,
  gen_random_uuid() colleague_id, gen_random_uuid() colleague_staff,
  gen_random_uuid() cust_id, gen_random_uuid() stranger_id, gen_random_uuid() newcomer_id,
  gen_random_uuid() quiet_id, '+5511990007070'::text quiet_phone,
  gen_random_uuid() corte,
  '+5511990001111'::text cust_phone, '+5511990002222'::text manual_phone,
  '+5511990003333'::text stranger_phone, '+5511990004444'::text employee_manual_phone,
  ((now() at time zone 'America/Sao_Paulo')::date + 2) as day;
grant select on ap_ctx to authenticated;
select * from ap_ctx \gset

create function pg_temp.check_ap(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_ap_error(statement text, label text, expected_state text default null)
returns void language plpgsql as $$
declare failed boolean := false; state text; msg text;
begin
  begin execute statement;
  exception when others then
    failed := true;
    get stacked diagnostics state = returned_sqlstate, msg = message_text;
  end;
  if failed and expected_state is not null and state is distinct from expected_state then
    raise notice 'recebido: % (%)', msg, state;
    failed := false;
  end if;
  perform pg_temp.check_ap(failed, label);
end $$;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true)
$$;
create function pg_temp.at(d date, h interval) returns timestamptz language sql as $$
  select (d + h) at time zone 'America/Sao_Paulo'
$$;

insert into public.barbershops(id, name, slug, timezone)
select shop_id, 'Painel AP', 'ap-' || shop_id, 'America/Sao_Paulo' from ap_ctx union all
select other_shop, 'Outra AP', 'ap-outra-' || other_shop, 'America/Sao_Paulo' from ap_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', jsonb_build_object('full_name', n)
from ap_ctx c
cross join lateral (values
  (c.owner_id, 'Dono AP'), (c.employee_id, 'Contratado AP'), (c.colleague_id, 'Colega AP'),
  (c.cust_id, 'Cliente Cadastrado'), (c.stranger_id, 'Cliente de Outra Loja'),
  (c.newcomer_id, 'José Carlos Pereira'), (c.quiet_id, 'Cliente Quieto')) v(u, n);
-- Cliente desta loja e cliente de outra loja, os dois com WhatsApp confirmado.
select set_config('request.jwt.claim.role', 'service_role', true);
update public.profiles p set whatsapp_e164 = c.cust_phone, whatsapp_verified_at = now(),
  whatsapp_opt_in_at = now()
from ap_ctx c where p.id = c.cust_id;
update public.profiles p set whatsapp_e164 = c.stranger_phone, whatsapp_verified_at = now(),
  whatsapp_opt_in_at = now()
from ap_ctx c where p.id = c.stranger_id;
update public.profiles p set whatsapp_e164 = c.quiet_phone, whatsapp_verified_at = now(),
  whatsapp_opt_in_at = now()
from ap_ctx c where p.id = c.quiet_id;
select set_config('request.jwt.claim.role', '', true);
insert into public.memberships(user_id, barbershop_id, role)
select cust_id, shop_id, 'customer'::public.app_role from ap_ctx union all
select quiet_id, shop_id, 'customer'::public.app_role from ap_ctx union all
select stranger_id, other_shop, 'customer'::public.app_role from ap_ctx;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono AP', owner_id, 'dono' from ap_ctx union all
select employee_staff, shop_id, 'Contratado AP', employee_id, 'contratado' from ap_ctx union all
select colleague_staff, shop_id, 'Colega AP', colleague_id, 'colega' from ap_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from ap_ctx union all
select shop_id, employee_id, employee_staff, 'employee'::public.shop_member_role, null from ap_ctx union all
select shop_id, colleague_id, colleague_staff, 'employee'::public.shop_member_role, null from ap_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select corte, shop_id, 'Corte', 30, 5000 from ap_ctx;
insert into public.barbershop_settings(barbershop_id) select shop_id from ap_ctx on conflict do nothing;
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select shop_id, w, true, '00:00', '23:59' from ap_ctx cross join generate_series(0, 6) w
on conflict (barbershop_id, weekday) do update set is_open = true, opens_at = '00:00', closes_at = '23:59';
insert into public.whatsapp_channels(barbershop_id, instance_name, status, enabled)
select shop_id, 'ap-' || left(replace(shop_id::text, '-', ''), 20), 'open', true from ap_ctx;

-- ---------------------------------------------------------------------------------------------
-- Procurar pelo WhatsApp
-- ---------------------------------------------------------------------------------------------
select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.check_ap(
  (public.find_shop_client(:'shop_id', '(11) 99000-1111')->>'kind') = 'account'
  and (public.find_shop_client(:'shop_id', '11990001111')->>'name') = 'Cliente Cadastrado'
  and (public.find_shop_client(:'shop_id', '11990001111')->>'customer_id') = :'cust_id',
  'WhatsApp confirmado de cliente da loja acha a conta e o nome cadastrado');
select pg_temp.check_ap(
  (public.find_shop_client(:'shop_id', :'stranger_phone')->>'kind') = 'none',
  'Conta de outra loja não aparece (o número não revela quem tem conta)');
select pg_temp.check_ap(
  (public.find_shop_client(:'shop_id', :'manual_phone')->>'kind') = 'none',
  'Número novo: ninguém encontrado');
select pg_temp.expect_ap_error(
  format('select public.find_shop_client(%L, %L)', :'shop_id', '123'),
  'WhatsApp inválido é recusado', '22023');
reset role;

-- ---------------------------------------------------------------------------------------------
-- Marcar para cliente do balcão (nome + WhatsApp)
-- ---------------------------------------------------------------------------------------------
select pg_temp.as_user(:'owner_id');
set local role authenticated;
create temporary table ap_manual as
select public.book_for_client(
  :'shop_id', :'owner_staff', :'corte', pg_temp.at(:'day', interval '10 hours'),
  null, null, '  Zé   da Padaria ', '(11) 99000-2222', null, null) as r;
reset role;
select * from ap_manual \gset
select pg_temp.check_ap(
  (select (r->>'kind') = 'manual' and (r->>'has_account')::boolean = false
     and (r->>'name') = 'Zé da Padaria' from ap_manual),
  'Dono marca para cliente sem cadastro (nome limpo)');
select pg_temp.check_ap(
  exists (select 1 from public.appointments a, ap_manual m, ap_ctx c
          where a.id = (m.r->>'appointment_id')::uuid and a.customer_id is null
            and a.shop_client_id = (m.r->>'shop_client_id')::uuid and a.booked_by = c.owner_id
            and a.status = 'confirmed' and a.ends_at = a.starts_at + interval '30 minutes'
            and a.booked_price_cents = 5000),
  'Atendimento do balcão: sem conta, com a ficha, quem marcou, fim e preço certos');
select pg_temp.check_ap(
  exists (select 1 from public.whatsapp_outbox o, ap_ctx c
          where o.barbershop_id = c.shop_id and o.to_e164 = c.manual_phone
            and o.template_key = 'booking.confirmed'
            and o.body like '%/auth?cadastro=1%'),
  'Cliente do balcão recebe a confirmação no WhatsApp, com o link de cadastro');

-- Mesmo número de novo: reaproveita a ficha (não duplica).
select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.check_ap(
  (public.find_shop_client(:'shop_id', :'manual_phone')->>'kind') = 'manual'
  and (public.find_shop_client(:'shop_id', :'manual_phone')->>'name') = 'Zé da Padaria',
  'Número do balcão é achado na próxima vez');
select public.book_for_client(
  :'shop_id', :'owner_staff', :'corte', pg_temp.at(:'day', interval '11 hours'),
  null, (public.find_shop_client(:'shop_id', :'manual_phone')->>'shop_client_id')::uuid,
  null, null, 'Zé', false);
reset role;
select pg_temp.check_ap(
  (select count(*) from public.shop_clients sc, ap_ctx c
   where sc.barbershop_id = c.shop_id and sc.whatsapp_e164 = c.manual_phone) = 1
  and (select nickname from public.shop_clients sc, ap_ctx c
       where sc.barbershop_id = c.shop_id and sc.whatsapp_e164 = c.manual_phone) = 'Zé',
  'Mesmo WhatsApp não duplica a ficha e grava o apelido');
select pg_temp.check_ap(
  not exists (select 1 from public.whatsapp_outbox o, public.appointments a, ap_ctx c
              where a.barbershop_id = c.shop_id and a.starts_at = pg_temp.at(c.day, interval '11 hours')
                and o.payload->>'appointment_id' = a.id::text),
  'Com os avisos desligados pelo barbeiro, nada vai para a fila');

-- ---------------------------------------------------------------------------------------------
-- Marcar para cliente com conta (o número bate com a conta)
-- ---------------------------------------------------------------------------------------------
select pg_temp.as_user(:'owner_id');
set local role authenticated;
create temporary table ap_account as
select public.book_for_client(
  :'shop_id', :'employee_staff', :'corte', pg_temp.at(:'day', interval '10 hours'),
  null, null, 'Fulano digitado', '11 99000-1111', 'Alemão', null) as r;
reset role;
select pg_temp.check_ap(
  (select (r->>'kind') = 'account' and (r->>'customer_id') = (select cust_id::text from ap_ctx)
     and (r->>'name') = 'Cliente Cadastrado' and (r->>'nickname') = 'Alemão' from ap_account),
  'WhatsApp de cliente com conta: vai para a conta, vale o nome cadastrado e o apelido');
select pg_temp.check_ap(
  exists (select 1 from public.whatsapp_outbox o, ap_ctx c, ap_account m
          where o.to_e164 = c.cust_phone and o.payload->>'appointment_id' = m.r->>'appointment_id'
            and o.template_key = 'booking.confirmed'),
  'Cliente com conta recebe a confirmação pelas regras de sempre');
select pg_temp.check_ap(
  not exists (select 1 from public.shop_clients sc, ap_ctx c
              where sc.barbershop_id = c.shop_id and sc.whatsapp_e164 = c.cust_phone),
  'Cliente com conta não vira ficha do balcão');
select pg_temp.as_user(:'owner_id');
set local role authenticated;
select public.book_for_client(
  :'shop_id', :'owner_staff', :'corte', pg_temp.at(:'day', interval '12 hours'),
  :'quiet_id', null, null, null, '', null);
select pg_temp.check_ap(
  public.set_client_nickname(:'shop_id', :'quiet_id', null, '   ') is null,
  'Apagar apelido de quem não tem devolve vazio');
reset role;
select pg_temp.check_ap(
  not exists (select 1 from public.shop_clients sc, ap_ctx c where sc.profile_id = c.quiet_id),
  'Apelido vazio de cliente com conta não cria registro');

-- ---------------------------------------------------------------------------------------------
-- Permissões de quem marca
-- ---------------------------------------------------------------------------------------------
select pg_temp.as_user(:'employee_id');
set local role authenticated;
select pg_temp.check_ap(
  (public.book_for_client(:'shop_id', :'employee_staff', :'corte', pg_temp.at(:'day', interval '14 hours'),
     null, null, 'Cliente do Contratado', :'employee_manual_phone', null, null)->>'kind') = 'manual',
  'Contratado marca na própria agenda');
select pg_temp.expect_ap_error(
  format('select public.book_for_client(%L, %L, %L, %L, null, null, %L, %L, null, null)',
    :'shop_id', :'colleague_staff', :'corte', pg_temp.at(:'day', interval '15 hours'),
    'Outro', '11990005555'),
  'Contratado não marca na agenda do colega', '42501');
select pg_temp.expect_ap_error(
  format('select public.book_for_client(%L, %L, %L, %L, null, null, %L, %L, null, null)',
    :'shop_id', :'employee_staff', :'corte', pg_temp.at(:'day', interval '14 hours'),
    'Encaixe', '11990006666'),
  'Horário já ocupado é recusado', '23P01');
select pg_temp.expect_ap_error(
  format('select public.book_for_client(%L, %L, %L, %L, null, null, %L, %L, null, null)',
    :'shop_id', :'employee_staff', :'corte', now() - interval '1 hour', 'Passado', '11990007777'),
  'Horário que já passou é recusado', '22023');
select pg_temp.expect_ap_error(
  format('select public.book_for_client(%L, %L, %L, %L, null, null, %L, %L, null, null)',
    :'shop_id', :'employee_staff', :'corte', pg_temp.at(:'day', interval '16 hours'), '', '11990008888'),
  'Sem nome não marca', '22023');
select pg_temp.expect_ap_error(
  format('select public.book_for_client(%L, %L, %L, %L, null, null, %L, %L, null, null)',
    :'shop_id', :'employee_staff', :'corte', pg_temp.at(:'day', interval '16 hours'), 'Sem número', '12'),
  'Sem WhatsApp válido não marca', '22023');
reset role;
select pg_temp.as_user(:'cust_id');
set local role authenticated;
select pg_temp.expect_ap_error(
  format('select public.book_for_client(%L, %L, %L, %L, null, null, %L, %L, null, null)',
    :'shop_id', :'owner_staff', :'corte', pg_temp.at(:'day', interval '17 hours'), 'Golpe', '11990009999'),
  'Cliente não usa a função da equipe', '42501');
select pg_temp.check_ap(
  (select count(*) from public.shop_clients) = 0,
  'Cliente não lê as fichas nem os apelidos da equipe');
reset role;

-- ---------------------------------------------------------------------------------------------
-- Agenda da equipe
-- ---------------------------------------------------------------------------------------------
-- Horário recorrente ativo do cliente com conta.
insert into public.booking_series(barbershop_id, customer_id, service_id, staff_id, kind, weekday,
  local_time, anchor_starts_at, created_by)
select shop_id, cust_id, corte, employee_staff, 'weekday', extract(dow from day)::smallint,
  '18:00', pg_temp.at(day + 7, interval '18 hours'), 'customer' from ap_ctx;

insert into public.appointments(barbershop_id, customer_id, shop_client_id, service_id, staff_id,
  starts_at, ends_at, status)
select shop_id, null, null, corte, owner_staff, pg_temp.at(day, interval '13 hours'),
  pg_temp.at(day, interval '13 hours 30 minutes'), 'confirmed' from ap_ctx;

select pg_temp.as_user(:'owner_id');
set local role authenticated;
create temporary table ap_sched as
select jsonb_array_elements(public.get_team_schedule(:'shop_id',
  pg_temp.at(:'day', interval '0 hours'), pg_temp.at(:'day', interval '24 hours'))) as e;
reset role;
select pg_temp.check_ap(
  exists (select 1 from ap_sched s, ap_manual m where s.e->>'id' = m.r->>'appointment_id'
            and s.e->>'customer_name' = 'Zé da Padaria' and s.e->>'customer_nickname' = 'Zé'
            and (s.e->>'has_account')::boolean = false and (s.e->>'booked_by_team')::boolean = true),
  'Agenda mostra nome e apelido do cliente do balcão e que foi marcado pela equipe');
select pg_temp.check_ap(
  exists (select 1 from ap_sched s, ap_account m where s.e->>'id' = m.r->>'appointment_id'
            and s.e->>'customer_name' = 'Cliente Cadastrado' and s.e->>'customer_nickname' = 'Alemão'
            and (s.e->>'has_account')::boolean = true and (s.e->>'customer_recurring')::boolean = true),
  'Agenda mostra o apelido e o selo de cliente recorrente da conta');
select pg_temp.check_ap(
  exists (select 1 from ap_sched s, ap_ctx c
          where (s.e->>'starts_at')::timestamptz = pg_temp.at(c.day, interval '13 hours')
            and s.e->>'customer_id' is null and s.e->>'has_account' is null),
  'Atendimento de conta excluída não aparece como "sem cadastro"');

select pg_temp.as_user(:'colleague_id');
set local role authenticated;
select pg_temp.check_ap(
  (select s.e->>'visibility' = 'busy' and s.e->>'customer_name' is null
     and s.e->>'customer_nickname' is null and s.e->>'shop_client_id' is null
   from jsonb_array_elements(public.get_team_schedule(:'shop_id',
     pg_temp.at(:'day', interval '0 hours'), pg_temp.at(:'day', interval '24 hours'))) s(e), ap_manual m
   where s.e->>'id' = m.r->>'appointment_id'),
  'Colega sem visão geral vê só "ocupado", sem nome nem apelido');
select pg_temp.check_ap(
  (select count(*) from public.shop_clients) = 0,
  'Colega não lê fichas de clientes que não atende');
reset role;

-- ---------------------------------------------------------------------------------------------
-- Apelido, correção da ficha e ficha do balcão
-- ---------------------------------------------------------------------------------------------
select pg_temp.as_user(:'employee_id');
set local role authenticated;
select pg_temp.check_ap(
  public.set_client_nickname(:'shop_id', :'cust_id', null, '  Alemão   do Corte  ') = 'Alemão do Corte',
  'Profissional que atende o cliente muda o apelido (espaços limpos)');
select pg_temp.check_ap(
  (select count(*) from public.shop_clients) = 2,
  'Profissional lê as fichas dos clientes da própria agenda');
reset role;
select pg_temp.as_user(:'colleague_id');
set local role authenticated;
select pg_temp.expect_ap_error(
  format('select public.set_client_nickname(%L, %L, null, %L)', :'shop_id', :'cust_id', 'Outro'),
  'Colega que nunca atendeu não muda o apelido', '42501');
select pg_temp.expect_ap_error(
  format('select public.get_shop_client(%L, %L)', :'shop_id', (select r->>'shop_client_id' from ap_manual)),
  'Colega não abre a ficha de quem não atende', '42501');
reset role;
select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.check_ap(
  (public.get_shop_client(:'shop_id', (select (r->>'shop_client_id')::uuid from ap_manual))->>'whatsapp') = :'manual_phone'
  and jsonb_array_length(public.get_shop_client(:'shop_id', (select (r->>'shop_client_id')::uuid from ap_manual))->'history') = 2,
  'Ficha do balcão traz o WhatsApp e os dois horários');
select pg_temp.check_ap(
  (public.update_shop_client(:'shop_id', (select (r->>'shop_client_id')::uuid from ap_manual),
     'José da Padaria', null, true)->>'name') = 'José da Padaria',
  'Dono corrige o nome do cliente do balcão');
select pg_temp.expect_ap_error(
  format('select public.update_shop_client(%L, %L, null, %L, null)', :'shop_id',
    (select r->>'shop_client_id' from ap_manual), :'employee_manual_phone'),
  'WhatsApp de outro cliente do balcão é recusado', '23505');
select pg_temp.expect_ap_error(
  format('select public.update_shop_client(%L, %L, null, %L, null)', :'shop_id',
    (select r->>'shop_client_id' from ap_manual), :'cust_phone'),
  'WhatsApp confirmado de cliente com conta não vira ficha do balcão', '23505');
select pg_temp.check_ap(
  (public.get_client_profile(:'shop_id', :'cust_id')->>'nickname') = 'Alemão do Corte'
  and (public.get_client_profile(:'shop_id', :'cust_id')->>'recurring')::boolean = true,
  'Ficha do cliente com conta traz apelido e recorrência');
reset role;

select pg_temp.as_user(:'colleague_id');
set local role authenticated;
select pg_temp.check_ap(
  (select f->>'kind' = 'manual' and f->>'name' = 'José da Padaria' and f->>'nickname' is null
     and (f->>'limited')::boolean
   from (select public.find_shop_client(:'shop_id', :'manual_phone') as f) x)
  and (select f->>'kind' = 'account' and f->>'name' = 'Cliente Cadastrado' and f->>'nickname' is null
     and (f->>'recurring')::boolean = false and (f->>'limited')::boolean
   from (select public.find_shop_client(:'shop_id', :'cust_phone') as f) x),
  'Colega acha o cliente pelo número (com o nome), sem apelido nem recorrência de quem não atende');
create temporary table ap_colleague as
select public.book_for_client(
  :'shop_id', :'colleague_staff', :'corte', pg_temp.at(:'day', interval '9 hours'),
  null, (select (r->>'shop_client_id')::uuid from ap_manual), 'Nome Trocado', null, '', false) as r;
reset role;
select pg_temp.check_ap(
  (select full_name = 'José da Padaria' and nickname = 'Zé' and notify_whatsapp
   from public.shop_clients where id = (select (r->>'shop_client_id')::uuid from ap_manual))
  and (select (r->>'kind') = 'manual' from ap_colleague),
  'Colega marca o cliente de outro profissional sem renomear, apagar o apelido nem desligar avisos');
select pg_temp.as_user(:'colleague_id');
set local role authenticated;
select pg_temp.check_ap(
  (public.find_shop_client(:'shop_id', :'manual_phone')->>'nickname') = 'Zé'
  and not (public.find_shop_client(:'shop_id', :'manual_phone')->>'limited')::boolean,
  'Depois de marcar, o cliente está na agenda do colega e o apelido aparece');
reset role;

-- Exclusão de conta com apelido na barbearia (o registro sai junto; nada trava).
select pg_temp.as_user(:'owner_id');
set local role authenticated;
select public.set_client_nickname(:'shop_id', :'quiet_id', null, 'Quietinho');
reset role;
select pg_temp.as_user(:'quiet_id');
set local role authenticated;
select pg_temp.check_ap(
  (public.delete_my_account()->>'ok')::boolean,
  'Cliente com apelido na barbearia consegue excluir a conta');
reset role;
select pg_temp.check_ap(
  not exists (select 1 from public.shop_clients sc, ap_ctx c where sc.profile_id = c.quiet_id)
  and not exists (select 1 from public.profiles p, ap_ctx c where p.id = c.quiet_id),
  'O apelido sai junto com a conta');

-- ---------------------------------------------------------------------------------------------
-- Lembrete do cliente do balcão
-- ---------------------------------------------------------------------------------------------
select pg_temp.as_user(:'owner_id');
set local role authenticated;
create temporary table ap_reminder as
select public.book_for_client(
  :'shop_id', :'colleague_staff', :'corte', date_trunc('hour', now() + interval '23 hours'),
  null, (select (r->>'shop_client_id')::uuid from ap_manual), null, null, null, null) as r;
reset role;
select public.process_whatsapp_reminders();
select pg_temp.check_ap(
  exists (select 1 from public.whatsapp_outbox o, ap_reminder m, ap_ctx c
          where o.template_key = 'booking.reminder' and o.to_e164 = c.manual_phone
            and o.payload->>'appointment_id' = m.r->>'appointment_id'),
  'Cliente do balcão recebe o lembrete como os demais');

-- ---------------------------------------------------------------------------------------------
-- Cadastro e WhatsApp confirmado: a ficha do balcão passa para a conta
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claim.role', 'service_role', true);
select public.apply_verified_whatsapp(:'newcomer_id', :'manual_phone', true);
select set_config('request.jwt.claim.role', '', true);
select pg_temp.check_ap(
  (select profile_id from public.shop_clients sc, ap_ctx c
   where sc.barbershop_id = c.shop_id and sc.id = (select (r->>'shop_client_id')::uuid from ap_manual)) = :'newcomer_id'
  and not exists (select 1 from public.appointments a, ap_manual m
                  where a.shop_client_id = (m.r->>'shop_client_id')::uuid and a.customer_id is null),
  'Confirmar o WhatsApp liga a ficha e os horários à conta nova');
select pg_temp.check_ap(
  exists (select 1 from public.memberships m, ap_ctx c
          where m.user_id = c.newcomer_id and m.barbershop_id = c.shop_id and m.role = 'customer'),
  'A barbearia aparece no app do cliente recém-cadastrado');
select pg_temp.check_ap(
  (select nickname from public.shop_clients sc
   where sc.id = (select (r->>'shop_client_id')::uuid from ap_manual)) = 'Zé',
  'O apelido que a equipe usava continua');

-- Ficha da conta já existente na loja: as duas viram uma só.
insert into public.shop_clients(barbershop_id, full_name, whatsapp_e164, created_by)
select shop_id, 'Cliente Cadastrado antigo', '+5511990001212', owner_id from ap_ctx;
insert into public.appointments(barbershop_id, customer_id, shop_client_id, service_id, staff_id,
  starts_at, ends_at, status)
select c.shop_id, null, sc.id, c.corte, c.owner_staff, pg_temp.at(c.day, interval '20 hours'),
  pg_temp.at(c.day, interval '20 hours 30 minutes'), 'confirmed'
from ap_ctx c join public.shop_clients sc on sc.whatsapp_e164 = '+5511990001212';
select set_config('request.jwt.claim.role', 'service_role', true);
update public.profiles p set whatsapp_e164 = null, whatsapp_verified_at = null from ap_ctx c where p.id = c.cust_id;
select public.apply_verified_whatsapp(:'cust_id', '+5511990001212', true);
select set_config('request.jwt.claim.role', '', true);
select pg_temp.check_ap(
  (select count(*) from public.shop_clients sc, ap_ctx c
   where sc.barbershop_id = c.shop_id and sc.profile_id = c.cust_id) = 1
  and not exists (select 1 from public.shop_clients where whatsapp_e164 = '+5511990001212' and profile_id is null)
  and exists (select 1 from public.appointments a, ap_ctx c
              where a.customer_id = c.cust_id and a.starts_at = pg_temp.at(c.day, interval '20 hours')),
  'Conta que já tinha ficha na loja junta as duas sem perder horários');
select pg_temp.check_ap(
  (select nickname from public.shop_clients sc, ap_ctx c
   where sc.barbershop_id = c.shop_id and sc.profile_id = c.cust_id) = 'Alemão do Corte',
  'Na junção o apelido escolhido pela equipe vence');

-- Conta de outra loja marcada pelo número vira cliente do balcão; ao entrar nesta barbearia
-- pelo app (WhatsApp já confirmado), a ficha passa para a conta.
select pg_temp.as_user(:'owner_id');
set local role authenticated;
create temporary table ap_join as
select public.book_for_client(
  :'shop_id', :'owner_staff', :'corte', pg_temp.at(:'day', interval '15 hours'),
  null, null, 'Visitante do Balcão', :'stranger_phone', null, null) as r;
reset role;
select pg_temp.check_ap(
  (select r->>'kind' = 'manual' from ap_join),
  'Conta que não é desta loja, marcada pelo número, vira cliente do balcão');
insert into public.memberships(user_id, barbershop_id, role)
select stranger_id, shop_id, 'customer'::public.app_role from ap_ctx;
select pg_temp.check_ap(
  (select profile_id from public.shop_clients
   where id = (select (r->>'shop_client_id')::uuid from ap_join)) = :'stranger_id'
  and exists (select 1 from public.appointments a, ap_join j, ap_ctx c
              where a.id = (j.r->>'appointment_id')::uuid and a.customer_id = c.stranger_id),
  'Ao entrar na barbearia pelo app, a ficha do balcão com o WhatsApp confirmado passa para a conta');

-- Horários para a equipe: sem a antecedência mínima do cliente; prazo da agenda só para quem
-- não vê a loja inteira.
update public.barbershop_settings set min_lead_minutes = 1440 where barbershop_id = :'shop_id';
select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.check_ap(
  exists (select 1 from public.get_team_slots(:'shop_id', :'owner_staff', :'corte',
            (now() at time zone 'America/Sao_Paulo')::date + 1) x
          where x.starts_at = pg_temp.at((now() at time zone 'America/Sao_Paulo')::date + 1, interval '0 hours'))
  and not exists (select 1 from public.get_available_slots(:'shop_id', :'corte',
            (now() at time zone 'America/Sao_Paulo')::date + 1, :'owner_staff') x
          where x.starts_at = pg_temp.at((now() at time zone 'America/Sao_Paulo')::date + 1, interval '0 hours')),
  'Equipe vê o horário que a antecedência mínima esconde do cliente');
select pg_temp.check_ap(
  exists (select 1 from public.get_team_slots(:'shop_id', :'owner_staff', :'corte',
            (now() at time zone 'America/Sao_Paulo')::date + 20)),
  'Quem vê a loja inteira marca além do prazo da agenda');
reset role;
select pg_temp.as_user(:'employee_id');
set local role authenticated;
select pg_temp.check_ap(
  not exists (select 1 from public.get_team_slots(:'shop_id', :'employee_staff', :'corte',
            (now() at time zone 'America/Sao_Paulo')::date + 20))
  and exists (select 1 from public.get_team_slots(:'shop_id', :'employee_staff', :'corte',
            (now() at time zone 'America/Sao_Paulo')::date + 1)),
  'Contratado marca dentro do prazo da agenda');
select pg_temp.expect_ap_error(
  format('select * from public.get_team_slots(%L, %L, %L, %L)', :'shop_id', :'colleague_staff',
    :'corte', (now() at time zone 'America/Sao_Paulo')::date + 1),
  'Contratado não consulta a agenda do colega', '42501');
reset role;

-- ---------------------------------------------------------------------------------------------
-- Colunas protegidas: só as funções do banco gravam a ficha do balcão e quem marcou
-- ---------------------------------------------------------------------------------------------
select (r->>'shop_client_id') as ze_id from ap_manual \gset
select (r->>'appointment_id') as acc_appt from ap_account \gset
select pg_temp.as_user(:'employee_id');
set local role authenticated;
select pg_temp.expect_ap_error(
  format('update public.appointments set shop_client_id = %L where id = %L', :'ze_id', :'acc_appt'),
  'Profissional não aponta o próprio atendimento para a ficha de outro pela API', '42501');
select pg_temp.expect_ap_error(
  format('update public.appointments set booked_by = %L where id = %L', :'employee_id', :'acc_appt'),
  'Ninguém muda "quem marcou" pela API', '42501');
reset role;
select pg_temp.as_user(:'cust_id');
set local role authenticated;
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at,
  booked_by, shop_client_id)
select shop_id, cust_id, corte, colleague_staff, pg_temp.at(day, interval '16 hours'),
  pg_temp.at(day, interval '16 hours 30 minutes'), employee_id, null from ap_ctx;
reset role;
select pg_temp.check_ap(
  exists (select 1 from public.appointments a, ap_ctx c
          where a.customer_id = c.cust_id and a.staff_id = c.colleague_staff
            and a.starts_at = pg_temp.at(c.day, interval '16 hours') and a.booked_by is null),
  'Cliente que marca pela API não se diz "marcado pela equipe"');

-- Ficha de outra barbearia não entra num atendimento desta (chave composta).
insert into public.shop_clients(barbershop_id, full_name, whatsapp_e164)
select other_shop, 'Cliente da Outra Loja', '+5511990008888' from ap_ctx;
select sc.id as other_client from public.shop_clients sc, ap_ctx c
where sc.barbershop_id = c.other_shop and sc.whatsapp_e164 = '+5511990008888' \gset
select pg_temp.expect_ap_error(
  format('update public.appointments set shop_client_id = %L where id = %L', :'other_client', :'acc_appt'),
  'Ficha de outra barbearia é recusada pela chave do banco', '23503');

-- Indicadores e listas contam e nomeiam o cliente do balcão.
select pg_temp.as_user(:'owner_id');
set local role authenticated;
select pg_temp.check_ap(
  (public.get_business_insights(:'shop_id', pg_temp.at(:'day', interval '0 hours'),
     pg_temp.at(:'day', interval '24 hours'))->>'customers')::int
  = (select count(distinct coalesce(a.customer_id, a.shop_client_id)) from public.appointments a, ap_ctx c
     where a.barbershop_id = c.shop_id and a.starts_at >= pg_temp.at(c.day, interval '0 hours')
       and a.starts_at < pg_temp.at(c.day, interval '24 hours'))
  and (public.get_business_insights(:'shop_id', pg_temp.at(:'day', interval '0 hours'),
     pg_temp.at(:'day', interval '24 hours'))->>'customers')::int
  > (select count(distinct a.customer_id) from public.appointments a, ap_ctx c
     where a.barbershop_id = c.shop_id and a.starts_at >= pg_temp.at(c.day, interval '0 hours')
       and a.starts_at < pg_temp.at(c.day, interval '24 hours')),
  'Indicadores da loja contam cada cliente do balcão como cliente');
select pg_temp.check_ap(
  exists (select 1 from jsonb_array_elements(public.list_departure_appointments(:'shop_id', :'employee_staff')) e
          where e->>'customer_name' = 'Cliente do Contratado'),
  'Saída da equipe mostra o nome do cliente do balcão');
reset role;
select pg_temp.as_user(:'employee_id');
set local role authenticated;
select pg_temp.check_ap(
  (public.get_professional_insights(:'shop_id', pg_temp.at(:'day', interval '0 hours'),
     pg_temp.at(:'day', interval '24 hours'))->'own'->>'customers')::int
  = (select count(distinct coalesce(a.customer_id, a.shop_client_id)) from public.appointments a, ap_ctx c
     where a.barbershop_id = c.shop_id and a.staff_id = c.employee_staff
       and a.starts_at >= pg_temp.at(c.day, interval '0 hours')
       and a.starts_at < pg_temp.at(c.day, interval '24 hours')),
  'Números do profissional contam o cliente do balcão');
reset role;

-- ---------------------------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------------------------
select pg_temp.check_ap(
  not has_function_privilege('anon', 'public.book_for_client(uuid, uuid, uuid, timestamptz, uuid, uuid, text, text, text, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.find_shop_client(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.find_shop_client(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.link_shop_clients_to_profile(uuid, text, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_team_slots(uuid, uuid, uuid, date)', 'execute')
  and has_function_privilege('authenticated', 'public.get_team_slots(uuid, uuid, uuid, date)', 'execute')
  and not has_function_privilege('authenticated', 'public.apply_verified_whatsapp(uuid, text, boolean)', 'execute')
  and not has_table_privilege('anon', 'public.shop_clients', 'select')
  and not has_table_privilege('authenticated', 'public.shop_clients', 'insert'),
  'Funções da equipe só para quem entrou; ligação e confirmação só no servidor');
