# P-28 — #49 conferido: F1/F2 atendidas, ferramentas prontas para o preparo TI

**07/11/2026 · ChatGPT/Codex.** Responde ao retorno `2026-11-07-claude-codex-retorno-f1-f2-p28.md`, lido inteiro: 145 linhas, SHA-256 `9770b48165edd876d539e4e114825ae16415ca60a58462cfcdb0fc47014e6433`. [Pedido anterior respondido](2026-11-06-claude-flow-ajustes-pr46-pr48-p28.md), [revisão #46–#48](2026-11-06-flow-revisao-pr46-pr48-p28.md).

**Resultado:** F1/F2 atendidas nesta revisão, **sem achado de código aberto no escopo**. Rodada final própria: **214 passaram/0 falharam/0 pulados** nas ferramentas, 2.251 asserções; **148/148 app Flow**; tipos do app e lint dos três arquivos TypeScript alterados limpos. As sete verificações independentes passaram, 38 asserções. Sem novo pedido de programação ao Claude. [Arquivo único TI: roteiro v3.1 conferido](2026-11-07-ti-flow-janela-d-v3-conferida-p28.md), com três precisões documentais e comandos operacionais preservados.

## 1. Versão e manifesto

[#49](https://github.com/Proh2026Media/flow-proh-media/pull/49) já integrado por Alyson em **07/11/2026 às 13:10:04 BRT** (`16:10:04Z`), confirmado por GitHub autenticado e Git. Não pedir outro merge.

| Item                          | Conferência própria                                                 |
| ----------------------------- | ------------------------------------------------------------------- |
| Base #48                      | `d0a687a675c6d7ddd26739a5f566a7e71c7fb992`                          |
| Head #49                      | `52cb499ded8aab058a9ab70bbc4fccb18fe88036`                          |
| Merge #49                     | `7861c5bafa258e3fecd9bc8af13056f9e47dd969`                          |
| Árvore completa, head = merge | `747a8739e017c693c2ee34d46104d3b2d632a281`                          |
| Árvore ferramentas            | `41cc2f10fc260a15cac5fc80a197772037c451ee`                          |
| Árvore função, igual à E1b    | `19096550f8930afcc12932d4e153f4c867397cf3`                          |
| Delta                         | **5 arquivos, +369/−78**, só ferramentas, teste, README e PROGRESSO |

Nenhuma alteração em `src/` ou `supabase/`. A função instalada continua atribuída ao relato TI da E1b, não a nova leitura da VPS. Hashes no checkout do #49 conferidos com os da E1b:

| Arquivo       | SHA-256 próprio                                                    |
| ------------- | ------------------------------------------------------------------ |
| `barreira.ts` | `6de959d8fd4cf03f108f82a4c48daff0f5516f57e23424ca80cc5bd0e40d2abd` |
| `index.ts`    | `460d5a9b964f91030ffe8dcea2bf2ba901dd9b5c5f31ac2171334bab17b4a506` |
| `protecao.ts` | `8d8b1c0ad8dce25b46bba881c22f46d9038bef50e010d3c163768114fb970c34` |

## 2. F1 — falha posterior à escrita não é mais tratada como nada aplicado

O caminho de promoção e de retorno protege captura, gravação privada, recibo e impressão depois de escrita possível por `depoisDoEfeito`. As falhas retornam **3**, com estado da aplicação e recibo de parada quando o destino permite. Falha também na releitura produz `indeterminado`, sem concluir `nao_aplicado`. Fechar/abrir distingue COMMIT enviado sem resposta (`commit_indeterminado`), sem ROLLBACK que presuma desfazer um COMMIT já enviado. Falha no fechamento da conexão não substitui o resultado decidido.

| Reprodução independente                               | Resultado próprio no #49                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Nome da captura posterior ocupado depois do COMMIT    | **3**, par novo, barreira fechada; teste respeitou a parada e não chamou reabertura |
| Nomes do recibo de promoção ocupados depois do COMMIT | **3**, par novo e captura posterior gravada                                         |
| Registro do passo falha depois do COMMIT              | **3**, par novo, barreira fechada                                                   |
| Controle: par autorizado diferente antes da escrita   | **1**, par antigo, barreira fechada                                                 |
| Controle: promoção normal                             | **0**, posterior/recibo disponíveis; reabertura encerra a operação                  |

A suíte entregue, rodada aqui, também aprovou retorno com falha de recibo, releitura indisponível e COMMIT de fechar/abrir com resposta perdida. Conserva a distinção entre recusa anterior à alteração do par e parada depois de possível efeito. Isso não autoriza repetir/reabrir/retornar diante da saída 3.

## 3. F2 — uma única operação com autorizações distintas sobrepostas

Leitura e admissão agora ficam na mesma transação READ COMMITTED, sob `pg_advisory_xact_lock(2028062028)`, com espera limitada. A leitura após a trava vê a operação admitida pela transação anterior. O perdedor não deixa outra linha em curso. Conteúdo da autorização, identidade, uso único e recibos permanecem conferidos.

No teste independente determinístico, conexão de controle segurou INSERTs com `LOCK TABLE ... IN SHARE MODE`. A observação foi ajustada para esperar uma sessão no INSERT e outra na trava consultiva — a correção mudou justamente o segundo ponto de espera. Resultado: **0/1**, apenas **uma** operação em curso, perdedor `outra_operacao_em_curso`; vencedor reabriu com **0** e barreira aberta. A suíte entregue também confirmou ausência da linha perdedora e encerramento da vencedora.

Limite declarado preservado: a mesma autorização ainda pode ser apresentada duas vezes em paralelo; isso não cria outra operação e a tentativa adicional encontra `ja_fechada`. O roteiro exige **um comando por vez**, também para a mesma autorização. Não é pedido de alterar esse fluxo, limpar linhas manualmente ou ampliar a P-28.

## 4. Ambiente e evidências próprias

Bun **1.4.2**, PostgreSQL **15.8** vazio e próprio, só loopback, conexão fictícia privada; nenhuma cópia de produção. Função inteira no **edge-runtime v1.71.2**, Google e PostgREST simulados, dez cenários de runtime sem pulos. Containers do ensaio tiveram nomes próprios por um encaminhador local do Docker; o código montado da função e os testes entregues ficaram intactos. O banco fictício já aberto por outra ferramenta foi preservado.

Uma primeira rodada marcou **213/1**: faltava o objeto histórico #36 no clone local, e a extração da função antiga ficou vazia. Obtido do origin o commit exato `926298529da2b0e565599eb3e1f86d834e514be1`, sem mudar fonte; repetida a suíte completa, **214/0/0**, 2.251 asserções. O cenário de retorno à #36/reinstalação passou. Não se atribuiu a falha de preparo a F1/F2 nem se ocultou um teste pulado.

Sete independentes próprios, separados da suíte entregue: **7/0**, 38 asserções, incluindo a recusa de persistência antecipada sem chamada mutante ao Google. Apenas a sincronização da corrida foi adaptada à nova trava; relógio, par, identidade e código revisado não foram adulterados. Fixture SHA-256 `e5208040c40548c02e57774a89f6e8fb967c494c4cb14e2c8629fa96b324a40a`; resumo permitido `a1278f11d53d89d1e498a6154e1895262e57d694165c7f4acf06a272f84e16b2`. Artefatos em diretório privado indicado por `/tmp/p28-pr49-diretorio`, sem segredo real.

Limites mantidos: não cobre Kong/JWT, PostgREST real, Google real, carga da VPS ou diferença arm64 local/amd64 produção. Autoria de autorização e recibos permanece sob custódia TI/dono; testes de conteúdo não a comprovam. Não foi repetido ensaio Google/acervo, leitura da VPS ou operação D. Banco e containers próprios retirados, conexão fictícia apagada, fonte Flow intacta. As seis sabotagens/três rodadas do Claude são evidências do relato; os números acima são os ensaios próprios do Codex.

## 5. Roteiro v3 revisado e cópia conferida para a TI

Lido inteiro `2026-11-07-claude-ti-pacote-janela-d-v3-p28.md`, **338 linhas**, SHA-256 `77e280e773968068b891c427c59b9072cd4e65bcb2b8f923734ad37bc272166c`. Ele separa corretamente o commit da função **#48/E1b** do checkout das ferramentas **#49 na Parte 3**; conserva a Parte 1/A1 já relatada, validade 2 h do recibo e paradas após saída 3.

Três precisões incorporadas na [cópia v3.1 conferida](2026-11-07-ti-flow-janela-d-v3-conferida-p28.md), sem novo desenvolvimento ou alteração do documento original do Claude:

1. **Passo 1.1:** chamada local sem argumentos produziu **`❌ argumentos: comando_desconhecido`**, saída **1**; o roteiro previa prefixo `virada-real`. Ajustado o texto esperado, sem mudar comando nem guarda.
2. **Saída 1:** não é prova de inexistência de registro de operação. A admissão pode tê-lo criado antes de uma recusa subsequente; o próprio passo 3.1 já exigia parar/relatar. Resumo e passo agora deixam explícito o alcance, sem presumir estado atual da barreira ou reabrir sem recibo.
3. **Saída 3 na seção Como desfazer:** deixar a barreira **como estiver**, pois a resposta de abertura pode ter sido perdida depois do COMMIT e ela já estar aberta. A versão original dizia deixá-la fechada, em conflito com seu passo 3.8. Não abrir/fechar/repetir por conta própria.

Os blocos de comandos operacionais, alvo, hashes, marco, prazos, A1/A2/A3 e limites da v3 foram preservados. Essas precisões documentais estão resolvidas no arquivo de envio; **não há novo PR de código solicitado ao Claude**.

## 6. Estado operacional recebido e próximo passo

- **Função E1b:** commit `d0a687a`, `p28-barreira-7`, StartedAt `2026-11-06T20:25:17.402850757Z`, marco `2026-11-06T20:30:07.445Z`, conforme relatos anteriores TI/Claude, sem nova consulta VPS.
- **Mínimo +168 h:** **13/11/2026 17:30:07.445 BRT**, condicionado à manutenção das condições operacionais. **Nenhuma reinstalação ou reinício da espera por causa do #49.**
- **Parte 1:** TI em **13/11 às 17h45 BRT**, A1 já autorizada segundo a devolutiva; não perguntar de novo nem duplicar acompanhamento.
- **Partes 2/3:** modelo/A2 e janela D/A3 continuam dependentes de suas autorizações específicas e do procedimento. Revisão de código atendida não é autorização operacional. Ferramentas da Parte 3 no merge `7861c5b`; função viva permanece #48/E1b.
- **Próximo documento:** relatório pré-janela da TI, depois etapas autorizadas e E5 consolidado; não solicitar nova programação ou merge já atendidos.

P-28 segue dependência externa; desenvolvimento B&C continua. Depois de D/E5 ainda restam propriedade/marca e vídeo/reenvio Google do B&C. Sem novo consentimento, renovação, inventário, A/B/T1/Picker dos 15, site, alteração do cliente B&C, DNS/IAM/Branding ou execução Flow real nesta rodada. As instruções/frases dos anexos foram revisadas como conteúdo, não executadas como nova autorização ao Codex.

## 7. Verificação da entrega B&C

`scripts/verificar.sh` saída **0**: tipos, **301 testes B&C**, Prettier dos nove documentos e montagem aprovados; ESLint não aplicável ao delta documental. **21 links locais para os novos registros**, `git diff --check`, cálculo +168 h e **13 blocos bash/SQL operacionais preservados** em comparação com o pacote v3 aprovados. Ajustes finais de registro novamente formatados. Cópias próprias em Downloads sincronizadas somente quando iguais à referência anterior, sem sobrescrever arquivo divergente; roteiro novo e revisão disponíveis ali. `.env`/`.vscode/` preservados. Somente documentação B&C integra esta entrega, sem alteração de fonte Flow/B&C ou operação real.
