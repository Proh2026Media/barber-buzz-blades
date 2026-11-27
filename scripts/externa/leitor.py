"""Leitor da planilha da Externa. Datas são valores do relógio da loja."""

import argparse
import csv
import hashlib
import io
import json
import os
import re
import sys
import tempfile
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlsplit


COLUNAS = ("Service Name", "Start Date", "End Date", "Booking Page", "Name",
           "Phone Number", "Email", "Booking Date")
DDDS = set("11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 "
           "41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 "
           "71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split())
FORMATO_BR = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})(?:(?:,?\s+|T)(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,6}))?)?)?")
FORMATO_ISO = re.compile(r"\d{4}-\d{2}-\d{2}(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:[.,]\d{1,6})?)?)?")
SUFIXO_FUSO = re.compile(r"(?<=\d)\s*(?:Z|(?:UTC|GMT)\s*(?:[+-](?:[01]\d|2[0-3]):?[0-5]\d)?|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$", re.I)


def civil(valor):
    """Lê dia/mês/ano, ISO ou serial do Sheets. Nunca ajusta o relógio pelo fuso."""
    texto = SUFIXO_FUSO.sub("", valor.strip())
    br = FORMATO_BR.fullmatch(texto)
    if br:
        dia, mes, ano, hora, minuto, segundo, fracao = br.groups()
        data = datetime(int(ano), int(mes), int(dia), int(hora or 0),
                        int(minuto or 0), int(segundo or 0), int((fracao or "").ljust(6, "0")))
    elif FORMATO_ISO.fullmatch(texto):
        data = datetime.fromisoformat(texto.replace(",", "."))
    elif re.fullmatch(r"\d{5}(?:[,.]\d{1,15})?", texto):
        serial = Decimal(texto.replace(",", "."))
        micros = (serial * 86_400_000_000).to_integral_value(rounding=ROUND_HALF_UP)
        data = datetime(1899, 12, 30) + timedelta(microseconds=int(micros))
    else:
        raise ValueError("Data ou hora inválida")
    return data.isoformat()


def normalizar_texto(valor):
    return "".join(c for c in unicodedata.normalize("NFD", valor.lower())
                   if unicodedata.category(c) != "Mn").strip()


def telefone_cliente(valor, mapa):
    digitos = re.sub(r"[^0-9]", "", valor)
    if digitos in mapa["excecoes"]:
        return mapa["excecoes"][digitos]
    if digitos in mapa["correcoes"]:
        nacional = mapa["correcoes"][digitos]
    elif digitos.startswith("55") and len(digitos) in (12, 13):
        nacional = digitos[2:]
    else:
        nacional = digitos
    if nacional[:2] in DDDS and (
        (len(nacional) == 11 and nacional[2] == "9") or
        (len(nacional) == 10 and nacional[2] in "2345")
    ):
        return "+55" + nacional
    return None


def profissional(pagina):
    try:
        url = urlsplit(pagina.strip())
        if url.scheme in ("https", "http") and url.hostname in (
            "externabarbearia.com.br", "www.externabarbearia.com.br"
        ):
            slug = url.path.strip("/").lower()
            if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
                return slug
    except ValueError:
        pass
    return None


