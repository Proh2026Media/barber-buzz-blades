create function public.attach_survey_appointment_context() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.appointment_id is null and new.question='service_interest' then
    select id,starts_at into new.appointment_id,new.appointment_starts_at from appointments
    where customer_id=new.user_id order by starts_at desc,id limit 1;
  end if;
  return new;
end $$;
create trigger customer_surveys_attach_context before insert on public.customer_surveys
for each row execute function public.attach_survey_appointment_context();

update public.customer_surveys s set
  appointment_id=(select a.id from public.appointments a where a.customer_id=s.user_id order by a.starts_at desc,a.id limit 1),
  appointment_starts_at=(select a.starts_at from public.appointments a where a.customer_id=s.user_id order by a.starts_at desc,a.id limit 1)
where s.question='service_interest' and s.appointment_id is null
  and exists(select 1 from public.appointments a where a.customer_id=s.user_id);

create function public.get_service_interest_insights(p_shop_id uuid,p_from timestamptz,p_to timestamptz) returns jsonb
language plpgsql security definer set search_path=public as $$
declare sample bigint;
begin
  if auth.uid() is null or not(is_platform_admin() or(p_shop_id is not null and has_shop_role(p_shop_id,array['shop_admin']::app_role[]))) then raise exception 'Not allowed'; end if;
  if p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid period'; end if;
  select count(*) into sample from customer_surveys s join appointments a on a.id=s.appointment_id
  where s.question='service_interest' and s.state='answered' and s.answer not in('skip','none')
    and(p_shop_id is null or a.barbershop_id=p_shop_id)and s.answered_at>=p_from and s.answered_at<p_to;
  return jsonb_build_object(
    'sample',sample,
    'counts',case when sample>=5 then coalesce((select jsonb_object_agg(answer,total)from(
      select s.answer,count(*) total from customer_surveys s join appointments a on a.id=s.appointment_id
      where s.question='service_interest'and s.state='answered'and s.answer not in('skip','none')
        and(p_shop_id is null or a.barbershop_id=p_shop_id)and s.answered_at>=p_from and s.answered_at<p_to group by s.answer
    )interests),'{}'::jsonb)else '{}'::jsonb end
  );
end $$;
revoke all on function public.get_service_interest_insights(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_service_interest_insights(uuid,timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
