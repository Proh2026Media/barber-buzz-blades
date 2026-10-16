# Aplicar no banco: login Google no app instalado e agendamento pelo painel — 16/10/2026

**Quem executa:** o dono, no Terminal do Mac do projeto (ou um agente com terminal nesse Mac) · **Onde:** Mac → VPS por `ssh vps-barba` (banco no container `supabase-db-z2dbb7dkyzhc8vjiywq34mhn`) · **Escrito por:** Claude Code, a pedido do dono, em 16/10/2026 às 01:50 (Brasília) = 04:50 UTC; revisado às 02:40 (Brasília) = 05:40 UTC, depois da revisão de código, e às 05:57 (Brasília) = 08:57 UTC, depois da revisão final (colunas protegidas, ficha amarrada à barbearia, indicadores; hashes, ensaio e listas atualizados).

Os arquivos novos só existem no repositório: a cópia do projeto na VPS (`/root/barber-buzz-blades`) está parada em 03/10 e a VPS não tem acesso ao GitHub. Por isso os comandos rodam no Mac e mandam os arquivos pela conexão `ssh vps-barba`, que já está configurada.

## Recado para colar

> Leia este documento inteiro antes de executar qualquer coisa. Rode os blocos na ordem, no Terminal do Mac, e confira o resultado esperado de cada passo. Se algo vier diferente, pare e relate o que viu. No fim, devolva o relatório pedido na última seção. Não faça nada fora do que está aqui.

## Objetivo

Aplicar no banco de produção duas migrations e, se der tudo certo, publicar uma função:

1. `20261016120000_retorno_google_app_instalado.sql` — conserta o login com Google no app instalado na tela de início (principalmente iPhone). Hoje a janela do Google fica "presa" por cima do app e, ao fechá-la, a pessoa volta à tela de entrar, em laço. A migration cria uma tabela temporária e duas funções para a janela entregar ao app um código de uso único. Só entra código de login de verdade, emitido há pouco pelo próprio Auth (a função consulta `auth.flow_state`, só lendo): ninguém consegue lotar a tabela com códigos inventados.
2. `20261016130000_agendamento_pelo_painel.sql` — o barbeiro marca horário para o cliente pelo painel (nome e WhatsApp), com apelido do cliente, cliente sem cadastro ("cliente do balcão") recebendo os mesmos avisos por WhatsApp, e o selo de cliente recorrente na agenda. Também cria os horários para a equipe sem a antecedência mínima do cliente (`get_team_slots`), um gatilho em `memberships` que liga a ficha do balcão à conta quando o cliente entra na barbearia pelo app e um gatilho em `appointments` que deixa só as funções do banco gravarem a ficha do balcão e quem marcou. Recria 11 funções existentes (avisos, agenda da equipe, diretório e ficha do cliente, confirmação do WhatsApp, indicadores, saída da equipe e carteira do profissional) para contarem e nomearem o cliente do balcão.
3. **Parte B (opcional, recomendada):** publicar a função `google-calendar-dispatch` nova, para a cópia na Agenda Google mostrar o nome e o apelido do cliente do balcão (sem ela, aparece "Cliente").

O site com as telas novas já foi publicado. Ele funciona antes e depois desta aplicação: enquanto o banco não tem as funções novas, o botão "Agendar" do painel não aparece e o login com Google no app instalado segue o caminho antigo. Depois da aplicação, tudo aparece sozinho, sem publicar de novo.

## Regras de segurança (obrigatórias)

