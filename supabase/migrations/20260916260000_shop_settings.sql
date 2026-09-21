-- Customer-facing identity and booking controls owned by each barbershop.
create table public.barbershop_settings (
  barbershop_id uuid primary key references public.barbershops(id) on delete cascade,
  tagline text not null default 'Club & Lounge' check (char_length(tagline) between 1 and 60),
  booking_instructions text not null default '' check (char_length(booking_instructions) <= 240),
  booking_horizon_days smallint not null default 14 check (booking_horizon_days between 7 and 30),
  survey_program_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger barbershop_settings_set_updated_at
  before update on public.barbershop_settings
  for each row execute function public.set_updated_at();

create or replace function public.seed_barbershop_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.barbershop_settings (barbershop_id) values (new.id)
  on conflict (barbershop_id) do nothing;
  return new;
end;
$$;

create trigger barbershops_seed_settings_trg
  after insert on public.barbershops
  for each row execute function public.seed_barbershop_settings();

insert into public.barbershop_settings (barbershop_id)
select id from public.barbershops
on conflict (barbershop_id) do nothing;

alter table public.barbershop_settings enable row level security;

create policy "Shop members read settings"
  on public.barbershop_settings for select
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['customer', 'shop_admin']::public.app_role[])
  );

create policy "Shop admins manage settings"
  on public.barbershop_settings for update
  using (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_shop_role(barbershop_id, array['shop_admin']::public.app_role[])
  );

grant select on public.barbershop_settings to authenticated;
grant update (tagline, booking_instructions, booking_horizon_days, survey_program_enabled)
  on public.barbershop_settings to authenticated;
