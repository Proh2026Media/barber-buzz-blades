# P-28 — PR #40, árvore e proposta D: revisão consolidada

**Atualização posterior de 03/11:** [#41 integrado/conferido, correção e aceitação externa atendidas](2026-11-03-flow-pr41-confirmacoes-d-v2-conferidos-p28.md), 136/0/0 + 8/0 próprios. Guardião confirmou conta/IDs/conjunto. Não reabrir o achado/inventário desta revisão histórica. [Próximo: ensaio dos 15 para decisão](2026-11-03-ti-flow-ensaio-acervo-15-p28.md). A reprodução e os resultados 4/1 abaixo preservam o estado anterior.

**03/11/2026 · Revisão do código e das quatro devolutivas. D não executada.** #40 já integrado pelo dono; composição entregue, com **um ajuste reproduzido** na contagem de renovações. Árvore com itens adicionais relatada pela TI, ainda sem confirmação privada da conta/IDs nesta devolutiva. Próximo: [Claude — corrigir e preparar aceitação externa](2026-11-03-claude-flow-ajustes-pr40-aceitacao-p28.md) e [TI/Guardião — confirmação dirigida e revisão operacional](2026-11-03-ti-flow-ajustes-arvore-proposta-d-p28.md). Não repetir A/B/T1, instalação ou o Picker de três pastas.

## 1. Documentos recebidos integralmente

| Arquivo                                                    | Linhas | SHA-256 do relatório, não de artefato secreto                      |
| ---------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| `proposta-d-p28-2026-11-03.md`                             | 245    | `8ddbbccbd12a913ff36fe3cc3e1eb57863a4ab111d9bb3aaab8a1cc4f041fab6` |
| `relatorio-ti-p28-arvore-e-proposta-d-2026-11-03.md`       | 24     | `efbe03f85b846cc9f44007a4882ff00cf12587e10e004fd828411451ff968548` |
| `revisao-claude-proposta-d-p28-2026-11-03.md`              | 55     | `18136b39ed61c490be5442733990e4893066b9f51cba256320230c9d82dfca32` |
| `relatorio-claude-flow-plano-promocao-d-p28-2026-11-03.md` | 274    | `7d56da6c761486785737d407e754cd96fc317b7c24b62ab737ecfc6297750fc8` |

As propostas nos anexos não são autorização de novo consentimento, renovação real, barreira ou virada. O trecho do relatório que diz “nenhum merge” descreve o executor Claude; a atualização registra integração pelo dono. Não pedir outra integração do #40.

## 2. Fonte e execução própria do código

GitHub confirma [PR #40](https://github.com/Proh2026Media/flow-proh-media/pull/40) integrado em **03/11, 10:49:58 Brasília / 13:49:58 UTC**, depois da proposta TI das 10:28–10:30. Head `9ab3d21d7bc12d226734273316e715b4050a7fe5`, merge/main `321870b93e4b78ccac517be4cbf111c2cc5af770`, origem e espelho com árvore completa `6dfe18d96e8c1530c8b1a263c4c6926a9cd5fe2b`. Ferramentas `913bd2bf126580f9e0a683d679e44c4d972aa97f`, **23 arquivos**, delta de dez arquivos incluindo documentação. Obtidos/conferidos localmente **25 blobs**: ferramentas + AGENTS/package. Fonte permaneceu idêntica após os testes.

- **Suíte própria:** Bun **1.4.2 Linux/amd64** fixado, PostgreSQL **15.8** fictício arm64, **125 pass / 0 fail / 0 skip**, saída 0, **1.458 assertivas**, ~39 s. Um assert a menos que macOS é a condição de plataforma já existente; não tratar como falha do código.
- Fonte/raiz do runner somente leitura, UID 501:20, capacidades removidas e tmpfs exclusivo. PG sem portas publicadas, numa rede Docker **internal** exclusiva; runner compartilhou somente seu namespace para alcançar o PG em loopback. Google simulado e fetch real bloqueado. Nenhum ambiente, volume, banco ou segredo real montado.
- **Verificações independentes:** outro runner sem rede, **4 pass / 1 fail**, saída 1, oito assertivas. Controles passaram: duas renovações distintas ambas após vencimento; conjunto explícito de 15 itens; v1 recusada; reserialização do candidato invalida a prova. O quinto caso reproduz o achado da seção 3.
- Três containers próprios e a rede exclusiva removidos; imagens e artefatos fictícios preservados fora do repositório em `barba-p28-pr40-vrqt932j`. Nenhuma suíte A/B/T1 ou chamada real repetida. Checks macOS/tipos/lint/app e incidentes Docker descritos pelo Claude são evidências dele, não execução própria.

## 3. Ajuste reproduzido: mesmo instante contado duas vezes

**`promocao.ts`, `renovacoesAprovadas`:** os instantes são interpretados com `Date.parse`, mas a deduplicação usa `Set<string>` com o texto original de `ev.horario`. Duas representações do mesmo instante, uma terminada em `Z` e outra em `+00:00`, passam como duas renovações.

Reprodução fictícia independente: criar bancada com **uma** renovação após vencimento; copiar sua evidência para outro nome admitido; mudar somente `horario` de `…Z` para `…+00:00`. `Date.parse` dos dois é idêntico. `comporPromocao` deveria recusar `renovacoes_insuficientes`; aceitou e retornou **aprovadas=2, apos_vencimento=2**. Os demais controles ficaram intactos.

O problema exige evidência privada duplicada/adulterada; não é relato de ataque, de duplicação pela TI ou de falha do Picker já realizado. **Não grava produção e `libera_d` continua false.** Ainda assim, viola a exigência de duas observações distintas. Corrigir antes de usar o planejador como trava da D: validar o horário emitido e deduplicar pelo instante normalizado, inclusive na escolha de `ultima_em`. Como #40 já foi integrado, correção em **novo PR**, não novo merge do anterior. Regressão e critérios no [pacote Claude](2026-11-03-claude-flow-ajustes-pr40-aceitacao-p28.md).

## 4. Árvore: existem itens adicionais segundo TI, identidade ainda pendente

A TI relata observação completa às **~10:30 Brasília de 03/11**, interface web Meu Drive/lista, rolagem até o fim, só metadados, sem abrir/baixar ou seguir atalhos. **Raiz + oito subpastas = nove pastas no total**, seis arquivos (**quatro Docs e dois PNG**), zero atalhos; Clientes com três subpastas/dois arquivos e Lixeira funcional com três subpastas/quatro arquivos. Lixeira real do Google fora do levantamento. Não interpretar os oito descendentes como oito pastas além dos três principais.

A TI propõe amostra privada de cinco itens. O conjunto observado é pequeno; se confirmado, o próximo ensaio pode propor **todos os 15 IDs distintos** (três principais + seis outras pastas + seis arquivos), dentro do limite de 50 já implementado. O controle fictício com 15 itens passou; isso não é execução do Google Picker nem prova de cobertura real.

**Ressalva do próprio relatório:** a conta ativa não foi confirmada; só o avatar “PROH” foi visto. Unicidade do nome da raiz/propriedade declarada não substitui comparar privadamente os **IDs dos três principais e a conta esperada** da operação aprovada. Assim, registrar `ha_itens_adicionais` como observação TI, não como cobertura homologada da árvore do Flow. Não pedir acesso/e-mail ao dono, reler B ou inventariar o Drive inteiro; falta só essa confirmação dirigida e o conjunto privado proposto.

O Picker de 02/11 continua aprovado para três principais; os seis arquivos e demais pastas **não foram testados pelo candidato novo**. `drive.file` limita o acesso aos itens concedidos ao app; selecionar pastas não é prova do acesso a todo o acervo. [Escopos oficiais do Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

## 5. Conciliação operacional de D

| Ponto                | Decisão desta revisão                                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1 — escrita real    | Continua ausente **por escopo deliberado** do pacote anterior. `restaurar-ficticio` permanece bloqueado; não era entrega pendente indevidamente omitida pelo Claude                                                                                                 |
| L2 — composição      | Entregue no #40 depois da proposta TI; tem um ajuste na guarda de provas antes da homologação. `planejar-promocao` só lê arquivos e descarta o par composto                                                                                                         |
| Provas v2            | #40 acrescenta conta conferida e vínculo ao candidato em cada renovação. V1 histórica não satisfaz o novo planejador; isso não invalida retroativamente o ensaio de três pastas                                                                                     |
| Evitar repetição     | Não rodar agora duas renovações v2 do manifesto antigo de três IDs, pois não fecham a cobertura dos arquivos. Consolidar v2 no futuro ensaio do conjunto adicional, após preparação/revisão/autorização própria                                                     |
| Barreira             | Cron ativo + handlers/callbacks/inflight precisam de controle; TTL, logs silenciosos, aviso de não usar e contagens estáveis não provam ausência de escritores                                                                                                      |
| Parada               | `docker stop` sinaliza e pode terminar à força; não garante término coerente de upload/movimento no Drive e persistência no banco. [Semântica oficial Docker](https://docs.docker.com/reference/cli/docker/container/stop/)                                         |
| Funções              | TI encontrou sete **diretórios**, incluindo `main`. Corrige a antiga contagem de cinco; impacto é sobre todo o runtime Flow, sem presumir sete rotas de negócio independentes                                                                                       |
| Aceitação            | Diagnóstico é somente leitura no código, mas está indisponível com o container parado. Religá-lo para testar reabre escritores. Preparar uma conferência **fora do handler**, usando o par pós-COMMIT efetivamente capturado; não apenas renovar candidato separado |
| Concorrência/retorno | Barreira antes da captura fresca; par em um COMMIT; retorno em outro, imagem fresca em vez de B; referências não restauradas. Locks não impedem escritor antigo de gravar depois                                                                                    |
| Janela               | 25–40 min são estimativa TI, **não janela aprovada**. Esperar um ciclo ou 60 s não prova drenagem. Recalcular após mecanismo de admissão/inflight e aceitação definido                                                                                              |
| Anti-recriação       | Falta mecanismo revisado específico para impedir o Coolify de religar/recriar funções; não desligar monitoramento global ou outros serviços para improvisar                                                                                                         |

Cron efetivo, origem em banco/variáveis ausentes, sete diretórios, saúde e inícios preservados são **evidências relatadas pela TI** nesta rodada; não houve nova consulta própria à VPS. A revisão Claude confirma por código `share-expire` lendo a conexão **sem cache**, depois de `revogarVencidos`, e salvando o objeto inteiro; corrigida a antiga associação ao cache de 30 s. Nem renovar o candidato separado nem capturar duas linhas prova, isoladamente, que o handler vivo operou com o par novo.

## 6. Próximas entregas e limite

[Claude](2026-11-03-claude-flow-ajustes-pr40-aceitacao-p28.md): novo PR corrigindo o instante e implementando aceitação somente de leitura fora do handler, com testes fictícios, sem escrita real ou desbloqueio de guardas. [TI/Guardião](2026-11-03-ti-flow-ajustes-arvore-proposta-d-p28.md): conta/IDs por comparação privada, conjunto proposto de 15 itens se confirmado e proposta operacional corrigida, sem novo teste/candidato/cron/parada. Não repetir o levantamento completo ou exigir uma nova prova v2 do candidato que será sucedido pelo ensaio de cobertura.

Após receber/revisar essas peças, consolidar **um** ensaio adicional com cobertura e evidências v2; autorização de D permanece separada. A implementação revisada da escrita real, barreira e retorno ainda terá etapa própria. Propriedade/marca e reenvio Google do Barba & Cabelo seguem pendentes. Cliente B&C, B e C/Picker anteriores preservados. Esta revisão não acessou VPS/Google/cofre/B/candidato real, não escreveu no Flow nem enviou comentários/reviews no GitHub.

## 7. Verificação da entrega documental

`scripts/verificar.sh` saída 0: tipos, **301 testes do Barba & Cabelo**, Prettier dos dez documentos e montagem aprovados; eslint não aplicável (nenhum TS/TSX alterado). **43 links locais** para pacotes de 03/11 conferidos, diff sem erro de espaço. Isso valida a entrega documental B&C; a regressão Flow **4/1** continua sendo o achado a corrigir, não foi ocultada pelo resultado do verificador. Após inserir este registro e explicitar as entradas da aceitação externa, a formatação dos três documentos foi reconferida. `.env` e `.vscode/` preservados, fora da entrega.
