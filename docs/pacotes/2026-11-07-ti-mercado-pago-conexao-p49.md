# TI — Conexão Mercado Pago por recebedor (P-49)

**Preparado em 07/11/2026. Destino: exclusivamente Barba & Cabelo.** O dono escolheu Mercado Pago e confirmou: Parceiro independente recebe na própria conta; donos e contratados recebem na conta da barbearia, sem repasse ou comissão automática.

Este pacote instala e homologa **somente a conexão OAuth**. Não existe checkout, livro financeiro ou endpoint de reembolso/webhook nesta entrega. Não cobrar, devolver dinheiro, cadastrar webhook, alterar agendamentos ou operar Flow. A aprovação de desenvolvimento não é uma ordem de transação financeira.

## 1. Arquivos e pré-condições

- Migration nº 100: `supabase/migrations/20261107230000_mercado_pago_conexao.sql`.
- Ensaio: `supabase/tests/mercado_pago_conexao.sql`.
- Reversão: `supabase/manutencao/2026-11-07_desfazer_mercado_pago_conexao.sql`.
- Função: `supabase/functions/mercado-pago-connect/index.ts` e `handler.ts`.
- Helper novo: `supabase/functions/_shared/mercado-pago.ts`.

Conferir os hashes do `SHA256SUMS` do ZIP (`sha256sum -c SHA256SUMS`). Usar a mesma entrega do `origin` e registrar commit. A última migration registrada em produção é a nº 98. Conferir/aplicar a nº 99 pelo [pacote P-70](2026-11-07-ti-p70-governanca-pausa-semanal.md), se ainda pendente; não reaplicar 1–98 ou presumir nº 99 instalada. Para entrar nas contas do aplicativo, usar [acesso às contas de teste](2026-11-07-ti-acesso-contas-teste.md). Não recuperar contas reais de clientes.

## 2. Destino, backup e ensaio

No terminal da VPS B&C, após conferir a nº 99:

```bash
set -euo pipefail
P49_DB=supabase-db-z2dbb7dkyzhc8vjiywq34mhn
docker ps --filter "name=$P49_DB" --format '{{.Names}} {{.Status}}'
docker exec -i "$P49_DB" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 <<'SQL'
select to_regprocedure('public.get_weekly_break_governance(uuid)') is not null;
select to_regclass('public.mercado_pago_connections') is not null,
       to_regprocedure('public.get_mercado_pago_connection(uuid,text,uuid)') is not null;
SQL
```

Instalação nova: `t` e `f|f`. Se já existir parte da nº 100, devolver o estado e conferir a versão antes de reaplicar; tabelas podem ter sido preservadas por uma reversão anterior. Não executar o ensaio de instalação como se o banco estivesse vazio.

```bash
umask 077
P49_BACKUP="/root/backup-barba-p49-$(date -u +%Y%m%d-%H%M%S).dump"
docker exec "$P49_DB" pg_dump -U postgres -d postgres -Fc > "$P49_BACKUP"
test -s "$P49_BACKUP"
docker exec -i "$P49_DB" pg_restore --list < "$P49_BACKUP" > /dev/null
ls -lh "$P49_BACKUP"
sha256sum "$P49_BACKUP"
P49_LOG=$(mktemp /tmp/barba-p49-ensaio.XXXXXX)
{
  printf 'BEGIN;\n'
  cat supabase/migrations/20261107230000_mercado_pago_conexao.sql
  printf '\n'
  cat supabase/tests/mercado_pago_conexao.sql
  printf '\nROLLBACK;\n'
} | docker exec -i "$P49_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 > "$P49_LOG" 2>&1
grep -c 'PASS:' "$P49_LOG"
test "$(grep -c 'PASS:' "$P49_LOG")" -eq 59
tail -1 "$P49_LOG"
if grep -E 'FAIL|ERROR|FATAL' "$P49_LOG"; then exit 1; fi
```

Esperado: **59 PASS**, última linha **ROLLBACK**, sem FAIL/ERROR/FATAL. Registrar a contagem; a regressão local desta entrega teve 1.233 PASS e mais oito verificações próprias de reversão/reaplicação. Não executar testes fora de transação. Backup contém dados privados e permanece protegido na VPS.

## 3. Aplicação e permissões

