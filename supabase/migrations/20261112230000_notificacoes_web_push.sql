-- Web Push: opt-in por aparelho/sessão. Nasce desligado; nenhum envio retroativo.
create table public.web_push_settings (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false
);
insert into public.web_push_settings values(true,false);
create table public.web_push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 session_id uuid not null references auth.sessions on delete cascade,
 endpoint text not null unique check(length(endpoint)<=2048 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.(notify|wns)\.windows\.com)/[^[:space:]]+$'),
 p256dh text not null check(p256dh ~ '^[A-Za-z0-9_-]{87}$'), auth_key text not null check(auth_key ~ '^[A-Za-z0-9_-]{22}$'),
 origin text not null check(length(origin)<=255), locale text not null check(locale in ('pt-BR','pt-PT','en-US','en-GB','es')),
 enabled boolean not null default true, expires_at timestamptz not null default now()+interval '90 days',
 created_at timestamptz not null default now(), last_test_at timestamptz
);
create index web_push_user_idx on public.web_push_subscriptions(user_id);
create table public.web_push_queue (
 id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.web_push_subscriptions on delete cascade,
 appointment_id uuid references public.appointments on delete cascade,
 kind text not null check(kind in ('created','changed','cancelled','test')),
 target text not null check(target in ('/app','/shop')),
 state text not null default 'queued' check(state in ('queued','processing','accepted','unknown','failed','cancelled','expired')),
 lease uuid, claimed_at timestamptz, started_at timestamptz, finished_at timestamptz,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '1 hour'
);
create index web_push_queue_pending on public.web_push_queue(created_at) where state='queued';
alter table public.web_push_settings enable row level security;
alter table public.web_push_subscriptions enable row level security;
alter table public.web_push_queue enable row level security;
revoke all on public.web_push_settings, public.web_push_subscriptions, public.web_push_queue from public,anon,authenticated;
grant select on public.web_push_settings to service_role;

create function public.web_push_register(p_user uuid,p_session uuid,p_endpoint text,p_key text,p_auth text,p_origin text,p_locale text) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not (select enabled from web_push_settings) then raise exception 'PUSH_UNAVAILABLE'; end if;
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>now())) then raise exception 'PUSH_SESSION'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,238));
 if exists(select 1 from web_push_subscriptions where endpoint=p_endpoint and (user_id<>p_user or session_id<>p_session)) then raise exception 'PUSH_OTHER_SESSION'; end if;
 if (select count(*) from web_push_subscriptions where user_id=p_user and enabled and expires_at>now())>=10
    and not exists(select 1 from web_push_subscriptions where endpoint=p_endpoint) then raise exception 'PUSH_LIMIT'; end if;
 insert into web_push_subscriptions(user_id,session_id,endpoint,p256dh,auth_key,origin,locale)
 values(p_user,p_session,p_endpoint,p_key,p_auth,p_origin,p_locale)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_key=excluded.auth_key,locale=excluded.locale,origin=excluded.origin,enabled=true,expires_at=now()+interval '90 days'
 where web_push_subscriptions.user_id=excluded.user_id and web_push_subscriptions.session_id=excluded.session_id
 returning id into result;
 if result is null then raise exception 'PUSH_OTHER_SESSION'; end if;
 return result;
end $$;
create function public.web_push_status(p_user uuid,p_session uuid,p_endpoint text) returns boolean language sql security definer set search_path=public as $$
 select exists(select 1 from web_push_subscriptions s join auth.sessions a on a.id=s.session_id
 where s.user_id=p_user and s.session_id=p_session and s.endpoint=p_endpoint and s.enabled and s.expires_at>now() and (a.not_after is null or a.not_after>now()))
$$;
create function public.web_push_revoke(p_user uuid,p_endpoint text) returns void language sql security definer set search_path=public as $$
 delete from web_push_subscriptions where user_id=p_user and endpoint=p_endpoint
$$;
create function public.web_push_test(p_user uuid,p_session uuid,p_endpoint text) returns void language plpgsql security definer set search_path=public as $$
declare sub uuid;
begin
 if not (select enabled from web_push_settings) then raise exception 'PUSH_UNAVAILABLE'; end if;
 update web_push_subscriptions set last_test_at=now() where user_id=p_user and session_id=p_session and endpoint=p_endpoint and enabled and expires_at>now()
 and (last_test_at is null or last_test_at<now()-interval '1 minute') returning id into sub;
 if sub is null then raise exception 'PUSH_WAIT'; end if;
 insert into web_push_queue(subscription_id,kind,target) values(sub,'test','/app');
end $$;

