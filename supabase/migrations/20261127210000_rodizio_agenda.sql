-- Uma aceitação é uma reserva gravada na mesma transação que consome a vez.
create table public.aceites_rodizio_agenda (
  ordem bigint generated always as identity primary key,
  loja uuid not null references public.barbershops(id) on delete cascade,
  profissional uuid not null references public.staff(id) on delete cascade,
  reserva uuid not null unique,
  versao uuid not null default gen_random_uuid()
);
alter table public.aceites_rodizio_agenda enable row level security;
revoke all on public.aceites_rodizio_agenda from public, anon, authenticated;
create index aceites_rodizio_por_profissional on public.aceites_rodizio_agenda(loja, profissional, ordem desc);

create function public.agenda_escolha_pessoal(p_loja uuid) returns boolean
language sql stable security definer set search_path='' as $$
  -- A importação pode trazer profissionais antes de cadastrar os vínculos.
  select count(*) = 0 or coalesce(bool_or(role in ('partner','associate')),false)
      or count(*) filter(where role='owner') > 1
      or coalesce(bool_or(role='owner' and ownership_percent > 0 and ownership_percent < 100),false)
    from public.shop_members where barbershop_id=p_loja and active;
$$;
revoke all on function public.agenda_escolha_pessoal(uuid) from public,anon,authenticated;

create function public.agenda_sugestoes_permitidas(p_loja uuid,p_host text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select from public.barbershops b join public.barbershop_settings s on s.barbershop_id=b.id
   where b.id=p_loja and b.status='active' and (
     (auth.uid() is not null and (public.shop_can_see_booking(b.id) or public.is_platform_admin()))
     or ( (public.resolve_shop_by_host(p_host)->>'canonical_host')=lower(p_host)
          and (public.resolve_shop_by_host(p_host)->>'shop_id')::uuid=b.id
          and coalesce((s.landing->>'enabled')::boolean,true)
          and coalesce((s.landing->>'show_services')::boolean,true)
          and coalesce((s.landing->>'show_staff')::boolean,true)
          and coalesce((s.landing->>'show_today')::boolean,true))));
$$;
revoke all on function public.agenda_sugestoes_permitidas(uuid,text) from public,anon,authenticated;