1. Faça a cópia de segurança do banco (passo 3) antes de aplicar qualquer coisa. Sem backup com tamanho maior que zero, não siga.
2. Rode o ensaio (passo 4) **fora do horário de movimento** (antes das 8h ou depois das 21h, horário de Brasília): durante cada ensaio a tabela de atendimentos fica travada por alguns segundos.
3. Aplique cada migration numa transação só (`psql -1`) e na ordem do passo 5. Se uma falhar, **pare** (ela volta sozinha) e relate. Não tente consertar a migration no servidor.
4. **Nunca** use "Restart" nem "Redeploy" do serviço no painel do Coolify (eles recriam todos os containers do Supabase). Na parte B, reinicie **só** o container das funções.
5. Não mexa em `.env`, variáveis do Coolify, proxy, crontab, DNS, no `supabase-teste`, nem no outro projeto da mesma VPS (`vv3jo93anprhqezhtu4ewcpl`, `supabase.proh.media`). Não reinicie a VPS.
6. **Nunca** rode um arquivo de `supabase/tests/` fora de `BEGIN … ROLLBACK` (em 03/10/2026 isso deixou dados de teste em produção). Os blocos abaixo já fazem isso.
7. Não imprima senhas, chaves nem tokens. A chave pública do app é lida do `.env` para uma variável, sem aparecer na tela; não cole o valor no relatório.
8. Se qualquer resultado vier diferente do esperado, **pare** e relate. Não improvise.
9. Não faça commit nem push no GitHub (enviar publica o site). O registro é feito depois, pelo Claude ou pelo dono.

## O que você precisa ter em mãos

| Item                       | Onde está                                                   | Observação                                                        |
| -------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Terminal no Mac do projeto | pasta `/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo`       | o caminho tem espaço e `&`: use sempre entre aspas                |
| Acesso à VPS               | apelido `ssh vps-barba`, já configurado no Mac              | entra como `root`; sem senha para digitar                         |
| Chave pública do app       | `.env` do projeto, variável `VITE_SUPABASE_PUBLISHABLE_KEY` | é a mesma que vai no site; mesmo assim, não imprimir              |
| Nome do backup             | sai no passo 3 (linha `BACKUP=...`)                         | anote: é o que se usa para voltar o banco inteiro, se for preciso |
| `<BACKUP_FN>`              | sai no passo B2 (linha `BACKUP_FN=...`), só na parte B      | anote: é o que se usa para voltar a função                        |

## Já feito — não refazer

- Migrations, testes e roteiro de volta escritos e conferidos pelo Claude em 16/10, numa cópia local do banco montada com as 94 migrations de produção (imagem `supabase/postgres:15.8.1.085`):
  - teste novo `retorno_google_app_instalado.sql`: 12 PASS; teste novo `agendamento_pelo_painel.sql`: 62 PASS;
  - bateria inteira (42 arquivos) com as duas migrations na frente: 1.099 PASS, 0 FAIL (05:50 de Brasília, depois da revisão final);
  - as duas migrations podem ser aplicadas duas vezes sem erro;
  - o roteiro de volta `supabase/manutencao/2026-10-16_desfazer_agendamento_painel.sql` remove tudo o que elas criam e devolve o banco exatamente ao estado de antes: retrato de 638 itens (definição e permissões de todas as funções de `public`, gatilhos, colunas de `appointments`, tabelas e políticas) igual antes e depois;
  - conferido na VPS, só lendo (16/10, 02:20 de Brasília): `auth.flow_state` existe, com as colunas `auth_code`, `created_at` e `auth_code_issued_at`, índice pelo código, e o usuário `postgres` pode ler, gravar e apagar nela (o teste da ponte cria dois códigos fictícios ali, desfeitos no `ROLLBACK`).
- A última migration aplicada em produção é a nº 94, `20261014120000_registro_login_ip` (13/10, 18:59 de Brasília). **Não confirmado** daqui: o passo 2 confere.
- O site já está publicado com as telas novas (o mesmo envio ao GitHub que trouxe este arquivo).

## Passo a passo

### Passo 0 — Lugar certo e arquivos certos (no Mac)

```bash
cd "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo"
git log -1 --format='%h %ad %s' --date=format:'%d/%m %H:%M'
shasum -a 256 supabase/migrations/20261016120000_retorno_google_app_instalado.sql \
  supabase/migrations/20261016130000_agendamento_pelo_painel.sql \
  supabase/tests/retorno_google_app_instalado.sql \
  supabase/tests/agendamento_pelo_painel.sql \
  supabase/manutencao/2026-10-16_desfazer_agendamento_painel.sql \
  supabase/functions/google-calendar-dispatch/index.ts
```

