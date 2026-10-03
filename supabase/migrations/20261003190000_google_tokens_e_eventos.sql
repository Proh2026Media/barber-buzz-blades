-- Verificação OAuth do Google (03/10/2026):
-- 1) Tokens do Google deixam de ser legíveis pela API REST (authenticated/anon).
--    O app usa get_my_google_connection (SECURITY DEFINER, sem tokens) e as
--    Edge Functions usam a service role.
-- 2) Eventos importados da Agenda Google passam a aparecer no cartão de
--    integrações por uma função própria, que devolve só os campos exibidos.
-- 3) Os eventos importados deixam de guardar o JSON completo (participantes,
--    organizador, local etc.) e a descrição: ficam só título, início, fim,
--    dia inteiro e agenda de origem.

-- 1) Tokens --------------------------------------------------------------------

drop policy if exists "google_connections_select_own" on public.google_connections;

revoke all on table public.google_connections from anon, authenticated;
grant select, insert, update, delete on table public.google_connections to service_role;

comment on table public.google_connections is
  'Conexão Google (Agenda e Contatos) por usuário. Tokens só para service role; o app lê o estado por get_my_google_connection().';

-- 3) Minimização dos eventos importados -----------------------------------------

update public.google_calendar_events
set raw = '{}'::jsonb,
    description = null
where raw <> '{}'::jsonb
   or description is not null;

comment on column public.google_calendar_events.raw is
  'Não usado desde 20261003190000: o import não guarda mais o evento completo do Google.';
comment on column public.google_calendar_events.description is
  'Não usado desde 20261003190000: o import não guarda mais a descrição do evento.';

-- 2) Leitura dos próximos eventos importados ------------------------------------

create or replace function public.list_my_google_calendar_events(
  p_shop_id uuid default null,
  p_limit int default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_tz text;
  v_calendar_id text;
  v_calendar_name text;
  v_events jsonb;
begin
  if v_uid is null then
    raise exception 'Entre novamente para continuar.' using errcode = '42501';
  end if;

  if p_shop_id is not null then
    select b.timezone into v_tz
    from public.barbershops b
    join public.shop_members sm
      on sm.barbershop_id = b.id
     and sm.user_id = v_uid
     and sm.active
    where b.id = p_shop_id
    limit 1;
    if not found then
      raise exception 'Sem acesso a esta barbearia.' using errcode = '42501';
    end if;
  else
    select b.timezone into v_tz
    from public.shop_members sm
    join public.barbershops b on b.id = sm.barbershop_id
    where sm.user_id = v_uid
      and sm.active
    order by (sm.role = 'owner') desc, sm.created_at
    limit 1;
  end if;

  select nullif(trim(c.selected_calendar_id), ''), c.selected_calendar_name
  into v_calendar_id, v_calendar_name
  from public.google_connections c
  where c.user_id = v_uid;

  if not found then
    return jsonb_build_object(
      'connected', false,
      'timezone', coalesce(v_tz, 'America/Sao_Paulo'),
      'events', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'starts_at', e.starts_at,
      'ends_at', e.ends_at,
      'all_day', e.all_day,
      'calendar_id', e.calendar_id,
      'calendar_name',
        case
          when e.calendar_id = v_calendar_id then coalesce(nullif(trim(v_calendar_name), ''), e.calendar_id)
          else e.calendar_id
        end
    )
    order by e.starts_at, e.id
  ), '[]'::jsonb)
  into v_events
  from (
    select ge.id, ge.title, ge.starts_at, ge.ends_at, ge.all_day, ge.calendar_id
    from public.google_calendar_events ge
    where ge.user_id = v_uid
      and ge.ends_at > now()
    order by ge.starts_at, ge.id
    limit v_limit
  ) e;

  return jsonb_build_object(
    'connected', true,
    'timezone', coalesce(v_tz, 'America/Sao_Paulo'),
    'events', v_events
  );
end;
$$;

revoke all on function public.list_my_google_calendar_events(uuid, int) from public, anon;
grant execute on function public.list_my_google_calendar_events(uuid, int) to authenticated;
grant execute on function public.list_my_google_calendar_events(uuid, int) to service_role;

notify pgrst, 'reload schema';
