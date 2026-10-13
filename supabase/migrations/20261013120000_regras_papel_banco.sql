-- Regras de papel que valiam só na tela passam a valer no banco (13/10/2026).
--
-- P-01 (decisão 7 do plano de ambientes): o Contratado sai sem levar clientes. Até aqui,
--   request_shop_departure aprovava na hora o modo 'take' de qualquer papel que não fosse
--   dono/sócio, e complete_shop_departure movia a carteira. Agora 'take' de Contratado
--   (role = 'employee') é recusado com 42501; 'forfeit' continua aceito. Função copiada de
--   20261003150000_correcoes_auditoria.sql, com só esse acréscimo.
--
-- P-04 (decisão 14): quem não tem a visão geral da agenda não recebe nome nem motivo dos
--   bloqueios dos colegas. A política "Professional members read blocks"
--   (20260917120000_shop_team_governance.sql) liberava a linha inteira a qualquer profissional.
--   Agora a leitura direta da tabela fica com: visão geral (can_view_full_shop), bloqueios da
--   loja inteira e os próprios. Os bloqueios dos colegas chegam pela RPC list_shop_blocks, só
--   com o intervalo (motivo e nome nulos), para o painel continuar desenhando a indisponibilidade.
--
-- P-07 (decisão 12): o painel da plataforma contava "Administradores" pelo papel antigo
--   memberships.role = 'shop_admin'. A RPC list_platform_shop_owners devolve os donos e sócios
--   ativos de cada loja (shop_members), a mesma regra da ficha da loja. Só o admin da plataforma.
--
-- Idempotente: pode ser reaplicada sem erro. Não muda dados.

-- ---------------------------------------------------------------------------
-- P-01. Contratado não leva a carteira ao sair
-- ---------------------------------------------------------------------------

create or replace function public.request_shop_departure(
  p_shop_id uuid,
  p_mode public.shop_departure_mode,
  p_dest_shop_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.shop_members;
  staff_row public.staff;
  other_socios int;
  request_id uuid;
  v_status public.shop_departure_status;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;

  select * into member
  from public.shop_members sm
  where sm.barbershop_id = p_shop_id and sm.user_id = auth.uid() and sm.active
  limit 1;
  if member.id is null or member.staff_id is null then
    raise exception 'Você não está vinculado a esta barbearia' using errcode = '42501';
  end if;

  select * into staff_row from public.staff s where s.id = member.staff_id;
  if staff_row.id is null then raise exception 'Profissional não encontrado' using errcode = 'P0002'; end if;

  if p_mode = 'take' and member.role = 'employee' then
    raise exception 'Contratado sai sem levar os clientes' using errcode = '42501';
  end if;

  if p_mode = 'take' then
    if p_dest_shop_id is null then
      raise exception 'Informe a barbearia de destino para levar a carteira' using errcode = '22023';
    end if;
    if p_dest_shop_id = p_shop_id then
      raise exception 'Destino deve ser outra barbearia' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.barbershops b where b.id = p_dest_shop_id and b.status = 'active'
    ) then
      raise exception 'Barbearia de destino indisponível' using errcode = 'P0002';
    end if;
    -- destino: já é membro ativo OU será dono (criou loja) — exige vínculo prévio
    if not exists (
      select 1 from public.shop_members sm
      where sm.barbershop_id = p_dest_shop_id and sm.user_id = auth.uid() and sm.active
    ) and not public.is_platform_admin() then
      raise exception 'Aceite o convite ou crie a nova barbearia antes de levar a carteira' using errcode = '42501';
    end if;
  end if;

  -- cancela pedidos pendentes anteriores do mesmo usuário/loja
  update public.shop_departure_requests r
  set status = 'cancelled', decided_at = now()
  where r.barbershop_id = p_shop_id
    and r.user_id = auth.uid()
    and r.status in ('pending_release', 'approved');

  select count(*) into other_socios
  from public.shop_members sm
  where sm.barbershop_id = p_shop_id
    and sm.active
    and sm.role in ('owner', 'partner')
    and sm.user_id <> auth.uid();

  if p_mode = 'take' and member.role in ('owner', 'partner') then
    if other_socios = 0 then
      raise exception 'Sócio único: transfira a propriedade ou abra mão da carteira' using errcode = '42501';
    end if;
    v_status := 'pending_release';
  else
    v_status := 'approved';
  end if;

  insert into public.shop_departure_requests (
    barbershop_id, user_id, staff_id, mode, dest_shop_id, status
  )
  values (
    p_shop_id, auth.uid(), member.staff_id, p_mode, p_dest_shop_id, v_status
  )
  returning id into request_id;

  if v_status = 'approved' then
    perform public.complete_shop_departure(request_id);
    return jsonb_build_object('status', 'completed', 'request_id', request_id);
  end if;

  return jsonb_build_object('status', 'pending_release', 'request_id', request_id);
end;
$$;

revoke all on function public.request_shop_departure(uuid, public.shop_departure_mode, uuid) from public, anon;
grant execute on function public.request_shop_departure(uuid, public.shop_departure_mode, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- P-04. Bloqueios dos colegas sem nome e sem motivo
-- ---------------------------------------------------------------------------

drop policy if exists "Professional members read blocks" on public.availability_blocks;
create policy "Professional members read blocks" on public.availability_blocks
for select to authenticated using (
  public.can_view_full_shop(barbershop_id)
  or (
    public.has_shop_member_role(
      barbershop_id,
      array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
    )
    and (staff_id is null or staff_id = public.current_staff_id(barbershop_id))
  )
);

-- Bloqueios da loja que terminam a partir de p_from, para o painel. Quem tem a visão geral
-- recebe tudo; os demais profissionais recebem os próprios e os da loja inteira completos, e
-- os dos colegas só com o intervalo (motivo e nome nulos).
create or replace function public.list_shop_blocks(p_shop_id uuid, p_from timestamptz default now())
returns table (
  id uuid,
  barbershop_id uuid,
  staff_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  reason text,
  created_at timestamptz,
  staff_display_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_full boolean;
  v_own uuid;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  v_full := public.can_view_full_shop(p_shop_id);
  if not v_full and not public.has_shop_member_role(
    p_shop_id,
    array['owner', 'partner', 'associate', 'employee']::public.shop_member_role[]
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_own := public.current_staff_id(p_shop_id);

  return query
  select b.id, b.barbershop_id, b.staff_id, b.starts_at, b.ends_at,
    case when v_full or b.staff_id is null or b.staff_id = v_own then b.reason end,
    b.created_at,
    case when v_full or b.staff_id = v_own then s.display_name end
  from public.availability_blocks b
  left join public.staff s on s.id = b.staff_id
  where b.barbershop_id = p_shop_id
    and b.ends_at >= coalesce(p_from, now())
  order by b.starts_at;
end;
$$;

revoke all on function public.list_shop_blocks(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.list_shop_blocks(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- P-07. Donos e sócios ativos de cada loja, para o painel da plataforma
-- ---------------------------------------------------------------------------

create or replace function public.list_platform_shop_owners()
returns table (barbershop_id uuid, user_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select distinct sm.barbershop_id, sm.user_id
  from public.shop_members sm
  where sm.active
    and sm.role in ('owner', 'partner')
    and sm.user_id is not null;
end;
$$;

revoke all on function public.list_platform_shop_owners() from public, anon, authenticated;
grant execute on function public.list_platform_shop_owners() to authenticated;
