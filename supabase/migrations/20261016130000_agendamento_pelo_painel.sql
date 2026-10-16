-- Agendamento feito pelo barbeiro no painel, cliente sem cadastro ("cliente do balcão"),
-- apelido do cliente e selo de cliente recorrente na agenda.
--
-- Problema (16/10/2026, pedido do dono):
--   * o barbeiro não conseguia marcar horário para um cliente pelo painel: toda criação de
--     atendimento gravava `customer_id = auth.uid()` (a própria pessoa logada);
--   * cliente sem conta não tinha onde ser guardado (`appointments.customer_id` aponta para
--     `profiles`, que exige conta) e por isso também não recebia avisos;
--   * não havia apelido: a equipe chama muitos clientes pelo apelido, não pelo nome.
--
-- Regras:
--   1. `shop_clients` guarda, por barbearia, o cliente do balcão (nome e WhatsApp informados pelo
--      barbeiro) e o apelido de qualquer cliente (com ou sem conta). O cliente não vê o apelido.
--   2. `book_for_client` marca pelo painel. Pede no mínimo nome e WhatsApp. Se o WhatsApp
--      (confirmado por código) for de um cliente desta barbearia que tem conta, o atendimento vai
--      para a conta dele (e o nome cadastrado vale). Senão vira cliente do balcão.
--      Quem vê a loja inteira marca na agenda de qualquer profissional; os demais, só na própria.
--      As travas de sempre continuam: horário passado, fora do expediente, bloqueio, horário
--      ocupado, espera em andamento e serviço que o profissional não faz.
--   3. Avisos: o atendimento marcado pelo painel segue as mesmas regras dos demais (mesmos
--      modelos, interruptores e lembrete). O cliente do balcão recebe no WhatsApp informado pelo
--      barbeiro, a menos que o barbeiro desligue os avisos dele. O link das mensagens leva ao
--      cadastro no app da barbearia (sem conta não há como abrir o agendamento).
--   4. Cliente do balcão não tem horário recorrente (a série exige conta). Quando ele se cadastra
--      e confirma o WhatsApp por código, a ficha e os atendimentos passam para a conta dele
--      (`apply_verified_whatsapp`); o nome que o barbeiro usava vira apelido, se for diferente.
--   5. Agenda (`get_team_schedule`): nome do cliente do balcão, apelido, se tem conta, se foi
--      marcado pela equipe e se o cliente tem horário recorrente ativo nesta barbearia.
--   6. Quem não vê a loja inteira acha o cliente pelo WhatsApp (o nome vem, para marcar certo),
--      mas só vê o apelido e a recorrência de quem já está na própria agenda; não renomeia, não
--      desliga avisos e não apaga o apelido de cliente de outro profissional (só dá apelido a
--      quem ainda não tem).
--   7. Horários para a equipe (`get_team_slots`): os mesmos do app, sem a antecedência mínima,
--      que é regra do cliente (o barbeiro encaixa quem chegou agora). Quem não vê a loja inteira
--      continua dentro do prazo da agenda, como o banco já exige dele.
--   8. Quem já tem conta com WhatsApp confirmado e entra na barbearia pelo app (link ou convite)
--      leva junto a ficha do balcão com esse número nesta barbearia.
--
-- Funções recriadas a partir da versão mais recente de cada uma:
--   get_team_schedule          ← 20261013210000_convite_boas_vindas_papeis.sql
--   queue_appointment_whatsapp ← 20260925160000_whatsapp_templates_and_calendar_choice.sql
--   process_whatsapp_reminders ← 20261003150000_correcoes_auditoria.sql
--   apply_verified_whatsapp    ← 20261003180000_verificar_whatsapp_perfil.sql
--   get_partner_clients        ← 20260917190000_client_directory.sql
--   get_client_profile         ← 20261003150000_correcoes_auditoria.sql
--   get_partner_rhythm         ← 20261003150000_correcoes_auditoria.sql
--   get_business_insights      ← 20260917150000_shop_role_permissions.sql
--   get_professional_insights  ← 20260917170000_shop_permission_money_semantics.sql
--   list_departure_appointments ← 20261013190000_saida_equipe_reservas.sql
--   get_partner_wallet         ← 20260917180000_partner_tools.sql
--
-- A tela funciona antes desta migration (o botão de agendar só aparece quando a função existe).

-- ---------------------------------------------------------------------------------------------
-- 1. Clientes da barbearia (balcão) e apelidos
-- ---------------------------------------------------------------------------------------------

create table if not exists public.shop_clients (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  -- Conta do app deste cliente, quando ele tem cadastro. Sem conta: cliente do balcão.
  -- Conta excluída: o registro sai junto (apelido e o que a barbearia guardava dela); os
  -- atendimentos ficam, sem nome, como os de qualquer conta excluída. (Com `set null`, a linha
  -- só de apelido ficaria sem identidade e a regra abaixo travaria a exclusão da conta.)
  profile_id uuid references public.profiles(id) on delete cascade,
  -- Nome e WhatsApp informados pela barbearia (cliente do balcão).
  full_name text,
  whatsapp_e164 text,
  -- Apelido usado pela equipe. O cliente não vê.
  nickname text,
  -- Avisos pelo WhatsApp do cliente do balcão (o barbeiro combina com o cliente).
  notify_whatsapp boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_clients_name_len
    check (full_name is null or char_length(full_name) between 1 and 120),
  constraint shop_clients_nickname_len
    check (nickname is null or char_length(nickname) between 1 and 40),
  constraint shop_clients_whatsapp_format
    check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint shop_clients_identity
    check (profile_id is not null or (full_name is not null and whatsapp_e164 is not null)),
  -- Alvo da chave composta de appointments: a ficha é sempre da mesma barbearia do atendimento.
  constraint shop_clients_shop_id_uniq unique (barbershop_id, id)
);

-- Um registro por conta em cada barbearia; um cliente do balcão por WhatsApp em cada barbearia.
create unique index if not exists shop_clients_shop_profile_uidx
  on public.shop_clients (barbershop_id, profile_id)
  where profile_id is not null;
create unique index if not exists shop_clients_shop_whatsapp_uidx
  on public.shop_clients (barbershop_id, whatsapp_e164)
  where whatsapp_e164 is not null and profile_id is null;
create index if not exists shop_clients_whatsapp_idx
  on public.shop_clients (whatsapp_e164)
  where whatsapp_e164 is not null and profile_id is null;

drop trigger if exists shop_clients_set_updated_at on public.shop_clients;
create trigger shop_clients_set_updated_at
  before update on public.shop_clients
  for each row execute function public.set_updated_at();

-- A ficha do atendimento é da mesma barbearia (chave composta): sem isso, um atendimento de uma
-- loja poderia apontar para a ficha de outra e mostrar o nome e o apelido que a outra equipe deu
-- (revisão de 16/10/2026). Ficha apagada: só a coluna da ficha fica vazia.
alter table public.appointments
  add column if not exists shop_client_id uuid;
alter table public.appointments
  drop constraint if exists appointments_shop_client_fkey;
alter table public.appointments
  add constraint appointments_shop_client_fkey
  foreign key (barbershop_id, shop_client_id)
  references public.shop_clients (barbershop_id, id)
  on delete set null (shop_client_id);
alter table public.appointments
  add column if not exists booked_by uuid references auth.users(id) on delete set null;
create index if not exists appointments_shop_client_idx
  on public.appointments (shop_client_id)
  where shop_client_id is not null;

-- Só as funções do banco (book_for_client, ligação da ficha à conta) gravam a ficha do balcão e
-- quem marcou. Pela API (anon/authenticated), no INSERT as duas colunas ficam vazias e no UPDATE
-- não mudam: sem isso, um profissional apontava o próprio atendimento para a ficha de outro e
-- passava a ler e mudar essa ficha, e um cliente se dizia "marcado pela equipe" (revisão de
-- 16/10/2026). As funções SECURITY DEFINER rodam como o dono delas e passam.
create or replace function public.appointments_guard_client_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.shop_client_id := null;
      new.booked_by := null;
    elsif new.shop_client_id is distinct from old.shop_client_id
       or new.booked_by is distinct from old.booked_by then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_guard_client_columns on public.appointments;
