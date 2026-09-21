-- Corrige a semântica de valores na matriz de permissões.
--
-- A primeira versão (20260917150000) tratava "ver valores" como um único item de
-- dono/sócio. Ao revisar o comportamento real, existem dois níveis distintos:
--
--   1. Valores do dia e o próprio recebimento — hoje visível a dono, sócio e
--      parceiro (`canViewMoney` na interface e `own.quoted_cents` na RPC).
--   2. Relatórios financeiros da loja — visível a dono e sócio, e é o que libera
--      a RPC `get_business_insights`.
--
-- Esta migration renomeia `view_own_earnings` para `view_money` (nível 1) e mantém
-- `view_financial_all` para o nível 2, preservando exatamente o acesso anterior.

-- Nenhuma linha usa o nome antigo (a matriz só guarda diferenças em relação ao padrão),
-- mas a limpeza evita sobras caso alguém tenha configurado nesse intervalo.
delete from public.shop_role_permissions where permission = 'view_own_earnings';

create or replace function public.shop_permission_catalog()
returns table(permission text, label text, description text, sort_order int)
language sql immutable set search_path=public as $$
  values
    ('view_agenda_all','Visão geral da agenda','Ver a agenda de todos os profissionais da unidade',10),
    ('view_money','Valores do dia e próprios recebimentos','Ver o resumo de valores do dia e quanto recebeu pelos próprios atendimentos',20),
    ('view_financial_all','Relatórios financeiros da loja','Acessar faturamento e relatórios financeiros completos da unidade',30),
    ('view_reports_global','Relatórios da unidade','Acessar métricas completas e identificadas da unidade',40),
    ('view_reports_anonymized','Indicadores gerais anonimizados','Ver números gerais da loja sem identificar quem é quem',50),
    ('view_own_score','Indicadores próprios','Acompanhar o próprio movimento e desempenho',60),
    ('manage_services','Gerenciar catálogo geral','Criar, editar e alterar preços dos serviços da unidade',70),
    ('manage_own_services','Gerenciar próprios serviços','Editar preço, duração e disponibilidade dos próprios serviços',80),
    ('manage_operations','Gerenciar funcionamento','Definir horários de funcionamento, bloqueios gerais e ajustes da loja',90),
    ('manage_team','Gerenciar equipe','Convidar profissionais e alterar funções',100),
    ('manage_permissions','Alterar permissões','Editar esta matriz de acessos',110)
$$;

/** Padrão de cada papel, derivado do comportamento que já existia. */
create or replace function public.shop_permission_default(
  p_role public.shop_member_role,
  p_permission text
) returns boolean language sql immutable set search_path=public as $$
  select case p_permission
    -- Dono e sócio operam a unidade inteira.
    when 'view_agenda_all'         then p_role in ('owner','partner')
    when 'view_financial_all'      then p_role in ('owner','partner')
    when 'view_reports_global'     then p_role in ('owner','partner')
    when 'manage_services'         then p_role in ('owner','partner')
    when 'manage_operations'       then p_role in ('owner','partner')
    when 'manage_team'             then p_role in ('owner','partner')
    when 'manage_permissions'      then p_role in ('owner','partner')
    -- Parceiro tem ambiente próprio: indicadores gerais sem identificação.
    when 'view_reports_anonymized' then p_role = 'associate'
    when 'manage_own_services'     then p_role in ('owner','partner','associate')
    -- Valores do dia e próprios recebimentos: contratado não vê.
    when 'view_money'              then p_role in ('owner','partner','associate')
    -- Contratado vê o próprio score.
    when 'view_own_score'          then true
    else false
  end
$$;

-- `own.quoted_cents` passa a usar a permissão renomeada.
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
      'customers',count(distinct customer_id),
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