Esperado (os seis hashes, nesta ordem):

```text
543585a1e92077825ae4fea67c697ce17ade498a6120c205c9767cc444ae8ff6  …retorno_google_app_instalado.sql (migration)
164f34fe8b5ecc68426eea1867116011a4487f9bcf38ba8ddb615f9e4dc67ad2  …agendamento_pelo_painel.sql (migration)
b699d736e1131776c5c5ed0cb295ff12bfe2ab123abbce9159381522aa4b2d80  …retorno_google_app_instalado.sql (teste)
769ca91e4dc5a9ec88b7abda89e1ce45309055eafded572065dddc7a528dd1e0  …agendamento_pelo_painel.sql (teste)
b66d407ba2fb428446b5c1c74e3d43b448a9e5f65ea40ad565aa9f57fdac67d4  …2026-10-16_desfazer_agendamento_painel.sql
9813ec596593e9ad821b18d3354e551537b325395f54568cc6147b2a24f678a5  …google-calendar-dispatch/index.ts
```

Se algum hash for outro, o arquivo mudou depois deste pacote: **pare** e relate.

### Passo 1 — Lugar certo na VPS (só leitura)

```bash
ssh vps-barba 'bash -s' <<'EOF'
hostname
DB=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -E '^supabase-db-' | head -1)
echo "DB=$DB"
docker ps --filter "name=$DB" --format '{{.Status}}'
df -h /root | tail -1
EOF
```

Esperado: `DB=supabase-db-z2dbb7dkyzhc8vjiywq34mhn`, um estado `Up ... (healthy)` e espaço livre de pelo menos alguns GB em `/root`. Se `DB` vier vazio ou diferente: **pare** e relate.

### Passo 2 — Diagnóstico: já foi aplicado? (só leitura)

```bash
ssh vps-barba 'bash -s' <<'EOF'
DB=supabase-db-z2dbb7dkyzhc8vjiywq34mhn
docker exec -i "$DB" psql -U postgres -d postgres -X -At <<'SQL'
select 'nº 94 aplicada: ' || (to_regclass('public.login_access_log') is not null);
select 'tabela da ponte do Google: ' || (to_regclass('public.oauth_code_relay') is not null);
select 'tabela de clientes da barbearia: ' || (to_regclass('public.shop_clients') is not null);
select 'coluna appointments.shop_client_id: ' || exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'appointments' and column_name = 'shop_client_id');
select 'funções novas: ' || count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('oauth_relay_put','oauth_relay_take','find_shop_client',
  'book_for_client','set_client_nickname','update_shop_client','get_shop_client','get_team_slots',
  'link_shop_clients_to_profile','link_shop_clients_on_customer_join','shop_has_customer',
  'shop_client_visible','shop_client_clean_nickname','appointments_guard_client_columns');
SQL
EOF
```

Esperado:

- `nº 94 aplicada: true`, `tabela da ponte do Google: false`, `tabela de clientes da barbearia: false`, `coluna appointments.shop_client_id: false`, `funções novas: 0` → nada aplicado ainda: siga para o passo 3.
- Tudo `true` e `funções novas: 14` → já foi aplicado: **não repita**; vá direto ao passo 6 e relate.
- `nº 94 aplicada: false`, ou uma mistura (algumas `true`, outras `false`) → **pare** e relate.

### Passo 3 — Cópia de segurança do banco

```bash
ssh vps-barba 'bash -s' <<'EOF'
set -eu
DB=supabase-db-z2dbb7dkyzhc8vjiywq34mhn
STAMP=$(date -u +%Y%m%d-%H%M%S)
B="/root/backup-barba-cabelo-$STAMP.dump"
docker exec "$DB" pg_dump -U postgres -d postgres -Fc > "$B"
echo "BACKUP=$B"
ls -lh "$B"
EOF
```

