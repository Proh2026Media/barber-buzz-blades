-- Cada instalação de cliente recebe somente avisos da loja do seu domínio.
alter table public.web_push_subscriptions add column shop_id uuid references public.barbershops(id) on delete cascade;
create function public.identificar_inscricao_push() returns trigger language plpgsql security definer set search_path=public as $$
begin
 new.shop_id := (public.resolve_shop_by_host(substring(new.origin from '^https://([a-z0-9.-]+)$'))->>'shop_id')::uuid;
 return new;
end $$;
create trigger identificar_inscricao_push before insert or update of origin on public.web_push_subscriptions
for each row execute function public.identificar_inscricao_push();
revoke all on function public.identificar_inscricao_push() from public;
update public.web_push_subscriptions set shop_id=(public.resolve_shop_by_host(substring(origin from '^https://([a-z0-9.-]+)$'))->>'shop_id')::uuid
where origin like 'https://%';
create function public.filtrar_push_da_loja() returns trigger language plpgsql security definer set search_path=public as $$
declare loja uuid; origem uuid;
begin
 if new.appointment_id is null then return new; end if;
 select a.barbershop_id into loja from appointments a where a.id=new.appointment_id;
 select s.shop_id into origem from web_push_subscriptions s where s.id=new.subscription_id;
 if (new.target='/app' or origem is not null) and origem is distinct from loja then return null; end if;
 return new;
end $$;
create trigger filtrar_push_da_loja before insert on public.web_push_queue for each row execute function public.filtrar_push_da_loja();
revoke all on function public.filtrar_push_da_loja() from public;
create or replace function public.web_push_authorize(p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare q web_push_queue%rowtype; s web_push_subscriptions%rowtype; shop_name text; loja uuid; origem uuid;
begin
 select * into q from web_push_queue where id=p_id and lease=p_lease and state='processing' and started_at is null for update;
 if q.id is null then return null; end if;
 select * into s from web_push_subscriptions where id=q.subscription_id and enabled and expires_at>now() for update;
 origem := (public.resolve_shop_by_host(substring(s.origin from '^https://([a-z0-9.-]+)$'))->>'shop_id')::uuid;
 select a.barbershop_id into loja from appointments a where a.id=q.appointment_id;
 if origem is distinct from s.shop_id or s.id is null or q.expires_at<=now() or not (select enabled from web_push_settings)
 or not exists(select 1 from auth.sessions a join auth.users u on u.id=a.user_id where a.id=s.session_id and a.user_id=s.user_id and (a.not_after is null or a.not_after>now()) and (u.banned_until is null or u.banned_until<=now()) and u.deleted_at is null)
 or (q.kind<>'test' and q.target='/app' and origem is distinct from loja)
 or (q.kind<>'test' and origem is not null and origem is distinct from loja)
 or (q.kind<>'test' and not web_push_recipient(s.user_id,q.appointment_id)) then
   update web_push_queue set state='cancelled',finished_at=now() where id=q.id; return null;
 end if;
 update web_push_queue set started_at=now() where id=q.id;
 select coalesce(nullif(trim(bs.display_name),''),b.name) into shop_name
 from barbershops b left join barbershop_settings bs on bs.barbershop_id=b.id where b.id=coalesce(loja,origem);
 return jsonb_build_object('shop_name',shop_name,'shop_icon',origem is not null,'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth_key),'locale',s.locale,'kind',q.kind,'target',q.target,'id',q.id);
end $$;

create function public.get_my_shop_cancellations(p_shop_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('appointment_id',c.appointment_id,'reason',c.reason,'source',c.source)),'[]'::jsonb)
 from appointment_cancellations c join appointments a on a.id=c.appointment_id
 where a.barbershop_id=p_shop_id and a.customer_id=auth.uid()
$$;
revoke all on function public.get_my_shop_cancellations(uuid) from public,anon;
grant execute on function public.get_my_shop_cancellations(uuid) to authenticated;

create function public.identificar_email_da_loja() returns trigger language plpgsql set search_path=public as $$
declare nome text;
begin
 select coalesce(nullif(trim(s.display_name),''),b.name) into nome from barbershops b
 left join barbershop_settings s on s.barbershop_id=b.id where b.id=new.barbershop_id;
 if nome is not null and strpos(lower(new.subject),lower(nome))=0 then new.subject := nome || ' — ' || new.subject; end if;
 return new;
end $$;
create trigger identificar_email_da_loja before insert on public.email_outbox for each row execute function public.identificar_email_da_loja();
revoke all on function public.identificar_email_da_loja() from public;
