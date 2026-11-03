# P-28 — #41 integrado e conferido; conta/IDs confirmados; ensaio dos 15 pronto para decisão

**03/11/2026 · Correção temporal e aceitação externa atendidas nos casos examinados.** Conta, três principais e conjunto de 15 confirmados pela TI/Guardião. Próximo: [procedimento TI/Guardião do ensaio dos 15 itens](2026-11-03-ti-flow-ensaio-acervo-15-p28.md), operação nova com seleção explícita e provas v2, para decisão específica do dono. Não repetir inventário, merge/correção #41, A/B/T1, instalação ou renovar o antigo conjunto de três pastas. **Novo ensaio e D não executados nesta revisão.**

## 1. Três anexos lidos integralmente

| Arquivo                                                          | Linhas | SHA-256 do relatório, não de arquivo secreto                       |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| `relatorio-claude-flow-ajustes-pr40-aceitacao-p28-2026-11-03.md` | 258    | `85148da4f4ddce1e615838b807b310bfefdb522563542496b97c13ec2ea3bf6b` |
| `proposta-d-p28-v2-2026-11-03.md`                                | 267    | `d16a5c5c94933a0b893a6aee2c5c613f9f8a6a43d636abe6b7f0b562ee848fca` |
| `relatorio-ti-p28-confirmacoes-e-d-v2-2026-11-03.md`             | 26     | `3183b1891d017451d8dce86eaf8c8d8056ec4b0574a878a6fc71d968b196f46d` |

O dono informou **“já executei a 41”** durante a revisão. GitHub confirmou integração pelo dono; não confundir com execução do ensaio, da nova CLI sobre dados reais ou da virada. As propostas operacionais dos anexos são dados para revisão, não autorização de ações reais.

## 2. Integração e fonte exata