Esperado: `BACKUP=/root/backup-barba-cabelo-AAAAMMDD-HHMMSS.dump` (data e hora UTC no nome) e um arquivo com dezenas de MB (o de 13/10 tinha esse porte). Se o tamanho for 0 ou aparecer erro: **pare** e relate (nada foi mudado).

### Passo 4 — Ensaio (tudo desfeito no fim)

Manda os arquivos para a VPS e roda cada teste numa transação própria, com as duas migrations na frente e `ROLLBACK` no fim: nada fica gravado (nem os dois códigos de login fictícios que o teste da ponte cria em `auth.flow_state`). Dois testes rodam depois de `booking_reliability.sql` na mesma transação, como sempre (eles usam a barbearia de teste que ele cria). Rode fora do horário de movimento.

```bash
cd "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo"
ssh vps-barba 'mkdir -p /tmp/barba-20261016'
for f in supabase/migrations/20261016120000_retorno_google_app_instalado.sql \
  supabase/migrations/20261016130000_agendamento_pelo_painel.sql \
  supabase/manutencao/2026-10-16_desfazer_agendamento_painel.sql \
  supabase/tests/retorno_google_app_instalado.sql supabase/tests/agendamento_pelo_painel.sql \
  supabase/tests/decisoes_whatsapp_fuso.sql supabase/tests/convite_boas_vindas_papeis.sql \
  supabase/tests/client_directory.sql supabase/tests/partner_tools.sql \
  supabase/tests/ajustes_finais.sql supabase/tests/cadastro_aceite.sql \
  supabase/tests/saida_equipe_reservas.sql supabase/tests/shop_team_governance.sql \
  supabase/tests/booking_reliability.sql supabase/tests/aggregate_insights.sql \
  supabase/tests/customer_insights.sql; do
  ssh vps-barba "cat > /tmp/barba-20261016/$(basename "$f")" < "$f"
done
ssh vps-barba 'bash -s' <<'EOF'
cd /tmp/barba-20261016
DB=supabase-db-z2dbb7dkyzhc8vjiywq34mhn
SEP="reset role; select set_config('request.jwt.claim.sub','',true);"
roda() {
  nome=$1; shift
  OUT=$( { echo 'BEGIN;'; cat 20261016120000_retorno_google_app_instalado.sql \
      20261016130000_agendamento_pelo_painel.sql; for f in "$@"; do cat "$f.sql"; echo; echo "$SEP"; done; \
      echo 'ROLLBACK;'; } | docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 2>&1 )
  echo "$nome: $(echo "$OUT" | grep -c 'PASS') PASS, $(echo "$OUT" | grep -cE 'FAIL|ERROR') FAIL/ERROR, fim: $(echo "$OUT" | tail -1)"
  echo "$OUT" | grep -E 'FAIL|ERROR' | head -3
}
for t in retorno_google_app_instalado agendamento_pelo_painel decisoes_whatsapp_fuso \
  convite_boas_vindas_papeis client_directory partner_tools ajustes_finais cadastro_aceite \
  saida_equipe_reservas shop_team_governance; do
  roda "$t" "$t"
done
for t in aggregate_insights customer_insights; do
  roda "$t" booking_reliability "$t"
done
EOF
```

Esperado (doze linhas, todas com `0 FAIL/ERROR` e `fim: ROLLBACK`):

| Teste                          | PASS esperados |
| ------------------------------ | -------------- |
| `retorno_google_app_instalado` | 12             |
| `agendamento_pelo_painel`      | 62             |
| `decisoes_whatsapp_fuso`       | 43             |
| `convite_boas_vindas_papeis`   | 30             |
| `client_directory`             | 8              |
| `partner_tools`                | 13             |
| `ajustes_finais`               | 25             |
| `cadastro_aceite`              | 27             |
| `saida_equipe_reservas`        | 29             |
| `shop_team_governance`         | 14             |
| `aggregate_insights`           | 36             |
| `customer_insights`            | 52             |

