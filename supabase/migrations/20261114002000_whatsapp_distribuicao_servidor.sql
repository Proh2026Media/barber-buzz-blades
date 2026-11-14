-- D3 local: proposta persistente, revalidação, atribuição no cadastro e operação desligada.
alter table public.whatsapp_channels add column platform_control_identity jsonb,
 add column platform_control_verified_at timestamptz,add column platform_control_verified_by uuid references auth.users(id) on delete set null;
create table public.whatsapp_distribution_policy (
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,
 version bigint not null default 1,changed_by uuid references auth.users(id) on delete set null,changed_at timestamptz not null default now()
);
insert into public.whatsapp_distribution_policy default values;
create table public.whatsapp_distribution_waiting (
 barbershop_id uuid primary key references public.barbershops(id) on delete cascade,
 reason text not null check(reason in ('disabled','no_pair','assigned')),checked_at timestamptz not null default now()
);
create table public.whatsapp_distribution_plans (
 id uuid primary key,actor uuid references auth.users(id) on delete set null,shops uuid[] not null,replace_existing boolean not null,
 fingerprint text not null,assignments jsonb not null,blocked jsonb not null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '10 minutes',
 applied_at timestamptz,result jsonb
);
create table public.whatsapp_distribution_audit (
 id uuid primary key default gen_random_uuid(),actor uuid references auth.users(id) on delete set null,
 action text not null,detail jsonb not null,created_at timestamptz not null default now()
);
do $$declare n text;begin foreach n in array array['whatsapp_distribution_policy','whatsapp_distribution_waiting','whatsapp_distribution_plans','whatsapp_distribution_audit'] loop
 execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated,service_role',n);end loop;end $$;

create function public.platform_confirm_whatsapp_control(p_id uuid,p_version bigint,p_phone text,p_instance text,p_isolated boolean) returns void
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_channels%rowtype;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into c from public.whatsapp_channels where id=p_id for update;
 if c.id is null or c.routing_version is distinct from p_version or c.display_phone is distinct from p_phone or c.instance_name is distinct from p_instance then raise exception 'WA_STALE' using errcode='40001';end if;
 if p_isolated is null or not public.whatsapp_operational_number(c.id) then raise exception 'WA_NUMBER_UNAVAILABLE' using errcode='22023';end if;
 update public.whatsapp_channels set platform_control_identity=case when p_isolated then jsonb_build_object('phone',regexp_replace(c.display_phone,'[^0-9]','','g'),'instance',c.instance_name) end,
  platform_control_verified_at=case when p_isolated then clock_timestamp() end,platform_control_verified_by=case when p_isolated then auth.uid() end,routing_version=routing_version+1 where id=c.id;
 insert into public.whatsapp_distribution_audit(actor,action,detail) values(auth.uid(),'platform_control',jsonb_build_object('channel_id',c.id,'confirmed',p_isolated));
end $$;
revoke all on function public.platform_confirm_whatsapp_control(uuid,bigint,text,text,boolean) from public,anon,service_role;
grant execute on function public.platform_confirm_whatsapp_control(uuid,bigint,text,text,boolean) to authenticated;

