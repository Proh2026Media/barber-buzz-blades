-- Papéis atuais da equipe nas funções do banco, fuso da loja rápido e lista de pedidos da
-- sociedade (13/10/2026). Achados dos testes reais na Loja Teste: P-56, P-57 e P-58.
--
-- P-58. Várias funções e políticas só aceitavam o vínculo antigo `memberships.role =
-- 'shop_admin'`. Quem entrou pela equipe (`shop_members`: Dono/sócio, Parceiro, Contratado)
-- recebia "Not allowed" na Agenda (presença, cancelar, espera, ocorrências), nos números e nos
-- horários livres. Regra nova, num lugar só (funções auxiliares abaixo), seguindo a matriz de
-- permissões (`shop_permission_granted`), sem tirar nada do `shop_admin` antigo:
--   * shop_is_team(loja)        — admin da plataforma, `shop_admin` antigo ou qualquer membro
--                                 ativo da equipe;
--   * shop_can_see_booking(loja)— cliente da loja ou equipe (horários livres, termos, espera);
--   * shop_can_act_on_appointment(loja, profissional) — visão geral da agenda (`can_view_full_shop`:
--                                 admin, `shop_admin` ou `view_agenda_all`) ou o próprio atendimento;
--   * shop_can_view_reports(loja) — admin, `shop_admin`, `view_reports_global`,
--                                 `view_financial_all` ou `view_reports_anonymized` (números
--                                 agregados, sem identificar ninguém).
-- Funções recriadas a partir da versão em produção em 13/10/2026 (conferida com
-- pg_get_functiondef), trocando só a conferência de papel.
--
-- P-56. `shop_tz` validava o fuso varrendo `pg_timezone_names` (~0,4 s por chamada) e era
-- chamada várias vezes por profissional e dia: a página pública da Loja Teste levava ~4,4 s
-- só no banco. O fuso já é validado na gravação (gatilhos `barbershops_timezone_guard_*` com
-- `is_valid_shop_timezone`); aqui basta conferir o formato e se o Postgres aceita o nome.
--
-- P-57. `list_pending_shop_changes` estava marcada STABLE mas expira pedidos com UPDATE: o
-- Postgres recusava sempre (0A000). Passa a VOLATILE, com o mesmo corpo.

-- ---------------------------------------------------------------------------
-- Funções auxiliares (regra única)
-- ---------------------------------------------------------------------------
-- Nunca devolvem NULL: as funções que as usam recusam com `if not …`, e NULL deixaria passar.

create or replace function public.shop_is_team(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.uid() is not null and p_shop_id is not null and (
    public.is_platform_admin()
    or public.has_shop_role(p_shop_id, array['shop_admin']::public.app_role[])
    or public.has_shop_member_role(
      p_shop_id, array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
    )
  ), false)
$$;

create or replace function public.shop_can_see_booking(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.uid() is not null and p_shop_id is not null and (
    public.has_shop_role(p_shop_id, array['customer']::public.app_role[])
    or public.shop_is_team(p_shop_id)
  ), false)
$$;

create or replace function public.shop_can_act_on_appointment(p_shop_id uuid, p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.uid() is not null and p_shop_id is not null and (
    public.can_view_full_shop(p_shop_id)
    or (p_staff_id is not null and p_staff_id = public.current_staff_id(p_shop_id))
  ), false)
$$;

create or replace function public.shop_can_view_reports(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.uid() is not null and p_shop_id is not null and (
    public.is_platform_admin()
    or public.has_shop_role(p_shop_id, array['shop_admin']::public.app_role[])
    or public.shop_permission_granted(p_shop_id, 'view_reports_global')
    or public.shop_permission_granted(p_shop_id, 'view_financial_all')
    or public.shop_permission_granted(p_shop_id, 'view_reports_anonymized')
  ), false)
$$;

-- ---------------------------------------------------------------------------
-- P-56. Fuso da loja sem varrer pg_timezone_names
-- ---------------------------------------------------------------------------

create or replace function public.shop_tz(p_shop_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  select b.timezone into v_tz from public.barbershops b where b.id = p_shop_id;
  if v_tz is null or length(v_tz) > 64 or v_tz !~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)*$' then
    return 'America/Sao_Paulo';
  end if;
  begin
    perform now() at time zone v_tz;
  exception when others then
    return 'America/Sao_Paulo';
  end;
  return v_tz;
end;
$$;

