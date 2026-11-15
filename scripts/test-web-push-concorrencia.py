#!/usr/bin/env python3
"""Somente PostgreSQL descartável 'barba-push-local', senha fictícia localtest.
Requer base local e migrations Web Push já instaladas. Não usa ambiente/VPS.
Cria usuários fictícios, disputa com duas conexões e remove somente sua fixture.
"""
import concurrent.futures
import subprocess
import uuid

CONTAINER = "barba-push-local"

def sql(statement):
    result = subprocess.run(
        ["docker", "exec", "-i", "-e", "PGPASSWORD=localtest", CONTAINER,
         "psql", "-h", "localhost", "-U", "supabase_admin", "-d", "postgres",
         "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
        input=statement, text=True, capture_output=True, timeout=15,
    )
    if result.returncode:
        raise RuntimeError(result.stderr[-1500:])
    return [line for line in result.stdout.splitlines() if line.strip()]

def race(statement):
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(sql, statement)
        b = pool.submit(sql, statement)
        return a.result(), b.result()

owner, session = str(uuid.uuid4()), str(uuid.uuid4())
original = sql("select enabled from public.web_push_settings;")
if original != ["f"]:
    raise RuntimeError("Bancada deve estar desligada e ociosa antes do ensaio.")
if sql("select count(*) from public.web_push_queue;") != ["0"]:
    raise RuntimeError("Bancada contém fila; não alterar dados preexistentes.")
try:
    sql(f"""begin;
      insert into auth.users(id,email,raw_user_meta_data) values('{owner}','{owner}@example.invalid','{{}}');
      insert into auth.sessions(id,user_id) values('{session}','{owner}');
      update public.web_push_settings set enabled=true;
      select public.web_push_register('{owner}','{session}','https://fcm.googleapis.com/fcm/send/{owner}',repeat('B',87),repeat('a',22),'https://app.example.invalid','pt-BR');
      insert into public.web_push_queue(subscription_id,kind,target)
        select id,'test','/app' from public.web_push_subscriptions cross join generate_series(1,8) where user_id='{owner}';
      commit;
    """)
    a, b = race("begin; select id from public.web_push_claim(); select pg_sleep(0.3); commit;")
    assert len(a) == len(b) == 4 and set(a).isdisjoint(b), (a, b)
    print("PASS: duas conexões reservam quatro tarefas distintas sem bloqueio ou duplicação", flush=True)
    selected = a[0]
    a, b = race(f"""begin; select public.web_push_authorize(id,lease) is not null
      from public.web_push_queue where id='{selected}'; select pg_sleep(0.3); commit;""")
    assert sorted(a+b) == ["f", "t"], (a, b)
    print("PASS: duas autorizações concorrentes consomem a licença uma única vez", flush=True)
    sql("update public.web_push_queue set claimed_at=now()-interval '6 minutes' where state='processing';")
    assert sql("select id from public.web_push_claim();") == []
    assert sql("select count(*) from public.web_push_queue where state='unknown';") == ["8"]
    print("PASS: corte de worker deixa oito tarefas incertas e nenhuma retransmissão", flush=True)
finally:
    sql(f"begin; delete from auth.users where id='{owner}'; update public.web_push_settings set enabled=false; commit;")
