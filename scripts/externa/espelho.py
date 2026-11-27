"""Leitor unidirecional da Externa. O banco recebe o retrato inteiro em uma transação."""
import argparse
import csv
import hashlib
import io
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from leitor import ler_csv

PLANILHA = "1fqb5vW5Y1vJ7-OCbK6vs8LN2SolXsjjbU5bRt3ESqUc"
LOJA = "a5c2b03b-1e30-4446-b013-8cb8a9d8c447"
BASE = "https://docs.google.com/spreadsheets/d/" + PLANILHA
PASTA = Path(__file__).resolve().parent
BD = "supabase-db-z2dbb7dkyzhc8vjiywq34mhn"
LIMITE = 32 * 1024 * 1024
ABA = re.compile(r'items\.push\(\{name:\s*("(?:\\.|[^"\\])*"),\s*pageUrl:\s*"(?:\\.|[^"\\])*",\s*gid:\s*"(\d+)"')


class Falha(Exception):
    """Mensagem com código de operação, apropriada para o diário do serviço."""


class DestinosGoogle(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        url = urlsplit(newurl)
        if url.scheme != "https" or not (
            url.hostname == "docs.google.com" or (url.hostname or "").endswith(".googleusercontent.com")
        ):
            raise Falha("acesso_google")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def baixar(caminho, tipo):
    req = Request(BASE + caminho, headers={"Cache-Control": "no-cache", "User-Agent": "Aurset-Leitor/1"})
    with build_opener(DestinosGoogle()).open(req, timeout=25) as resposta:
        if resposta.headers.get_content_type() != tipo:
            raise Falha("formato_google")
        corpo = resposta.read(LIMITE + 1)
        if len(corpo) > LIMITE:
            raise Falha("tamanho_google")
        declarado = resposta.headers.get("Content-Length")
        if declarado is not None and len(corpo) != int(declarado):
            raise Falha("leitura_incompleta")
        return corpo.decode("utf-8-sig")


def listar_abas(indice):
    abas = [(gid, json.loads(nome)) for nome, gid in ABA.findall(indice)]
    if (len(abas) != indice.count("items.push({name:") or
            len({gid for gid, _ in abas}) != len(abas) or
            not any(gid == "0" for gid, _ in abas)):
        raise Falha("indice_de_abas")
    return abas


def obter_retrato(referencia):
    abas = listar_abas(baixar("/htmlview", "text/html"))
    assinatura = hashlib.sha256()
    extras = []
    principal = None
    for gid, nome in abas:
        conteudo = baixar("/export?format=csv&gid=" + gid, "text/csv")
        for parte in (gid, nome, conteudo):
            assinatura.update(hashlib.sha256(parte.encode()).digest())
        if gid == "0":
            principal = ler_csv(conteudo, referencia)
        else:
            extras.append({"gid": gid, "nome": nome, "conteudo": list(csv.reader(io.StringIO(conteudo, newline="")))})
    if not principal or not principal["rows"]:
        raise Falha("fonte_vazia")
    meta = {"planilha": PLANILHA, "gid": 0, "headers": principal["headers"],
            "total_linhas": len(principal["rows"]), "assinatura": assinatura.hexdigest()}
    return meta, principal["rows"], extras


def psql(sql, container):
    proc = subprocess.run(["docker","exec","-i",container,"psql","-XqAt","-U","postgres","-d","postgres",
                           "-v","ON_ERROR_STOP=1","-v","VERBOSITY=sqlstate"],
                          input=sql, capture_output=True, text=True, timeout=185)
    if proc.returncode:
        # A saída estendida do PostgreSQL pode conter uma linha inteira da planilha.
        erro = re.search(r"(?:ERROR|FATAL):\s+([0-9A-Z]{5})\b",proc.stderr)
        raise Falha("banco_" + (erro.group(1) if erro else "indisponivel"))
    return proc.stdout.strip()


def copiar(tabela, linhas):
    buffer = io.StringIO()
    buffer.write("copy pg_temp." + tabela + "(registro) from stdin with (format csv);\n")
    gravador = csv.writer(buffer, lineterminator="\n")
    for linha in linhas:
        gravador.writerow([json.dumps(linha, ensure_ascii=False, separators=(",", ":"))])
    buffer.write("\\.\n")
    return buffer.getvalue()


def sincronizar(meta, linhas, extras, inicio, container, ensaio):
    sql = ["begin isolation level repeatable read;", "set local statement_timeout='120s'; set local lock_timeout='8s';",
           "select pg_advisory_xact_lock(hashtextextended('espelho-externa-elfsight',0));",
           "create temp table espelho_meta(registro jsonb) on commit drop;",
           "create temp table espelho_linhas(registro jsonb) on commit drop;",
           "create temp table espelho_abas(registro jsonb) on commit drop;",
           copiar("espelho_meta",[meta]),copiar("espelho_linhas",linhas),copiar("espelho_abas",extras),
           # Impede que uma leitura antiga ultrapasse outra já seguida de commit.
           f"""do $$begin if exists(select from externa_monitor.estado where loja='{LOJA}'
                 and tentativa>'{inicio}') then raise exception using errcode='40001'; end if; end$$;""",
           (PASTA/"sincronizar.sql").read_text(),
           """update externa_monitor.abas_complementares a set presente=false
               where a.presente and not exists(select from espelho_abas e where e.registro->>'gid'=a.gid);
              insert into externa_monitor.abas_complementares(gid,nome,conteudo)
              select registro->>'gid',registro->>'nome',registro->'conteudo' from espelho_abas
              on conflict(gid) do update set nome=excluded.nome,conteudo=excluded.conteudo,presente=true
              where (abas_complementares.nome,abas_complementares.conteudo,abas_complementares.presente)
                is distinct from (excluded.nome,excluded.conteudo,true);""",
           f"""insert into externa_monitor.estado as atual(loja,tentativa,sucesso,mudanca,assinatura,totais)
             select '{LOJA}','{inicio}',clock_timestamp(),clock_timestamp(),registro->>'assinatura',resumo
             from pg_temp.espelho_meta cross join pg_temp.espelho_resultado
             on conflict(loja) do update set tentativa=excluded.tentativa,sucesso=excluded.sucesso,
               erro=null,totais=excluded.totais,assinatura=excluded.assinatura,
               mudanca=case when atual.assinatura is distinct from excluded.assinatura
                        then excluded.mudanca else atual.mudanca end;""",
           "rollback;" if ensaio else "commit;"]
    resultado = psql("\n".join(sql),container)
    return json.loads(resultado.splitlines()[-1])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ensaio",action="store_true")
    parser.add_argument("--referencia",type=Path,default=PASTA/"referencia.json")
    parser.add_argument("--container",default=BD)
    args = parser.parse_args()
    inicio = datetime.now(timezone.utc).isoformat()
    codigo = "leitura"
    try:
        if args.referencia.stat().st_mode & 0o077:
            raise Falha("permissao_referencia")
        referencia = json.loads(args.referencia.read_text())
        meta,linhas,extras = obter_retrato(referencia)
        codigo = "aplicacao"
        resumo = sincronizar(meta,linhas,extras,inicio,args.container,args.ensaio)
        print(json.dumps(resumo,ensure_ascii=False))
        return 0
    except Exception as exc:
        if isinstance(exc,Falha):
            codigo=str(exc)
        if not args.ensaio:
            # Código fechado e datas geradas pelo processo. Nunca escreve dados da origem no erro.
            try:
                psql(f"""insert into externa_monitor.estado as atual(loja,tentativa,erro)
                   values('{LOJA}','{inicio}','{codigo}') on conflict(loja) do update
                   set tentativa=excluded.tentativa,erro=excluded.erro
                   where atual.tentativa<=excluded.tentativa;""",args.container)
            except Exception:
                pass
        print("Leitura da Externa interrompida:",codigo,file=sys.stderr)
        return 1


if __name__ == "__main__":
    os.umask(0o077)
    sys.exit(main())