-- Destinatários atuais: cliente, profissional do atendimento e donos ativos da loja.
create function public.web_push_recipient(p_user uuid,p_appointment uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from appointments a join barbershops b on b.id=a.barbershop_id where a.id=p_appointment and b.status='active'
 and (a.customer_id=p_user or exists(select 1 from shop_members m join staff s on s.id=m.staff_id where m.user_id=p_user and m.barbershop_id=a.barbershop_id and m.active and s.active and (m.role in ('owner','partner') or m.staff_id=a.staff_id))))
$$;
create function public.appointments_web_push_notify() returns trigger language plpgsql security definer set search_path=public as $$
declare event_kind text;
begin
 if not (select enabled from web_push_settings) then return new; end if;
 if tg_op='INSERT' and new.status in ('pending','confirmed') then event_kind:='created';
 elsif tg_op='UPDATE' then
   if new.status='cancelled' and old.status is distinct from new.status then event_kind:='cancelled';
   elsif new.status in ('pending','confirmed','reschedule_requested') and
     (old.starts_at is distinct from new.starts_at or old.ends_at is distinct from new.ends_at or old.staff_id is distinct from new.staff_id or old.service_id is distinct from new.service_id or old.status is distinct from new.status) then event_kind:='changed';
   end if;
 end if;
 if event_kind is null then return new; end if;
 insert into web_push_queue(subscription_id,appointment_id,kind,target)
 select s.id,new.id,event_kind,case when s.user_id=new.customer_id then '/app' else '/shop' end
 from web_push_subscriptions s join auth.sessions a on a.id=s.session_id
 where s.enabled and s.expires_at>now() and (a.not_after is null or a.not_after>now()) and web_push_recipient(s.user_id,new.id);
 return new;
end $$;
create trigger appointments_web_push_notify_trg after insert or update of status,starts_at,ends_at,staff_id,service_id on public.appointments for each row execute function public.appointments_web_push_notify();

create function public.web_push_claim() returns table(id uuid,lease uuid) language plpgsql security definer set search_path=public as $$
begin
 delete from web_push_queue q where q.created_at<now()-interval '7 days';
 delete from web_push_subscriptions s where s.expires_at<=now();
 update web_push_queue q set state='unknown',finished_at=now() where q.state='processing' and q.claimed_at<now()-interval '5 minutes';
 update web_push_queue q set state='expired',finished_at=now() where q.state='queued' and q.expires_at<=now();
 if not (select enabled from web_push_settings) then return; end if;
 return query with picked as (select q.id from web_push_queue q where q.state='queued' and q.expires_at>now() order by q.created_at limit 20 for update skip locked)
 update web_push_queue q set state='processing',lease=gen_random_uuid(),claimed_at=now() from picked p where q.id=p.id returning q.id,q.lease;
end $$;
create function public.web_push_authorize(p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare q web_push_queue%rowtype; s web_push_subscriptions%rowtype; shop_name text;
begin
 select * into q from web_push_queue where id=p_id and lease=p_lease and state='processing' and started_at is null for update;
 if q.id is null then return null; end if;
 select * into s from web_push_subscriptions where id=q.subscription_id and enabled and expires_at>now() for update;
 if s.id is null or q.expires_at<=now() or not (select enabled from web_push_settings)
 or not exists(select 1 from auth.sessions a join auth.users u on u.id=a.user_id where a.id=s.session_id and a.user_id=s.user_id and (a.not_after is null or a.not_after>now()) and (u.banned_until is null or u.banned_until<=now()) and u.deleted_at is null)
 or (q.kind<>'test' and not web_push_recipient(s.user_id,q.appointment_id)) then
   update web_push_queue set state='cancelled',finished_at=now() where id=q.id; return null;
 end if;
 update web_push_queue set started_at=now() where id=q.id;
 select b.name into shop_name from appointments a join barbershops b on b.id=a.barbershop_id where a.id=q.appointment_id;
 return jsonb_build_object('shop_name',shop_name,'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth_key),'locale',s.locale,'kind',q.kind,'target',q.target,'id',q.id);
end $$;
create function public.web_push_finish(p_id uuid,p_lease uuid,p_result text) returns void language plpgsql security definer set search_path=public as $$
begin
 if p_result not in ('accepted','unknown','failed','gone') then raise exception 'PUSH_RESULT'; end if;
 if p_result='gone' then
   delete from web_push_subscriptions s using web_push_queue q where q.id=p_id and q.lease=p_lease and q.state='processing' and q.started_at is not null and s.id=q.subscription_id;
 else
   update web_push_queue set state=p_result,finished_at=now() where id=p_id and lease=p_lease and state='processing' and started_at is not null;
 end if;
end $$;
-- Nenhum RPC operacional acessível ao navegador: a função Edge autentica a conta/sessão.
do $$ declare f record; begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'web_push_%' or p.proname='appointments_web_push_notify') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
end loop; end $$;
