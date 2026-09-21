alter table public.customer_surveys drop constraint customer_surveys_source_check;
alter table public.customer_surveys add constraint customer_surveys_source_check check(source in('customer_app','shop_staff'));
alter table public.customer_surveys add column recorded_by uuid references public.profiles(id) on delete set null;
create unique index customer_surveys_appointment_question_source_unique
on public.customer_surveys(appointment_id,question,source) where appointment_id is not null and state='answered';

create function public.record_customer_survey_response(p_appointment_id uuid,p_question text,p_answer text) returns uuid
language plpgsql security definer set search_path=public as $$
declare a appointments; allowed text[]; response_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into a from appointments where id=p_appointment_id for update;
  if a.id is null or not(is_platform_admin() or has_shop_role(a.barbershop_id,array['shop_admin']::app_role[])) then raise exception 'Not allowed'; end if;
  if a.status<>'completed' or a.ends_at>now() then raise exception 'Completed appointment required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(a.customer_id::text,11));
  if not coalesce((select surveys from customer_privacy where user_id=a.customer_id),false) then raise exception 'Customer surveys disabled'; end if;
  if exists(select 1 from customer_privacy where user_id=a.customer_id and last_survey_at>now()-interval '30 days')
    or exists(select 1 from customer_surveys where user_id=a.customer_id and shown_at>now()-interval '30 days') then raise exception 'Survey cooldown active'; end if;
  allowed:=case p_question
    when 'satisfaction' then array['1','2','3','4','5','skip']
    when 'improvement' then array['result','punctuality','service','comfort','booking','none','other','skip']
    when 'period' then array['morning','afternoon','evening','varies','skip']
    when 'professional' then array['same','available','by_service','no_preference','skip']
    when 'frequency' then array['up_to_15','16_to_30','31_to_60','over_60','undefined','skip']
    when 'conversation' then array['talk','quiet','decide_on_day','no_preference','skip']
    when 'service_interest' then array['eyebrow','facial','hydration','coloring','manicure','massage','none','other','skip'] end;
  if allowed is null or not(p_answer=any(allowed)) then raise exception 'Invalid response'; end if;
  insert into customer_surveys(user_id,question,answer,state,shown_at,answered_at,source,appointment_id,appointment_starts_at,recorded_by)
  values(a.customer_id,p_question,p_answer,'answered',now(),now(),'shop_staff',a.id,a.starts_at,auth.uid()) returning id into response_id;
  update customer_privacy set last_survey_at=now() where user_id=a.customer_id;
  return response_id;
exception when unique_violation then raise exception 'Response already recorded';
end $$;
revoke all on function public.record_customer_survey_response(uuid,text,text) from public,anon;
grant execute on function public.record_customer_survey_response(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
