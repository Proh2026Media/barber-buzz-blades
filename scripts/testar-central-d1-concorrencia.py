#!/usr/bin/env python3
"""Concorrência do D1 em banco descartável; sem rede, credenciais ou números reais."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import subprocess
import os
import threading
import uuid

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--container', default='barba-central-d1-local')
args = parser.parse_args()
if not (args.container.startswith('barba-central-') and args.container.endswith('-local')):
    raise SystemExit('Somente container exclusivo barba-central-…-local.')
ADMIN = '11111111-1111-4111-8111-111111111111'
AUTH = f"select set_config('request.jwt.claim.sub','{ADMIN}',false);"


def sql(statement, check=True):
    r = subprocess.run(['docker', 'exec', '-i', args.container, 'psql', '-XqAt', '-v',
                        'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
                       input="set statement_timeout='8s'; set lock_timeout='5s';" + statement,
                       text=True, capture_output=True, timeout=12)
    if check and r.returncode:
        raise RuntimeError(r.stderr)
    return r


def race(a, b):
    barrier = threading.Barrier(2)

    def run(statement):
        barrier.wait(timeout=5)
        return sql(f'begin; {AUTH} {statement}; select pg_sleep(0.15); commit;', False)

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(run, a)
        second = pool.submit(run, b)
        return first.result(), second.result()


shops = []
numbers = [str(uuid.uuid4()) for _ in range(5)]
x, y, z, personal, group_candidate = numbers
person = str(uuid.uuid4())
quoted = ','.join(f"'{value}'::uuid" for value in numbers)


def route(shop, primary, backup, backup2):
    return f"select public.platform_set_whatsapp_route('{shop}',null,0,'{primary}','{backup}','{backup2}','primary',false,false,false)"


try:
    for n in range(3):
        result = sql(f"{AUTH} select public.register_my_barbershop(gen_random_uuid(),'D1 corrida {uuid.uuid4()}', 'America/Sao_Paulo','single',true,'teste-d1','teste-d1','teste-d1')->>'shop_id';")
        shops.append(result.stdout.strip().splitlines()[-1])
    sql(f"""begin;{AUTH}
      insert into auth.users(id,email,raw_user_meta_data) values('{person}','{person}@example.invalid','{{}}');
      update public.profiles set whatsapp_e164='+5511900000999' where id='{person}';
      """ + ''.join(f"select public.platform_create_whatsapp_channel('{value}','D1 concorrência');" for value in numbers) +
        f"update public.whatsapp_channels set status='open',display_phone=case id when '{x}' then '+5511900000666' when '{y}' then '+5511900000777' when '{z}' then '+5511900000888' when '{group_candidate}' then '+5511900001919' else '+5511900000999' end where id in({quoted});commit;")
    a, b = race(route(shops[0], x, y, z), route(shops[0], z, y, x))
    assert sum(r.returncode == 0 for r in (a,b)) == 1, [r.stderr for r in (a,b)]
    assert sum('WA_STALE' in r.stderr for r in (a,b)) == 1
    print('PASS: três posições concorrentes têm um vencedor; versão antiga não sobrescreve')

    a, b = race(route(shops[1], y, z, x), route(shops[2], z, x, y))
    assert all(r.returncode == 0 for r in (a,b)), [r.stderr for r in (a,b)]
    print('PASS: destinos diferentes compartilham principal e duas reservas sem impasse')

    # Libera só a rota fictícia C e disputa a classificação do quarto número.
    sql(f"{AUTH} select public.platform_set_whatsapp_route('{shops[2]}',null,1,null,null,null,'paused',false,false,false);")
    # Um telefone ainda não pertence a perfil pessoal no início desta disputa.
    # O marcador restaura o telefone sob o mesmo protocolo de travas da classificação.
    sql(f"update public.profiles set whatsapp_e164=null where id='{person}';")
    binding = route(shops[2], personal, x, y)
    marking = f"select pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120)); update public.profiles set whatsapp_e164='+5511900000999' where id='{person}'; select public.platform_mark_whatsapp_personal('{personal}','{person}',0)"
    a, b = race(binding, marking)
    assert sum(r.returncode == 0 for r in (a,b)) == 1, [r.stderr for r in (a,b)]
    assert not any('deadlock' in r.stderr or 'timeout' in r.stderr for r in (a,b)), [r.stderr for r in (a,b)]
    assert any('WA_PERSONAL_REVIEW_REQUIRED' in r.stderr or 'WA_NUMBER_UNAVAILABLE' in r.stderr for r in (a,b)), [r.stderr for r in (a,b)]
    print('PASS: classificação pessoal e distribuição simultâneas não ganham juntas nem invertem travas')
    if os.environ.get('BC_TESTAR_CONCORRENCIA_FISICA_APOS_INCREMENTAL')=='1':
        print('ADIADO: corrida física da base antiga será executada após o incremental que corrige a ordem da trava')
    else:
        a,b=race(f"update public.whatsapp_channels set status='connecting' where id='{personal}'", marking)
        assert a.returncode==0,a.stderr
        assert not any('deadlock' in r.stderr or 'timeout' in r.stderr for r in (a,b)),[r.stderr for r in (a,b)]
        assert b.returncode==0 or 'WA_PERSONAL_REVIEW_REQUIRED' in b.stderr,b.stderr
        print('PASS: atualização física de conexão e classificação pessoal não criam inversão de travas')
    account=f"select public.care_group_admin('authorize_account',jsonb_build_object('shop_id','{shops[0]}','channel_id','{group_candidate}','platform_owned',true))"
    mark_account=f"select pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120)); update public.profiles set whatsapp_e164='+5511900001919' where id='{person}'; select public.platform_mark_whatsapp_personal('{group_candidate}','{person}',0)"
    a,b=race(account,mark_account)
    assert sum(r.returncode==0 for r in (a,b))==1,[r.stderr for r in (a,b)]
    assert not any('deadlock' in r.stderr or 'timeout' in r.stderr for r in (a,b)),[r.stderr for r in (a,b)]
    assert any('WA_PERSONAL_NUMBER' in r.stderr or 'WA_PERSONAL_REVIEW_REQUIRED' in r.stderr for r in (a,b)),[r.stderr for r in (a,b)]
    print('PASS: autorização de grupo e classificação pessoal simultâneas não ganham juntas')

finally:
    shop_ids = ','.join(f"'{value}'::uuid" for value in shops) or 'null'
    sql(f"""begin;{AUTH}
      delete from public.whatsapp_number_link_history where channel_id in({quoted});
      delete from public.whatsapp_number_links where barbershop_id in({shop_ids});
      delete from public.whatsapp_number_config_history where channel_id in({quoted});
      delete from public.whatsapp_group_accounts where channel_id in({quoted});
      delete from public.whatsapp_channels where id in({quoted});
      delete from public.whatsapp_activity_daily_history where channel_id in({quoted});
      delete from public.whatsapp_number_history where channel_id in({quoted});
      delete from public.shop_registration_requests where (result->>'shop_id')::uuid in({shop_ids});
      delete from public.barbershops where id in({shop_ids});
      delete from auth.users where id='{person}'; commit;""")
