-- Nº 108 — P-120, somente local. Não libera criação, envio de códigos ou agendamento.
-- A presença de equipe aprovada deixa de ser compatível com grupo exclusivo.
update public.whatsapp_care_participants set revoked_at=coalesce(revoked_at,now());
update public.whatsapp_care_groups set controls_verified=false,version=version+1,
  state=case when state in ('closed','customer_left','creation_unknown') then state else 'paused_divergence' end,
  reason=case when reason='operator_pause' then reason else 'exclusive_review_required' end;
delete from public.whatsapp_care_invites;

-- Identidades antigas permanecem disponíveis somente para remoção confirmada/auditoria.
create or replace function public.care_group_member_valid(p_group uuid,p_user uuid) returns boolean
language sql stable security definer set search_path=public as $$ select false; $$;

create function public.care_group_no_staff() returns trigger language plpgsql set search_path=public as $$
begin
  if new.revoked_at is null then raise exception 'GROUP_PLATFORM_ONLY' using errcode='42501'; end if;
  return new;
end $$;
create trigger care_group_no_staff before insert or update on public.whatsapp_care_participants
for each row execute function public.care_group_no_staff();
revoke all on function public.care_group_no_staff() from public,anon,authenticated,service_role;

alter function public.care_group_read(uuid,uuid) rename to care_group_read_before_exclusive;
create function public.care_group_read(p_shop uuid,p_customer uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or coalesce(p_customer,auth.uid())<>auth.uid() then
    raise exception 'Sem permissão' using errcode='42501'; end if;
  return public.care_group_read_before_exclusive(p_shop,p_customer)||jsonb_build_object('participants','[]'::jsonb);
end $$;
revoke all on function public.care_group_read_before_exclusive(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.care_group_read(uuid,uuid) from public,anon;
grant execute on function public.care_group_read(uuid,uuid) to authenticated;

alter function public.care_group_admin(text,jsonb) rename to care_group_admin_before_exclusive;
create function public.care_group_admin(p_action text,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if p_action='propose_participant' then raise exception 'GROUP_PLATFORM_ONLY' using errcode='42501'; end if;
  return public.care_group_admin_before_exclusive(p_action,p_values)-'eligible_staff';
end $$;
revoke all on function public.care_group_admin_before_exclusive(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.care_group_admin(text,jsonb) from public,anon;
grant execute on function public.care_group_admin(text,jsonb) to authenticated;

alter function public.care_group_customer_update(uuid,bigint,text,jsonb) rename to care_group_customer_update_before_exclusive;
create function public.care_group_customer_update(p_group uuid,p_version bigint,p_action text,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if p_action in ('approve_participant','remove_participant') then raise exception 'GROUP_PLATFORM_ONLY' using errcode='42501'; end if;
  return public.care_group_customer_update_before_exclusive(p_group,p_version,p_action,p_values);
end $$;
revoke all on function public.care_group_customer_update_before_exclusive(uuid,bigint,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.care_group_customer_update(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.care_group_customer_update(uuid,bigint,text,jsonb) to authenticated;

-- Não aceitar um subconjunto dos números autorizados como composição completa.
-- A consulta original continua verificando o titular, controles, identidade atual e administradores.
alter function public.observe_care_group(uuid,uuid,jsonb) rename to observe_care_group_before_exclusive;
create function public.observe_care_group(p_operation uuid,p_token uuid,p_snapshot jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare context jsonb; expected text[]; present text[];
begin
  context:=public.authorize_care_group_step(p_operation,p_token,'observe');
  select array_agg(x order by x) into expected from jsonb_array_elements_text(context->'platform_phones') x;
  if jsonb_typeof(p_snapshot->'participants')='array' then
    select array_agg('+'||split_part(m->>'jid','@',1) order by '+'||split_part(m->>'jid','@',1)) into present
      from jsonb_array_elements(p_snapshot->'participants') m
      where m->>'jid' ~ '^[1-9][0-9]{7,14}@s\.whatsapp\.net$'
        and '+'||split_part(m->>'jid','@',1)<>context->>'customer_phone';
  end if;
  if expected is null or present is distinct from expected then
    p_snapshot:=coalesce(p_snapshot,'{}'::jsonb)||jsonb_build_object('locked',false);
  end if;
  perform public.observe_care_group_before_exclusive(p_operation,p_token,p_snapshot);
end $$;
revoke all on function public.observe_care_group_before_exclusive(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.observe_care_group(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.observe_care_group(uuid,uuid,jsonb) to service_role;

-- O novo envio nasce desligado; produção exige provedor e isolamento homologados.
alter table public.whatsapp_group_settings add column login_enabled boolean not null default false;
create table public.whatsapp_group_login_routes (
  challenge_id uuid primary key references public.auth_otp_challenges(id) on delete cascade,
  group_id uuid not null references public.whatsapp_care_groups(id) on delete cascade,
  version bigint not null,
  instance_name text not null
);
alter table public.whatsapp_group_login_routes enable row level security;
revoke all on public.whatsapp_group_login_routes from public,anon,authenticated;
grant select,insert,update,delete on public.whatsapp_group_login_routes to service_role;

create function public.request_whatsapp_group_login(p_destination text,p_code_hash text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; g public.whatsapp_care_groups%rowtype; instance text;
begin
  result:=public.request_whatsapp_login_once(p_destination,p_code_hash,p_request_id);
  if (select enrollment_enabled and login_enabled from public.whatsapp_group_settings) then
    select x.* into g from public.whatsapp_care_groups x
      join public.whatsapp_group_accounts a on a.id=x.account_id
      join public.whatsapp_channels n on n.id=a.channel_id
      join public.barbershops s on s.id=x.barbershop_id
      where x.customer_id=(result->>'user_id')::uuid and x.customer_phone=p_destination
        and x.state='active' and x.controls_verified and x.revoked_at is null and not x.entry_pending
        and a.enabled and n.status='open' and s.status='active'
      order by x.requested_at,x.id limit 1;
    if g.id is not null then
      select n.instance_name into instance from public.whatsapp_group_accounts a
        join public.whatsapp_channels n on n.id=a.channel_id where a.id=g.account_id;
      insert into public.whatsapp_group_login_routes values((result->>'challenge_id')::uuid,g.id,g.version,instance);
    end if;
  end if;
  return result;
end $$;

create function public.whatsapp_group_login_context(p_challenge_id uuid,p_code_hash text,p_unused boolean default true)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.auth_otp_challenges%rowtype; r public.whatsapp_group_login_routes%rowtype;
  g public.whatsapp_care_groups%rowtype; platforms text[]; sender text;
begin
  if not (select enrollment_enabled and login_enabled from public.whatsapp_group_settings) then return null; end if;
  select * into c from public.auth_otp_challenges where id=p_challenge_id and channel='whatsapp' and purpose='login'
    and code_hash=p_code_hash and expires_at>clock_timestamp() and (not p_unused or consumed_at is null);
  if c.id is null then return null; end if;
  select * into r from public.whatsapp_group_login_routes where challenge_id=c.id;
  select * into g from public.whatsapp_care_groups where id=r.group_id and version=r.version and state='active'
    and controls_verified and revoked_at is null and not entry_pending and customer_id=c.user_id and customer_phone=c.destination;
  if g.id is null or g.group_jid is null or public.whatsapp_sending_paused(r.instance_name,true)
    or not exists(select 1 from public.barbershops where id=g.barbershop_id and status='active')
    or not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=c.user_id
      and p.whatsapp_e164=c.destination and p.whatsapp_verified_at is not null and u.deleted_at is null
      and nullif(u.email,'') is not null and (u.banned_until is null or u.banned_until<=now()))
    or exists(select 1 from public.whatsapp_care_participants where group_id=g.id and revoked_at is null)
    or exists(select 1 from public.whatsapp_care_operations where group_id=g.id and state='running' and lease_until>now()) then return null; end if;
  if exists(select 1 from unnest(g.approved_accounts) expected(id)
      left join public.whatsapp_group_accounts a on a.id=expected.id left join public.whatsapp_channels n on n.id=a.channel_id
      where a.id is null or not a.enabled or a.barbershop_id<>g.barbershop_id
        or g.approved_account_identities->a.id::text is distinct from jsonb_build_object('phone',n.display_phone,'instance',n.instance_name)) then return null; end if;
  select array_agg('+'||regexp_replace(n.display_phone,'[^0-9]','','g')) into platforms
    from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.id=any(g.approved_accounts);
  select '+'||regexp_replace(n.display_phone,'[^0-9]','','g') into sender
    from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id
    where a.id=g.account_id and a.id=any(g.approved_accounts) and n.instance_name=r.instance_name and n.status='open';
  if sender is null or platforms is null or c.destination=any(platforms)
    or cardinality(platforms)<>(select count(distinct x) from unnest(platforms) x) then return null; end if;
  return jsonb_build_object('group_id',g.id,'group_jid',g.group_jid,'version',g.version,'instance_name',r.instance_name,
    'customer_phone',c.destination,'platform_phones',platforms,'sender_phone',sender);
end $$;

create function public.authorize_whatsapp_group_login(p_challenge_id uuid,p_code_hash text,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare context jsonb; permit jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  perform 1 from public.whatsapp_care_groups where id=(select group_id from public.whatsapp_group_login_routes where challenge_id=p_challenge_id) for update;
  context:=public.whatsapp_group_login_context(p_challenge_id,p_code_hash);
  if context is null or context is distinct from p_expected then return null; end if;
  permit:=public.authorize_whatsapp_send_before_groups(context->>'instance_name',null,null,p_challenge_id,context->>'instance_name',p_code_hash);
  if not (permit ? 'attempt_id') then return null; end if;
  return (permit-'to_e164')||jsonb_build_object('group_jid',context->>'group_jid');
end $$;

-- OTP não tem rota privada, inclusive quando chamado pelo emissor antigo.
alter function public.authorize_whatsapp_send(text,uuid,uuid,uuid,text,text) rename to authorize_whatsapp_send_before_exclusive;
create function public.authorize_whatsapp_send(p_expected_instance text,p_outbox_id uuid default null,p_lease_token uuid default null,
  p_challenge_id uuid default null,p_instance text default null,p_code_hash text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if p_challenge_id is not null then return jsonb_build_object('reason','group_required'); end if;
  return public.authorize_whatsapp_send_before_exclusive(p_expected_instance,p_outbox_id,p_lease_token,p_challenge_id,p_instance,p_code_hash);
end $$;
revoke all on function public.authorize_whatsapp_send_before_exclusive(text,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.authorize_whatsapp_send(text,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.authorize_whatsapp_send(text,uuid,uuid,uuid,text,text) to service_role;

-- Mutações da integração aguardam o envio em andamento. Mesma trava global da saída.
alter function public.authorize_care_group_step(uuid,uuid,text) rename to authorize_care_group_step_before_exclusive;
create function public.authorize_care_group_step(p_operation uuid,p_token uuid,p_action text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare context jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  if exists(select 1 from public.whatsapp_care_operations o join public.whatsapp_group_login_routes r on r.group_id=o.group_id
    join public.whatsapp_send_attempts a on a.challenge_id=r.challenge_id
    where o.id=p_operation and a.state='started' and a.started_at>clock_timestamp()-interval '2 minutes') then raise exception 'GROUP_STALE'; end if;
  context:=public.authorize_care_group_step_before_exclusive(p_operation,p_token,p_action);
  return context||jsonb_build_object('approved_phones','[]'::jsonb);
end $$;
revoke all on function public.authorize_care_group_step_before_exclusive(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.authorize_care_group_step(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.authorize_care_group_step(uuid,uuid,text) to service_role;

create function public.check_whatsapp_group_login(p_destination text,p_code_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  select to_jsonb(x) into result from public.auth_otp_check_code(null,p_destination,'whatsapp','login',p_code_hash,5) x limit 1;
  if result->>'challenge_id' is null or public.whatsapp_group_login_context((result->>'challenge_id')::uuid,p_code_hash,false) is null then return null; end if;
  if not exists(select 1 from public.whatsapp_send_attempts where challenge_id=(result->>'challenge_id')::uuid) then return null; end if;
  return result;
end $$;
revoke all on function public.request_whatsapp_group_login(text,text,uuid),public.whatsapp_group_login_context(uuid,text,boolean),
  public.authorize_whatsapp_group_login(uuid,text,jsonb),public.check_whatsapp_group_login(text,text) from public,anon,authenticated;
grant execute on function public.request_whatsapp_group_login(text,text,uuid),public.whatsapp_group_login_context(uuid,text,boolean),
  public.authorize_whatsapp_group_login(uuid,text,jsonb),public.check_whatsapp_group_login(text,text) to service_role;
