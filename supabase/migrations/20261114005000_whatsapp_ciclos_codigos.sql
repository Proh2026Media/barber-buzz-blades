-- A observação persistida não transmite: emissores fazem leitura viva e a extensão
-- revalida imediatamente antes do envio. Não criar uma janela artificial de 30s por grupo.
-- D4 local: códigos só após ciclo v3 observado e composição inteira sob controle.
create function public.care_cycle_send_ready(p_group uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.whatsapp_care_groups g join public.whatsapp_care_cycles c on c.id=g.current_cycle_id
 where g.id=p_group and g.state='active' and g.controls_verified and g.revoked_at is null and not g.entry_pending
  and c.state='active' and c.prepared and c.first_received and c.first_message_id is not null
  and c.observed_at is not null and (c.observation->>'pin_expires_at')::timestamptz>clock_timestamp()
  and public.care_cycle_available(c.id));
$$;
alter function public.whatsapp_group_login_context(uuid,text,boolean) rename to whatsapp_group_login_context_before_cycles;
revoke all on function public.whatsapp_group_login_context_before_cycles(uuid,text,boolean) from public,anon,authenticated,service_role;
create function public.whatsapp_group_login_context(p_challenge_id uuid,p_code_hash text,p_unused boolean default true) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;c public.whatsapp_care_cycles%rowtype;
begin
 result:=public.whatsapp_group_login_context_before_cycles(p_challenge_id,p_code_hash,p_unused);
 if result is null or not public.care_cycle_send_ready((result->>'group_id')::uuid) then return null;end if;
 select x.* into c from public.whatsapp_care_cycles x join public.whatsapp_care_groups g on g.current_cycle_id=x.id where g.id=(result->>'group_id')::uuid;
 if jsonb_array_length(c.consented_numbers)<2 or exists(select 1 from jsonb_array_elements(c.consented_numbers) n where not (result->'platform_phones' ? (n->>'phone'))) then return null;end if;
 return result||jsonb_build_object('cycle_id',c.id,'cycle_revision',c.revision,'cycle_expires_at',c.expires_at,'first_message_id',c.first_message_id,
  'creator_phone',(select n->>'phone' from jsonb_array_elements(c.consented_numbers) n where n->>'instance'=c.creator_instance));
end $$;
revoke all on function public.care_cycle_send_ready(uuid),public.whatsapp_group_login_context(uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.whatsapp_group_login_context(uuid,text,boolean) to service_role;

-- Escolher apenas um grupo realmente utilizável. Um grupo antigo de outra loja não
-- impede o mesmo titular de confirmar o telefone ou acessar por um grupo elegível.
create or replace function public.request_whatsapp_group_login(p_destination text,p_code_hash text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;g public.whatsapp_care_groups%rowtype;instance text;
begin
 result:=public.request_whatsapp_login_once(p_destination,p_code_hash,p_request_id);
 if result->>'challenge_id' is null or exists(select 1 from public.whatsapp_group_login_routes where challenge_id=(result->>'challenge_id')::uuid) then return result;end if;
 if (select enrollment_enabled and login_enabled from public.whatsapp_group_settings) then
  select * into g from public.whatsapp_care_groups x where x.customer_id=(result->>'user_id')::uuid and x.customer_phone=p_destination and public.care_cycle_send_ready(x.id) order by x.requested_at,x.id limit 1;
  if g.id is not null then
   select n.instance_name into instance from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.id=g.account_id;
   update public.auth_otp_challenges set expires_at=least(expires_at,(select expires_at from public.whatsapp_care_cycles where id=g.current_cycle_id)) where id=(result->>'challenge_id')::uuid;
   insert into public.whatsapp_group_login_routes(challenge_id,group_id,version,instance_name) values((result->>'challenge_id')::uuid,g.id,g.version,instance) on conflict do nothing;
  end if;
 end if;
 return result;
end $$;
create or replace function public.request_whatsapp_group_phone(p_user uuid,p_destination text,p_code_hash text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;challenge uuid;instance text;
begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 if not (select enrollment_enabled and login_enabled from public.whatsapp_group_settings) or not (select enabled from public.whatsapp_care_cycle_policy) then raise exception 'GROUP_UNAVAILABLE';end if;
 if p_code_hash is null or p_code_hash !~ '^[a-f0-9]{64}$' or p_request_id is null then raise exception 'GROUP_INVALID';end if;
 if exists(select 1 from public.auth_otp_challenges where request_id=p_request_id) then raise exception 'WA_REQUEST_ALREADY_USED';end if;
 if (select count(*) from public.auth_otp_challenges where user_id=p_user and channel='whatsapp' and created_at>now()-interval '15 minutes')>=5
  or exists(select 1 from public.auth_otp_challenges where user_id=p_user and channel='whatsapp' and created_at>now()-interval '1 minute') then raise exception 'WA_RATE_LIMIT';end if;
 select * into g from public.whatsapp_care_groups x where x.customer_id=p_user and x.customer_phone=p_destination and public.care_cycle_send_ready(x.id) order by x.requested_at,x.id limit 1;
 if g.id is null then raise exception 'GROUP_UNAVAILABLE';end if;
 select n.instance_name into instance from public.whatsapp_group_accounts a join public.whatsapp_channels n on n.id=a.channel_id where a.id=g.account_id;
 insert into public.auth_otp_challenges(request_id,user_id,channel,destination,code_hash,purpose,expires_at) values(p_request_id,p_user,'whatsapp',p_destination,p_code_hash,'verify_phone',least(now()+interval '10 minutes',(select expires_at from public.whatsapp_care_cycles where id=g.current_cycle_id))) returning id into challenge;
 insert into public.whatsapp_group_login_routes(challenge_id,group_id,version,instance_name) values(challenge,g.id,g.version,instance);
 return jsonb_build_object('challenge_id',challenge);
end $$;
notify pgrst,'reload schema';
