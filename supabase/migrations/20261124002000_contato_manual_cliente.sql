-- A ficha mantém a autorização original. O telefone requer vínculo com esta loja.
create function public.get_client_profile_with_contact(p_shop_id uuid, p_customer_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  ficha jsonb;
  contato text;
begin
  ficha := public.get_client_profile(p_shop_id, p_customer_id);
  if exists (select 1 from public.appointments where barbershop_id=p_shop_id and customer_id=p_customer_id)
     or exists (select 1 from public.shop_clients where barbershop_id=p_shop_id and profile_id=p_customer_id) then
    select whatsapp_e164 into contato from public.profiles where id=p_customer_id;
  end if;
  return ficha || jsonb_build_object('contact_phone', contato);
end;
$$;
revoke all on function public.get_client_profile_with_contact(uuid,uuid) from public, anon;
grant execute on function public.get_client_profile_with_contact(uuid,uuid) to authenticated;
