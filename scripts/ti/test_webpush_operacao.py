"""Bancada sem VPS/rede externa; dependências operacionais substituídas por simuladores."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('operador', Path(__file__).with_name('webpush_operacao.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class OperationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.patches = [patch.object(m, 'SERVICE', self.root), patch.object(m, 'INSTALL', self.root/'opt'),
                        patch.object(m, 'UNITS', self.root/'units'), patch.object(m, 'LOCK', self.root/'lock')]
        for p in self.patches: p.start()
        m.UNITS.mkdir()
        self.env = {'WEB_PUSH_ENABLED': 'false', 'WEB_PUSH_PUBLIC_KEY': 'publica-ficticia',
                    'WEB_PUSH_PRIVATE_KEY': 'privada-ficticia', 'WEB_PUSH_SUBJECT': 'mailto:contato@proh.media',
                    'WEB_PUSH_ALLOWED_ORIGINS': 'https://aurset.app',
                    'SUPABASE_SERVICE_ROLE_KEY': 'servico-ficticio'}
    def tearDown(self):
        for p in reversed(self.patches): p.stop()
        self.tmp.cleanup()
    def test_flags_compare_container_and_compose(self):
        m.validate_env(self.env, dict(self.env), True)
        for key in ('WEB_PUSH_ENABLED', *m.KEYS):
            bad = dict(self.env); bad[key] = 'divergente'
            with self.assertRaises(m.OperationError): m.validate_env(self.env, bad, True)
    def test_subject_not_just_present(self):
        bad = dict(self.env); bad['WEB_PUSH_SUBJECT'] = 'mailto:outro@example.invalid'
        with self.assertRaises(m.OperationError): m.validate_env(bad, bad, True)
    def test_flag_preserves_other_bytes_and_mode(self):
        original = b'# comentario\r\nWEB_PUSH_PRIVATE_KEY=segredo-ficticio\r\nWEB_PUSH_ENABLED=false\r\nOUTRA=123\r\n'
        p = self.root/'.env'; p.write_bytes(original); p.chmod(0o600)
        with patch.object(m.os, 'chown'):
            self.assertTrue(m.flag(True)); self.assertFalse(m.flag(True)); self.assertTrue(m.flag(False))
        self.assertEqual(p.read_bytes(), original)
        self.assertEqual(p.stat().st_mode & 0o777, 0o600)
    def test_duplicate_or_absent_flag_does_not_write(self):
        for raw in (b'OUTRA=1\n', b'WEB_PUSH_ENABLED=false\nWEB_PUSH_ENABLED=false\n'):
            (self.root/'.env').write_bytes(raw)
            with self.assertRaises(m.OperationError): m.flag(True)
            self.assertEqual((self.root/'.env').read_bytes(), raw)
    def test_symlink_cannot_be_overwritten(self):
        target = self.root/'real'; target.write_bytes(b'WEB_PUSH_ENABLED=false\n')
        (self.root/'.env').symlink_to(target)
        with self.assertRaises(m.OperationError): m.flag(True)
        self.assertEqual(target.read_bytes(), b'WEB_PUSH_ENABLED=false\n')
    def test_command_error_never_echoes_secret(self):
        with patch.object(m.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, 'TOKEN_NAO_EXIBIR', 'privada-ficticia')):
            with self.assertRaises(m.OperationError) as error: m.run(['docker', 'compose'])
        self.assertNotIn('privada-ficticia', str(error.exception))
        self.assertNotIn('TOKEN_NAO_EXIBIR', str(error.exception))
    def test_prepare_installs_disabled_without_env_or_db_changes(self):
        calls = []
        def run(args, **_):
            calls.append(args)
            return subprocess.CompletedProcess(args, 0, 'inactive\n', '')
        with patch.object(m, 'check'), patch.object(m, 'run', side_effect=run), patch.object(m, 'flag') as flag, patch.object(m, 'sql') as sql, patch.object(m.os, 'chown'):
            with contextlib.redirect_stdout(io.StringIO()): m.prepare()
            flag.assert_not_called(); sql.assert_not_called()
        self.assertIn(['systemctl', 'disable', '--now', 'bc-webpush.timer'], calls)
        self.assertFalse(any('enable' in c for c in calls))
        self.assertEqual((m.UNITS/'bc-webpush.service').read_text(), m.SERVICE_UNIT)
        self.assertIn('TimeoutStartSec=55s', m.SERVICE_UNIT)
        self.assertIn('OnUnitInactiveSec=15s', m.TIMER_UNIT)
    def test_prepare_rejects_other_unit(self):
        (m.UNITS/'bc-webpush.timer').write_text('outra configuração')
        with patch.object(m, 'check'), patch.object(m, 'run', return_value=subprocess.CompletedProcess([], 0, 'inactive', '')):
            with self.assertRaises(m.OperationError): m.prepare()
        self.assertEqual((m.UNITS/'bc-webpush.timer').read_text(), 'outra configuração')
    def test_pause_attempts_both_controls_even_if_scheduler_fails(self):
        events = []
        with patch.object(m, 'run', side_effect=m.OperationError('systemd')), patch.object(m, 'sql', side_effect=lambda s: events.append('banco')), patch.object(m, 'flag', side_effect=lambda b: events.append('ambiente') or True), patch.object(m, 'runtime', return_value=(self.env, 'healthy')), patch.object(m, 'recreate', side_effect=lambda: events.append('recreate')):
            with self.assertRaises(m.OperationError): m.pause()
        self.assertEqual(events, ['banco', 'ambiente', 'recreate'])
    def test_pause_already_off_avoids_recreate(self):
        with patch.object(m, 'run'), patch.object(m, 'sql'), patch.object(m, 'flag', return_value=False), patch.object(m, 'runtime', return_value=(self.env, 'healthy')), patch.object(m, 'recreate') as recreate:
            with contextlib.redirect_stdout(io.StringIO()): m.pause()
            recreate.assert_not_called()
    def test_activation_needs_explicit_switch(self):
        with patch('sys.argv', ['operador', 'ativar']), patch.object(m.os, 'geteuid', return_value=0), patch.object(m, 'activate') as activate:
            with self.assertRaises(m.OperationError): m.main()
            activate.assert_not_called()
    def test_activation_order_and_failure_returns_to_pause(self):
        active = dict(self.env); active['WEB_PUSH_ENABLED'] = 'true'
        for fail in (False, True):
            calls = []
            def run(args, **_):
                if args[1] == 'is-active': return subprocess.CompletedProcess(args, 0, 'active', '')
                if args[1] == 'is-enabled': return subprocess.CompletedProcess(args, 0, 'enabled', '')
                calls.append('timer'); return subprocess.CompletedProcess(args, 0, '', '')
            # O backup usa /root apenas como construção de caminho; mkdir/cópia são simulados.
            with patch.object(m, 'check', return_value=self.env), patch.object(m, 'prepared'), patch.object(m.Path, 'mkdir'), patch.object(m.shutil, 'copyfile'), patch.object(m.os, 'chmod'), patch.object(m, 'flag', side_effect=lambda b: calls.append('ambiente')), patch.object(m, 'compose', return_value=active), patch.object(m, 'recreate', side_effect=lambda: calls.append('recreate')), patch.object(m, 'runtime', return_value=(active, 'healthy')), patch.object(m, 'sql', side_effect=m.OperationError('banco') if fail else lambda s: calls.append('banco')), patch.object(m, 'run', side_effect=run), patch.object(m, 'pause') as pause, contextlib.redirect_stdout(io.StringIO()):
                if fail:
                    with self.assertRaises(m.OperationError): m.activate()
                    pause.assert_called_once(); self.assertNotIn('timer', calls)
                else:
                    m.activate(); pause.assert_not_called()
                    self.assertEqual(calls, ['ambiente', 'recreate', 'banco', 'timer'])
    def test_dispatch_off_does_not_touch_http(self):
        with patch.object(m, 'runtime', return_value=(self.env, 'healthy')), patch.object(m.urllib.request, 'build_opener') as opener, contextlib.redirect_stdout(io.StringIO()):
            m.dispatch(); opener.assert_not_called()
    def test_dispatch_locked_does_not_touch_runtime_or_http(self):
        with m.LOCK.open('a') as lock:
            m.fcntl.flock(lock, m.fcntl.LOCK_EX | m.fcntl.LOCK_NB)
            with patch.object(m, 'runtime') as runtime, contextlib.redirect_stdout(io.StringIO()):
                m.dispatch(); runtime.assert_not_called()
    def test_dispatch_one_call_and_sanitized_output(self):
        active = dict(self.env); active['WEB_PUSH_ENABLED'] = 'true'
        result = {'ok': True, 'enabled': True, 'processed': 4, 'uncertain': 0, 'private': 'NAO_EXIBIR'}
        class Response:
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self, _): return json.dumps(result).encode()
        with patch.object(m, 'runtime', return_value=(active, 'healthy')), patch.object(m.urllib.request, 'build_opener') as build, contextlib.redirect_stdout(io.StringIO()) as output:
            build.return_value.open.return_value = Response()
            m.dispatch()
            self.assertEqual(build.return_value.open.call_count, 1)
            req = build.return_value.open.call_args.args[0]
            self.assertEqual(req.get_header('Authorization'), 'Bearer servico-ficticio')
            self.assertEqual(req.data, b'{"action":"dispatch"}')
        self.assertNotIn('NAO_EXIBIR', output.getvalue())
        self.assertNotIn('servico-ficticio', output.getvalue())
    def test_http_error_not_retried(self):
        active = dict(self.env); active['WEB_PUSH_ENABLED'] = 'true'
        with patch.object(m, 'runtime', return_value=(active, 'healthy')), patch.object(m.urllib.request, 'build_opener') as build:
            build.return_value.open.side_effect = TimeoutError('fictício')
            with self.assertRaises(TimeoutError): m.dispatch()
            self.assertEqual(build.return_value.open.call_count, 1)
    def test_redirect_refused(self):
        with self.assertRaises(m.OperationError):
            m.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://outro.example.invalid')

if __name__ == '__main__': unittest.main(verbosity=2)
