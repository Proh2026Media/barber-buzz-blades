# Certificado do subdomínio de loja nova (P-27)

Escrito em 13/10/2026. Trata a pendência P-27 de [guia/pendencias.md](guia/pendencias.md): toda loja nova precisa de um roteador próprio no Traefik para ganhar certificado em `<slug>.beauty.contheiner.digital`.

## 1. Para que serve

- O DNS curinga `*.beauty` já leva qualquer subdomínio à VPS, e o roteador curinga (`wildcard-beauty.yaml`, `HostRegexp`) já leva o pedido à Hostinger. **Não é preciso mexer em DNS.**
- O roteador curinga não pede certificado por endereço: sem roteador próprio, o navegador recebe o "TRAEFIK DEFAULT CERT" e mostra a página de "conexão não segura".
- Desde 02/10/2026 cada loja ganha um roteador `Host(...)` em `/data/coolify/proxy/dynamic/beauty-shop-certs.yaml`. O Traefik do Coolify relê essa pasta sozinho e pede o certificado ao Let's Encrypt. Até hoje o bloco era acrescentado à mão (passo 4 de [testes-reais-loja-teste.md](testes-reais-loja-teste.md)).

Os scripts abaixo fazem isso de forma segura:

| Arquivo                                                             | Onde roda | O que faz                                                                                 |
| ------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| [scripts/vps/cert-lojas-sync.sh](../scripts/vps/cert-lojas-sync.sh) | na VPS    | lê as lojas ativas no banco e acrescenta só os roteadores que faltam                      |
| [scripts/cert-loja.sh](../scripts/cert-loja.sh)                     | no Mac    | manda o script acima à VPS por `ssh vps-barba` (nada fica gravado lá) e repassa as opções |

Garantias do script:

- lê as lojas com `select slug from public.barbershops where status = 'active'` (colunas conferidas no banco em 13/10/2026; o tipo `barbershop_status` só tem `active` e `suspended`);
- aceita só endereços no formato de slug (`a-z`, `0-9` e hífen); qualquer outro é ignorado com aviso, para nada estranho entrar no arquivo do proxy;
- acrescenta só o que falta, no mesmo formato dos blocos existentes (`entryPoints: https`, `service: hostinger-beauty@file`, `priority: 30`, `certResolver: letsencrypt`); rodar de novo não muda nada;
- não acrescenta endereço que não resolve no DNS e **nunca remove** roteador (os de lojas suspensas ou apagadas só aparecem num aviso);
- antes de gravar: cópia de segurança em `/root/beauty-shop-certs.yaml.bak-<data-hora>`, validação do YAML com `python3` + `yaml` (existe na VPS; sem ele, faz uma checagem simples) e troca atômica (arquivo temporário na mesma pasta + `mv`, mantendo dono e permissões). O temporário não termina em `.yaml`, então o Traefik não o lê;
- trava de execução (`flock`) para duas rodadas não se atropelarem;
- depois de gravar, consulta o certificado entregue em `127.0.0.1:443` (até 120 s) e diz se ainda é o "TRAEFIK DEFAULT CERT".

## 2. Como rodar

Do Mac, na pasta do projeto (o caminho tem espaço e `&`: use aspas):

```bash
cd "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo"
scripts/cert-loja.sh                      # simula: mostra o que faltaria e o certificado de cada loja
scripts/cert-loja.sh --aplicar            # grava os roteadores que faltam e confere
scripts/cert-loja.sh --aplicar loja-nova  # limita a uma loja (precisa estar ativa no banco)
```

Direto na VPS (como root), com o arquivo copiado para lá:

```bash
bash cert-lojas-sync.sh --simular
bash cert-lojas-sync.sh --aplicar
```

Códigos de saída: `0` = nada a fazer ou aplicado; `1` = erro (nada gravado); `3` = a simulação achou roteadores faltando.

## 3. Saída esperada

Simulação com uma loja faltando (saída real de 13/10/2026, 17:37):

```text
Arquivo: /data/coolify/proxy/dynamic/beauty-shop-certs.yaml
Lojas ativas no banco: 4 (arena-barber externabarbearia loja-teste loja-teste-b)
Já com roteador: 3
Faltam roteadores para: loja-teste-b
--- bloco que seria acrescentado ao fim do arquivo ---
    beauty-shop-loja-teste-b:
      rule: Host(`loja-teste-b.beauty.contheiner.digital`)
      ...
Certificados hoje:
  arena-barber.beauty.contheiner.digital: ok (C = US, O = Let's Encrypt, CN = YR2)
  ...
  loja-teste-b.beauty.contheiner.digital: AINDA É O TRAEFIK DEFAULT CERT
Modo simular: nada foi gravado. Para gravar, rode de novo com --aplicar.
```

Aplicação:

```text
Validação do YAML: ok (python3 + yaml).
Gravado às 13/10/2026 20:37:24 UTC. Cópia de segurança: /root/beauty-shop-certs.yaml.bak-20261013-203724
Para desfazer: cp -p '/root/beauty-shop-certs.yaml.bak-20261013-203724' '/data/coolify/proxy/dynamic/beauty-shop-certs.yaml'
Conferindo os certificados (até 120s; o Traefik relê a pasta sozinho)...
  loja-teste-b.beauty.contheiner.digital: ok (C = US, O = Let's Encrypt, CN = YR1)
```

