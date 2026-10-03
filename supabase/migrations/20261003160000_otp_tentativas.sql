-- Limite de tentativas na verificação de códigos OTP (auth-otp e, futuramente, register-shop).
-- Cada erro soma 1 em todos os desafios abertos do mesmo destino/loja/finalidade;
-- ao chegar ao limite, o desafio é consumido (invalidado). A checagem e a contagem
-- acontecem numa única transação com bloqueio das linhas, para que requisições
-- em paralelo não consigam testar códigos além do limite.

alter table public.auth_otp_challenges
  add column if not exists attempts integer not null default 0;

create or replace function public.auth_otp_check_code(
  p_barbershop_id uuid,
  p_destination text,
  p_channel public.auth_otp_channel,
  p_purpose public.auth_otp_purpose,
  p_code_hash text,
  p_max_attempts integer default 5
)
returns table (challenge_id uuid, user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.auth_otp_challenges;
begin
  -- Bloqueia os desafios abertos deste destino: tentativas em paralelo ficam em fila.
  perform 1
  from public.auth_otp_challenges c
  where c.barbershop_id is not distinct from p_barbershop_id
    and c.destination = p_destination
    and c.channel = p_channel
    and c.purpose = p_purpose
    and c.consumed_at is null
    and c.expires_at > now()
  for update;

  select * into v_match
  from public.auth_otp_challenges c
  where c.barbershop_id is not distinct from p_barbershop_id
    and c.destination = p_destination
    and c.channel = p_channel
    and c.purpose = p_purpose
    and c.consumed_at is null
    and c.expires_at > now()
    and c.attempts < p_max_attempts
    and c.code_hash = p_code_hash
  order by c.created_at desc
  limit 1;

  if v_match.id is not null then
    update public.auth_otp_challenges
       set consumed_at = now()
     where id = v_match.id;
    challenge_id := v_match.id;
    user_id := v_match.user_id;
    return next;
    return;
  end if;

  -- Código errado: conta a tentativa em todos os desafios abertos e invalida
  -- os que chegaram ao limite.
  update public.auth_otp_challenges c
     set attempts = c.attempts + 1,
         consumed_at = case
           when c.attempts + 1 >= p_max_attempts then now()
           else c.consumed_at
         end
   where c.barbershop_id is not distinct from p_barbershop_id
     and c.destination = p_destination
     and c.channel = p_channel
     and c.purpose = p_purpose
     and c.consumed_at is null
     and c.expires_at > now();

  return;
end;
$$;

revoke all on function public.auth_otp_check_code(
  uuid, text, public.auth_otp_channel, public.auth_otp_purpose, text, integer
) from public, anon, authenticated;
grant execute on function public.auth_otp_check_code(
  uuid, text, public.auth_otp_channel, public.auth_otp_purpose, text, integer
) to service_role;
