-- Somente leitura. Executar na mesma transação que os incrementais, sob pausa.
do $$begin
 if md5(pg_get_functiondef('public.platform_whatsapp_directory()'::regprocedure))<>'65502cdc1d40c2ed2b964c1f0c178601'
  or md5(pg_get_functiondef('public.care_group_admin(text,jsonb)'::regprocedure))<>'d6fb57ea77ee79865893fc125e73d81f'
  or md5(pg_get_functiondef('public.register_my_barbershop(uuid,text,text,text,boolean,text,text,text)'::regprocedure))<>'f7e4c4482a6b36a3f4ffda891fc23698' then raise exception 'BC_BASE_D0_DIVERGENTE';end if;
 if to_regclass('public.whatsapp_care_cycle_policy') is not null or to_regclass('public.whatsapp_distribution_policy') is not null then raise exception 'BC_INCREMENTAL_JA_EXISTE';end if;
 if not exists(select 1 from public.whatsapp_send_controls where scope='global' and paused) then raise exception 'BC_PAUSA_GLOBAL_NECESSARIA';end if;
 if exists(select 1 from public.whatsapp_outbox where status='sending')
  or exists(select 1 from public.whatsapp_send_attempts where state='started' and started_at>clock_timestamp()-interval '2 minutes') then raise exception 'BC_ENVIO_EM_ANDAMENTO_NAO_LIMPAR';end if;
end $$;
