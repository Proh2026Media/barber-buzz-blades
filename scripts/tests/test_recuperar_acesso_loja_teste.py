"""Ensaios sem Docker, rede, chaveiro ou contas reais."""

import copy
import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import Mock, patch
import urllib.error


CAMINHO = Path(__file__).resolve().parents[1] / "recuperar-acesso-loja-teste.py"
SPEC = importlib.util.spec_from_file_location("recuperacao_teste", CAMINHO)
ROTINA = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ROTINA)
EMAIL = "dono@loja-teste.invalid"
UID = "11111111-1111-4111-8111-111111111111"
SENHA_FICTICIA = "Senha-ficticia-de-ensaio-123!"
CHAVE_FICTICIA = "CHAVE_FICTICIA_NAO_PUBLICAR"


def estado():
    return {
        "usuarios": [{"id": UID, "email": EMAIL}],
        "lojas": [{"id": ROTINA.LOJA_A, "slug": "loja-teste", "name": "Loja Teste", "status": "active"}],
        "vinculos": [{"fonte": "equipe", "id": "registro-ficticio", "loja": ROTINA.LOJA_A,
                      "papel": "owner", "ativo": True, "percentual": 70}],
        "referencias": [ROTINA.LOJA_A],
    }


def usuario():
    return {
        "id": UID, "email": EMAIL, "role": "authenticated", "is_anonymous": False,
        "email_confirmed_at": "2026-10-13T12:00:00Z", "phone": "",
        "identities": [{"provider": "email"}],
        "user_metadata": {"must_change_password": True}, "app_metadata": {"provider": "email"},
    }


