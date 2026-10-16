# Certificado do subdomínio de loja nova (P-27)

Escrito em 13/10/2026; seção 6 atualizada em 15/10/2026. Trata a pendência P-27 de [guia/pendencias.md](guia/pendencias.md): toda loja nova precisa de um roteador próprio no Traefik para ganhar certificado em `<slug>.beauty.contheiner.digital`.

## 1. Para que serve

- O DNS curinga `*.beauty` já leva qualquer subdomínio à VPS, e o roteador curinga (`wildcard-beauty.yaml`, `HostRegexp`) já leva o pedido à Hostinger. **Não é preciso mexer em DNS.**
- O roteador curinga não pede certificado por endereço: sem roteador próprio, o navegador recebe o "TRAEFIK DEFAULT CERT" e mostra a página de "conexão não segura".
- Desde 02/10/2026 cada loja ganha um roteador `Host(...)` em `/data/coolify/proxy/dynamic/beauty-shop-certs.yaml`. O Traefik do Coolify relê essa pasta sozinho e pede o certificado ao Let's Encrypt. Até 13/10/2026 o bloco era acrescentado à mão (passo 4 de [testes-reais-loja-teste.md](testes-reais-loja-teste.md)). Desde 15/10/2026 um timer da VPS roda o script abaixo a cada 10 minutos e acrescenta sozinho o bloco de loja nova (seção 6).

Os arquivos abaixo fazem isso de forma segura:

| Arquivo                                                                         | Onde roda                         | O que faz                                                                                                                                        |
| ------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [scripts/vps/cert-lojas-sync.sh](../scripts/vps/cert-lojas-sync.sh)             | na VPS                            | lê as lojas ativas no banco e acrescenta só os roteadores que faltam; a cópia que o timer usa fica em `/usr/local/sbin/barba-cert-lojas-sync.sh` |
| [scripts/cert-loja.sh](../scripts/cert-loja.sh)                                 | no Mac                            | manda o script acima à VPS por `ssh vps-barba` (nada fica gravado lá) e repassa as opções                                                        |
| [scripts/vps/barba-cert-lojas.timer](../scripts/vps/barba-cert-lojas.timer)     | na VPS, em `/etc/systemd/system/` | dispara o serviço abaixo a cada 10 minutos (seção 6)                                                                                             |
| [scripts/vps/barba-cert-lojas.service](../scripts/vps/barba-cert-lojas.service) | na VPS, em `/etc/systemd/system/` | roda a cópia instalada do script com `--aplicar --sem-conferir` (seção 6)                                                                        |
| [scripts/cert-loja-rotina.sh](../scripts/cert-loja-rotina.sh)                   | no Mac                            | instala, mostra o estado ou desliga o timer por `ssh vps-barba` (seção 6)                                                                        |

Garantias do script:

- lê as lojas com `select slug from public.barbershops where status = 'active'` (colunas conferidas no banco em 13/10/2026; o tipo `barbershop_status` só tem `active` e `suspended`);
- aceita só endereços no formato de slug (`a-z`, `0-9` e hífen); qualquer outro é ignorado com aviso, para nada estranho entrar no arquivo do proxy;
- acrescenta só o que falta, no mesmo formato dos blocos existentes (`entryPoints: https`, `service: hostinger-beauty@file`, `priority: 30`, `certResolver: letsencrypt`); rodar de novo não muda nada;
- não acrescenta endereço que não resolve no DNS e **nunca remove** roteador (os de lojas suspensas ou apagadas só aparecem num aviso);
- antes de gravar: cópia de segurança em `/root/beauty-shop-certs.yaml.bak-<data-hora>`, validação do YAML com `python3` + `yaml` (existe na VPS; sem ele, faz uma checagem simples) e troca atômica (arquivo temporário na mesma pasta + `mv`, mantendo dono e permissões). O temporário não termina em `.yaml`, então o Traefik não o lê;
- trava de execução (`flock`) para duas rodadas não se atropelarem;
- depois de gravar, consulta o certificado entregue em `127.0.0.1:443` (até 120 s) e diz se ainda é o "TRAEFIK DEFAULT CERT".

## 2. Como rodar

Desde 15/10/2026 o timer (seção 6) já roda o `--aplicar` sozinho a cada 10 minutos. À mão, o script serve para conferir os certificados (a simulação mostra o de cada loja; o timer não confere) ou para aplicar na hora, sem esperar a rodada. Se as duas execuções coincidirem, a trava (`flock`) faz a segunda sair sem mexer.

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

