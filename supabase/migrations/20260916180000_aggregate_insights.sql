create or replace function public.get_business_insights(p_shop_id uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; rating_sample bigint; improvement_sample bigint; cancellation_sample bigint;
begin
  if auth.uid() is null or not (is_platform_admin() or (p_shop_id is not null and has_shop_role(p_shop_id,array['shop_admin']::app_role[]))) then raise exception 'Not allowed'; end if;
  if p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid period'; end if;
  select jsonb_build_object(
    'bookings',count(*),'customers',count(distinct a.customer_id),
    'completed',count(*) filter(where a.status='completed'),
    'cancelled',count(*) filter(where a.status='cancelled' and f.no_show_at is null),
    'no_shows',count(*) filter(where f.no_show_at is not null),
    'quoted_completed_cents',coalesce(sum(f.quoted_price_cents) filter(where a.status='completed'),0),
    'missing_price',count(*) filter(where f.quoted_price_cents is null),
    'wait_sample',count(*) filter(where f.arrived_at is not null and f.started_at is not null),
    'mean_wait_minutes',avg(extract(epoch from(f.started_at-f.arrived_at))/60) filter(where f.started_at is not null)
  ) into result from appointments a left join appointment_facts f on f.appointment_id=a.id
  where (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;

  select count(*) into rating_sample from customer_surveys s join appointments a on a.id=s.appointment_id
  where s.question='satisfaction' and s.state='answered' and s.answer in ('1','2','3','4','5')
    and (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;
  select count(*) into improvement_sample from customer_surveys s join appointments a on a.id=s.appointment_id
  where s.question='improvement' and s.state='answered' and s.answer<>'skip'
    and (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;
  select count(*) into cancellation_sample from appointment_cancellations c join appointments a on a.id=c.appointment_id
  where c.reason is not null and (p_shop_id is null or a.barbershop_id=p_shop_id) and a.starts_at>=p_from and a.starts_at<p_to;

  return result || jsonb_build_object(
    'usage',coalesce((select jsonb_object_agg(event,total) from(select event,count(*) total from customer_usage_events where(p_shop_id is null or barbershop_id=p_shop_id)and received_at>=p_from and received_at<p_to group by event)counts),'{}'::jsonb),
    'rating_sample',rating_sample,
    'rating_average',case when rating_sample>=5 then(select round(avg(s.answer::numeric),2) from customer_surveys s join appointments a on a.id=s.appointment_id where s.question='satisfaction' and s.state='answered' and s.answer in('1','2','3','4','5')and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to)else null end,
    'rating_distribution',case when rating_sample>=5 then coalesce((select jsonb_object_agg(answer,total)from(select s.answer,count(*) total from customer_surveys s join appointments a on a.id=s.appointment_id where s.question='satisfaction'and s.state='answered'and s.answer in('1','2','3','4','5')and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to group by s.answer)ratings),'{}'::jsonb)else '{}'::jsonb end,
    'improvement_sample',improvement_sample,
    'improvement_counts',case when improvement_sample>=5 then coalesce((select jsonb_object_agg(answer,total)from(select s.answer,count(*) total from customer_surveys s join appointments a on a.id=s.appointment_id where s.question='improvement'and s.state='answered'and s.answer<>'skip'and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to group by s.answer)improvements),'{}'::jsonb)else '{}'::jsonb end,
    'cancellation_reason_sample',cancellation_sample,
    'cancellation_reason_counts',case when cancellation_sample>=5 then coalesce((select jsonb_object_agg(reason,total)from(select c.reason,count(*) total from appointment_cancellations c join appointments a on a.id=c.appointment_id where c.reason is not null and(p_shop_id is null or a.barbershop_id=p_shop_id)and a.starts_at>=p_from and a.starts_at<p_to group by c.reason)cancellations),'{}'::jsonb)else '{}'::jsonb end
  );
end $$;
notify pgrst,'reload schema';