```bash
docker exec -i "$P49_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 \
  < supabase/migrations/20261107230000_mercado_pago_conexao.sql
docker exec -i "$P49_DB" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 <<'SQL'
select relrowsecurity from pg_class
where oid in ('public.mercado_pago_connections'::regclass,'public.mercado_pago_oauth_requests'::regclass)
order by relname;
select has_table_privilege('authenticated','public.mercado_pago_connections','SELECT'),
       has_table_privilege('anon','public.mercado_pago_oauth_requests','SELECT');
select has_function_privilege('authenticated','public.get_mercado_pago_connection(uuid,text,uuid)','EXECUTE'),
       has_function_privilege('anon','public.get_mercado_pago_connection(uuid,text,uuid)','EXECUTE');
select has_function_privilege('authenticated','public.disconnect_mercado_pago_connection(uuid,uuid,bigint,text,uuid)','EXECUTE'),
       has_function_privilege('service_role','public.disconnect_mercado_pago_connection(uuid,uuid,bigint,text,uuid)','EXECUTE');
SQL
```

Esperado: `t`, `t`, `f|f`, `t|f`, `f|t`. A migration não conecta contas por conta própria. Não listar tabelas privadas nem exportar cifras, estados OAuth ou identificadores de contas para o relatório.

## 4. Aplicação Mercado Pago e segredos

Identificar ou criar uma aplicação dedicada ao B&C sob a conta administrativa autorizada. Não reutilizar a aplicação Google/Flow. Conferir no painel oficial os requisitos da aplicação e do fluxo [OAuth com PKCE](https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation). Se o provedor exigir informação comercial indisponível, devolver exatamente a pendência, sem inventar dados.

- Callback autorizado **exato**: `https://beauty.contheiner.digital/auth/mercado-pago`.
- Habilitar PKCE S256. Não adicionar callback de cada loja: o app usa o endereço principal.
- Preparar contas brasileiras de teste do Mercado Pago para os recebedores controlados. A conta de teste do B&C e a conta de teste do Mercado Pago são cadastros diferentes.
- Não cadastrar webhook nesta etapa; não há consumidor publicado.

Configurar somente no serviço das funções B&C, com persistência no Coolify e no ambiente efetivo:

| Variável                          | Valor/critério                                                             |
| --------------------------------- | -------------------------------------------------------------------------- |
| `MERCADO_PAGO_CONNECTION_ENABLED` | `true` após preparar os demais campos; controla conexão, não cobrança      |
| `MERCADO_PAGO_CLIENT_ID`          | Identificador da aplicação dedicada                                        |
| `MERCADO_PAGO_CLIENT_SECRET`      | Segredo da aplicação, somente no servidor                                  |
| `MERCADO_PAGO_REDIRECT_URI`       | Callback exato acima                                                       |
| `MERCADO_PAGO_ENCRYPTION_KEY`     | Chave aleatória de 32 bytes em base64, gerada/guardada por canal protegido |
| `MERCADO_PAGO_ENVIRONMENT`        | `test` nesta homologação; o handler exige usuário MP de teste              |

Guardar chave de cifra em backup protegido. Não substituí-la arbitrariamente: isso torna os tokens existentes ilegíveis. Não imprimir `.env`, chave, token, código de autorização, URL de retorno completa ou corpo de erro do provedor. Não enviar valores no chat/relatório nem incluir no frontend. `SUPABASE_URL`, chave de serviço e chave pública já existentes continuam necessárias; não trocá-las.

## 5. Publicar somente a função nova

Conferir o container B&C `supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn` e o volume montado em `/home/deno/functions`, usando saída filtrada de mounts, sem despejar o ambiente. Fazer cópia protegida da pasta antes da mudança. Copiar somente `mercado-pago-connect/index.ts`, `handler.ts` e `_shared/mercado-pago.ts`, preservando todas as demais funções e helpers. Não sincronizar `_shared` com `--delete`.