Os dez últimos são testes antigos das funções que a migration recria (avisos, agenda da equipe, diretório e ficha do cliente, confirmação do WhatsApp, indicadores, saída da equipe e carteira do profissional); os dois de indicadores contam também os PASS de `booking_reliability.sql`, que roda antes deles. Qualquer `FAIL`, `ERROR`, número diferente ou `fim:` diferente de `ROLLBACK` → **pare** e relate a linha e as três linhas de erro que aparecem logo abaixo dela. Não siga para o passo 5.

### Passo 5 — Aplicar (uma migration por vez, na ordem)

```bash
ssh vps-barba 'bash -s' <<'EOF'
cd /tmp/barba-20261016
DB=supabase-db-z2dbb7dkyzhc8vjiywq34mhn
date -u '+inicio: %Y-%m-%d %H:%M:%S UTC'
for m in 20261016120000_retorno_google_app_instalado 20261016130000_agendamento_pelo_painel; do
  if docker exec -i "$DB" psql -U postgres -d postgres -X -q -1 -v ON_ERROR_STOP=1 < "$m.sql"; then
    echo "$m: aplicada"
  else
    echo "$m: FALHOU (desfeita sozinha). PARE."
    exit 1
  fi
done
docker exec -i "$DB" psql -U postgres -d postgres -X -q -c "notify pgrst, 'reload schema';"
date -u '+fim: %Y-%m-%d %H:%M:%S UTC'
EOF
```

Esperado: `…_retorno_google_app_instalado: aplicada` e `…_agendamento_pelo_painel: aplicada` (avisos `NOTICE` são normais). Se aparecer `FALHOU`: **pare** e relate o erro; a migration que falhou não deixou nada (transação única). Se a primeira passou e a segunda falhou, a primeira fica (ela é independente e segura).

### Passo 6 — Conferir

No banco (só leitura):

```bash
ssh vps-barba 'bash -s' <<'EOF'
DB=supabase-db-z2dbb7dkyzhc8vjiywq34mhn
docker exec -i "$DB" psql -U postgres -d postgres -X -At <<'SQL'
select 'funções novas: ' || count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('oauth_relay_put','oauth_relay_take','find_shop_client',
  'book_for_client','set_client_nickname','update_shop_client','get_shop_client','get_team_slots',
  'link_shop_clients_to_profile','link_shop_clients_on_customer_join','shop_has_customer',
  'shop_client_visible','shop_client_clean_nickname','appointments_guard_client_columns');
select 'permissões: '
  || has_function_privilege('anon', 'public.oauth_relay_take(uuid)', 'execute') || ' '
  || has_function_privilege('anon', 'public.find_shop_client(uuid, text)', 'execute') || ' '
  || has_function_privilege('authenticated', 'public.book_for_client(uuid, uuid, uuid, timestamptz, uuid, uuid, text, text, text, boolean)', 'execute') || ' '
  || has_function_privilege('authenticated', 'public.link_shop_clients_to_profile(uuid, text, uuid)', 'execute') || ' '
  || has_table_privilege('anon', 'public.shop_clients', 'select') || ' '
  || has_table_privilege('authenticated', 'public.oauth_code_relay', 'select');
select 'clientes do balcão: ' || count(*) from public.shop_clients;
SQL
EOF
```

Esperado: `funções novas: 14`, `permissões: true false true false false false` e `clientes do balcão: 0`.

Pela API pública (no Mac). Não grava nada: pede o código de um id aleatório, que não existe:

```bash
cd "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo"
API=https://supabase-barbearia.proh.media
ANON=$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2- | tr -d '"')
ID=$(uuidgen | tr 'A-Z' 'a-z')
curl -s -w '\nHTTP %{http_code}\n' -X POST "$API/rest/v1/rpc/oauth_relay_take" \
  -H 'Content-Type: application/json' -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -d "{\"p_id\":\"$ID\"}"
```

Esperado: `null` e `HTTP 200`. Se vier `HTTP 404` com `PGRST202`, a API ainda não recarregou: rode de novo o `notify pgrst` do passo 5 (só a última linha `docker exec … notify …`), espere 10 segundos e repita. Se continuar, relate.

## Parte B (opcional, recomendada) — publicar `google-calendar-dispatch`

