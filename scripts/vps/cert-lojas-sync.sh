#!/usr/bin/env bash
# Certificado por loja em <slug>.beauty.contheiner.digital (P-27). Roda NA VPS, como root.
#
# O roteador curinga (wildcard-beauty.yaml, HostRegexp) não pede certificado por host, e o
# Traefik entrega o "TRAEFIK DEFAULT CERT". Cada loja precisa de um roteador Host(...) em
# beauty-shop-certs.yaml. Este script lê as lojas ativas no banco e acrescenta só os
# roteadores que faltam, no mesmo formato dos existentes. Não remove nada e não toca DNS.
#
# Uso:
#   cert-lojas-sync.sh [--simular | --aplicar] [--sem-conferir] [slug ...]
#     --simular       padrão: só mostra o que mudaria e o certificado atual de cada loja
#     --aplicar       grava (cópia de segurança + validação + troca atômica) e confere
#     --sem-conferir  não consulta os certificados (útil no cron)
#     slug ...        limita às lojas citadas (precisam estar ativas no banco)
#
# Variáveis opcionais: CERT_FILE, DB_CONTAINER, BACKUP_DIR, BASE_HOST, ESPERA_CERT (segundos).
#
# Saída: 0 = nada a fazer ou aplicado; 1 = erro; 3 = simulação encontrou roteadores faltando.

set -euo pipefail

CERT_FILE="${CERT_FILE:-/data/coolify/proxy/dynamic/beauty-shop-certs.yaml}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db-z2dbb7dkyzhc8vjiywq34mhn}"
BACKUP_DIR="${BACKUP_DIR:-/root}"
BASE_HOST="${BASE_HOST:-beauty.contheiner.digital}"
ESPERA_CERT="${ESPERA_CERT:-120}"
LOCK_FILE="/run/lock/barba-cert-lojas.lock"

modo="simular"
conferir=1
filtro=()
for arg in "$@"; do
  case "$arg" in
    --simular) modo="simular" ;;
    --aplicar) modo="aplicar" ;;
    --sem-conferir) conferir=0 ;;
    -h | --help)
      sed -n '2,19p' "$0" 2>/dev/null || true
      exit 0
      ;;
    -*)
      echo "ERRO: opção desconhecida: $arg" >&2
      exit 1
      ;;
    *) filtro+=("$arg") ;;
  esac
done

