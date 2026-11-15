-- D4 local: evento pede conferência; não prova prontidão nem altera preferências.
create or replace function public.care_group_event(p_instance text,p_group_jid text,p_event_key text,p_kind text,p_sender text default null,p_stop text default null,p_from_me boolean default false) returns boolean
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_care_cycles%rowtype;changed integer;
begin
 select * into c from public.whatsapp_care_cycles x where x.group_jid=p_group_jid and x.group_id is not null and exists(select 1 from jsonb_array_elements(x.consented_numbers) n where n->>'instance'=p_instance) for update;
 if c.id is null then return public.care_group_event_before_integration(p_instance,p_group_jid,p_event_key,case when p_kind='group.join-request' then 'group-participants.update' else p_kind end,p_sender,null,p_from_me);end if;
 if p_event_key is null or length(p_event_key)>128 then raise exception 'GROUP_INVALID';end if;
 insert into public.whatsapp_care_events(event_key,group_id,kind) values(p_event_key,c.group_id,p_kind) on conflict do nothing;get diagnostics changed=row_count;
 if changed=0 or p_kind='messages.upsert' or c.state in ('closed','closing') then return changed>0;end if;
 update public.whatsapp_care_cycles set observed_at=null,next_run_at=now(),reason='review_required' where id=c.id;
 update public.whatsapp_care_groups set controls_verified=false,observed_at=null,version=version+1,reason=case when reason='operator_pause' then reason else 'review_required' end where id=c.group_id;
 return true;
end $$;
create or replace function public.care_group_removed_members(p_instance text,p_group_jid text,p_event_key text,p_jids jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_care_cycles%rowtype;g public.whatsapp_care_groups%rowtype;
begin
 if jsonb_typeof(p_jids) is distinct from 'array' or jsonb_array_length(p_jids)>50 or p_event_key is null or length(p_event_key)>128 then raise exception 'GROUP_INVALID';end if;
 select * into c from public.whatsapp_care_cycles x where x.group_jid=p_group_jid and x.group_id is not null and exists(select 1 from jsonb_array_elements(x.consented_numbers) n where n->>'instance'=p_instance) for update;
 if c.id is null then return;end if;
 select * into g from public.whatsapp_care_groups where id=c.group_id for update;
 if not(p_jids ? (substring(c.customer_phone from 2)||'@s.whatsapp.net')) and not exists(select 1 from jsonb_array_elements(g.observed_participants) m where m->>'jid'=substring(c.customer_phone from 2)||'@s.whatsapp.net' and p_jids ? (m->>'providerJid')) then return;end if;
 insert into public.whatsapp_care_events(event_key,group_id,kind) values(p_event_key,g.id,'customer.departure') on conflict do nothing;if not found then return;end if;
 update public.whatsapp_care_cycles set state=case when state in ('closed','closing') then state else 'customer_left' end,observed_at=null,next_run_at=now(),reason='customer_absent' where id=c.id;
 update public.whatsapp_care_groups set state=case when state='closed' then state else 'customer_left' end,controls_verified=false,entry_pending=false,observed_at=null,version=version+1,reason='customer_absent' where id=g.id;
 delete from public.whatsapp_care_invites where group_id=g.id;
end $$;
-- Delta restritivo/nome continua seguro na nº112. Outros campos invalidam, sem descartar.
-- Essa função já chama care_group_event dinamicamente; não copiar nem enfraquecer a lista.
notify pgrst,'reload schema';
