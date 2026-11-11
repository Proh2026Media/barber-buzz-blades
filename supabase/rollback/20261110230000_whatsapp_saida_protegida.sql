-- Reversão OPERACIONAL da nº 105: interrompe novos envios, preservando evidências.
-- Não é downgrade de esquema. Executar só após autorização de operação na produção.
-- Não elimina tentativas/desafios, não reabre resultados incertos e não religa emissores antigos.
begin;
select pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
insert into public.whatsapp_send_controls(scope,paused,reason)
values('global',true,'maintenance')
on conflict(scope) do update set paused=true,reason='maintenance',changed_by=null,
  changed_at=clock_timestamp(),version=whatsapp_send_controls.version+1;
insert into public.whatsapp_send_control_history(scope,paused,reason)
values('global',true,'maintenance');
commit;
