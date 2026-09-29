-- Regressão: cópia dos agendamentos para a Agenda Google (fila, escopos e permissões).
-- Rode depois de 20260929130000_google_calendar_push.sql, numa transação; sempre ROLLBACK.
create temporary table gpush_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() owner_id, gen_random_uuid() associate_id,
  gen_random_uuid() customer_id, gen_random_uuid() owner_staff, gen_random_uuid() associate_staff,
  gen_random_uuid() service_id, gen_random_uuid() appt_id,
  ((current_date + 2)::timestamp + interval '10 hours') at time zone 'America/Sao_Paulo' as starts_at;
grant select on gpush_ctx to authenticated, service_role;

create function pg_temp.check_gpush(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_gpush_error(statement text, expected text, label text)
returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; exception when others then get stacked diagnostics actual = returned_sqlstate; end;
  perform pg_temp.check_gpush(actual = expected, label);
end $$;

insert into public.barbershops(id, name, slug)
select shop_id, 'Google push test', 'gpush-' || shop_id from gpush_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{"full_name":"Cliente Teste"}'::jsonb
from gpush_ctx c cross join lateral unnest(array[c.owner_id, c.associate_id, c.customer_id]) u;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono', owner_id, 'dono' from gpush_ctx union all
select associate_staff, shop_id, 'Associado', associate_id, 'associado' from gpush_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select service_id, shop_id, 'Corte', 30, 5000 from gpush_ctx;
insert into public.memberships(user_id, barbershop_id, role)
select customer_id, shop_id, 'customer' from gpush_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from gpush_ctx union all
select shop_id, associate_id, associate_staff, 'associate'::public.shop_member_role, null from gpush_ctx;
insert into public.google_connections(user_id, access_token, selected_calendar_id, selected_calendar_name)
select owner_id, 'x', 'dono@agenda', 'Agenda do dono' from gpush_ctx union all
select associate_id, 'x', 'assoc@agenda', 'Agenda do associado' from gpush_ctx;

select set_config('request.jwt.claim.sub', customer_id::text, true) from gpush_ctx;
set local role authenticated;
insert into public.appointments(id, barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at)
select appt_id, shop_id, customer_id, service_id, associate_staff, starts_at, starts_at + interval '30 minutes'
from gpush_ctx;
reset role;

select pg_temp.check_gpush(
  not exists (select 1 from public.google_calendar_pushes p join gpush_ctx c on p.appointment_id = c.appt_id),
  'Com a cópia desligada, nenhum agendamento entra na fila');

select set_config('request.jwt.claim.sub', associate_id::text, true) from gpush_ctx;
set local role authenticated;
select public.set_google_calendar_push('mine');
select pg_temp.expect_gpush_error($q$select public.set_google_calendar_push('shop')$q$, '42501',
  'Associado não pode copiar a barbearia inteira');
select pg_temp.expect_gpush_error($q$select * from public.google_calendar_pushes$q$, '42501',
  'Usuário comum não lê a fila diretamente');
select pg_temp.check_gpush(
  (public.get_my_google_connection() ->> 'push_scope') = 'mine'
  and (public.get_my_google_connection() ->> 'push_pending')::int = 1,
  'Status mostra a opção escolhida e o envio pendente');
reset role;

select pg_temp.check_gpush(
  exists (select 1 from public.google_calendar_pushes p join gpush_ctx c
          on p.appointment_id = c.appt_id and p.user_id = c.associate_id
          where p.op = 'upsert' and p.status = 'pending'),
  'Ligar "meus atendimentos" coloca o horário futuro na fila');

select set_config('request.jwt.claim.sub', owner_id::text, true) from gpush_ctx;
set local role authenticated;
select public.set_google_calendar_push('mine');
reset role;
select pg_temp.check_gpush(
  not exists (select 1 from public.google_calendar_pushes p join gpush_ctx c
              on p.appointment_id = c.appt_id and p.user_id = c.owner_id),
  'Dono em "meus atendimentos" não recebe horário de outro profissional');

select set_config('request.jwt.claim.sub', owner_id::text, true) from gpush_ctx;
set local role authenticated;
select public.set_google_calendar_push('shop');
reset role;
select pg_temp.check_gpush(
  exists (select 1 from public.google_calendar_pushes p join gpush_ctx c
          on p.appointment_id = c.appt_id and p.user_id = c.owner_id
          where p.op = 'upsert' and p.status = 'pending'),
  'Dono em "toda a barbearia" recebe o horário do associado');

set local role service_role;
select pg_temp.check_gpush(
  (select count(*) from public.claim_google_calendar_pushes(100) p
   join gpush_ctx c on p.appointment_id = c.appt_id where p.status = 'sending') = 2,
  'O envio reserva os itens pendentes');
select public.complete_google_calendar_push(p.id, true, p.user_id::text, 'ev1', null)
from public.google_calendar_pushes p join gpush_ctx c on p.appointment_id = c.appt_id;
reset role;
select pg_temp.check_gpush(
  (select count(*) from public.google_calendar_pushes p join gpush_ctx c
   on p.appointment_id = c.appt_id where p.status = 'done' and p.google_event_id = 'ev1') = 2,
  'Envio concluído guarda o evento criado');

update public.appointments a set status = 'cancelled' from gpush_ctx c where a.id = c.appt_id;
select pg_temp.check_gpush(
  (select count(*) from public.google_calendar_pushes p join gpush_ctx c
   on p.appointment_id = c.appt_id where p.op = 'delete' and p.status = 'pending') = 2,
  'Cancelar o horário pede a retirada do evento das duas agendas');

select set_config('request.jwt.claim.sub', associate_id::text, true) from gpush_ctx;
set local role authenticated;
select public.set_google_calendar_push('off');
reset role;
select pg_temp.check_gpush(
  (select push_scope from public.google_connections g join gpush_ctx c on g.user_id = c.associate_id) = 'off',
  'Desligar a cópia é salvo');