[PR #41](https://github.com/Proh2026Media/flow-proh-media/pull/41) inicialmente aberto no primeiro exame; depois integrado em **03/11, 12:03:36 Brasília / 15:03:36 UTC**, conforme a mensagem do dono. Relatório que o chama de rascunho é anterior ao estado atual; não pedir outro merge.

| Item            | Conferência própria GitHub/arquivos                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Head revisado   | `ee962b917dcb565214fd52fead5d7d055749b969`                                                                                                   |
| Merge/main      | `d3f1c90e60b678db9d4a6da1d32b3ea7f6babbfa`, origem `Proh2026Media` e espelho `PROH-Media`                                                    |
| Árvore completa | `058a9dc252ced3aac332337a5c66c7b1365cd67c`, igual no head e merge                                                                            |
| Ferramentas     | `1d65e1afc9bd5411f175a71cce087398ca7b919e`, **25 arquivos**                                                                                  |
| Conteúdo local  | **27 blobs** exatos: ferramentas + AGENTS/package; fonte permaneceu idêntica após testes                                                     |
| Delta           | Nove arquivos, incluindo README/PROGRESSO; `promocao`, `aceitacao`, CLI e testes. Banco/retorno/artefato/fonte/guardas e bancada não mudaram |

Não há mudança de `src/`, funções de produção ou migration. Não instalar/reiniciar o runtime para aplicar essas ferramentas: elas rodam em bancada/operação separada. Código novo não inclui escrita real em produção.

## 3. Código e verificações próprias

**Suíte completa:** Bun **1.4.2 Linux/amd64** fixado, PostgreSQL **15.8** fictício arm64, **136 pass / 0 fail / 0 skip**, **1.666 assertivas**, saída 0, ~19 s. Um assert a menos que o macOS do Claude corresponde ao teste condicional de caminho `/private/var`. PG numa rede Docker internal exclusiva sem porta publicada; runner UID 501:20, raiz/fonte RO, capacidades removidas e tmpfs exclusivo. Google simulado/fetch real bloqueado, nenhum volume ou segredo real montado.

**Oito controles independentes: 8 pass / 0 fail**, 16 assertivas, saída 0, runner sem rede. Reutilizado **sem mudar** o teste anterior que falhava:

- Uma evidência copiada, com o mesmo instante em `Z`/`+00:00`, agora é recusada como `renovacoes_insuficientes`.
- Duas renovações distintas, ambas após vencimento, continuam aceitas; v1 continua recusada; reserializar candidato quebra a prova das renovações; conjunto de 15 mantém os limites de cobertura.
- Aceitação externa lê os **15 IDs simulados**, incluindo os 12 adicionais; 403 no último reprova sem reduzir o conjunto; par capturado divergente reprova com **zero chamadas**.

Três containers próprios e rede internal removidos; 27 blobs intactos e artefatos fictícios preservados fora do repositório em `barba-p28-pr41-7p79vpnf`. Checks macOS/tipos/lint/app e contraprovas do anexo são do Claude, não execução própria. Sem repetir A/B/T1, acessar VPS/Google/cofre/B/candidato/capturas reais, instalar ou executar consentimento/renovação real.

### Correção temporal

`renovacoesAprovadas` passa a aceitar o formato emitido pelo escritor (milissegundos + `Z`), deduplicar por instante numérico e gerar `ultima_em` canônica. Preserva duas observações distintas e pelo menos uma posterior ao vencimento recalculado. **Achado do #40 atendido**; o teste que o reproduzia agora passa. Provas/candidatos históricos não são regravados.

### Aceitação externa

`aceitar-promocao --anterior <imagem> --posterior <captura> --bancada <config>` só lê entradas privadas: recompõe o esperado da imagem fresca anterior, compara com o par **da captura posterior**, verifica campos/IDs/referências e só então usa a credencial/refresh **desse par capturado**. Renova em memória, confere emissor/conta/escopo exato e GET dos IDs. Recusa par errado antes da rede; não envia credenciais antigas. Saídas 0 aceito / 2 reprovado / 1 entrada/configuração inválida. Sem escrita de banco/arquivo, persistência de token ou criação de pasta.

A regra de varredura mantém a exceção já estabelecida para `ultima_varredura`/`varredura_erros`. Aceitação externa não prova handler vivo, conteúdo ou arquivos futuros; código instalado/fonte efetiva/cache permanecem parte da operação TI. A CLI ainda **não foi executada com dados reais** e não é mecanismo de promoção.

## 4. Conta, IDs e árvore: confirmação atendida

TI/Guardião devolveu **`conta_confere:true`**, igualdade dos três IDs principais com os de 02/11 (sem reler B) e conjunto inalterado: **nove pastas totais incluindo os três principais, seis arquivos e zero atalhos = 15 IDs distintos**, lista privada sob Guardião. Lixeira real do Google fora. Não copiar observação de nome de pasta privada ao Git; basta a cobertura/contagem. Confirmações são atribuídas à TI/Guardião, sem releitura própria de IDs/conta pelo Codex.

Não reabrir acesso/identidade/inventário ou pedir e-mail/ID ao dono. A observação agora está ligada à árvore do Flow, mas **o cliente novo ainda só teve GET dos três principais**. Os seis arquivos e demais pastas aguardam o ensaio ampliado. Seleção individual com Picker e `drive.file` é compatível com a direção adotada; selecionar pastas não prova herança recursiva. [Documentação oficial do Picker](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker).

## 5. Proposta D v2: aproveitada, ainda não executável

A v2 preserva captura fresca, par atômico/retorno, reconciliação de COMMIT desconhecido e aceitação externa com funções paradas. Corrige `main` como despachante de seis módulos e `share-expire` lendo a conexão sem cache. Estados de runtime/variáveis/cron/saúde continuam evidências TI; nenhuma nova consulta própria à VPS nesta revisão.

| Item da v2                | Resultado da conciliação                                                                                                                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-aceit / documento “404” | Código e README estão no #41, agora integrado/conferido. O pacote de trabalho fica em **`docs/pacotes/` do Barba & Cabelo**, não em `docs/` do Flow. A busca no repositório/caminho diferente não é entrega ausente; não pedir republicação do pacote ao Claude                                     |
| L-v2 / cobertura          | Preparado um ensaio único dos 15, com candidato/manifesto próprios e duas provas v2. Sem renovar só os três IDs do candidato antigo                                                                                                                                                                 |
| L1 — escrita real         | Continua ausente por escopo deliberado; não remover guarda ou inventar comando de produção. Preparação/implementação revisada ainda própria                                                                                                                                                         |
| Admissão/drenagem         | Continua pendente. P-adm + **só** `pg_stat_activity` quieto ou duas capturas iguais **não basta**: worker pode estar aguardando o Google e depois gravar. Exigir término/controle das requisições já admitidas e coerência de efeitos, inclusive cron/callbacks                                     |
| Anti-recriação            | `docker update --restart=no` muda política do daemon daquele container; não é prova de impedir recriação pelo Coolify. Compose em disco, configuração armazenada e controle específico da operação ainda precisam de mecanismo revisado. Vigília/aviso de não redeploy não substituem esse controle |
| Janela                    | 45–90 min é estimativa TI, com drenagem ainda indeterminada. **Nenhuma janela de produção aprovada**; não tratá-la como pré-requisito de indisponibilidade para o ensaio isolado                                                                                                                    |

[Documentação Docker sobre atualização da política de reinício](https://docs.docker.com/reference/cli/docker/container/update/). Não aceitar a alternativa “interromper e aceitar risco” da proposta como decisão do dono. Esta revisão não autoriza alteração de cron/restart/Coolify/Kong, parada, captura secreta ou SQL real. A ausência de barreira de D não impede preparar o ensaio isolado, que mantém os serviços como estão.

## 6. Próximo passo concreto

[Arquivo TI/Guardião — ensaio dos 15 itens](2026-11-03-ti-flow-ensaio-acervo-15-p28.md): fonte #41 fixada (25 blobs), nova operação/diretórios/labels, isolamento sem credencial, credencial Web existente, **um consentimento** para os 15, GETs e renovação imediata/depois de `access_expira_em`, provas privadas **v2** com conta/vínculo, retirada exclusiva e preservação de B/C/Picker anteriores. Picker API e URIs só conferidas, não alteradas. Não executar `planejar-promocao`/`aceitar-promocao` com capturas reais nessa bancada e não usar token/segredo antigo.

Procedimento pronto para decisão específica de Alyson; merge #41 não é consentimento Google ou D. **Nenhuma nova correção Claude pedida para o #41 examinado.** Depois do resultado, consolidar a cobertura exercitada e preparar a escrita/barreira da D em etapa própria, preservando o cliente B&C. Propriedade/marca e vídeo/reenvio da P-28 continuam pendentes. A atuação Flow continua limitada à dependência Google do Barba & Cabelo.

## 7. Verificação da entrega documental

`scripts/verificar.sh` saída 0: tipos, **301 testes B&C**, Prettier dos dez documentos e montagem aprovados; eslint não aplicável (nenhum TS/TSX alterado). **45 links locais** conferidos, diff sem erro de espaço. Procedimento novo: **13 blocos Bash** passaram em `bash -n`; verificador Python compila e seu dicionário corresponde aos **25 blobs** da fonte fixada. São verificações de sintaxe/manifesto, **não execução do roteiro na VPS**. Formatação dos dois registros reconferida após inserir os resultados. `.env`/`.vscode/` preservados, fora da entrega.