create trigger appointments_guard_client_columns
  before insert or update on public.appointments
  for each row execute function public.appointments_guard_client_columns();

alter table public.shop_clients enable row level security;
revoke all on public.shop_clients from public, anon, authenticated;
grant select on public.shop_clients to authenticated;
grant all on public.shop_clients to service_role;

-- Leitura: quem vê a loja inteira lê todos; o profissional, só os clientes da própria agenda.
-- A gravação é só pelas funções abaixo. O cliente não lê (o apelido é da equipe).
drop policy if exists "Team reads shop clients" on public.shop_clients;
create policy "Team reads shop clients"
  on public.shop_clients for select
  to authenticated
  using (
    public.can_view_full_shop(barbershop_id)
    or exists (
      select 1 from public.appointments a
      where a.barbershop_id = shop_clients.barbershop_id
        and a.staff_id = public.current_staff_id(shop_clients.barbershop_id)
        and (a.shop_client_id = shop_clients.id
             or (shop_clients.profile_id is not null and a.customer_id = shop_clients.profile_id))
    )
  );

-- ---------------------------------------------------------------------------------------------
-- 2. Ajudantes internos
-- ---------------------------------------------------------------------------------------------

-- Cliente desta barbearia: entrou nela pelo app ou já teve atendimento nela.
create or replace function public.shop_has_customer(p_shop_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_shop_id is not null and p_user_id is not null and (
    exists (
      select 1 from public.memberships m
      where m.barbershop_id = p_shop_id and m.user_id = p_user_id and m.role = 'customer'
    )
    or exists (
      select 1 from public.appointments a
      where a.barbershop_id = p_shop_id and a.customer_id = p_user_id
    )
  ), false)
$$;

