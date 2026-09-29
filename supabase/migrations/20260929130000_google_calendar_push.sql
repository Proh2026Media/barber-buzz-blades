-- Cópia dos agendamentos do app para a Agenda Google escolhida (opcional, desligada por padrão).
-- 'mine': atendimentos do profissional vinculado ao usuário; 'shop': todos da barbearia (dono/sócio).

alter table public.google_connections
  add column if not exists push_scope text not null default 'off';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'google_connections_push_scope_chk'
  ) then
    alter table public.google_connections
      add constraint google_connections_push_scope_chk
      check (push_scope in ('off', 'mine', 'shop'));
  end if;
end $$;

create table if not exists public.google_calendar_pushes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id text,
  google_event_id text,
  op text not null default 'upsert' check (op in ('upsert', 'delete')),
  status text not null default 'pending' check (status in ('pending', 'sending', 'done', 'failed')),
  attempts int not null default 0,
  error text,
  updated_at timestamptz not null default now(),
  constraint google_calendar_pushes_uidx unique (appointment_id, user_id)
);

create index if not exists google_calendar_pushes_pending_idx
  on public.google_calendar_pushes (updated_at)
  where status = 'pending';

create index if not exists google_calendar_pushes_user_idx
  on public.google_calendar_pushes (user_id, status);

alter table public.google_calendar_pushes enable row level security;
revoke all on public.google_calendar_pushes from anon, authenticated;

