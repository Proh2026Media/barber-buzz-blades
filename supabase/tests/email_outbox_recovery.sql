-- Regressão: fila de e-mail recupera envios interrompidos e não manda aviso vencido.
-- Rode depois de 20260929150000_email_outbox_recovery.sql, numa transação; sempre ROLLBACK.
create temporary table mail_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() stale_id, gen_random_uuid() old_id,
  gen_random_uuid() fresh_id, gen_random_uuid() tired_id;
grant select on mail_ctx to service_role;

create function pg_temp.check_mail(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

insert into public.barbershops(id, name, slug)
select shop_id, 'Mail test', 'mail-' || shop_id from mail_ctx;

insert into public.email_outbox(id, barbershop_id, to_email, template_key, subject, body, dedupe_key, status, attempts, scheduled_at, claimed_at)
select stale_id, shop_id, 'a@example.invalid', 't', 's', 'b', 'k1-' || stale_id, 'sending'::public.email_outbox_status, 1, now() - interval '1 hour', now() - interval '20 minutes' from mail_ctx union all
select old_id, shop_id, 'b@example.invalid', 't', 's', 'b', 'k2-' || old_id, 'sending', 1, now() - interval '5 days', null from mail_ctx union all
select fresh_id, shop_id, 'c@example.invalid', 't', 's', 'b', 'k3-' || fresh_id, 'pending', 0, now() - interval '1 minute', null from mail_ctx union all
select tired_id, shop_id, 'd@example.invalid', 't', 's', 'b', 'k4-' || tired_id, 'pending', 4, now() - interval '1 minute', null from mail_ctx;

set local role service_role;
create temporary table mail_claimed as select * from public.claim_email_outbox(50);
reset role;

select pg_temp.check_mail(
  (select status from public.email_outbox e join mail_ctx c on e.id = c.old_id) = 'failed',
  'E-mail com mais de 24h de atraso é descartado');
select pg_temp.check_mail(
  exists (select 1 from mail_claimed m join mail_ctx c on m.id = c.stale_id where m.attempts = 2),
  'Envio interrompido há mais de 10 minutos volta e é tentado de novo');
select pg_temp.check_mail(
  exists (select 1 from mail_claimed m join mail_ctx c on m.id = c.fresh_id and m.claimed_at is not null),
  'Envio reservado guarda o horário');

set local role service_role;
select public.complete_email_outbox(c.fresh_id, false, 'falhou') from mail_ctx c;
select public.complete_email_outbox(c.tired_id, false, 'falhou') from mail_ctx c;
select public.complete_email_outbox(c.stale_id, true, null) from mail_ctx c;
reset role;

select pg_temp.check_mail(
  (select status = 'pending' and scheduled_at > now() from public.email_outbox e join mail_ctx c on e.id = c.fresh_id),
  'Falha volta à fila com intervalo antes da nova tentativa');
select pg_temp.check_mail(
  (select status from public.email_outbox e join mail_ctx c on e.id = c.tired_id) = 'failed',
  'Na quinta falha o e-mail desiste');
select pg_temp.check_mail(
  (select status = 'sent' and sent_at is not null from public.email_outbox e join mail_ctx c on e.id = c.stale_id),
  'Envio concluído é marcado como enviado');