def assinatura(valores):
    texto = json.dumps(valores, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


def mesmo_nome_em_correcao(anterior, novo):
    """Permite completar um nome e corrigir sua grafia, sem trocar um titular por outro."""
    def partes(nome):
        return [p for p in normalizar_texto(nome).split() if p not in {"de", "da", "das", "do", "dos", "e"}]
    a, b = partes(anterior), partes(novo)
    if not a or not b:
        return False
    if a[0] == b[0]:
        return (len(a) == 1 or len(b) == 1 or bool(set(a[1:]) & set(b[1:]))
                or SequenceMatcher(None, a[-1], b[-1]).ratio() >= 0.8)
    grafia_proxima = min(len(a[0]), len(b[0])) >= 4 and SequenceMatcher(None, a[0], b[0]).ratio() >= 0.8
    return grafia_proxima and len(a) > 1 and a[1:] == b[1:]


def registros(texto):
    leitor = csv.reader(io.StringIO(texto.lstrip("\ufeff"), newline=""), strict=True)
    cabecalho = next(leitor, [])
    nomes = [c.strip() for c in cabecalho]
    if any(nomes.count(coluna) != 1 for coluna in COLUNAS):
        raise ValueError("As oito colunas de reservas precisam estar presentes e ter nomes únicos")
    indices = [nomes.index(coluna) for coluna in COLUNAS]
    saida = []
    for linha, valores in enumerate(leitor, 2):
        if not any(c.strip() for c in valores):
            continue
        if len(valores) > len(cabecalho):
            cabecalho.extend([""] * (len(valores) - len(cabecalho)))
        campos = [valores[i] if i < len(valores) else "" for i in indices]
        saida.append((linha, valores, campos))
    return cabecalho, saida


def ler_csv(texto, referencia):
    if referencia.get("versao") != 2:
        raise ValueError("Referência privada da migração incompatível")
    headers, origem = registros(texto)
    linhas = []
    carimbos = defaultdict(list)
    visitas = defaultdict(list)
    nomes = defaultdict(Counter)
    edicoes_de_nome = defaultdict(list)
    for linha, valores, campos in origem:
        servico, inicio, fim, pagina, nome, numero, email, criado = campos
        tel = telefone_cliente(numero, referencia["telefones"])
        titular = " ".join(nome.split())
        row = dict(linha=linha, bruto=valores, nome=titular, email=email.strip(),
                   telefone=tel, profissional=profissional(pagina), servico=servico.strip(),
                   motivo=None, legado_n=None)
        for campo, valor in (("inicio", inicio), ("fim", fim), ("criado", criado)):
            try:
                row[campo] = civil(valor)
            except (ValueError, OverflowError):
                row[campo] = None
                row["motivo"] = campo + "_invalido"
        if "teste" in normalizar_texto(titular) or normalizar_texto(servico) == "teste" or "elf.site" in pagina.lower():
            row["motivo"] = "teste"
        elif tel and tel in referencia["telefones"]["barbeiros"]:
            row["motivo"] = "profissional"
        elif not row["motivo"]:
            if not tel:
                row["motivo"] = "telefone_invalido"
            elif not row["profissional"] or not row["servico"]:
                row["motivo"] = "profissional_ou_servico_ausente"
            elif not 2 <= len(titular) <= 120:
                row["motivo"] = "nome_invalido"
            elif row["fim"] <= row["inicio"]:
                row["motivo"] = "intervalo_invalido"

        # A fonte não oferece ID. A criação da reserva é independente de telefone,
        # serviço e horário e continua identificando a linha após uma remarcação.
        base = assinatura(["reserva", row["criado"]]) if row["criado"] else assinatura(["invalida", campos])
        carimbos[base].append((assinatura(campos), row))
        linhas.append(row)

    for base, grupo in carimbos.items():
        # A via principal é a última de duas cópias idênticas, como na carga inicial.
        # A ordenação por conteúdo mantém as chaves estáveis ao reordenar a planilha.
        ordenado = sorted(grupo, key=lambda item: (item[0], -item[1]["linha"]))
        ambiguo = len({item[0] for item in ordenado}) > 1
        for ordem, (_, row) in enumerate(ordenado):
            row["chave"] = base if ordem == 0 else assinatura([base, ordem])
            if ambiguo:
                row["motivo"] = "conflito_identidade"
            elif ordem > 0 and row["motivo"] in (None, "profissional"):
                row["motivo"] = "repetido"
            if row["motivo"] in (None, "profissional") and row["inicio"] and row["criado"]:
                visitas[(row["telefone"], row["profissional"], row["inicio"])].append(row)
            legado = referencia["agendamentos"].get(row["chave"])
            if legado:
                row.update(legado)

    for grupo in visitas.values():
        # Dois pedidos para a mesma pessoa, profissional e início representam uma visita.
        vencedor = max(grupo, key=lambda row: (row["criado"], row["chave"]))
        for row in grupo:
            if row is not vencedor:
                row["motivo"] = "repetido"
        if not vencedor["motivo"]:
            nomes[vencedor["telefone"]][vencedor["nome"]] += 1
            origem_nome = referencia["nomes_origem"].get(vencedor["chave"])
            if (origem_nome and vencedor["telefone"] == vencedor.get("telefone_legado") and
                    origem_nome["nome"] != assinatura(normalizar_texto(vencedor["nome"]))):
                edicoes_de_nome[vencedor["telefone"]].append((vencedor, origem_nome))
    correcoes = {}
    for tel, edicoes in edicoes_de_nome.items():
        revisado = referencia["fichas"][tel]["nome"]
        variantes = nomes[tel]
        unanimidade = len({normalizar_texto(n) for n in variantes}) == 1
        contato_inalterado = all(orig["email"] == assinatura(r["email"].casefold()) for r, orig in edicoes)
        proposta = min(variantes, key=lambda n: (-variantes[n], n))
        if unanimidade and contato_inalterado and mesmo_nome_em_correcao(revisado, proposta):
            if normalizar_texto(revisado) != normalizar_texto(proposta):
                correcoes[tel] = proposta
        else:
            for alterada, _ in edicoes:
                if normalizar_texto(alterada["nome"]) != normalizar_texto(revisado):
                    alterada["motivo"] = "nome_ambiguo"
    for row in linhas:
        tel = row["telefone"]
        ficha = referencia["fichas"].get(tel)
        if ficha:
            row["nome_cliente"] = correcoes.get(tel, ficha["nome"])
        elif nomes.get(tel):
            row["nome_cliente"] = min(nomes[tel], key=lambda n: (-nomes[tel][n], n))
        else:
            row["nome_cliente"] = row["nome"]
    return {"headers": headers, "rows": linhas}


def preparar_referencia(diretorio):
    """Usa o snapshot aprovado para ligar a fonte aos IDs da carga de 25/11."""
    pasta = Path(diretorio)
    def carregar(arquivo):
        return json.loads((pasta / arquivo).read_text(encoding="utf-8"))

    fichas = {f["tel"]: {"nome": f["nome"], "apelido": f["apelido"]} for f in carregar("fichas.json")}
    referencia = dict(versao=2, telefones=carregar("correcoes-telefone.json"),
                      fichas=fichas, agendamentos={}, nomes_origem={})
    base = ler_csv((pasta / "planilha.csv").read_text(encoding="utf-8-sig"), referencia)
    por_linha = {r["linha"]: r for r in base["rows"]}
    agendamentos = carregar("agendamentos.json")
    for a in agendamentos:
        r = por_linha.get(a["linha"])
        if (r is None or r["motivo"] or r["telefone"] != a["tel"] or
                r["profissional"] != a["prof"] or r["servico"] != a["serv"] or
                civil(a["ini"]) != r["inicio"] or civil(a["criado"]) != r["criado"]):
            raise ValueError("A referência histórica divergiu na linha " + str(a["linha"]))
        ficha = fichas[a["tel"]]
        referencia["nomes_origem"][r["chave"]] = {
            "nome": assinatura(normalizar_texto(r["nome"])),
            "email": assinatura(r["email"].casefold()),
        }
        referencia["agendamentos"][r["chave"]] = dict(
            legado_n=a["n"], telefone_legado=a["tel"], nome_legado=ficha["nome"],
            apelido_legado=ficha["apelido"], profissional_legado=a["prof"], servico_legado=a["serv"],
            inicio_legado=a["ini"], fim_legado=a["fim"], criado_legado=a["criado"],
        )
    if len(referencia["agendamentos"]) != len(agendamentos):
        raise ValueError("Dois agendamentos do arquivo histórico têm a mesma chave")
    return referencia


def gravar_privado(arquivo, dados):
    destino = Path(arquivo)
    fd, temporario = tempfile.mkstemp(dir=destino.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, separators=(",", ":"))
        os.replace(temporario, destino)
    finally:
        Path(temporario).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="acao", required=True)
    preparar = sub.add_parser("preparar-referencia")
    preparar.add_argument("diretorio")
    preparar.add_argument("destino")
    normalizar = sub.add_parser("normalizar")
    normalizar.add_argument("--referencia", required=True)
    args = parser.parse_args()
    if args.acao == "preparar-referencia":
        gravar_privado(args.destino, preparar_referencia(args.diretorio))
    else:
        base = json.loads(Path(args.referencia).read_text(encoding="utf-8"))
        json.dump(ler_csv(sys.stdin.buffer.read().decode("utf-8-sig"), base), sys.stdout,
                  ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
