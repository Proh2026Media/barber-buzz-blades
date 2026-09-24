-- Cadastro self-serve: OTP de signup sem loja + token de verificação.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'auth_otp_purpose'
      and e.enumlabel = 'signup'
  ) then
    alter type public.auth_otp_purpose add value 'signup';
  end if;
end $$;

alter table public.auth_otp_challenges
  alter column barbershop_id drop not null;

alter table public.auth_otp_challenges
  add column if not exists verification_token text;

create unique index if not exists auth_otp_challenges_verification_token_uidx
  on public.auth_otp_challenges (verification_token)
  where verification_token is not null;

create index if not exists auth_otp_challenges_platform_open_idx
  on public.auth_otp_challenges (destination, purpose)
  where consumed_at is null and barbershop_id is null;
