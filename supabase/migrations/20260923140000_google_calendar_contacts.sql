-- Conexões Google (Agenda + Contatos) por usuário — separado do login OAuth do GoTrue.

create table if not exists public.google_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_email text,
  scopes text[] not null default '{}',
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_sync_enabled boolean not null default true,
  contacts_sync_enabled boolean not null default true,
  last_calendar_sync_at timestamptz,
  last_contacts_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_connections_user_uidx unique (user_id)
);

create index if not exists google_connections_user_idx
  on public.google_connections (user_id);

alter table public.google_connections enable row level security;

drop policy if exists "google_connections_select_own" on public.google_connections;
create policy "google_connections_select_own"
  on public.google_connections for select to authenticated
  using (auth.uid() = user_id);

-- Escrita só via service role (Edge Function); usuário não grava tokens direto.
revoke insert, update, delete on public.google_connections from authenticated, anon;

create or replace function public.get_my_google_connection()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  row public.google_connections;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into row from public.google_connections where user_id = auth.uid();
  if row.id is null then
    return jsonb_build_object('connected', false);
  end if;
  return jsonb_build_object(
    'connected', true,
    'google_email', row.google_email,
    'scopes', to_jsonb(row.scopes),
    'calendar_sync_enabled', row.calendar_sync_enabled,
    'contacts_sync_enabled', row.contacts_sync_enabled,
    'last_calendar_sync_at', row.last_calendar_sync_at,
    'last_contacts_sync_at', row.last_contacts_sync_at,
    'last_error', row.last_error,
    'token_expires_at', row.token_expires_at
  );
end;
$$;

grant execute on function public.get_my_google_connection() to authenticated;

-- Eventos importados da Agenda Google (somente leitura operacional no app).
create table if not exists public.google_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_event_id text not null,
  calendar_id text not null default 'primary',
  title text,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  html_link text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  constraint google_calendar_events_uidx unique (user_id, google_event_id)
);

create index if not exists google_calendar_events_user_starts_idx
  on public.google_calendar_events (user_id, starts_at);

alter table public.google_calendar_events enable row level security;

drop policy if exists "google_calendar_events_select_own" on public.google_calendar_events;
create policy "google_calendar_events_select_own"
  on public.google_calendar_events for select to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.google_calendar_events from authenticated, anon;
