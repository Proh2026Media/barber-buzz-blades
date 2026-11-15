-- Incremental: não renomear/reaplicar as migrations já instaladas.
-- Quatro transmissões concorrentes; pausas, leases e incerteza preservados.
create or replace function public.web_push_claim() returns table(id uuid,lease uuid) language plpgsql security definer set search_path=public as $$
begin
 delete from web_push_queue q where q.created_at<now()-interval '7 days';
 delete from web_push_subscriptions s where s.expires_at<=now();
 update web_push_queue q set state='unknown',finished_at=now() where q.state='processing' and q.claimed_at<now()-interval '5 minutes';
 update web_push_queue q set state='expired',finished_at=now() where q.state='queued' and q.expires_at<=now();
 if not (select enabled from web_push_settings) then return; end if;
 return query with picked as (select q.id from web_push_queue q where q.state='queued' and q.expires_at>now() order by q.created_at limit 4 for update skip locked)
 update web_push_queue q set state='processing',lease=gen_random_uuid(),claimed_at=now() from picked p where q.id=p.id returning q.id,q.lease;
end $$;

revoke all on function public.web_push_claim() from public,anon,authenticated;
grant execute on function public.web_push_claim() to service_role;
