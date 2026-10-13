#!/usr/bin/env bash
# Confere o trabalho antes de enviar ao origin (enviar ao origin publica o site; ver AGENTS.md).
#
#   scripts/verificar.sh               tipos, testes, eslint/prettier nos arquivos alterados e montagem
#   scripts/verificar.sh --sem-build   pula a montagem (npm run build), que é a etapa mais demorada
#   scripts/verificar.sh --tudo        eslint e prettier no projeto todo, não só nos alterados
#
# Ordem: checagem de tipos (tsc) → testes (npm test) → eslint → prettier → montagem.
# Arquivos alterados = git diff --name-only HEAD + arquivos novos não ignorados (sem ._* e sem
# apagados). Termina com um resumo (ok/falhou por etapa) e sai com 1 se algo falhou.

sem_build=0
tudo=0
for arg in "$@"; do
  case "$arg" in
    --sem-build) sem_build=1 ;;
    --tudo) tudo=1 ;;
    -h | --ajuda | --help)
      sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "verificar: opção desconhecida: $arg (use --sem-build, --tudo ou --ajuda)" >&2
      exit 2
      ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "verificar: rode dentro do repositório (não achei a raiz do git)" >&2
  exit 2
}
cd "$ROOT" || exit 2

nomes=()
situacoes=()
tempos=()
falhou=0

titulo() {
  printf '\n==> %s\n' "$1"
}

registrar() { # registrar <etapa> <ok|falhou|pulado: motivo> <segundos>
  nomes+=("$1")
  situacoes+=("$2")
  tempos+=("$3")
  case "$2" in falhou*) falhou=1 ;; esac
}

rodar() { # rodar <etapa> <comando...>
  local etapa="$1" inicio fim
  shift
  titulo "$etapa"
  inicio=$(date +%s)
  if "$@"; then
    fim=$(date +%s)
    registrar "$etapa" "ok" $((fim - inicio))
  else
    fim=$(date +%s)
    registrar "$etapa" "falhou" $((fim - inicio))
  fi
}

# --- Arquivos alterados (aceita espaço e & no nome) ---------------------------------------------
alterados=()
while IFS= read -r -d '' arquivo; do
  case "${arquivo##*/}" in ._*) continue ;; esac
  [ -f "$arquivo" ] || continue # apagado
  ja=0
  for visto in ${alterados[@]+"${alterados[@]}"}; do
    [ "$visto" = "$arquivo" ] && ja=1 && break
  done
  [ "$ja" = 1 ] || alterados+=("$arquivo")
done < <(
  git diff --name-only -z HEAD -- 2>/dev/null
  git ls-files -z --others --exclude-standard 2>/dev/null
)

para_eslint=()
para_prettier=()
for arquivo in ${alterados[@]+"${alterados[@]}"}; do
  case "$arquivo" in
    *.ts | *.tsx) para_eslint+=("$arquivo") ;;
  esac
  case "$arquivo" in
    *.js | *.mjs | *.cjs | *.jsx | *.ts | *.mts | *.cts | *.tsx | *.json | *.jsonc | *.json5 | \
      *.css | *.scss | *.less | *.html | *.vue | *.md | *.mdx | *.yaml | *.yml | *.graphql | *.gql)
      para_prettier+=("$arquivo")
      ;;
  esac
done

if [ "$tudo" = 1 ]; then
  echo "verificar: modo --tudo (eslint e prettier no projeto todo)"
else
  echo "verificar: ${#alterados[@]} arquivo(s) alterado(s); ${#para_eslint[@]} para o eslint, ${#para_prettier[@]} para o prettier"
fi

# --- Etapas -------------------------------------------------------------------------------------
rodar "Tipos (tsc)" npx --no-install tsc --noEmit
rodar "Testes (npm test)" npm test --silent

if [ "$tudo" = 1 ]; then
  rodar "Eslint (projeto todo)" npx --no-install eslint .
elif [ "${#para_eslint[@]}" -gt 0 ]; then
  rodar "Eslint (${#para_eslint[@]} arquivo(s))" npx --no-install eslint --no-warn-ignored -- "${para_eslint[@]}"
else
  registrar "Eslint" "pulado: nenhum .ts/.tsx alterado" 0
fi

if [ "$tudo" = 1 ]; then
  rodar "Prettier (projeto todo)" npx --no-install prettier --check .
elif [ "${#para_prettier[@]}" -gt 0 ]; then
  rodar "Prettier (${#para_prettier[@]} arquivo(s))" npx --no-install prettier --check --ignore-unknown -- "${para_prettier[@]}"
else
  registrar "Prettier" "pulado: nenhum arquivo que ele formata foi alterado" 0
fi

if [ "$sem_build" = 1 ]; then
  registrar "Montagem (npm run build)" "pulado: --sem-build" 0
else
  rodar "Montagem (npm run build)" npm run build --silent
fi

# --- Resumo -------------------------------------------------------------------------------------
printf '\n==> Resumo\n'
for i in "${!nomes[@]}"; do
  printf '  %-34s %-8s %ss\n' "${nomes[$i]}" "${situacoes[$i]%%:*}" "${tempos[$i]}"
  case "${situacoes[$i]}" in pulado:*) printf '  %-34s (%s)\n' "" "${situacoes[$i]#pulado: }" ;; esac
done
if [ "$falhou" = 1 ]; then
  printf '\nverificar: FALHOU — corrija antes de enviar ao origin (enviar publica o site).\n'
  if [ "$tudo" = 0 ] && [ "${#para_prettier[@]}" -gt 0 ]; then
    echo "Dica: formatação se corrige com: npx prettier --write <arquivo>"
  fi
  exit 1
fi
printf '\nverificar: tudo ok.\n'
exit 0
