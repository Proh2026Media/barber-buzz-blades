# Implantação — WhatsApp e pontos no diretório (P-80, 24/10/2026)

**Aplicado em produção em 24/10/2026, às 16:57:15 (Brasília), pelo agente Claude na VPS**, segundo o relatório entregue pelo dono. Não reaplicar. Os passos abaixo ficam como roteiro histórico e de recuperação; teste da interface em produção continua pendente (P-43).

**Registro da execução:** commit `47b797503b9a6a3a9a02b5117bc1831a7fb8f01c`; três SHA-256 iguais aos deste pacote; container saudável; backup `/root/backup-barba-cabelo-20261024-195652.dump` (1,3 MB, catálogo legível; SHA-256 `e96bb196f70463912095fd673c89f6a0145448caa90311ebe0f264ae679f0d8a`); ensaio 22 PASS, 0 FAIL/ERROR/FATAL e ROLLBACK; assinatura final `382a1151bba2aea114651e3b2746f0d4`; privilégios `f|t|t`. Sem Restart/Redeploy, alteração de dados ou uso do roteiro de volta. Fonte: `relatorio-claude-2026-10-24.md`, enviado pelo dono; este registro não representa nova inspeção da VPS.

## O que muda

A nº 97, `20261024170000_diretorio_contatos_pontos.sql`, substitui somente `public.get_partner_clients(uuid)`: acrescenta o WhatsApp dos clientes já visíveis e, para quem já pode ler `loyalty_accounts`, o saldo da própria loja. Profissional contratado continua sem saldo; parceiro continua vendo apenas sua carteira. Cliente do balcão tem saldo nulo. Conta sem lançamento tem zero. Não altera dados, tabelas, agenda, cobrança nem assinatura da função.

A ordenação dos cabeçalhos funciona com o banco anterior. Busca por WhatsApp e coluna de pontos aparecem conforme os novos campos chegam do banco; não é preciso publicar o site novamente após a migration. Não há Edge function para publicar nem serviço para reiniciar.

## Conferências já feitas

- PostgreSQL local descartável, imagem `supabase/postgres:15.8.1.085`, com as 96 migrations anteriores.
- Teste novo: **22 PASS** (inclui os 8 cenários anteriores do diretório). Bateria completa: **1.121 PASS, 0 FAIL/ERROR**, sempre dentro de transações desfeitas.
- Migration aplicada duas vezes na mesma transação sem erro; roteiro de volta restaura a definição anterior e os mesmos privilégios efetivos (a ordem interna do ACL pode mudar).
- Isolamento de loja, carteira do parceiro, contratado sem pontos, cliente sem acesso, sessão ausente, visitante sem execução, apelido, balcão e saldo zero conferidos.

## Regras para a execução

Ler todo o roteiro. Usar um clone atualizado do **origin**, com os três arquivos abaixo. Executar no terminal da VPS correta; os caminhos relativos partem da raiz desse clone. Se os arquivos forem transferidos do Mac, manter a estrutura de pastas. Não usar a cópia antiga da VPS.

Só continuar quando cada resultado corresponder ao esperado. Fazer backup antes. Não alterar `.env`, Coolify, proxy, DNS, crontab, funções ou o outro Supabase. Não usar Restart/Redeploy. Nunca executar o teste fora de `BEGIN … ROLLBACK`. O ensaio cria registros fictícios temporários e deve ocorrer fora do movimento. Não imprimir credenciais nem dados de clientes.

## 1. Arquivos e servidor

Conferir SHA-256 (no Mac, usar `shasum -a 256`; no Linux, `sha256sum`):

```bash
sha256sum supabase/migrations/20261024170000_diretorio_contatos_pontos.sql \
  supabase/tests/diretorio_contatos_pontos.sql \
  supabase/manutencao/2026-10-24_desfazer_diretorio_contatos_pontos.sql
```

Esperado, nesta ordem:

```text
4c4fec380e1d0daa5ca5dce60f3d8844552cb781cc37d9c5922b979f92ef4c57  20261024170000_diretorio_contatos_pontos.sql
b6689ffa6f5362ebd4416554c9fba7def4e970d8b84794b6fcd4eba47d72aab2  diretorio_contatos_pontos.sql
7a6cb4d5ab696cd647d324c0f0fd64024149b1193a2fe3b96ac2fb5be529ffa1  2026-10-24_desfazer_diretorio_contatos_pontos.sql
```

No terminal da VPS, manter esta sessão até terminar:

