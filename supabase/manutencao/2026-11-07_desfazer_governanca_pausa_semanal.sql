-- Reversão pontual P-70. Executar apenas se a nº 99 precisar ser retirada, com psql -1.
-- Restaura funções/políticas da base de 98 migrations; preserva regras de pausa e auditoria.
-- Pedidos semanais ainda pendentes são cancelados para não ficar uma ação impossível na fila.
-- Não restaura um dump sobre dados mais novos. Não executar como parte da instalação normal.
UPDATE public.shop_change_requests
SET status='cancelled', decided_at=now(), decision_note='P-70 retirada da operação; refaça o pedido após a correção.'
WHERE kind IN ('weekly_break.create','weekly_break.delete') AND status='pending';
DROP TRIGGER IF EXISTS weekly_break_rule_version ON public.availability_block_rules;
DROP TRIGGER IF EXISTS weekly_break_society_version ON public.shop_members;
DROP TRIGGER IF EXISTS weekly_break_permissions_version ON public.shop_role_permissions;
DROP TRIGGER IF EXISTS weekly_break_timezone_version ON public.barbershops;
CREATE OR REPLACE FUNCTION public.request_shop_change(p_shop_id uuid, p_kind text, p_payload jsonb, p_source text DEFAULT 'society'::text, p_ttl_minutes integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  request_id uuid;
  mode text;
  ttl int;
  is_mgr boolean := false;
  checklist jsonb;
begin
  -- p_source fica na assinatura por compatibilidade, mas é ignorado: 'account_manager' só
  -- para o gerente de conta e 'majority_log' só no registro automático abaixo.
  is_mgr := public.is_account_manager_of(p_shop_id);
  if not public.has_shop_member_role(p_shop_id, array['owner','partner']::public.shop_member_role[])
     and not public.is_platform_admin()
     and not is_mgr then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  mode := public.shop_governance_mode(p_shop_id);
  checklist := coalesce(p_payload->'checklist', jsonb_build_array(
    jsonb_build_object('kind', p_kind, 'summary', coalesce(p_payload->>'summary', p_kind))
  ));

  -- Gerente de conta sempre cria pedido com TTL 30 min.
  if is_mgr and not public.is_platform_admin() then
    ttl := coalesce(p_ttl_minutes, 30);
    insert into public.shop_change_requests(
      barbershop_id, requested_by, kind, payload, source, expires_at, checklist
    ) values (
      p_shop_id, auth.uid(), p_kind, p_payload, 'account_manager',
      now() + make_interval(mins => ttl), checklist
    ) returning id into request_id;
    return jsonb_build_object(
      'status', 'pending',
      'request_id', request_id,
      'expires_at', now() + make_interval(mins => ttl)
    );
  end if;

  if public.can_apply_protected_change(p_shop_id) then
    perform public.apply_shop_change(p_shop_id, p_kind, p_payload);
    -- Log checklist para majoritário (auditoria / popup).
    insert into public.shop_change_requests(
      barbershop_id, requested_by, kind, payload, status, source, checklist,
      decided_at, applied_at, approved_by
    ) values (
      p_shop_id, auth.uid(), p_kind, p_payload, 'approved', 'majority_log', checklist,
      now(), now(), auth.uid()
    );
    return jsonb_build_object('status', 'applied');
  end if;

  -- Minoria (majority mode) e igualitário: abrem pedido pendente.
  if mode not in ('equal', 'majority') then
    raise exception 'Somente o sócio majoritário pode realizar esta mudança' using errcode='42501';
  end if;

  ttl := p_ttl_minutes; -- sociedade sem TTL por padrão
  insert into public.shop_change_requests(
    barbershop_id, requested_by, kind, payload, source, expires_at, checklist
  ) values (
    p_shop_id, auth.uid(), p_kind, p_payload, 'society',
    case when ttl is null then null else now() + make_interval(mins => ttl) end,
    checklist
  ) returning id into request_id;

  return jsonb_build_object('status', 'pending', 'request_id', request_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_shop_change(p_shop_id uuid, p_kind text, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform set_config('app.approved_shop_change', 'on', true);
  case p_kind
    when 'service.create' then
      insert into public.services(
        barbershop_id, name, description, duration_minutes, price_cents, active, icon, prep_minutes
      ) values (
        p_shop_id,
        p_payload->>'name',
        nullif(p_payload->>'description', ''),
        (p_payload->>'duration_minutes')::int,
        (p_payload->>'price_cents')::int,
        coalesce((p_payload->>'active')::boolean, true),
        nullif(p_payload->>'icon', ''),
        nullif(p_payload->>'prep_minutes', '')::smallint
      );
    when 'service.update' then
      update public.services set
        name = coalesce(p_payload->>'name', name),
        description = case when p_payload ? 'description' then nullif(p_payload->>'description', '') else description end,
        duration_minutes = coalesce((p_payload->>'duration_minutes')::int, duration_minutes),
        price_cents = coalesce((p_payload->>'price_cents')::int, price_cents),
        active = coalesce((p_payload->>'active')::boolean, active),
        icon = case when p_payload ? 'icon' then nullif(p_payload->>'icon', '') else icon end,
        prep_minutes = case
          when p_payload ? 'prep_minutes' then nullif(p_payload->>'prep_minutes', '')::smallint
          else prep_minutes
        end
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'service.toggle' then
      update public.services set active = (p_payload->>'active')::boolean
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'service.delete' then
      delete from public.services where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.create' then
      insert into public.staff(
        barbershop_id, display_name, active, avatar_url, bio, booking_slug
      ) values (
        p_shop_id,
        p_payload->>'display_name',
        coalesce((p_payload->>'active')::boolean, true),
        nullif(p_payload->>'avatar_url', ''),
        nullif(p_payload->>'bio', ''),
        nullif(p_payload->>'booking_slug', '')
      );
    when 'staff.update' then
      update public.staff set
        display_name = coalesce(p_payload->>'display_name', display_name),
        active = coalesce((p_payload->>'active')::boolean, active),
        avatar_url = case when p_payload ? 'avatar_url' then nullif(p_payload->>'avatar_url', '') else avatar_url end,
        bio = case when p_payload ? 'bio' then nullif(p_payload->>'bio', '') else bio end,
        booking_slug = case when p_payload ? 'booking_slug' then nullif(p_payload->>'booking_slug', '') else booking_slug end
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.toggle' then
      update public.staff set active = (p_payload->>'active')::boolean
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'staff.delete' then
      delete from public.staff where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'hours.replace' then
      -- Mesmo formato que a tela envia: weekday, is_open, opens_at, closes_at.
      insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
      select
        p_shop_id,
        (h->>'weekday')::int,
        coalesce((h->>'is_open')::boolean, true),
        coalesce((h->>'opens_at')::time, '09:00'::time),
        coalesce((h->>'closes_at')::time, '19:00'::time)
      from jsonb_array_elements(coalesce(p_payload->'hours', '[]'::jsonb)) h
      on conflict (barbershop_id, weekday) do update
        set is_open = excluded.is_open,
            opens_at = excluded.opens_at,
            closes_at = excluded.closes_at,
            updated_at = now();
    when 'availability.create' then
      insert into public.availability_blocks(
        barbershop_id, staff_id, starts_at, ends_at, reason
      ) values (
        p_shop_id,
        nullif(p_payload->>'staff_id', '')::uuid,
        (p_payload->>'starts_at')::timestamptz,
        (p_payload->>'ends_at')::timestamptz,
        nullif(p_payload->>'reason', '')
      );
    when 'availability.delete' then
      delete from public.availability_blocks
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id;
    when 'settings.operational' then
      update public.barbershop_settings set
        booking_instructions = coalesce(p_payload->>'booking_instructions', booking_instructions),
        booking_horizon_days = coalesce((p_payload->>'booking_horizon_days')::int, booking_horizon_days),
        survey_program_enabled = coalesce(
          (p_payload->>'survey_program_enabled')::boolean,
          survey_program_enabled
        ),
        waiting_enabled = coalesce((p_payload->>'waiting_enabled')::boolean, waiting_enabled),
        waiting_cutoff_minutes = coalesce(
          (p_payload->>'waiting_cutoff_minutes')::int,
          waiting_cutoff_minutes
        ),
        staff_assignment_mode = coalesce(
          nullif(p_payload->>'staff_assignment_mode', ''),
          staff_assignment_mode
        ),
        slot_mode = coalesce(nullif(p_payload->>'slot_mode', ''), slot_mode),
        slot_step_minutes = coalesce((p_payload->>'slot_step_minutes')::smallint, slot_step_minutes),
        prep_minutes = coalesce((p_payload->>'prep_minutes')::smallint, prep_minutes),
        min_lead_minutes = coalesce((p_payload->>'min_lead_minutes')::smallint, min_lead_minutes)
      where barbershop_id = p_shop_id;
    when 'shop.timezone' then
      -- Fuso da barbearia (set_shop_timezone). Confere de novo: um pedido aprovado
      -- depois precisa continuar válido no momento de aplicar.
      if not public.is_valid_shop_timezone(p_payload->>'timezone') then
        raise exception 'Fuso horário inválido' using errcode = '22023';
      end if;
      update public.barbershops set timezone = p_payload->>'timezone'
      where id = p_shop_id;
    when 'member.add' then
      perform public.apply_add_shop_member(
        p_shop_id,
        (p_payload->>'user_id')::uuid,
        (p_payload->>'role')::public.shop_member_role,
        nullif(p_payload->>'ownership_percent', '')::numeric,
        nullif(p_payload->>'display_name', ''),
        nullif(p_payload->>'staff_id', '')::uuid
      );
    when 'member.update' then
      perform public.apply_update_shop_member(
        p_shop_id,
        (p_payload->>'id')::uuid,
        case when p_payload ? 'role' and nullif(p_payload->>'role', '') is not null
          then (p_payload->>'role')::public.shop_member_role
          else null end,
        case when p_payload ? 'ownership_percent'
          then nullif(p_payload->>'ownership_percent', '')::numeric
          else null end,
        case when p_payload ? 'active'
          then (p_payload->>'active')::boolean
          else null end
      );
    else
      raise exception 'Unsupported change kind: %', p_kind using errcode = '22023';
  end case;
end;
$function$;

CREATE OR REPLACE FUNCTION public.decide_shop_change(p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  req public.shop_change_requests;
  remaining int;
  result_status text;
  mode text;
begin
  select * into req from public.shop_change_requests where id = p_request_id for update;
  if req.id is null or req.status <> 'pending' then
    raise exception 'Pending request not found';
  end if;
  if req.expires_at is not null and req.expires_at < now() then
    update public.shop_change_requests
      set status = 'expired', decided_at = now()
      where id = req.id;
    return jsonb_build_object('status', 'expired');
  end if;
  if req.requested_by = auth.uid() then
    raise exception 'O solicitante não pode aprovar o próprio pedido' using errcode='42501';
  end if;
  if not public.has_shop_member_role(
    req.barbershop_id, array['owner','partner']::public.shop_member_role[]
  ) then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  mode := public.shop_governance_mode(req.barbershop_id);

  -- Pedidos do gerente: qualquer dono/co-dono com poder de aplicar (ou majoritário) aprova.
  if req.source = 'account_manager' then
    if not public.can_apply_protected_change(req.barbershop_id)
       and mode = 'equal' then
      -- igualitário: qualquer outro co-dono pode aprovar (um basta para AM)
      null;
    elsif not public.can_apply_protected_change(req.barbershop_id) and mode <> 'equal' then
      raise exception 'Somente o sócio majoritário pode aprovar' using errcode='42501';
    end if;
  elsif mode = 'equal' then
    null; -- peer approve
  elsif mode = 'majority' then
    if not public.can_apply_protected_change(req.barbershop_id) then
      raise exception 'Somente o sócio majoritário pode aprovar' using errcode='42501';
    end if;
  else
    raise exception 'A sociedade não exige mais aprovação';
  end if;

  insert into public.shop_change_approvals(request_id, user_id, approved, note)
  values (req.id, auth.uid(), p_approve, nullif(trim(p_note), ''))
  on conflict (request_id, user_id) do update
    set approved = excluded.approved, note = excluded.note, decided_at = now();

  if not p_approve then
    update public.shop_change_requests
      set status = 'rejected', approved_by = auth.uid(),
          decision_note = nullif(trim(p_note), ''), decided_at = now()
      where id = req.id;
    return jsonb_build_object('status', 'rejected');
  end if;

  if req.source = 'account_manager' or mode = 'majority' then
    remaining := 0;
  else
    select count(*) into remaining from public.shop_members sm
    where sm.barbershop_id = req.barbershop_id and sm.active and sm.role in ('owner','partner')
      and sm.user_id <> req.requested_by
      and not exists (
        select 1 from public.shop_change_approvals a
        where a.request_id = req.id and a.user_id = sm.user_id and a.approved
      );
  end if;

  if remaining > 0 then
    return jsonb_build_object('status', 'pending', 'remaining_approvals', remaining);
  end if;

  perform public.apply_shop_change(req.barbershop_id, req.kind, req.payload);
  result_status := 'approved';
  update public.shop_change_requests
    set status = 'approved', approved_by = auth.uid(),
        decision_note = nullif(trim(p_note), ''), decided_at = now(), applied_at = now()
    where id = req.id;
  return jsonb_build_object('status', result_status, 'remaining_approvals', 0);
end;
$function$;

CREATE OR REPLACE FUNCTION public.materialize_block_rule(p_rule_id uuid, p_horizon_days integer DEFAULT 120)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.availability_block_rules;
  tz text;
  today date;
  from_day date;
  to_day date;
  d date;
  starts timestamptz;
  ends timestamptz;
  created integer := 0;
  previous text := current_setting('app.approved_shop_change', true);
begin
  select * into r from public.availability_block_rules where id = p_rule_id;
  if not found then return 0; end if;

  tz := public.shop_tz(r.barbershop_id);
  today := (now() at time zone tz)::date;
  from_day := greatest(coalesce(r.materialized_until + 1, today), today);
  to_day := today + greatest(coalesce(p_horizon_days, 120), 1);
  if from_day > to_day then return 0; end if;

  -- Bloqueio gerado pela regra já autorizada: não passa de novo pela governança.
  perform set_config('app.approved_shop_change', 'on', true);
  for d in select generate_series(from_day, to_day, interval '1 day')::date loop
    if extract(dow from d)::smallint = any (r.weekdays) then
      starts := (d + r.start_time) at time zone tz;
      ends := (d + r.end_time) at time zone tz;
      if ends > now() and not exists (
        select 1 from public.availability_blocks b
        where b.rule_id = r.id and b.starts_at = starts
      ) then
        insert into public.availability_blocks (barbershop_id, staff_id, starts_at, ends_at, reason, rule_id)
        values (r.barbershop_id, r.staff_id, starts, ends, r.reason, r.id);
        created := created + 1;
      end if;
    end if;
  end loop;
  perform set_config('app.approved_shop_change', coalesce(previous, ''), true);

  update public.availability_block_rules set materialized_until = to_day where id = r.id;
  return created;
end;
$function$;

DROP POLICY IF EXISTS "Professionals manage own block rules" ON public.availability_block_rules;
CREATE POLICY "Professionals manage own block rules" ON public.availability_block_rules FOR ALL TO authenticated USING (((staff_id = current_staff_id(barbershop_id)) AND shop_permission_granted(barbershop_id, 'manage_own_blocks'::text))) WITH CHECK (((staff_id = current_staff_id(barbershop_id)) AND shop_permission_granted(barbershop_id, 'manage_own_blocks'::text)));

DROP POLICY IF EXISTS "Team managers manage block rules" ON public.availability_block_rules;
CREATE POLICY "Team managers manage block rules" ON public.availability_block_rules FOR ALL TO authenticated USING ((can_apply_protected_change(barbershop_id) AND shop_can_manage_operations(barbershop_id))) WITH CHECK ((can_apply_protected_change(barbershop_id) AND shop_can_manage_operations(barbershop_id)));

DROP POLICY IF EXISTS "Admins manage block rules" ON public.availability_block_rules;
CREATE POLICY "Admins manage block rules" ON public.availability_block_rules FOR ALL TO authenticated USING ((is_platform_admin() OR has_shop_role(barbershop_id, ARRAY['shop_admin'::app_role]))) WITH CHECK ((is_platform_admin() OR has_shop_role(barbershop_id, ARRAY['shop_admin'::app_role])));

DROP FUNCTION IF EXISTS public.request_weekly_break_change(uuid,text,jsonb);
DROP FUNCTION IF EXISTS public.get_weekly_break_governance(uuid);
DROP FUNCTION IF EXISTS public.apply_weekly_break_change(uuid,text,jsonb);
DROP FUNCTION IF EXISTS public.assert_weekly_break_version(uuid,jsonb);
DROP FUNCTION IF EXISTS public.lock_weekly_break_version(uuid);
DROP FUNCTION IF EXISTS public.touch_weekly_break_version();
DROP FUNCTION IF EXISTS public.weekly_break_legacy_admin(uuid);
DROP FUNCTION IF EXISTS public.weekly_break_account_manager(uuid,uuid);
DROP INDEX IF EXISTS public.shop_weekly_break_operation_idx;
DROP TABLE IF EXISTS public.shop_weekly_break_versions;
NOTIFY pgrst, 'reload schema';
