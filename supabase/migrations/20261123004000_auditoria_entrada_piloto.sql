-- A linha de auditoria e a mudança efetiva são confirmadas pela mesma transação.
create table public.care_group_transition_log (
 id bigint generated always as identity primary key,
 group_id uuid not null, cycle_id uuid, state text not null,
 entry_pending boolean, recorded_at timestamptz not null default clock_timestamp()
);
alter table public.care_group_transition_log enable row level security;
revoke all on public.care_group_transition_log from public, anon, authenticated, service_role;
create index on public.care_group_transition_log(group_id, recorded_at);
create function public.audit_care_group_transition() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and (old.state,old.entry_pending,old.current_cycle_id) is not distinct from
 (new.state,new.entry_pending,new.current_cycle_id) then return null; end if;
 insert into public.care_group_transition_log(group_id,cycle_id,state,entry_pending)
 values(new.id,new.current_cycle_id,new.state,new.entry_pending);
 return null;
end $$;
revoke all on function public.audit_care_group_transition() from public,anon,authenticated,service_role;
create trigger audit_pilot_group_transition after insert or update of state,entry_pending,current_cycle_id
on public.whatsapp_care_groups for each row
when(new.barbershop_id='bc8595cb-72a7-4428-8a9c-97fe12c18222')
execute function public.audit_care_group_transition();