-- A equipe pode mexer neste cliente: vê a loja inteira ou já o atende na própria agenda.
create or replace function public.shop_client_visible(
  p_shop_id uuid,
  p_customer_id uuid,
  p_shop_client_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mine uuid;
begin
  if auth.uid() is null or p_shop_id is null then
    return false;
  end if;
  if public.can_view_full_shop(p_shop_id) then
    return true;
  end if;
  v_mine := public.current_staff_id(p_shop_id);
  if v_mine is null then
    return false;
  end if;
  return exists (
    select 1 from public.appointments a
    where a.barbershop_id = p_shop_id
      and a.staff_id = v_mine
      and ((p_customer_id is not null and a.customer_id = p_customer_id)
        or (p_shop_client_id is not null and a.shop_client_id = p_shop_client_id))
  );
end;
$$;

-- Normaliza o apelido: vazio vira null; até 40 letras.
create or replace function public.shop_client_clean_nickname(p_value text)
returns text
language sql
immutable
as $$
  select nullif(left(btrim(regexp_replace(coalesce(p_value, ''), '\s+', ' ', 'g')), 40), '')
$$;

-- Liga os clientes do balcão com este WhatsApp à conta que acabou de confirmar o número.
-- Os atendimentos passam para a conta; se a conta já tinha registro (apelido) na barbearia,
-- os dois viram um só. O nome que o barbeiro usava vira apelido, se for diferente do cadastro.
-- Com p_shop_id, só nessa barbearia (a pessoa acabou de entrar nela pelo app).
create or replace function public.link_shop_clients_to_profile(
  p_user_id uuid,
  p_whatsapp_e164 text,
  p_shop_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.shop_clients%rowtype;
  v_existing public.shop_clients%rowtype;
  v_profile_name text;
  v_kept_name text;
  v_count integer := 0;
begin
  if p_user_id is null or p_whatsapp_e164 is null then
    return 0;
  end if;
  select p.full_name into v_profile_name from public.profiles p where p.id = p_user_id;

  for v_row in
    select * from public.shop_clients sc
    where sc.whatsapp_e164 = p_whatsapp_e164 and sc.profile_id is null
      and (p_shop_id is null or sc.barbershop_id = p_shop_id)
    for update
  loop
    v_kept_name := case
      when v_row.full_name is not null
       and lower(btrim(v_row.full_name)) is distinct from lower(btrim(coalesce(v_profile_name, '')))
      then public.shop_client_clean_nickname(v_row.full_name)
      else null
    end;

    select * into v_existing from public.shop_clients sc
    where sc.barbershop_id = v_row.barbershop_id and sc.profile_id = p_user_id
    for update;

    if v_existing.id is not null then
      update public.appointments
         set customer_id = p_user_id, shop_client_id = v_existing.id
       where shop_client_id = v_row.id;
      update public.shop_clients
         set nickname = coalesce(v_existing.nickname, v_row.nickname, v_kept_name)
       where id = v_existing.id;
      delete from public.shop_clients where id = v_row.id;
    else
      update public.shop_clients
         set profile_id = p_user_id,
             nickname = coalesce(nickname, v_kept_name)
       where id = v_row.id;
      update public.appointments
         set customer_id = p_user_id
       where shop_client_id = v_row.id and customer_id is null;
    end if;

    -- Passa a ver a barbearia no app (como quem entra pelo link da loja).
    insert into public.memberships (user_id, barbershop_id, role)
    values (p_user_id, v_row.barbershop_id, 'customer')
    on conflict do nothing;
    insert into public.loyalty_accounts (user_id, barbershop_id, points)
    values (p_user_id, v_row.barbershop_id, 0)
    on conflict (user_id, barbershop_id) do nothing;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Quem entra na barbearia pelo app (link da loja, convite) com o WhatsApp já confirmado leva
-- junto a ficha do balcão com esse número nesta barbearia, sem confirmar o número de novo.
create or replace function public.link_shop_clients_on_customer_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
begin
  if new.role is distinct from 'customer' or new.barbershop_id is null or new.user_id is null then
    return new;
  end if;
  select p.whatsapp_e164 into v_number
  from public.profiles p
  where p.id = new.user_id and p.whatsapp_verified_at is not null;
  if v_number is not null and exists (
    select 1 from public.shop_clients sc
    where sc.barbershop_id = new.barbershop_id
      and sc.whatsapp_e164 = v_number
      and sc.profile_id is null
  ) then
    perform public.link_shop_clients_to_profile(new.user_id, v_number, new.barbershop_id);
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_link_shop_clients on public.memberships;
create trigger memberships_link_shop_clients
  after insert on public.memberships
  for each row execute function public.link_shop_clients_on_customer_join();

-- ---------------------------------------------------------------------------------------------
-- 3. Funções da tela (equipe)
-- ---------------------------------------------------------------------------------------------

-- Procura o cliente pelo WhatsApp, só entre os clientes desta barbearia. Conta só bate com
-- WhatsApp confirmado por código (número não confirmado pode estar em várias contas).
create or replace function public.find_shop_client(p_shop_id uuid, p_whatsapp text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_number text;
  v_profile_id uuid;
  v_profile_name text;
  v_client public.shop_clients%rowtype;
  v_full boolean;
  v_visible boolean;
begin
  if auth.uid() is null or not public.shop_is_team(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_full := public.can_view_full_shop(p_shop_id);
  v_number := public.normalize_br_whatsapp(p_whatsapp);
  if v_number is null then
    raise exception 'Informe um WhatsApp válido com DDD' using errcode = '22023';
  end if;

  select p.id, p.full_name into v_profile_id, v_profile_name
  from public.profiles p
  where p.whatsapp_e164 = v_number
    and p.whatsapp_verified_at is not null
    and public.shop_has_customer(p_shop_id, p.id)
  limit 1;

  if v_profile_id is not null then
    select * into v_client from public.shop_clients sc
    where sc.barbershop_id = p_shop_id and sc.profile_id = v_profile_id;
    v_visible := v_full or public.shop_client_visible(p_shop_id, v_profile_id, null);
    return jsonb_build_object(
      'kind', 'account',
      'customer_id', v_profile_id,
      'shop_client_id', v_client.id,
      'name', v_profile_name,
      'nickname', case when v_visible then v_client.nickname else null end,
      'whatsapp', v_number,
      'recurring', v_visible and exists (
        select 1 from public.booking_series bs
        where bs.barbershop_id = p_shop_id and bs.customer_id = v_profile_id and bs.active),
      'limited', not v_visible
    );
  end if;

  select * into v_client from public.shop_clients sc
  where sc.barbershop_id = p_shop_id and sc.whatsapp_e164 = v_number and sc.profile_id is null;
  if v_client.id is not null then
    v_visible := v_full or public.shop_client_visible(p_shop_id, null, v_client.id);
    return jsonb_build_object(
      'kind', 'manual',
      'customer_id', null,
      'shop_client_id', v_client.id,
      'name', v_client.full_name,
      'nickname', case when v_visible then v_client.nickname else null end,
      'whatsapp', v_number,
      'notify_whatsapp', v_client.notify_whatsapp,
      'recurring', false,
      'limited', not v_visible
    );
  end if;

  return jsonb_build_object('kind', 'none', 'whatsapp', v_number);
end;
$$;

-- Marca um horário pelo painel. Devolve o atendimento e como o cliente ficou.
-- p_nickname: null mantém o apelido; '' apaga; texto grava. Quem não via o cliente antes (não vê
-- a loja inteira e o cliente não está na própria agenda) não renomeia, não muda os avisos e não
-- apaga apelido: só dá apelido a quem ainda não tem.
create or replace function public.book_for_client(
  p_shop_id uuid,
  p_staff_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_id uuid default null,
  p_shop_client_id uuid default null,
  p_name text default null,
  p_whatsapp text default null,
  p_nickname text default null,
  p_notify boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_mine uuid;
  v_full boolean;
  v_staff uuid := p_staff_id;
  v_terms record;
  v_name text;
  v_number text;
  v_customer uuid;
  v_client public.shop_clients%rowtype;
  v_kind text;
  v_appt uuid;
  v_display text;
  v_nick text;
  v_can_edit boolean := true;
begin
  if v_me is null or not public.shop_is_team(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_mine := public.current_staff_id(p_shop_id);
  v_full := public.can_view_full_shop(p_shop_id);
  v_staff := coalesce(v_staff, v_mine);

  if v_staff is null or not exists (
    select 1 from public.staff s
    where s.id = v_staff and s.barbershop_id = p_shop_id and s.active
  ) then
    raise exception 'Escolha um profissional desta barbearia.' using errcode = '22023';
  end if;
  if v_staff is distinct from v_mine and not v_full then
    raise exception 'Você só pode marcar horários na sua própria agenda.' using errcode = '42501';
  end if;
  if p_starts_at is null then
    raise exception 'Escolha o horário.' using errcode = '22023';
  end if;

  select t.duration_minutes, t.price_cents into v_terms
  from public.staff_service_terms(v_staff, p_service_id) t
  where exists (
    select 1 from public.services sv where sv.id = p_service_id and sv.barbershop_id = p_shop_id);
  if v_terms.duration_minutes is null then
    raise exception 'Este profissional não faz o serviço escolhido.' using errcode = '22023';
  end if;

  -- Quem é o cliente.
  if p_customer_id is not null then
    if not public.shop_has_customer(p_shop_id, p_customer_id) then
      raise exception 'Cliente não encontrado nesta barbearia.' using errcode = '42501';
    end if;
    v_customer := p_customer_id;
  else
    if p_shop_client_id is not null then
      select * into v_client from public.shop_clients sc
      where sc.id = p_shop_client_id and sc.barbershop_id = p_shop_id
      for update;
      if v_client.id is null then
        raise exception 'Cliente não encontrado nesta barbearia.' using errcode = '22023';
      end if;
      v_customer := v_client.profile_id;
    else
      v_name := nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
      v_number := public.normalize_br_whatsapp(p_whatsapp);
      if v_name is null then
        raise exception 'Informe o nome do cliente.' using errcode = '22023';
      end if;
      if char_length(v_name) > 120 then
        raise exception 'O nome pode ter até 120 letras.' using errcode = '22023';
      end if;
      if v_number is null then
        raise exception 'Informe um WhatsApp válido com DDD' using errcode = '22023';
      end if;

      select p.id into v_customer
      from public.profiles p
      where p.whatsapp_e164 = v_number
        and p.whatsapp_verified_at is not null
        and public.shop_has_customer(p_shop_id, p.id)
      limit 1;

      if v_customer is null then
        -- Cliente do balcão já guardado com este número: usa a mesma ficha.
        select * into v_client from public.shop_clients sc
        where sc.barbershop_id = p_shop_id and sc.whatsapp_e164 = v_number and sc.profile_id is null
        for update;
        if v_client.id is null then
          insert into public.shop_clients (barbershop_id, full_name, whatsapp_e164, notify_whatsapp, created_by)
          values (p_shop_id, v_name, v_number, coalesce(p_notify, true), v_me)
          on conflict (barbershop_id, whatsapp_e164) where whatsapp_e164 is not null and profile_id is null
          do nothing
          returning * into v_client;
          if v_client.id is null then
            select * into v_client from public.shop_clients sc
            where sc.barbershop_id = p_shop_id and sc.whatsapp_e164 = v_number and sc.profile_id is null
            for update;
          else
            -- Ficha nova, criada agora por quem está marcando.
            v_kind := 'manual';
          end if;
        end if;
      end if;
    end if;

    if v_customer is null and v_kind is null then
      -- Ficha do balcão que já existia: só quem já a via corrige o nome e os avisos.
      v_kind := 'manual';
      v_can_edit := v_full or public.shop_client_visible(p_shop_id, null, v_client.id);
      v_name := nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
      if v_name is not null and char_length(v_name) > 120 then
        raise exception 'O nome pode ter até 120 letras.' using errcode = '22023';
      end if;
      if v_can_edit then
        update public.shop_clients
           set full_name = coalesce(v_name, full_name),
               notify_whatsapp = coalesce(p_notify, notify_whatsapp)
         where id = v_client.id
        returning * into v_client;
      end if;
    end if;
  end if;

  if v_customer is not null then
    v_kind := 'account';
    if v_client.id is null then
      select * into v_client from public.shop_clients sc
      where sc.barbershop_id = p_shop_id and sc.profile_id = v_customer;
    end if;
    v_can_edit := v_full or public.shop_client_visible(p_shop_id, v_customer, null);
  end if;

  -- Apelido (só quando veio no pedido). Apelido vazio não cria registro: só apaga o que existe.
  if p_nickname is not null then
    v_nick := public.shop_client_clean_nickname(p_nickname);
    if v_nick is not null and (v_can_edit or v_client.nickname is null) then
      if v_kind = 'account' then
        insert into public.shop_clients (barbershop_id, profile_id, nickname, created_by)
        values (p_shop_id, v_customer, v_nick, v_me)
        on conflict (barbershop_id, profile_id) where profile_id is not null
        do update set nickname = excluded.nickname
        returning * into v_client;
      else
        update public.shop_clients set nickname = v_nick where id = v_client.id
        returning * into v_client;
      end if;
    elsif v_nick is null and v_can_edit and v_client.id is not null then
      update public.shop_clients set nickname = null where id = v_client.id
      returning * into v_client;
    end if;
  end if;

  insert into public.appointments (
    barbershop_id, customer_id, shop_client_id, service_id, staff_id,
    starts_at, ends_at, status, booked_price_cents, booked_by
  )
  values (
    p_shop_id,
    v_customer,
    case when v_kind = 'manual' then v_client.id else null end,
    p_service_id,
    v_staff,
    p_starts_at,
    p_starts_at + make_interval(mins => v_terms.duration_minutes),
    'confirmed',
    v_terms.price_cents,
    v_me
  )
  returning id into v_appt;

  if v_customer is not null then
    insert into public.memberships (user_id, barbershop_id, role)
    values (v_customer, p_shop_id, 'customer')
    on conflict do nothing;
    select p.full_name into v_display from public.profiles p where p.id = v_customer;
  else
    v_display := v_client.full_name;
  end if;

  return jsonb_build_object(
    'appointment_id', v_appt,
    'kind', v_kind,
    'customer_id', v_customer,
    'shop_client_id', v_client.id,
    'name', v_display,
    'nickname', v_client.nickname,
    'has_account', v_kind = 'account',
    'notify_whatsapp', case when v_kind = 'manual' then v_client.notify_whatsapp else null end
  );
end;
$$;

-- Apelido de um cliente (com ou sem conta). Devolve o apelido gravado (null = sem apelido).
create or replace function public.set_client_nickname(
  p_shop_id uuid,
  p_customer_id uuid,
  p_shop_client_id uuid,
  p_nickname text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nick text := public.shop_client_clean_nickname(p_nickname);
  v_client public.shop_clients%rowtype;
begin
  if auth.uid() is null or not public.shop_is_team(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_shop_client_id is not null then
    select * into v_client from public.shop_clients sc
    where sc.id = p_shop_client_id and sc.barbershop_id = p_shop_id;
    if v_client.id is null then
      raise exception 'Cliente não encontrado nesta barbearia.' using errcode = '22023';
    end if;
    if not public.shop_client_visible(p_shop_id, v_client.profile_id, v_client.id) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    update public.shop_clients set nickname = v_nick where id = v_client.id;
    return v_nick;
  end if;

  if p_customer_id is null or not public.shop_has_customer(p_shop_id, p_customer_id) then
    raise exception 'Cliente não encontrado nesta barbearia.' using errcode = '22023';
  end if;
  if not public.shop_client_visible(p_shop_id, p_customer_id, null) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_nick is null then
    -- Apagar: só mexe no registro que existir (sem criar linha vazia).
    update public.shop_clients set nickname = null
     where barbershop_id = p_shop_id and profile_id = p_customer_id;
    return null;
  end if;
  insert into public.shop_clients (barbershop_id, profile_id, nickname, created_by)
  values (p_shop_id, p_customer_id, v_nick, auth.uid())
  on conflict (barbershop_id, profile_id) where profile_id is not null
  do update set nickname = excluded.nickname;
  return v_nick;
end;
$$;

-- Corrige nome, WhatsApp ou avisos de um cliente do balcão.
create or replace function public.update_shop_client(
  p_shop_id uuid,
  p_shop_client_id uuid,
  p_full_name text default null,
  p_whatsapp text default null,
  p_notify boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.shop_clients%rowtype;
  v_name text;
  v_number text;
begin
  if auth.uid() is null or not public.shop_is_team(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_client from public.shop_clients sc
  where sc.id = p_shop_client_id and sc.barbershop_id = p_shop_id
  for update;
  if v_client.id is null or v_client.profile_id is not null then
    raise exception 'Cliente não encontrado nesta barbearia.' using errcode = '22023';
  end if;
  if not public.shop_client_visible(p_shop_id, null, v_client.id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_full_name is not null then
    v_name := nullif(btrim(regexp_replace(p_full_name, '\s+', ' ', 'g')), '');
    if v_name is null or char_length(v_name) > 120 then
      raise exception 'Informe o nome do cliente.' using errcode = '22023';
    end if;
  end if;
  if p_whatsapp is not null then
    v_number := public.normalize_br_whatsapp(p_whatsapp);
    if v_number is null then
      raise exception 'Informe um WhatsApp válido com DDD' using errcode = '22023';
    end if;
    if v_number is distinct from v_client.whatsapp_e164 and exists (
      select 1 from public.shop_clients sc
      where sc.barbershop_id = p_shop_id and sc.whatsapp_e164 = v_number
        and sc.profile_id is null and sc.id <> v_client.id
    ) then
      raise exception 'Este WhatsApp já é de outro cliente da barbearia.' using errcode = '23505';
    end if;
    -- Número confirmado de um cliente com conta: a ficha ficaria duplicada e nunca seria ligada.
    if v_number is distinct from v_client.whatsapp_e164 and exists (
      select 1 from public.profiles p
      where p.whatsapp_e164 = v_number and p.whatsapp_verified_at is not null
        and public.shop_has_customer(p_shop_id, p.id)
    ) then
      raise exception 'Este WhatsApp é de um cliente com conta nesta barbearia.' using errcode = '23505';
    end if;
  end if;

  update public.shop_clients
     set full_name = coalesce(v_name, full_name),
         whatsapp_e164 = coalesce(v_number, whatsapp_e164),
         notify_whatsapp = coalesce(p_notify, notify_whatsapp)
   where id = v_client.id
  returning * into v_client;

  return jsonb_build_object(
    'shop_client_id', v_client.id,
    'name', v_client.full_name,
    'whatsapp', v_client.whatsapp_e164,
    'notify_whatsapp', v_client.notify_whatsapp,
    'nickname', v_client.nickname
  );
end;
$$;

-- Ficha do cliente do balcão (o cliente com conta continua em get_client_profile).
create or replace function public.get_shop_client(p_shop_id uuid, p_shop_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_client public.shop_clients%rowtype;
  v_full boolean;
  v_mine uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_client from public.shop_clients sc
  where sc.id = p_shop_client_id and sc.barbershop_id = p_shop_id;
  if v_client.id is null then
    raise exception 'Cliente não encontrado nesta barbearia.' using errcode = 'P0002';
  end if;
  if not public.shop_client_visible(p_shop_id, v_client.profile_id, v_client.id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_full := public.is_platform_admin() or public.can_view_full_shop(p_shop_id);
  v_mine := public.current_staff_id(p_shop_id);

  select jsonb_build_object(
    'shop_client_id', v_client.id,
    'customer_id', v_client.profile_id,
    'has_account', v_client.profile_id is not null,
    'name', coalesce((select p.full_name from public.profiles p where p.id = v_client.profile_id),
                     v_client.full_name),
    'nickname', v_client.nickname,
    'whatsapp', case when v_client.profile_id is null then v_client.whatsapp_e164 else null end,
    'notify_whatsapp', v_client.notify_whatsapp,
    'created_at', v_client.created_at,
    'visits', count(*) filter (where a.status = 'completed'),
    'total_spent_cents', coalesce(sum(coalesce(a.booked_price_cents, s.price_cents))
                                  filter (where a.status = 'completed'), 0),
    'last_visit', max(a.starts_at) filter (where a.status = 'completed'),
    'history', coalesce(jsonb_agg(jsonb_build_object(
        'appointment_id', a.id,
        'starts_at', a.starts_at,
        'service_name', s.name,
        'staff_name', st.display_name,
        'status', a.status,
        'amount_cents', coalesce(a.booked_price_cents, s.price_cents)
      ) order by a.starts_at desc) filter (where a.id is not null), '[]'::jsonb)
  ) into v_result
  from public.shop_clients sc
  left join public.appointments a
    on a.barbershop_id = p_shop_id
   and (a.shop_client_id = sc.id or (sc.profile_id is not null and a.customer_id = sc.profile_id))
   and (v_full or a.staff_id = v_mine)
  left join public.services s on s.id = a.service_id
  left join public.staff st on st.id = a.staff_id
  where sc.id = v_client.id;

  return v_result;
end;
$$;

-- Horários livres para a equipe marcar pelo painel: a mesma grade do app do cliente (expediente,
-- bloqueios, atendimentos com preparo e vagas seguradas pela lista de espera), sem a antecedência
-- mínima, que é regra do cliente: o barbeiro encaixa quem acabou de chegar. Quem não vê a loja
-- inteira só consulta a própria agenda e continua dentro do prazo da agenda (o banco exige isso
-- dele na hora de gravar, em appointments_enforce_service_terms).
create or replace function public.get_team_slots(
  p_shop_id uuid,
  p_staff_id uuid,
  p_service_id uuid,
  p_date date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_full boolean;
  tz text;
  dur integer;
  prep integer;
  horizon integer;
  local_today date;
begin
  if auth.uid() is null or not public.shop_is_team(p_shop_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_full := public.can_view_full_shop(p_shop_id);
  if not v_full and p_staff_id is distinct from public.current_staff_id(p_shop_id) then
    raise exception 'Você só pode marcar horários na sua própria agenda.' using errcode = '42501';
  end if;
  if p_date is null or not exists (
    select 1 from public.staff s join public.barbershops b on b.id = s.barbershop_id
    where s.id = p_staff_id and s.barbershop_id = p_shop_id and s.active and b.status = 'active'
  ) or not exists (
    select 1 from public.services sv where sv.id = p_service_id and sv.barbershop_id = p_shop_id
  ) then
    return;
  end if;

  select t.duration_minutes into dur from public.staff_service_terms(p_staff_id, p_service_id) t;
  if dur is null or dur <= 0 then
    return;
  end if;
  prep := public.service_prep_minutes(p_shop_id, p_service_id);
  tz := public.shop_tz(p_shop_id);
  local_today := (clock_timestamp() at time zone tz)::date;
  if p_date < local_today then
    return;
  end if;
  if not v_full then
    select coalesce(st.booking_horizon_days, 14) into horizon
    from public.barbershop_settings st where st.barbershop_id = p_shop_id;
    if p_date > local_today + greatest(coalesce(horizon, 14), 1) - 1 then
      return;
    end if;
  end if;

  perform public.process_slot_waits();
  return query
  with grid as materialized (
    select c.g from public.slot_candidate_starts(p_staff_id, p_date, dur, prep) as c(g)
  ),
  busy as materialized (
    select b.starts_at, b.ends_at, b.prep_minutes, b.is_appointment
    from public.staff_busy_prep_internal(
      p_staff_id,
      (select min(grid.g) from grid),
      (select max(grid.g) from grid) + make_interval(mins => dur + prep)) b
  )
  select grid.g, grid.g + make_interval(mins => dur)
  from grid
  where grid.g > clock_timestamp()
    and not exists (
      select 1 from busy
      where busy.starts_at < grid.g + make_interval(mins => dur + case when busy.is_appointment then prep else 0 end)
        and busy.ends_at + make_interval(mins => busy.prep_minutes) > grid.g)
  order by grid.g;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Agenda da equipe: cliente do balcão, apelido e recorrência
-- (a partir de 20261013210000_convite_boas_vindas_papeis.sql)
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_team_schedule(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  mine uuid;
  full_access boolean;
begin
  if auth.uid() is null or not (
    public.is_platform_admin()
    or public.has_shop_member_role(
      p_shop_id,
      array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
    )
    or public.has_shop_role(p_shop_id, array['shop_admin']::public.app_role[])
  ) then
    raise exception 'Not allowed';
  end if;
  mine := public.current_staff_id(p_shop_id);
  full_access := public.can_view_full_shop(p_shop_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'staff_id', a.staff_id,
      'staff_name', st.display_name,
      'starts_at', a.starts_at,
      'ends_at', a.ends_at,
      'status', a.status,
      'series_id', a.series_id,
      'is_own', a.staff_id = mine,
      'customer_id', case when full_access or a.staff_id = mine then a.customer_id else null end,
      'customer_name', case when full_access or a.staff_id = mine
        then coalesce(p.full_name, sc.full_name) else null end,
      'service_name', case when full_access or a.staff_id = mine then s.name else null end,
      'price_cents', case when full_access or a.staff_id = mine then coalesce(a.booked_price_cents, s.price_cents) else null end,
      'visibility', case when full_access or a.staff_id = mine then 'full' else 'busy' end,
      -- Novos (20261016130000): cliente do balcão, apelido e recorrência.
      'shop_client_id', case when full_access or a.staff_id = mine then a.shop_client_id else null end,
      'customer_nickname', case when full_access or a.staff_id = mine
        then coalesce(scp.nickname, sc.nickname) else null end,
      'has_account', case when full_access or a.staff_id = mine then
          case when a.customer_id is not null then true
               when a.shop_client_id is not null then false
               else null end
        else null end,
      'booked_by_team', case when full_access or a.staff_id = mine
        then a.booked_by is not null and a.booked_by is distinct from a.customer_id else null end,
      'series_kind', case when full_access or a.staff_id = mine then bs.kind else null end,
      'series_interval_days', case when full_access or a.staff_id = mine then bs.interval_days else null end,
      'customer_recurring', case when full_access or a.staff_id = mine then (
        a.customer_id is not null and exists (
          select 1 from public.booking_series b2
          where b2.barbershop_id = a.barbershop_id and b2.customer_id = a.customer_id and b2.active))
        else null end
    ) order by a.starts_at)
    from public.appointments a
    join public.staff st on st.id = a.staff_id
    join public.services s on s.id = a.service_id
    -- Cliente que excluiu a conta: o atendimento fica, sem nome.
    left join public.profiles p on p.id = a.customer_id
    left join public.shop_clients sc on sc.id = a.shop_client_id
    left join public.shop_clients scp
      on a.customer_id is not null and scp.barbershop_id = a.barbershop_id and scp.profile_id = a.customer_id
    left join public.booking_series bs on bs.id = a.series_id
    where a.barbershop_id = p_shop_id
      and a.starts_at >= p_from
      and a.starts_at < p_to
      and a.status <> 'cancelled'
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Avisos: o cliente do balcão recebe no WhatsApp informado pela barbearia
-- (a partir de 20260925160000_whatsapp_templates_and_calendar_choice.sql)
-- ---------------------------------------------------------------------------------------------

create or replace function public.queue_appointment_whatsapp(
  p_appointment_id uuid,
  p_template_key text,
  p_scheduled_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.appointments%rowtype;
  profile_row public.profiles%rowtype;
  client_row public.shop_clients%rowtype;
  shop_row public.barbershops%rowtype;
  service_name text;
  staff_name text;
  when_label text;
  template_body text;
  body text;
  dedupe text;
  vars jsonb;
  link text;
  email_tpl jsonb;
  email_subject text;
  email_body text;
  customer_email text;
  to_number text;
  origin text;
begin
  select * into appt from public.appointments where id = p_appointment_id;
  if appt.id is null then return null; end if;

  select * into profile_row from public.profiles where id = appt.customer_id;
  if appt.customer_id is null and appt.shop_client_id is not null then
    select * into client_row from public.shop_clients where id = appt.shop_client_id;
  end if;
  select * into shop_row from public.barbershops where id = appt.barbershop_id;
  select name into service_name from public.services where id = appt.service_id;
  select display_name into staff_name from public.staff where id = appt.staff_id;

  when_label := to_char(
    appt.starts_at at time zone coalesce(shop_row.timezone, 'America/Sao_Paulo'),
    'DD/MM/YYYY "às" HH24"h"MI'
  );
  if appt.customer_id is null and client_row.id is not null then
    -- Sem conta não dá para abrir o agendamento: o link leva ao cadastro no app da barbearia.
    origin := public.shop_public_origin(appt.barbershop_id);
    link := case when origin is null then ''
                 else origin || '/auth?cadastro=1&next=%2Fapp%3Ftab%3Dreservas' end;
  else
    link := coalesce(public.appointment_manage_url(appt.id), '');
  end if;

  vars := jsonb_build_object(
    'loja', coalesce(shop_row.name, 'Barbearia'),
    'shop', coalesce(shop_row.name, 'Barbearia'),
    'serviço', coalesce(service_name, 'Serviço'),
    'servico', coalesce(service_name, 'Serviço'),
    'service', coalesce(service_name, 'Serviço'),
    'profissional', coalesce(staff_name, 'profissional'),
    'staff', coalesce(staff_name, 'profissional'),
    'quando', when_label,
    'when', when_label,
    'cliente', coalesce(nullif(trim(profile_row.full_name), ''), nullif(trim(client_row.full_name), ''), 'cliente'),
    'customer', coalesce(nullif(trim(profile_row.full_name), ''), nullif(trim(client_row.full_name), ''), 'cliente'),
    'link_reserva', link,
    'link', link
  );

  customer_email := public.customer_auth_email(appt.customer_id);
  if customer_email is not null then
    select jsonb_build_object('subject', t.subject, 'body', t.body) into email_tpl
    from public.email_message_templates t
    where t.barbershop_id = appt.barbershop_id and t.template_key = p_template_key;
    email_tpl := coalesce(email_tpl, public.default_email_template(p_template_key));
    email_subject := public.render_whatsapp_template(email_tpl->>'subject', vars);
    email_body := public.render_whatsapp_template(email_tpl->>'body', vars);
    if email_subject is not null and email_body is not null then
      perform public.enqueue_email_message(
        appt.barbershop_id,
        customer_email,
        p_template_key,
        email_subject,
        email_body,
        'email:' || p_template_key || ':' || appt.id::text
          || case when p_template_key = 'booking.reminder'
               then ':' || to_char(coalesce(p_scheduled_at, now()), 'YYYYMMDDHH24')
               else ''
             end,
        jsonb_build_object('appointment_id', appt.id),
        coalesce(p_scheduled_at, now())
      );
    end if;
  end if;

  if appt.customer_id is not null then
    if profile_row.whatsapp_e164 is null or profile_row.whatsapp_opt_in_at is null then
      return null;
    end if;
    to_number := profile_row.whatsapp_e164;
  elsif client_row.id is not null then
    -- Cliente do balcão: o número que ele passou ao barbeiro, se os avisos estiverem ligados.
    if client_row.whatsapp_e164 is null or not client_row.notify_whatsapp then
      return null;
    end if;
    to_number := client_row.whatsapp_e164;
  else
    return null;
  end if;

  select t.body into template_body
  from public.whatsapp_message_templates t
  where t.barbershop_id = appt.barbershop_id
    and t.template_key = p_template_key;

  template_body := coalesce(template_body, public.default_whatsapp_template(p_template_key));

  -- Se o modelo pede {{link_reserva}}, exige URL HTTPS absoluta.
  if position('{{link_reserva}}' in template_body) > 0
     and (link is null or link !~ '^https://') then
    return null;
  end if;

  body := public.render_whatsapp_template(template_body, vars);
  if body is null or length(trim(body)) = 0 then
    return null;
  end if;

  dedupe := p_template_key || ':' || p_appointment_id::text
    || case when p_template_key = 'booking.reminder'
         then ':' || to_char(coalesce(p_scheduled_at, now()), 'YYYYMMDDHH24')
         else ''
       end;

  return public.enqueue_whatsapp_message(
    appt.barbershop_id,
    to_number,
    p_template_key,
    body,
    dedupe,
    jsonb_build_object(
      'appointment_id', appt.id,
      'starts_at', appt.starts_at,
      'status', appt.status
    ),
    coalesce(p_scheduled_at, now())
  );
end;
$$;

-- Lembretes: inclui o cliente do balcão (a partir de 20261003150000_correcoes_auditoria.sql).
create or replace function public.process_whatsapp_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  queued int := 0;
  candidate record;
  message_id uuid;
begin
  for candidate in
    select
      a.id as appointment_id,
      a.starts_at - make_interval(hours => coalesce(c.reminder_hours_before, 24)) as remind_at
    from public.appointments a
    left join lateral (
      select ch.reminder_hours_before, ch.notify_reminder
      from public.whatsapp_channels ch
      where ch.barbershop_id = a.barbershop_id
      order by ch.staff_id nulls first
      limit 1
    ) c on true
    where a.status in ('pending', 'confirmed')
      and (a.customer_id is not null or a.shop_client_id is not null)
      and coalesce(c.notify_reminder, true)
      and a.starts_at > now()
      and a.starts_at - make_interval(hours => coalesce(c.reminder_hours_before, 24)) <= now()
      and a.starts_at - make_interval(hours => coalesce(c.reminder_hours_before, 24))
        > now() - interval '2 hours'
  loop
    message_id := public.queue_appointment_whatsapp(
      candidate.appointment_id,
      'booking.reminder',
      candidate.remind_at
    );
    if message_id is not null then
      queued := queued + 1;
    end if;
  end loop;
  return queued;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Confirmar o WhatsApp liga o cliente do balcão à conta
-- (a partir de 20261003180000_verificar_whatsapp_perfil.sql)
-- ---------------------------------------------------------------------------------------------

create or replace function public.apply_verified_whatsapp(
  p_user_id uuid,
  p_whatsapp text,
  p_opt_in boolean default true
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  result public.profiles%rowtype;
begin
  if p_user_id is null then
    raise exception 'Conta não informada' using errcode = '22023';
  end if;

  normalized := public.normalize_br_whatsapp(p_whatsapp);
  if normalized is null then
    raise exception 'Informe um WhatsApp válido com DDD' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.whatsapp_e164 = normalized
      and p.whatsapp_verified_at is not null
      and p.id <> p_user_id
  ) then
    raise exception 'Este WhatsApp já está em outra conta' using errcode = '23505';
  end if;

  -- Quem confirmou o código é o dono do número: cópias não verificadas em
  -- outras contas deixam de usá-lo (e de receber avisos por ele).
  update public.profiles
     set whatsapp_e164 = null,
         whatsapp_opt_in_at = null,
         whatsapp_verified_at = null,
         updated_at = now()
   where whatsapp_e164 = normalized
     and whatsapp_verified_at is null
     and id <> p_user_id;

  update public.profiles
     set whatsapp_e164 = normalized,
         whatsapp_verified_at = now(),
         whatsapp_opt_in_at = case
           when coalesce(p_opt_in, true) then coalesce(whatsapp_opt_in_at, now())
           else null
         end,
         updated_at = now()
   where id = p_user_id
  returning * into result;

  if result.id is null then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;

  -- Novo (20261016130000): cliente do balcão com este número passa a ser desta conta.
  perform public.link_shop_clients_to_profile(p_user_id, normalized);

  return result;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. Diretório e ficha: apelido e cliente do balcão
-- ---------------------------------------------------------------------------------------------

-- A partir de 20260917190000_client_directory.sql.
create or replace function public.get_partner_clients(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid; full_access boolean;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  mine := public.current_staff_id(p_shop_id);
  full_access := public.is_platform_admin() or public.can_view_full_shop(p_shop_id);
  if mine is null and not full_access then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  return coalesce((
    select jsonb_agg(c order by c->>'last_visit' desc)
    from (
      select jsonb_build_object(
        'customer_id', g.customer_id,
        'customer_name', coalesce(p.full_name, sc.full_name),
        'visits', g.visits,
        'total_spent_cents', g.total_spent_cents,
        'last_visit', g.last_visit,
        -- Novos (20261016130000).
        'shop_client_id', g.shop_client_id,
        'nickname', coalesce(scp.nickname, sc.nickname),
        'has_account', case when g.customer_id is not null then true
                            when g.shop_client_id is not null then false
                            else null end
      ) as c
      from (
        select a.customer_id,
          case when a.customer_id is null then a.shop_client_id end as shop_client_id,
          count(*) as visits,
          sum(coalesce(a.booked_price_cents, s.price_cents)) as total_spent_cents,
          max(a.starts_at) as last_visit
        from public.appointments a
        join public.services s on s.id = a.service_id
        where a.barbershop_id = p_shop_id and a.status = 'completed'
          and (full_access or a.staff_id = mine)
        group by a.customer_id, case when a.customer_id is null then a.shop_client_id end
      ) g
      left join public.profiles p on p.id = g.customer_id
      left join public.shop_clients sc on sc.id = g.shop_client_id
      left join public.shop_clients scp
        on g.customer_id is not null and scp.barbershop_id = p_shop_id and scp.profile_id = g.customer_id
    ) clients
  ), '[]'::jsonb);
end $$;

-- A partir de 20261003150000_correcoes_auditoria.sql: acrescenta apelido e recorrência.
create or replace function public.get_client_profile(p_shop_id uuid, p_customer_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  mine uuid;
  full_access boolean;
  served boolean;
  result jsonb;
  profile_name text;
  profile_avatar text;
  tz text;
  extra jsonb;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  mine := public.current_staff_id(p_shop_id);
  full_access := public.is_platform_admin() or public.can_view_full_shop(p_shop_id);
  if mine is null and not full_access then
    raise exception 'Not allowed' using errcode='42501';
  end if;
  tz := public.shop_tz(p_shop_id);

  -- Sem acesso completo, o profissional só abre clientes que já atendeu.
  if not full_access then
    select exists(
      select 1 from public.appointments a
      where a.barbershop_id = p_shop_id and a.staff_id = mine and a.customer_id = p_customer_id
    ) into served;
    if not served then raise exception 'Not allowed' using errcode='42501'; end if;
  end if;

  select p.full_name, p.avatar_url into profile_name, profile_avatar
  from public.profiles p where p.id = p_customer_id;

  -- Novos (20261016130000): apelido da equipe e horário recorrente ativo.
  extra := jsonb_build_object(
    'nickname', (
      select sc.nickname from public.shop_clients sc
      where sc.barbershop_id = p_shop_id and sc.profile_id = p_customer_id),
    'recurring', exists (
      select 1 from public.booking_series bs
      where bs.barbershop_id = p_shop_id and bs.customer_id = p_customer_id and bs.active)
  );

  select jsonb_build_object(
    'customer_id', p_customer_id,
    'customer_name', profile_name,
    'avatar_url', profile_avatar,
    'visits', count(*),
    'total_spent_cents', coalesce(sum(coalesce(a.booked_price_cents, s.price_cents)), 0),
    'first_visit', min(a.starts_at),
    'last_visit', max(a.starts_at)
  ) into result
  from public.appointments a
  join public.services s on s.id = a.service_id
  where a.barbershop_id = p_shop_id and a.customer_id = p_customer_id and a.status = 'completed';

  if result is null then
    return jsonb_build_object(
      'customer_id', p_customer_id, 'customer_name', profile_name,
      'avatar_url', profile_avatar, 'visits', 0, 'total_spent_cents', 0,
      'first_visit', null, 'last_visit', null, 'rhythm', jsonb_build_object('sample', 0),
      'history', '[]'::jsonb
    ) || extra;
  end if;

  result := result || extra || jsonb_build_object(
    'rhythm', coalesce((
      select jsonb_build_object(
        'sample', count(distinct appt_id),
        'avg_return_days', percentile_cont(0.5) within group (order by interval_days),
        'preferred_weekday', mode() within group (order by dow),
        'preferred_hour', mode() within group (order by hour),
        'top_service', (
          select s2.name from public.appointments a2 join public.services s2 on s2.id = a2.service_id
          where a2.barbershop_id = p_shop_id and a2.customer_id = p_customer_id and a2.status = 'completed'
          group by s2.name order by count(*) desc limit 1
        ),
        'avg_spend_cents', round(avg(coalesce(booked_price_cents, price_cents)))
      )
      from (
        select
          a.id as appt_id,
          extract(epoch from (a.starts_at - lag(a.starts_at) over (order by a.starts_at)))/86400 as interval_days,
          extract(dow from (a.starts_at at time zone tz)) as dow,
          extract(hour from (a.starts_at at time zone tz)) as hour,
          a.booked_price_cents, sv.price_cents
        from public.appointments a
        left join public.services sv on sv.id = a.service_id
        where a.barbershop_id = p_shop_id and a.customer_id = p_customer_id and a.status = 'completed'
      ) intervals
      where intervals.interval_days is not null
    ), jsonb_build_object('sample', 0)),
    'history', coalesce((
      select jsonb_agg(h order by h->>'starts_at' desc)
      from (
        select jsonb_build_object(
          'appointment_id', a.id,
          'starts_at', a.starts_at,
          'service_name', s.name,
          'staff_name', st.display_name,
          'status', a.status,
          'amount_cents', coalesce(a.booked_price_cents, s.price_cents)
        ) as h
        from public.appointments a
        join public.services s on s.id = a.service_id
        left join public.staff st on st.id = a.staff_id
        where a.barbershop_id = p_shop_id and a.customer_id = p_customer_id
      ) history
    ), '[]'::jsonb)
  );

  return result;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 7b. Indicadores e listas contam o cliente do balcão (revisão de 16/10/2026)
-- Com esta migration, "sem customer_id" deixa de ser só conta excluída (raro) e passa a ser todo
-- cliente do balcão: o cliente passa a ser customer_id, ou a ficha do balcão quando não há conta.
--   get_partner_rhythm        ← 20261003150000_correcoes_auditoria.sql (retorno por cliente)
--   get_business_insights     ← 20260917150000_shop_role_permissions.sql (clientes distintos)
--   get_professional_insights ← 20260917170000_shop_permission_money_semantics.sql (idem)
--   list_departure_appointments ← 20261013190000_saida_equipe_reservas.sql (nome na saída da equipe)
--   get_partner_wallet        ← 20260917180000_partner_tools.sql (nome na carteira do profissional)
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_partner_rhythm(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid; result jsonb; tz text;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  mine := public.current_staff_id(p_shop_id);
  if mine is null then raise exception 'Not allowed' using errcode='42501'; end if;
  tz := public.shop_tz(p_shop_id);

  select jsonb_build_object(
    'sample', count(distinct appt_id),
    'avg_return_days', percentile_cont(0.5) within group (order by interval_days),
    'preferred_weekday', mode() within group (order by dow),
    'preferred_hour', mode() within group (order by hour),
    'top_service', (
      select s.name from public.appointments a2 join public.services s on s.id=a2.service_id
      where a2.barbershop_id=p_shop_id and a2.staff_id=mine and a2.status='completed'
      group by s.name order by count(*) desc limit 1
    ),
    'avg_spend_cents', round(avg(coalesce(booked_price_cents, price_cents)))
  ) into result
  from (
    select
      a.id as appt_id,
      -- Retorno de cada cliente (conta ou ficha do balcão); sem nenhum dos dois, não entra.
      extract(epoch from (a.starts_at - lag(a.starts_at) over (
        partition by coalesce(a.customer_id, a.shop_client_id) order by a.starts_at)))/86400 as interval_days,
      extract(dow from (a.starts_at at time zone tz)) as dow,
      extract(hour from (a.starts_at at time zone tz)) as hour,
      a.booked_price_cents, sv.price_cents
    from public.appointments a
    left join public.services sv on sv.id = a.service_id
    where a.barbershop_id = p_shop_id and a.staff_id = mine and a.status = 'completed'
      and coalesce(a.customer_id, a.shop_client_id) is not null
  ) intervals
  where intervals.interval_days is not null;

  if result is null or (result->>'sample')::int = 0 then
    return jsonb_build_object('sample', 0);
  end if;
  return result;
end $$;

create or replace function public.get_business_insights(p_shop_id uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; rating_sample bigint; improvement_sample bigint; cancellation_sample bigint;
begin
  if auth.uid() is null or not (is_platform_admin() or (p_shop_id is not null and (has_shop_role(p_shop_id,array['shop_admin']::app_role[]) or shop_can_view_financials(p_shop_id)))) then raise exception 'Not allowed'; end if;
  if p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid period'; end if;
  select jsonb_build_object(
    'bookings',count(*),'customers',count(distinct coalesce(a.customer_id, a.shop_client_id)),
    'completed',count(*) filter(where a.status='completed'),
    'cancelled',count(*) filter(where a.status='cancelled' and f.no_show_at is null),
    'no_shows',count(*) filter(where f.no_show_at is not null),
    'quoted_completed_cents',coalesce(sum(f.quoted_price_cents) filter(where a.status='completed'),0),
    'missing_price',count(*) filter(where f.quoted_price_cents is null),
    'wait_sample',count(*) filter(where f.arrived_at is not null and f.started_at is not null),
    'mean_wait_minutes',avg(extract(epoch from(f.started_at-f.arrived_at))/60) filter(where f.started_at is not null)
  ) into result from appointments a left join appointment_facts f on f.appointment_id=a.id
  where (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;

  select count(*) into rating_sample from customer_surveys s join appointments a on a.id=s.appointment_id
  where s.question='satisfaction' and s.state='answered' and s.answer in ('1','2','3','4','5')
    and (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;
  select count(*) into improvement_sample from customer_surveys s join appointments a on a.id=s.appointment_id
  where s.question='improvement' and s.state='answered' and s.answer<>'skip'
    and (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;
  select count(*) into cancellation_sample from appointment_cancellations c join appointments a on a.id=c.appointment_id
  where c.reason is not null and (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;

  return result || jsonb_build_object(
    'usage',coalesce((select jsonb_object_agg(event,total) from(select event,count(*) total from customer_usage_events where(p_shop_id is null or barbershop_id=p_shop_id)and received_at>=p_from and received_at<p_to group by event)counts),'{}'::jsonb),
    'rating_sample',rating_sample,
    'rating_average',case when rating_sample>=5 then(select round(avg(s.answer::numeric),2) from customer_surveys s join appointments a on a.id=s.appointment_id where s.question='satisfaction' and s.state='answered' and s.answer in('1','2','3','4','5')and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to)else null end,
    'rating_distribution',case when rating_sample>=5 then coalesce((select jsonb_object_agg(answer,total)from(select s.answer,count(*) total from customer_surveys s join appointments a on a.id=s.appointment_id where s.question='satisfaction'and s.state='answered'and s.answer in('1','2','3','4','5')and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to group by s.answer)ratings),'{}'::jsonb)else '{}'::jsonb end,
    'improvement_sample',improvement_sample,
    'improvement_counts',case when improvement_sample>=5 then coalesce((select jsonb_object_agg(answer,total)from(select s.answer,count(*) total from customer_surveys s join appointments a on a.id=s.appointment_id where s.question='improvement'and s.state='answered'and s.answer<>'skip'and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to group by s.answer)improvements),'{}'::jsonb)else '{}'::jsonb end,
    'cancellation_reason_sample',cancellation_sample,
    'cancellation_reason_counts',case when cancellation_sample>=5 then coalesce((select jsonb_object_agg(reason,total)from(select c.reason,count(*) total from appointment_cancellations c join appointments a on a.id=c.appointment_id where c.reason is not null and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to group by c.reason)cancellations),'{}'::jsonb)else '{}'::jsonb end
  );
end $$;

create or replace function public.get_professional_insights(p_shop_id uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid; member_role public.shop_member_role; full_access boolean;
  show_money boolean; show_anonymized boolean;
begin
  if p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid period' using errcode='22023'; end if;
  select sm.staff_id,sm.role into mine,member_role from public.shop_members sm
  where sm.barbershop_id=p_shop_id and sm.user_id=auth.uid() and sm.active limit 1;
  full_access:=public.is_platform_admin() or public.can_view_full_shop(p_shop_id);
  if not full_access and mine is null then raise exception 'Not allowed' using errcode='42501'; end if;
  show_money:=public.shop_permission_granted(p_shop_id,'view_money');
  show_anonymized:=public.shop_permission_granted(p_shop_id,'view_reports_anonymized');
  return jsonb_build_object(
    'scope',case when full_access then 'shop' when show_anonymized then 'own_with_global' else 'own_score' end,
    'own',coalesce((select jsonb_build_object(
      'bookings',count(*),'completed',count(*) filter(where status='completed'),
      'cancelled',count(*) filter(where status='cancelled'),
      'customers',count(distinct coalesce(customer_id, shop_client_id)),
      'quoted_cents',case when full_access or show_money
        then coalesce(sum(booked_price_cents) filter(where status='completed'),0) else null end
    ) from public.appointments where barbershop_id=p_shop_id and starts_at>=p_from and starts_at<p_to
      and (full_access or staff_id=mine)),'{}'::jsonb),
    'global',case when not full_access and show_anonymized then coalesce((select jsonb_build_object(
      'bookings',count(*),'completed',count(*) filter(where status='completed'),
      'cancelled',count(*) filter(where status='cancelled'),
      'no_show_rate',round(100.0*count(*) filter(where f.no_show_at is not null)/nullif(count(*),0),1)
    ) from public.appointments a left join public.appointment_facts f on f.appointment_id=a.id
      where a.barbershop_id=p_shop_id and a.starts_at>=p_from and a.starts_at<p_to
      having count(*)>=5),'{}'::jsonb) else null end
  );
end $$;

create or replace function public.list_departure_appointments(p_shop_id uuid, p_staff_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.shop_can_act_on_appointment(p_shop_id, p_staff_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'staff_id', a.staff_id,
      'staff_name', st.display_name,
      'starts_at', a.starts_at,
      'ends_at', a.ends_at,
      'status', a.status,
      'service_name', sv.name,
      'customer_name', coalesce(p.full_name, sc.full_name),
      'free_staff', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.display_name) order by o.display_name)
        from public.staff o
        where o.barbershop_id = a.barbershop_id
          and o.active
          and o.id <> a.staff_id
          and exists (select 1 from public.staff_service_terms(o.id, a.service_id))
          and not exists (
            select 1 from public.appointments x
            where x.staff_id = o.id
              and x.status in ('pending', 'confirmed', 'completed')
              and x.starts_at < a.ends_at and x.ends_at > a.starts_at)
          and not exists (
            select 1 from public.availability_blocks b
            where b.barbershop_id = a.barbershop_id
              and (b.staff_id is null or b.staff_id = o.id)
              and b.starts_at < a.ends_at and b.ends_at > a.starts_at)
      ), '[]'::jsonb)
    ) order by a.starts_at)
    from public.appointments a
    join public.staff st on st.id = a.staff_id
    join public.services sv on sv.id = a.service_id
    left join public.profiles p on p.id = a.customer_id
    left join public.shop_clients sc on sc.id = a.shop_client_id
    where a.barbershop_id = p_shop_id
      and a.status in ('pending', 'confirmed', 'reschedule_requested')
      and a.starts_at > now()
      and (
        (p_staff_id is not null and a.staff_id = p_staff_id)
        or (p_staff_id is null and (
          not st.active
          or not exists (
            select 1 from public.shop_members sm
            where sm.staff_id = st.id and sm.barbershop_id = p_shop_id and sm.active)
            and st.user_id is not null))
      )
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_partner_wallet(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  mine := public.current_staff_id(p_shop_id);
  if mine is null and not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  return jsonb_build_object(
    'total_completed_cents', coalesce((
      select sum(coalesce(a.booked_price_cents, s.price_cents))
      from public.appointments a
      left join public.services s on s.id = a.service_id
      where a.barbershop_id = p_shop_id and a.status = 'completed'
        and (mine is not null and a.staff_id = mine)
    ), 0),
    'completed_count', (
      select count(*) from public.appointments a
      where a.barbershop_id = p_shop_id and a.status = 'completed'
        and (mine is not null and a.staff_id = mine)
    ),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'appointment_id', a.id,
        'starts_at', a.starts_at,
        'customer_name', coalesce(p.full_name, sc.full_name),
        'service_name', s.name,
        'amount_cents', coalesce(a.booked_price_cents, s.price_cents)
      ) order by a.starts_at desc)
      from public.appointments a
      join public.services s on s.id = a.service_id
      left join public.profiles p on p.id = a.customer_id
      left join public.shop_clients sc on sc.id = a.shop_client_id
      where a.barbershop_id = p_shop_id and a.status = 'completed'
        and (mine is not null and a.staff_id = mine)
    ), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 8. Permissões
-- ---------------------------------------------------------------------------------------------

revoke all on function public.shop_has_customer(uuid, uuid) from public, anon, authenticated;
revoke all on function public.shop_client_visible(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.link_shop_clients_to_profile(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.link_shop_clients_on_customer_join() from public, anon, authenticated;
revoke all on function public.appointments_guard_client_columns() from public, anon, authenticated;
grant execute on function public.shop_has_customer(uuid, uuid) to service_role;
grant execute on function public.shop_client_visible(uuid, uuid, uuid) to service_role;
grant execute on function public.link_shop_clients_to_profile(uuid, text, uuid) to service_role;
grant execute on function public.shop_client_clean_nickname(text) to authenticated, service_role;

revoke all on function public.find_shop_client(uuid, text) from public, anon, authenticated;
revoke all on function public.book_for_client(uuid, uuid, uuid, timestamptz, uuid, uuid, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.set_client_nickname(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.update_shop_client(uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.get_shop_client(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_team_slots(uuid, uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.find_shop_client(uuid, text) to authenticated, service_role;
grant execute on function public.book_for_client(uuid, uuid, uuid, timestamptz, uuid, uuid, text, text, text, boolean)
  to authenticated, service_role;
grant execute on function public.set_client_nickname(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.update_shop_client(uuid, uuid, text, text, boolean) to authenticated, service_role;
grant execute on function public.get_shop_client(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_team_slots(uuid, uuid, uuid, date) to authenticated, service_role;

-- Recriadas: mesmas permissões de antes (e sem PUBLIC/anon nas leituras da equipe).
revoke all on function public.get_team_schedule(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_team_schedule(uuid, timestamptz, timestamptz) to authenticated, service_role;
revoke all on function public.queue_appointment_whatsapp(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.queue_appointment_whatsapp(uuid, text, timestamptz) to service_role;
revoke all on function public.process_whatsapp_reminders() from public, anon, authenticated;
grant execute on function public.process_whatsapp_reminders() to service_role;
revoke all on function public.apply_verified_whatsapp(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.apply_verified_whatsapp(uuid, text, boolean) to service_role;
revoke all on function public.get_partner_clients(uuid) from public, anon;
grant execute on function public.get_partner_clients(uuid) to authenticated, service_role;
revoke all on function public.get_client_profile(uuid, uuid) from public, anon;
grant execute on function public.get_client_profile(uuid, uuid) to authenticated, service_role;
