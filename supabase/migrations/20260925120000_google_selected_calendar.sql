-- Agenda Google escolhida pelo usuário (além da conta OAuth).

alter table public.google_connections
  add column if not exists selected_calendar_id text not null default 'primary';

alter table public.google_connections
  add column if not exists selected_calendar_name text;

comment on column public.google_connections.selected_calendar_id is
  'ID da agenda Google usada em sync (ex.: primary ou e-mail do calendário).';

comment on column public.google_connections.selected_calendar_name is
  'Nome amigável da agenda escolhida (summary do CalendarList).';

create or replace function public.get_my_google_connection()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.google_connections%rowtype;
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

  return jsonb_build_object(
    'connected', true,
    'google_email', r.google_email,
    'scopes', coalesce(to_jsonb(r.scopes), '[]'::jsonb),
    'token_expires_at', r.token_expires_at,
    'last_error', r.last_error,
    'last_calendar_sync_at', r.last_calendar_sync_at,
    'last_contacts_sync_at', r.last_contacts_sync_at,
    'selected_calendar_id', coalesce(nullif(trim(r.selected_calendar_id), ''), 'primary'),
    'selected_calendar_name', r.selected_calendar_name,
    'updated_at', r.updated_at
  );
end;
$$;

grant execute on function public.get_my_google_connection() to authenticated;
grant execute on function public.get_my_google_connection() to service_role;
