#!/usr/bin/env bash
# Certificado do subdomínio de loja (P-27), chamado a partir do Mac.
# Envia scripts/vps/cert-lojas-sync.sh à VPS pela entrada padrão (nada fica gravado lá)
# e repassa as opções. O padrão é só simular.
#
# Uso:
#   scripts/cert-loja.sh                    # simula para todas as lojas ativas
#   scripts/cert-loja.sh loja-nova          # simula só para uma loja
#   scripts/cert-loja.sh --aplicar          # grava os roteadores que faltam e confere
#   scripts/cert-loja.sh --aplicar loja-nova
#
# Variável opcional: VPS_SSH (padrão: vps-barba, o apelido SSH desta máquina).
# Guia: docs/implantacao-certificado-loja-2026-10-13.md

set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
remoto="$aqui/vps/cert-lojas-sync.sh"
VPS_SSH="${VPS_SSH:-vps-barba}"

[[ -f "$remoto" ]] || {
  echo "ERRO: não achei $remoto" >&2
  exit 1
}

args=""
for a in "$@"; do
  if [[ ! "$a" =~ ^(--simular|--aplicar|--sem-conferir|-h|--help|[a-z0-9-]+)$ ]]; then
    echo "ERRO: argumento não aceito: $a" >&2
    exit 1
  fi
  args+=" $a"
done

# shellcheck disable=SC2029
ssh "$VPS_SSH" "bash -s --$args" <"$remoto"
