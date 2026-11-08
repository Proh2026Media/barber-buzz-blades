-- P-70: pausa fixa da loja inteira entra na governança existente, inclusive a remoção.
-- Funções base: request_shop_change de 20261003150000; apply_shop_change de
-- 20261013210000; decide_shop_change de 20260924180000; materialize_block_rule de
-- 20261013220000. Os demais tipos de pedido conservam exatamente seus caminhos.
-- Pausas próprias continuam pela RLS anterior. A nova RPC é obrigatória para loja inteira.

create table if not exists public.shop_weekly_break_versions (
  barbershop_id uuid primary key references public.barbershops(id) on delete cascade,
  revision bigint not null default 0
);
alter table public.shop_weekly_break_versions enable row level security;
revoke all on public.shop_weekly_break_versions from public, anon, authenticated;
grant all on public.shop_weekly_break_versions to service_role;

create or replace function public.touch_weekly_break_version()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_shop uuid; v_previous_shop uuid; v_target uuid; v_changed boolean := true;
begin
  if tg_table_name = 'barbershops' then
    v_shop := new.id;
    v_changed := new.timezone is distinct from old.timezone;
  elsif tg_table_name = 'availability_block_rules' then
    if tg_op = 'DELETE' then v_shop := old.barbershop_id; v_changed := old.staff_id is null;
    elsif tg_op = 'INSERT' then v_shop := new.barbershop_id; v_changed := new.staff_id is null;
    else
      v_shop := new.barbershop_id;
      v_changed := (old.staff_id is null or new.staff_id is null) and
        (new.barbershop_id, new.staff_id, new.weekdays, new.start_time, new.end_time, new.reason)
        is distinct from (old.barbershop_id, old.staff_id, old.weekdays, old.start_time, old.end_time, old.reason);
    end if;
  else
    v_shop := case when tg_op = 'DELETE' then old.barbershop_id else new.barbershop_id end;
  end if;
  if tg_op = 'UPDATE' and tg_table_name <> 'barbershops' then
    v_previous_shop := old.barbershop_id;
  end if;
  if v_changed then
    -- Mudança de loja pelo servidor invalida as duas sociedades. A ordem fixa evita
    -- inversão de bloqueios quando duas transferências acontecem ao mesmo tempo.
    for v_target in select distinct value from unnest(array[v_shop,v_previous_shop]) value
      where value is not null order by value loop
      if exists(select 1 from public.barbershops where id = v_target) then
        insert into public.shop_weekly_break_versions(barbershop_id, revision) values(v_target, 1)
        on conflict(barbershop_id) do update set revision = shop_weekly_break_versions.revision + 1;
      end if;
    end loop;
  end if;
  return null;
end $$;

drop trigger if exists weekly_break_rule_version on public.availability_block_rules;
create trigger weekly_break_rule_version after insert or update or delete on public.availability_block_rules
  for each row execute function public.touch_weekly_break_version();
drop trigger if exists weekly_break_society_version on public.shop_members;
create trigger weekly_break_society_version after insert or update or delete on public.shop_members
  for each row execute function public.touch_weekly_break_version();
drop trigger if exists weekly_break_permissions_version on public.shop_role_permissions;
create trigger weekly_break_permissions_version after insert or update or delete on public.shop_role_permissions
  for each row execute function public.touch_weekly_break_version();
drop trigger if exists weekly_break_timezone_version on public.barbershops;
create trigger weekly_break_timezone_version after update of timezone on public.barbershops
  for each row execute function public.touch_weekly_break_version();