-- ---------------------------------------------------------------------------
-- P-57. Lista de pedidos da sociedade (expira no caminho de leitura: VOLATILE)
-- ---------------------------------------------------------------------------

create or replace function public.list_pending_shop_changes(p_shop_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  if not (
    public.is_platform_admin()
    or public.has_shop_member_role(p_shop_id, array['owner','partner']::public.shop_member_role[])
    or public.is_account_manager_of(p_shop_id)
  ) then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  -- Expira no caminho de leitura.
  update public.shop_change_requests
    set status = 'expired', decided_at = now()
  where barbershop_id = p_shop_id
    and status = 'pending'
    and expires_at is not null
    and expires_at < now();

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'kind', r.kind,
      'payload', r.payload,
      'source', r.source,
      'checklist', r.checklist,
      'expires_at', r.expires_at,
      'created_at', r.created_at,
      'requested_by', r.requested_by,
      'status', r.status
    ) order by r.created_at desc)
    from public.shop_change_requests r
    where r.barbershop_id = p_shop_id
      and r.status = 'pending'
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- P-58. Agenda: cancelar, presença, ocorrências, pesquisa presencial, retirar confirmação
-- ---------------------------------------------------------------------------

create or replace function public.cancel_appointment(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare a appointments; origin text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_reason is not null and p_reason not in ('unexpected','schedule','plans','price','transport','service','other') then raise exception 'Invalid reason'; end if;
  select * into a from appointments where id=p_id for update;
  if a.id is null or a.status not in ('pending','confirmed','reschedule_requested') then raise exception 'Appointment cannot be cancelled'; end if;
  if a.customer_id=auth.uid() then origin := 'customer';
  elsif public.shop_can_act_on_appointment(a.barbershop_id, a.staff_id) then origin := 'shop';
  else raise exception 'Not allowed'; end if;
  -- Reserva confirmada cujo horário já começou fica para a loja registrar (concluído ou falta).
  -- Pendente e remarcação pedida pela loja seguem canceláveis, como na tela do cliente.
  if origin = 'customer' and a.status = 'confirmed' and a.starts_at <= now() then
    raise exception 'Appointment already started' using errcode = '22023',
      hint = 'O horário já passou; fale com a barbearia.';
  end if;
  update appointments set status='cancelled' where id=a.id;
  insert into appointment_cancellations(appointment_id,reason,source,recorded_by)
  values(a.id,p_reason,origin,auth.uid());
end $$;

create or replace function public.get_appointment_attendance(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a appointments;
begin
  select * into a from appointments where id = p_id;
  if a.id is null or auth.uid() is null or not (
    a.customer_id = auth.uid() or public.shop_can_act_on_appointment(a.barbershop_id, a.staff_id)
  ) then raise exception 'Not allowed'; end if;
  return coalesce((select to_jsonb(f) from appointment_facts f where appointment_id = a.id), '{}'::jsonb);
end $$;

-- Cancelamentos da loja: visão geral recebe todos; os demais, só os dos próprios atendimentos.
create or replace function public.get_appointment_cancellations(p_shop_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_full boolean; v_mine uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_shop_id is null then
    return coalesce((select jsonb_agg(jsonb_build_object('appointment_id',c.appointment_id,'reason',c.reason,'source',c.source,'recorded_at',c.recorded_at)) from appointment_cancellations c join appointments a on a.id=c.appointment_id where a.customer_id=auth.uid()),'[]'::jsonb);
  end if;
  if not public.shop_is_team(p_shop_id) then raise exception 'Not allowed'; end if;
  v_full := public.can_view_full_shop(p_shop_id);
  v_mine := public.current_staff_id(p_shop_id);
  return coalesce((select jsonb_agg(jsonb_build_object('appointment_id',c.appointment_id,'reason',c.reason,'source',c.source,'recorded_at',c.recorded_at))
    from appointment_cancellations c join appointments a on a.id=c.appointment_id
    where a.barbershop_id=p_shop_id and (v_full or (v_mine is not null and a.staff_id = v_mine))),'[]'::jsonb);
end $$;

create or replace function public.record_attendance(p_appointment_id uuid, p_stage text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare a appointments; v_tz text;
begin
  select * into a from appointments where id = p_appointment_id for update;
  if a.id is null or not public.shop_can_act_on_appointment(a.barbershop_id, a.staff_id) then raise exception 'Not allowed'; end if;
  if a.status not in ('pending','confirmed') then raise exception 'Appointment is not active'; end if;
  v_tz := public.shop_tz(a.barbershop_id);
  if p_stage in ('arrived','started') and (a.starts_at at time zone v_tz)::date <> (now() at time zone v_tz)::date then raise exception 'Attendance must be recorded on the appointment day'; end if;
  if p_stage not in ('arrived','started','no_show') then raise exception 'Invalid stage'; end if;
  if p_stage = 'no_show' and now() < a.ends_at then raise exception 'Wait until the scheduled end'; end if;
  insert into appointment_facts(appointment_id) values(a.id) on conflict do nothing;
  if p_stage = 'arrived' then
    update appointment_facts set arrived_at = coalesce(arrived_at, now()), recorded_by = auth.uid() where appointment_id = a.id;
  elsif p_stage = 'started' then
    if not exists(select 1 from appointment_facts where appointment_id = a.id and arrived_at is not null) then raise exception 'Record arrival first'; end if;
    update appointment_facts set started_at = coalesce(started_at, now()), recorded_by = auth.uid() where appointment_id = a.id;
  else
    if exists(select 1 from appointment_facts where appointment_id = a.id and arrived_at is not null) then raise exception 'Customer already arrived'; end if;
    update appointment_facts set no_show_at = now(), recorded_by = auth.uid() where appointment_id = a.id;
    update appointments set status = 'cancelled' where id = a.id;
  end if;
end $$;

create or replace function public.save_appointment_occurrence(p_id uuid, p_customer_delay integer, p_shop_delay integer, p_no_show boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare a appointments; f appointment_facts;
begin
  select * into a from appointments where id=p_id for update;
  if auth.uid() is null or a.id is null or not public.shop_can_act_on_appointment(a.barbershop_id, a.staff_id) then raise exception 'Not allowed'; end if;
  if now()<a.starts_at or a.status not in ('pending','confirmed','completed') then raise exception 'Invalid appointment state'; end if;
  if (p_customer_delay is not null and p_customer_delay not between 1 and 1440) or (p_shop_delay is not null and p_shop_delay not between 1 and 1440) then raise exception 'Invalid delay'; end if;
  select * into f from appointment_facts where appointment_id=p_id;
  if f.no_show_at is not null then raise exception 'No show already recorded'; end if;
  if p_no_show then
    if now()<a.ends_at or a.status not in ('pending','confirmed') or p_customer_delay is not null or p_shop_delay is not null or f.customer_delay_minutes is not null or f.shop_delay_minutes is not null or f.arrived_at is not null or f.started_at is not null then raise exception 'Invalid no show'; end if;
  end if;
  insert into appointment_facts(appointment_id,customer_delay_minutes,shop_delay_minutes,no_show_at,occurrence_updated_at,occurrence_recorded_by)
  values(p_id,p_customer_delay,p_shop_delay,case when p_no_show then now() end,now(),auth.uid())
  on conflict(appointment_id) do update set
    customer_delay_minutes=excluded.customer_delay_minutes,shop_delay_minutes=excluded.shop_delay_minutes,
    no_show_at=excluded.no_show_at,occurrence_updated_at=excluded.occurrence_updated_at,occurrence_recorded_by=excluded.occurrence_recorded_by;
  if p_no_show then update appointments set status='cancelled' where id=p_id; end if;
end $$;

create or replace function public.record_customer_survey_response(p_appointment_id uuid, p_question text, p_answer text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare a appointments; allowed text[]; response_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into a from appointments where id=p_appointment_id for update;
  if a.id is null or not public.shop_can_act_on_appointment(a.barbershop_id, a.staff_id) then raise exception 'Not allowed'; end if;
  if a.status<>'completed' or a.ends_at>now() then raise exception 'Completed appointment required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(a.customer_id::text,11));
  if not coalesce((select surveys from customer_privacy where user_id=a.customer_id),false) then raise exception 'Customer surveys disabled'; end if;
  if exists(select 1 from customer_privacy where user_id=a.customer_id and last_survey_at>now()-interval '30 days')
    or exists(select 1 from customer_surveys where user_id=a.customer_id and shown_at>now()-interval '30 days') then raise exception 'Survey cooldown active'; end if;
  allowed:=case p_question
    when 'satisfaction' then array['1','2','3','4','5','skip']
    when 'improvement' then array['result','punctuality','service','comfort','booking','none','other','skip']
    when 'period' then array['morning','afternoon','evening','varies','skip']
    when 'professional' then array['same','available','by_service','no_preference','skip']
    when 'frequency' then array['up_to_15','16_to_30','31_to_60','over_60','undefined','skip']
    when 'conversation' then array['talk','quiet','decide_on_day','no_preference','skip']
    when 'service_interest' then array['eyebrow','facial','hydration','coloring','manicure','massage','none','other','skip'] end;
  if allowed is null or not(p_answer=any(allowed)) then raise exception 'Invalid response'; end if;
  insert into customer_surveys(user_id,question,answer,state,shown_at,answered_at,source,appointment_id,appointment_starts_at,recorded_by)
  values(a.customer_id,p_question,p_answer,'answered',now(),now(),'shop_staff',a.id,a.starts_at,auth.uid()) returning id into response_id;
  update customer_privacy set last_survey_at=now() where user_id=a.customer_id;
  return response_id;
exception when unique_violation then raise exception 'Response already recorded';
end $$;

create or replace function public.withdraw_appointment_confirmation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare a appointments; s barbershop_settings; t timestamptz;
begin
 select * into a from appointments where id=p_id for update;
 if auth.uid() is null or a.id is null or not public.shop_can_act_on_appointment(a.barbershop_id, a.staff_id) then raise exception 'Not allowed' using errcode='42501'; end if;
 select * into s from barbershop_settings where barbershop_id=a.barbershop_id for update;
 perform 1 from staff where id=a.staff_id for update;
 t:=clock_timestamp();
 if a.status<>'confirmed' then raise exception 'Appointment not confirmed'; end if;
 update appointments set status='reschedule_requested' where id=p_id;
 if s.waiting_enabled and a.starts_at>=t+make_interval(mins=>s.waiting_cutoff_minutes+15) then
  insert into slot_waits(barbershop_id,appointment_id,staff_id,starts_at,ends_at,hold_until,claim_until)
  values(a.barbershop_id,a.id,a.staff_id,a.starts_at,a.ends_at,t+interval '10 minutes',t+interval '15 minutes');
 end if;
end $$;

-- ---------------------------------------------------------------------------
-- P-58. Espera (estado, ações e ajuste)
-- ---------------------------------------------------------------------------

-- Visão de equipe por linha: quem tem a visão geral vê todas as esperas; o profissional, as
-- da própria agenda (as dos colegas chegam como para um cliente).
create or replace function public.get_waiting_state(p_shop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_full boolean; v_mine uuid; t timestamptz; result jsonb;
begin
 if auth.uid() is null or not public.shop_can_see_booking(p_shop_id) then raise exception 'Not allowed' using errcode='42501'; end if;
 perform process_slot_waits();
 t:=clock_timestamp();
 v_full := public.can_view_full_shop(p_shop_id);
 v_mine := public.current_staff_id(p_shop_id);
 select jsonb_build_object('server_now',t,'waits',coalesce(jsonb_agg(jsonb_build_object(
  'id',w.id,'appointment_id',case when v_full or w.staff_id = v_mine then w.appointment_id end,'staff_id',w.staff_id,
  'starts_at',w.starts_at,'ends_at',w.ends_at,'hold_until',w.hold_until,'claim_until',w.claim_until,
  'state',w.state,'mine',w.customer_id=auth.uid(),'has_interest',w.customer_id is not null,
  'service_id',case when w.customer_id=auth.uid() then w.service_id end,
  'restorable',coalesce(v_full or w.staff_id = v_mine, false) and w.restorable and w.hold_until>t
 )),'[]'::jsonb),'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb)
 from (select e.* from waiting_events e join slot_waits sw on sw.id=e.wait_id where e.user_id=auth.uid() and sw.barbershop_id=p_shop_id order by e.created_at desc limit 50) e)) into result
 from slot_waits w where w.barbershop_id=p_shop_id and w.state in ('holding','exclusive')
 and (w.hold_until>t or (w.customer_id is not null and w.claim_until>t))
 and (v_full or w.staff_id = v_mine or w.customer_id=auth.uid() or (w.customer_id is null and w.hold_until>t and not exists(select 1 from appointments a where a.id=w.appointment_id and a.customer_id=auth.uid())));
 return result;
end $$;

create or replace function public.waiting_action(p_id uuid, p_action text, p_service_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare w slot_waits; s services; a appointments; result uuid; t timestamptz; dur integer;
begin
 select * into w from slot_waits where id=p_id;
 if auth.uid() is null or w.id is null or not public.shop_can_see_booking(w.barbershop_id) then raise exception 'Not allowed' using errcode='42501'; end if;
 -- Use the same settings -> staff -> wait lock order as withdrawals.
 perform 1 from barbershop_settings where barbershop_id=w.barbershop_id for update;
 perform 1 from staff where id=w.staff_id for update;
 perform process_slot_waits();
 select * into w from slot_waits where id=p_id for update;
 t:=clock_timestamp();
 if w.state not in ('holding','exclusive') or w.starts_at<=t then raise exception 'A espera já foi encerrada.'; end if;
 if p_action='join' then
  if w.hold_until<=t or w.customer_id is not null then raise exception 'Outro cliente já entrou ou o prazo terminou.'; end if;
  if exists(select 1 from appointments where id=w.appointment_id and customer_id=auth.uid()) then raise exception 'Você já é o titular desta reserva.'; end if;
  select * into s from services where id=p_service_id and barbershop_id=w.barbershop_id and active;
  select x.duration_minutes into dur from staff_service_terms(w.staff_id, s.id) x;
  if s.id is null or dur is null or dur*interval '1 minute'>w.ends_at-w.starts_at
   or not exists(select 1 from staff where id=w.staff_id and active) then raise exception 'Serviço indisponível para este intervalo.'; end if;
  update slot_waits set customer_id=auth.uid(),service_id=s.id where id=w.id;
 elsif p_action='leave' then
  if w.customer_id is distinct from auth.uid() then raise exception 'Not allowed' using errcode='42501'; end if;
  perform emit_waiting_event(w,'left');
  if w.hold_until>t then update slot_waits set customer_id=null,service_id=null where id=w.id;
  else update slot_waits set state='released' where id=w.id; end if;
 elsif p_action='restore' then
  if not public.shop_can_act_on_appointment(w.barbershop_id, w.staff_id) then raise exception 'Not allowed' using errcode='42501'; end if;
  select * into a from appointments where id=w.appointment_id for update;
  if not w.restorable or w.hold_until<=t or a.status<>'reschedule_requested' or a.starts_at<>w.starts_at or a.staff_id<>w.staff_id then raise exception 'A reserva original não pode mais ser restaurada.'; end if;
  update slot_waits set state='restored' where id=w.id;
  update appointments set status='confirmed' where id=a.id;
  perform emit_waiting_event(w,'restored');
 elsif p_action='claim' then
  if w.customer_id is distinct from auth.uid() then raise exception 'Not allowed' using errcode='42501'; end if;
  if w.hold_until>t or w.claim_until<=t then raise exception 'A vaga ainda não foi liberada ou o prazo terminou.'; end if;
  select * into s from services where id=w.service_id and active and barbershop_id=w.barbershop_id;
  select x.duration_minutes into dur from staff_service_terms(w.staff_id, s.id) x;
  if s.id is null or dur is null or dur*interval '1 minute'>w.ends_at-w.starts_at
   or not exists(select 1 from staff where id=w.staff_id and active) then raise exception 'Serviço ou profissional indisponível.'; end if;
  update slot_waits set state='claimed' where id=w.id;
  insert into appointments(barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at,status)
  values(w.barbershop_id,auth.uid(),s.id,w.staff_id,w.starts_at,w.starts_at+dur*interval '1 minute','confirmed') returning id into result;
  update slot_waits set claimed_appointment_id=result where id=w.id;
  perform emit_waiting_event(w,'claimed');
 else raise exception 'Invalid action'; end if;
 return result;
end $$;

-- Ligar/desligar a espera é ajuste de funcionamento: `shop_admin` antigo, quem tem
-- "Gerenciar funcionamento" na matriz, ou mudança já aprovada pela sociedade.
create or replace function public.guard_waiting_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare w slot_waits;
begin
 if tg_op='UPDATE' and (new.waiting_enabled is distinct from old.waiting_enabled or new.waiting_cutoff_minutes is distinct from old.waiting_cutoff_minutes) then
  if not (
    coalesce(current_setting('app.approved_shop_change', true), '') = 'on'
    or (auth.uid() is not null and (
      public.is_platform_admin()
      or public.has_shop_role(new.barbershop_id, array['shop_admin']::public.app_role[])
      or public.shop_can_manage_operations(new.barbershop_id)))
  ) then raise exception 'Not allowed' using errcode='42501'; end if;
  if old.waiting_enabled and not new.waiting_enabled then
   for w in select * from slot_waits where barbershop_id=new.barbershop_id and state in ('holding','exclusive') for update loop
    update slot_waits set state='disabled' where id=w.id;
    perform emit_waiting_event(w,'disabled');
   end loop;
  end if;
 end if;
 return new;
end $$;

-- ---------------------------------------------------------------------------
-- P-58. Horários livres e reserva (cliente da loja ou equipe)
-- ---------------------------------------------------------------------------

create or replace function public.get_available_slots(p_shop_id uuid, p_service_id uuid, p_date date, p_staff_id uuid default null)
returns table(staff_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null or not public.shop_can_see_booking(p_shop_id) then
    raise exception 'Not authorized to view availability' using errcode = '42501';
  end if;
  perform public.process_slot_waits();
  return query
  select s.id, x.starts_at, x.ends_at
  from public.staff s
  cross join lateral public.available_slots_internal(s.id, p_service_id, p_date) x
  where s.barbershop_id = p_shop_id and s.active and (p_staff_id is null or s.id = p_staff_id)
  order by x.starts_at, s.id;
end;
$$;

create or replace function public.get_booking_terms(p_shop_id uuid)
returns table(staff_id uuid, service_id uuid, duration_minutes integer, price_cents integer)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null or not public.shop_can_see_booking(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select st.id, sv.id, t.duration_minutes, t.price_cents
  from public.staff st
  join public.services sv on sv.barbershop_id = st.barbershop_id and sv.active
  cross join lateral public.staff_service_terms(st.id, sv.id) t
  where st.barbershop_id = p_shop_id and st.active;
end;
$$;

create or replace function public.get_staff_busy_intervals_without_waits(p_staff_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  shop_id uuid;
begin
  if p_starts_at is null or p_ends_at is null
     or not isfinite(p_starts_at) or not isfinite(p_ends_at)
     or p_ends_at <= p_starts_at
     or p_ends_at - p_starts_at > interval '2 days' then
    raise exception 'Invalid availability interval' using errcode = '22023';
  end if;

  select s.barbershop_id into shop_id
  from public.staff s
  join public.barbershops b on b.id = s.barbershop_id
  where s.id = p_staff_id and s.active and b.status = 'active';

  if auth.uid() is null or shop_id is null or not public.shop_can_see_booking(shop_id) then
    raise exception 'Not authorized to view availability' using errcode = '42501';
  end if;

  return query
  select occupied.starts_at, occupied.ends_at
  from (
    select a.starts_at, a.ends_at
    from public.appointments a
    where a.staff_id = p_staff_id
      and a.status in ('pending', 'confirmed', 'completed')
      and a.starts_at < p_ends_at and a.ends_at > p_starts_at
    union all
    select greatest(block.starts_at, p_starts_at), least(block.ends_at, p_ends_at)
    from public.availability_blocks block
    where block.barbershop_id = shop_id
      and (block.staff_id is null or block.staff_id = p_staff_id)
      and block.starts_at < p_ends_at and block.ends_at > p_starts_at
  ) occupied
  order by occupied.starts_at;
end;
$$;

create or replace function public.pick_available_staff(p_shop_id uuid, p_service_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_prefer_staff_id uuid default null)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  local_day date;
  chosen uuid;
begin
  if auth.uid() is null or not public.shop_can_see_booking(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  local_day := (p_starts_at at time zone public.shop_tz(p_shop_id))::date;

  if p_prefer_staff_id is not null
     and exists (select 1 from public.staff s where s.id = p_prefer_staff_id and s.barbershop_id = p_shop_id)
     and exists (
       select 1 from public.available_slots_internal(p_prefer_staff_id, p_service_id, local_day) x
       where x.starts_at = p_starts_at)
  then
    return p_prefer_staff_id;
  end if;

  select s.id into chosen
  from public.staff s
  where s.barbershop_id = p_shop_id and s.active
    and exists (
      select 1 from public.available_slots_internal(s.id, p_service_id, local_day) x
      where x.starts_at = p_starts_at)
  order by random()
  limit 1;
  return chosen;
end;
$$;

create or replace function public.create_booking_series(p_shop_id uuid, p_service_id uuid, p_staff_id uuid, p_starts_at timestamptz, p_kind text, p_interval_days integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  svc public.services%rowtype;
  st public.staff%rowtype;
  terms record;
  shop_tz text;
  local_time time;
  weekday smallint;
  series_id uuid;
  ends_at timestamptz;
  first_id uuid;
  created int;
  kind public.booking_series_kind;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not public.shop_can_see_booking(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_kind = 'weekday' then
    kind := 'weekday';
  elsif p_kind = 'interval_days' and p_interval_days in (7, 15, 21) then
    kind := 'interval_days';
  else
    raise exception 'Tipo de recorrência inválido' using errcode = '22023';
  end if;

  select * into svc from public.services where id = p_service_id and barbershop_id = p_shop_id and active;
  select * into st from public.staff where id = p_staff_id and barbershop_id = p_shop_id and active;
  if svc.id is null or st.id is null then
    raise exception 'Serviço ou profissional inválido' using errcode = '22023';
  end if;
  select t.duration_minutes, t.price_cents into terms
  from public.staff_service_terms(p_staff_id, p_service_id) t;
  if terms.duration_minutes is null then
    raise exception 'Este profissional não faz o serviço escolhido.' using errcode = '22023';
  end if;

  shop_tz := public.shop_tz(p_shop_id);
  local_time := (p_starts_at at time zone shop_tz)::time;
  weekday := extract(dow from (p_starts_at at time zone shop_tz))::smallint;
  ends_at := p_starts_at + make_interval(mins => terms.duration_minutes);

  insert into public.booking_series (
    barbershop_id, customer_id, service_id, staff_id,
    kind, weekday, interval_days, local_time, anchor_starts_at, created_by
  ) values (
    p_shop_id, auth.uid(), p_service_id, p_staff_id,
    kind,
    case when kind = 'weekday' then weekday else null end,
    case when kind = 'interval_days' then p_interval_days else null end,
    local_time, p_starts_at, 'customer'
  )
  returning id into series_id;

  -- Primeira ocorrência (pode falhar por sobreposição: aborta a série).
  begin
    insert into public.appointments (
      barbershop_id, customer_id, service_id, staff_id,
      starts_at, ends_at, status, booked_price_cents, series_id
    ) values (
      p_shop_id, auth.uid(), p_service_id, p_staff_id,
      p_starts_at, ends_at, 'confirmed', terms.price_cents, series_id
    )
    returning id into first_id;
  exception when others then
    delete from public.booking_series where id = series_id;
    raise;
  end;

  created := public.materialize_booking_series(series_id);

  return jsonb_build_object(
    'series_id', series_id,
    'first_appointment_id', first_id,
    'materialized', created
  );
end;
$$;

create or replace function public.create_direct_appointment(p_shop_slug text, p_staff_slug text, p_service_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved jsonb;
  sid uuid;
  staffid uuid;
  result uuid;
  terms record;
begin
  resolved := public.resolve_direct_booking_staff(p_shop_slug, p_staff_slug);
  sid := (resolved->>'shop_id')::uuid;
  staffid := (resolved->>'staff_id')::uuid;
  if not public.shop_can_see_booking(sid) then
    raise exception 'Cliente não vinculado a esta barbearia' using errcode = '42501';
  end if;
  select t.duration_minutes, t.price_cents into terms
  from public.staff_service_terms(staffid, p_service_id) t
  where exists (select 1 from public.services sv where sv.id = p_service_id and sv.barbershop_id = sid);
  if terms.duration_minutes is null then
    raise exception 'Serviço indisponível para este profissional' using errcode = '22023';
  end if;
  insert into public.appointments (
    barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status, booked_price_cents
  )
  values (sid, auth.uid(), p_service_id, staffid, p_starts_at,
          p_starts_at + make_interval(mins => terms.duration_minutes), 'pending', terms.price_cents)
  returning id into result;
  return result;
end;
$$;

create or replace function public.record_customer_usage(p_id uuid, p_shop_id uuid, p_event text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 11));
  if not coalesce((select analytics from customer_privacy where user_id = auth.uid()), false) then return; end if;
  if not public.shop_can_see_booking(p_shop_id) then raise exception 'Shop unavailable'; end if;
  insert into customer_usage_events(id, user_id, barbershop_id, event) values(p_id, auth.uid(), p_shop_id, p_event) on conflict (id) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- P-58. Números da loja
-- ---------------------------------------------------------------------------

create or replace function public.get_occurrence_insights(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not (public.is_platform_admin() or (p_shop_id is not null and public.shop_can_view_reports(p_shop_id))) then raise exception 'Not allowed'; end if;
  if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid period'; end if;
  return (select jsonb_build_object('customer_sample',count(f.customer_delay_minutes),'customer_mean',avg(f.customer_delay_minutes),'shop_sample',count(f.shop_delay_minutes),'shop_mean',avg(f.shop_delay_minutes))
    from appointments a join appointment_facts f on f.appointment_id=a.id
    where (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to);
end $$;

create or replace function public.get_service_interest_insights(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare sample bigint;
begin
  if auth.uid() is null or not(public.is_platform_admin() or(p_shop_id is not null and public.shop_can_view_reports(p_shop_id))) then raise exception 'Not allowed'; end if;
  if p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid period'; end if;
  select count(*) into sample from customer_surveys s join appointments a on a.id=s.appointment_id
  where s.question='service_interest' and s.state='answered' and s.answer not in('skip','none')
    and(p_shop_id is null or a.barbershop_id=p_shop_id)and s.answered_at>=p_from and s.answered_at<p_to;
  return jsonb_build_object(
    'sample',sample,
    'counts',case when sample>=5 then coalesce((select jsonb_object_agg(answer,total)from(
      select s.answer,count(*) total from customer_surveys s join appointments a on a.id=s.appointment_id
      where s.question='service_interest'and s.state='answered'and s.answer not in('skip','none')
        and(p_shop_id is null or a.barbershop_id=p_shop_id)and s.answered_at>=p_from and s.answered_at<p_to group by s.answer
    )interests),'{}'::jsonb)else '{}'::jsonb end
  );
end $$;

-- `get_business_insights` já aceitava `view_financial_all` além do `shop_admin`: fica como está.

-- ---------------------------------------------------------------------------
-- P-58. Políticas que só conheciam o `shop_admin`
-- ---------------------------------------------------------------------------

-- Nome do cliente nos atendimentos que a pessoa da equipe pode ver (visão geral ou os
-- próprios). Sem isto, os cancelados da Agenda chegavam sem nome para quem entrou pela equipe.
drop policy if exists "Team reads customers of visible appointments" on public.profiles;
create policy "Team reads customers of visible appointments"
on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.appointments a
    where a.customer_id = profiles.id
      and public.shop_can_act_on_appointment(a.barbershop_id, a.staff_id)
  )
);

-- Fontes da marca: mesma regra dos logos para a sociedade (dono/sócio).
drop policy if exists "Authorized admins upload barbershop fonts" on storage.objects;
create policy "Authorized admins upload barbershop fonts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'barbershop-fonts' and (
    public.is_platform_admin()
    or public.has_shop_role(((storage.foldername(name))[1])::uuid, array['shop_admin']::public.app_role[])
    or public.has_shop_member_role(((storage.foldername(name))[1])::uuid, array['owner', 'partner']::public.shop_member_role[])
  )
);
drop policy if exists "Authorized admins update barbershop fonts" on storage.objects;
create policy "Authorized admins update barbershop fonts"
on storage.objects for update to authenticated
using (
  bucket_id = 'barbershop-fonts' and (
    public.is_platform_admin()
    or public.has_shop_role(((storage.foldername(name))[1])::uuid, array['shop_admin']::public.app_role[])
    or public.has_shop_member_role(((storage.foldername(name))[1])::uuid, array['owner', 'partner']::public.shop_member_role[])
  )
)
with check (
  bucket_id = 'barbershop-fonts' and (
    public.is_platform_admin()
    or public.has_shop_role(((storage.foldername(name))[1])::uuid, array['shop_admin']::public.app_role[])
    or public.has_shop_member_role(((storage.foldername(name))[1])::uuid, array['owner', 'partner']::public.shop_member_role[])
  )
);
drop policy if exists "Authorized admins delete barbershop fonts" on storage.objects;
create policy "Authorized admins delete barbershop fonts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'barbershop-fonts' and (
    public.is_platform_admin()
    or public.has_shop_role(((storage.foldername(name))[1])::uuid, array['shop_admin']::public.app_role[])
    or public.has_shop_member_role(((storage.foldername(name))[1])::uuid, array['owner', 'partner']::public.shop_member_role[])
  )
);

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

revoke all on function public.shop_is_team(uuid) from public, anon;
revoke all on function public.shop_can_see_booking(uuid) from public, anon;
revoke all on function public.shop_can_act_on_appointment(uuid, uuid) from public, anon;
revoke all on function public.shop_can_view_reports(uuid) from public, anon;
grant execute on function public.shop_is_team(uuid) to authenticated;
grant execute on function public.shop_can_see_booking(uuid) to authenticated;
grant execute on function public.shop_can_act_on_appointment(uuid, uuid) to authenticated;
grant execute on function public.shop_can_view_reports(uuid) to authenticated;

notify pgrst, 'reload schema';