Faça só se o passo 6 deu certo. A função nova funciona com o banco novo e com o antigo.

### Passo B1 — Diagnóstico (só leitura)

```bash
ssh vps-barba 'bash -s' <<'EOF'
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions | head -1)
VOL=$(docker inspect "$FN" --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}')
echo "FN=$FN"
echo "VOL=$VOL"
docker ps --filter "name=$FN" --format '{{.Status}}'
sha256sum "$VOL/google-calendar-dispatch/index.ts"
EOF
```

Esperado: `FN=supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn`, `VOL=/data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn/volumes/functions`, `Up ... (healthy)` e um destes hashes:

- `f8640f20f434b1faaaede9b09020ed666563e0e53b824f21643ca4f2d563efe4` → versão anterior (a do repositório até 15/10): siga para o B2.
- `9813ec596593e9ad821b18d3354e551537b325395f54568cc6147b2a24f678a5` → já é a nova: não repita; relate.
- Qualquer outro → a função no servidor é diferente da do repositório: **pare** a parte B e relate (o banco já está pronto; a parte B pode ficar para depois).

### Passo B2 — Cópia de segurança e troca do arquivo

```bash
cd "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo"
ssh vps-barba 'cat > /tmp/google-calendar-dispatch-20261016.ts' < supabase/functions/google-calendar-dispatch/index.ts
ssh vps-barba 'bash -s' <<'EOF'
set -eu
NOVO=9813ec596593e9ad821b18d3354e551537b325395f54568cc6147b2a24f678a5
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions | head -1)
VOL=$(docker inspect "$FN" --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}')
[ -n "$VOL" ] || { echo "PARE: pasta das funções não encontrada"; exit 1; }
[ "$(sha256sum /tmp/google-calendar-dispatch-20261016.ts | cut -d' ' -f1)" = "$NOVO" ] || { echo "PARE: o arquivo enviado não confere"; exit 1; }
STAMP=$(date -u +%Y%m%d-%H%M%S)
B="/root/functions-backup-google-calendar-dispatch-$STAMP"
mkdir -p "$B"
cp -a "$VOL/google-calendar-dispatch/." "$B/"
install -o root -g root -m 0644 /tmp/google-calendar-dispatch-20261016.ts "$VOL/google-calendar-dispatch/index.ts"
mv /tmp/google-calendar-dispatch-20261016.ts "$B/index.ts.novo"
echo "BACKUP_FN=$B"
ls -l "$B/"
sha256sum "$VOL/google-calendar-dispatch/index.ts"
EOF
```

Esperado: `BACKUP_FN=/root/functions-backup-google-calendar-dispatch-AAAAMMDD-HHMMSS` (anote), o `index.ts` antigo e o `index.ts.novo` na pasta do backup, e o hash `9813ec59…f678a5` no lugar da função. Se aparecer `PARE:` ou erro: **pare** e relate (não reinicie nada).

### Passo B3 — Reiniciar só o container das funções e conferir

Todas as funções ficam fora por alguns segundos (o envio de WhatsApp roda a cada minuto e se recupera sozinho).

```bash
ssh vps-barba 'bash -s' <<'EOF'
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions | head -1)
date -u '+reinicio: %Y-%m-%d %H:%M:%S UTC'
docker restart "$FN"
sleep 10
docker ps --filter "name=$FN" --format '{{.Names}} {{.Status}}'
docker logs --since 1m "$FN" 2>&1 | tail -20
sleep 120
docker ps --filter "name=$FN" --format '{{.Status}}'
docker logs --since 3m "$FN" 2>&1 | grep -iE 'error|exception' | tail -15
echo "fim da conferencia"
EOF
```

Esperado: o container `Up` (pode aparecer `health: starting` no começo), nenhum erro de inicialização nas últimas linhas, e dois minutos depois `Up ... (healthy)` sem linhas de erro antes de `fim da conferencia`. Se o container não subir em 1 minuto ou aparecer erro citando `google-calendar-dispatch`: vá para "Como desfazer" (função) e relate.

