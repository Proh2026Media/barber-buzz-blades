-- Etapa operacional explícita. Não limpa fila, licença incerta, restrição ou histórico.
begin;
select pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
update public.whatsapp_send_controls set paused=true,reason='review',changed_by=null,changed_at=now(),version=version+1 where scope='global';
insert into public.whatsapp_send_control_history(scope,paused,reason) values('global',true,'review');
do $$begin
 if to_regclass('public.whatsapp_care_cycle_policy') is not null then update public.whatsapp_care_cycle_policy set enabled=false,version=version+1,changed_at=now();end if;
 if to_regclass('public.whatsapp_distribution_policy') is not null then update public.whatsapp_distribution_policy set enabled=false,version=version+1;end if;
end $$;
commit;