class RecuperacaoTeste(unittest.TestCase):
    def test_argumento_invalido_nao_reproduz_senha(self):
        parser = ROTINA.Argumentos()
        with self.assertRaises(ROTINA.Recusa) as erro:
            parser.parse_args([SENHA_FICTICIA])
        self.assertNotIn(SENHA_FICTICIA, str(erro.exception))

    def test_aceita_conta_existente_com_vinculo_de_teste(self):
        self.assertEqual(ROTINA.validar_estado(estado(), EMAIL), UID)

    def test_recusa_conta_real_novo_localpart_e_injecao(self):
        for email in ["dono@example.com", "novo@loja-teste.invalid", "ana-123@loja-teste.invalid",
                      "Dono@loja-teste.invalid", "' OR true --@loja-teste.invalid"]:
            with self.subTest(email=email), self.assertRaises(ROTINA.Recusa):
                ROTINA.conta_permitida(email)

    def test_recusa_ausente_duplicada_e_uuid_invalido(self):
        for usuarios in [[], [usuario(), usuario()], [{"id": "invalido", "email": EMAIL}]]:
            dado = estado()
            dado["usuarios"] = usuarios
            with self.subTest(usuarios=usuarios), self.assertRaises(ROTINA.Recusa):
                ROTINA.validar_estado(dado, EMAIL)

    def test_recusa_loja_renomeada_suspensa_ou_uuid_trocado(self):
        for campo, valor in [("id", UID), ("slug", "loja-real"), ("name", "Loja Real"), ("status", "suspended")]:
            dado = estado()
            dado["lojas"][0][campo] = valor
            with self.subTest(campo=campo), self.assertRaises(ROTINA.Recusa):
                ROTINA.validar_estado(dado, EMAIL)

    def test_recusa_admin_gerente_papel_desconhecido_e_vinculo_global(self):
        for papel, loja in [("platform_admin", ROTINA.LOJA_A), ("account_manager", ROTINA.LOJA_A),
                            ("novo_papel", ROTINA.LOJA_A), ("customer", None), ("owner", UID)]:
            dado = estado()
            dado["vinculos"][0].update(papel=papel, loja=loja)
            with self.subTest(papel=papel, loja=loja), self.assertRaises(ROTINA.Recusa):
                ROTINA.validar_estado(dado, EMAIL)

    def test_recusa_atividade_em_loja_real(self):
        dado = estado()
        dado["referencias"].append(UID)
        with self.assertRaises(ROTINA.Recusa):
            ROTINA.validar_estado(dado, EMAIL)

    def test_recusa_conta_sem_vinculos_ou_so_inativa(self):
        for vinculos in [[], [dict(estado()["vinculos"][0], ativo=False)]]:
            dado = estado()
            dado["vinculos"] = vinculos
            with self.subTest(vinculos=vinculos), self.assertRaises(ROTINA.Recusa):
                ROTINA.validar_estado(dado, EMAIL)

    def test_auth_recusa_desvio_de_identidade_privilegio_ou_confirmacao(self):
        for campo, valor in [("id", ROTINA.LOJA_A), ("email", "real@example.com"),
                             ("role", "service_role"), ("is_anonymous", True),
                             ("is_super_admin", True), ("email_confirmed_at", None)]:
            dado = usuario()
            dado[campo] = valor
            with self.subTest(campo=campo), self.assertRaises(ROTINA.Recusa):
                ROTINA.validar_auth(dado, UID, EMAIL)

    def test_auth_recusa_oauth_mfa_telefone_exclusao_e_suspensao(self):
        for campo, valor in [("phone", "+551100000000"), ("deleted_at", "2026-01-01"),
                             ("factors", [{"factor_type": "totp"}]),
                             ("identities", [{"provider": "google"}]), ("identities", []),
                             ("banned_until", "2999-01-01T00:00:00Z")]:
            dado = usuario()
            dado[campo] = valor
            with self.subTest(campo=campo), self.assertRaises(ROTINA.Recusa):
                ROTINA.validar_auth(dado, UID, EMAIL)

    def test_redefine_so_password_preserva_uuid_e_marca_de_convite(self):
        auth = Mock()
        auth.chamar.side_effect = [usuario(), usuario()]
        consulta = Mock(side_effect=lambda: copy.deepcopy(estado()))
        self.assertEqual(ROTINA.redefinir(EMAIL, SENHA_FICTICIA, consulta, auth), UID)
        self.assertEqual(auth.chamar.call_args_list[0].args, ("GET", UID))
        self.assertEqual(auth.chamar.call_args_list[1].args, ("PUT", UID, {"password": SENHA_FICTICIA}))
        self.assertEqual(consulta.call_count, 3)

    def test_recusa_senha_fraca_ou_controle_sem_consulta(self):
        for senha in ["curta", "a" * 129, "a" * 18 + "\n", "a" * 18 + "\x00"]:
            consulta, auth = Mock(), Mock()
            with self.subTest(senha=repr(senha)), self.assertRaises(ROTINA.Recusa):
                ROTINA.redefinir(EMAIL, senha, consulta, auth)
            consulta.assert_not_called()
            auth.chamar.assert_not_called()

    def test_alteracao_concorrente_impede_put(self):
        depois = estado()
        depois["vinculos"][0]["percentual"] = 50
        auth = Mock()
        auth.chamar.return_value = usuario()
        with self.assertRaisesRegex(ROTINA.Recusa, "mudou durante"):
            ROTINA.redefinir(EMAIL, SENHA_FICTICIA, Mock(side_effect=[estado(), depois]), auth)
        self.assertEqual(auth.chamar.call_count, 1)

    def test_alteracao_apos_put_avisa_estado_nao_confirmado_sem_repetir(self):
        depois = estado()
        depois["vinculos"][0]["percentual"] = 50
        auth = Mock()
        auth.chamar.side_effect = [usuario(), usuario()]
        with self.assertRaisesRegex(ROTINA.Recusa, "senha pode já ter mudado"):
            ROTINA.redefinir(EMAIL, SENHA_FICTICIA, Mock(side_effect=[estado(), estado(), depois]), auth)
        self.assertEqual(auth.chamar.call_count, 2)

    def test_metadado_divergente_nao_e_aceito_como_sucesso(self):
        depois = usuario()
        depois["user_metadata"]["must_change_password"] = False
        auth = Mock()
        auth.chamar.side_effect = [usuario(), depois]
        with self.assertRaisesRegex(ROTINA.Recusa, "Metadados divergentes"):
            ROTINA.redefinir(EMAIL, SENHA_FICTICIA, Mock(side_effect=lambda: estado()), auth)

    def test_http_erro_nao_expoe_corpo_cabecalho_chave_ou_senha(self):
        with patch.object(ROTINA, "comando", return_value=CHAVE_FICTICIA):
            auth = ROTINA.Auth("funcoes-ficticias")
        erro = urllib.error.HTTPError("https://exemplo.invalid", 422, SENHA_FICTICIA,
                                     {"Authorization": CHAVE_FICTICIA}, io.BytesIO(SENHA_FICTICIA.encode()))
        auth.http = Mock()
        auth.http.open.side_effect = erro
        with self.assertRaises(ROTINA.Recusa) as capturada:
            auth.chamar("PUT", UID, {"password": SENHA_FICTICIA})
        mensagem = str(capturada.exception)
        self.assertIn("HTTP 422", mensagem)
        self.assertNotIn(SENHA_FICTICIA, mensagem)
        self.assertNotIn(CHAVE_FICTICIA, mensagem)
        req = auth.http.open.call_args.args[0]
        self.assertEqual(req.full_url, f"{ROTINA.API}/admin/users/{UID}")
        self.assertEqual(json.loads(req.data), {"password": SENHA_FICTICIA})

    def test_sem_segredo_no_comando_que_le_chave(self):
        with patch.object(ROTINA, "comando", return_value=CHAVE_FICTICIA) as mock:
            ROTINA.Auth("funcoes-ficticias")
        self.assertEqual(mock.call_args.args[0],
                         ["docker", "exec", "funcoes-ficticias", "printenv", "SUPABASE_SERVICE_ROLE_KEY"])
        self.assertNotIn(CHAVE_FICTICIA, str(mock.call_args))

    def test_nao_segue_redirecionamento(self):
        self.assertIsNone(ROTINA.SemRedirecionamento().redirect_request(
            None, None, 302, "", {}, "https://outro.invalid"))

    def test_consulta_sql_somente_leitura_e_entrada_fechada(self):
        with patch.object(ROTINA, "comando", return_value=json.dumps(estado())) as mock:
            self.assertEqual(ROTINA.consultar("banco-ficticio", EMAIL), estado())
        argv, sql = mock.call_args.args
        self.assertIn("read only", sql)
        self.assertTrue(sql.strip().endswith("rollback;"))
        self.assertNotIn("update ", sql.lower())
        self.assertNotIn("delete ", sql.lower())
        self.assertNotIn("insert ", sql.lower())
        self.assertNotIn(EMAIL, argv)
        with patch.object(ROTINA, "comando") as mock, self.assertRaises(ROTINA.Recusa):
            ROTINA.consultar("banco-ficticio", "real@example.com")
        mock.assert_not_called()

    def test_ambiguidade_de_container_nao_escolhe_primeiro(self):
        nomes = f"supabase-db-{ROTINA.STACK}\nsupabase-db-copia-{ROTINA.STACK}\nsupabase-functions-{ROTINA.STACK}"
        with patch.object(ROTINA, "comando", return_value=nomes), self.assertRaises(ROTINA.Recusa):
            ROTINA.containers()

    def test_padrao_e_so_consulta_sem_chave_nem_senha(self):
        saida = io.StringIO()
        with patch.object(ROTINA.sys, "argv", [str(CAMINHO)]), \
             patch.object(ROTINA.sys.stdin, "isatty", return_value=True), \
             patch.object(ROTINA.sys.stderr, "isatty", return_value=True), \
             patch.object(ROTINA.resource, "setrlimit"), \
             patch("builtins.input", return_value=EMAIL), \
             patch.object(ROTINA, "containers", return_value=("db-ficticio", "fn-ficticia")), \
             patch.object(ROTINA, "consultar", return_value=estado()), \
             patch.object(ROTINA, "Auth") as auth, \
             patch.object(ROTINA.getpass, "getpass") as senha, \
             patch.object(ROTINA.sys, "stdout", saida):
            ROTINA.main()
        auth.assert_not_called()
        senha.assert_not_called()
        self.assertIn("Somente consulta concluída", saida.getvalue())


if __name__ == "__main__":
    unittest.main()