- Tudo: `cp -p /root/beauty-shop-certs.yaml.bak-<data-hora> /data/coolify/proxy/dynamic/beauty-shop-certs.yaml` (o próprio script imprime a linha exata). O Traefik relê sozinho. A cópia antiga não tem os blocos acrescentados depois dela; os das lojas que continuam ativas o timer (seção 6) devolve em até ~10 minutos.
- Uma loja só: apagar do arquivo as 8 linhas do bloco `beauty-shop-<slug>:`, com cópia de segurança antes (para as lojas de teste, é o passo 8.4 de [testes-reais-loja-teste.md](testes-reais-loja-teste.md)). Se a loja continuar ativa, o timer (seção 6) devolve o bloco em até ~10 minutos: tirar o bloco só depois de suspender ou apagar a loja.
- Tirar o roteador não apaga o certificado já emitido (fica no `acme.json` do Traefik, que **não** deve ser editado à mão); o endereço volta a receber o certificado padrão.

## 6. Rotina automática pelo timer do systemd (desde 15/10/2026)

Desde 15/10/2026 a VPS roda o script sozinha, a cada 10 minutos. Loja nova ganha o roteador, e com ele o certificado, sem ninguém precisar lembrar. Estado conferido por leitura na VPS na noite de 15/10, por volta das 20:45 de Brasília ([passagem-claude-2026-10-15.md](passagem-claude-2026-10-15.md), P-27).

- **Não existe `/etc/cron.d/barba-cert-lojas`, e não se deve criar.** A proposta anterior desta seção (um arquivo em `/etc/cron.d/`, escrita em 13/10) não foi a escolhida. O texto dela saiu daqui e fica no histórico do Git. O crontab do root também não foi tocado.
- **Não recriar o proxy do Coolify.** O Traefik relê a pasta sozinho. Recriar o proxy à mão tira as redes e derruba as APIs (P-68, queda de ~2,5 min em 13/10).

### 6.1 O que roda

