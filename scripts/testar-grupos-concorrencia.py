#!/usr/bin/env python3
"""Ensaios com duas conexões reais. Só usa um container local exclusivo.

Cria seu próprio container descartável, instala as migrations e apaga apenas esse container.
Não acessa Evolution, VPS, contatos ou credenciais reais.
"""
import concurrent.futures
from pathlib import Path
import os
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DOCKER = shutil.which("docker") or "/Applications/Docker.app/Contents/Resources/bin/docker"
DATABASE = "postgres"
CONTAINER = "barba-grupos-concorrencia"


def sql(statement, database=DATABASE, check=True, user="postgres"):
    result = subprocess.run(
        [DOCKER, "exec", "-i", "-e", "PGPASSWORD=localtest", CONTAINER, "psql",
         "-h", "localhost", "-U", user, "-d", database, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
        input=statement, text=True, capture_output=True, timeout=45,
    )
    if check and result.returncode:
        raise RuntimeError(result.stderr[-1500:])
    return result


def race(statement_a, statement_b):
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(sql, statement, check=False) for statement in (statement_a, statement_b)]
        return [future.result() for future in futures]


def passed(condition, text):
    if not condition:
        raise AssertionError(text)
    print("PASS:", text, flush=True)


if subprocess.run([DOCKER,"inspect",CONTAINER],capture_output=True).returncode == 0:
    raise RuntimeError("O container exclusivo já existe; não será removido por esta execução.")
try:
    env = {**os.environ,"BC_BANCO_LOCAL_NOME":CONTAINER,"BC_BANCO_LOCAL_PORTA":"54331",
           "PATH":str(Path(DOCKER).parent)+os.pathsep+os.environ.get("PATH","")}
    subprocess.run([str(ROOT / "scripts/banco-local.sh"),"subir","20261110190000"], env=env, check=True, timeout=120)
    migrations = "".join((ROOT / "supabase/migrations" / name).read_text() for name in [
        "20261110230000_whatsapp_saida_protegida.sql", "20261111120000_grupos_atendimento.sql"])
    fixture = (ROOT / "supabase/tests/grupos_atendimento.sql").read_text().split("-- Aceitação de grupos")[0]
    fixture = fixture.replace("create temporary table wa120", "create table public.wa120")
    sql("begin;" + migrations + fixture + """
      update public.whatsapp_send_controls set paused=false;
      update public.whatsapp_group_settings set enrollment_enabled=true;
      update public.whatsapp_channels set display_phone='+5511888888888';
      insert into public.whatsapp_group_accounts(barbershop_id,channel_id)
        select c.shop,n.id from wa120 c join public.whatsapp_channels n on n.barbershop_id=c.shop;
      commit;
    """)
    request = """begin;
      select set_config('request.jwt.claim.sub',(select customer::text from wa120),true);
      select public.care_group_request(shop,true,array(select id from public.whatsapp_group_accounts))->'group'->>'id' from wa120;
      select pg_sleep(0.3);commit;"""
    results=race(request,request)
    passed(all(r.returncode==0 for r in results) and results[0].stdout==results[1].stdout,
        "Adesões concorrentes retornam o mesmo grupo")
    passed(sql("select count(*) from public.whatsapp_care_operations;").stdout.strip()=="1",
        "Adesões concorrentes criam somente uma operação")
    claim="""begin;select public.claim_care_group_operation(id,true) from public.whatsapp_care_operations;
      select pg_sleep(0.3);commit;"""
    results=race(claim,claim)
    passed(all(r.returncode==0 for r in results) and sum('token' in r.stdout for r in results)==1,
        "Dois workers recebem uma única licença, sem chamar provedor")
    sql("""update public.whatsapp_customer_contact_preferences set monthly_marketing=1;
      insert into public.customer_privacy(user_id,marketing) select customer,true from wa120
      on conflict(user_id) do update set marketing=true;""")
    a="begin;select public.reserve_client_communication(shop,customer,'marketing','oferta-a') from wa120;select pg_sleep(0.3);commit;"
    b="begin;select public.reserve_client_communication(other_shop,customer,'marketing','oferta-b') from wa120;select pg_sleep(0.3);commit;"
    results=race(a,b)
    passed(all(r.returncode==0 for r in results) and sorted(r.stdout.strip() for r in results)==['f','t'],
        "Duas lojas disputam a última cota mensal: somente uma reserva")
finally:
    subprocess.run([DOCKER,"rm","-f",CONTAINER], check=True, capture_output=True)
