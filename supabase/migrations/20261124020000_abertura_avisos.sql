-- O token aleatório de cada envio fica fora das tabelas consultáveis pela loja.
create table public.notice_receipts (
 token uuid primary key default gen_random_uuid(),
 push_id uuid unique,
 appointment_id uuid references public.appointments on delete cascade,
 kind text,
 queued_at timestamptz,
 sent_at timestamptz,
 email_id uuid unique references public.email_outbox on delete cascade,
 opened_at timestamptz,
 check (num_nonnulls(push_id,email_id)=1)
);
alter table public.notice_receipts enable row level security;
revoke all on public.notice_receipts from public, anon, authenticated;

create function public.email_open_token(p_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 insert into notice_receipts(email_id)
 select e.id from email_outbox e join appointments a on a.id::text=e.payload->>'appointment_id'
 and a.barbershop_id=e.barbershop_id
 where e.id=p_id and e.status='sending' and lower(e.to_email)=lower(customer_auth_email(a.customer_id))
 on conflict(email_id) do update set email_id=excluded.email_id returning token into result;
 return result;
end $$;
create function public.web_push_authorize_receipt(p_id uuid,p_lease uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare ctx jsonb; receipt uuid;
begin
 ctx:=web_push_authorize(p_id,p_lease);
 if ctx->>'target'='/app' and ctx->>'kind'<>'test' then
   insert into notice_receipts(push_id,appointment_id,kind,queued_at)
   select q.id,q.appointment_id,q.kind,q.created_at from web_push_queue q
   join appointments a on a.id=q.appointment_id
   join web_push_subscriptions s on s.id=q.subscription_id and s.user_id=a.customer_id
   where q.id=p_id returning token into receipt;
   return ctx || jsonb_build_object('receipt',receipt);
 end if;
 return ctx;
end $$;
revoke all on function public.email_open_token(uuid), public.web_push_authorize_receipt(uuid,uuid) from public,anon,authenticated;
grant execute on function public.email_open_token(uuid), public.web_push_authorize_receipt(uuid,uuid) to service_role;

create function public.record_notice_open(p_token uuid,p_channel text) returns void
language sql security definer set search_path=public as $$
 update notice_receipts set opened_at=now() where token=p_token and opened_at is null
 and ((p_channel='email' and email_id is not null) or (p_channel='push' and push_id is not null))
$$;
revoke all on function public.record_notice_open(uuid,text) from public;
grant execute on function public.record_notice_open(uuid,text) to anon,authenticated;

-- A fila operacional expira em sete dias. O histórico acompanha a vida do agendamento.
create index notice_receipts_appointment on public.notice_receipts(appointment_id) where appointment_id is not null;
create function public.save_push_receipt_sent() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update notice_receipts set sent_at=new.finished_at where push_id=new.id;
 return new;
end $$;
revoke all on function public.save_push_receipt_sent() from public;
create trigger save_push_receipt_sent after update of state on public.web_push_queue
for each row when (new.state='accepted') execute function public.save_push_receipt_sent();

create function public.appointment_notice_history(p_appointment uuid) returns table
(channel text,kind text,state text,created_at timestamptz,sent_at timestamptz,opened_at timestamptz)
language sql stable security definer set search_path=public as $$
 with allowed as (
 select a.* from appointments a where a.id=p_appointment and
 (can_view_full_shop(a.barbershop_id) or a.staff_id=current_staff_id(a.barbershop_id))
 )
 select 'push',q.kind,q.state,q.created_at,case when q.state='accepted' then q.finished_at end,r.opened_at
 from allowed a join web_push_queue q on q.appointment_id=a.id and q.target='/app'
 join web_push_subscriptions s on s.id=q.subscription_id and s.user_id=a.customer_id
 left join notice_receipts r on r.push_id=q.id
 union all
 select 'push',r.kind,case when r.sent_at is null then 'unknown' else 'accepted' end,r.queued_at,r.sent_at,r.opened_at
 from allowed a join notice_receipts r on r.appointment_id=a.id
 where not exists(select 1 from web_push_queue q where q.id=r.push_id)
 union all
 select 'email',e.template_key,e.status::text,e.created_at,e.sent_at,r.opened_at
 from allowed a join email_outbox e on e.barbershop_id=a.barbershop_id and e.payload->>'appointment_id'=a.id::text
 and lower(e.to_email)=lower(customer_auth_email(a.customer_id))
 left join notice_receipts r on r.email_id=e.id
 order by 4 desc
$$;
revoke all on function public.appointment_notice_history(uuid) from public,anon;
grant execute on function public.appointment_notice_history(uuid) to authenticated;

notify pgrst, 'reload schema';
