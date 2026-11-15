#!/usr/bin/env python3
"""Adaptador somente de fixtures locais: base v5 pelo ZIP, mantendo o hotfix aprovado."""
from pathlib import Path
import json
import subprocess
ROOT = Path(__file__).resolve().parent
PACKAGE = ROOT / 'pacote-v6' / 'BC-Acolhimento-Grupos-P122-2026-11-15'
V5 = ROOT / 'pacote-v5' / 'BC-Central-WhatsApp-P122-2026-11-14'
original = PACKAGE / 'bancada/scripts/testar-pacote-acolhimento.py'
source = original.read_text()
old = "data = subprocess.check_output(['git', 'show', '7db853a:supabase/functions/' + path], stderr=subprocess.DEVNULL)"
new = 'data = (Path(' + repr(str(V5)) + ") / 'funcoes' / path).read_bytes()"
assert source.count(old) == 1
source = source.replace(old, new)
needle = "cmd = ['docker', 'exec', '-i', 'barba-central-d1-local', 'psql', '-XqAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres']"
assert source.count(needle) == 1
source = source.replace(needle, needle + chr(10) + 'subprocess.run(cmd, input=Path(' + repr(str(ROOT / 'hotfix-safeupdate.sql')) + ').read_bytes(), check=True)')
import sys
sys.argv = [str(original), '--pacote', str(PACKAGE)]
exec(compile(source, str(original), 'exec'), {'__file__': str(original), '__name__': '__main__'})
subprocess.run(['python3', 'scripts/testar-acolhimento-apos-entrada.py'], cwd=PACKAGE/'bancada', check=True)
query = "select count(*)=2 from pg_proc where (oid='public.care_group_admin(text,jsonb)'::regprocedure and md5(prosrc)='6a15e4fead26e0347dbba94e15757cdb') or (oid='public.platform_set_whatsapp_automatic(boolean,bigint)'::regprocedure and md5(prosrc)='efe97b1fbc2e68ab67c4fe8630d539fd');"
result = subprocess.check_output(['docker','exec','barba-central-d1-local','psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',query],text=True).strip()
assert result == 't', 'Hotfix de singleton não foi preservado'
(ROOT.parent/'evidencias/compatibilidade-hotfix.json').write_text(json.dumps({'operator_package_test':True,'post_entry_sql_tests':True,'hotfix_both_functions_preserved':True,'production_access':False},indent=2)+chr(10))
print('PASS: incremental preserva ambas as funções corrigidas e grupos/preferências de fixture')
