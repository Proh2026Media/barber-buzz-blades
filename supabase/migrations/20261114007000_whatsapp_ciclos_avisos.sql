-- D4 local: avisos de clientes finais somente no grupo protegido. Sem fallback privado.
create function public.whatsapp_group_notice_context(p_outbox_id uuid,p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.whatsapp_outbox%rowtype;g public.whatsapp_care_groups%rowtype;c public.whatsapp_care_cycles%rowtype;person uuid;candidate jsonb;sender text;kind text;
begin
 select * into o from public.whatsapp_outbox where id=p_outbox_id and status='sending' and lease_token=p_lease_token and lease_until>clock_timestamp() and delivery_started_at is null;
 if o.id is null then return null;end if;
 person:=public.whatsapp_recipient(o.barbershop_id,o.payload);
 select * into g from public.whatsapp_care_groups where barbershop_id=o.barbershop_id and customer_id=person;
 if g.id is null or not public.care_cycle_send_ready(g.id) then return null;end if;
 kind:=public.whatsapp_message_kind(o.template_key);
 if (kind='transactional' and not g.notifications) or (kind='marketing' and not public.care_marketing_allowed(person,o.communication_key))
  or exists(select 1 from public.whatsapp_customer_contact_preferences where customer_id=person and proactive_paused) then return null;end if;
 candidate:=public.whatsapp_send_candidate(o.id,p_lease_token,null,null,null);
 if candidate is null then return null;end if;
 select * into c from public.whatsapp_care_cycles where id=g.current_cycle_id;
 select n->>'phone' into sender from jsonb_array_elements(c.consented_numbers) n where n->>'instance'=candidate->>'instance_name';
 if sender is null then return null;end if;
 return jsonb_build_object('group_id',g.id,'group_jid',g.group_jid,'version',g.version,'cycle_id',c.id,'cycle_revision',c.revision,'cycle_expires_at',c.expires_at,'first_message_id',c.first_message_id,
  'creator_phone',(select n->>'phone' from jsonb_array_elements(c.consented_numbers) n where n->>'instance'=c.creator_instance),'instance_name',candidate->>'instance_name','customer_phone',c.customer_phone,
  'platform_phones',(select jsonb_agg(n->>'phone' order by n->>'phone') from jsonb_array_elements(c.consented_numbers) n),'sender_phone',sender,'template_key',o.template_key);
end $$;
create function public.care_cycle_client_text(p_shop uuid,p_body text) returns text language plpgsql stable security definer set search_path=public as $$
declare name text;body text;
begin
 select coalesce(nullif(trim(s.display_name),''),b.name) into name from public.barbershops b join public.barbershop_settings s on s.barbershop_id=b.id where b.id=p_shop;
 if name is null or p_body is null then return null;end if;
 body:=regexp_replace(p_body,'Barba[[:space:]]*&[[:space:]]*Cabelo|\mB&C\M',replace(name,chr(92),chr(92)||chr(92)),'gi');
 if left(body,length('['||name||']'||chr(10)))<>'['||name||']'||chr(10) then body:='['||name||']'||chr(10)||body;end if;
 return body;
end $$;
create function public.authorize_whatsapp_group_notice(p_outbox_id uuid,p_lease_token uuid,p_expected jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare context jsonb;permit jsonb;notice_body text;shop uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));
 context:=public.whatsapp_group_notice_context(p_outbox_id,p_lease_token);
 if context is null or context is distinct from p_expected then return null;end if;
 select barbershop_id into shop from public.whatsapp_outbox where id=p_outbox_id for update;
 insert into public.whatsapp_group_delivery_routes(outbox_id,group_id,group_version,instance_name) values(p_outbox_id,(context->>'group_id')::uuid,(context->>'version')::bigint,context->>'instance_name') on conflict do nothing;
 permit:=public.authorize_whatsapp_send_before_groups(context->>'instance_name',p_outbox_id,p_lease_token,null,null,null);
 if permit->>'attempt_id' is null then return null;end if;
 notice_body:=public.care_cycle_client_text(shop,permit->>'body');
 -- A exceção desfaz inclusive a licença; nenhum transporte aconteceu.
 if notice_body is null or length(notice_body)>2000 then raise exception 'GROUP_NOTICE_INVALID';end if;
 update public.whatsapp_outbox set body=notice_body where id=p_outbox_id;
 return (permit-'to_e164')||context||jsonb_build_object('body',notice_body);
end $$;
-- Autorizações antigas também não podem produzir uma mensagem privada de cliente.
create or replace function public.authorize_whatsapp_send(p_expected_instance text,p_outbox_id uuid default null,p_lease_token uuid default null,p_challenge_id uuid default null,p_instance text default null,p_code_hash text default null) returns jsonb
language sql security definer set search_path=public as $$select jsonb_build_object('reason','protected_group_contract_required');$$;
revoke all on function public.whatsapp_group_notice_context(uuid,uuid),public.authorize_whatsapp_group_notice(uuid,uuid,jsonb),public.care_cycle_client_text(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.whatsapp_group_notice_context(uuid,uuid),public.authorize_whatsapp_group_notice(uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
