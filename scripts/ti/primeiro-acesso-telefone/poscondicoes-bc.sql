-- Leitura apenas. Mantém piloto, distribuição e automação novos desligados.
do $$begin
 if to_regprocedure('public.care_phone_revision_start(uuid,uuid,bigint,text,uuid[],boolean)') is null
  or to_regprocedure('public.care_phone_revision_invite(uuid,uuid)') is null
  or to_regprocedure('public.continue_care_phone_revision(uuid,uuid)') is null then raise exception 'BC_CONTRATO_TELEFONE_AUSENTE';end if;
 if not exists(select 1 from public.whatsapp_send_controls where scope='global' and paused)
  or exists(select 1 from public.whatsapp_care_cycle_policy where enabled or assisted_access_enabled)
  or exists(select 1 from public.whatsapp_distribution_policy where enabled) then raise exception 'BC_MANTER_POLITICAS_DESLIGADAS';end if;
 if has_table_privilege('authenticated','public.whatsapp_phone_revisions','select') or has_table_privilege('service_role','public.whatsapp_phone_aliases','insert')
  or has_function_privilege('anon','public.care_phone_revision_start(uuid,uuid,bigint,text,uuid[],boolean)','execute')
  or has_function_privilege('authenticated','public.record_care_phone_revision(uuid,uuid,uuid,jsonb,text)','execute') then raise exception 'BC_PRIVILEGIOS_INESPERADOS';end if;
 if not has_function_privilege('authenticated','public.care_phone_revision_invite(uuid,uuid)','execute')
  or not has_function_privilege('service_role','public.claim_care_phone_revision(uuid,uuid)','execute') then raise exception 'BC_PRIVILEGIOS_AUSENTES';end if;
end $$;
