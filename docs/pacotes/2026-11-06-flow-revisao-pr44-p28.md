# P-28 — Revisão do #44: F3 atendida, três lacunas nos mecanismos novos

**06/11/2026 · ChatGPT/Codex · Revisão e ensaios fictícios.** Relatório `relatorio-claude-flow-pendencias-pr43-p28-2026-11-06.md` lido inteiro: **155 linhas**, SHA-256 `4aa3ac67c9303e1004ed6441e43559659dcfa5e421497ea58dba01384d71ba9a`. [Pedido respondido](2026-11-06-claude-flow-ajustes-pr43-p28.md), [revisão anterior](2026-11-06-flow-revisao-pr43-p28.md).

**Resultado:** finalização de abas antigas **F3 atendida**; abrir/fechar não ignora mais incertas anteriores. Há três lacunas reproduzidas nos mecanismos novos: **F1a** erro externo capturado pelo cron some sob resposta HTTP 200; **F1b** permissão de outro arquivo é aceita como reconciliação; **F2a** token de próxima página fora da regex encerra a listagem como completa. F1/F2 continuam parciais; barreira/virada não homologadas. [Arquivo único para Claude](2026-11-06-claude-flow-ajustes-pr44-p28.md).

Continua sendo a dependência Google da **P-28 do Barba & Cabelo**, preservando seu cliente de login. Ensaio dos 15 concluído; instalação e D não autorizadas/executadas. As etapas reais propostas no anexo são propostas, não pedidos de execução do dono.

## 1. Versão conferida

