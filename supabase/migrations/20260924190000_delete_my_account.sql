-- Exclusão permanente da conta pelo próprio usuário.
-- Agenda e eventos de uso permanecem para estatísticas da loja, sem vínculo com a pessoa.

-- Appointments: manter o registro operacional sem customer_id.
alter table public.appointments
  alter column customer_id drop not null;

alter table public.appointments
  drop constraint if exists appointments_customer_id_fkey;

alter table public.appointments
  add constraint appointments_customer_id_fkey
  foreign key (customer_id) references public.profiles (id) on delete set null;

-- Uso opcional: manter o evento agregado sem user_id.
alter table public.customer_usage_events
  alter column user_id drop not null;

alter table public.customer_usage_events
  drop constraint if exists customer_usage_events_user_id_fkey;

alter table public.customer_usage_events
  add constraint customer_usage_events_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  ownership_count int;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 13));

  -- Dono/sócio não pode apagar a conta enquanto mantém participação (quebra a sociedade).
  select count(*) into ownership_count
  from public.shop_members
  where user_id = uid
    and active
    and role in ('owner', 'partner');

  if ownership_count > 0 then
    raise exception
      'Antes de excluir a conta, transfira a sociedade ou saia da barbearia como dono/sócio.'
      using errcode = 'P0001';
  end if;

  -- Cancelar horários futuros ainda ativos.
  update public.appointments
  set
    status = 'cancelled',
    updated_at = now()
  where customer_id = uid
    and status in ('pending', 'confirmed')
    and starts_at > now();

  -- Desvincular histórico e frequência (mantém o fato, remove o vínculo pessoal).
  update public.appointments
  set customer_id = null, updated_at = now()
  where customer_id = uid;

  update public.customer_usage_events
  set user_id = null
  where user_id = uid;

  -- Equipe contratada: desativa vínculo sem apagar o histórico operacional da loja.
  update public.shop_members
  set active = false, updated_at = now()
  where user_id = uid and active;

  update public.staff
  set user_id = null, updated_at = now()
  where user_id = uid;

  -- Pedidos de exclusão legados.
  update public.privacy_requests
  set status = 'cancelled', updated_at = now()
  where user_id = uid and status in ('requested', 'reviewing');

  -- Remove a identidade Auth (cascata apaga perfil, fidelidade, pesquisas, Google, etc.).
  delete from auth.users where id = uid;

  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true, 'deleted_at', now());
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
