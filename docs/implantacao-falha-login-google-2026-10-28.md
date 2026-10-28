# Implantação — aviso de falha no login Google (P-78, 28/10/2026)

**Preparado e testado localmente; ainda não aplicado na VPS.** A migration nº 98 acrescenta somente um canal temporário para a janela do Google avisar o app instalado quando o login for cancelado ou recusado. O site permanece compatível com as 97 migrations anteriores: sem a nº 98, conserva a espera atual até expirar. Não há Edge function, Restart/Redeploy ou alteração de conta, agendamento e regra de acesso.

## Publicação na Hostinger confirmada (P-99)

**Confirmada em 28/10/2026, 18:57:47 de Brasília:** a página pública `https://beauty.contheiner.digital/auth` passou a entregar `/assets/index-BP2IQdEN.js` (1.124.849 bytes), com a mensagem nova e os idiomas separados. O arquivo anterior tinha 1.878.319 bytes; redução de aproximadamente 40,1% nessa comparação pública. O nome/tamanho diferem da montagem local conforme ambiente.

Código no commit `34310f54800c21fe1cd6a4767f764ed5e24a0026`, confirmado no origin e no espelho. Fluxos concluídos: [aviso ao hub](https://github.com/Proh2026Media/barber-buzz-blades/actions/runs/40775651947) e [espelho](https://github.com/PROH-Media/hub-control/actions/runs/40775661283). Às 18:56 o site ainda servia o pacote anterior; nova consulta confirmou a atualização às 18:57. P-99 encerrada, sem mudança de configuração ou publicação manual.

**Não há ação adicional de Hostinger neste pacote.** A aplicação da migration nº 98 na VPS e os testes físicos abaixo continuam pendentes. A conferência foi por HTTP público; o painel da hospedagem não foi acessado.

## Arquivos e resultado local

Usar clone atualizado do `origin`, na raiz do projeto. Conferir com `sha256sum` no Linux (`shasum -a 256` no Mac):

```text
7039680f62cc4824d46c3d333400f83b12534a2f14541864726096011a7bf4e1  supabase/migrations/20261028190000_falha_login_google.sql
e959f8d95bb116115d8377a6a35e34c315c3dfcc415bf31ee396db551382889c  supabase/tests/falha_login_google.sql
5e5ad5c22dac18663180e30eb22b7fc0526a110cebc49fb8210f762d79736f67  supabase/manutencao/2026-10-28_desfazer_falha_login_google.sql
```

Conferido em PostgreSQL local descartável, imagem `supabase/postgres:15.8.1.085`: 18 PASS do teste novo e **1.139 PASS, 0 FAIL/ERROR** da bateria completa. Aplicação repetida e reversão conferidas dentro de transação desfeita. Cliente testado com respostas simuladas de falha, função ausente e rede indisponível. Ainda exige teste físico do PWA no iPhone.

## Preparação e backup

Executar somente na VPS correta, mantendo esta sessão. Não alterar `.env`, serviços, DNS, funções ou o outro Supabase. Nunca executar o teste fora de `BEGIN … ROLLBACK`: ele esvazia filas dentro da transação para simular o limite; executar fora do movimento, pois mantém bloqueios até terminar.

```bash
set -euo pipefail
P78_DB=supabase-db-z2dbb7dkyzhc8vjiywq34mhn
docker ps --filter "name=$P78_DB" --format '{{.Names}} {{.Status}}'
docker exec -i "$P78_DB" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 <<'SQL'
select to_regclass('public.oauth_code_relay') is not null,
       to_regprocedure('public.oauth_relay_take(uuid)') is not null;
select to_regclass('public.oauth_failure_relay') is not null;
SQL
```

Esperado: container indicado saudável; `t|t` e `f`. Se o último já for `t`, não reaplicar: conferir definições e registrar o estado. Qualquer diferença exige investigar antes de continuar.

```bash
P78_BACKUP="/root/backup-barba-p78-$(date -u +%Y%m%d-%H%M%S).dump"
docker exec "$P78_DB" pg_dump -U postgres -d postgres -Fc > "$P78_BACKUP"
test -s "$P78_BACKUP"
docker exec -i "$P78_DB" pg_restore --list < "$P78_BACKUP" > /dev/null
ls -lh "$P78_BACKUP"
```

Anotar caminho e tamanho. Só continuar com backup não vazio e catálogo legível.

## Ensaio sem persistir dados

```bash
P78_LOG=$(mktemp /tmp/barba-p78-ensaio.XXXXXX)
{
  printf 'BEGIN;\n'
  cat supabase/migrations/20261028190000_falha_login_google.sql
  printf '\n'
  cat supabase/tests/falha_login_google.sql
  printf '\nROLLBACK;\n'
} | docker exec -i "$P78_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 > "$P78_LOG" 2>&1
grep -c 'PASS:' "$P78_LOG"
tail -1 "$P78_LOG"
if grep -E 'FAIL|ERROR|FATAL' "$P78_LOG"; then exit 1; fi
```

Esperado: **18**, última linha **ROLLBACK**, sem FAIL/ERROR/FATAL. Parar se houver diferença; não corrigir direto no servidor.

## Aplicar e conferir

```bash
docker exec -i "$P78_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 \
  < supabase/migrations/20261028190000_falha_login_google.sql
docker exec -i "$P78_DB" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 <<'SQL'
select relrowsecurity from pg_class where oid='public.oauth_failure_relay'::regclass;
select has_table_privilege('anon','public.oauth_failure_relay','select'),
       has_table_privilege('authenticated','public.oauth_failure_relay','select');
select has_function_privilege('anon','public.oauth_relay_failure_put(uuid)','execute'),
       has_function_privilege('anon','public.oauth_relay_failure_take(uuid)','execute');
select public.oauth_relay_failure_put(null), public.oauth_relay_failure_take(null);
SQL
```

Esperado: aplicação sem erro; `t`, `f|f`, `t|t`, `f|f`. A migration avisa o PostgREST para reler o esquema. Não imprimir registros de clientes nem credenciais.

No iPhone, abrir o PWA, iniciar o login Google, cancelar na janela e voltar ao app: o aviso de falha deve substituir a espera. Depois repetir concluindo o login: deve abrir a área correta. Conferir também navegador comum e PWA no Android. Esses testes não foram substituídos pela emulação local.

## Volta, somente se necessária

```bash
docker exec -i "$P78_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 \
  < supabase/manutencao/2026-10-28_desfazer_falha_login_google.sql
```

Remove apenas as duas funções novas e a tabela de marcadores temporários; mantém a ponte PKCE e sessões. O cliente volta à espera anterior. Não restaurar o banco inteiro por esse motivo.

Retornar: commit utilizado, hashes, estado do container, caminho/tamanho do backup, 18 PASS com ROLLBACK, resultados finais e testes físicos realizados (ou pendentes). Não enviar segredos.