Se só os arquivos mudarem, reiniciar apenas o container das funções. **Variáveis novas exigem conferir/recriar somente esse serviço**, pois `docker restart` não substitui seu ambiente. Persistir primeiro a configuração aprovada, conferir `docker compose ... --dry-run up -d --no-deps <serviço-das-funções>` e executar apenas se o plano afetar exclusivamente funções. Não usar Redeploy da pilha nem reiniciar banco/Auth/Kong/proxy. O [guia de operação](../guia/banco-e-implantacao.md#7-edge-functions) descreve o ambiente e os volumes.

Conferir inicialização sem erro; não copiar logs com dados privados. `OPTIONS` com Origin `https://beauty.contheiner.digital` deve responder com CORS; POST sem autenticação não pode consultar ou alterar conexão. Confirmar execução/imports no runtime Edge real: testes Node/TypeScript locais não substituem isso.

## 6. Homologação sem movimentação financeira

Usar Loja Teste e contas controladas. Registrar/restaurar configurações de equipe que forem alteradas pelo fluxo normal; não modificar clientes reais.

1. Dono autorizado: Ajustes → Pagamentos → conectar; abrir o Mercado Pago no domínio `auth.mercadopago.com`, autorizar a conta de teste. Retorno mostra **Conta conectada**, **Conta de teste** e **Pagamentos desativados**; código/estado desaparecem da URL.
2. Cancelar autorização: retornar sem vínculo. Abrir retorno incompleto, expirado ou repetido: não conectar nem substituir conta existente. Não repetir manualmente código/token em console.
3. Parceiro independente: conectar com sua própria sessão/conta de teste. O titular da conexão é o profissional. Dono, gerente, cliente, Contratado e outro Parceiro não podem conectá-la ou removê-la por ele.
4. Loja com dois donos iguais: conexão da loja informa indisponibilidade por aprovação compartilhada; a conexão pessoal do Parceiro continua permitida. Não modificar percentuais para contornar a regra.
5. Dois Parceiros na mesma loja: conexões independentes. Mesmo Parceiro em duas lojas: cada vínculo é separado e pode usar a mesma conta MP. Não confundir o papel SQL `partner` (sócio) com `associate` (Parceiro independente).
6. Contratado não vê opção de conta pessoal. A conta da barbearia atende futuramente donos e contratados. A configuração não deve mudar agenda, pontos, Google ou WhatsApp.
7. Desconectar uma conexão de teste: somente ela muda. Repetir/atrasar requisição não pode remover conexão mais nova. A remoção é local; eventual revogação global no MP pertence ao titular.
8. Inativar/reatribuir profissional fictício pela operação normal: novo titular não herda a conta anterior; autorização em trânsito perde validade. Restaurar o vínculo de teste, exigindo reconexão se a credencial tiver sido retirada.
9. Trocar conta/sair durante uma resposta lenta: resultado antigo não aparece na sessão nova. Sem sessão no callback, entrar de novo e recomeçar a conexão; nenhum código deve ser guardado no navegador.
10. Conferir celular, tablet em ambas as orientações e computador, teclado/foco/rolagem e os três modos de canto. Registrar dispositivos indisponíveis como não testados.

Não concluir P-49 ou homologação financeira a partir desses casos. Não há pagamento a realizar para validar este pacote. Se o OAuth de contas de teste for recusado pelo provedor, preservar os erros sanitizados e devolver o impedimento; não mudar para `production` como tentativa.

## 7. Retirada pontual, se necessária

Interromper o endpoint novo, retirando sua pasta do volume para backup protegido e reiniciando apenas funções, ou por bloqueio específico da rota. Só colocar `MERCADO_PAGO_CONNECTION_ENABLED=false` impede novas autorizações, mas não desabilita status/desconexão. Não bloquear outras funções.

Depois, em uma transação:

```bash
docker exec -i "$P49_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 \
  < supabase/manutencao/2026-11-07_desfazer_mercado_pago_conexao.sql
```

A reversão retira RPCs/gatilhos, invalida autorizações em trânsito e conserva tabelas/cifras privadas; não apaga contas ou restaura dump por cima de dados novos. Preservar chave de cifra/backup e não tratar isso como revogação no MP. Registrar motivo e estado; reinstalação exige conferir os vínculos atuais e ensaiar antes.

## 8. Um único relatório de retorno

Responder a **este arquivo**: commit/hashes; destino; backup/catálogo; ensaio PASS/ROLLBACK; nº 99 já instalada ou aplicada separadamente; instalação nº 100; ACLs/RLS; função/imports/CORS; configuração presente por nome e ambiente `test` (sem valores secretos); casos passados/falhos/não executados; aparelhos; estado final das contas de teste; reversão, se houve. Nenhum pagamento real pode constar como realizado por este pacote.

O retorno permite encerrar a etapa de conexão e seguir o [contrato financeiro P-49](../pagamentos-reembolsos-p49.md). Não é necessário enviar este pacote ao Claude/Flow.
