#!/usr/bin/env bash
# Salva e envia o trabalho ao fim de cada rodada e devolve a vez.
#   scripts/autossave.sh <ferramenta>
# Envia ao origin (GitHub). Atenção: o hub-control espelha o origin no hostinger, então isto publica o site.
# Nunca inclui .env nem arquivos ._* do macOS.
set -u
ferramenta="${1:-desconhecida}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$ROOT" || exit 0
export GIT_TERMINAL_PROMPT=0 GIT_HTTP_LOW_SPEED_LIMIT=1000 GIT_HTTP_LOW_SPEED_TIME=10

if ! scripts/vez.sh checar "$ferramenta" >/dev/null 2>&1; then
  echo "autossave: $ferramenta está sem a vez; nada foi salvo" >&2
  exit 0
fi

git add -A -- . ':(exclude).env' ':(exclude).env.*' ':(exclude)**/._*' ':(exclude)._*' 2>/dev/null
if ! git diff --cached --quiet; then
  n="$(git diff --cached --name-only | wc -l | tr -d ' ')"
  git commit -q -m "Autossave ($ferramenta): $n arquivo(s)" || true
fi

branch="$(git branch --show-current)"
if [ "$branch" = "main" ] && [ -n "$(git log origin/main..HEAD --oneline 2>/dev/null)" ]; then
  if ! git push -q origin HEAD:main 2>/dev/null; then
    echo "autossave: envio recusado (o GitHub tem novidades). Rode: git pull --ff-only origin main" >&2
  fi
fi

scripts/vez.sh liberar "$ferramenta" >/dev/null 2>&1 || true
exit 0