create function public.regras_sugestao_agenda(p_loja uuid,p_host text,p_barber text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare popular uuid;
begin
 if not public.agenda_sugestoes_permitidas(p_loja,p_host) then return null; end if;
 -- Só há destaque quando há um líder único entre serviços disponíveis e realmente concluídos.
 with totais as (
   select a.service_id, count(*) as total from public.appointments a join public.services s
       on s.id=a.service_id and s.barbershop_id=p_loja and s.active
   where a.barbershop_id=p_loja and a.status='completed'
     and a.starts_at >= now()-interval '90 days' and a.starts_at <= now()
     and exists(select from public.staff f cross join lateral public.staff_service_terms(f.id,s.id) t
        where f.barbershop_id=p_loja and f.active and (p_barber is null or f.booking_slug=p_barber))
   group by a.service_id
 ), ordem as (select *,lead(total) over(order by total desc,service_id) as segundo from totais)
 select case when segundo is null or total>segundo then service_id end into popular
 from ordem order by total desc,service_id limit 1;
 return jsonb_build_object('manual',public.agenda_escolha_pessoal(p_loja),'servico',popular);
end $$;
revoke all on function public.regras_sugestao_agenda(uuid,text,text) from public;
grant execute on function public.regras_sugestao_agenda(uuid,text,text) to anon,authenticated;

create function public.proxima_vez_agenda(p_loja uuid,p_servico uuid,p_dia date) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('profissional',f.id,'slug',f.booking_slug,
     'turno',coalesce(aceite.versao,'00000000-0000-0000-0000-000000000000'::uuid))
 from public.staff f

 left join lateral (select ordem,versao from public.aceites_rodizio_agenda a
    where a.loja=p_loja and a.profissional=f.id order by ordem desc limit 1) aceite on true
 where f.active and f.barbershop_id=p_loja and f.booking_slug is not null
 and exists (select from public.services s cross join lateral public.staff_service_terms(f.id,s.id) t
   where s.barbershop_id=p_loja and s.active and (p_servico is null or s.id=p_servico)
     and exists(select from public.available_slots_internal(f.id,s.id,p_dia) h where h.starts_at>now()))
 order by aceite.ordem asc nulls first, f.created_at, f.id limit 1;
$$;
revoke all on function public.proxima_vez_agenda(uuid,uuid,date) from public,anon,authenticated;

create function public.consultar_rodizio_agenda(p_loja uuid,p_host text,p_dia date,p_servico uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare hoje date; dias integer;
begin
 if not public.agenda_sugestoes_permitidas(p_loja,p_host) or public.agenda_escolha_pessoal(p_loja) then return null; end if;
 hoje := (now() at time zone public.shop_tz(p_loja))::date;
 select greatest(1,coalesce(booking_horizon_days,14)) into dias from public.barbershop_settings where barbershop_id=p_loja;
 if p_dia is null or p_dia<hoje or p_dia>=hoje+dias then return null; end if;
 return public.proxima_vez_agenda(p_loja,p_servico,p_dia);
end $$;
revoke all on function public.consultar_rodizio_agenda(uuid,text,date,uuid) from public;
grant execute on function public.consultar_rodizio_agenda(uuid,text,date,uuid) to anon,authenticated;

create function public.reservar_sugestao_agenda(p_loja uuid,p_servico uuid,p_profissional uuid,p_inicio timestamptz,p_turno uuid,p_direto boolean default false,p_serie text default null,p_intervalo integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare vez jsonb; dia date; reserva_id uuid; termos record; fim timestamptz; slug_loja text;
begin
 if auth.uid() is null or not public.shop_can_see_booking(p_loja) then raise exception 'Acesso indisponível' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('agenda-rodizio:'||p_loja::text,0));
 -- Repetir a mesma confirmação devolve a reserva sem consumir outra vez.
 select a.id into reserva_id from public.appointments a join public.aceites_rodizio_agenda r on r.reserva=a.id
 where a.customer_id=auth.uid() and a.barbershop_id=p_loja and a.service_id=p_servico and a.staff_id=p_profissional
   and a.starts_at=p_inicio and a.status in ('pending','confirmed') limit 1;
 if found then return reserva_id; end if;
 dia := (p_inicio at time zone public.shop_tz(p_loja))::date;
 vez := public.consultar_rodizio_agenda(p_loja,'',dia,p_servico);
 if p_turno is null or vez is null or (vez->>'profissional')::uuid is distinct from p_profissional
    or (vez->>'turno')::uuid is distinct from p_turno then
   raise exception 'AGENDA_RODADA_ATUALIZADA' using errcode='P0001';
 end if;
 if p_inicio <= now() or not exists(select from public.available_slots_internal(p_profissional,p_servico,dia) h where h.starts_at=p_inicio) then
   raise exception 'Horário indisponível' using errcode='22023';
 end if;
 select * into strict termos from public.staff_service_terms(p_profissional,p_servico);
 fim := p_inicio + make_interval(mins=>termos.duration_minutes);
 if p_direto then
   select slug into slug_loja from public.barbershops where id=p_loja;
   reserva_id := public.create_direct_appointment(slug_loja,vez->>'slug',p_servico,p_inicio,fim);
 elsif p_serie is not null then
   reserva_id := (public.create_booking_series(p_loja,p_servico,p_profissional,p_inicio,p_serie,p_intervalo)->>'first_appointment_id')::uuid;
 else
   if not public.has_shop_role(p_loja,array['customer','shop_admin']::public.app_role[]) then raise exception 'Acesso indisponível' using errcode='42501'; end if;
   insert into public.appointments(barbershop_id,customer_id,service_id,staff_id,starts_at,ends_at,status,booked_price_cents)
   values(p_loja,auth.uid(),p_servico,p_profissional,p_inicio,fim,'confirmed',termos.price_cents) returning id into reserva_id;
 end if;
 insert into public.aceites_rodizio_agenda(loja,profissional,reserva) values(p_loja,p_profissional,reserva_id);
 return reserva_id;
end $$;
revoke all on function public.reservar_sugestao_agenda(uuid,uuid,uuid,timestamptz,uuid,boolean,text,integer) from public,anon;
grant execute on function public.reservar_sugestao_agenda(uuid,uuid,uuid,timestamptz,uuid,boolean,text,integer) to authenticated;
create or replace function public.pick_available_staff(p_shop_id uuid, p_service_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_prefer_staff_id uuid default null)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  local_day date;
  chosen uuid;
begin
  if auth.uid() is null or not public.shop_can_see_booking(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  local_day := (p_starts_at at time zone public.shop_tz(p_shop_id))::date;

  if p_prefer_staff_id is not null
     and (not public.agenda_escolha_pessoal(p_shop_id) or exists(select from public.customer_shop_preferences pref where pref.barbershop_id=p_shop_id and pref.user_id=auth.uid() and pref.favorite_staff_id=p_prefer_staff_id))
     and exists (select 1 from public.staff s where s.id = p_prefer_staff_id and s.barbershop_id = p_shop_id)
     and exists (
       select 1 from public.available_slots_internal(p_prefer_staff_id, p_service_id, local_day) x
       where x.starts_at = p_starts_at)
  then
    return p_prefer_staff_id;
  end if;

  if public.agenda_escolha_pessoal(p_shop_id) then return null; end if;

  select s.id into chosen
  from public.staff s
  where s.barbershop_id = p_shop_id and s.active
    and exists (
      select 1 from public.available_slots_internal(s.id, p_service_id, local_day) x
      where x.starts_at = p_starts_at)
  order by (select max(a.ordem) from public.aceites_rodizio_agenda a where a.loja=p_shop_id and a.profissional=s.id) nulls first, s.created_at,s.id
  limit 1;
  return chosen;
end;
$$;
notify pgrst,'reload schema';
