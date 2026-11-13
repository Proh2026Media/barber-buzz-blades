# B&C — Web Push: correção incremental do limite do dispatch

**Estado posterior:** a TI confirmou este incremental instalado em 12/11 às 21:43–21:44, ainda desligado e sem cron. **Não reinstalar este pacote.** Próximo roteiro: [operação e homologação](2026-11-12-ti-webpush-operacao-homologacao.md). O restante preserva o procedimento histórico.

Data: 12/11/2026. Autor: Codex. Destinatário: TI/Guardião.
Responde a `relatorio-ti-p120-webpush-revisao-2026-11-12.md` e `instrucao-codex-webpush-ajustes-2026-11-12.md`, incluindo a atualização VAPID às 20:52.

**Estado desta entrega:** implementação e testes locais concluídos; incremental não instalado, push não ativado e não homologado em aparelhos reais. Pacote para revisão e instalação em janela autorizada. Cron e ativação exigem autorização explícita posterior do Alyson, conforme escopo informado pela TI. Não há ordem para ativar neste arquivo.

## 1. Estado recebido e preservado

- Revisão 2 instalada em 12/11, 20:35–20:44; frontend na base `04bf9276281c5cd8d7f42f48ecb839d1a4a9b17e`. As seções históricas que diziam “sem VAPID” foram superadas pela atualização das 20:52.
- VAPID já gerado/persistido pelo Guardião, assunto `mailto:contato@proh.media`. Não gerar, substituir, imprimir nem enviar chaves. O relatório não confirmou a conclusão do salvamento no cofre; conferir isso com o Guardião, sem duplicar o par.
- `WEB_PUSH_ENABLED=false`, `web_push_settings.enabled=false`, sem cron, sem teste visual em aparelho.
- As migrations `20261112230000_notificacoes_web_push.sql` e `20261112231000_painel_saude_whatsapp.sql` já foram aplicadas. **Não renomear nem reaplicar.** A colisão histórica de prefixo com a nº 117 não exige recriar objetos.
- Não criar `schema_migrations` nem tocar em `auth.schema_migrations`.

## 2. Correção entregue

O lote anterior reservava até 20 tarefas e enviava sequencialmente, até ~200 s somente no provedor. Agora reserva no máximo **4**, executadas em paralelo. Há orçamento de **40 s por requisição**, compartilhado entre leitura do pedido, banco e provedor; consultas ao banco têm até **5 s**, cada envio até **8 s**. A leitura do corpo também tem prazo e tamanho máximo. Não aumenta o limite global de 60 s do runtime.

O banco continua revalidando sessão, destinatário, permissões e pausa imediatamente antes de transmitir. `SKIP LOCKED`, lease e autorização de uso único são preservados. Falhas são isoladas por tarefa. Resultado de envio incerto é `unknown`, sem tentativa automática. Se o banco deixar de responder ou o worker for interrompido, a tarefa reservada permanece `processing` e passa a `unknown` na próxima reserva após cinco minutos; nunca volta a `queued`. Sem agendador, essa limpeza não ocorre sozinha.

O Edge rejeita lote legado >4 antes de transmitir: SQL e Edge precisam ser instalados juntos. `processed` conta tarefas cujo resultado foi gravado, inclusive `unknown`; não prova recebimento no aparelho. `uncertain` indica erro na autorização/finalização e retorna `ok=false`. Uma resposta sem erro também não substitui homologação visual.

Quatro é o limite por execução, não um limite global entre várias chamadas. O futuro agendador deverá evitar sobreposição. Ele não faz parte desta instalação nem deve ser criado agora.

## 3. Conteúdo e integridade

ZIP: `BC-WebPush-Dispatch-Incremental-2026-11-12.zip`.

