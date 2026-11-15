-- Somente conferência; base P-122/v5 completa e pausada, sem atualização parcial.
do $$begin
 if to_regclass('public.whatsapp_care_cycle_policy') is null or to_regclass('public.whatsapp_care_registry') is null then raise exception 'BC_BASE_V5_AUSENTE';end if;
 if to_regprocedure('public.record_care_cycle_observation_before_post_entry(uuid,uuid,jsonb,jsonb,text)') is not null then raise exception 'BC_INCREMENTAL_JA_EXISTE';end if;
 if exists(select 1 from public.whatsapp_care_cycle_policy where enabled) or not exists(select 1 from public.whatsapp_send_controls where scope='global' and paused) then raise exception 'BC_PAUSAR_GRUPOS_E_EGRESSO';end if;
 if md5(pg_get_functiondef('public.care_cycle_send_ready(uuid)'::regprocedure))<>'506b1cb985d07bc95dd68a21f30adc54'
  or md5(pg_get_functiondef('public.whatsapp_group_login_context(uuid,text,boolean)'::regprocedure))<>'82652f78751731d39bacc30941c206a2'
  or md5(pg_get_functiondef('public.record_care_cycle_observation(uuid,uuid,jsonb,jsonb,text)'::regprocedure))<>'5e237144f63d72b44e685b75c7a113b8'
  or md5(pg_get_functiondef('public.whatsapp_group_notice_context(uuid,uuid)'::regprocedure))<>'23d25d79aee1bd93006ccb7a126b901f' then raise exception 'BC_BASE_V5_DIVERGENTE';end if;
 if exists(select 1 from public.whatsapp_care_cycles where lease_until>clock_timestamp())
  or exists(select 1 from public.whatsapp_outbox where status='sending')
  or exists(select 1 from public.whatsapp_send_attempts where state='started' and started_at>clock_timestamp()-interval '2 minutes') then raise exception 'BC_AGUARDAR_OPERACOES_EM_ANDAMENTO';end if;
end $$;
