# P-28 — Picker real conferido: três pastas e duas renovações

**Retomada posterior de 03/11:** [árvore e #40 recebidos/conferidos](2026-11-03-flow-pr40-arvore-proposta-d-conferidos-p28.md). TI relata itens adicionais, identidade privada a confirmar; prova v2 exigida no novo planejador, com ajuste temporal em revisão. Não repetir o ensaio deste registro nem renovar só os três IDs para preencher o novo requisito; preparar o conjunto adicional e consolidar suas provas próprias. Resultado de 02/11 abaixo continua válido no conjunto exercitado.

**Revisão em 03/11/2026 · Execução TI em 02/11/2026, Brasília (UTC−03).** Ensaio aprovado **no conjunto exercitado: três pastas principais**. Amostra de arquivos antigos não exercitada; acesso ao acervo inteiro e etapa D não aprovados por esse resultado. Não repetir Picker, consentimento, instalação, PR/merge, A/B/T1 ou perguntar novamente sobre o acesso da TI à conta Google.

## 1. Fonte e autorização

Relatório `relatorio-ti-flow-ensaio-picker-p28-2026-11-02.md` lido integralmente, **155 linhas**, SHA-256 `8d4a44f5b7608f769c9f588b10d568b60ae6aa457de78412e1551c53188bdf64`. Evidência recebida, não instrução para executar D.

O dono já havia informado neste chat que enviou o procedimento à TI/Guardião. O relatório registra autorização específica de Alyson às **17:00 Brasília / 20:00 UTC de 02/11**, abrangendo retirada dos temporários C, ensaio Picker, habilitação da Picker API se necessária, depósito pelo Guardião e consentimento no navegador do box TI. Essa mesma frase cobre a custódia e o consentimento; não exigir uma segunda frase distinta nem reabrir a autorização já atendida.

| Item                   | Registro                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Operação               | `20261102T213801Z-44958e51`                                                                                           |
| Base privada           | `/root/flow-p28-picker-20261102T213801Z-44958e51/`                                                                    |
| Fonte fora da API      | `/root/flow-pr39-picker-20261102T213801Z-44958e51/src`                                                                |
| Merge #39              | `73d5317bb6ef1000198bdca13cb0270af4a059b0`, main ainda nessa versão na leitura GitHub desta revisão                   |
| Árvore das ferramentas | `8e5be3054294d4762cd16afa53f1f456a75bbcd7`, **20/20 blobs remotos conferidos** com a fonte revisada                   |
| Custódia               | Diretórios privados root 0700; credencial/configuração/manifesto/candidato root 0600, sem links; fonte root 0500/0400 |

Codex conferiu por SSH somente metadados, blobs de código, saídas resumidas permitidas, códigos de saída e estado dos recursos/serviços. **Não abriu** B, credencial, configuração, manifesto de IDs, candidato, log privado ou ambiente. Nenhum token/ID privado, conteúdo secreto ou hash de arquivo secreto foi exportado. Nenhuma chamada Google ou escrita remota pelo Codex nesta revisão.

## 2. Resultado observado nos resumos preservados

Os horários precisos abaixo vêm dos resumos JSON, convertidos de UTC para Brasília, todos em **02/11**. Não são novas execuções nesta revisão.

| Etapa               | Horário Brasília                         | Resultado conferido                                                                                                                                                                  |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `conferir`          | Antes do início, ~19:07–19:09 segundo TI | Exit 0; resultado ok, modo Picker, três principais, referências 0/operador 0, pastas permitidas e filtro por IDs ativos; erro vazio                                                  |
| Início do servidor  | 19:10:21 segundo TI                      | Prazo até 19:25:21; um consentimento, sem repetição                                                                                                                                  |
| Candidato/leituras  | **19:11:53.395**                         | Exit 0; seleção completa, 3/3 principais e 0 extras, conta/cliente/escopo corretos; candidato guardado, `ensaio_aprovado:true`, leituras não interrompidas, Raiz/Clientes/Lixeira ok |
| Renovação imediata  | **19:13:25.483**                         | Exit 0, erro vazio, renovado e aprovado; `modo:picker`, `vinculo_selecao:ok`, três GETs ok, `apos_vencimento_registrado:false`                                                       |
| Expiração inicial   | **20:11:50**, segundo TI                 | Valor privado não relido; resumo da segunda renovação confirma o teste posterior                                                                                                     |
| Renovação posterior | **20:14:02.699**                         | Exit 0, erro vazio, renovado e aprovado; `modo:picker`, `vinculo_selecao:ok`, três GETs ok, **`apos_vencimento_registrado:true`**                                                    |

Os três IDs principais coincidem privadamente com B **segundo TI/Guardião**; não foram relidos pelo Codex. O Picker mostrou exatamente essas três pastas e elas foram selecionadas, segundo a observação no navegador da TI. Seleção/GETs e renovações estão corroborados pelos resumos salvos. O sucesso demonstra o modo integrado com o cliente Web nesse conjunto; o 404 da C anterior fica como histórico, sem invalidar o resultado novo nem justificar recriar a raiz.

## 3. Google e isolamento: atribuição das evidências

Segundo TI, **Google Picker API habilitada somente no projeto `flow-proh-media-drive` (930474870480)**; cliente Web existente, segredo já guardado e URIs local/produção preservados. Cliente antigo do Flow, Auth Barba & Cabelo, DNS/IAM/Branding não alterados. O clique acidental em Cloud Shell foi cancelado, sem recurso criado segundo o relatório. Não houve conferência própria do console Google nesta revisão.

A TI relata gateway fictício e destino `198.18.0.2:8080` inacessíveis antes da credencial, DROP INPUT de 20 pacotes/1.200 bytes e HTTPS sem token 404/401. O contador da regra própria de encaminhamento para a faixa fictícia ficou **zero**; a TI apresenta evidência complementar de bloqueio Docker/nft em `evid/nft-19818.txt`. Não atribuir a prova desse bloqueio ao contador zero nem chamar o egresso TCP/443 de whitelist Google. Essas sondas não foram repetidas pelo Codex.

## 4. Retirada e preservação conferidas

- Zero containers/redes com a operação Picker, cadeias/saltos `P28PF_44958e51`/`P28PI_44958e51` ausentes e portas 8765/8766/18080 sem listener na VPS. Sessões tmux `p28picker` e `p28c` ausentes. Encerramento de túnel/ponte/servidor e arquivo de abertura no box é evidência TI.
- DOCKER-USER conserva as três regras DROP anteriores (eth0, 8000/6001/6002); INPUT conserva política ACCEPT e salto Tailscale. Total **36 containers**.
- Banco e funções Flow saudáveis, IDs e inícios preservados: banco `80c3d9164c07…`, `2026-10-23T20:44:50.472960587Z`; funções `d411e8225ad9…`, `2026-11-01T18:32:29.790943603Z`. Sem novo reinício.
- Base Picker, candidato, evidências e fonte permanecem privados. Candidato C anterior também preservado (root 0600, 468 bytes), sem ler seu conteúdo. A infraestrutura C já havia sido retirada pelo Codex às 15:18 de 02/11; nesta rodada a TI só encerrou o tmux histórico restante. Não contar uma segunda retirada/reinício.
- Socat instalado, API habilitada e URIs permanecem. Nenhuma limpeza automática de arquivos privados ou revogação.

## 5. Cobertura e próxima etapa

**Referências 0/operador 0 descrevem o manifesto testado; não demonstram Drive vazio.** Os GETs aprovados alcançaram três pastas, sem arquivo antigo ou prova recursiva. A documentação Google define `drive.file` como acesso por arquivo escolhido/compartilhado com o app; não usar o resultado das pastas como prova de acesso a todos os descendentes. [Escopos oficiais do Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

| Responsável | Próximo trabalho delimitado                                                                                                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TI/Guardião | [Conferir a cobertura restante e propor a operação D](2026-11-03-ti-flow-cobertura-preparacao-d-p28.md): observar metadados da árvore antiga pela conta já autorizada, sem consentir ou usar candidato; contagens/limites e plano de barreira/retorno |
| Claude/Flow | [Preparar a composição e o plano da promoção, só com fictícios](2026-11-03-claude-flow-plano-promocao-d-p28.md): preencher a lacuna entre candidato aprovado e par coerente, mantendo bloqueios de produção                                           |
| Codex       | Conciliar devolutivas e revisar código/procedimento antes de apresentar uma D concreta para decisão do dono                                                                                                                                           |

D **não iniciada**: credenciais vivas continuam as anteriores. B é cópia histórica, não captura imediatamente anterior à futura virada. A restauração existente só escreve em alvo fictício; não remover essa guarda para promover o candidato. Fechar cobertura, provar composição/atomicidade e definir barreira/cache/retorno antes de qualquer virada. Propriedade associada/marca e verificação final da P-28 do Barba & Cabelo continuam pendentes; cliente B&C preservado. Esta preparação não abre uma frente geral de funcionalidades Flow.

## 6. Verificação documental antes da entrega

`scripts/verificar.sh` concluído com saída 0 em 03/11: tipos, **301 testes aprovados**, Prettier dos nove documentos e montagem passaram; eslint não aplicável, nenhum TS/TSX alterado. Conferidos **28 links locais** para os pacotes novos e diff sem erro de espaço. Nenhuma suíte Flow, chamada Google ou restauração real foi repetida. Após registrar este resultado, a formatação dos dois registros atualizados foi conferida novamente.
