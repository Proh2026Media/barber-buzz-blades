# Publicar a função `register-shop` da P-38 — 15/10/2026

> **Executado em 15/10/2026 às 22:54 (Brasília) = 16/10 01:54 UTC pelo Claude Code, com autorização do dono.** Hash antes `ac1bb223…31496`, depois `c7557315…249864`; backup `/root/functions-backup-register-shop-20261016-015418`; reinício só do container das funções às 01:54:25 UTC (`Up 10 seconds (healthy)`); `OPTIONS` 200, `{}` → 400 `invalid_whatsapp`, `whatsapp_opt_in: "sim"` → 400 `invalid_opt_in`; dois minutos depois, `healthy`, nenhuma linha de erro e 12 pedidos atendidos. Não repetir: o passo 2 reconhece que já foi feito.

**Quem executa:** o dono, no Terminal do Mac do projeto (ou um agente com terminal nesse Mac) · **Onde:** Mac → VPS por `ssh vps-barba` · **Escrito por:** Claude Code, a pedido do dono, em 15/10/2026 às 22:40 (Brasília) = 16/10 01:40 UTC.

O arquivo novo só existe neste Mac: a cópia do projeto na VPS (`/root/barber-buzz-blades`) está parada em 03/10 e a VPS não tem acesso ao GitHub. Por isso os comandos rodam no Mac e mandam o arquivo pela conexão `ssh vps-barba`, que já está configurada. Um agente que só tenha a VPS (sem este Mac) não consegue fazer esta tarefa sem receber o arquivo.

## Recado para colar

> Leia este documento inteiro antes de executar qualquer coisa. Rode os blocos na ordem, no Terminal do Mac, e confira o resultado esperado de cada passo. Se algo vier diferente, pare e relate o que viu. No fim, devolva o relatório pedido na última seção. Não faça nada fora do que está aqui.

## Objetivo

Trocar no servidor só a função `register-shop` pela versão da P-38: o cadastro da barbearia passa a perguntar "Quero receber avisos pelo WhatsApp" (já marcado) e a função grava a escolha da pessoa, em vez de gravar o aceite sempre ligado.

**Faça isto antes de o site ser publicado** com a tela nova. Se o site sair antes, quem desmarcar a caixa fica com os avisos ligados, porque a função antiga ignora a escolha. O dono (ou o Claude) só envia o site ao GitHub depois do relatório deste pacote.

## Regras de segurança (obrigatórias)

1. Faça a cópia de segurança do passo 3 antes de trocar o arquivo.
2. Reinicie **só** o container das funções (`docker restart`). **Nunca** use "Restart" nem "Redeploy" do serviço no painel do Coolify: eles recriam todos os containers do Supabase (banco, API e login caem juntos).
3. Não mexa em nenhuma outra função, nem na pasta `_shared` (no servidor ela difere do repositório só na formatação; não atualizar).
4. Não mexa em `.env`, variáveis do Coolify, proxy, crontab, nem no outro projeto da mesma VPS (`vv3jo93anprhqezhtu4ewcpl`, `supabase.proh.media`). Não reinicie a VPS.
5. Não crie loja real e não peça código de WhatsApp: os testes do passo 6 usam pedidos que a função recusa antes de gravar qualquer coisa.
6. Não imprima senhas, chaves nem tokens. A chave pública do app é lida do `.env` para uma variável, sem aparecer na tela; não cole o valor no relatório.
7. Se qualquer resultado vier diferente do esperado, **pare** e relate. Não tente consertar por conta própria (o caminho de volta está em "Como desfazer").
8. Não faça commit nem push no GitHub. Enviar ao GitHub publica o site; quem faz isso é o dono ou o Claude, depois do relatório.

## O que você precisa ter em mãos

| Item                       | Onde está                                                   | Observação                                                      |
| -------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| Terminal no Mac do projeto | pasta `/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo`       | o caminho tem espaço e `&`: use sempre entre aspas              |
| Acesso à VPS               | apelido `ssh vps-barba`, já configurado no Mac              | entra como `root`; sem senha para digitar                       |
| Chave pública do app       | `.env` do projeto, variável `VITE_SUPABASE_PUBLISHABLE_KEY` | é a mesma que vai no site; mesmo assim, não imprimir            |
| `<STAMP>`                  | sai no passo 3 (linha `BACKUP=...`)                         | anote: é o nome da cópia de segurança, usado em "Como desfazer" |

## Já feito — não refazer

