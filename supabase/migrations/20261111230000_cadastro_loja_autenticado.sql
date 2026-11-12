-- Nº 110 / P-120: cria a loja na conta autenticada, sem OTP privado nem conta duplicada.
-- Reutiliza create_own_barbershop da nº 94 (20261013210000), preservando governança.
create table if not exists public.shop_registration_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.shop_registration_requests enable row level security;
revoke all on public.shop_registration_requests from public, anon, authenticated;
grant all on public.shop_registration_requests to service_role;

create or replace function public.register_my_barbershop(
  p_request_id uuid, p_name text, p_timezone text, p_society_intent text,
  p_terms_accepted boolean, p_terms_version text, p_privacy_version text, p_dpa_version text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_shop uuid;
  v_member uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null or not exists (
    select 1 from auth.users where id = v_uid and email_confirmed_at is not null
      and deleted_at is null and (banned_until is null or banned_until <= now())
      and not coalesce(is_anonymous, false)
  ) then raise exception 'Entre com uma conta de e-mail confirmada para criar a barbearia.' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'Pedido inválido.' using errcode='22023'; end if;
  -- Serializa duas chamadas/abas da mesma pessoa. Repetir pedido devolve resultado original,
  -- inclusive após perda de resposta; nunca cria outra loja por acidente.
  perform pg_advisory_xact_lock(hashtextextended('shop-registration:'||v_uid::text,0));
  select result into v_result from public.shop_registration_requests
    where user_id=v_uid and request_id=p_request_id;
  if found then return v_result; end if;
  if v_name is null or char_length(v_name)>120 then raise exception 'Informe um nome de até 120 caracteres.' using errcode='22023'; end if;
  if p_timezone is null or not public.is_valid_shop_timezone(p_timezone) then raise exception 'Escolha um fuso válido.' using errcode='22023'; end if;
  if p_society_intent is null or p_society_intent not in ('single','majority','equal','minority') then raise exception 'Escolha a composição da barbearia.' using errcode='22023'; end if;
  if p_terms_accepted is distinct from true or public.legal_version_clean(p_terms_version) is null
     or public.legal_version_clean(p_privacy_version) is null or public.legal_version_clean(p_dpa_version) is null then
    raise exception 'Aceite os Termos, a Política de Privacidade e o Acordo de Dados.' using errcode='22023'; end if;
  perform public.record_my_terms_acceptance(p_terms_version,p_privacy_version,p_dpa_version,true);
  v_result := public.create_own_barbershop(v_name);
  v_shop := (v_result->>'shop_id')::uuid;
  update public.barbershops set timezone=p_timezone,society_intent=p_society_intent where id=v_shop;
  select id into strict v_member from public.shop_members where barbershop_id=v_shop and user_id=v_uid and role='owner' and active;
  v_result := v_result || jsonb_build_object('member_id',v_member,'shop_name',v_name);
  insert into public.shop_registration_requests(user_id,request_id,result) values(v_uid,p_request_id,v_result);
  -- Não toca no telefone/consentimento/grupo do perfil, nem publica contato não confirmado.
  return v_result;
end;
$$;
revoke all on function public.register_my_barbershop(uuid,text,text,text,boolean,text,text,text) from public,anon,authenticated;
grant execute on function public.register_my_barbershop(uuid,text,text,text,boolean,text,text,text) to authenticated;
notify pgrst,'reload schema';