## Como saber que deu certo

- Passo 4: doze linhas com `0 FAIL/ERROR`, `fim: ROLLBACK` e os números da tabela.
- Passo 5: as duas migrations `aplicada`.
- Passo 6: `funções novas: 14`, `permissões: true false true false false false`, `clientes do balcão: 0` e a API devolvendo `null` com `HTTP 200`.
- Na tela (o dono, depois, no celular): no painel da barbearia, a Agenda passa a mostrar o botão **Agendar** e o atalho **Agendar aqui** nos horários livres (pode precisar recarregar a página).
- Parte B: hash novo no lugar, container `healthy` e sem erros.

## Como desfazer

**Banco, sem perder o resto (preferido):** o roteiro de volta remove as funções, os gatilhos em `memberships` e em `appointments`, as duas tabelas novas e as duas colunas, e devolve as onze funções recriadas à versão de antes, com as mesmas permissões. Perde os apelidos e os clientes do balcão gravados depois da aplicação; os horários marcados para cliente do balcão continuam na agenda, sem nome. **Só com autorização do dono.** Antes, veja quantos existem:

```bash
ssh vps-barba 'docker exec -i supabase-db-z2dbb7dkyzhc8vjiywq34mhn psql -U postgres -d postgres -X -At -c "select count(*) from public.shop_clients; select count(*) from public.appointments where shop_client_id is not null;"'
```

Depois, para desfazer:

```bash
ssh vps-barba 'docker exec -i supabase-db-z2dbb7dkyzhc8vjiywq34mhn psql -U postgres -d postgres -X -q -1 -v ON_ERROR_STOP=1' < "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo/supabase/manutencao/2026-10-16_desfazer_agendamento_painel.sql"
```

Esperado: termina sem `ERROR`; o passo 2 volta a mostrar tudo `false` e `funções novas: 0`. O site continua funcionando (ele detecta que as funções sumiram).

**Banco inteiro (último recurso):** `pg_restore` do arquivo do passo 3 apaga tudo o que foi gravado depois dele (agendamentos, cadastros). **Só com autorização explícita do dono**, e com o procedimento do arquivo `docs/implantacao-2026-10-03.md` do repositório.

**Função da parte B:** volta a versão anterior e reinicia só o container das funções:

```bash
ssh vps-barba 'bash -s' <<'EOF'
B=<BACKUP_FN>
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions | head -1)
VOL=$(docker inspect "$FN" --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}')
install -o root -g root -m 0644 "$B/index.ts" "$VOL/google-calendar-dispatch/index.ts"
sha256sum "$VOL/google-calendar-dispatch/index.ts"
docker restart "$FN"
sleep 10
docker ps --filter "name=$FN" --format '{{.Names}} {{.Status}}'
EOF
```

Esperado: hash `f8640f20…f563efe4` e o container `Up`.

## Fora do escopo

- Publicar o site ou fazer commit/push: o site já foi publicado; o registro no repositório é do Claude ou do dono, depois do relatório.
- Qualquer outra migration, função, a pasta `_shared`, `.env`, Coolify, proxy, crontab, DNS e o outro projeto da VPS.
- Marcar horário de verdade, criar cliente ou mandar WhatsApp para testar: fica para o teste do dono no painel, depois da aplicação.
- Limpar a pasta `/tmp/barba-20261016` não é necessário (são só cópias dos arquivos do repositório).

## Relatório para devolver

Copie e devolva ao dono, sem chaves nem senhas:

- data e hora de início e de fim (Brasília e UTC);
- saída do passo 0 (commit e os seis hashes);
- saída dos passos 1 e 2;
- linha `BACKUP=...` e o tamanho do arquivo (passo 3);
- as doze linhas do passo 4, exatamente como apareceram (e as linhas de erro, se houver);
- saída do passo 5;
- saída do passo 6 (banco e API);
- se fez a parte B: saídas de B1, B2 (com `BACKUP_FN=...`) e B3;
- qualquer diferença do esperado, com o texto exato do erro, e se algum "Como desfazer" foi usado.
