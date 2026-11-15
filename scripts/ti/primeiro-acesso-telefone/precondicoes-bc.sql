-- Leitura da base instalada em 15/11 às 15:00:34 BRT; nunca adapta a base silenciosamente.
do $$begin
 if to_regprocedure('public.care_access_start(uuid,text,uuid[],boolean,uuid,bigint)') is not null
  or to_regclass('public.whatsapp_phone_revisions') is not null then raise exception 'BC_INCREMENTAL_JA_EXISTE';end if;
 if to_regprocedure('public.record_care_cycle_observation_before_post_entry(uuid,uuid,jsonb,jsonb,text)') is null then raise exception 'BC_ACOLHIMENTO_INSTALADO_AUSENTE';end if;
 if (select md5(prosrc) from pg_proc where oid='public.care_group_read(uuid,uuid)'::regprocedure) is distinct from '4b358eb1adb5aadbda8f2ee0352831be'
  or (select md5(prosrc) from pg_proc where oid='public.record_care_cycle_observation(uuid,uuid,jsonb,jsonb,text)'::regprocedure) is distinct from '65d6e5973a2a64a1318f485c50243e68' then raise exception 'BC_BASE_INSTALADA_DIVERGENTE';end if;
 if not exists(select 1 from public.whatsapp_send_controls where scope='global' and paused)
  or exists(select 1 from public.whatsapp_care_cycle_policy where enabled)
  or exists(select 1 from public.whatsapp_distribution_policy where enabled) then raise exception 'BC_PAUSAR_GRUPOS_DISTRIBUICAO_E_EGRESSO';end if;
 if exists(select 1 from public.whatsapp_care_cycles where lease_until>clock_timestamp())
  or exists(select 1 from public.whatsapp_outbox where status='sending')
  or exists(select 1 from public.whatsapp_send_attempts where state='started' and started_at>clock_timestamp()-interval '2 minutes') then raise exception 'BC_AGUARDAR_OPERACOES_EM_ANDAMENTO';end if;
end $$;