| Peça na VPS                                             | No repositório                                                                  | O que faz                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/etc/systemd/system/barba-cert-lojas.timer`            | [scripts/vps/barba-cert-lojas.timer](../scripts/vps/barba-cert-lojas.timer)     | `OnCalendar=*:0/10`: nos minutos 00, 10, 20… de cada hora. `RandomizedDelaySec=30`: até 30 s de atraso aleatório. `Persistent=false`: rodada perdida (VPS desligada) não é recuperada; a seguinte cobre                        |
| `/etc/systemd/system/barba-cert-lojas.service`          | [scripts/vps/barba-cert-lojas.service](../scripts/vps/barba-cert-lojas.service) | a cada disparo, roda uma vez (`Type=oneshot`) `/usr/local/sbin/barba-cert-lojas-sync.sh --aplicar --sem-conferir`; registro com a etiqueta `barba-cert-lojas`; prioridade baixa (`Nice=10`), limite de 180 s, depois do Docker |
| `/usr/local/sbin/barba-cert-lojas-sync.sh` (root, 0750) | [scripts/vps/cert-lojas-sync.sh](../scripts/vps/cert-lojas-sync.sh)             | o mesmo script das seções 1 a 3, com as mesmas garantias: só acrescenta, nunca remove, faz cópia antes, valida, troca de uma vez e usa trava                                                                                   |

Como cada rodada se comporta:

- Sem loja nova: escreve "Nada a acrescentar: todas as lojas ativas já têm roteador." e termina com código 0. Custo: uma consulta ao banco e a leitura de um arquivo pequeno.
- Com loja nova: grava como na seção 3, com cópia `/root/beauty-shop-certs.yaml.bak-<data-hora>`. As cópias só se acumulam quando algo é gravado (uma por loja nova). A loja ganha roteador em até ~10 minutos; o certificado vem em seguida, quando o Traefik relê a pasta.
- `--sem-conferir`: o timer não consulta o certificado entregue. Para ver o certificado de cada loja, rodar a simulação pelo Mac (`scripts/cert-loja.sh`, seção 2).
- Endereço que ainda não resolve no DNS: só aviso no registro; a rodada seguinte tenta de novo.
- Outra execução em andamento (inclusive um `scripts/cert-loja.sh` à mão): sai sem mexer, com código 0.
- Erro, ou nenhuma loja ativa vinda do banco: código 1 e nada gravado.
- O nome do container do banco é fixo no script (`DB_CONTAINER`, padrão `supabase-db-z2dbb7dkyzhc8vjiywq34mhn`). Se o container mudar de nome, as rodadas falham com código 1 até ajustar o script e reinstalar (6.4).

### 6.2 Como foi instalado

Em 15/10/2026, do Mac, com `scripts/cert-loja-rotina.sh instalar` (horário exato não confirmado). O `cert-loja-rotina.sh` e as duas unidades entraram no Git no commit `dab56a7` (15/10, 20:50 de Brasília). O comando:

1. confere os três arquivos de `scripts/vps/` (o script e as duas unidades);
2. envia os três por `scp` para uma pasta temporária na VPS (`/tmp/barba-cert-lojas-<número>`, permissão 700);
3. confere a sintaxe do script (`bash -n`) e instala o script em `/usr/local/sbin/barba-cert-lojas-sync.sh` (root, 0750) e as duas unidades em `/etc/systemd/system/` (root, 0644);
4. confere as unidades (`systemd-analyze verify`) e roda `systemctl daemon-reload` e `systemctl enable --now barba-cert-lojas.timer`;
5. mostra a próxima rodada e apaga a pasta temporária.

Usa o acesso SSH `vps-barba` (para outro apelido, a variável `VPS_SSH`).

### 6.3 Como ver o estado

Do Mac:

```bash
cd "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo"
scripts/cert-loja-rotina.sh status   # sem argumento, faz o mesmo
```

Esperado com a rotina ligada: `Timer: enabled / active`, a próxima rodada, `Última rodada: success (código 0)` e até 20 linhas do registro da última hora. Sem o timer, a resposta é `Rotina não instalada.`

Direto na VPS: `journalctl -t barba-cert-lojas --since '-1 hour'` e `systemctl list-timers barba-cert-lojas.timer`.

**Última rodada conferida** (passagem de 15/10): as rodadas até 23:40 UTC (20:40 de Brasília) terminaram com sucesso, com a linha:

```text
Nada a acrescentar: todas as lojas ativas já têm roteador.
```

Lojas ativas que a rotina enxergava: `arena-barber`, `externabarbearia`, `loja-teste` e `loja-teste-b`. As quatro já têm roteador.

### 6.4 Quando reinstalar

Só quando `scripts/vps/cert-lojas-sync.sh` mudar no repositório. O timer usa a cópia de `/usr/local/sbin`, não o repositório. Para saber se mudou, comparar o SHA-256:

```bash
shasum -a 256 scripts/vps/cert-lojas-sync.sh                        # no Mac
ssh vps-barba 'sha256sum /usr/local/sbin/barba-cert-lojas-sync.sh'  # cópia da VPS
```

Na passagem de 15/10 os dois davam `6a5f2944f9f2a79c02dc30307953086817a95729a7656ab7b1ea00bd0bd73ddd`. Iguais: não reinstalar. Diferentes: `scripts/cert-loja-rotina.sh instalar`, que instala por cima e religa o timer. Vale o mesmo se uma das duas unidades mudar. Se as unidades instaladas são idênticas às do repositório: não confirmado (a passagem conferiu só o hash do script).

### 6.5 Como desligar

Do Mac: `scripts/cert-loja-rotina.sh desligar`. Desliga o timer (`systemctl disable --now`), apaga as duas unidades e roda `systemctl daemon-reload`. O script em `/usr/local/sbin/barba-cert-lojas-sync.sh` continua lá. Desligado, loja nova volta a depender do `scripts/cert-loja.sh --aplicar` à mão (seção 2). Para religar: `scripts/cert-loja-rotina.sh instalar`.

### 6.6 Riscos e alternativa

- **Limite do Let's Encrypt:** o cadastro de loja é aberto (`/cadastrar`), então cada loja nova gera um pedido ao Let's Encrypt. O limite do Let's Encrypt é de 50 certificados novos por semana por domínio registrado (`contheiner.digital`, compartilhado com os outros serviços desse domínio); muitos cadastros falsos poderiam esgotar a cota da semana. Se isso preocupar, a alternativa é rodar a cada hora (trocar o `OnCalendar` do `.timer` e reinstalar) ou desligar a rotina (6.5) e voltar ao passo manual. Lojas suspensas continuam com roteador (o script nunca remove).
- **Alternativa mais robusta, mais trabalhosa:** um certificado curinga `*.beauty.contheiner.digital` pelo desafio DNS da Cloudflare (precisa de um token de API da Cloudflare no Traefik e de mudar a configuração do proxy do Coolify). Elimina o passo por loja, mas mexe em credencial e no proxy: fica para decisão do dono.
- **Reinício da VPS:** o timer está habilitado com `WantedBy=timers.target`, então deve voltar sozinho depois de um reinício. É dedução: o reinício não foi testado (decisão de 15/10: não reiniciar a VPS para teste).
