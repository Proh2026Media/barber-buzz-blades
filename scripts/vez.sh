#!/usr/bin/env bash
# Vez entre ferramentas (Cursor, Codex, Claude…): só quem tem a vez edita este repositório.
# A vez mora no GitHub (ramo "vez" do remoto origin), então vale entre máquinas e pastas.
#
#   scripts/vez.sh pedir   <ferramenta> [descrição]  0 = ficou com a vez
#   scripts/vez.sh checar  <ferramenta>              0 = a vez é dela (renova; pega se estiver livre)
#   scripts/vez.sh liberar <ferramenta>              devolve a vez
#   scripts/vez.sh status                            mostra quem está com a vez
#
# A vez vence após VEZ_PRAZO_MIN minutos sem renovação (padrão 30).
set -u

REMOTO="${VEZ_REMOTO:-origin}"
RAMO="refs/heads/vez"
LOCAL_REF="refs/vez/remoto"
PRAZO=$(( ${VEZ_PRAZO_MIN:-30} * 60 ))
RENOVAR=$(( ${VEZ_RENOVAR_MIN:-20} * 60 ))

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "vez: fora de um repositório git" >&2; exit 2; }
cd "$ROOT" || exit 2
GITDIR="$(git rev-parse --git-dir)"
CACHE="$GITDIR/vez-cache"

export GIT_HTTP_LOW_SPEED_LIMIT=1000 GIT_HTTP_LOW_SPEED_TIME=10 GIT_TERMINAL_PROMPT=0

agora() { date +%s; }

campo() { # campo <nome> <texto>
  printf '%s\n' "$2" | sed -n "s/^$1=//p" | head -1
}

buscar_remoto() { # deixa em ESTADO/SHA o conteúdo atual do ramo vez; 1 = sem conexão
  local linha
  linha="$(git ls-remote "$REMOTO" "$RAMO" 2>/dev/null)" || return 1
  SHA="$(printf '%s' "$linha" | awk '{print $1}')"
  ESTADO=""
  if [ -n "$SHA" ]; then
    git fetch -q "$REMOTO" "+$RAMO:$LOCAL_REF" 2>/dev/null || return 1
    ESTADO="$(git show "$LOCAL_REF:VEZ" 2>/dev/null || true)"
  fi
  return 0
}

livre() { # livre <estado> -> 0 se ninguém tem a vez ou ela venceu
  local dono renovado
  dono="$(campo dono "$1")"
  renovado="$(campo renovado "$1")"
  [ -z "$dono" ] && return 0
  [ -z "$renovado" ] && return 0
  [ $(( $(agora) - renovado )) -ge "$PRAZO" ]
}

gravar_remoto() { # gravar_remoto <conteúdo> <mensagem>; troca atômica sobre SHA lido
  local blob tree commit lease
  blob="$(printf '%s\n' "$1" | git hash-object -w --stdin)" || return 1
  tree="$(printf '100644 blob %s\tVEZ\n' "$blob" | git mktree)" || return 1
  commit="$(git commit-tree "$tree" -m "$2")" || return 1
  lease="$RAMO:${SHA:-}"
  git push -q --force-with-lease="$lease" "$REMOTO" "$commit:$RAMO" 2>/dev/null
}

gravar_cache() { printf 'dono=%s\nrenovado=%s\n' "$1" "$2" > "$CACHE"; }

pegar() { # pegar <ferramenta> <descrição>
  local ferramenta="$1" descricao="$2" desde t conteudo
  buscar_remoto || { echo "vez: sem conexão com o GitHub" >&2; return 1; }
  if ! livre "$ESTADO" && [ "$(campo dono "$ESTADO")" != "$ferramenta" ]; then
    echo "vez: com $(campo dono "$ESTADO") ($(campo descricao "$ESTADO")) desde $(campo desde_legivel "$ESTADO")" >&2
    return 1
  fi
  t="$(agora)"
  desde="$t"
  if [ "$(campo dono "$ESTADO")" = "$ferramenta" ] && ! livre "$ESTADO"; then
    desde="$(campo desde "$ESTADO")"
    [ -z "$descricao" ] && descricao="$(campo descricao "$ESTADO")"
  fi
  conteudo="dono=$ferramenta
descricao=${descricao:-sem descrição}
maquina=$(hostname -s 2>/dev/null || hostname)
desde=$desde
desde_legivel=$(date -r "$desde" '+%d/%m %H:%M' 2>/dev/null || date -d "@$desde" '+%d/%m %H:%M')
renovado=$t"
  if ! gravar_remoto "$conteudo" "vez: $ferramenta"; then
    # Chamadas simultâneas da mesma ferramenta disputam a gravação; vale quem ficou com a vez.
    if buscar_remoto && ! livre "$ESTADO" && [ "$(campo dono "$ESTADO")" = "$ferramenta" ]; then
      gravar_cache "$ferramenta" "$(campo renovado "$ESTADO")"
      return 0
    fi
    echo "vez: outra ferramenta pegou a vez agora" >&2
    return 1
  fi
  gravar_cache "$ferramenta" "$t"
  return 0
}

cmd="${1:-status}"
ferramenta="${2:-}"

case "$cmd" in
  pedir)
    [ -n "$ferramenta" ] || { echo "uso: vez.sh pedir <ferramenta> [descrição]" >&2; exit 2; }
    pegar "$ferramenta" "${3:-}" && echo "vez: com $ferramenta"
    ;;
  checar)
    [ -n "$ferramenta" ] || { echo "uso: vez.sh checar <ferramenta>" >&2; exit 2; }
    if [ -f "$CACHE" ]; then
      c="$(cat "$CACHE")"
      if [ "$(campo dono "$c")" = "$ferramenta" ]; then
        r="$(campo renovado "$c")"
        [ -n "$r" ] && [ $(( $(agora) - r )) -lt "$RENOVAR" ] && exit 0
      fi
    fi
    pegar "$ferramenta" ""
    ;;
  liberar)
    [ -n "$ferramenta" ] || { echo "uso: vez.sh liberar <ferramenta>" >&2; exit 2; }
    rm -f "$CACHE"
    buscar_remoto || { echo "vez: sem conexão; a vez vence sozinha em $(( PRAZO / 60 )) min" >&2; exit 1; }
    if [ "$(campo dono "$ESTADO")" = "$ferramenta" ]; then
      gravar_remoto "dono=
liberado_por=$ferramenta
renovado=$(agora)" "vez: livre (liberada por $ferramenta)" || exit 1
      echo "vez: livre"
    else
      echo "vez: $ferramenta não estava com a vez"
    fi
    ;;
  status)
    buscar_remoto || { echo "vez: sem conexão com o GitHub" >&2; exit 1; }
    if livre "$ESTADO"; then
      echo "vez: livre"
    else
      echo "vez: com $(campo dono "$ESTADO") — $(campo descricao "$ESTADO") — máquina $(campo maquina "$ESTADO") — desde $(campo desde_legivel "$ESTADO")"
    fi
    ;;
  *)
    echo "uso: vez.sh pedir|checar|liberar|status <ferramenta> [descrição]" >&2
    exit 2
    ;;
esac