- A tela nova (caixa "Quero receber avisos pelo WhatsApp") e o código da função estão no repositório, ainda não publicados (15/10, Claude Code). Tipos, testes e revisão do código passaram.
- Conferido pelo Claude, só lendo, em 15/10 às 22:35 (Brasília): a função no servidor é a versão de 03/10, hash `ac1bb223f61d3a079647c39114160b463d04a29fa5ef1ea1d5228a7486d31496` (25.306 bytes), idêntica à do commit `08732f5`. A diferença para a nova é só a P-38.
- O container das funções estava `Up (healthy)` em 15/10 às ~21:15 (Brasília).
- P-67 (`PLATFORM_BASE_HOST`) e P-27 (timer do certificado) já estão aplicados: não mexer.
- **Não confirmado:** se o gateway exige a chave `apikey` para chamar a função sem login. Os testes do passo 6 já mandam a chave.

## Passo a passo

### Passo 0 — Lugar certo e arquivo certo (no Mac)

```bash
cd "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo"
shasum -a 256 supabase/functions/register-shop/index.ts
wc -c < supabase/functions/register-shop/index.ts
```

Esperado: `c7557315afade5acd024f42fb2417c1b21fb2a49bd4e8a2ae0f33c5356249864  supabase/functions/register-shop/index.ts` e `26150`. Se o hash for outro, o arquivo mudou depois deste pacote: **pare** e relate.

### Passo 1 — Lugar certo na VPS (só leitura)

```bash
ssh vps-barba 'bash -s' <<'EOF'
hostname
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions | head -1)
VOL=$(docker inspect "$FN" --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}')
echo "FN=$FN"
echo "VOL=$VOL"
docker ps --filter "name=$FN" --format '{{.Status}}'
EOF
```

Esperado: `FN=supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn`, `VOL=/data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn/volumes/functions` e um estado `Up ... (healthy)`. Se `FN` ou `VOL` vierem vazios ou diferentes: **pare** e relate.

### Passo 2 — Diagnóstico: a função já foi trocada? (só leitura)

```bash
ssh vps-barba 'sha256sum /data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn/volumes/functions/register-shop/index.ts'
```

Esperado:

- `ac1bb223f61d3a079647c39114160b463d04a29fa5ef1ea1d5228a7486d31496` → versão antiga: siga para o passo 3.
- `c7557315afade5acd024f42fb2417c1b21fb2a49bd4e8a2ae0f33c5356249864` → já foi trocada: **não repita** os passos 3 e 4; vá direto ao passo 6 e relate.
- Qualquer outro valor → alguém mudou a função: **pare** e relate.

### Passo 3 — Cópia de segurança e troca do arquivo

```bash
cd "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo"
ssh vps-barba 'cat > /tmp/register-shop-p38.ts' < supabase/functions/register-shop/index.ts
ssh vps-barba 'bash -s' <<'EOF'
set -eu
NOVO=c7557315afade5acd024f42fb2417c1b21fb2a49bd4e8a2ae0f33c5356249864
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions | head -1)
VOL=$(docker inspect "$FN" --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}')
[ -n "$VOL" ] || { echo "PARE: pasta das funções não encontrada"; exit 1; }
[ "$(sha256sum /tmp/register-shop-p38.ts | cut -d' ' -f1)" = "$NOVO" ] || { echo "PARE: o arquivo enviado não confere"; exit 1; }
STAMP=$(date -u +%Y%m%d-%H%M%S)
B="/root/functions-backup-register-shop-$STAMP"
mkdir -p "$B"
cp -a "$VOL/register-shop/." "$B/"
install -o root -g root -m 0644 /tmp/register-shop-p38.ts "$VOL/register-shop/index.ts"
mv /tmp/register-shop-p38.ts "$B/index.ts.p38-novo"
echo "BACKUP=$B"
ls -l "$B/"
sha256sum "$VOL/register-shop/index.ts"
ls -l "$VOL/register-shop/"
EOF
```

Esperado:

- `BACKUP=/root/functions-backup-register-shop-<STAMP>` (anote o `<STAMP>`).
- No backup: `index.ts` com 25306 bytes (a versão antiga) e `index.ts.p38-novo` com 26150.
- Hash da função no lugar: `c7557315afade5acd024f42fb2417c1b21fb2a49bd4e8a2ae0f33c5356249864`.
- `index.ts` da função com dono `root` e permissão `-rw-r--r--`.

Se aparecer `PARE:` ou qualquer erro, nada foi trocado ou a troca ficou pela metade: **pare** e relate (não reinicie o container).

### Passo 4 — Ensaio

Não se aplica: as funções do servidor não têm ambiente de teste. A segurança vem do passo 0 (arquivo idêntico ao revisado) e da volta rápida em "Como desfazer".

### Passo 5 — Reiniciar só o container das funções

Todas as funções ficam fora por alguns segundos (inclusive o envio de WhatsApp, que roda a cada minuto e se recupera sozinho).

```bash
ssh vps-barba 'bash -s' <<'EOF'
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions | head -1)
date -u '+reinicio: %Y-%m-%d %H:%M:%S UTC'
docker restart "$FN"
sleep 10
docker ps --filter "name=$FN" --format '{{.Names}} {{.Status}}'
docker logs --since 1m "$FN" 2>&1 | tail -30
EOF
```

