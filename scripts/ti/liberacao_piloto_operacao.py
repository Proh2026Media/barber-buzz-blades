#!/usr/bin/env python3
"""Instala somente o incremental P-122 de liberação, mantendo todos os controles pausados."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

DB = 'supabase-db-z2dbb7dkyzhc8vjiywq34mhn'
EVOLUTION = 'api-ycr9loibkx8iim2swdmbhpgo'
PIN = 'ghcr.io/proh2026media/bc-evolution-groups@sha256:d4ca39d7c11fddea587d8ae257cb7881484aaac1871050724a0efa397b745495'
MIGRATION = 'supabase/migrations/20261115004000_whatsapp_piloto_liberacao_atomica.sql'

def require(ok, message):
    if not ok:
        raise RuntimeError(message)

def command(args, data=None, timeout=90):
    r = subprocess.run(args, input=data, capture_output=True, timeout=timeout)
    require(r.returncode == 0, 'Operação falhou; nenhum segredo é impresso. Consulte a evidência privada e preserve a pausa.')
    return r.stdout

def database(db, name, query):
    return command(['docker', 'exec', '-i', db, 'psql', '-XAtq', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', name], query.encode()).decode().strip()

def read_state(db, name):
    return json.loads(database(db, name, """begin read only;
select jsonb_build_object('paused',(select paused from public.whatsapp_send_controls where scope='global'),
'cycles',(select enabled from public.whatsapp_care_cycle_policy),'assistance',(select assisted_access_enabled from public.whatsapp_care_cycle_policy),
'distribution',(select enabled from public.whatsapp_distribution_policy),
'isolation_required',(select (to_jsonb(p)->>'pilot_isolation_required')::boolean from public.whatsapp_care_cycle_policy p),
'pilot_configured',(select pilot_shop_id is not null and pilot_customer_id is not null from public.whatsapp_care_cycle_policy),
'leases',(select count(*) from public.whatsapp_care_cycles where lease_until>clock_timestamp()),
'uncertain',(select count(*) from public.whatsapp_send_attempts where state in('started','unknown')),
'sending',(select count(*) from public.whatsapp_outbox where status='sending'));
rollback;"""))

def paused(state):
    require(state.get('paused') is True and all(state.get(k) is False for k in ('cycles', 'assistance', 'distribution')),
            'Manter pausa global e ciclos/assistência/distribuição desligados antes da instalação.')
    require(all(state.get(k) == 0 for k in ('leases', 'uncertain', 'sending')), 'Há trabalho em curso/incerto. Não instalar nem apagar filas para liberar.')

def metadata(db, name, signatures):
    require(all(re.fullmatch(r'[a-z_]+\([a-z,]*\)', s) for s in signatures), 'Assinatura inválida no contrato.')
    oids = ','.join("'public." + s + "'::regprocedure" for s in signatures)
    return json.loads(database(db, name, "select jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('oid',oid,'owner',pg_get_userbyid(proowner),'acl',proacl,'md5',md5(pg_get_functiondef(oid)))) from pg_proc where oid in (" + oids + ');'))

def integrity(root):
    require(root.is_dir(), 'Pacote ausente.')
    manifest = json.loads((root / 'MANIFESTO.json').read_text())
    for item in manifest['files']:
        p = root / item['path']
        require(not p.is_symlink() and p.resolve().is_relative_to(root.resolve()) and p.is_file(), 'Arquivo fora do pacote ou ausente.')
        require(hashlib.sha256(p.read_bytes()).hexdigest() == item['sha256'], 'Hash do pacote divergente.')
    return json.loads((root / 'operacao/contrato.json').read_text())

def identities(db, name):
    # Apenas assinaturas. Nenhum telefone, conta, convite, código ou JID sai do banco.
    return database(db, name, """select jsonb_build_object(
'groups',(select md5(coalesce(jsonb_agg(jsonb_build_array(id,barbershop_id,customer_id,customer_phone,group_jid,current_cycle_id) order by id),'[]')::text) from public.whatsapp_care_groups),
'cycles',(select md5(coalesce(jsonb_agg(jsonb_build_array(id,group_id,group_jid,customer_phone,admission_id,created_at,expires_at,consented_numbers) order by id),'[]')::text) from public.whatsapp_care_cycles),
'profiles',(select md5(coalesce(jsonb_agg(jsonb_build_array(id,whatsapp_e164,whatsapp_verified_at) order by id),'[]')::text) from public.profiles));""")

def principal():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('action', choices=['conferir', 'instalar'])
    p.add_argument('--pacote', type=Path, required=True)
    p.add_argument('--backup', type=Path)
    p.add_argument('--autorizado', action='store_true')
    p.add_argument('--bancada-local', action='store_true')
    p.add_argument('--banco', default='postgres')
    a = p.parse_args()
    require(not os.environ.get('DOCKER_HOST'), 'Não usar DOCKER_HOST remoto.')
    endpoint = command(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).decode().strip()
    require(endpoint.startswith('unix://'), 'Somente Docker Unix no próprio servidor/bancada.')
    db = 'barba-central-d1-local' if a.bancada_local else DB
    require(a.banco == 'postgres' or (a.bancada_local and re.fullmatch(r'bc_p122_operator_[a-f0-9]{32}', a.banco)), 'Banco fora do escopo.')
    contract = integrity(a.pacote)
    if not a.bancada_local:
        image = command(['docker', 'inspect', '--format', '{{.Config.Image}}|{{index .Config.Labels "org.opencontainers.image.version"}}', EVOLUTION]).decode().strip()
        require(image == PIN + '|2.3.7-bc.groups.7', 'Imagem fora da base v7 conferida; não substituir/recriar Evolution.')
    current = read_state(db, a.banco)
    paused(current)
    installed = database(db, a.banco, "select to_regprocedure('public.care_pilot_admin(text,jsonb)') is not null;") == 't'
    if installed:
        require(not current['pilot_configured'] or current['isolation_required'] is True, 'Piloto configurado sem marcador durável de isolamento; manter pausa.')
    expected = contract['after' if installed else 'before']
    meta = metadata(db, a.banco, list(expected))
    require(all(meta[k]['md5'] == v['md5'] and meta[k]['owner'] == v['owner'] and meta[k]['acl'] == v['acl'] for k, v in expected.items()), 'Definições/proprietários/ACLs divergentes da base exata.')
    if a.action == 'conferir':
        print(json.dumps({'integrity': True, 'installed': installed, 'paused': True, 'functions': len(meta)}))
        return
    require(a.autorizado, 'Instalação exige autorização específica e --autorizado.')
    require(not installed, 'Incremental já instalado: conferir, não reaplicar.')
    require(a.backup is not None and a.backup.is_absolute() and not a.backup.exists(), 'Informe pasta privada nova e absoluta para backup.')
    a.backup.mkdir(mode=0o700, parents=True)
    dump = a.backup / 'antes.dump'
    with dump.open('xb') as out:
        os.chmod(dump, 0o600)
        r = subprocess.run(['docker', 'exec', db, 'pg_dump', '-U', 'postgres', '-d', a.banco, '-Fc'], stdout=out, stderr=subprocess.PIPE, timeout=120)
        require(r.returncode == 0, 'Backup falhou; instalação não iniciada.')
    with dump.open('rb') as inp:
        r = subprocess.run(['docker', 'exec', '-i', db, 'pg_restore', '--list'], stdin=inp, capture_output=True, timeout=60)
        require(r.returncode == 0, 'Backup não validado; instalação não iniciada.')
    before_identity = identities(db, a.banco)
    evidence = a.backup / 'antes.json'
    evidence.write_text(json.dumps({'state': current, 'metadata': meta, 'identities': before_identity}, indent=2) + '\n')
    os.chmod(evidence, 0o600)
    migration = (a.pacote / MIGRATION).read_text()
    query = "begin;set local statement_timeout='30s';set local lock_timeout='5s';select pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));select pg_advisory_xact_lock(hashtextextended('whatsapp-channel-routing',116));\n" + migration + '\ncommit;'
    database(db, a.banco, query)
    after = metadata(db, a.banco, list(contract['after']))
    require(all(after[k]['md5'] == v['md5'] and after[k]['owner'] == v['owner'] and after[k]['acl'] == v['acl'] for k, v in contract['after'].items()), 'Pós-condição divergente; manter pausado e não retornar SQL cegamente.')
    require(all(all(after[k][field] == value[field] for field in ('oid', 'owner', 'acl')) for k, value in meta.items()), 'OID/proprietário/ACL anterior mudou; manter pausado.')
    final_state = read_state(db, a.banco)
    paused(final_state)
    require(not final_state['pilot_configured'] or final_state['isolation_required'] is True, 'Marcador de isolamento ausente; manter pausa.')
    require(identities(db, a.banco) == before_identity, 'Identidades mudaram; interromper e investigar, sem restaurar dump automaticamente.')
    result = {'installed': True, 'paused': True, 'identities_preserved': True, 'oid_owner_acl_preserved': True,
              'migration_sha256': hashlib.sha256(migration.encode()).hexdigest(), 'backup_sha256': hashlib.sha256(dump.read_bytes()).hexdigest(),
              'containers_restarted': 0, 'messages_sent': 0}
    result_file = a.backup / 'resultado.json'
    result_file.write_text(json.dumps(result, indent=2) + '\n')
    os.chmod(result_file, 0o600)
    print(json.dumps(result))

if __name__ == '__main__':
    try:
        principal()
    except (RuntimeError, OSError, subprocess.SubprocessError, ValueError) as exc:
        raise SystemExit(str(exc))
