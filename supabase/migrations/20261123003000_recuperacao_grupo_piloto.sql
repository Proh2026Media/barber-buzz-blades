-- Piloto de recuperação. A seleção de lojas é independente da habilitação normal de grupos.
create table public.care_recovery_shops (shop_id uuid primary key references public.barbershops on delete cascade);
insert into public.care_recovery_shops select id from public.barbershops where id='bc8595cb-72a7-4428-8a9c-97fe12c18222' and slug='loja-teste-b';
create table public.care_welcome_recoveries (
 id uuid primary key, cycle_id uuid not null references public.whatsapp_care_cycles on delete cascade,
 requested_at timestamptz not null default clock_timestamp(), state text not null default 'started' check(state in ('started','accepted','unknown'))
);
create index on public.care_welcome_recoveries(cycle_id,requested_at);
alter table public.care_welcome_recoveries enable row level security;
alter table public.care_recovery_shops enable row level security;
revoke all on public.care_welcome_recoveries,public.care_recovery_shops from public,anon,authenticated,service_role;
grant select on public.care_recovery_shops to authenticated;
create policy own_recovery_shop on public.care_recovery_shops for select to authenticated using
(exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.barbershop_id=shop_id and m.role='customer'));

create function public.care_welcome_recovery_context(p_user uuid,p_shop uuid,p_request uuid default null,p_expected jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare ctx jsonb; prior public.care_welcome_recoveries%rowtype;
begin
 if p_request is not null then
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 end if;
 select jsonb_build_object('group_id',g.id,'group_jid',g.group_jid,'version',g.version,'cycle_id',c.id,'cycle_revision',c.revision,
 'cycle_expires_at',c.expires_at,'creator_phone',creator.display_phone,'first_message_id',c.first_message_id,'admission_id',c.admission_id,
 'welcome_message_id',c.admission_welcome_message_id,'instance_name',sender.instance_name,'customer_phone',c.customer_phone,
 'platform_phones',(select jsonb_agg(n->>'phone' order by n->>'phone') from jsonb_array_elements(c.consented_numbers) n),
 'sender_phone',sender.display_phone,'brand',public.care_cycle_content_context(c.id)) into ctx
 from public.whatsapp_care_groups g join public.whatsapp_care_cycles c on c.id=g.current_cycle_id
 join public.care_recovery_shops s on s.shop_id=g.barbershop_id
 join public.whatsapp_channels creator on creator.id=c.creator_channel_id
 join public.whatsapp_care_cycle_steps w on w.cycle_id=c.id and w.phase='welcome' and w.provider_id=c.admission_welcome_message_id and w.state='accepted'
 join public.whatsapp_channels sender on sender.instance_name=w.instance_name and sender.id<>creator.id
 where g.customer_id=p_user and g.barbershop_id=p_shop and g.state='active' and c.state='active'
 and c.admission_welcome_id=c.admission_id and g.controls_verified and not g.entry_pending
 and public.care_cycle_available(c.id,false) and public.whatsapp_pilot_context_allows(p_shop,p_user)
 and not public.whatsapp_sending_paused(sender.instance_name,true);
 if p_request is null or ctx is null then return ctx; end if;
 if ctx is distinct from p_expected then raise exception 'GROUP_STALE'; end if;
 select * into prior from public.care_welcome_recoveries where id=p_request;
 if found then
  if prior.cycle_id<>(ctx->>'cycle_id')::uuid then raise exception 'GROUP_STALE'; end if;
  return jsonb_build_object('prior',prior.state);
 end if;
 if exists(select 1 from public.care_welcome_recoveries where cycle_id=(ctx->>'cycle_id')::uuid and requested_at>now()-interval '1 minute')
 or (select count(*) from public.care_welcome_recoveries where cycle_id=(ctx->>'cycle_id')::uuid and requested_at>now()-interval '1 day')>=5 then raise exception 'WA_RATE_LIMIT'; end if;
 insert into public.care_welcome_recoveries(id,cycle_id) values(p_request,(ctx->>'cycle_id')::uuid);
 return ctx;
end $$;
revoke all on function public.care_welcome_recovery_context(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.care_welcome_recovery_context(uuid,uuid,uuid,jsonb) to service_role;


-- Um pedido iniciado na loja piloto nunca pode cair em outro grupo do mesmo titular.
create function public.request_scoped_group_login(p_destination text,p_code_hash text,p_request_id uuid,p_slug text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb; g public.whatsapp_care_groups%rowtype; shop uuid; sender text; ch uuid;
begin
 select b.id into shop from public.barbershops b join public.care_recovery_shops s on s.shop_id=b.id where b.slug=p_slug;
 if shop is null then raise exception 'GROUP_UNAVAILABLE'; end if;
 r:=public.request_whatsapp_login_once(p_destination,p_code_hash,p_request_id);
 ch:=(r->>'challenge_id')::uuid;
 -- O gatilho guard_whatsapp_otp_request já invalida o código anterior na mesma transação.
 select x.* into g from public.whatsapp_care_groups x where x.customer_id=(r->>'user_id')::uuid and x.barbershop_id=shop
 and public.whatsapp_pilot_context_allows(shop,x.customer_id) and public.care_login_preflight_ready(x.id)
 and x.customer_phone=public.care_group_physical(x.customer_id,p_destination,x.id,false);
 if g.id is null then return r-'user_id'; end if;
 select n.instance_name into sender from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.id=g.account_id;
 if sender is null then return r-'user_id'; end if;
 insert into public.whatsapp_group_login_routes(challenge_id,group_id,version,instance_name) values(ch,g.id,g.version,sender);
 update public.auth_otp_challenges set expires_at=least(expires_at,(select expires_at from public.whatsapp_care_cycles where id=g.current_cycle_id)) where id=ch;
 return r;
end $$;
revoke all on function public.request_scoped_group_login(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.request_scoped_group_login(text,text,uuid,text) to service_role;
notify pgrst,'reload schema';

create function public.care_welcome_recovery_finish(p_id uuid,p_accepted boolean) returns void language sql security definer set search_path=public as $$
 update public.care_welcome_recoveries set state=case when p_accepted then 'accepted' else 'unknown' end where id=p_id and state='started';
$$;
revoke all on function public.care_welcome_recovery_finish(uuid,boolean) from public,anon,authenticated;
grant execute on function public.care_welcome_recovery_finish(uuid,boolean) to service_role;

alter function public.platform_whatsapp_health_data() rename to platform_whatsapp_health_before_recovery;
revoke all on function public.platform_whatsapp_health_before_recovery() from public,anon,authenticated;
create function public.platform_whatsapp_health_data() returns jsonb language plpgsql security definer set search_path=public as $$
declare d jsonb;
begin
 d:=public.platform_whatsapp_health_before_recovery();
 return jsonb_set(d,'{numbers}',coalesce((select jsonb_agg(n||jsonb_build_object('unknown',(n->>'unknown')::int+
 (select count(*) from public.care_welcome_recoveries r join public.whatsapp_care_cycles c on c.id=r.cycle_id
 where r.requested_at>now()-interval '24 hours' and (r.state='unknown' or (r.state='started' and r.requested_at<now()-interval '2 minutes'))
 and exists(select 1 from public.whatsapp_care_cycle_steps s where s.cycle_id=c.id and s.phase='welcome' and s.instance_name=n->>'instance_name'))) order by ord)
 from jsonb_array_elements(d->'numbers') with ordinality as v(n,ord)),'[]'::jsonb));
end $$;
revoke all on function public.platform_whatsapp_health_data() from public,anon;
grant execute on function public.platform_whatsapp_health_data() to authenticated;

create function public.care_recovery_welcome_view(p_shop uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select care_cycle_content_context(c.id)||jsonb_build_object('expires_at',c.expires_at)
 from whatsapp_care_groups g join whatsapp_care_cycles c on c.id=g.current_cycle_id join care_recovery_shops s on s.shop_id=g.barbershop_id
 where g.barbershop_id=p_shop and g.customer_id=auth.uid() and g.state='active' and g.revoked_at is null and c.state='active' and c.expires_at>now()
 and exists(select 1 from memberships m where m.user_id=auth.uid() and m.barbershop_id=p_shop and m.role='customer');
$$;
revoke all on function public.care_recovery_welcome_view(uuid) from public,anon;
grant execute on function public.care_recovery_welcome_view(uuid) to authenticated;
notify pgrst,'reload schema';
