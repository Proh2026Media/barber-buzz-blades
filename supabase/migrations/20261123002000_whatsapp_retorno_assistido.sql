-- No retorno de um ciclo encerrado, a tela registra o consentimento e o servidor
-- verifica as conexões antes de criar o grupo na Evolution, como no primeiro acesso.
do $$declare base text; begin
 if (select md5(prosrc) from pg_proc where oid='public.care_group_customer_update(uuid,bigint,text,jsonb)'::regprocedure)
    <> '4a287ee873601cedfebd6e83292bd209' then raise exception 'BC_RETORNO_BASE_DIVERGENTE'; end if;
 base:=pg_get_functiondef('public.care_group_customer_update(uuid,bigint,text,jsonb)'::regprocedure);
 execute replace(base,'FUNCTION public.care_group_customer_update(','FUNCTION public.care_customer_update_before_return(');
end $$;
revoke all on function public.care_customer_update_before_return(uuid,bigint,text,jsonb) from public,anon,authenticated,service_role;

create or replace function public.care_group_customer_update(p_group uuid,p_version bigint,p_action text,p_values jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype; c public.whatsapp_care_cycles%rowtype;
 numbers jsonb; expected uuid[]; supplied uuid[]; new_cycle uuid; current_version bigint; declared text;
begin
 if p_action is distinct from 'rejoin' then
  return public.care_customer_update_before_return(p_group,p_version,p_action,p_values);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 select * into g from public.whatsapp_care_groups where id=p_group and customer_id=auth.uid() for update;
 if g.id is null then raise exception 'Sem permissão' using errcode='42501'; end if;
 if g.version is distinct from p_version then raise exception 'GROUP_STALE'; end if;
 select * into c from public.whatsapp_care_cycles where id=g.current_cycle_id for update;
 if c.state is distinct from 'closed' or not public.care_entry_background_allowed(g.customer_id,g.barbershop_id) then
  return public.care_customer_update_before_return(p_group,p_version,p_action,p_values);
 end if;
 if exists(select 1 from public.whatsapp_care_cycles where group_id=g.id and state<>'closed') or c.cleanup_pending or g.state<>'closed' or g.reason='operator_pause' or c.group_id is distinct from g.id
    or c.group_jid is distinct from g.group_jid or (c.creation_issued_at is not null and c.group_jid is null)
 then raise exception 'GROUP_REVIEW_REQUIRED'; end if;
 if p_values->>'accept' is distinct from 'true' then raise exception 'GROUP_UNAVAILABLE'; end if;
 if exists(select 1 from public.whatsapp_send_attempts where activity_group_id=g.id and state in ('started','unknown'))
 then raise exception 'GROUP_SEND_UNRESOLVED'; end if;
 numbers:=public.care_cycle_composition(g.barbershop_id,null);
 select array_agg((n->>'id')::uuid order by (n->>'id')::uuid) into expected from jsonb_array_elements(numbers) n;
 select array_agg(x::uuid order by x::uuid) into supplied from jsonb_array_elements_text(p_values->'accounts') x;
 if expected is distinct from supplied or not public.care_cycle_composition_valid(numbers,false)
    or g.customer_phone in (select n->>'phone' from jsonb_array_elements(numbers) n)
 then raise exception 'GROUP_PARTICIPANTS_CHANGED'; end if;
 insert into public.whatsapp_care_cycles(group_id,customer_phone,consented_numbers,creator_channel_id,creator_instance)
 select g.id,g.customer_phone,numbers,(n->>'id')::uuid,n->>'instance' from jsonb_array_elements(numbers) n
 where n->>'instance'=public.care_cycle_sender_instance(g.barbershop_id) returning id into new_cycle;
 if new_cycle is null then raise exception 'GROUP_UNAVAILABLE'; end if;
 update public.whatsapp_care_groups set current_cycle_id=new_cycle,group_jid=null,state='requested',
 reason='preparation_required',controls_verified=false,entry_pending=true,observed_at=null,observed_participants='[]',
 revoked_at=null,version=version+1,consent_version='grupos-2026-11-14' where id=g.id returning version into current_version;
 perform public.care_cycle_sync_accounts(new_cycle);
 select coalesce(p.whatsapp_e164,g.customer_phone) into declared from public.profiles p where p.id=g.customer_id;
 perform public.care_access_start(g.barbershop_id,declared,supplied,true,g.id,current_version);
 insert into public.whatsapp_group_enrollments(group_id,profile_phone,profile_verified_at)
 select g.id,p.whatsapp_e164,p.whatsapp_verified_at from public.profiles p where p.id=g.customer_id
 on conflict(group_id) do update set expires_at=clock_timestamp()+interval '1 hour'
 where whatsapp_group_enrollments.profile_phone is not distinct from excluded.profile_phone
 and whatsapp_group_enrollments.profile_verified_at is not distinct from excluded.profile_verified_at;
 if not found then raise exception 'GROUP_PHONE_UNAVAILABLE'; end if;
 insert into public.whatsapp_care_audit(group_id,actor,action,detail) values
 (g.id,auth.uid(),'cycle_requested',jsonb_build_object('cycle_id',new_cycle,'numbers',numbers,'consent_version','grupos-2026-11-14')),
 (g.id,auth.uid(),'rejoin',jsonb_build_object('cycle_id',new_cycle,'previous_cycle',c.id,'source','application'));
 return public.care_group_read(g.barbershop_id);
end $$;