-- A implementação privada mantém o mesmo cálculo sem conceder enumeração ao serviço.
alter function public.platform_whatsapp_number_activity() rename to platform_whatsapp_number_activity_internal;
-- O cálculo interno será chamado somente por funções SECURITY DEFINER autorizadas.
create or replace function public.platform_whatsapp_number_activity_internal() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 with phones as(select c.id,c.instance_name,regexp_replace(c.display_phone,'[^0-9]','','g') phone from public.whatsapp_channels c where public.whatsapp_operational_number(c.id)),
 days as(select h.phone,h.day,sum(h.accepted) accepted,sum(h.uncertain) uncertain from public.whatsapp_activity_daily_history h where h.scope='groups' and h.day>=(now() at time zone 'UTC')::date-29 and h.day<=(now() at time zone 'UTC')::date group by h.phone,h.day),
 stale as(select a.activity_phone phone,count(*) total from public.whatsapp_send_attempts a where a.destination_kind='groups' and a.state='started' and a.started_at<now()-interval '2 minutes' and a.started_at>=(((now() at time zone 'UTC')::date-29)::timestamp at time zone 'UTC') group by a.activity_phone),
 stats as(select p.id,p.instance_name,p.phone,coalesce(sum(d.accepted),0) accepted,coalesce(sum(d.uncertain),0) uncertain,count(d.day) filter(where d.accepted>0) active_days,coalesce((now() at time zone 'UTC')::date-min(d.day)+1,0) observed_days from phones p left join days d on d.phone=p.phone group by p.id,p.instance_name,p.phone)
 select coalesce(jsonb_object_agg(s.id::text,jsonb_build_object('accepted',s.accepted,'uncertain',s.uncertain+coalesce(st.total,0),'activeDays',s.active_days,'observedDays',least(30,s.observed_days),'sampledAt',now(),'source','dispatch','scope','groups','paused',public.whatsapp_sending_paused(s.instance_name,false),'coverage','protected_group_sends')),'{}') into result from stats s left join stale st on st.phone=s.phone;
 return result;
end $$;
revoke all on function public.platform_whatsapp_number_activity_internal() from public,anon,authenticated,service_role;
create function public.platform_whatsapp_number_activity() returns jsonb language plpgsql security definer set search_path=public as $$
begin if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;return public.platform_whatsapp_number_activity_internal();end $$;
revoke all on function public.platform_whatsapp_number_activity() from public,anon,service_role;
grant execute on function public.platform_whatsapp_number_activity() to authenticated;

create function public.whatsapp_distribution_candidates() returns table(id uuid,phone text,primary_load bigint,reserve_load bigint,accepted bigint,preference integer)
language sql stable security definer set search_path=public as $$
 with metrics as(select public.platform_whatsapp_number_activity_internal() data),
 candidates as(select c.id,regexp_replace(c.display_phone,'[^0-9]','','g') phone,c.instance_name,m.data->c.id::text a,
  (select count(*) from public.whatsapp_number_links l join public.whatsapp_channels n on n.id=l.channel_id where l.removed_at is null and regexp_replace(n.display_phone,'[^0-9]','','g')=regexp_replace(c.display_phone,'[^0-9]','','g')) primary_load,
  (select count(*) from public.whatsapp_number_links l where l.removed_at is null and exists(select 1 from public.whatsapp_channels n where n.id in(l.backup_channel_id,l.backup2_channel_id) and regexp_replace(n.display_phone,'[^0-9]','','g')=regexp_replace(c.display_phone,'[^0-9]','','g'))) reserve_load,
  row_number() over(partition by regexp_replace(c.display_phone,'[^0-9]','','g') order by c.id) position
 from public.whatsapp_channels c cross join metrics m where public.whatsapp_operational_number(c.id) and c.status='open'
  and c.connection_observed_at>=clock_timestamp()-interval '2 minutes'
  and c.platform_control_identity=jsonb_build_object('phone',regexp_replace(c.display_phone,'[^0-9]','','g'),'instance',c.instance_name)
  and not public.whatsapp_sending_paused(c.instance_name,false)
  and not exists(select 1 from public.whatsapp_send_attempts a where a.state in ('started','unknown') and (a.activity_phone=regexp_replace(c.display_phone,'[^0-9]','','g') or a.instance_name=c.instance_name)))
 select c.id,c.phone,c.primary_load,c.reserve_load,case when (a->>'accepted')::bigint>0 then (a->>'accepted')::bigint else 9223372036854775807 end,
  case when (a->>'accepted')::bigint>=100 and (a->>'activeDays')::int>=14 then 0
   when (a->>'accepted')::bigint>=20 and (a->>'activeDays')::int>=7 then 1 when (a->>'accepted')::bigint>0 then 2 else 3 end
 from candidates c where c.position=1;
