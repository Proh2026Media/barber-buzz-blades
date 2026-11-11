-- Reversão operacional da nº 106: ensaiar localmente; não é autorização de produção.
-- Preserva grupos, consentimento e o bloqueio de fallback individual.
begin;
select pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
update public.whatsapp_group_settings set enrollment_enabled=false;
update public.whatsapp_care_groups set controls_verified=false,version=version+1,
  state=case when state in ('closed','customer_left','creation_unknown') then state else 'paused_unavailable' end,
  reason='operator_pause';
delete from public.whatsapp_care_invites;
update public.whatsapp_care_operations set state='blocked' where state='pending';
insert into public.whatsapp_care_audit(action) values('operational_rollback');
commit;
