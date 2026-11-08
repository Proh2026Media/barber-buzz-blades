#!/usr/bin/env python3
"""Confere ou redefine uma senha de teste existente. Não cria contas/vínculos."""

import argparse
import getpass
import json
import resource
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from uuid import UUID

STACK = "z2dbb7dkyzhc8vjiywq34mhn"
API = "https://supabasebeauty.contheiner.digital/auth/v1"
LOJA_A = "16d6da2e-cd2e-4283-9936-2cb6d5e0e834"
CONTAS = frozenset(
    f"{nome}@loja-teste.invalid"
    for nome in ("dono", "socio", "parceiro", "contratado", "cliente", "cliente2", "dono-b")
)
LOJAS = {"loja-teste": "Loja Teste", "loja-teste-b": "Loja Teste B"}


class Recusa(Exception):
    """Somente mensagens sanitizadas, sem conteúdo do servidor."""


class Argumentos(argparse.ArgumentParser):
    def format_help(self):
        return super().format_help().replace("usage:", "Uso:", 1)

    def error(self, message):
        # Não reproduzir argumentos inválidos: alguém pode ter digitado uma senha.
        raise Recusa("Argumentos inválidos. Use --help; senhas nunca são argumentos.")


def exigir(condicao, mensagem):
    if not condicao:
        raise Recusa(mensagem)


def conta_permitida(email):
    exigir(email in CONTAS, "Conta fora da lista exata de contas de teste permitidas.")


def comando(argumentos, entrada=None):
    try:
        resultado = subprocess.run(
            argumentos, input=entrada, capture_output=True, text=True, timeout=25, check=False
        )
    except (OSError, subprocess.TimeoutExpired):
        raise Recusa("Não foi possível executar a consulta local ao Docker.") from None
    exigir(resultado.returncode == 0, "Consulta local recusada; detalhes omitidos por segurança.")
    return resultado.stdout.strip()


def containers():
    nomes = comando(["docker", "ps", "--format", "{{.Names}}"]).splitlines()
    bancos = [n for n in nomes if n.startswith("supabase-db-") and STACK in n]
    funcoes = [n for n in nomes if "functions" in n and STACK in n]
    exigir(len(bancos) == len(funcoes) == 1, "Não encontrei um único banco e funções do B&C. Não selecione outro projeto.")
    return bancos[0], funcoes[0]


