#!/usr/bin/env bash
# Wrapper Cursor: vez.sh usa exit code; Cursor failClosed exige JSON em stdout.
set -u
[ -t 0 ] || cat >/dev/null 2>&1 || true
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo '{"permission":"deny","user_message":"nao achei a raiz do repositorio — acao vetada"}'
  exit 2
}
cd "$ROOT" || {
  echo '{"permission":"deny","user_message":"nao consegui entrar na raiz do repositorio"}'
  exit 2
}
if scripts/vez.sh checar cursor >/dev/null 2>&1; then
  echo '{"permission":"allow"}'
  exit 0
fi
echo '{"permission":"deny","user_message":"BLOQUEADO pela vez — outra ferramenta esta editando (scripts/vez.sh status)"}'
exit 2
