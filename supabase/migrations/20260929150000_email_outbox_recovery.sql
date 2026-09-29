-- Fila de e-mail resiliente: recupera envios interrompidos, tenta de novo com intervalo
-- e não manda aviso vencido (mais de 24h de atraso).

alter table public.email_outbox
  add column if not exists claimed_at timestamptz;

create or replace function public.claim_email_outbox(p_limit integer default 20)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.email_outbox
  set status = 'failed', error = 'Não enviado a tempo (mais de 24 horas de atraso).'
  where status in ('pending', 'sending')
    and scheduled_at < now() - interval '24 hours';

  -- Envio que caiu no meio (função reiniciada, servidor de e-mail travou) volta à fila.
  update public.email_outbox
  set
    status = case when attempts >= 5 then 'failed'::public.email_outbox_status else 'pending'::public.email_outbox_status end,
    error = coalesce(error, 'Envio interrompido; nova tentativa agendada.')
  where status = 'sending'
    and coalesce(claimed_at, scheduled_at) < now() - interval '10 minutes';

  return query
  with picked as (
    select id
    from public.email_outbox
    where status = 'pending' and scheduled_at <= now() and attempts < 5
    order by scheduled_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  )
  update public.email_outbox e
  set status = 'sending', attempts = e.attempts + 1, claimed_at = now()
  from picked
  where e.id = picked.id
  returning e.*;
end;
$$;

create or replace function public.complete_email_outbox(
  p_id uuid,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.email_outbox
  set
    status = case
      when p_ok then 'sent'::public.email_outbox_status
      when attempts >= 5 then 'failed'::public.email_outbox_status
      else 'pending'::public.email_outbox_status
    end,
    sent_at = case when p_ok then now() else sent_at end,
    scheduled_at = case
      when p_ok or attempts >= 5 then scheduled_at
      else greatest(scheduled_at, now() + make_interval(mins => 5 * attempts))
    end,
    error = case when p_ok then null else left(coalesce(p_error, 'erro'), 500) end
  where id = p_id and status = 'sending';
end;
$$;

revoke all on function public.claim_email_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer) to service_role;
revoke all on function public.complete_email_outbox(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.complete_email_outbox(uuid, boolean, text) to service_role;

notify pgrst, 'reload schema';