- `BASE.txt`: base de produção acima; `COMMIT.txt`: revisão local da entrega.
- `alteracoes.patch`: somente esta correção/documentação, aplicável à base declarada.
- `arquivos/`: arquivos completos de desenvolvimento. Instalar na VPS somente os quatro artefatos abaixo, não a pasta inteira.
- `SHA256SUMS`: todos os arquivos e evidências. Conferir com `sha256sum -c SHA256SUMS` antes de usar.
- `instalar.sh`: cópia do script versionado `scripts/ti/webpush-dispatch-incremental.sh`. `conferir` é somente leitura; `instalar` muda SQL/Edge e recria somente funções.
- `evidencias/`: resultados e bancada. `supabase/tests` e scripts de teste são só para ambiente descartável, nunca produção.

Artefatos de instalação:

1. **Nova** `supabase/migrations/20261112232000_web_push_lotes_limitados.sql` (timestamp válido, posterior aos já usados; confirmar que não foi usado após o último relatório).
2. Substituição de `supabase/functions/web-push/index.ts`.
3. Novo `supabase/functions/_shared/web-push-budget.ts`.
4. Novo `supabase/functions/_shared/web-push-dispatch.ts`.

Dependência preservada: `_shared/web-push.ts`, SHA-256 `09580aad2944fd4315b01efa74cdb939ce5fedf48f1df3495e34455d52d4c930`. O index instalado anterior deve ter SHA-256 `e51759e3eab1dde5d9e31dfcf4360edf7bcf5b231e168a13f214cc86f13fb0c4`. O script interrompe se a base divergir ou se módulos novos já existirem, evitando sobrescrever trabalho posterior/repetir instalação.

Nenhuma mudança de frontend, monitor, Evolution, grupos, OTP, identidade da extensão, pagamentos, números, marca ou Flow. Nenhum `.env`, segredo ou `node_modules` no pacote. Não usar os pacotes v1/v2 novamente. Não precisa push/main para instalar esta correção de backend; manter o código fonte em revisão/branch separado. Push/main publica o site e não é uma etapa deste roteiro.

## 4. Instalação preparada para TI

Pré-requisitos: VPS do relatório, Docker Compose e Python 3 disponíveis, pacote extraído em diretório protegido, autorização da janela para uma migration incremental e recriação somente de funções. Manter os dois controles de push desligados e sem agendador durante toda a instalação. Sem acesso à VPS, o Codex não executou este procedimento no servidor.

Na pasta extraída do ZIP, como root:

```bash
sha256sum -c SHA256SUMS
bash instalar.sh conferir "$PWD"
```

O script verifica hashes, dependências, flags no container e no Compose, VAPID já persistido sem exibir valores, saúde do Edge, assinatura/limite/permissões do claim e ausência de cron Web Push. Se houver divergência, devolver o diagnóstico; não remover uma proteção para prosseguir.

Após a conferência e autorização da janela:

```bash
bash instalar.sh instalar "$PWD"
```

O script já contém os caminhos do ambiente informado pela TI:

- serviço `/data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn`;
- funções em `volumes/functions/`;
- banco `supabase-db-z2dbb7dkyzhc8vjiywq34mhn`;
- Edge `supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn`.

Ele cria backup protegido `/root/backup-bc-webpush-dispatch-AAAAmmdd-HHMMSS`, salva index/definição anterior do claim e cópia do `.env` apenas para preservação, aplica **só a nova migration** em transação com timeout, copia os três TS por rename, recria exclusivamente `supabase-edge-functions` com `--no-deps --force-recreate --pull never` e confere saúde/hashes/flags. Não altera `.env` nem Compose. **Não clicar Redeploy no Coolify.**

Registrar separadamente início/fim e indisponibilidade observada; o tempo total mostrado pelo script não é uma medição de indisponibilidade. Não prometer duração baseada em outra instalação. Não reiniciar banco, Auth, Kong, proxy ou Evolution.

## 5. Aceite desta instalação, ainda desligada

