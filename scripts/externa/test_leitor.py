import csv
import io
import os
import unittest
from unittest.mock import patch

from leitor import COLUNAS, assinatura, civil, ler_csv, telefone_cliente


MAPA = {"correcoes": {}, "excecoes": {}, "barbeiros": []}
REF = {"versao": 2, "telefones": MAPA, "fichas": {}, "agendamentos": {}, "nomes_origem": {}}
RESERVA = ["Corte", "04/05/2026 23:45", "05/05/2026 00:15",
           "https://externabarbearia.com.br/tiago/", "Cliente de Ensaio",
           "(11) 90000-0001", "exemplo@example.invalid", "2026-05-03T01:15:42.100Z"]


def csv_de(linhas, header=COLUNAS):
    saida = io.StringIO(newline="")
    gravar = csv.writer(saida)
    gravar.writerow(header)
    gravar.writerows(linhas)
    return saida.getvalue()


class TesteLeitor(unittest.TestCase):
    def test_data_do_brasil_meia_noite_e_fuso(self):
        with patch.dict(os.environ, TZ="Pacific/Honolulu"):
            valores = ["05/04/2026 00:15", "2026-04-05T00:15:00Z",
                       "2026-04-05T00:15:00+14:00", "2026-04-05T00:15:00-11:00"]
            for valor in valores:
                self.assertEqual(civil(valor), "2026-04-05T00:15:00")
        self.assertEqual(civil("31/12/2026 23:59:59,8"), "2026-12-31T23:59:59.800000")
        self.assertEqual(civil("46023,5"), "2026-01-01T12:00:00")

    def test_data_impossivel_ou_em_formato_americano(self):
        for valor in ("02/29/2026", "12/31/2026 09:00", "31/11/2026", "08/09/2026 24:15", ""):
            with self.assertRaises(ValueError):
                civil(valor)

    def test_celulas_extras_e_intervalo_virando_o_dia(self):
        linhas = [RESERVA + ['Texto,\ncom quebra', 'Outra coluna']]
        dados = ler_csv("\ufeff" + csv_de(linhas, [*COLUNAS, "Campo"]), REF)
        self.assertEqual(dados["headers"][-2:], ["Campo", ""])
        row = dados["rows"][0]
        self.assertEqual(row["bruto"], linhas[0])
        self.assertIsNone(row["motivo"])
        self.assertEqual((row["inicio"], row["fim"]), ("2026-05-04T23:45:00", "2026-05-05T00:15:00"))

    def test_remarcacao_e_mudanca_de_nome_preservam_a_chave(self):
        antigo = ler_csv(csv_de([RESERVA]), REF)["rows"][0]
        nova = list(RESERVA)
        nova[1:3] = ["07/05/2026 10:00", "07/05/2026 10:30"]
        nova[4] = "Novo Nome"
        nova[7] = "03/05/2026 01:15:42,100"
        atual = ler_csv(csv_de([nova]), REF)["rows"][0]
        self.assertEqual(atual["chave"], antigo["chave"])
        self.assertEqual(atual["nome_cliente"], "Novo Nome")

    def test_clones_e_reordenacao(self):
        nova = list(RESERVA)
        nova[7] = "03/05/2026 12:34"
        original = ler_csv(csv_de([RESERVA, nova, RESERVA]), REF)["rows"]
        reordenado = ler_csv(csv_de([RESERVA, RESERVA, nova]), REF)["rows"]
        for linhas in (original, reordenado):
            self.assertEqual(len({r["chave"] for r in linhas}), 3)
            self.assertEqual([r["criado"] for r in linhas if not r["motivo"]], ["2026-05-03T12:34:00"])
        self.assertEqual({r["chave"]: r["motivo"] for r in original},
                         {r["chave"]: r["motivo"] for r in reordenado})

    def test_mesmo_carimbo_dados_distintos_preservados_para_conferencia(self):
        outra = list(RESERVA)
        outra[5] = "(11) 90000-0002"
        saida = ler_csv(csv_de([RESERVA, outra]), REF)["rows"]
        self.assertEqual({r["motivo"] for r in saida}, {"conflito_identidade"})
        self.assertEqual(len({r["chave"] for r in saida}), 2)

    def test_erros_de_conteudo_preservam_linha_e_erro_de_cabecalho_interrompe(self):
        ruim = list(RESERVA)
        ruim[5] = "sem telefone"
        row = ler_csv(csv_de([ruim]), REF)["rows"][0]
        self.assertEqual(row["motivo"], "telefone_invalido")
        self.assertEqual(row["bruto"], ruim)
        with self.assertRaises(ValueError):
            ler_csv(csv_de([RESERVA], COLUNAS[:-1]), REF)
        with self.assertRaises(ValueError):
            ler_csv(csv_de([RESERVA], [*COLUNAS, COLUNAS[0]]), REF)

    def test_historico_reaproveita_ficha_revisada(self):
        chave = assinatura(["reserva", civil(RESERVA[7])])
        tel = telefone_cliente(RESERVA[5], MAPA)
        referencia = {**REF, "fichas": {tel: {"nome": "Nome Revisado"}},
                      "agendamentos": {chave: {"legado_n": 8}}}
        row = ler_csv(csv_de([RESERVA]), referencia)["rows"][0]
        self.assertEqual((row["legado_n"], row["nome_cliente"], row["nome"]),
                         (8, "Nome Revisado", "Cliente de Ensaio"))

    def test_correcao_inequivoca_e_ambiguidades_do_nome_historico(self):
        original = list(RESERVA)
        original[4] = "julia da silva"
        tel = telefone_cliente(original[5], MAPA)
        chave = assinatura(["reserva", civil(original[7])])
        ref = {**REF, "fichas": {tel: {"nome": "Júlia da Silva"}},
               "agendamentos": {chave: {"legado_n": 9, "telefone_legado": tel}},
               "nomes_origem": {chave: {"nome": assinatura("julia da silva"), "email": assinatura(original[6])}}}
        def obter(nome, demais=(), email=None):
            alterada = list(original)
            alterada[4] = nome
            alterada[6] = email if email is not None else original[6]
            return ler_csv(csv_de([alterada, *demais]), ref)["rows"][0]
        self.assertEqual(obter("JULIA DA SILVA")["nome_cliente"], "Júlia da Silva")
        clara = obter("Júlia da Silva Oliveira")
        self.assertEqual((clara["motivo"], clara["nome_cliente"]), (None, "Júlia da Silva Oliveira"))
        estranho = obter("Pedro da Silva")
        self.assertEqual((estranho["motivo"], estranho["nome_cliente"]), ("nome_ambiguo", "Júlia da Silva"))
        self.assertEqual(obter("Júlia da Silva Oliveira", email="outro@example.invalid")["motivo"], "nome_ambiguo")
        segunda = list(original)
        segunda[1:3] = ["08/05/2026 10:00", "08/05/2026 10:30"]
        segunda[7] = "06/05/2026 12:00"
        discordante = obter("Júlia da Silva Oliveira", [segunda])
        self.assertEqual((discordante["motivo"], discordante["nome_cliente"]), ("nome_ambiguo", "Júlia da Silva"))


if __name__ == "__main__":
    unittest.main()
