-- P-29: registro dos acessos com IP por 180 dias (Marco Civil da Internet, art. 15).
--
-- O Auth (GoTrue v2.186) grava o IP real do cliente em `auth.sessions.ip`, mas a sessão some ao
-- sair ou expirar, e `auth.audit_log_entries.ip_address` fica sempre vazio. Cada login (sessão
-- nova) passa a deixar uma linha aqui: conta, sessão, IP e data/hora. Nada além disso (sem
-- aparelho, página ou localização).
--
-- Guarda: 180 dias. Linhas mais antigas são apagadas no próprio gatilho. Sem chave estrangeira
-- para `auth.users`: a guarda é obrigação legal e continua depois que a conta é apagada.
-- Sem acesso pela API: só `service_role` e consultas no servidor. O gatilho nunca impede o login.

create table if not exists public.login_access_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  session_id uuid,
  ip inet,
  created_at timestamptz not null default now()
);

create unique index if not exists login_access_log_session_key
  on public.login_access_log (session_id);
create index if not exists login_access_log_created_at_idx
  on public.login_access_log (created_at);
create index if not exists login_access_log_user_idx
  on public.login_access_log (user_id, created_at desc);

alter table public.login_access_log enable row level security;
revoke all on public.login_access_log from public, anon, authenticated;
grant all on public.login_access_log to service_role;

create or replace function public.record_login_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.login_access_log (user_id, session_id, ip, created_at)
    values (new.user_id, new.id, new.ip, coalesce(new.created_at, now()))
    on conflict (session_id) do nothing;

    delete from public.login_access_log
    where created_at < now() - interval '180 days';
  exception when others then
    raise warning 'record_login_access: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.record_login_access() from public, anon, authenticated;

drop trigger if exists on_auth_session_created_log_ip on auth.sessions;
create trigger on_auth_session_created_log_ip
  after insert on auth.sessions
  for each row execute function public.record_login_access();

insert into public.login_access_log (user_id, session_id, ip, created_at)
select s.user_id, s.id, s.ip, coalesce(s.created_at, now())
from auth.sessions s
where s.user_id is not null
  and coalesce(s.created_at, now()) >= now() - interval '180 days'
on conflict (session_id) do nothing;
