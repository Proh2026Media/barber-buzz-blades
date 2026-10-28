-- P-78: a janela do Google avisa o app instalado quando o login é recusado/cancelado.
-- Canal separado do código PKCE (20261016120000): nunca aceita nem inventa um código de login.
-- Só guarda id aleatório e horário, por dez minutos. Teto próprio de 500 marcadores,
-- serializado por advisory lock: encher esta fila não impede a entrega de códigos válidos.
create table if not exists public.oauth_failure_relay (
  id uuid primary key,
  created_at timestamptz not null default now()
);
create index if not exists oauth_failure_relay_created_at_idx on public.oauth_failure_relay(created_at);
alter table public.oauth_failure_relay enable row level security;
revoke all on public.oauth_failure_relay from public, anon, authenticated;
grant all on public.oauth_failure_relay to service_role;

create or replace function public.oauth_relay_failure_put(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_id is null then return false; end if;
  perform pg_advisory_xact_lock(728102026);
  delete from public.oauth_failure_relay where created_at <= now() - interval '10 minutes';
  -- Sucesso já entregue tem prioridade sobre uma mensagem atrasada da janela.
  if exists(select 1 from public.oauth_code_relay where id = p_id and created_at > now() - interval '10 minutes') then
    return false;
  end if;
  if exists(select 1 from public.oauth_failure_relay where id = p_id) then return true; end if;
  if (select count(*) from public.oauth_failure_relay) >= 500 then return false; end if;
  insert into public.oauth_failure_relay(id) values(p_id) on conflict do nothing;
  return found;
end;
$$;

create or replace function public.oauth_relay_failure_take(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_created timestamptz;
begin
  if p_id is null then return false; end if;
  delete from public.oauth_failure_relay where id = p_id returning created_at into v_created;
  return coalesce(v_created > now() - interval '10 minutes', false);
end;
$$;
revoke all on function public.oauth_relay_failure_put(uuid) from public, anon, authenticated;
revoke all on function public.oauth_relay_failure_take(uuid) from public, anon, authenticated;
grant execute on function public.oauth_relay_failure_put(uuid) to anon, authenticated, service_role;
grant execute on function public.oauth_relay_failure_take(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
