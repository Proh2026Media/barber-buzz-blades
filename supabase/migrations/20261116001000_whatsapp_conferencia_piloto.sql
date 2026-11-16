-- Plano de consulta limitado ao escopo já autorizado. Não ativa ou observa conexões.
begin;
create function public.care_pilot_connection_check() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare p public.whatsapp_care_cycle_policy%rowtype;g public.whatsapp_care_groups%rowtype;
 s jsonb;numbers jsonb;targets jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Sem permissão' using errcode='42501';end if;
 s:=public.care_pilot_admin('read');
 select * into p from public.whatsapp_care_cycle_policy where singleton;
 select * into g from public.whatsapp_care_groups where barbershop_id=p.pilot_shop_id and customer_id=p.pilot_customer_id;
 numbers:=public.care_cycle_composition(p.pilot_shop_id,g.current_cycle_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'phone',n->>'phone','version',c.routing_version) order by n->>'id'),'[]') into targets
 from jsonb_array_elements(numbers) n join public.whatsapp_channels c on c.id=(n->>'id')::uuid;
 return jsonb_build_object('contract','bc-pilot-connection-check-v1','state',s,'targets',targets,
  'fingerprint',md5(jsonb_build_object('shop',p.pilot_shop_id,'customer',p.pilot_customer_id,
   'policy_version',p.version,'pause_version',s->'pause_version','isolated',p.pilot_isolation_required,
   'group',g.id,'cycle',g.current_cycle_id,'composition',numbers,'targets',targets)::text));
end $$;
revoke all on function public.care_pilot_connection_check() from public,anon,authenticated,service_role;
grant execute on function public.care_pilot_connection_check() to authenticated;
notify pgrst,'reload schema';
commit;
