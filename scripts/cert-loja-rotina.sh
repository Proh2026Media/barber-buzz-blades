#!/usr/bin/env bash
# Rotina automática do certificado de loja nova (P-27), chamada a partir do Mac.
# Instala na VPS o script scripts/vps/cert-lojas-sync.sh e o timer do systemd que o roda
# a cada 10 minutos (não usa o crontab do root nem /etc/cron.d).
#
# Uso:
#   scripts/cert-loja-rotina.sh status     # mostra se está instalada, a próxima rodada e o log
#   scripts/cert-loja-rotina.sh instalar   # instala ou atualiza (script + unidades) e liga o timer
#   scripts/cert-loja-rotina.sh desligar   # desliga o timer e apaga as unidades (o script fica)
#
# Variável opcional: VPS_SSH (padrão: vps-barba, o apelido SSH desta máquina).
# Guia: docs/implantacao-certificado-loja-2026-10-13.md, seção 6.

set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
VPS_SSH="${VPS_SSH:-vps-barba}"
acao="${1:-status}"

case "$acao" in
  instalar)
    for f in cert-lojas-sync.sh barba-cert-lojas.service barba-cert-lojas.timer; do
      [[ -f "$aqui/vps/$f" ]] || {
        echo "ERRO: não achei scripts/vps/$f" >&2
        exit 1
      }
    done
    tmp="/tmp/barba-cert-lojas-$$"
    ssh "$VPS_SSH" "mkdir -m 700 '$tmp'"
    scp -q "$aqui/vps/cert-lojas-sync.sh" "$aqui/vps/barba-cert-lojas.service" \
      "$aqui/vps/barba-cert-lojas.timer" "$VPS_SSH:$tmp/"
    # shellcheck disable=SC2029
    ssh "$VPS_SSH" "bash -s -- '$tmp'" <<'REMOTO'
set -euo pipefail
tmp="$1"
trap 'rm -rf "$tmp"' EXIT
bash -n "$tmp/cert-lojas-sync.sh"
install -o root -g root -m 0750 "$tmp/cert-lojas-sync.sh" /usr/local/sbin/barba-cert-lojas-sync.sh
install -o root -g root -m 0644 "$tmp/barba-cert-lojas.service" /etc/systemd/system/barba-cert-lojas.service
install -o root -g root -m 0644 "$tmp/barba-cert-lojas.timer" /etc/systemd/system/barba-cert-lojas.timer
systemd-analyze verify /etc/systemd/system/barba-cert-lojas.service /etc/systemd/system/barba-cert-lojas.timer
systemctl daemon-reload
systemctl enable --now barba-cert-lojas.timer
echo "Instalado. Próxima rodada:"
systemctl list-timers barba-cert-lojas.timer --no-pager | sed -n '1,2p'
REMOTO
    ;;
  status)
    ssh "$VPS_SSH" 'bash -s' <<'REMOTO'
if [[ ! -f /etc/systemd/system/barba-cert-lojas.timer ]]; then
  echo "Rotina não instalada."
  exit 0
fi
echo "Timer: $(systemctl is-enabled barba-cert-lojas.timer 2>/dev/null) / $(systemctl is-active barba-cert-lojas.timer 2>/dev/null)"
systemctl list-timers barba-cert-lojas.timer --no-pager | sed -n '1,2p'
echo "Última rodada: $(systemctl show -p Result --value barba-cert-lojas.service) (código $(systemctl show -p ExecMainStatus --value barba-cert-lojas.service))"
echo "--- registro da última hora ---"
journalctl -t barba-cert-lojas --since '-1 hour' --no-pager -o short-iso | tail -20
REMOTO
    ;;
  desligar)
    ssh "$VPS_SSH" 'bash -s' <<'REMOTO'
set -euo pipefail
systemctl disable --now barba-cert-lojas.timer 2>/dev/null || true
rm -f /etc/systemd/system/barba-cert-lojas.timer /etc/systemd/system/barba-cert-lojas.service
systemctl daemon-reload
echo "Rotina desligada (o script /usr/local/sbin/barba-cert-lojas-sync.sh continua lá)."
REMOTO
    ;;
  *)
    echo "uso: scripts/cert-loja-rotina.sh status|instalar|desligar" >&2
    exit 2
    ;;
esac
