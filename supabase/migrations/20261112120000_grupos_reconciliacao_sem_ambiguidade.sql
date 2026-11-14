-- Nº 111 — P-120: separa variável PL/pgSQL do alias de consulta.
-- Preserva seleção, limites, pausas, assinatura e permissões da nº 107.
create or replace function public.queue_care_group_reconciliation() returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_group public.whatsapp_care_groups%rowtype; v_ids jsonb;
begin
  if not (select enrollment_enabled from public.whatsapp_group_settings) then return '[]'::jsonb; end if;
  for v_group in select x.* from public.whatsapp_care_groups x where x.group_jid is not null
    and x.state in ('active','waiting_customer') and x.reason<>'operator_pause'
    and (x.observed_at is null or x.observed_at<now()-interval '30 seconds')
    and not exists(select 1 from public.whatsapp_care_operations o where o.group_id=x.id and
      ((o.state='running' and o.lease_until>now()) or (o.version=x.version and o.state in ('pending','blocked') and o.started_at is null)))
    order by x.observed_at nulls first,x.id limit 5 for update skip locked loop
    update public.whatsapp_care_groups set version=version+1,controls_verified=false where id=v_group.id;
    insert into public.whatsapp_care_operations(group_id,kind,version) values(v_group.id,'reconcile',v_group.version+1) on conflict do nothing;
  end loop;
  select coalesce(jsonb_agg(todo.id),'[]') into v_ids from (select o.id from public.whatsapp_care_operations o
    join public.whatsapp_care_groups g on g.id=o.group_id where g.version=o.version and o.state in ('pending','blocked')
      and o.started_at is null and g.reason<>'operator_pause'
      and (g.state not in ('closed','customer_left','creation_unknown') or (g.state='closed' and o.kind='close'))
    order by o.created_at,o.id limit 5) todo;
  return v_ids;
end $$;
revoke all on function public.queue_care_group_reconciliation() from public,anon,authenticated;
grant execute on function public.queue_care_group_reconciliation() to service_role;