-- Admin antigo só decide sozinho enquanto não existe sociedade ativa. Um papel legado
-- adicional nunca pode contornar os donos e a aprovação 50%/50%.
create or replace function public.weekly_break_legacy_admin(p_shop_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_shop_role(p_shop_id, array['shop_admin']::public.app_role[])
    and not exists(select 1 from public.shop_members where barbershop_id = p_shop_id
      and active and role in ('owner','partner'))
$$;

-- Acumular participação societária não elimina a aprovação obrigatória do gerente.
create or replace function public.weekly_break_account_manager(p_shop_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.account_manager_shops a
    join public.memberships m on m.user_id=a.user_id and m.role='account_manager'
    where a.barbershop_id=p_shop_id and a.user_id=p_user_id)
    and not exists(select 1 from public.memberships where user_id=p_user_id and role='platform_admin')
$$;

create or replace function public.get_weekly_break_governance(p_shop_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not (
    public.is_platform_admin() or public.weekly_break_legacy_admin(p_shop_id)
    or (public.has_shop_member_role(p_shop_id, array['owner','partner']::public.shop_member_role[])
      and public.shop_can_manage_operations(p_shop_id))
  ) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists(select 1 from public.barbershops where id = p_shop_id) then
    raise exception 'Barbearia não encontrada' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'version', coalesce((select revision from public.shop_weekly_break_versions where barbershop_id = p_shop_id), 0)::text,
    'requires_approval', public.weekly_break_account_manager(p_shop_id,auth.uid())
      or not (public.can_apply_protected_change(p_shop_id) or public.weekly_break_legacy_admin(p_shop_id)),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'payload',payload) order by created_at)
      from public.shop_change_requests where barbershop_id=p_shop_id and status='pending'
        and kind in ('weekly_break.create','weekly_break.delete')), '[]'::jsonb)
  );
end $$;

