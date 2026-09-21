alter table public.customer_surveys drop constraint customer_surveys_question_check;
alter table public.customer_surveys add constraint customer_surveys_question_check check(question in ('discovery','period','professional','frequency','conversation','satisfaction','improvement'));
alter table public.customer_surveys add column appointment_id uuid references public.appointments(id) on delete cascade;
alter table public.customer_surveys add column appointment_starts_at timestamptz;

create or replace function public.next_customer_survey() returns jsonb language plpgsql security definer set search_path = public as $$
declare q text; result customer_surveys; target_id uuid; target_start timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 11));
  if not coalesce((select surveys from customer_privacy where user_id = auth.uid()), false) then return null; end if;
  if not exists(select 1 from appointments where customer_id = auth.uid()) then return null; end if;
  if exists(select 1 from customer_privacy where user_id = auth.uid() and last_survey_at > now() - interval '30 days') then return null; end if;
  if exists(select 1 from customer_surveys where user_id = auth.uid() and shown_at > now() - interval '30 days') then return null; end if;

  if not exists(select 1 from customer_surveys where user_id=auth.uid() and question='discovery') then q := 'discovery'; end if;

  if q is null and not exists(select 1 from customer_surveys where user_id=auth.uid() and question='improvement' and shown_at > now()-interval '180 days') then
    select s.appointment_id,s.appointment_starts_at into target_id,target_start
    from customer_surveys s join appointments a on a.id=s.appointment_id
    where s.user_id=auth.uid() and a.customer_id=auth.uid() and a.status='completed' and a.ends_at<=now()
      and s.question='satisfaction' and s.state='answered' and s.answer in ('1','2','3','4','5') and s.shown_at>now()-interval '180 days'
      and not exists(select 1 from customer_surveys other where other.user_id=auth.uid() and other.question='improvement' and other.appointment_id=s.appointment_id)
    order by s.shown_at desc,s.id limit 1;
    if target_id is not null then q := 'improvement'; end if;
  end if;

  if q is null and not exists(select 1 from customer_surveys where user_id=auth.uid() and question='satisfaction' and shown_at > now()-interval '180 days') then
    select a.id,a.starts_at into target_id,target_start from appointments a
    where a.customer_id=auth.uid() and a.status='completed' and a.ends_at<=now() and a.ends_at>=now()-interval '90 days'
      and not exists(select 1 from customer_surveys s where s.user_id=auth.uid() and s.question='satisfaction' and s.appointment_id=a.id)
    order by a.ends_at desc,a.id limit 1;
    if target_id is not null then q := 'satisfaction'; end if;
  end if;

  if q is null then
    select candidate into q from unnest(array['period','professional','frequency','conversation']) with ordinality as choices(candidate, position)
    where not exists(select 1 from customer_surveys where user_id=auth.uid() and question=candidate and shown_at>now()-interval '180 days') order by position limit 1;
  end if;
  if q is null then return null; end if;
  insert into customer_surveys(user_id,question,appointment_id,appointment_starts_at) values(auth.uid(),q,target_id,target_start) returning * into result;
  update customer_privacy set last_survey_at=now() where user_id=auth.uid();
  return to_jsonb(result);
end $$;

create or replace function public.answer_customer_survey(p_id uuid, p_answer text) returns void language plpgsql security definer set search_path = public as $$
declare q text; allowed text[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 11));
  if not coalesce((select surveys from customer_privacy where user_id = auth.uid()), false) then raise exception 'Surveys disabled'; end if;
  select question into q from customer_surveys where id = p_id and user_id = auth.uid() and state = 'shown' for update;
  if q is null then raise exception 'Survey unavailable'; end if;
  allowed := case q
    when 'satisfaction' then array['1','2','3','4','5','skip']
    when 'improvement' then array['result','punctuality','service','comfort','booking','none','other','skip']
    when 'discovery' then array['referral','walk_by','google','instagram','other','skip']
    when 'period' then array['morning','afternoon','evening','varies','skip']
    when 'professional' then array['same','available','by_service','no_preference','skip']
    when 'frequency' then array['up_to_15','16_to_30','31_to_60','over_60','undefined','skip']
    when 'conversation' then array['talk','quiet','decide_on_day','no_preference','skip'] end;
  if p_answer is not null and not (p_answer = any(allowed)) then raise exception 'Invalid answer'; end if;
  update customer_surveys set answer = p_answer, state = case when p_answer is null then 'dismissed' else 'answered' end,
    answered_at = now() where id = p_id;
end $$;


notify pgrst, 'reload schema';
