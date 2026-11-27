import csv
import io
import json
import unittest
from unittest.mock import patch

import espelho


def indice(gid, nome):
    return f'items.push({{name: {json.dumps(nome)}, pageUrl: "https://docs.google.com/", gid: "{gid}",initialSheet: false}});'


class Ciclo(unittest.TestCase):
    def test_indice_incompleto_nao_substitui_espelho(self):
        for invalido in ("", indice("4", "Outra"), indice("0", "A") + indice("0", "B"),
                         indice("0", "A") + 'items.push({name: "Cadastro"});'):
            with self.subTest(invalido=invalido), self.assertRaises(espelho.Falha):
                espelho.listar_abas(invalido)

    def test_abas_e_colunas_adicionais_participam_da_assinatura(self):
        dados = {"/htmlview": indice("0","Página1") + indice("42","Outra aba"),
                 "/export?format=csv&gid=0": "cabecalho\r\nregistro",
                 "/export?format=csv&gid=42": 'dia,detalhe\r\n03/04/2026,"linha 1\nlinha 2"'}
        with patch.object(espelho,"baixar",side_effect=lambda caminho,tipo:dados[caminho]), \
             patch.object(espelho,"ler_csv",return_value={"headers":["cabecalho"],"rows":[{}]}):
            meta,_,extras = espelho.obter_retrato({})
            self.assertEqual(extras[0]["conteudo"][1],["03/04/2026","linha 1\nlinha 2"])
            dados["/export?format=csv&gid=42"] += ",novo"
            self.assertNotEqual(meta["assinatura"],espelho.obter_retrato({})[0]["assinatura"])

    def test_campos_literais_conservados_no_copy(self):
        original = {"bruto":["\\.","D'Ávila", 'um,"dois"',"linha 1\nlinha 2","=B1"]}
        carga = espelho.copiar("espelho_linhas",[original])
        inicio, restante = carga.split("\n",1)
        self.assertIn("format csv",inicio)
        self.assertTrue(restante.endswith("\\.\n"))
        valor, = next(csv.reader(io.StringIO(restante[:-3])))
        self.assertEqual(json.loads(valor),original)

    def test_reversao_inclui_o_monitor(self):
        with patch.object(espelho,"psql",return_value='{"linhas":1}') as pg:
            self.assertEqual(espelho.sincronizar({},[],[],"2026-11-26","teste",True),{"linhas":1})
            sql = pg.call_args.args[0]
            self.assertLess(sql.index("insert into externa_monitor.estado"),sql.rindex("rollback;"))
            self.assertTrue(sql.endswith("rollback;"))


if __name__ == "__main__":
    unittest.main()
