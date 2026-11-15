do $$begin
 if not exists(select 1 from public.whatsapp_care_cycle_policy where not enabled)
  or not exists(select 1 from public.whatsapp_distribution_policy where not enabled) then raise exception 'BC_POLITICA_DEVE_NASCER_DESLIGADA';end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='whatsapp_number_links' and column_name='backup2_channel_id') then raise exception 'BC_TRES_POSICOES_AUSENTES';end if;
 if has_table_privilege('authenticated','public.whatsapp_care_cycles','select') or has_table_privilege('service_role','public.whatsapp_care_cycles','select')
  or has_function_privilege('authenticated','public.queue_care_cycles()','execute') then raise exception 'BC_PRIVILEGIO_INDEVIDO';end if;
 if (public.authorize_whatsapp_send('nao-executar')->>'reason') is distinct from 'protected_group_contract_required' then raise exception 'BC_SAIDA_ANTIGA_NAO_BLOQUEADA';end if;
end $$;
