-- Login: conferência viva seletiva antes da rota, sem prolongar validade de observações.
-- Não liga políticas, não cria desafios, não confirma telefone e não envia mensagens.
do $$declare body text;wrapper text;begin
 if (select md5(prosrc) from pg_proc where oid='public.care_cycle_send_ready_before_post_entry(uuid)'::regprocedure) is distinct from '7ea7f818af5f9e3a8bb4d0ca6bf8e6d3'
  or (select md5(prosrc) from pg_proc where oid='public.care_cycle_send_ready(uuid)'::regprocedure) is distinct from 'e6646855aacf0f080e8ee5c79188c8f9' then raise exception 'BC_LOGIN_BASE_DIVERGENTE';end if;
 select pg_get_functiondef('public.care_cycle_send_ready_before_post_entry(uuid)'::regprocedure) into body;
 select pg_get_functiondef('public.care_cycle_send_ready(uuid)'::regprocedure) into wrapper;
 if position('public.care_cycle_available(c.id)' in body)=0 or position('public.care_cycle_send_ready_before_post_entry(p_group)' in wrapper)=0 then raise exception 'BC_LOGIN_BASE_DIVERGENTE';end if;
 body:=replace(body,'FUNCTION public.care_cycle_send_ready_before_post_entry(','FUNCTION public.care_login_preflight_ready_base(');
 body:=replace(body,'public.care_cycle_available(c.id)','public.care_cycle_available(c.id,false)');
 execute body;
 wrapper:=replace(wrapper,'FUNCTION public.care_cycle_send_ready(','FUNCTION public.care_login_preflight_ready(');
 wrapper:=replace(wrapper,'public.care_cycle_send_ready_before_post_entry(p_group)','public.care_login_preflight_ready_base(p_group)');
 execute wrapper;
end $$;
revoke all on function public.care_login_preflight_ready_base(uuid),public.care_login_preflight_ready(uuid) from public,anon,authenticated,service_role;

create function public.whatsapp_login_preflight(p_challenge_id uuid,p_code_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.auth_otp_challenges%rowtype;g public.whatsapp_care_groups%rowtype;
 cycle public.whatsapp_care_cycles%rowtype;r public.whatsapp_group_login_routes%rowtype;targets jsonb;sender text;
begin
 if not coalesce((select enrollment_enabled and login_enabled from public.whatsapp_group_settings),false)
  or public.whatsapp_sending_paused('',false) then return null;end if;
 select * into c from public.auth_otp_challenges where id=p_challenge_id and code_hash=p_code_hash
  and channel='whatsapp' and purpose='login' and consumed_at is null and expires_at>clock_timestamp();
 if c.id is null or c.user_id is null or not exists(select 1 from public.profiles p join auth.users u on u.id=p.id
  where p.id=c.user_id and p.whatsapp_e164=c.destination and p.whatsapp_verified_at is not null
   and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp())) then return null;end if;
 select * into r from public.whatsapp_group_login_routes where challenge_id=c.id;
 select x.* into g from public.whatsapp_care_groups x
  where x.customer_id=c.user_id and x.customer_phone=public.care_group_physical(c.user_id,c.destination,x.id,false)
   and public.whatsapp_pilot_context_allows(x.barbershop_id,c.user_id)
   and public.care_login_preflight_ready(x.id)
   and (r.challenge_id is null or (x.id=r.group_id and x.version=r.version))
  order by x.requested_at,x.id limit 1;
 if g.id is null then return null;end if;
 select * into cycle from public.whatsapp_care_cycles where id=g.current_cycle_id;
 select jsonb_agg(jsonb_build_object('id',w.id,'instance',w.instance_name,'phone',n->>'phone','version',w.routing_version) order by w.id)
  into targets from jsonb_array_elements(cycle.consented_numbers) n join public.whatsapp_channels w on w.id=(n->>'id')::uuid;
 select n.instance_name into sender from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.id=g.account_id;
 if sender is null or coalesce(jsonb_array_length(targets),0) not between 2 and 5 or public.whatsapp_sending_paused(sender,true)
  or (r.challenge_id is not null and r.instance_name<>sender) then return null;end if;
 return jsonb_build_object('challenge',c.id,'group',g.id,'version',g.version,'cycle',cycle.id,
  'revision',cycle.revision,'admission',cycle.admission_id,'instance',sender,'targets',targets);
end $$;

create function public.complete_whatsapp_login_preflight(p_challenge_id uuid,p_code_hash text,p_expected jsonb,p_observations jsonb) returns boolean
language plpgsql security definer set search_path=public as $$
declare snapshot jsonb;o jsonb;r public.whatsapp_group_login_routes%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 snapshot:=public.whatsapp_login_preflight(p_challenge_id,p_code_hash);
 if snapshot is null or snapshot is distinct from p_expected then return false;end if;
 if jsonb_typeof(p_observations) is distinct from 'array' or jsonb_array_length(p_observations)<>jsonb_array_length(snapshot->'targets')
  or (select count(distinct n->>'id') from jsonb_array_elements(p_observations) n)<>jsonb_array_length(snapshot->'targets') then return false;end if;
 for o in select value from jsonb_array_elements(p_observations) loop
  if not exists(select 1 from jsonb_array_elements(snapshot->'targets') n where n->>'id'=o->>'id'
   and n->>'instance'=o->>'instance' and n->>'phone'=o->>'phone' and n->>'version'=o->>'version') then return false;end if;
 end loop;
 for o in select value from jsonb_array_elements(p_observations) loop
  if not public.record_whatsapp_distribution_connection((o->>'id')::uuid,o->>'instance',o->>'phone',(o->>'version')::bigint,o->>'status',o->>'observed_phone')
   then return false;end if;
 end loop;
 -- Observar não concede envio: o contrato original deve estar pronto após a leitura real.
 if public.whatsapp_login_preflight(p_challenge_id,p_code_hash) is distinct from snapshot
  or not public.care_cycle_send_ready((snapshot->>'group')::uuid)
  or not public.care_cycle_composition_valid((select consented_numbers from public.whatsapp_care_cycles where id=(snapshot->>'cycle')::uuid)) then return false;end if;
 select * into r from public.whatsapp_group_login_routes where challenge_id=p_challenge_id;
 if r.challenge_id is not null then return r.group_id=(snapshot->>'group')::uuid and r.version=(snapshot->>'version')::bigint and r.instance_name=snapshot->>'instance';end if;
 update public.auth_otp_challenges set expires_at=least(expires_at,(select expires_at from public.whatsapp_care_cycles where id=(snapshot->>'cycle')::uuid))
  where id=p_challenge_id and code_hash=p_code_hash and consumed_at is null and expires_at>clock_timestamp();
 if not found then return false;end if;
 insert into public.whatsapp_group_login_routes(challenge_id,group_id,version,instance_name)
  values(p_challenge_id,(snapshot->>'group')::uuid,(snapshot->>'version')::bigint,snapshot->>'instance');
 return true;
end $$;
revoke all on function public.whatsapp_login_preflight(uuid,text),public.complete_whatsapp_login_preflight(uuid,text,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.whatsapp_login_preflight(uuid,text),public.complete_whatsapp_login_preflight(uuid,text,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
