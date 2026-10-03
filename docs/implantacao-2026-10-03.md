# Implantação no servidor — entregas de 03/10/2026

Instruções para o agente que tem acesso ao servidor (VPS `187.127.60.78`, Coolify em `http://100.87.77.28:8000` via Tailscale). O frontend **já está publicado** (commit `d127143` em `origin/main`). Falta levar ao Supabase auto-hospedado:

- 5 migrations novas (banco);
- 7 Edge functions alteradas.

Comunicação, relatórios e commits em **português do Brasil**.

## Regras de segurança (obrigatórias)

1. **Backup antes de tudo** (passo 2). Sem backup confirmado, não seguir.
2. **Ensaio antes de aplicar:** toda migration roda primeiro dentro de `BEGIN … ROLLBACK` (passo 4). Qualquer `ERROR` ou `FAIL:` → **parar** e relatar; não tentar "consertar" a migration no servidor.
3. **Ordem fixa:** migrations antes das funções. A `auth-otp` e a `register-shop` novas dependem da `20261003160000`.
4. Não reiniciar banco, Kong, Auth, REST nem Storage. Só o container de **funções** é reiniciado.
5. Não usar "Redeploy" do serviço no Coolify (desfaz ajustes manuais do `docker-compose.yml`, ver `docs/CONTINUIDADE.md`, item do Realtime).
6. Não imprimir segredos (chaves, senhas, tokens) em relatórios ou logs.
7. Se for editar o repositório (passo 9), seguir a regra de vez do `AGENTS.md` (`scripts/vez.sh pedir/checar`, `scripts/autossave.sh`). Nunca `git push --force`; nunca enviar só ao remoto `hostinger`.

## Passo 0 — Código atualizado

No local de onde os arquivos serão copiados (servidor ou máquina com acesso):

```bash
git pull --ff-only origin main
git log --oneline -1   # deve ser d127143 ou posterior
```

Arquivos usados:

| Tipo       | Caminho                                                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations | `supabase/migrations/20261003150000_correcoes_auditoria.sql`                                                                                                                             |
|            | `supabase/migrations/20261003160000_otp_tentativas.sql`                                                                                                                                  |
|            | `supabase/migrations/20261003170000_pendencias_edge_whatsapp.sql`                                                                                                                        |
|            | `supabase/migrations/20261003180000_verificar_whatsapp_perfil.sql`                                                                                                                       |
|            | `supabase/migrations/20261003190000_google_tokens_e_eventos.sql`                                                                                                                         |
| Teste SQL  | `supabase/tests/correcoes_auditoria.sql`                                                                                                                                                 |
| Funções    | `supabase/functions/auth-otp/`, `register-shop/`, `shop-domain/`, `domain-verify/`, `google-connect/`, `google-calendar-dispatch/`, `invite-shop-admin/` e `supabase/functions/_shared/` |

## Passo 1 — Localizar os containers

O serviço Supabase da barbearia tem o sufixo `z2dbb7dkyzhc8vjiywq34mhn`.

```bash
docker ps --format '{{.Names}}\t{{.Status}}' | grep z2dbb7dkyzhc8vjiywq34mhn
```

Anote:

- `DB` = container do Postgres (nome começa com `supabase-db-`);
- `FN` = container das Edge functions (nome contém `edge-functions` ou `functions`).

Conferir que os dois estão `Up`. Se não achar, parar e relatar.

## Passo 2 — Backup

```bash
STAMP=$(date +%Y%m%d-%H%M)
docker exec "$DB" pg_dump -U postgres -d postgres -Fc > /root/backup-barba-cabelo-$STAMP.dump
ls -lh /root/backup-barba-cabelo-$STAMP.dump   # tem de ter tamanho > 0
```

Se o usuário `postgres` não funcionar, descobrir o usuário com `docker exec "$DB" env | grep -i POSTGRES_USER` (não imprimir a senha).

## Passo 3 — Diagnóstico (o que já foi aplicado)

```bash
docker exec -i "$DB" psql -U postgres -d postgres -X <<'SQL'
select 'auth_otp_check_code'            as item, exists(select 1 from pg_proc where proname='auth_otp_check_code') as existe
union all select 'list_my_google_calendar_events', exists(select 1 from pg_proc where proname='list_my_google_calendar_events')
union all select 'apply_verified_whatsapp',        exists(select 1 from pg_proc where proname='apply_verified_whatsapp')
union all select 'profiles.whatsapp_verified_at',  exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='whatsapp_verified_at');
-- WhatsApp repetido entre contas (impede o índice único da 150000)
select whatsapp_e164, count(*) from public.profiles
 where whatsapp_e164 is not null group by 1 having count(*) > 1;
SQL
```