def consultar(banco, email):
    conta_permitida(email)  # Lista exata, sem aspas ou entrada livre no SQL.
    sql = f"""
begin transaction read only;
set local statement_timeout = '10s';
set local lock_timeout = '2s';
with alvo as (
  select id, email from auth.users where lower(email) = '{email}'
), lojas as (
  select id, slug, name, status from public.barbershops
  where (slug, name) in (('loja-teste', 'Loja Teste'), ('loja-teste-b', 'Loja Teste B'))
), vinculos as (
  select 'membership' fonte, m.id, m.barbershop_id loja, m.role::text papel,
    true ativo, null::numeric percentual from public.memberships m join alvo u on u.id=m.user_id
  union all
  select 'equipe', m.id, m.barbershop_id, m.role::text, m.active, m.ownership_percent
    from public.shop_members m join alvo u on u.id=m.user_id
  union all
  select 'profissional', s.id, s.barbershop_id, 'staff', s.active, null::numeric
    from public.staff s join alvo u on u.id=s.user_id
), referencias as (
  select a.barbershop_id loja from public.appointments a join alvo u on u.id=a.customer_id
  union select n.barbershop_id from public.staff_client_notices n join alvo u on u.id=n.sent_by
  union select p.barbershop_id from public.customer_shop_preferences p join alvo u on u.id=p.user_id
  union select b.id from public.barbershops b join alvo u on u.id=b.founded_by_user_id
)
select json_build_object(
  'usuarios', coalesce((select json_agg(alvo order by id) from alvo), '[]'::json),
  'lojas', coalesce((select json_agg(lojas order by id) from lojas), '[]'::json),
  'vinculos', coalesce((select json_agg(vinculos order by fonte,id) from vinculos), '[]'::json),
  'referencias', coalesce((select json_agg(loja order by loja) from referencias), '[]'::json)
);
rollback;
"""
    resposta = comando(
        ["docker", "exec", "-i", banco, "psql", "-U", "postgres", "-d", "postgres",
         "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], sql
    )
    try:
        return json.loads(resposta)
    except (ValueError, TypeError):
        raise Recusa("A consulta não retornou o formato esperado; nada será redefinido.") from None


def validar_estado(estado, email):
    conta_permitida(email)
    usuarios = estado.get("usuarios", [])
    exigir(len(usuarios) == 1, "A conta não existe ou não é única. Não será criada nem restaurada.")
    usuario = usuarios[0]
    exigir(usuario.get("email", "").lower() == email, "E-mail divergente na consulta.")
    try:
        UUID(usuario["id"])
    except (ValueError, KeyError, TypeError):
        raise Recusa("UUID de conta inválido.") from None
    lojas = estado.get("lojas", [])
    exigir(1 <= len(lojas) <= 2, "Lojas de teste não encontradas no estado esperado.")
    exigir(any(l.get("id") == LOJA_A and l.get("slug") == "loja-teste" for l in lojas),
           "UUID da Loja Teste A não corresponde ao registro histórico.")
    for loja in lojas:
        exigir(LOJAS.get(loja.get("slug")) == loja.get("name") and loja.get("status") == "active",
               "Nome, endereço ou estado da loja diverge do ambiente de testes.")
    ids = {l["id"] for l in lojas}
    vinculos = estado.get("vinculos", [])
    exigir(bool(vinculos), "Conta sem vínculo verificável com uma loja de teste.")
    for v in vinculos:
        exigir(v.get("papel") in {"customer", "shop_admin", "owner", "partner", "associate", "employee", "staff"},
               "Conta administrativa, gerente ou papel desconhecido: recuperação recusada.")
        exigir(v.get("loja") in ids, "Conta com vínculo global ou em outra loja: recuperação recusada.")
    exigir(any(v.get("ativo") is True for v in vinculos), "Conta sem vínculo ativo; não será reativada.")
    exigir(all(r in ids for r in estado.get("referencias", [])),
           "Conta com atividade vinculada a outra loja: recuperação recusada.")
    return usuario["id"]


class SemRedirecionamento(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Auth:
    def __init__(self, funcoes):
        # O valor fica somente em memória; não entra em argv, terminal ou arquivo.
        self.chave = comando(["docker", "exec", funcoes, "printenv", "SUPABASE_SERVICE_ROLE_KEY"])
        exigir(bool(self.chave) and not any(c.isspace() for c in self.chave), "Chave de serviço ausente ou inválida.")
        self.http = urllib.request.build_opener(urllib.request.ProxyHandler({}), SemRedirecionamento())

    def chamar(self, metodo, uid, atributos=None):
        exigir(metodo in {"GET", "PUT"}, "Método não permitido.")
        UUID(uid)
        dados = json.dumps(atributos).encode() if atributos is not None else None
        req = urllib.request.Request(
            f"{API}/admin/users/{uid}", data=dados, method=metodo,
            headers={"apikey": self.chave, "Authorization": f"Bearer {self.chave}",
                     "Content-Type": "application/json"}
        )
        try:
            with self.http.open(req, timeout=20) as resposta:
                bruto = resposta.read(1_000_001)
            exigir(len(bruto) <= 1_000_000, "Resposta do Auth maior que o esperado.")
            valor = json.loads(bruto)
            exigir(isinstance(valor, dict), "Resposta inesperada do Auth.")
            return valor.get("user", valor)
        except urllib.error.HTTPError as erro:
            codigo = erro.code
            erro.close()
            raise Recusa(f"Auth respondeu HTTP {codigo}; corpo e cabeçalhos omitidos.") from None
        except (urllib.error.URLError, TimeoutError, OSError, ValueError):
            raise Recusa("Comunicação ou resposta do Auth não confirmada; detalhes omitidos.") from None


def validar_auth(usuario, uid, email):
    exigir(isinstance(usuario, dict), "Resposta de usuário inválida.")
    exigir(usuario.get("id") == uid and usuario.get("email", "").lower() == email,
           "Banco e Auth não apontam para a mesma conta.")
    exigir(usuario.get("role") == "authenticated" and not usuario.get("is_anonymous")
           and not usuario.get("is_super_admin"),
           "Papel de autenticação inesperado.")
    exigir(bool(usuario.get("email_confirmed_at")), "E-mail não confirmado; não será confirmado por este roteiro.")
    exigir(not usuario.get("phone") and not usuario.get("deleted_at"), "Conta com telefone ou exclusão: conferir manualmente.")
    exigir(not usuario.get("factors"), "Conta com segundo fator; este roteiro não remove fatores.")
    identidades = usuario.get("identities", [])
    exigir(bool(identidades) and all(i.get("provider") == "email" for i in identidades),
           "Conta com provedor externo ou sem identidade de e-mail; conferir manualmente.")
    banida_ate = usuario.get("banned_until")
    if banida_ate:
        try:
            vencimento = datetime.fromisoformat(banida_ate.replace("Z", "+00:00"))
            exigir(vencimento <= datetime.now(timezone.utc), "Conta suspensa; não será desbloqueada.")
        except (TypeError, ValueError):
            raise Recusa("Estado de suspensão não reconhecido.") from None


def redefinir(email, senha, ler_estado, auth):
    exigir(16 <= len(senha) <= 128 and not any(ord(c) < 32 or ord(c) == 127 for c in senha),
           "Use uma senha de 16 a 128 caracteres, sem quebras de linha ou controles.")
    antes = ler_estado()
    uid = validar_estado(antes, email)
    usuario_antes = auth.chamar("GET", uid)
    validar_auth(usuario_antes, uid, email)
    # Não alterar a conta se os vínculos mudaram durante a preparação.
    exigir(ler_estado() == antes, "O estado da conta mudou durante a conferência; refaça o inventário.")
    try:
        atualizado = auth.chamar("PUT", uid, {"password": senha})
        validar_auth(atualizado, uid, email)
        depois = ler_estado()
        exigir(depois == antes, "Os vínculos mudaram durante a operação; conferir antes de continuar.")
        for campo in ("user_metadata", "app_metadata"):
            exigir(atualizado.get(campo) == usuario_antes.get(campo), "Metadados divergentes após redefinir; conferir antes de continuar.")
    except Recusa as erro:
        raise Recusa(f"Operação não confirmada. A senha pode já ter mudado; não repetir automaticamente. {erro}") from None
    return uid


def main():
    parser = Argumentos(description=__doc__, add_help=False)
    parser._optionals.title = "opções"
    parser.add_argument("-h", "--help", action="help", help="mostra esta orientação e sai")
    parser.add_argument("--redefinir", action="store_true", help="redefine apenas a senha da conta conferida; padrão é só consulta")
    args = parser.parse_args()
    exigir(sys.stdin.isatty() and sys.stderr.isatty(), "Execute em terminal interativo; não use pipe, gravação de sessão ou senha por argumento.")
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    print("B&C — acesso às contas existentes da Loja Teste. Padrão: somente conferência.")
    print("Contas permitidas: " + ", ".join(sorted(CONTAS)))
    email = input("E-mail exato da conta de teste: ").strip()
    conta_permitida(email)
    banco, funcoes = containers()
    ler_estado = lambda: consultar(banco, email)
    estado = ler_estado()
    uid = validar_estado(estado, email)
    print(f"Conta conferida: {email} | UUID: {uid}")
    nomes = {l["id"]: l["slug"] for l in estado["lojas"]}
    for vinculo in estado["vinculos"]:
        print(f"  {nomes[vinculo['loja']]}: {vinculo['fonte']}/{vinculo['papel']} — ativo={vinculo['ativo']}")
    if not args.redefinir:
        print("Somente consulta concluída. Nenhuma senha, conta ou permissão alterada.")
        return
    auth = Auth(funcoes)
    validar_auth(auth.chamar("GET", uid), uid, email)
    print("Prepare uma senha única no cofre privado do dono/TI; o programa não a exibirá nem guardará.")
    senha = getpass.getpass("Nova senha (sem eco): ")
    repetida = getpass.getpass("Repita a nova senha (sem eco): ")
    exigir(senha == repetida, "As senhas não coincidem; nada redefinido.")
    redefinir(email, senha, ler_estado, auth)
    senha = repetida = None
    auth.chave = None
    print(f"Senha redefinida: {email}. UUID, vínculos e metadados conferidos sem alteração.")
    print("Entre em uma sessão separada, confira o papel/loja e guarde somente o resultado no relatório.")


if __name__ == "__main__":
    try:
        main()
    except (Recusa, KeyboardInterrupt, EOFError) as erro:
        mensagem = str(erro) if isinstance(erro, Recusa) else "Operação interrompida."
        print(mensagem, file=sys.stderr)
        sys.exit(1)
    except Exception:
        # Nunca imprimir traceback que possa conter a requisição ou uma credencial.
        print("Falha inesperada; detalhes omitidos. Confira o estado da conta antes de repetir.", file=sys.stderr)
        sys.exit(2)