create or replace function public.google_push_recipients(p_appointment_id uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct c.user_id
  from public.appointments a
  join public.google_connections c
    on c.push_scope in ('mine', 'shop')
   and coalesce(trim(c.selected_calendar_id), '') <> ''
  where a.id = p_appointment_id
    and exists (
      select 1
      from public.shop_members sm
      where sm.barbershop_id = a.barbershop_id
        and sm.user_id = c.user_id
        and sm.active
        and (
          sm.staff_id = a.staff_id
          or (c.push_scope = 'shop' and sm.role in ('owner', 'partner'))
        )
    );
$$;

revoke all on function public.google_push_recipients(uuid) from public, anon, authenticated;

create or replace function public.queue_google_calendar_push(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.appointments%rowtype;
  v_remove boolean;
begin
  select * into a from public.appointments where id = p_appointment_id;
  if not found then
    return;
  end if;
  v_remove := a.status = 'cancelled';

  if not v_remove then
    insert into public.google_calendar_pushes (appointment_id, user_id, op, status, attempts, error, updated_at)
    select a.id, r.user_id, 'upsert', 'pending', 0, null, now()
    from public.google_push_recipients(a.id) r
    on conflict (appointment_id, user_id) do update
      set op = 'upsert', status = 'pending', attempts = 0, error = null, updated_at = now();
  end if;

  -- Quem deixou de receber (cancelado, troca de profissional, cópia desligada) tem o evento retirado.
  update public.google_calendar_pushes p
  set op = 'delete', status = 'pending', attempts = 0, error = null, updated_at = now()
  where p.appointment_id = a.id
    and not (p.op = 'delete' and p.status = 'done')
    and (
      v_remove
      or p.user_id not in (select r.user_id from public.google_push_recipients(a.id) r)
    );
end;
$$;

revoke all on function public.queue_google_calendar_push(uuid) from public, anon, authenticated;

create or replace function public.appointments_google_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
    or old.status is distinct from new.status
    or old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at
    or old.staff_id is distinct from new.staff_id
    or old.service_id is distinct from new.service_id then
    begin
      perform public.queue_google_calendar_push(new.id);
    exception when others then
      -- A reserva nunca falha por causa da cópia para a Agenda Google.
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_google_push_trg on public.appointments;
create trigger appointments_google_push_trg
  after insert or update of status, starts_at, ends_at, staff_id, service_id
  on public.appointments
  for each row execute function public.appointments_google_push();

create or replace function public.set_google_calendar_push(p_scope text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_queued int := 0;
  appt record;
begin
  if v_uid is null then
    raise exception 'Entre novamente para continuar.' using errcode = '42501';
  end if;
  if p_scope not in ('off', 'mine', 'shop') then
    raise exception 'Opção de cópia inválida.';
  end if;
  if p_scope = 'shop' and not exists (
    select 1 from public.shop_members
    where user_id = v_uid and active and role in ('owner', 'partner')
  ) then
    raise exception 'Só dono ou sócio pode copiar todos os atendimentos da barbearia.' using errcode = '42501';
  end if;

  update public.google_connections
  set push_scope = p_scope, updated_at = now()
  where user_id = v_uid;
  if not found then
    raise exception 'Conecte o Google primeiro.';
  end if;

  -- Reavalia os horários futuros: entram os novos, saem os que deixaram de valer.
  for appt in
    select a.id
    from public.appointments a
    where a.starts_at > now()
      and (
        exists (
          select 1 from public.shop_members sm
          where sm.barbershop_id = a.barbershop_id and sm.user_id = v_uid and sm.active
        )
        or exists (
          select 1 from public.google_calendar_pushes p
          where p.appointment_id = a.id and p.user_id = v_uid
        )
      )
  loop
    perform public.queue_google_calendar_push(appt.id);
    v_queued := v_queued + 1;
  end loop;

  return jsonb_build_object('ok', true, 'push_scope', p_scope, 'reviewed', v_queued);
end;
$$;

revoke all on function public.set_google_calendar_push(text) from public, anon;
grant execute on function public.set_google_calendar_push(text) to authenticated;

create or replace function public.claim_google_calendar_pushes(p_limit int default 20)
returns setof public.google_calendar_pushes
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Envio interrompido (worker caiu) volta à fila depois de 10 minutos.
  update public.google_calendar_pushes
  set status = 'pending'
  where status = 'sending' and updated_at < now() - interval '10 minutes';

  return query
  with picked as (
    select p.id
    from public.google_calendar_pushes p
    where p.status = 'pending' and p.attempts < 5
    order by p.updated_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
    for update skip locked
  )
  update public.google_calendar_pushes p
  set status = 'sending', attempts = p.attempts + 1, updated_at = now()
  from picked
  where p.id = picked.id
  returning p.*;
end;
$$;

revoke all on function public.claim_google_calendar_pushes(int) from public, anon, authenticated;
grant execute on function public.claim_google_calendar_pushes(int) to service_role;

create or replace function public.complete_google_calendar_push(
  p_id uuid,
  p_ok boolean,
  p_calendar_id text default null,
  p_event_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.google_calendar_pushes
  set
    status = case
      when p_ok then 'done'
      when attempts >= 5 then 'failed'
      else 'pending'
    end,
    calendar_id = case when p_ok and op = 'upsert' then coalesce(p_calendar_id, calendar_id) else calendar_id end,
    google_event_id = case when p_ok and op = 'upsert' then coalesce(p_event_id, google_event_id) else google_event_id end,
    error = case when p_ok then null else left(coalesce(p_error, 'Falha ao copiar para a Agenda Google'), 500) end,
    updated_at = now()
  where id = p_id and status = 'sending';
end;
$$;

revoke all on function public.complete_google_calendar_push(uuid, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_google_calendar_push(uuid, boolean, text, text, text)
  to service_role;

create or replace function public.get_my_google_connection()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.google_connections%rowtype;
  v_failed int;
  v_pending int;
  v_last_error text;
begin
  if auth.uid() is null then
    return jsonb_build_object('connected', false);
  end if;

  select * into r
  from public.google_connections
  where user_id = auth.uid();

  if not found then
    return jsonb_build_object('connected', false);
  end if;

  select
    count(*) filter (where status = 'failed'),
    count(*) filter (where status in ('pending', 'sending'))
  into v_failed, v_pending
  from public.google_calendar_pushes
  where user_id = auth.uid();

  select error into v_last_error
  from public.google_calendar_pushes
  where user_id = auth.uid() and status = 'failed'
  order by updated_at desc
  limit 1;

  return jsonb_build_object(
    'connected', true,
    'google_email', r.google_email,
    'scopes', coalesce(to_jsonb(r.scopes), '[]'::jsonb),
    'token_expires_at', r.token_expires_at,
    'last_error', r.last_error,
    'last_calendar_sync_at', r.last_calendar_sync_at,
    'last_contacts_sync_at', r.last_contacts_sync_at,
    'selected_calendar_id', nullif(trim(r.selected_calendar_id), ''),
    'selected_calendar_name', r.selected_calendar_name,
    'updated_at', r.updated_at,
    'push_scope', r.push_scope,
    'push_failed', v_failed,
    'push_pending', v_pending,
    'push_last_error', v_last_error
  );
end;
$$;

grant execute on function public.get_my_google_connection() to authenticated;
grant execute on function public.get_my_google_connection() to service_role;

notify pgrst, 'reload schema';
