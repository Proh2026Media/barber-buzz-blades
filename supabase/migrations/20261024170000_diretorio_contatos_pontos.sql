-- P-80: WhatsApp pesquisável e saldo de pontos da própria loja no diretório.
-- Base: get_partner_clients de 20261016130000_agendamento_pelo_painel.sql.
-- Conserva a lista de atendimentos concluídos e o escopo atual: loja inteira ou só a própria
-- agenda. O WhatsApp já é legível nos perfis/fichas desse escopo; não busca novos clientes.
-- Pontos respeitam a política de loyalty_accounts (20260923160000_multi_shop_loyalty.sql).
-- Cliente do balcão não recebe pontos fictícios; sem permissão a chave é omitida.
-- Sem gravação de dados, mudança de assinatura ou efeito nos demais campos da resposta.

create or replace function public.get_partner_clients(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare mine uuid; full_access boolean; can_read_points boolean;
begin
  if auth.uid() is null then raise exception 'Not allowed' using errcode='42501'; end if;
  mine := public.current_staff_id(p_shop_id);
  full_access := public.is_platform_admin() or public.can_view_full_shop(p_shop_id);
  if mine is null and not full_access then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  -- Mesmas permissões da política de leitura de loyalty_accounts (20260923160000).
  can_read_points := public.is_platform_admin()
    or public.has_shop_role(p_shop_id, array['shop_admin']::public.app_role[])
    or public.has_shop_member_role(p_shop_id, array['owner','partner','associate']::public.shop_member_role[]);

  return coalesce((
    select jsonb_agg(c order by c->>'last_visit' desc)
    from (
      select jsonb_build_object(
        'customer_id', g.customer_id,
        'customer_name', coalesce(p.full_name, sc.full_name),
        'visits', g.visits,
        'total_spent_cents', g.total_spent_cents,
        'last_visit', g.last_visit,
        'whatsapp', coalesce(p.whatsapp_e164, sc.whatsapp_e164),
        -- Novos (20261016130000).
        'shop_client_id', g.shop_client_id,
        'nickname', coalesce(scp.nickname, sc.nickname),
        'has_account', case when g.customer_id is not null then true
                            when g.shop_client_id is not null then false
                            else null end
      ) || case when can_read_points then jsonb_build_object(
        'points', case when g.customer_id is not null then coalesce(la.points, 0) else null end
      ) else '{}'::jsonb end as c
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
      left join public.loyalty_accounts la
        on la.user_id = g.customer_id and la.barbershop_id = p_shop_id
      left join public.profiles p on p.id = g.customer_id
      left join public.shop_clients sc on sc.id = g.shop_client_id
      left join public.shop_clients scp
        on g.customer_id is not null and scp.barbershop_id = p_shop_id and scp.profile_id = g.customer_id
    ) clients
  ), '[]'::jsonb);
end $$;

revoke all on function public.get_partner_clients(uuid) from public, anon, authenticated;
grant execute on function public.get_partner_clients(uuid) to authenticated, service_role;
notify pgrst, 'reload schema';