Esperado: tudo `f` (nada aplicado ainda). Se algum item já for `t`, relatar antes de seguir: pode ser aplicação parcial.

Se houver WhatsApp repetido, **anotar no relatório** (não apagar nada): a 150000 apenas avisa (`NOTICE`) e segue; a 180000 marca esses números como não confirmados até o dono confirmar.

## Passo 4 — Ensaio em transação (ROLLBACK)

O teste `correcoes_auditoria.sql` precisa rodar **logo depois da 150000 e antes da 180000** (uma asserção dele deixa de valer depois da 180000).

```bash
{
  echo 'BEGIN;'
  cat supabase/migrations/20261003150000_correcoes_auditoria.sql
  cat supabase/tests/correcoes_auditoria.sql
  cat supabase/migrations/20261003160000_otp_tentativas.sql
  cat supabase/migrations/20261003170000_pendencias_edge_whatsapp.sql
  cat supabase/migrations/20261003180000_verificar_whatsapp_perfil.sql
  cat supabase/migrations/20261003190000_google_tokens_e_eventos.sql
  echo 'ROLLBACK;'
} | docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 2>&1 | tee /root/ensaio-$STAMP.log

grep -E 'ERROR|FAIL:' /root/ensaio-$STAMP.log && echo "PARAR" || echo "ENSAIO OK"
grep -c 'PASS:' /root/ensaio-$STAMP.log
```

Critério para seguir: nenhuma linha `ERROR` nem `FAIL:`, e a última instrução é `ROLLBACK`. Se o teste falhar por depender de dados que não existem neste banco (ex.: loja de demonstração), relatar a mensagem exata e **não** aplicar.

Opcional (recomendado): rodar também, no mesmo esquema `BEGIN … ROLLBACK` depois das 5 migrations, os testes que já existiam e tocam as mesmas funções: `booking_rules_single_source.sql`, `slot_offer_mode.sql`, `slug_redirects_departure.sql`, `loyalty_program_module.sql`, `google_calendar_push.sql`, `shop_team_governance.sql`. Falha em algum deles → parar e relatar.

## Passo 5 — Aplicar as migrations (uma por vez, cada uma em transação)

```bash
for f in \
  20261003150000_correcoes_auditoria.sql \
  20261003160000_otp_tentativas.sql \
  20261003170000_pendencias_edge_whatsapp.sql \
  20261003180000_verificar_whatsapp_perfil.sql \
  20261003190000_google_tokens_e_eventos.sql
do
  echo "== $f"
  docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 < "supabase/migrations/$f" || { echo "FALHOU em $f — parar"; break; }
done
```

Se uma falhar, as anteriores ficam aplicadas e a que falhou é desfeita inteira (`-1`). Parar e relatar; não pular para a próxima.

Depois, recarregar o cache de esquema da API:

```bash
docker exec -i "$DB" psql -U postgres -d postgres -X -c "NOTIFY pgrst, 'reload schema';"
```

## Passo 6 — Conferir o banco

Rodar de novo o SQL do passo 3: agora tudo deve dar `t`. E:

```bash
docker exec -i "$DB" psql -U postgres -d postgres -X <<'SQL'
-- tokens do Google não podem ser lidos por usuário
select has_table_privilege('authenticated','public.google_connections','select') as auth_le_tokens,
       has_table_privilege('anon','public.google_connections','select')          as anon_le_tokens;
-- funções novas não liberadas para anon
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_executa
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('auth_otp_check_code','apply_verified_whatsapp','mark_shop_domain_status',
                     'list_my_google_calendar_events','save_my_whatsapp','delete_my_account');
SQL
```

Esperado: `auth_le_tokens = f`, `anon_le_tokens = f` e `anon_executa = f` em todas as linhas.

## Passo 7 — Publicar as Edge functions

1. Descobrir a pasta das funções no host:

   ```bash
   docker inspect "$FN" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
   ```

   Usar a origem montada em `/home/deno/functions` (ou o destino equivalente). Chamar de `VOL`.

2. Backup das versões atuais:

   ```bash
   cp -a "$VOL" "/root/functions-backup-$STAMP"
   ```