1. Arquivos instalados iguais ao manifesto; claim com `limit 4 for update skip locked`; execute reservado a `service_role`.
2. Container saudável, mesmos pares VAPID e configurações persistentes, ambos os controles de push desligados, nenhum cron novo. Banco/Auth/proxy/Evolution sem reinício.
3. Smoke sem segredo: GET `/functions/v1/web-push` retorna 405; POST `{"action":"dispatch"}` sem Authorization retorna 401; config sem sessão 401. Conferir ausência de erro de import/500. Não chamar dispatcher com chave de serviço nesta janela.
4. Monitor WhatsApp permanece acessível ao admin; não precisa reinstalar `whatsapp-health` nem `_shared/evolution.ts`.
5. Frontend continua na versão já publicada; nada requer nova compilação/publicação do site para este backend.
6. Devolver relatório com nome deste roteiro no campo “Responde a”, horários, hashes instalados, definição do claim conferida, backup, indisponibilidade efetivamente observada e estados: revisado/instalado/ativado/homologado. Os dois últimos permanecem **não**.

Após esse retorno, a autorização de ativação/cron e a homologação real serão uma etapa própria. É necessário receber visualmente push em aparelho consentido (inclusive verificar diferenças entre navegador e PWA), testar desligamento/saída de conta e destinatários de criação/alteração/cancelamento. Não apresentar os testes simulados desta entrega como esses testes reais.

## 6. Retorno, se esta instalação falhar

Interromper; manter push desligado e sem cron. Não reexecutar às cegas: a migration ou a cópia de algum arquivo pode ter terminado antes da falha. Usar **o backup desta janela**, impresso pelo script, não o backup antigo da instalação v2. Não restaurar banco inteiro nem `.env`, pois este incremental não os substituiu.

Após conferir o caminho exato do backup e que ninguém editou a função durante a janela:

```bash
BC_BACKUP='/root/backup-bc-webpush-dispatch-AAAAmmdd-HHMMSS' # substituir pelo caminho registrado
BC_SERVICE='/data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn'
BC_DB='supabase-db-z2dbb7dkyzhc8vjiywq34mhn'
test -s "$BC_BACKUP/index.ts" && test -s "$BC_BACKUP/claim-anterior.sql"
{ printf 'begin;\n'; cat "$BC_BACKUP/claim-anterior.sql"; printf '\ncommit;\n'; } |
  docker exec -i "$BC_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1
install -m 644 "$BC_BACKUP/index.ts" "$BC_SERVICE/volumes/functions/web-push/index.ts.bc-retorno"
mv "$BC_SERVICE/volumes/functions/web-push/index.ts.bc-retorno" "$BC_SERVICE/volumes/functions/web-push/index.ts"
(cd "$BC_SERVICE" && docker compose up -d --no-deps --force-recreate --pull never supabase-edge-functions)
```

Os dois módulos novos podem ficar sem uso; não é preciso apagá-los. Conferir saúde, hash anterior, flags desligadas e ausência de cron. O lote antigo volta a 20, portanto **continua proibido ativar** antes de nova correção. O retorno não pode alterar chaves nem zerar filas, inscrições ou resultados incertos.

## 7. Verificações locais realizadas

- 606 testes automatizados aprovados; checagem de tipos e montagem aprovadas; lint sem erros, sete avisos já existentes em arquivos fora da correção.
- 31 verificações SQL (base push + lote novo), em banco descartável, com rollback dos dados de teste.
- Três verificações com duas conexões PostgreSQL reais: reservas disjuntas, autorização única e tarefas interrompidas desconhecidas sem nova tentativa.
- HTTP local com consultas de 4,8 s e quatro provedores sem resposta: **27.265 ms**, quatro envios concorrentes, quatro `unknown`, nenhuma repetição. Benchmark local, não promessa de tempo sob qualquer carga em produção.
- Prazo total, cabeçalhos seguidos de corpo travado, transporte que ignora abort, cancelamento, corpo excessivo, erros de autorização/finalização e lote legado testados.
- Checagem Deno e bancada dos módulos na imagem exata `supabase/edge-runtime:v1.71.2` (compatível Deno 2.1.4), isolada sem rede: aprovadas. A importação de `web-push@3.6.7` na produção já foi confirmada pela TI na instalação v2.
- Nenhuma chamada a provedores reais, push real, alteração na VPS, troca de VAPID ou publicação pelo Codex nesta entrega.
