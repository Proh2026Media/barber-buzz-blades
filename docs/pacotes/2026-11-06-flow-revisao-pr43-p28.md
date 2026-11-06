# P-28 — Revisão do #43: correções confirmadas e três pendências

**06/11/2026 · ChatGPT/Codex · Revisão e ensaios fictícios.** Relatório `relatorio-claude-flow-ajustes-pr42-p28-2026-11-05.md` lido integralmente: **137 linhas**, SHA-256 `4dabc6e0a824146b2ee21981a6b255fe711060c20b83c02d2ea9e850305137d1`. [Pedido anterior](2026-11-05-claude-flow-ajustes-pr42-p28.md) e [revisão do #42](2026-11-05-flow-revisao-pr42-p28.md).

**Resultado:** os controles das quatro correções anteriores passaram. Restam **três pendências**, reproduzidas em quatro casos negativos: incertezas anteriores deixam de bloquear sem reconciliação; carência não comprova término dos uploads legados; e frontend antigo não finaliza com a barreira fechada. **Barreira/virada ainda não homologadas.** [Arquivo único para Claude/Flow](2026-11-06-claude-flow-ajustes-pr43-p28.md).

Esta continua sendo a dependência da **P-28 do Barba & Cabelo**: separar o Drive do Flow do projeto Google compartilhado, preservando o login do B&C. Ensaio dos 15 concluído; D não autorizada e não executada.

## 1. Anexo e GitHub

O anexo descreve um rascunho, mas o GitHub registra o [#43 integrado](https://github.com/Proh2026Media/flow-proh-media/pull/43) em **05/11 às 13:42:16 Brasília** (`16:42:16Z`). Esse estado posterior prevalece; não pedir outro merge.

| Identificação                 | Conferência própria                        |
| ----------------------------- | ------------------------------------------ |
| Base #42                      | `3c77d329667adc13ed01767598307545af579d37` |
| Head #43                      | `129e63ea2627716cba0d5f0dc1b48a8ff6fbe298` |
| Merge, origem e espelho       | `ff4471debf671f42a42fa55896a26c900e868e9b` |
| Árvore completa, head e merge | `e088bc6bcf9e5cfb7e253bf53ff0b26e59dbe2a8` |
| Ferramentas, 27 arquivos      | `b562503eaeaf21b57cdfc00169b900d90675f411` |
| Função, 5 arquivos            | `3b7aa5e5a81cbde6a2846464b0c4725bf29d6cb7` |

Os **oito arquivos/blobs do delta** coincidem com o manifesto do anexo. AGENTS permanece `39431fcc3af1a362593c85210f8b151d894e90af`. Fonte do ensaio: **35 blobs verificados**, incluindo ferramentas, função, AGENTS, package.json e hook. Guardas de alvo fictício preservadas; instaladores/migrations sem alteração. O hook participa da publicação do site; integrar o PR não instala a função na VPS.

## 2. Verificações próprias

| Verificação                                                    | Resultado                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Ferramentas + PostgreSQL 15.8 fictício, Linux/amd64, Bun 1.4.2 | **154 passaram, 0 falharam, 0 pulados**, 1.820 assertivas, saída 0 |
| Vitest nativo (`bun run test`)                                 | **128/128**, incluindo 22 barreira e 94 proteção                   |
| `tsc -p tsconfig.app.json`                                     | Saída 0                                                            |
| ESLint ferramentas, função e hook                              | Saída 0                                                            |
| Nove testes independentes, mesma fonte e PG                    | **5 passaram / 4 falharam**, 22 assertivas, saída 1                |

O comando das ferramentas foi `P28_PG_URL_ARQUIVO=<arquivo fictício 0600> bun test ferramentas/p28-drive`. A diferença para as 1.821 assertivas macOS do anexo está na verificação condicional `/private/var/` de `teste/unidade.test.ts:293`. Tipos estritos Bun e sabotagens relatados continuam evidências Claude, não checks próprios desta revisão.

Independentes executam classe real, funções de upload e CLI de promoção/retorno contra PG. Google simulado, fetch real bloqueado; handler Deno completo não executado. Para legado, hook real com somente as importações React/Supabase substituídas e XHR simulado; relógio da drenagem avançado **25 h simuladas**, sem esperar esse tempo ou chamar Google/browser reais.

PG em rede Docker internal exclusiva, sem portas publicadas/dados reais; executores com fonte/raiz somente leitura e capacidades removidas. Ao terminar, **três containers próprios, volumes anônimos associados e rede** retirados; 35 blobs intactos e checkout Flow limpo. Artefatos fictícios em `barba-p28-pr43-ed83bbn3`, fora do B&C.

## 3. Correções atendidas

| Pedido do #42          | Resultado no #43                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — ciclo de upload    | Sessão nova registrada antes da resposta; bloqueia durante envio; continuação do dono termina em 200 e depois drena. Transição ainda pendente, F2/F3. |
| B — corrida da limpeza | Pausar marcação, fechar e liberar mantém `incertas=1`, sem prova. Reclassificação anterior ainda pendente, F1.                                        |
| C — posterior esperado | Retorno devolve **3/divergente**, preservando alteração posterior. Controle normal **0/retornado**.                                                   |
| D — resposta perdida   | Reabrir pelo próprio módulo após COMMIT e lançar erro devolve **3/barreira_perdida**, `par_observado: promovido`.                                     |

## 4. F1 — incerteza anterior pode liberar drenagem sem prova

`virada.ts:121–130` converte todas as `incerto` em `incerto_anterior` ao fechar. `lerEstado`, `drenar` e `exigirOperacional` excluem essa classe dos bloqueios. Preservar a linha/contagem não comprova o efeito externo.

**Caso 1:** ação da classe retorna 502 antes de fechar, modelando resposta externa perdida com efeito desconhecido. Há `incertas=1`. Fechar converte para `incertas_anteriores=1`, `incertas=0`; **prova emitida sem reconciliação**.

**Caso 2, sem depender dessa modelagem externa:** admitir → fechar → encerrar com falha. Drenagem recusa corretamente. Abrir e fechar novamente, sem tratar a falha, passa a emitir prova com `incertas_anteriores=1`. A geração nova contorna a recusa anterior.

O contrato anterior permite distinguir falha comprovadamente sem efeito, com prova; anterioridade não é essa prova. Corrigir drenagem, condição dentro do LOCK e reconciliação, incluindo linhas `incerto_anterior` existentes. O teste B2 atual valida a liberação sem comprovação e deve acompanhar o contrato corrigido.

## 5. F2 — carência não comprova fim de upload legado

`virada.ts:148–157` aceita zero após `drive_instalacao.desde + carencia_h`. A primeira chamada nova não prova o último início antigo nem o término do envio externo. O hook faz PUT único, mas **não configura `xhr.timeout`**, nem interrompe o envio pela instalação/fechamento.

**Caso:** hook recebe init antigo sem ticket; PUT permanece pendente. Registrar marco, fechar e avançar relógio 25 h com carência 24 h: **prova emitida**, `put_pendente=true`, `xhr_timeout=0`. É teste do limite lógico, não ocorrência real observada durante 25 h.

XHR condiciona o prazo automático a timeout diferente de zero. Drive documenta sessão por uma semana. A conclusão é uma **inferência do código e desses contratos**, corroborada pelo caso simulado: não retomar upload interrompido não demonstra fim do PUT original em 24 h. [Padrão XHR](https://xhr.spec.whatwg.org/#the-timeout-attribute), [uploads do Drive](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

A sugestão de 24 h permanece **não adotada**. A transição precisa de corte efetivo dos inícios antigos e prova de término/reconciliação das pendências. Prazo pode auxiliar a janela; trocar apenas o número não demonstra essa condição.

## 6. F3 — frontend antigo trava o finish admitido

Uma aba antiga ignora o ticket do init novo. `resolverFinish` recupera ticket das appProperties se a rota for admitida; porém `index.ts:1629–1650` autoriza continuação fechada só pelo ticket do corpo, antes do handler consultar o arquivo.

**Caso com classe/funções reais e PG:** registro pendente do mesmo dono; sem ticket no corpo, resolução com barreira aberta é `ticket`. Fechar e pedir finish como no roteador retorna **503**, handler não executado, `uploads_pendentes=1`. Controle do frontend novo com ticket termina em 200 e drena.

É falha de compatibilidade/continuidade, **não falso zero**: o registro permanece bloqueando a janela. Hook novo compatível com #36 não cobre a combinação inversa. Corrigir continuação autorizada ou transição verificável para abas antigas, preservando dono/permissões e recusa de finish arbitrário; esperar/recarregar página não basta como prova.

## 7. VPS conferida em 06/11

Leitura SSH própria às **10:46:39 Brasília**, somente tamanho/hash de arquivos e saúde dos serviços, sem ambiente/banco/credenciais ou escrita remota:

| Artefato/serviço   | Resultado                                                                         |
| ------------------ | --------------------------------------------------------------------------------- |
| `index.ts` vivo    | 83.446 bytes, blob `e0db47fccb1e7e52852f385cc227b8df21d574d1`, #36                |
| `protecao.ts` vivo | 20.558 bytes, blob `711879fb7b390fbabfdd67c203139e975ea80f3f`, #36                |
| `barreira.ts` vivo | **Ausente**                                                                       |
| Banco              | `80c3d9164c07…`, healthy, início `2026-10-23T20:44:50.472960587Z`, RestartCount 0 |
| Funções            | `d411e8225ad9…`, healthy, início `2026-11-01T18:32:29.790943603Z`, RestartCount 0 |

Merges #42/#43 não instalaram a barreira no estado observado. Achados são dos ensaios fictícios, não ocorrências identificadas em dados reais. Nenhuma instalação, promoção, manutenção ou alteração Google feita nesta revisão.

## 8. Próximo passo

[Claude/Flow corrige F1/F2/F3 em novo PR](2026-11-06-claude-flow-ajustes-pr43-p28.md), preservando o atendido. Agora não há execução para TI. Após revisão, preparar instalação/ativação e D como operações concretas próprias para decisão do dono; propostas do anexo não as autorizam. A/B/T1, Picker dos 15, candidato/B e cliente B&C preservados.

## 9. Verificação da entrega documental B&C

`scripts/verificar.sh` saída 0: tipos, **301 testes B&C**, Prettier dos oito documentos e montagem aprovados; eslint não aplicável, pois nenhum TS/TSX alterado. **24 links locais novos** conferidos e diff sem erro de espaço. A montagem emitiu avisos de padrões PWA sem correspondência (`icons/*` e `manifest.webmanifest`), sem alteração de código/PWA nesta entrega. Os dois registros foram formatados/conferidos novamente após inserir estes resultados. As quatro reprovações independentes Flow continuam explicitadas; a verificação documental não homologa a barreira. `.env`/`.vscode/` locais fora da entrega.