-- Serializa pedidos, decisões e alterações relevantes usando uma única versão por loja.
create or replace function public.lock_weekly_break_version(p_shop_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_revision bigint;
begin
  insert into public.shop_weekly_break_versions(barbershop_id) values(p_shop_id) on conflict do nothing;
  select revision into v_revision from public.shop_weekly_break_versions
    where barbershop_id = p_shop_id for update;
  return v_revision;
end $$;

create or replace function public.assert_weekly_break_version(p_shop_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_payload->>'version' is distinct from public.lock_weekly_break_version(p_shop_id)::text
     or (p_payload->>'account_manager')::boolean is distinct from
       public.weekly_break_account_manager(p_shop_id,(p_payload->>'requested_by')::uuid) then
    raise exception 'weekly_break_conflict' using errcode = '40001';
  end if;
end $$;

create or replace function public.apply_weekly_break_change(p_shop_id uuid, p_kind text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_weekly_break_version(p_shop_id, p_payload);
  if p_kind = 'weekly_break.create' then
    insert into public.availability_block_rules(id, barbershop_id, staff_id, weekdays, start_time, end_time, reason, created_by)
    values((p_payload->>'id')::uuid, p_shop_id, null,
      array(select value::smallint from jsonb_array_elements_text(p_payload->'weekdays')),
      (p_payload->>'start_time')::time, (p_payload->>'end_time')::time,
      nullif(p_payload->>'reason',''), (p_payload->>'requested_by')::uuid);
  elsif p_kind = 'weekly_break.delete' then
    delete from public.availability_block_rules
      where id = (p_payload->>'id')::uuid and barbershop_id = p_shop_id and staff_id is null;
    if not found then raise exception 'weekly_break_conflict' using errcode = '40001'; end if;
  else raise exception 'Invalid action' using errcode = '22023'; end if;
end $$;

create or replace function public.request_weekly_break_change(p_shop_id uuid, p_action text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_state jsonb;
  v_version bigint;
  v_kind text;
  v_operation uuid;
  v_input jsonb;
  v_payload jsonb;
  v_existing public.shop_change_requests;
  v_rule public.availability_block_rules;
  v_days smallint[];
  v_start time;
  v_end time;
  v_reason text;
  v_id uuid;
  v_request uuid;
  v_direct boolean;
  v_manager boolean;
begin
  -- Mesmo controle para a RPC nova e para chamadas diretas de request_shop_change.
  v_state := public.get_weekly_break_governance(p_shop_id);
  if p_action not in ('create','delete') or p_action is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid action' using errcode = '22023';
  end if;
  v_kind := 'weekly_break.' || p_action;
  v_operation := (p_payload->>'operation_id')::uuid;
  if v_operation is null then raise exception 'Operation required' using errcode = '22023'; end if;
  if p_payload->>'staff_id' is not null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_action = 'create' then
    if jsonb_typeof(p_payload->'weekdays') is distinct from 'array' then
      raise exception 'Dias inválidos' using errcode = '22023';
    end if;
    select array_agg(distinct value::smallint order by value::smallint) into v_days
      from jsonb_array_elements_text(p_payload->'weekdays');
    v_start := (p_payload->>'start_time')::time;
    v_end := (p_payload->>'end_time')::time;
    v_reason := nullif(btrim(p_payload->>'reason'), '');
    if v_days is null or cardinality(v_days) not between 1 and 7
       or not v_days <@ array[0,1,2,3,4,5,6]::smallint[]
       or v_start is null or v_end is null or v_end <= v_start
       or coalesce(char_length(v_reason),0) > 120 then
      raise exception 'Pausa inválida' using errcode = '22023';
    end if;
    v_input := jsonb_build_object('weekdays',v_days,'start_time',v_start,'end_time',v_end,'reason',v_reason);
  else
    v_id := (p_payload->>'id')::uuid;
    if v_id is null then raise exception 'Pausa inválida' using errcode = '22023'; end if;
    v_input := jsonb_build_object('id',v_id);
  end if;
  v_version := public.lock_weekly_break_version(p_shop_id);
  select * into v_existing from public.shop_change_requests
    where barbershop_id = p_shop_id and requested_by = auth.uid()
      and kind in ('weekly_break.create','weekly_break.delete')
      and payload->>'operation_id' = v_operation::text;
  if found then
    if v_existing.kind <> v_kind or v_existing.payload->'input' is distinct from v_input then
      raise exception 'weekly_break_operation_changed' using errcode = '22023';
    end if;
    return jsonb_build_object('status',case when v_existing.status = 'approved' then 'applied' else v_existing.status::text end,
      'request_id',v_existing.id);
  end if;
  if p_payload->>'version' is distinct from v_version::text then
    raise exception 'weekly_break_conflict' using errcode = '40001';
  end if;
  if p_action = 'create' then
    -- Reenvio com outra chave ou outro dono não cria a mesma pausa duas vezes.
    select * into v_rule from public.availability_block_rules
      where barbershop_id = p_shop_id and staff_id is null and weekdays @> v_days and weekdays <@ v_days
        and start_time = v_start and end_time = v_end;
    if found then return jsonb_build_object('status','unchanged','id',v_rule.id); end if;
    select * into v_existing from public.shop_change_requests where barbershop_id = p_shop_id
      and kind = v_kind and status = 'pending' and payload->>'version' = v_version::text
      and payload->'weekdays' = to_jsonb(v_days) and payload->>'start_time' = v_start::text
      and payload->>'end_time' = v_end::text;
    if found then return jsonb_build_object('status','pending','request_id',v_existing.id); end if;
    v_payload := v_input || jsonb_build_object('id',gen_random_uuid());
  else
    select * into v_rule from public.availability_block_rules
      where id = v_id and barbershop_id = p_shop_id and staff_id is null;
    if not found then raise exception 'weekly_break_conflict' using errcode = '40001'; end if;
    select * into v_existing from public.shop_change_requests where barbershop_id = p_shop_id
      and kind = v_kind and status = 'pending' and payload->>'version' = v_version::text
      and payload->>'id' = v_id::text;
    if found then return jsonb_build_object('status','pending','request_id',v_existing.id); end if;
    v_payload := jsonb_build_object('id',v_rule.id,'weekdays',v_rule.weekdays,
      'start_time',v_rule.start_time,'end_time',v_rule.end_time,'reason',v_rule.reason);
  end if;
  v_payload := v_payload || jsonb_build_object('version',v_version::text,'input',v_input,
    'operation_id',v_operation,'requested_by',auth.uid(),
    'account_manager',public.weekly_break_account_manager(p_shop_id,auth.uid()));
  v_manager := public.weekly_break_account_manager(p_shop_id,auth.uid());
  v_direct := not v_manager and (public.can_apply_protected_change(p_shop_id) or public.weekly_break_legacy_admin(p_shop_id));
  if v_direct then
    perform public.apply_shop_change(p_shop_id, v_kind, v_payload);
    insert into public.shop_change_requests(barbershop_id,requested_by,kind,payload,status,source,checklist,decided_at,applied_at,approved_by)
      values(p_shop_id,auth.uid(),v_kind,v_payload,'approved','majority_log',
        jsonb_build_array(jsonb_build_object('kind',v_kind)),now(),now(),auth.uid()) returning id into v_request;
    return jsonb_build_object('status','applied','request_id',v_request);
  end if;
  if not v_manager and public.shop_governance_mode(p_shop_id) not in ('equal','majority') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.shop_change_requests(barbershop_id,requested_by,kind,payload,source,expires_at,checklist)
    values(p_shop_id,auth.uid(),v_kind,v_payload,case when v_manager then 'account_manager' else 'society' end,
      case when v_manager then now()+interval '30 minutes' end,jsonb_build_array(jsonb_build_object('kind',v_kind)))
    returning id into v_request;
  return jsonb_build_object('status','pending','request_id',v_request);
end $$;

create unique index if not exists shop_weekly_break_operation_idx
  on public.shop_change_requests(barbershop_id,requested_by,(payload->>'operation_id'))
  where kind in ('weekly_break.create','weekly_break.delete');

-- Escrita direta da regra só para agendas individuais. A loja toda passa pela RPC,
-- inclusive para admin e para usuário com shop_admin legado além do vínculo societário.
drop policy if exists "Professionals manage own block rules" on public.availability_block_rules;
create policy "Professionals manage own block rules" on public.availability_block_rules for all to authenticated
  using (staff_id is not null and staff_id = public.current_staff_id(barbershop_id)
    and public.shop_permission_granted(barbershop_id,'manage_own_blocks'))
  with check (staff_id is not null and staff_id = public.current_staff_id(barbershop_id)
    and public.shop_permission_granted(barbershop_id,'manage_own_blocks'));
drop policy if exists "Team managers manage block rules" on public.availability_block_rules;
create policy "Team managers manage block rules" on public.availability_block_rules for all to authenticated
  using (staff_id is not null and public.can_apply_protected_change(barbershop_id) and public.shop_can_manage_operations(barbershop_id))
  with check (staff_id is not null and public.can_apply_protected_change(barbershop_id) and public.shop_can_manage_operations(barbershop_id));
drop policy if exists "Admins manage block rules" on public.availability_block_rules;
create policy "Admins manage block rules" on public.availability_block_rules for all to authenticated
  using (staff_id is not null and (public.is_platform_admin() or public.weekly_break_legacy_admin(barbershop_id)))
  with check (staff_id is not null and (public.is_platform_admin() or public.weekly_break_legacy_admin(barbershop_id)));

create or replace function public.request_shop_change(
  p_shop_id uuid,
  p_kind text,
  p_payload jsonb,
  p_source text default 'society',
  p_ttl_minutes int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id uuid;
  mode text;
  ttl int;
  is_mgr boolean := false;
  checklist jsonb;
begin
  if p_kind in ('weekly_break.create','weekly_break.delete') then
    return public.request_weekly_break_change(p_shop_id, split_part(p_kind,'.',2), p_payload);
  end if;
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
$$;

CREATE OR REPLACE FUNCTION public.apply_shop_change(p_shop_id uuid, p_kind text, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_kind in ('weekly_break.create','weekly_break.delete') then
    perform public.apply_weekly_break_change(p_shop_id, p_kind, p_payload);
    return;
  end if;
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

create or replace function public.decide_shop_change(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  -- Recusar continua possível após conflito; aprovar exige a mesma loja/sociedade vista no pedido.
  if p_approve and req.kind in ('weekly_break.create','weekly_break.delete') then
    perform public.assert_weekly_break_version(req.barbershop_id, req.payload);
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
$$;

-- Impede duas extensões simultâneas de gerar o mesmo dia da regra.
create or replace function public.materialize_block_rule(p_rule_id uuid, p_horizon_days integer default 120)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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
  select * into r from public.availability_block_rules where id = p_rule_id for update;
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
$$;

revoke all on function public.touch_weekly_break_version(), public.weekly_break_legacy_admin(uuid),
  public.lock_weekly_break_version(uuid), public.assert_weekly_break_version(uuid,jsonb),
  public.weekly_break_account_manager(uuid,uuid),
  public.apply_weekly_break_change(uuid,text,jsonb), public.apply_shop_change(uuid,text,jsonb),
  public.materialize_block_rule(uuid,integer) from public, anon, authenticated;
grant execute on function public.weekly_break_legacy_admin(uuid) to authenticated;
grant execute on function public.apply_shop_change(uuid,text,jsonb), public.materialize_block_rule(uuid,integer) to service_role;
revoke all on function public.get_weekly_break_governance(uuid),
  public.request_weekly_break_change(uuid,text,jsonb), public.request_shop_change(uuid,text,jsonb,text,integer),
  public.decide_shop_change(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.get_weekly_break_governance(uuid),
  public.request_weekly_break_change(uuid,text,jsonb), public.request_shop_change(uuid,text,jsonb,text,integer),
  public.decide_shop_change(uuid,boolean,text) to authenticated;
notify pgrst, 'reload schema';
