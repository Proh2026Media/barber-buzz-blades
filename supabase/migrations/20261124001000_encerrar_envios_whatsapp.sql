-- O gatilho de agendamento também cria e-mail. Mantém seu contrato, encerrando apenas a fila WhatsApp.
create or replace function public.enqueue_whatsapp_message(
  p_shop_id uuid, p_to_e164 text, p_template_key text, p_body text,
  p_dedupe_key text, p_payload jsonb default '{}'::jsonb, p_scheduled_at timestamptz default now()
) returns uuid language sql as $$ select null::uuid $$;

update public.whatsapp_send_controls set paused=true,reason='maintenance',changed_at=now(),version=version+1
where scope='global' and not paused;
update public.whatsapp_care_cycle_policy set enabled=false,assisted_access_enabled=false,background_access_enabled=false
where singleton;
