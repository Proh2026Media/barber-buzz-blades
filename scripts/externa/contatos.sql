-- Consulta de uma ficha por vez. Não altera Auth, o contato da pessoa nem as filas.
create or replace function public.emails_informados_agendamentos_externa(
  p_loja uuid, p_ficha uuid default null, p_conta uuid default null
) returns table (reserva uuid,inicio timestamptz,email text)
language sql stable security definer set search_path='' as $$
  select a.id, a.starts_at, btrim(l.registro->>'email')
  from manutencao.espelho_externa_linhas l
  join public.appointments a on a.id=l.agendamento_id and a.barbershop_id=p_loja
  join public.shop_clients c on c.id=a.shop_client_id and c.barbershop_id=p_loja
  where p_loja='a5c2b03b-1e30-4446-b013-8cb8a9d8c447' and auth.uid() is not null
    and (public.is_platform_admin() or public.has_shop_member_role(p_loja,array['owner','partner']::public.shop_member_role[]))
    and public.shop_client_visible(p_loja,c.profile_id,c.id)
    and ((p_conta is null and c.id=p_ficha and c.profile_id is null and a.customer_id is null)
      or (p_ficha is null and c.profile_id=p_conta and a.customer_id=p_conta))
    and l.presente and l.situacao='vinculada' and l.motivo is null
    and l.origem_aplicada->>'shop_client_id'=c.id::text and l.registro->>'telefone'=c.whatsapp_e164
    and length(btrim(l.registro->>'email'))<=254
    and btrim(l.registro->>'email') ~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+[.][^@[:space:][:cntrl:]]+$'
  order by a.starts_at desc, a.id;
$$;
revoke all on function public.emails_informados_agendamentos_externa(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.emails_informados_agendamentos_externa(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