Sem nada a fazer: `Nada a acrescentar: todas as lojas ativas já têm roteador.` e a lista dos certificados.

Se a conferência terminar com "AINDA É O TRAEFIK DEFAULT CERT", o Let's Encrypt pode estar atrasado: rodar a simulação de novo depois de alguns minutos. Se continuar, olhar `docker logs --tail 100 coolify-proxy` à procura do nome da loja (erros de ACME). Não reiniciar o proxy.

## 4. Aplicado em 13/10/2026

- **Loja:** `loja-teste-b` (Loja Teste B, criada nos testes do P-41 sem certificado próprio). O endereço resolvia para a VPS (`187.127.60.78`) e o formato do bloco era idêntico aos três existentes.
- **Ensaio antes:** o modo `--aplicar` rodou numa cópia em `/tmp` da VPS (dono `9999:root` e permissão `644` mantidos; a segunda rodada não mudou nada); cópia apagada depois.
- **Horário:** 13/10/2026, 17:37:24 (Brasília) = 20:37:24 UTC.
- **Cópia de segurança:** `/root/beauty-shop-certs.yaml.bak-20261013-203724` (estado com arena-barber, externabarbearia e loja-teste).
- **Conferência:** pelo Mac, `openssl s_client` em `loja-teste-b.beauty.contheiner.digital:443` → emissor Let's Encrypt (YR1), titular `CN=loja-teste-b.beauty.contheiner.digital`, válido até 11/01/2027; `https://` das quatro lojas respondeu `200`; uma nova simulação disse "Nada a acrescentar" com as quatro lojas `ok`.

## 5. Como desfazer

- Tudo: `cp -p /root/beauty-shop-certs.yaml.bak-<data-hora> /data/coolify/proxy/dynamic/beauty-shop-certs.yaml` (o próprio script imprime a linha exata). O Traefik relê sozinho.
- Uma loja só: apagar do arquivo as 8 linhas do bloco `beauty-shop-<slug>:`, com cópia de segurança antes (para as lojas de teste, é o passo 8.4 de [testes-reais-loja-teste.md](testes-reais-loja-teste.md)). Se a loja continuar ativa, um cron instalado (seção 6) acrescentaria o bloco de volta.
- Tirar o roteador não apaga o certificado já emitido (fica no `acme.json` do Traefik, que **não** deve ser editado à mão); o endereço volta a receber o certificado padrão.

## 6. Proposta de automação (para o dono aprovar; **não instalada**)

Hoje, quem cria uma loja precisa lembrar de rodar o script. Proposta: uma tarefa própria no cron do host, num arquivo novo em `/etc/cron.d/` (como as três `barba-*` que já existem), **sem tocar no crontab do root**.

1. Instalar o script num lugar fixo da VPS (do Mac):

   ```bash
   scp scripts/vps/cert-lojas-sync.sh vps-barba:/tmp/cert-lojas-sync.sh
   ssh vps-barba 'install -o root -g root -m 0750 /tmp/cert-lojas-sync.sh /usr/local/sbin/barba-cert-lojas-sync.sh && rm /tmp/cert-lojas-sync.sh'
   ```

2. Criar `/etc/cron.d/barba-cert-lojas` (root:root, 0644) com exatamente:

   ```text
   # Barba & Cabelo: roteador de certificado para loja nova (P-27).
   # Guia: docs/implantacao-certificado-loja-2026-10-13.md. Saída no syslog (tag barba-cert-lojas).
   SHELL=/bin/bash
   PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
   */10 * * * * root /usr/local/sbin/barba-cert-lojas-sync.sh --aplicar --sem-conferir 2>&1 | /usr/bin/logger -t barba-cert-lojas
   ```

3. Conferir depois de 10 minutos: `journalctl -t barba-cert-lojas --since '-15 min'` deve mostrar "Nada a acrescentar…".

Detalhes da proposta:

- **A cada 10 minutos:** uma loja nova ganha certificado em até ~10 min, e cada rodada sem mudança só faz uma consulta ao banco e lê um arquivo pequeno.
- `--sem-conferir` evita consultas TLS a cada rodada; a conferência continua disponível com `scripts/cert-loja.sh`.
- **Para desligar:** apagar `/etc/cron.d/barba-cert-lojas` (o cron relê a pasta sozinho). As cópias `/root/beauty-shop-certs.yaml.bak-*` se acumulam só quando algo é gravado (uma por loja nova).
- **Ao atualizar o script no repositório,** repetir o passo 1 (o cron usa a cópia instalada, não o repositório).
- **Riscos a pesar:** o cadastro de loja é aberto (`/cadastrar`), então cada loja nova gera um pedido ao Let's Encrypt. O limite do Let's Encrypt é de 50 certificados novos por semana por domínio registrado (`contheiner.digital`, compartilhado com os outros serviços desse domínio); muitos cadastros falsos poderiam esgotar a cota da semana. Se isso preocupar, a alternativa é rodar a cada hora ou manter o passo manual. Lojas suspensas continuam com roteador (o script nunca remove).
- **Alternativa mais robusta, mais trabalhosa:** um certificado curinga `*.beauty.contheiner.digital` pelo desafio DNS da Cloudflare (precisa de um token de API da Cloudflare no Traefik e de mudar a configuração do proxy do Coolify). Elimina o passo por loja, mas mexe em credencial e no proxy: fica para decisão do dono.
