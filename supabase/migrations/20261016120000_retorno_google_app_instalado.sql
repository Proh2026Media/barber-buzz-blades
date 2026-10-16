-- Login com Google no app instalado (PWA), principalmente no iPhone.
--
-- Problema: no app instalado na tela de início, o Google abre numa janela por cima do app (no
-- iPhone, a "folha" do Safari; no Android, a aba personalizada do Chrome). No iPhone essa janela
-- não tem o armazenamento do app: o login termina lá dentro, a sessão fica presa nela e, ao fechar
-- a janela, o app continua na tela de entrar. A pessoa fica em laço.
--
-- Regra: o app instalado começa o login (PKCE) e guarda a chave secreta (code_verifier) no próprio
-- aparelho, no armazenamento do app. O Google volta para `/auth/retorno?relay=<id>` dentro da
-- janela; essa página só entrega o CÓDIGO de autorização a esta tabela, com o id combinado. O app,
-- ao voltar ao primeiro plano, retira o código e troca pela sessão com a chave que só ele tem.
--
-- Segurança:
--   * o código sozinho não abre sessão: a troca exige o code_verifier (PKCE), que nunca sai do app;
--   * o id é um UUID aleatório criado pelo app (122 bits); quem não o conhece não acha o código;
--   * cada código é retirado uma vez só (apagado na leitura) e vale 10 minutos;
--   * a primeira gravação vence (um id não é sobrescrito) e cada código ocupa um id só;
--   * só entra código de login de verdade, emitido há pouco pelo próprio Auth (`auth.flow_state`,
--     onde o Auth guarda o código depois que o Google confirma a pessoa). Sem isso, qualquer
--     visitante poderia lotar a tabela com códigos inventados e travar o login de todos
--     (revisão de 16/10/2026). Se o Auth mudar o formato dessa tabela, a conferência cai para
--     um teto de 5.000 entregas em 15 minutos;
--   * a tabela não tem acesso pela API: só as duas funções abaixo mexem nela.

create table if not exists public.oauth_code_relay (
  id uuid primary key,
  code text not null,
  created_at timestamptz not null default now(),
  constraint oauth_code_relay_code_shape check (code ~ '^[A-Za-z0-9._~-]{8,255}$')
);

create index if not exists oauth_code_relay_created_at_idx
  on public.oauth_code_relay (created_at);
-- Um código de login verdadeiro entra uma vez só: sem isso, quem tem um código válido (o próprio
-- login) poderia gravá-lo em quantos ids quisesse durante 10 minutos (revisão de 16/10/2026).
create unique index if not exists oauth_code_relay_code_uidx
  on public.oauth_code_relay (code);

alter table public.oauth_code_relay enable row level security;
revoke all on public.oauth_code_relay from public, anon, authenticated;
grant all on public.oauth_code_relay to service_role;

-- Janela do Google (sem sessão): entrega o código ao id combinado. Devolve true se gravou.
create or replace function public.oauth_relay_put(p_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checked boolean := false;
begin
  if p_id is null or p_code is null or p_code !~ '^[A-Za-z0-9._~-]{8,255}$' then
    return false;
  end if;

  -- Limpeza: o que passou de 15 minutos não serve mais para nada.
  delete from public.oauth_code_relay where created_at < now() - interval '15 minutes';

  -- Só código emitido pelo Auth nos últimos 10 minutos (o Auth só grava o código depois que o
  -- Google confirma a pessoa; quem não fez o login não tem como saber um código válido).
  begin
    if not exists (
      select 1 from auth.flow_state fs
      where fs.auth_code = p_code
        and coalesce(fs.auth_code_issued_at, fs.created_at) > now() - interval '10 minutes'
    ) then
      return false;
    end if;
    v_checked := true;
  exception
    when undefined_table or undefined_column or insufficient_privilege then
      v_checked := false;
  end;

  -- Sem como conferir (Auth de outro formato): teto contra enchimento da tabela.
  if not v_checked and (select count(*) from public.oauth_code_relay) >= 5000 then
    return false;
  end if;

  insert into public.oauth_code_relay (id, code)
  values (p_id, p_code)
  on conflict do nothing;
  return found;
end;
$$;

-- App instalado: retira (e apaga) o código do id que ele criou. Sem código ainda: null.
create or replace function public.oauth_relay_take(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if p_id is null then
    return null;
  end if;
  delete from public.oauth_code_relay
   where id = p_id
     and created_at > now() - interval '10 minutes'
  returning code into v_code;
  return v_code;
end;
$$;

revoke all on function public.oauth_relay_put(uuid, text) from public, anon, authenticated;
revoke all on function public.oauth_relay_take(uuid) from public, anon, authenticated;
grant execute on function public.oauth_relay_put(uuid, text) to anon, authenticated, service_role;
grant execute on function public.oauth_relay_take(uuid) to anon, authenticated, service_role;
