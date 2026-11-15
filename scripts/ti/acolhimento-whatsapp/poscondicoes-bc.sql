do $$begin
 if exists(select 1 from public.whatsapp_care_cycle_policy where enabled)
  or exists(select 1 from public.whatsapp_care_cycles where admission_welcome_id is not null or admission_welcome_message_id is not null)
  or has_function_privilege('service_role','public.record_care_cycle_observation_before_post_entry(uuid,uuid,jsonb,jsonb,text)','execute')
  or has_function_privilege('authenticated','public.record_care_cycle_observation(uuid,uuid,jsonb,jsonb,text)','execute')
  or not has_function_privilege('service_role','public.record_care_cycle_observation(uuid,uuid,jsonb,jsonb,text)','execute') then raise exception 'BC_POS_CONDICOES_DIVERGENTES';end if;
end $$;