```bash
set -euo pipefail
P80_DB=supabase-db-z2dbb7dkyzhc8vjiywq34mhn
docker ps --filter "name=$P80_DB" --format '{{.Names}} {{.Status}}'
docker exec -i "$P80_DB" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 <<'SQL'
select md5(pg_get_functiondef('public.get_partner_clients(uuid)'::regprocedure));
select to_regclass('public.shop_clients') is not null;
select has_function_privilege('anon','public.get_partner_clients(uuid)','execute'),
       has_function_privilege('authenticated','public.get_partner_clients(uuid)','execute');
SQL
```

Esperado: exatamente o container indicado, saudável; assinatura `ec2a38f3dee4908ede0dc6a7add92ee1`; `t`; `f|t`. Se a assinatura for `382a1151bba2aea114651e3b2746f0d4`, esta atualização já está aplicada: não repetir, ir à conferência final. Qualquer outra assinatura significa versão diferente da base conferida: parar e relatar.

## 2. Backup

```bash
P80_BACKUP="/root/backup-barba-p80-$(date -u +%Y%m%d-%H%M%S).dump"
docker exec "$P80_DB" pg_dump -U postgres -d postgres -Fc > "$P80_BACKUP"
test -s "$P80_BACKUP"
docker exec -i "$P80_DB" pg_restore --list < "$P80_BACKUP" > /dev/null
ls -lh "$P80_BACKUP"
```

Anotar caminho e tamanho. Só prosseguir com arquivo não vazio e catálogo legível, sem erro.

## 3. Ensaio — nada fica gravado

```bash
P80_LOG=$(mktemp /tmp/barba-p80-ensaio.XXXXXX)
{
  printf 'BEGIN;\n'
  cat supabase/migrations/20261024170000_diretorio_contatos_pontos.sql
  printf '\n'
  cat supabase/tests/diretorio_contatos_pontos.sql
  printf '\nROLLBACK;\n'
} | docker exec -i "$P80_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 > "$P80_LOG" 2>&1
printf 'PASS: '
grep -c 'PASS:' "$P80_LOG"
tail -1 "$P80_LOG"
if grep -E 'FAIL|ERROR|FATAL' "$P80_LOG"; then exit 1; fi
```

Esperado: **22**, última linha **ROLLBACK**, sem FAIL/ERROR/FATAL. Se falhar, parar: ao fechar a conexão a transação também é desfeita. Não tentar corrigir diretamente no servidor.

## 4. Aplicação e conferência

```bash
docker exec -i "$P80_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 \
  < supabase/migrations/20261024170000_diretorio_contatos_pontos.sql

docker exec -i "$P80_DB" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 <<'SQL'
select md5(pg_get_functiondef('public.get_partner_clients(uuid)'::regprocedure));
select has_function_privilege('anon','public.get_partner_clients(uuid)','execute'),
       has_function_privilege('authenticated','public.get_partner_clients(uuid)','execute'),
       has_function_privilege('service_role','public.get_partner_clients(uuid)','execute');
SQL
```

Esperado: COMMIT sem erro; assinatura `382a1151bba2aea114651e3b2746f0d4`; `f|t|t`. A migration notifica o PostgREST para reler o esquema.

Na interface do dono, em Agenda → Clientes da barbearia, procurar um cliente conhecido pelo WhatsApp (com e sem pontuação) e pelo apelido. No computador, conferir Pontos com o saldo daquela loja e inverter a ordem pelo cabeçalho. Cliente do balcão mostra `—`, conta sem saldo mostra `0`. Contratado não deve ganhar coluna de pontos. Não criar agendamentos nem alterar saldos para testar.

## 5. Como desfazer, somente se necessário

Primeiro conferir que a assinatura ainda é a nova acima: se outra entrega já mudou a função, não sobrescrever. Depois:

```bash
docker exec -i "$P80_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 \
  < supabase/manutencao/2026-10-24_desfazer_diretorio_contatos_pontos.sql
```

A conferência do passo 1 deve voltar à assinatura antiga e a `f|t`. Este roteiro volta apenas a função, sem apagar dados. A interface continua ordenando; ao recarregar, volta a buscar apenas nome/apelido e oculta Pontos. O backup completo fica guardado; não restaurar o banco inteiro por causa desta função.

## Relatório para devolver

Data e hora de Brasília; commit usado; hashes conferidos; container; assinatura anterior; caminho/tamanho do backup; resultado do ensaio (22 PASS, ROLLBACK); aplicação e assinatura final; privilégios; resultado do teste da interface; eventual volta. Sem senhas, tokens ou dados de clientes. Não fazer commit/push pela VPS. Relato recebido e aplicação registrada no CONTINUIDADE e nos guias em 24/10; P-80 está **feito — aplicado em produção**, com teste da interface pendente na P-43.
