-- NULL identifica tentativas antigas cujo início do SMTP é desconhecido.
alter table public.email_outbox add column smtp_started boolean;

create or replace function public.claim_email_outbox(p_limit int default 20)
returns setof public.email_outbox language plpgsql security definer set search_path=public as $$
declare e public.email_outbox%rowtype; b public.client_communication_budget%rowtype;
begin
  update public.email_outbox set status='failed',error='Não enviado a tempo (mais de 24 horas de atraso).'
    where status='pending' and scheduled_at<now()-interval '24 hours';
  update public.email_outbox set status=case when smtp_started is distinct from false or attempts>=5 or template_key in ('notice.slot_open','notice.shop_hello')
      then 'failed'::public.email_outbox_status else 'pending'::public.email_outbox_status end,
    error=case when smtp_started is distinct from false then 'Entrega incerta. Conferir antes de reenviar.' else 'Envio interrompido antes do SMTP.' end
    where status='sending' and coalesce(claimed_at,scheduled_at)<now()-interval '10 minutes';
  for e in select * from public.email_outbox where status='pending' and scheduled_at<=now() and attempts<5
    order by case when template_key in ('notice.slot_open','notice.shop_hello') then 1 else 0 end,scheduled_at,id
    limit greatest(1,least(coalesce(p_limit,20),50)) for update skip locked
  loop
    if e.template_key in ('notice.slot_open','notice.shop_hello') then
      select * into b from public.client_communication_budget where event_key=e.payload->>'communication_key';
      if b.event_key is null then
        update public.email_outbox set status='failed',error='Comunicação sem autorização atual' where id=e.id; continue;
      end if;
      perform pg_advisory_xact_lock(hashtextextended(b.customer_id::text,116));
      if b.expires_at<=now() or not exists(select 1 from public.customer_privacy where user_id=b.customer_id and marketing)
        or (b.attempted_at is null and (select count(*) from public.client_communication_budget where customer_id=b.customer_id
          and event_key<>b.event_key and attempted_at>now()-interval '7 days')>=2) then
        update public.email_outbox set status='failed',error='Comunicação recusada, expirada ou limitada' where id=e.id; continue;
      end if;
      update public.client_communication_budget set attempted_at=coalesce(attempted_at,now()) where event_key=b.event_key;
    end if;
    update public.email_outbox set status='sending',attempts=attempts+1,claimed_at=now(),smtp_started=null where id=e.id returning * into e;
    return next e;
  end loop;
end $$;

create function public.claim_email_dispatch(p_limit integer)
returns setof public.email_outbox language plpgsql security definer set search_path=public as $$
declare e public.email_outbox%rowtype;
begin
  for e in select * from public.claim_email_outbox(p_limit) loop
    update public.email_outbox set smtp_started=false where id=e.id returning * into e;
    return next e;
  end loop;
end $$;

create function public.start_email_smtp(p_id uuid,p_attempt integer)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.email_outbox set smtp_started=true
    where id=p_id and status='sending' and attempts=p_attempt and smtp_started=false
      and claimed_at>now()-interval '10 minutes';
  return found;
end $$;

create function public.finish_email_dispatch(p_id uuid,p_attempt integer,p_result text)
returns boolean language plpgsql security definer set search_path=public as $$
declare e public.email_outbox%rowtype;
begin
  select * into e from public.email_outbox where id=p_id and attempts=p_attempt for update;
  if not found then return false; end if;
  if p_result='aceito' and e.smtp_started and e.status='sent' then return true; end if;
  if p_result='aceito' and e.smtp_started and (e.status='sending' or
      (e.status='failed' and e.error='Entrega incerta. Conferir antes de reenviar.')) then
    update public.email_outbox set status='sent',sent_at=now(),error=null where id=e.id;
  elsif p_result='incerto' and e.status='sending' and e.smtp_started then
    update public.email_outbox set status='failed',error='Entrega incerta. Conferir antes de reenviar.' where id=e.id;
  elsif p_result='antes_smtp' and e.status='sending' and e.smtp_started=false then
    perform public.complete_email_outbox(e.id,false,'Falha antes do envio ao SMTP.');
  else return false;
  end if;
  return true;
end $$;

revoke all on function public.claim_email_dispatch(integer),public.start_email_smtp(uuid,integer),
  public.finish_email_dispatch(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.claim_email_dispatch(integer),public.start_email_smtp(uuid,integer),
  public.finish_email_dispatch(uuid,integer,text) to service_role;
notify pgrst,'reload schema';
