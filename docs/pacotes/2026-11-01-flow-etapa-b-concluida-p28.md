# P-28 — Etapa B concluída: cópia protegida e validação conferidas

**01/11/2026 · Resultado: B concluída.** A TI/Guardião executou a captura somente leitura e a validação offline em uma tentativa, conservou a cópia privada na VPS e removeu a conexão descartável. Codex conferiu os resumos permitidos, os 19 blobs, tamanho/modos, ausência dos runners/URL e saúde dos serviços. **O conteúdo da cópia secreta não foi lido nem exportado pelo Codex.** Próximo: [preparar C, sem consentimento ou migração](2026-11-01-ti-flow-preparacao-c-p28.md).

## 1. Ligação com o Barba & Cabelo e fonte

O objetivo continua sendo a **P-28 do Barba & Cabelo: concluir a verificação Google**. Esta é a tarefa auxiliar de separar o Drive do Flow do projeto Google compartilhado, direção já escolhida pelo dono para preservar o cliente atual do Barba & Cabelo. Não é uma nova frente de funcionalidades do Flow.

Lido inteiro **`relatorio-ti-flow-etapa-b-p28-2026-11-01.md`**, 155 linhas. O relatório registra autorização de Alyson para B e atuação do Guardião na criação privada de `conexao.url`; C/D não foram autorizadas ou executadas. Não pedir novamente autorização, captura ou validação de B.

## 2. Execução relatada pela TI

| Item                 | Resultado                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Preparo              | 22:59–23:00 Brasília de 01/11 / 01:59–02:00 UTC de 02/11                                                             |
| Captura              | **23:10:52–23:10:53 Brasília / 02:10:52–02:10:53 UTC**                                                               |
| Validação offline    | **23:11:02–23:11:03 Brasília / 02:11:02–02:11:03 UTC**                                                               |
| Commit / ferramentas | `9837ebc873554d3e7685f792c18d01349418ed2e` / `fb576d0970c46fe9dcb918fa10be59d62f2111a3`, **19 blobs**                |
| Runtime              | Bun 1.4.2 Linux/amd64, digest `296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2`                     |
| Banco fonte          | Flow produção, `supabase-db-vv3jo93anprhqezhtu4ewcpl`, `postgres`, versão 15.8                                       |
| Captura              | Rede Flow `vv3jo93anprhqezhtu4ewcpl`, transação somente leitura encerrada em ROLLBACK; saída **0**, `resultado: ok`  |
| Validação            | Runner separado, **sem rede e sem montar a entrada**; saída **0**, `resultado: aprovada`, `apta_para_restaurar: sim` |
| Artefato             | **6.987 bytes**, não vazio, arquivo 0600, `root:root`                                                                |
| Origens              | Credencial e segredo da rotina em **banco**, sem variáveis parciais; quatro booleans false antes/depois segundo a TI |
| Conteúdo contado     | **Duas integrações; 19 clientes mapeados; demais cinco tabelas de referências com zero linhas**                      |
| Aviso                | **`legado_sem_client_id`**, previsto no contrato, preservado e aceito sem preencher campo                            |

**Custódia privada na VPS:** `/root/backup-flow-integracoes-p28-20261102T020042Z/`. Cópia: `saida/operacao/copia-integracoes.json`; resumos: `logs/captura.json` e `logs/validacao.json`; erros em logs separados. Arquivo com segredo e seu hash não são anexos públicos nem devem ir ao Git/chat/máquina local.

Os 19 clientes são linhas do **mapa do banco**, não prova de 19 pastas/arquivos no Drive. Mapas vazios nas outras tabelas também não comprovam Drive vazio; o teste de acesso a arquivos antigos continua próprio de C.

## 3. Conferência própria do Codex

SSH somente leitura e saída restrita a verificações/campos permitidos:

- `captura.json` e `validacao.json` têm etapas/resultados, fonte produção/stack correta, origens em banco, duas integrações, contagens e aviso exatamente esperados. Aptidão `sim` e tamanho 6.987 confirmados no resumo da validação. Os dois arquivos de erro estão vazios. Os códigos de saída do processo são relatados pela TI; não houve nova execução para medi-los.
- `entrada/origens.json` contém os quatro booleans false no formato versão 1. A comparação com as variáveis efetivas antes/depois é evidência da TI; Codex não consultou valores do ambiente nesta revisão.
- Cópia somente por **`lstat`/tamanho**, sem abrir seu conteúdo ou calcular/publicar hash: 6.987 bytes, arquivo físico 0600, dono/grupo 0:0. Base, entrada, saída, operação e logs físicos 0700; origens/resumos/erros 0600, 0:0.
- `entrada/conexao.url` ausente; filtro `p28.etapa=B` sem containers. O método de remoção `shred -u` é relatado pela TI; a conferência própria atesta ausência do arquivo, não recuperação impossível no armazenamento subjacente.
- **19/19 blobs** da fonte preservada iguais aos revisados no #38. Sem reabrir a cópia secreta, repetir captura, validar novamente ou criar conexão de banco.
- DB `80c3d9164c07…` e funções `d411e8225ad9…` saudáveis, com os mesmos inícios conhecidos: `2026-10-23T20:44:50.472960587Z` e `2026-11-01T18:32:29.790943603Z`. Nenhuma escrita remota ou reinício pelo Codex.

A confirmação de formato/integridade é a saída da ferramenta de validação conferida, não uma alegação de que o Codex releu ou revalidou o arquivo secreto. Custódia TI/root, sem exclusão automática, mantida. Backups/código/logs das etapas anteriores preservados.

## 4. Limites e próximo passo

**A e B concluídas.** B preserva a configuração existente; não altera o aplicativo nem a conta Google. `apta_para_restaurar: sim` atesta campos mínimos/par, não autoriza restauração de produção. O restaurador entregue continua restrito ao fictício. Cron ativo não é barreira de escritores; D exigirá nova imagem imediatamente anterior à virada e controle de concorrência.

**C está em preparação:** Alyson confirmou que **a TI tem acesso à conta Google já usada pelo Drive do Flow**; não perguntar novamente. Restam IDs antigos em canal privado, custódia da credencial/candidato novos, metadados do cliente/projeto Google e transporte do callback. A confirmação de acesso não autoriza iniciar consentimento, obter token candidato, cadastrar URI, publicar marca ou promover conexão.

Seguir o [arquivo de preparação para TI](2026-11-01-ti-flow-preparacao-c-p28.md). Não é novo pedido de PR, backup, inventário geral ou teste de A/B. **P-28 permanece pendente até separar/validar o Flow e retomar a configuração/verificação Google do Barba & Cabelo conforme o plano escolhido.**

**Validação do registro:** tipos, **301 testes Barba & Cabelo**, formatação dos nove documentos e montagem aprovados por `scripts/verificar.sh`; 31 links/âncoras locais novos e diff conferidos. Resultados documentais distintos da captura/validação B executadas pela TI; nenhuma repetição do procedimento real pelo Codex.
