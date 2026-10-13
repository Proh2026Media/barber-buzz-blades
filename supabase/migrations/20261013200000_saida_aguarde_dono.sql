-- Saída da equipe: quem leva clientes espera a liberação do dono (desde 20261013190000 vale
-- também para o Parceiro). A mensagem dizia "do sócio"; passa a dizer "do dono".
-- Recria complete_shop_departure a partir de 20261013190000_saida_equipe_reservas.sql,
-- mudando só o texto do erro.

create or replace function public.complete_shop_departure(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.shop_departure_requests;
  origin_slug text;
  old_booking_slug text;
  dest_staff_id uuid;
  cust uuid;
  origin_points int;
  origin_lifetime int;
  red public.loyalty_redemptions;
  v_future int;
begin
  select * into req from public.shop_departure_requests where id = p_request_id for update;
  if req.id is null then raise exception 'Pedido não encontrado' using errcode = 'P0002'; end if;
  if req.status = 'completed' then return; end if;
  if req.status not in ('approved', 'pending_release') then
    raise exception 'Pedido não está aprovado' using errcode = '22023';
  end if;
  if req.status = 'pending_release' then
    raise exception 'Aguarde a liberação do dono' using errcode = '42501';
  end if;
  -- Só o próprio profissional, quem liberou a carteira, o admin da plataforma ou o servidor.
  if auth.uid() is not null
     and auth.uid() is distinct from req.user_id
     and auth.uid() is distinct from req.release_approved_by
     and not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- P-61: ninguém sai deixando reservas futuras sem dono resolver.
  v_future := public.staff_future_appointment_count(req.staff_id);
  if v_future > 0 then
    raise exception 'Ainda há % reserva(s) futura(s) com este profissional. Passe para outro profissional ou cancele antes de liberar a saída.', v_future
      using errcode = 'P0001', hint = 'future_bookings';
  end if;

  -- Pedido aprovado: desativar o vínculo e o perfil (e criar o do destino) não passa de novo
  -- pela governança, que recusaria o próprio profissional assim que o vínculo é desativado.
  perform set_config('app.approved_shop_change', 'on', true);

  select slug into origin_slug from public.barbershops where id = req.barbershop_id;
  select booking_slug into old_booking_slug from public.staff where id = req.staff_id;

  if req.mode = 'take' then
    if req.dest_shop_id is null then
      raise exception 'Destino obrigatório' using errcode = '22023';
    end if;

    for cust in select * from public.portfolio_customer_ids(req.barbershop_id, req.staff_id) loop
      delete from public.memberships
      where user_id = cust
        and barbershop_id = req.barbershop_id
        and role = 'customer';
      insert into public.memberships (user_id, barbershop_id, role)
      select cust, req.dest_shop_id, 'customer'
      where not exists (
        select 1 from public.memberships m
        where m.user_id = cust
          and m.barbershop_id = req.dest_shop_id
          and m.role = 'customer'
      );

      -- devolve resgates pendentes na origem antes de mover a carteira
      for red in
        select * from public.loyalty_redemptions
        where user_id = cust and barbershop_id = req.barbershop_id and status = 'pending'
        for update
      loop
        update public.loyalty_redemptions
          set status = 'cancelled', resolved_at = now()
          where id = red.id;
        insert into public.loyalty_ledger (user_id, barbershop_id, delta, reason, redemption_id, note)
        values (cust, req.barbershop_id, red.cost_points, 'reward_refunded', red.id, 'shop_departure');
        update public.loyalty_accounts
          set points = points + red.cost_points, updated_at = now()
          where user_id = cust and barbershop_id = req.barbershop_id;
      end loop;

      -- mover/mesclar saldo e total da vida da loja origem → destino
      origin_points := null;
      origin_lifetime := null;
      select points, lifetime_points into origin_points, origin_lifetime
      from public.loyalty_accounts
      where user_id = cust and barbershop_id = req.barbershop_id;

      if coalesce(origin_points, 0) > 0 or coalesce(origin_lifetime, 0) > 0 then
        insert into public.loyalty_accounts (user_id, barbershop_id, points, lifetime_points)
        values (cust, req.dest_shop_id, coalesce(origin_points, 0), coalesce(origin_lifetime, 0))
        on conflict (user_id, barbershop_id) do update
          set points = public.loyalty_accounts.points + excluded.points,
              lifetime_points = public.loyalty_accounts.lifetime_points + excluded.lifetime_points,
              updated_at = now();

        update public.loyalty_ledger l
        set barbershop_id = req.dest_shop_id
        where l.user_id = cust
          and l.barbershop_id = req.barbershop_id
          and not (
            l.reason = 'welcome_bonus'
            and exists (
              select 1 from public.loyalty_ledger d
              where d.user_id = cust and d.barbershop_id = req.dest_shop_id
                and d.reason = 'welcome_bonus'
            )
          );
      end if;

      delete from public.loyalty_accounts
      where user_id = cust and barbershop_id = req.barbershop_id;
    end loop;

    select sm.staff_id into dest_staff_id
    from public.shop_members sm
    where sm.barbershop_id = req.dest_shop_id and sm.user_id = req.user_id and sm.active
    limit 1;

    if dest_staff_id is null then
      insert into public.staff (barbershop_id, user_id, display_name, active)
      select req.dest_shop_id, req.user_id, s.display_name, true
      from public.staff s where s.id = req.staff_id
      returning id into dest_staff_id;

      update public.shop_members
      set staff_id = dest_staff_id
      where barbershop_id = req.dest_shop_id and user_id = req.user_id and active;
    end if;

    if old_booking_slug is not null then
      update public.staff_slug_redirects
      set
        staff_id = dest_staff_id,
        owner_user_id = req.user_id,
        locked = true,
        deleted_at = null
      where from_shop_slug = origin_slug
        and from_booking_slug = old_booking_slug;

      insert into public.staff_slug_redirects (
        from_shop_slug, from_booking_slug, staff_id, owner_user_id, locked
      )
      select origin_slug, old_booking_slug, dest_staff_id, req.user_id, true
      where not exists (
        select 1 from public.staff_slug_redirects r
        where r.from_shop_slug = origin_slug
          and r.from_booking_slug = old_booking_slug
          and r.deleted_at is null
      );
    end if;

    update public.staff_slug_redirects
    set locked = true, staff_id = dest_staff_id, deleted_at = null
    where owner_user_id = req.user_id
      and from_shop_slug = origin_slug
      and deleted_at is null;
  else
    update public.staff_slug_redirects
    set deleted_at = now()
    where from_shop_slug = origin_slug
      and owner_user_id = req.user_id
      and locked = false
      and deleted_at is null;
  end if;

  update public.shop_members
  set active = false
  where barbershop_id = req.barbershop_id and user_id = req.user_id;

  update public.staff
  set active = false
  where id = req.staff_id;

  delete from public.memberships
  where user_id = req.user_id
    and barbershop_id = req.barbershop_id
    and role = 'shop_admin';

  update public.shop_departure_requests
  set status = 'completed', completed_at = now()
  where id = req.id;
end;
$$;

notify pgrst, 'reload schema';
