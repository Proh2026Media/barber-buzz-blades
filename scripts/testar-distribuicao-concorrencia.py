#!/usr/bin/env python3
"""Concorrência real em PostgreSQL descartável; não utiliza segredos nem rede de produção."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import subprocess
import threading
import uuid

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--container", default="barba-push-local")
args = parser.parse_args()
if not args.container.endswith("-local"):
    raise SystemExit("Use somente um container descartável com nome terminado em -local.")


def sql(statement, check=True):
    result = subprocess.run(
        ["docker", "exec", "-i", args.container, "psql", "-X", "-q", "-A", "-t",
         "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
        input=statement, text=True, capture_output=True,
    )
    if check and result.returncode:
        raise RuntimeError(result.stderr)
    return result


shop, other, third, number, backup = [str(uuid.uuid4()) for _ in range(5)]
admin = "11111111-1111-4111-8111-111111111111"
auth = f"select set_config('request.jwt.claim.sub','{admin}',true);"
ids = ",".join(f"'{item}'::uuid" for item in [shop, other, third])
numbers = ",".join(f"'{item}'::uuid" for item in [number, backup])


def mutate(target, primary, reserve, barrier):
    barrier.wait()
    return sql(
        f"begin; {auth} "
        f"select public.platform_set_whatsapp_route('{target}',null,0,'{primary}','{reserve}',"
        "'primary',false,false,false); select pg_sleep(0.3); commit;", check=False,
    )


try:
    sql(f"""
      begin; {auth}
      insert into public.barbershops(id,name,slug) values
        ('{shop}','Teste concorrência','wd-race-{shop}'),
        ('{other}','Teste concorrência 2','wd-race-{other}'),
        ('{third}','Teste concorrência 3','wd-race-{third}');
      select public.platform_create_whatsapp_channel('{number}','Teste concorrência');
      select public.platform_create_whatsapp_channel('{backup}','Teste concorrência reserva');
      update public.whatsapp_channels set display_phone=case when id='{number}' then '+5511988870001'
        else '+5511988870002' end where id in ({numbers}); commit;
    """)
    with ThreadPoolExecutor(max_workers=2) as pool:
        barrier = threading.Barrier(2)
        futures = [pool.submit(mutate, shop, number, backup, barrier),
                   pool.submit(mutate, shop, backup, number, barrier)]
        results = [f.result() for f in futures]
    assert sum(r.returncode == 0 for r in results) == 1, [r.stderr for r in results]
    assert sum("WA_STALE" in r.stderr for r in results) == 1, [r.stderr for r in results]
    assert sql(f"select count(*)=1 and min(version)=1 from public.whatsapp_number_links where barbershop_id='{shop}' and removed_at is null;").stdout.strip() == "t"
    print("PASS: duas edições do mesmo destino produzem um vencedor e uma versão antiga recusada")

    with ThreadPoolExecutor(max_workers=2) as pool:
        barrier = threading.Barrier(2)
        futures = [pool.submit(mutate, other, number, backup, barrier),
                   pool.submit(mutate, third, backup, number, barrier)]
        results = [f.result() for f in futures]
    assert all(r.returncode == 0 for r in results), [r.stderr for r in results]
    assert sql(f"select count(*)=3 from public.whatsapp_number_links where barbershop_id in ({ids}) and removed_at is null;").stdout.strip() == "t"
    print("PASS: destinos distintos compartilham os mesmos números em papéis invertidos")

    # Uma mensagem já assumida por worker impede alterar sua rota; não pode haver inversão de travas.
    sql(f"""
      begin; {auth}
      update public.whatsapp_send_controls set paused=false where scope='global';
      select public.platform_set_whatsapp_route(b.barbershop_id,null,b.version,b.channel_id,b.backup_channel_id,
        'primary',true,false,false) from public.whatsapp_number_links b where barbershop_id='{shop}' and removed_at is null;
      select public.enqueue_whatsapp_message('{shop}','+5511999999999','customer.notice','Teste fictício','wd-race-message-{shop}');
      update public.whatsapp_outbox set status='sending',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
        where dedupe_key='wd-race-message-{shop}'; commit;
    """)
    prepare = f"""begin; {auth}
      select public.prepare_whatsapp_delivery(id) from public.whatsapp_outbox where dedupe_key='wd-race-message-{shop}';
      select pg_sleep(0.3); commit;"""
    configure = f"""begin; {auth}
      select public.platform_set_whatsapp_route(barbershop_id,null,version,channel_id,backup_channel_id,'paused',false,false,false)
        from public.whatsapp_number_links where barbershop_id='{shop}' and removed_at is null; commit;"""
    barrier = threading.Barrier(2)

    def race_statement(statement):
        barrier.wait()
        return sql(statement, check=False)

    with ThreadPoolExecutor(max_workers=2) as pool:
        pending_prepare = pool.submit(race_statement, prepare)
        pending_configure = pool.submit(race_statement, configure)
        p, c = pending_prepare.result(), pending_configure.result()
    assert p.returncode == 0 and 'instance_name' in p.stdout, p.stderr + p.stdout
    assert c.returncode != 0 and 'WA_DELIVERY_BUSY' in c.stderr, c.stderr
    assert 'deadlock' not in p.stderr + c.stderr
    print("PASS: preparação e configuração simultâneas não entram em deadlock nem mudam rota em envio")
finally:
    # Remove somente os UUIDs fictícios criados pelo próprio ensaio.
    sql(f"""
      begin; {auth}
      delete from public.whatsapp_outbox where dedupe_key='wd-race-message-{shop}';
      delete from public.whatsapp_number_link_history where channel_id in ({numbers});
      delete from public.whatsapp_number_links where barbershop_id in ({ids});
      delete from public.whatsapp_channels where id in ({numbers});
      delete from public.barbershops where id in ({ids}); commit;
    """)
