-- Regressão da auditoria de 03/10/2026 (20261003150000_correcoes_auditoria.sql).
-- Rode numa transação, depois da migration; sempre ROLLBACK.
create temporary table audit_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() owner_id, gen_random_uuid() assoc_id,
  gen_random_uuid() employee_id, gen_random_uuid() founder_id, gen_random_uuid() loose_id,
  gen_random_uuid() owner_staff, gen_random_uuid() assoc_staff, gen_random_uuid() employee_staff;
grant select on audit_ctx to authenticated;

create function pg_temp.check_audit(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_audit_error(statement text, label text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute statement; exception when others then failed := true; end;
  perform pg_temp.check_audit(failed, label);
end $$;

insert into public.barbershops(id, name, slug) select shop_id, 'Auditoria', 'audit-' || shop_id from audit_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{}'::jsonb
from audit_ctx c
cross join lateral unnest(array[c.owner_id, c.assoc_id, c.employee_id, c.founder_id, c.loose_id]) u;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug)
select owner_staff, shop_id, 'Dono', owner_id, 'dono' from audit_ctx union all
select assoc_staff, shop_id, 'Parceiro', assoc_id, 'parceiro' from audit_ctx union all
select employee_staff, shop_id, 'Contratado', employee_id, 'contratado' from audit_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, owner_staff, 'owner'::public.shop_member_role, 100 from audit_ctx union all
select shop_id, assoc_id, assoc_staff, 'associate'::public.shop_member_role, null from audit_ctx union all
select shop_id, employee_id, employee_staff, 'employee'::public.shop_member_role, null from audit_ctx;

-- 12. Cadastro sem loja nos metadados não cria vínculo de cliente.
select pg_temp.check_audit(
  not exists (
    select 1 from public.memberships m join audit_ctx c on m.user_id = c.loose_id
    where m.role = 'customer'),
  'Cadastro sem loja não vira cliente de outra barbearia');

-- 5. Domínio próprio: visitante e usuário comum não chamam as funções do servidor.
select pg_temp.check_audit(
  not has_function_privilege('anon', 'public.mark_shop_domain_status(uuid, public.shop_domain_status, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.mark_shop_domain_status(uuid, public.shop_domain_status, text)', 'execute')
  and not has_function_privilege('anon', 'public.list_active_custom_domains()', 'execute'),
  'Status e lista de domínios só pelo service role');

-- 2. Profissional comum abre a própria barbearia.
select set_config('request.jwt.claim.sub', founder_id::text, true) from audit_ctx;
set local role authenticated;
create temporary table audit_new_shop on commit drop as
select public.create_own_barbershop('Loja Própria Auditoria') as result;
reset role;
select pg_temp.check_audit(
  exists (
    select 1 from audit_new_shop n
    join public.shop_members sm on sm.barbershop_id = (n.result->>'shop_id')::uuid
    join audit_ctx c on sm.user_id = c.founder_id
    where sm.role = 'owner' and sm.active),
  'Usuário comum cria a própria barbearia como dono');
select pg_temp.check_audit(
  (select count(*) from public.business_hours h join audit_new_shop n
     on h.barbershop_id = (n.result->>'shop_id')::uuid) = 7,
  'Loja nova nasce com os 7 dias de horário');

-- 3. Contratado sai da barbearia abrindo mão da carteira.
select set_config('request.jwt.claim.sub', employee_id::text, true) from audit_ctx;
set local role authenticated;
select public.request_shop_departure(shop_id, 'forfeit'::public.shop_departure_mode, null) from audit_ctx;
reset role;
select pg_temp.check_audit(
  exists (
    select 1 from public.shop_members sm join audit_ctx c
      on sm.barbershop_id = c.shop_id and sm.user_id = c.employee_id
    where not sm.active)
  and exists (
    select 1 from public.staff s join audit_ctx c on s.id = c.employee_staff where not s.active),
  'Contratado consegue sair da barbearia');

-- 4. Parceiro exclui a própria conta.
select set_config('request.jwt.claim.sub', assoc_id::text, true) from audit_ctx;
set local role authenticated;
select public.delete_my_account();
reset role;
select pg_temp.check_audit(
  not exists (select 1 from auth.users u join audit_ctx c on u.id = c.assoc_id)
  and exists (
    select 1 from public.staff s join audit_ctx c on s.id = c.assoc_staff where s.user_id is null),
  'Profissional exclui a própria conta e o perfil da loja fica sem vínculo');

-- 6. Perfil: WhatsApp não muda por UPDATE direto e não repete entre contas.
select set_config('request.jwt.claim.sub', owner_id::text, true) from audit_ctx;
set local role authenticated;
select public.save_my_whatsapp('+5511987654321', true);
select pg_temp.expect_audit_error(
  $q$update public.profiles p set whatsapp_e164 = '+5511912345678' from audit_ctx c where p.id = c.owner_id$q$,
  'WhatsApp não muda por UPDATE direto no perfil');
reset role;
select set_config('request.jwt.claim.sub', founder_id::text, true) from audit_ctx;
set local role authenticated;
-- Antes da 20261003180000 a unicidade valia para qualquer número: a gravação é recusada.
-- Depois dela (e da 20261003220000), a gravação não revela nada: o número fica salvo
-- sem confirmação, e a recusa acontece só na confirmação por código.
do $$
declare failed boolean := false; verified_col boolean;
begin
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'whatsapp_verified_at')
    into verified_col;
  begin
    perform public.save_my_whatsapp('+5511987654321', true);
  exception when others then failed := true;
  end;
  if verified_col then
    perform pg_temp.check_audit(not failed, 'WhatsApp de outra conta gravado sem confirmação, sem revelar nada');
  else
    perform pg_temp.check_audit(failed, 'WhatsApp de outra conta é recusado');
  end if;
end $$;
reset role;

-- 1. Cliente não cancela reserva confirmada que já começou; pendente segue cancelável.
create temporary table audit_appts as
select gen_random_uuid() service_id, gen_random_uuid() past_confirmed, gen_random_uuid() past_pending;
grant select on audit_appts to authenticated;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select x.service_id, c.shop_id, 'Corte Auditoria', 30, 5000 from audit_appts x cross join audit_ctx c;
set local session_replication_role = replica;
insert into public.appointments(id, barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status)
select x.past_confirmed, c.shop_id, c.loose_id, x.service_id, c.owner_staff,
  now() - interval '1 hour', now() - interval '30 minutes', 'confirmed'::public.appointment_status
from audit_appts x cross join audit_ctx c
union all
select x.past_pending, c.shop_id, c.loose_id, x.service_id, c.owner_staff,
  now() - interval '2 hours', now() - interval '90 minutes', 'pending'::public.appointment_status
from audit_appts x cross join audit_ctx c;
set local session_replication_role = origin;
select set_config('request.jwt.claim.sub', loose_id::text, true) from audit_ctx;
set local role authenticated;
select pg_temp.expect_audit_error(
  $q$select public.cancel_appointment(past_confirmed, 'other') from audit_appts$q$,
  'Cliente não cancela reserva confirmada que já começou');
select public.cancel_appointment(past_pending, 'other') from audit_appts;
reset role;
select pg_temp.check_audit(
  (select a.status = 'confirmed' from public.appointments a join audit_appts x on a.id = x.past_confirmed)
  and (select a.status = 'cancelled' from public.appointments a join audit_appts x on a.id = x.past_pending),
  'Pendente vencida segue cancelável pelo cliente; confirmada fica para a loja');