slug_valido() { [[ "$1" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; }

# Emissor do certificado entregue pelo Traefik local para o host.
emissor() {
  echo | timeout 10 openssl s_client -servername "$1" -connect 127.0.0.1:443 2>/dev/null |
    openssl x509 -noout -issuer 2>/dev/null | sed 's/^issuer= *//' || true
}

descrever_cert() {
  local host="$1" e
  e="$(emissor "$host")"
  if [[ -z "$e" ]]; then
    echo "  $host: sem resposta TLS em 127.0.0.1:443"
  elif [[ "$e" == *"TRAEFIK DEFAULT CERT"* ]]; then
    echo "  $host: AINDA É O TRAEFIK DEFAULT CERT"
  else
    echo "  $host: ok ($e)"
  fi
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Outra execução está em andamento; saindo sem mexer."
  exit 0
fi

[[ -f "$CERT_FILE" ]] || {
  echo "ERRO: arquivo não encontrado: $CERT_FILE" >&2
  exit 1
}

if ! lojas_raw="$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -XAtc \
  "select slug from public.barbershops where status = 'active' and slug is not null order by slug")"; then
  echo "ERRO: não foi possível ler as lojas no banco ($DB_CONTAINER)." >&2
  exit 1
fi

ativas=()
while IFS= read -r s; do
  [[ -z "$s" ]] && continue
  if slug_valido "$s"; then
    ativas+=("$s")
  else
    echo "AVISO: endereço de loja fora do padrão, ignorado: '$s'" >&2
  fi
done <<<"$lojas_raw"

if [[ ${#ativas[@]} -eq 0 ]]; then
  echo "ERRO: nenhuma loja ativa veio do banco; por segurança, nada será feito." >&2
  exit 1
fi

alvo=()
if [[ ${#filtro[@]} -gt 0 ]]; then
  for f in "${filtro[@]}"; do
    if ! slug_valido "$f"; then
      echo "ERRO: endereço inválido: '$f'" >&2
      exit 1
    fi
    if [[ " ${ativas[*]} " != *" $f "* ]]; then
      echo "ERRO: '$f' não é uma loja ativa no banco." >&2
      exit 1
    fi
    alvo+=("$f")
  done
else
  alvo=("${ativas[@]}")
fi

existentes="$(grep -o 'Host(`[^`]*`)' "$CERT_FILE" | sed 's/^Host(`//; s/`)$//' || true)"

faltam=()
for s in "${alvo[@]}"; do
  host="$s.$BASE_HOST"
  if ! grep -qxF "$host" <<<"$existentes"; then
    if getent hosts "$host" >/dev/null; then
      faltam+=("$s")
    else
      echo "AVISO: $host não resolve no DNS; não acrescentado." >&2
    fi
  fi
done

sobrando=()
while IFS= read -r h; do
  [[ -z "$h" ]] && continue
  s="${h%."$BASE_HOST"}"
  if [[ " ${ativas[*]} " != *" $s "* ]]; then
    sobrando+=("$h")
  fi
done <<<"$existentes"

echo "Arquivo: $CERT_FILE"
echo "Lojas ativas no banco: ${#ativas[@]} (${ativas[*]})"
echo "Já com roteador: $(grep -c . <<<"$existentes" || true)"
if [[ ${#sobrando[@]} -gt 0 ]]; then
  echo "Roteadores sem loja ativa (mantidos; remover à mão se for o caso): ${sobrando[*]}"
fi

bloco() {
  cat <<YAML
    beauty-shop-$1:
      rule: Host(\`$1.$BASE_HOST\`)
      entryPoints:
        - https
      service: hostinger-beauty@file
      priority: 30
      tls:
        certResolver: letsencrypt
YAML
}

if [[ ${#faltam[@]} -eq 0 ]]; then
  echo "Nada a acrescentar: todas as lojas ativas já têm roteador."
  if [[ $conferir -eq 1 ]]; then
    echo "Certificados:"
    for s in "${alvo[@]}"; do descrever_cert "$s.$BASE_HOST"; done
  fi
  exit 0
fi

echo "Faltam roteadores para: ${faltam[*]}"
echo "--- bloco que seria acrescentado ao fim do arquivo ---"
for s in "${faltam[@]}"; do bloco "$s"; done
echo "------------------------------------------------------"

if [[ "$modo" == "simular" ]]; then
  if [[ $conferir -eq 1 ]]; then
    echo "Certificados hoje:"
    for s in "${alvo[@]}"; do descrever_cert "$s.$BASE_HOST"; done
  fi
  echo "Modo simular: nada foi gravado. Para gravar, rode de novo com --aplicar."
  exit 3
fi

dir="$(dirname "$CERT_FILE")"
stamp="$(date +%Y%m%d-%H%M%S)"
backup="$BACKUP_DIR/$(basename "$CERT_FILE").bak-$stamp"
# Nome sem .yaml/.yml/.toml: o provedor de arquivos do Traefik ignora o temporário.
tmp="$dir/.$(basename "$CERT_FILE").tmp-$$"
trap 'rm -f "$tmp"' EXIT

cp -p "$CERT_FILE" "$backup"
{
  cat "$CERT_FILE"
  if [[ -n "$(tail -c1 "$CERT_FILE")" ]]; then echo; fi
  for s in "${faltam[@]}"; do bloco "$s"; done
} >"$tmp"

esperados="$(
  grep -o 'Host(`[^`]*`)' "$CERT_FILE" | sed 's/^Host(`//; s/`)$//' || true
  for s in "${faltam[@]}"; do echo "$s.$BASE_HOST"; done
)"

if command -v python3 >/dev/null && python3 -c 'import yaml' 2>/dev/null; then
  if ! ESPERADOS="$esperados" python3 - "$tmp" <<'PY'; then
import os, sys, yaml
doc = yaml.safe_load(open(sys.argv[1], encoding="utf-8"))
routers = doc["http"]["routers"]
want = set(os.environ["ESPERADOS"].split())
got = set()
for name, r in routers.items():
    assert r["entryPoints"] == ["https"], name
    assert r["service"] == "hostinger-beauty@file", name
    assert r["tls"]["certResolver"] == "letsencrypt", name
    got.add(r["rule"][len("Host(`"):-len("`)")])
assert got == want, (sorted(got), sorted(want))
assert set(doc.keys()) == {"http"} and set(doc["http"].keys()) == {"routers"}
PY
    echo "ERRO: o YAML gerado não passou na validação; arquivo original intacto." >&2
    exit 1
  fi
  echo "Validação do YAML: ok (python3 + yaml)."
else
  linhas_antes=$(wc -l <"$CERT_FILE")
  linhas_depois=$(wc -l <"$tmp")
  if [[ $((linhas_depois - linhas_antes)) -lt $((8 * ${#faltam[@]})) ]] || grep -qP '\t' "$tmp"; then
    echo "ERRO: checagem simples do arquivo gerado falhou; arquivo original intacto." >&2
    exit 1
  fi
  echo "Validação simples: ok (python3/yaml indisponível)."
fi

chown --reference="$CERT_FILE" "$tmp"
chmod --reference="$CERT_FILE" "$tmp"
mv -f "$tmp" "$CERT_FILE"
trap - EXIT
echo "Gravado às $(date '+%d/%m/%Y %H:%M:%S %Z'). Cópia de segurança: $backup"
echo "Para desfazer: cp -p '$backup' '$CERT_FILE'"

if [[ $conferir -eq 0 ]]; then
  exit 0
fi

echo "Conferindo os certificados (até ${ESPERA_CERT}s; o Traefik relê a pasta sozinho)..."
fim=$((SECONDS + ESPERA_CERT))
pendentes=("${faltam[@]}")
while [[ ${#pendentes[@]} -gt 0 && $SECONDS -lt $fim ]]; do
  sleep 10
  resto=()
  for s in "${pendentes[@]}"; do
    e="$(emissor "$s.$BASE_HOST")"
    if [[ -n "$e" && "$e" != *"TRAEFIK DEFAULT CERT"* ]]; then
      echo "  $s.$BASE_HOST: ok ($e)"
    else
      resto+=("$s")
    fi
  done
  pendentes=("${resto[@]+"${resto[@]}"}")
done
for s in "${pendentes[@]+"${pendentes[@]}"}"; do
  echo "  $s.$BASE_HOST: AINDA É O TRAEFIK DEFAULT CERT (o Let's Encrypt pode levar mais; rode --simular depois)"
done
exit 0