$$;
create function public.whatsapp_distribution_fingerprint() returns text language sql stable security definer set search_path=public as $$
 select md5(jsonb_build_object('numbers',(select coalesce(jsonb_agg(to_jsonb(c)-'connection_observed_at'-'updated_at'-'last_error' order by c.id),'[]') from public.whatsapp_channels c),
  'links',(select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]') from public.whatsapp_number_links l where removed_at is null),
  'controls',(select coalesce(jsonb_agg(to_jsonb(s) order by s.scope),'[]') from public.whatsapp_send_controls s),
  'reviews',(select coalesce(jsonb_agg(to_jsonb(r) order by r.phone),'[]') from public.whatsapp_phone_reviews r),
  'policy',(select to_jsonb(p) from public.whatsapp_distribution_policy p),
  'activity',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from public.whatsapp_distribution_candidates() c))::text);
$$;
create function public.whatsapp_build_distribution(p_shops uuid[],p_replace boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare shop uuid;current_link public.whatsapp_number_links%rowtype;choices uuid[];used jsonb:='{}';assignments jsonb:='[]';blocked jsonb:='[]';primary_id uuid;reserve1 uuid;reserve2 uuid;n uuid;
begin
 for shop in select distinct x from unnest(p_shops) x order by x loop
  if not public.whatsapp_complete_shop(shop) then raise exception 'WA_TARGET_INVALID' using errcode='22023';end if;
  select * into current_link from public.whatsapp_number_links where barbershop_id=shop and staff_id is null and removed_at is null;
  if current_link.id is not null and not p_replace then continue;end if;
  -- Carga física agregada; lote usa a carga projetada de cada escolha anterior.
  select array_agg(id order by primary_load-case when phone=(select regexp_replace(display_phone,'[^0-9]','','g') from public.whatsapp_channels where id=current_link.channel_id) then 1 else 0 end+coalesce((used->id::text->>'primary')::int,0),accepted,preference,reserve_load+coalesce((used->id::text->>'reserve')::int,0),phone) into choices from public.whatsapp_distribution_candidates();
  primary_id:=choices[1];
  select array_agg(id order by reserve_load-case when phone in(select regexp_replace(display_phone,'[^0-9]','','g') from public.whatsapp_channels where id in(current_link.backup_channel_id,current_link.backup2_channel_id)) then 1 else 0 end+coalesce((used->id::text->>'reserve')::int,0),preference,primary_load+coalesce((used->id::text->>'primary')::int,0),phone) into choices from public.whatsapp_distribution_candidates() where id is distinct from primary_id;
  reserve1:=choices[1];reserve2:=choices[2];
  if primary_id is null or reserve1 is null then blocked:=blocked||jsonb_build_array(jsonb_build_object('shop',shop,'reason','no_pair'));continue;end if;
  assignments:=assignments||jsonb_build_array(jsonb_build_object('shop',shop,'version',coalesce(current_link.version,0),'primary',primary_id,'backup',reserve1,'backup2',reserve2));
  used:=jsonb_set(used,array[primary_id::text],jsonb_build_object('primary',coalesce((used->primary_id::text->>'primary')::int,0)+1,'reserve',coalesce((used->primary_id::text->>'reserve')::int,0)));
  foreach n in array array[reserve1,reserve2] loop if n is not null then used:=jsonb_set(used,array[n::text],jsonb_build_object('primary',coalesce((used->n::text->>'primary')::int,0),'reserve',coalesce((used->n::text->>'reserve')::int,0)+1));end if;end loop;
 end loop;
 return jsonb_build_object('assignments',assignments,'blocked',blocked);
end $$;
create function public.platform_plan_whatsapp_distribution(p_request_id uuid,p_shops uuid[],p_replace boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.whatsapp_distribution_plans%rowtype;result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_request_id is null or coalesce(cardinality(p_shops),0) not between 1 and 50 or array_position(p_shops,null) is not null or p_replace is null then raise exception 'WA_TARGET_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into p from public.whatsapp_distribution_plans where id=p_request_id;
 if p.id is not null then
  if p.actor is distinct from auth.uid() or p.shops is distinct from p_shops or p.replace_existing is distinct from p_replace then raise exception 'WA_PLAN_KEY_CONFLICT' using errcode='22023';end if;
 else
  result:=public.whatsapp_build_distribution(p_shops,p_replace);
  insert into public.whatsapp_distribution_plans(id,actor,shops,replace_existing,fingerprint,assignments,blocked)
   values(p_request_id,auth.uid(),p_shops,p_replace,public.whatsapp_distribution_fingerprint(),result->'assignments',result->'blocked') returning * into p;
 end if;
 return jsonb_build_object('id',p.id,'assignments',p.assignments,'blocked',p.blocked,'expires_at',p.expires_at,'applied_at',p.applied_at,'result',p.result);
end $$;
create function public.platform_apply_whatsapp_distribution(p_plan uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.whatsapp_distribution_plans%rowtype;a jsonb;applied jsonb:='[]';v_result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into p from public.whatsapp_distribution_plans where id=p_plan and actor=auth.uid() for update;
 if p.id is null then raise exception 'WA_PLAN_STALE' using errcode='40001';end if;
 if p.applied_at is not null then return p.result;end if;
 if p.expires_at<=clock_timestamp() or p.fingerprint is distinct from public.whatsapp_distribution_fingerprint()
  or public.whatsapp_build_distribution(p.shops,p.replace_existing) is distinct from jsonb_build_object('assignments',p.assignments,'blocked',p.blocked) then raise exception 'WA_PLAN_STALE' using errcode='40001';end if;
 for a in select value from jsonb_array_elements(p.assignments) loop
  v_result:=public.platform_set_whatsapp_route((a->>'shop')::uuid,null,(a->>'version')::bigint,(a->>'primary')::uuid,(a->>'backup')::uuid,(a->>'backup2')::uuid,'primary',false,false,false);
  applied:=applied||jsonb_build_array(jsonb_build_object('shop',a->>'shop','link_id',v_result->>'id','version',v_result->'version'));
 end loop;
 v_result:=jsonb_build_object('applied',applied,'blocked',p.blocked);
 update public.whatsapp_distribution_plans set applied_at=clock_timestamp(),result=v_result where id=p.id;
 insert into public.whatsapp_distribution_audit(actor,action,detail) values(auth.uid(),'plan_applied',jsonb_build_object('plan_id',p.id,'result',v_result));
 return v_result;
end $$;

create function public.whatsapp_assign_missing_internal(p_shops uuid[]) returns jsonb
language plpgsql security definer set search_path=public as $$
declare plan jsonb;a jsonb;c public.whatsapp_number_links%rowtype;identities jsonb;assigned integer:=0;
begin
 plan:=public.whatsapp_build_distribution(p_shops,false);
 for a in select value from jsonb_array_elements(plan->'assignments') loop
  select jsonb_object_agg(n.id::text,jsonb_build_object('phone',regexp_replace(n.display_phone,'[^0-9]','','g'),'instance',n.instance_name)) into identities from public.whatsapp_channels n where n.id in((a->>'primary')::uuid,(a->>'backup')::uuid,(a->>'backup2')::uuid);
  insert into public.whatsapp_number_links(channel_id,barbershop_id,backup_channel_id,backup2_channel_id,number_identities,enabled,delivery_mode,return_notice_enabled)
   values((a->>'primary')::uuid,(a->>'shop')::uuid,(a->>'backup')::uuid,(a->>'backup2')::uuid,identities,false,'primary',false) returning * into c;
  insert into public.whatsapp_number_link_history(channel_id,link_id,actor_id,action,after_config) values(c.channel_id,c.id,auth.uid(),'added',to_jsonb(c));
  insert into public.whatsapp_distribution_waiting(barbershop_id,reason) values(c.barbershop_id,'assigned') on conflict(barbershop_id) do update set reason='assigned',checked_at=clock_timestamp();
  assigned:=assigned+1;
 end loop;
 for a in select value from jsonb_array_elements(plan->'blocked') loop
  insert into public.whatsapp_distribution_waiting(barbershop_id,reason) values((a->>'shop')::uuid,'no_pair') on conflict(barbershop_id) do update set reason='no_pair',checked_at=clock_timestamp();
 end loop;
 if assigned>0 then insert into public.whatsapp_distribution_audit(actor,action,detail) values(auth.uid(),'automatic_assignment',plan);end if;
 return jsonb_build_object('assigned',assigned,'blocked',jsonb_array_length(plan->'blocked'));
end $$;
create function public.platform_set_whatsapp_automatic(p_enabled boolean,p_version bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.whatsapp_distribution_policy%rowtype;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_enabled is null then raise exception 'WA_TARGET_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into p from public.whatsapp_distribution_policy for update;
 if p.version is distinct from p_version then raise exception 'WA_STALE' using errcode='40001';end if;
 update public.whatsapp_distribution_policy set enabled=p_enabled,version=version+1,changed_by=auth.uid(),changed_at=clock_timestamp() returning * into p;
 insert into public.whatsapp_distribution_audit(actor,action,detail) values(auth.uid(),'automatic_policy',jsonb_build_object('enabled',p.enabled,'version',p.version));
 return to_jsonb(p);
end $$;
create function public.run_whatsapp_distribution() returns jsonb
language plpgsql security definer set search_path=public as $$
declare shops uuid[];
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 if not (select enabled from public.whatsapp_distribution_policy) then return jsonb_build_object('disabled',true);end if;
 select array_agg(id order by id) into shops from(select b.id from public.barbershops b left join public.whatsapp_distribution_waiting w on w.barbershop_id=b.id where public.whatsapp_complete_shop(b.id)
 and not exists(select 1 from public.whatsapp_number_links l where l.barbershop_id=b.id and l.staff_id is null and l.removed_at is null) order by w.checked_at nulls first,b.id limit 50) batch;
 return public.whatsapp_assign_missing_internal(shops);
end $$;
-- Integra o cadastro completo, sem depender do navegador aberto.
alter function public.register_my_barbershop(uuid,text,text,text,boolean,text,text,text) rename to register_my_barbershop_before_distribution;
revoke all on function public.register_my_barbershop_before_distribution(uuid,text,text,text,boolean,text,text,text) from public,anon,authenticated,service_role;
create function public.register_my_barbershop(p_request_id uuid,p_name text,p_timezone text,p_society_intent text,p_terms_accepted boolean,p_terms_version text,p_privacy_version text,p_dpa_version text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;shop uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 result:=public.register_my_barbershop_before_distribution(p_request_id,p_name,p_timezone,p_society_intent,p_terms_accepted,p_terms_version,p_privacy_version,p_dpa_version);
 shop:=(result->>'shop_id')::uuid;
 if (select enabled from public.whatsapp_distribution_policy) then perform public.whatsapp_assign_missing_internal(array[shop]);
 elsif not exists(select 1 from public.whatsapp_number_links where barbershop_id=shop and staff_id is null and removed_at is null) then
  insert into public.whatsapp_distribution_waiting(barbershop_id,reason) values(shop,'disabled') on conflict(barbershop_id) do nothing;
 end if;
 return result;
end $$;

-- Leitura operacional limitada: não retorna segredo nem histórico de mensagens.
create function public.whatsapp_distribution_connections() returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'instance',instance_name,'phone',display_phone,'version',routing_version)),'[]') from
 (select c.* from public.whatsapp_channels c where public.whatsapp_operational_number(c.id) and c.platform_control_identity=jsonb_build_object('phone',regexp_replace(c.display_phone,'[^0-9]','','g'),'instance',c.instance_name)
 order by c.connection_observed_at nulls first,c.id limit 50) batch;
$$;
create function public.record_whatsapp_distribution_connection(p_id uuid,p_instance text,p_phone text,p_version bigint,p_status text,p_observed_phone text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if p_status is null or p_status not in ('open','disconnected','unknown') or (p_status='open' and p_observed_phone is distinct from p_phone) then return false;end if;
 if p_status='unknown' then
  update public.whatsapp_channels set connection_observed_at=null where id=p_id and instance_name=p_instance and display_phone=p_phone and routing_version=p_version;return found;
 end if;
 update public.whatsapp_channels set status=p_status::public.whatsapp_channel_status where id=p_id and instance_name=p_instance and display_phone=p_phone and routing_version=p_version and not personal_number;
 return found;
end $$;
create function public.platform_whatsapp_distribution_state() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 return jsonb_build_object('policy',(select to_jsonb(p) from public.whatsapp_distribution_policy p),'eligible',(select count(*) from public.whatsapp_distribution_candidates()),
 'waiting',coalesce((select jsonb_agg(to_jsonb(w)) from public.whatsapp_distribution_waiting w where public.whatsapp_complete_shop(w.barbershop_id)),'[]'),
 'reviews',coalesce((select jsonb_agg(to_jsonb(r)) from public.whatsapp_phone_reviews r),'[]'));
end $$;
alter function public.platform_whatsapp_directory() rename to platform_whatsapp_directory_before_automation;
revoke all on function public.platform_whatsapp_directory_before_automation() from public,anon,authenticated,service_role;
create function public.platform_whatsapp_directory() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 return public.platform_whatsapp_directory_before_automation()||jsonb_build_object('server_distribution',true,'distribution',public.platform_whatsapp_distribution_state());
end $$;
revoke all on function public.whatsapp_distribution_candidates(),public.whatsapp_distribution_fingerprint(),public.whatsapp_build_distribution(uuid[],boolean),public.whatsapp_assign_missing_internal(uuid[]),public.platform_plan_whatsapp_distribution(uuid,uuid[],boolean),public.platform_apply_whatsapp_distribution(uuid),public.platform_set_whatsapp_automatic(boolean,bigint),public.platform_whatsapp_distribution_state(),public.platform_whatsapp_directory(),public.register_my_barbershop(uuid,text,text,text,boolean,text,text,text),public.run_whatsapp_distribution(),public.whatsapp_distribution_connections(),public.record_whatsapp_distribution_connection(uuid,text,text,bigint,text,text) from public,anon,authenticated,service_role;
grant execute on function public.platform_plan_whatsapp_distribution(uuid,uuid[],boolean),public.platform_apply_whatsapp_distribution(uuid),public.platform_set_whatsapp_automatic(boolean,bigint),public.platform_whatsapp_distribution_state(),public.platform_whatsapp_directory(),public.register_my_barbershop(uuid,text,text,text,boolean,text,text,text) to authenticated;
grant execute on function public.run_whatsapp_distribution(),public.whatsapp_distribution_connections(),public.record_whatsapp_distribution_connection(uuid,text,text,bigint,text,text) to service_role;
notify pgrst,'reload schema';
create function public.record_whatsapp_distribution_connections(p_observations jsonb) returns integer
language plpgsql security definer set search_path=public as $$
declare observation jsonb;total integer:=0;
begin
 if jsonb_typeof(p_observations)<>'array' or jsonb_array_length(p_observations)>50 then raise exception 'WA_TARGET_INVALID' using errcode='22023';end if;
 for observation in select value from jsonb_array_elements(p_observations) loop
  if public.record_whatsapp_distribution_connection((observation->>'id')::uuid,observation->>'instance',observation->>'phone',(observation->>'version')::bigint,observation->>'status',observation->>'observed_phone') then total:=total+1;end if;
 end loop;
 return total;
end $$;
revoke all on function public.record_whatsapp_distribution_connections(jsonb) from public,anon,authenticated;
grant execute on function public.record_whatsapp_distribution_connections(jsonb) to service_role;
