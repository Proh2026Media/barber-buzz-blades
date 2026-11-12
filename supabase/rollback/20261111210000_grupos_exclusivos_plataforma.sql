-- Reversão operacional da nº 108, somente local até autorização de implantação.
-- Não restaura OTP privado, profissionais ou permissões anteriores.
begin;
select pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
update public.whatsapp_group_settings set login_enabled=false,enrollment_enabled=false;
update public.whatsapp_care_groups set controls_verified=false,version=version+1,
  state=case when state in ('closed','customer_left','creation_unknown') then state else 'paused_unavailable' end,
  reason='operator_pause';
delete from public.whatsapp_care_invites;
update public.whatsapp_care_operations set state='blocked' where state='pending';
insert into public.whatsapp_care_audit(action) values('exclusive_login_rollback');
commit;
