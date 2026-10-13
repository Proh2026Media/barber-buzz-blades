-- P-20: guia "Deixe sua barbearia pronta" guardado no banco (vale em qualquer aparelho).
-- P-12: e-mail das pessoas na lista de gerentes de conta da plataforma (só para o admin).
--
-- O guia guarda só o que a pessoa marcou à mão (horários conferidos, link enviado, "trabalho
-- sozinho", escondido, comemoração vista). Os outros passos continuam calculados pelos dados da
-- loja. Tabela própria, sem acesso direto: lê e grava pelas funções abaixo, para dono e sócio,
-- o `shop_admin` antigo e o admin da plataforma.

create table if not exists public.shop_setup_guides (
  barbershop_id uuid primary key references public.barbershops(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint shop_setup_guides_state_object check (jsonb_typeof(state) = 'object')
);

alter table public.shop_setup_guides enable row level security;
revoke all on public.shop_setup_guides from public, anon, authenticated;
grant all on public.shop_setup_guides to service_role;

create or replace function public.can_use_shop_setup_guide(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_platform_admin()
    or public.has_shop_role(p_shop_id, array['shop_admin']::public.app_role[])
    or public.has_shop_member_role(
      p_shop_id,
      array['owner', 'partner']::public.shop_member_role[]
    )
  )
$$;

create or replace function public.get_shop_setup_guide(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_use_shop_setup_guide(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce(
    (select state from public.shop_setup_guides where barbershop_id = p_shop_id),
    '{}'::jsonb
  );
end;
$$;

-- Junta só as chaves conhecidas, com valor verdadeiro/falso; o resto é ignorado.
create or replace function public.save_shop_setup_guide(p_shop_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean jsonb;
  saved jsonb;
begin
  if not public.can_use_shop_setup_guide(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Invalid setup guide' using errcode = '22023';
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into clean
  from jsonb_each(p_patch)
  where key in ('hoursOk', 'linkCopied', 'teamOk', 'hidden', 'celebrated')
    and jsonb_typeof(value) = 'boolean';

  insert into public.shop_setup_guides as g (barbershop_id, state, updated_by, updated_at)
  values (p_shop_id, clean, auth.uid(), now())
  on conflict (barbershop_id) do update
    set state = g.state || excluded.state,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
  returning state into saved;
  return saved;
end;
$$;

-- P-12: e-mails para diferenciar nomes iguais na plataforma.
create or replace function public.platform_user_emails(p_user_ids uuid[])
returns table (user_id uuid, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_user_ids), 0) > 500 then
    raise exception 'Too many users' using errcode = '22023';
  end if;
  return query
  select u.id, u.email::text
  from auth.users u
  where u.id = any (coalesce(p_user_ids, '{}'::uuid[]));
end;
$$;

revoke all on function public.can_use_shop_setup_guide(uuid) from public, anon;
grant execute on function public.can_use_shop_setup_guide(uuid) to authenticated, service_role;
revoke all on function public.get_shop_setup_guide(uuid) from public, anon;
grant execute on function public.get_shop_setup_guide(uuid) to authenticated, service_role;
revoke all on function public.save_shop_setup_guide(uuid, jsonb) from public, anon;
grant execute on function public.save_shop_setup_guide(uuid, jsonb) to authenticated, service_role;
revoke all on function public.platform_user_emails(uuid[]) from public, anon;
grant execute on function public.platform_user_emails(uuid[]) to authenticated, service_role;

notify pgrst, 'reload schema';
