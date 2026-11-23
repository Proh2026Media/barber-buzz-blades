create or replace function public.care_entry_background_wake(p_instance text,p_group_jid text) returns void
language plpgsql security definer set search_path=public as $$
declare g public.whatsapp_care_groups%rowtype;begin
 perform pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
 select groups.* into g from public.whatsapp_care_groups groups join public.whatsapp_care_cycles c on c.id=groups.current_cycle_id
 where c.group_jid=p_group_jid and public.care_entry_background_allowed(groups.customer_id,groups.barbershop_id)
 and exists(select 1 from jsonb_array_elements(c.consented_numbers) n where n->>'instance'=p_instance);
 if g.id is null then return;end if;
 update public.whatsapp_care_access set next_at=least(next_at,clock_timestamp()) where group_id=g.id and public.care_access_valid(id,customer_id);
 -- O evento antecipa o ciclo somente para uma intenção válida da própria loja.
 if found then
  update public.whatsapp_care_cycles set next_run_at=least(next_run_at,clock_timestamp())
   where id=g.current_cycle_id and state in ('waiting_customer','preparing')
   and coalesce(lease_until,'-infinity')<=clock_timestamp();
 end if;
 update public.whatsapp_phone_revisions set next_at=least(next_at,clock_timestamp()) where group_id=g.id and public.care_phone_revision_valid(id,customer_id);
end $$;