Esperado: o nome do container e `Up` com alguns segundos (pode aparecer `health: starting`), e nenhum erro de inicialização ou de compilação nas últimas linhas. Se o container não subir em 1 minuto, ou aparecer erro mencionando `register-shop`: vá para "Como desfazer" e relate.

### Passo 6 — Conferir pelo endereço público (no Mac)

```bash
cd "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo"
API=https://supabase-barbearia.proh.media
ANON=$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2- | tr -d '"')
curl -s -o /dev/null -w 'OPTIONS: %{http_code}\n' -X OPTIONS "$API/functions/v1/register-shop" -H 'Origin: https://beauty.contheiner.digital' -H 'Access-Control-Request-Method: POST'
curl -s -w '\nHTTP %{http_code}\n' -X POST "$API/functions/v1/register-shop" -H 'Content-Type: application/json' -H "apikey: $ANON" -d '{}'
curl -s -w '\nHTTP %{http_code}\n' -X POST "$API/functions/v1/register-shop" -H 'Content-Type: application/json' -H "apikey: $ANON" -d '{"action":"register","whatsapp_opt_in":"sim"}'
```

Esperado:

1. `OPTIONS: 200` (ou `204`).
2. `{"error":"Informe um WhatsApp válido com DDD","error_code":"invalid_whatsapp"}` e `HTTP 400`. Esse pedido não manda WhatsApp (não tem número).
3. `{"error":"Escolha se quer receber avisos pelo WhatsApp.","error_code":"invalid_opt_in"}` e `HTTP 400`. Esse pedido não grava nada: a função recusa antes de olhar o cadastro.

Se o 3 responder `"error_code":"verification_expired"`, a versão antiga ainda está rodando: **pare** e relate. Se vier `401`, relate a resposta (o gateway pode estar exigindo outra coisa).

### Passo 7 — Dois minutos depois: as outras funções seguem bem

```bash
ssh vps-barba 'bash -s' <<'EOF'
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions | head -1)
sleep 120
docker ps --filter "name=$FN" --format '{{.Status}}'
docker logs --since 3m "$FN" 2>&1 | grep -iE 'error|exception' | tail -15
echo "fim da conferencia"
EOF
```

Esperado: `Up ... (healthy)` e nenhuma linha com erro antes de `fim da conferencia`. Se aparecerem erros novos, copie-os (sem segredos) e relate.

## Como saber que deu certo

- Passo 2 ou 3 mostrou o hash novo `c7557315…249864` no lugar da função.
- Passo 5: container `Up` e sem erro de inicialização.
- Passo 6: as três respostas exatamente como esperado (principalmente a terceira, `invalid_opt_in`).
- Passo 7: container `healthy` e sem erros nos últimos 3 minutos.

## Como desfazer

Use o `<STAMP>` anotado no passo 3. Volta a função de 03/10 e reinicia só o container das funções:

```bash
ssh vps-barba 'bash -s' <<'EOF'
B=/root/functions-backup-register-shop-<STAMP>
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions | head -1)
VOL=$(docker inspect "$FN" --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}')
install -o root -g root -m 0644 "$B/index.ts" "$VOL/register-shop/index.ts"
sha256sum "$VOL/register-shop/index.ts"
docker restart "$FN"
sleep 10
docker ps --filter "name=$FN" --format '{{.Names}} {{.Status}}'
EOF
```

Esperado: hash `ac1bb223f61d3a079647c39114160b463d04a29fa5ef1ea1d5228a7486d31496` e o container `Up`. Depois de desfazer, o site **não** deve ser publicado com a tela nova até a função ser corrigida.

## Fora do escopo

- Publicar o site (enviar ao GitHub): fica com o dono ou o Claude, depois deste relatório.
- Qualquer outra função, a pasta `_shared`, migrations, banco, `.env`, Coolify, proxy, crontab e o outro projeto da VPS.
- Testar um cadastro de verdade (cria loja e conta) e pedir código de WhatsApp: ficam para os testes do dono (P-42).

## Relatório para devolver

Copie e devolva ao dono, sem chaves nem senhas:

- data e hora de início e de fim (Brasília e UTC);
- saída do passo 0 (hash e tamanho);
- saída do passo 1 (`FN`, `VOL`, estado);
- saída do passo 2 (hash antes);
- saída completa do passo 3 (linha `BACKUP=...`, listas e hash depois);
- saída do passo 5 (horário do reinício, estado e as últimas linhas do log);
- as três respostas do passo 6, exatamente como apareceram;
- saída do passo 7;
- qualquer diferença do esperado, com o texto exato do erro, e se "Como desfazer" foi usado.