3. Copiar do repositório (substitui só estas pastas):

   ```bash
   for fn in _shared auth-otp register-shop shop-domain domain-verify google-connect google-calendar-dispatch invite-shop-admin; do
     rsync -a --delete --exclude '._*' "supabase/functions/$fn/" "$VOL/$fn/"
   done
   ```

   Não copiar arquivos `._*` (lixo do macOS). Não mexer nas demais funções.

4. Conferir as variáveis exigidas (só se existem, sem mostrar o valor):

   ```bash
   for v in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY PLATFORM_EVOLUTION_INSTANCE GOOGLE_OAUTH_CLIENT_ID GOOGLE_OAUTH_CLIENT_SECRET GOOGLE_OAUTH_REDIRECT_URI GOOGLE_OAUTH_STATE_SECRET; do
     docker exec "$FN" sh -c "[ -n \"\$$v\" ] && echo '$v ok' || echo '$v AUSENTE'"
   done
   ```

   `PLATFORM_EVOLUTION_INSTANCE` ausente → o login e a confirmação por WhatsApp respondem "indisponível" (não quebra o resto). Relatar; não inventar valor.

5. Reiniciar **só** o container de funções e conferir os logs:

   ```bash
   docker restart "$FN"
   sleep 5
   docker logs --tail 80 "$FN"
   ```

   Erro de compilação/import em alguma função → restaurar o backup daquela função (`cp -a /root/functions-backup-$STAMP/<fn> "$VOL/"`), reiniciar e relatar.

## Passo 8 — Testes de fumaça

Base da API: `https://supabase-barbearia.proh.media` (é o `VITE_SUPABASE_URL` do `.env`; se o domínio tiver mudado, usar o atual).

```bash
API=https://supabase-barbearia.proh.media
for fn in auth-otp register-shop shop-domain domain-verify google-connect invite-shop-admin; do
  printf '%s ' "$fn"; curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS "$API/functions/v1/$fn" \
    -H 'Origin: https://beauty.contheiner.digital' -H 'Access-Control-Request-Method: POST'
done
```

Esperado: `200` ou `204` em todas. `404` = função não carregada; `500/502` = erro de inicialização (ver logs).

Teste de leitura dos tokens pela API pública (deve ser negado):

```bash
ANON=<chave anon/publishable — pegar do .env do projeto, não imprimir>
curl -s "$API/rest/v1/google_connections?select=user_id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

Esperado: erro de permissão (`42501`/`permission denied`) ou lista vazia; nunca tokens.

Conferir o site: `https://beauty.contheiner.digital/privacidade?lang=en` abre em inglês, com a seção de segurança.

Não fazer login real, nem enviar códigos de WhatsApp, nem desconectar o Google de nenhuma loja: esses testes ficam com o dono.

## Passo 9 — Registrar

1. Seguir a regra de vez (`scripts/vez.sh pedir <ferramenta> "registrar implantação"`).
2. Em `docs/CONTINUIDADE.md`, nas duas entregas de 03/10/2026, marcar cada migration como **(aplicada em DD/MM HH:MM)** e as funções como publicadas, com o resultado dos passos 4, 6 e 8 e qualquer desvio (WhatsApp repetido, variável ausente, teste que falhou).
3. `scripts/autossave.sh <ferramenta>`.

## Como desfazer (só se algo quebrar em produção)

- **Funções:** `rsync -a /root/functions-backup-$STAMP/ "$VOL/"` e `docker restart "$FN"`.
- **Banco:** não há "down" das migrations. Em caso grave, restaurar o dump do passo 2 com `pg_restore` — **somente com autorização explícita do dono**, porque apaga tudo que foi gravado depois do backup.

## Relatório final esperado

Responder ao dono, em pt-BR, com:

1. Nome do arquivo de backup e tamanho.
2. Resultado do ensaio (quantidade de `PASS`, nenhuma falha).
3. Migrations aplicadas (horário de cada uma).
4. Resultado do passo 6.
5. Funções publicadas, status do `OPTIONS` de cada uma e variáveis ausentes.
6. Desvios e números de WhatsApp repetidos (só a quantidade, sem os números).

## Fora do escopo deste agente (tarefas do dono)

Reenvio da verificação no Google Cloud (vídeo, conta de teste, formulário): seguir `docs/google-verificacao.md`. Exige a conta Google do dono e só deve ser feito **depois** desta implantação, porque o vídeo precisa mostrar a revogação e os eventos importados funcionando.
