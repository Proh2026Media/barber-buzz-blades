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
CONTAINER = "barba-wa-concorrencia"


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
    raise RuntimeError("O container de concorrência já existe. Confira antes de remover ou repetir.")
try:
    env = {**os.environ,"BC_BANCO_LOCAL_NOME":CONTAINER,"BC_BANCO_LOCAL_PORTA":"54330",
           "PATH":str(Path(DOCKER).parent)+os.pathsep+os.environ.get("PATH","")}
    subprocess.run([str(ROOT / "scripts/banco-local.sh"),"subir","20261110190000"], env=env, check=True, timeout=120)
    migration = (ROOT / "supabase/migrations/20261110230000_whatsapp_saida_protegida.sql").read_text()
    fixture = (ROOT / "supabase/tests/whatsapp_saida_protegida.sql").read_text()
    fixture = fixture[:fixture.index("select pg_temp.check_wa120(public.whatsapp_sending_paused")]
    fixture = fixture.replace("create temporary table wa120", "create table public.wa120")
    sql("begin;" + migration + fixture + "update public.whatsapp_send_controls set paused=false; commit;")
    phone = "(select phone from wa120)"
    a = f"begin; select public.request_whatsapp_login({phone},repeat('a',64)); select pg_sleep(0.3); commit;"
    b = f"begin; insert into public.auth_otp_challenges(channel,destination,code_hash,purpose,expires_at) values('whatsapp',{phone},repeat('a',64),'signup',now()+interval '10 minutes'); select pg_sleep(0.3); commit;"
    results = race(a, b)
    passed(sum(r.returncode == 0 for r in results) == 1 and any("WA_RATE_LIMIT" in r.stderr for r in results),
           "Dois pedidos concorrentes, inclusive de finalidades diferentes: um desafio e nenhum segundo envio")
    purpose = sql("select purpose from public.auth_otp_challenges;").stdout.strip()
    verify = f"begin; select count(*) from public.auth_otp_check_code(null,{phone},'whatsapp','{purpose}',repeat('a',64),5); select pg_sleep(0.3); commit;"
    results = race(verify, verify)
    passed(all(r.returncode == 0 for r in results) and sorted(r.stdout.strip() for r in results) == ["0", "1"],
           "Duas verificações simultâneas: somente uma consome o código")
    sql("""
      alter table public.appointments disable trigger user;
      insert into public.appointments(id,barbershop_id,customer_id,staff_id,service_id,starts_at,ends_at,status)
      select appointment,shop,customer,staff,service,now()+interval '2 days',now()+interval '2 days 30 minutes','confirmed' from wa120;
      alter table public.appointments enable trigger user;
      select public.queue_appointment_whatsapp(appointment,'booking.confirmed') from wa120;
    """)
    claim = "begin; select id from public.claim_whatsapp_outbox(1); select pg_sleep(0.3); commit;"
    results = race(claim, claim)
    passed(all(r.returncode == 0 for r in results) and sum(bool(r.stdout.strip()) for r in results) == 1,
           "Dois workers disputam o mesmo aviso: uma única posse")
    grant = """begin;
      select public.authorize_whatsapp_send('teste-'||(select shop from wa120),p_outbox_id=>id,p_lease_token=>lease_token)
        from public.whatsapp_outbox where template_key='booking.confirmed';
      select pg_sleep(0.3); commit;"""
    results = race(grant, grant)
    passed(all(r.returncode == 0 for r in results) and sum('attempt_id' in r.stdout for r in results) == 1,
           "Mesma posse apresentada duas vezes: uma única licença de transmissão")
    sql("select public.finish_whatsapp_send(id,null) from public.whatsapp_send_attempts;")
    passed(sql("select count(*) from public.claim_whatsapp_outbox(5);").stdout.strip() == "0",
           "Resultado incerto não volta à fila após concorrência")
finally:
    subprocess.run([DOCKER,"rm","-f",CONTAINER], check=True, capture_output=True)