O anexo diz rascunho. O GitHub registra o [#44 integrado](https://github.com/Proh2026Media/flow-proh-media/pull/44) em **06/11 às 11:16:06 Brasília** (`14:16:06Z`). Não pedir outro merge.

| Identificação                | Resultado próprio                          |
| ---------------------------- | ------------------------------------------ |
| Base #43                     | `ff4471debf671f42a42fa55896a26c900e868e9b` |
| Head #44                     | `08f0b1ee421c3c09f7bcef85d86dae4335569ac1` |
| Merge, main origem e espelho | `e9b65d4813052aa3d37ef78a3e36028f88530eaf` |
| Árvore completa, head e main | `2dd66ed849b584bc287cecd5ac17c388182950ef` |
| Ferramentas, 27 arquivos     | `dfb85e300a695402ae865c81919e655c116d9ea0` |
| Função, 5 arquivos           | `b03e7407617ab973bcabeff3e707485127cf8ca8` |

Oito arquivos/blobs/quantidades do delta coincidem com o manifesto. AGENTS inalterado (`39431fcc3af1a362593c85210f8b151d894e90af`). **36 blobs** copiados/verificados para ensaio: ferramentas, função, AGENTS, package.json, hook e teste do hook. Hook produtivo, migrations, instaladores e guardas de alvo fictício não mudaram; em `src/` entrou apenas teste. Merge não instala a função.

## 2. Verificações próprias

| Verificação                                                                | Resultado                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `bun test ferramentas/p28-drive`, PG 15.8 fictício, Linux/amd64, Bun 1.4.2 | **165 passaram, 0 falharam, 0 pulados**, 1.881 assertivas, saída 0 |
| Vitest nativo (`bun run test`)                                             | **138/138**, incluindo 29 barreira, 94 proteção e 3 hook           |
| `tsc -p tsconfig.app.json`                                                 | Saída 0                                                            |
| ESLint ferramentas, função, hook e teste                                   | Saída 0                                                            |
| Nove independentes finais                                                  | **6 passaram / 3 falharam**, 20 assertivas, saída 1                |

Uma assertiva macOS adicional do anexo depende de `/private/var/` (`unidade.test.ts:293`). Tipos estritos Bun e sabotagens relatados são evidências Claude, não verificações próprias desta rodada.

PG em rede Docker internal própria, sem portas/dados reais; fontes e raiz dos executores somente leitura, capacidades removidas. Google simulado/fetch real bloqueado. A reprodução do cron foi reforçada: **corpos originais de `revogarPermissao`, `revogarVencidos` e `handleShareExpire` extraídos sem modificação**, com dependências simuladas, executados sob a classe real. Repetiu-se somente a suíte independente após esse reforço, mantendo os três achados; handler Deno completo/runtime da VPS não foram executados.

Três containers próprios, volumes anônimos associados e rede retirados; **36 blobs intactos e checkout Flow limpo**. Artefatos fictícios em `barba-p28-pr44-587140bk`, fora do B&C.

## 3. O que foi atendido

- **F3:** aba antiga sem ticket no corpo conclui sob barreira fechada via appProperties; controle **200**, uma leitura autorizada. Outro usuário recebe **503 sem consultar Google**. Após finish, drenagem passa.
- **F1 anterioridade:** chamada que altera registrada e depois 502 bloqueia antes e depois de abrir/fechar. `incerto_anterior` não é mais excluído da contagem. Falha sem chamada externa registrada passa a ser distinguida por evidência; o modelo anterior de apenas devolver 502 não serve para representar efeito externo perdido nessa implementação.
- **F2:** carência escolhida foi removida. Há recibo de verificação do legado vinculado à geração/marco e tratamento de órfãos; o controle com duas páginas e token aceito encontra órfão e bloqueia. A transição de 168 h e reinício de todos os workers é proposta dependente de premissas/procedimento, sem execução real nesta revisão.
- **Controles preservados:** retorno normal, recusa de divergência mantendo a alteração e resposta perdida após COMMIT com `barreira_perdida` passaram novamente.

## 4. F1a — erro externo capturado no cron desaparece sob HTTP 200

`comBarreira` define falha apenas por exceção/HTTP ≥500; `encerrar` apaga em sucesso mesmo com efeitos de resultado desconhecido. O cron real **captura** erro do DELETE em `revogarVencidos` (`index.ts:1265–1282`), grava `erro_revogacao`, e `handleShareExpire` devolve **200 com a lista de erros** (`1569–1579`). Não é falha simulada sem chamada externa: o DELETE passa por `chamarComRegistro` e é registrado com status 0.

Reprodução com os três corpos originais: uma revogação perde a resposta → uma consulta DELETE, um erro gravado, resposta 200 com um erro → **incertas=0 e prova emitida**. O registro de efeitos é descartado pelo status externo do Flow.

**Corrigir:** resultado incerto de alteração externa precisa permanecer contabilizado mesmo se a rota capturou a falha e respondeu 200/4xx. Não basta mudar a classificação de 502. Preservar respostas/regras de negócio do cron e diferenciar sucesso externo comprovado de efeito desconhecido; reconciliação/compensação deve ter evidência, não depender do envelope HTTP.

## 5. F1b — permissão é comparada sem o arquivo alvo

`referenciasAtivas` guarda só `drive_permission_id`; a reconciliação de permissão criada consulta esse conjunto e ignora `ef.arquivo` (`virada.ts:423–432,469–474`). No Drive, permissionId identifica o destinatário e permanece igual em arquivos diferentes; precisa ser associado ao arquivo. [Contrato de compartilhamento do Google](https://developers.google.com/workspace/drive/api/guides/manage-sharing).

Reprodução: banco tem permissão P ativa no arquivo B; chamada registrada cria permissão P no arquivo A e a ação falha antes de guardar o vínculo A. `reconciliarIncertas` devolve **1 reconciliada/0 pendentes**, faz **zero consultas Google**, remove a incerteza e permite prova. Um vínculo de B foi usado para legitimar A.

**Corrigir:** conferir par **arquivo + permissão**, incluindo criação/remoção. Obter comprovação remota apropriada quando necessária para resolver resultado desconhecido; sem prova do alvo correto, manter pendência. Não trocar esse problema por inventário global ou alteração real de compartilhamentos.

## 6. F2a — próxima página fora da regex vira fim de listagem

`verificarLegado` (`virada.ts:408`) transforma `nextPageToken` não aceito por `/^[A-Za-z0-9_.~-]+$/` em `undefined`, encerrando com recibo de sucesso. O contrato público define um token de página, sem esse alfabeto restrito; token não aceito não demonstra fim. [Referência de files.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list).

Reprodução com duas páginas simuladas, segunda contendo órfão: token `pagina-ficticia-2` → **2 páginas, 1 órfão, sem prova** (controle positivo). Alterar somente o token para `pagina-ficticia-2=` → **1 página, 0 órfãos, prova emitida**. Isso testa a resposta a um token opaco não aceito, não afirma que esse valor literal foi observado no Google real.

**Corrigir:** transportar token opaco com codificação segura e porteira compatível, ou recusar explicitamente formato não suportado. Nunca tratar token presente/inválido como fim. Testar paginação completa e recusa de resposta incompleta/inesperada, sem produzir recibo aprovador; não repetir ensaio Google.

## 7. Estado real conferido

SSH somente leitura em **06/11 às 11:24:07 Brasília**: `index.ts` vivo 83.446 bytes, blob `e0db47fccb1e7e52852f385cc227b8df21d574d1`; `protecao.ts` 20.558 bytes, blob `711879fb7b390fbabfdd67c203139e975ea80f3f`; ambos #36. `barreira.ts` ausente. Banco `80c3d9164c07…`, início `2026-10-23T20:44:50.472960587Z`; funções `d411e8225ad9…`, início `2026-11-01T18:32:29.790943603Z`; ambos healthy, RestartCount 0.

Somente tamanhos/hashes de código e metadados Docker, sem ambiente/banco/credenciais ou escrita remota. Achados fictícios não são ocorrências constatadas em produção. Sem instalação, manutenção, D ou alteração Google.

## 8. Próximo passo

[Claude — corrigir F1a/F1b/F2a em novo PR](2026-11-06-claude-flow-ajustes-pr44-p28.md), preservando F3 e os controles atendidos. Agora não há execução para TI. Após revisão técnica, concretizar procedimentos de instalação/ativação e D para decisão própria do dono, incluindo premissas do legado e disponibilidade de AsyncLocalStorage no runtime. Sem repetir A/B/T1, Picker dos 15, consentimento/renovações ou inventários. Custódia, cliente B&C e guardas preservados.

## 9. Verificação da entrega documental B&C

`scripts/verificar.sh` saída 0: tipos, **301 testes B&C**, Prettier dos oito documentos e montagem aprovados. Eslint não aplicável, nenhum TS/TSX alterado. **24 links locais novos** conferidos e diff sem erro de espaço. A montagem repetiu os avisos de padrões PWA sem correspondência (`icons/*`, `manifest.webmanifest`) já registrados na revisão anterior; nenhum código/PWA mudou nesta entrega. Os dois registros foram formatados/conferidos após inserir os resultados. As três reprovações independentes Flow permanecem explícitas; checks documentais não homologam a barreira. `.env`/`.vscode/` locais fora da entrega.
