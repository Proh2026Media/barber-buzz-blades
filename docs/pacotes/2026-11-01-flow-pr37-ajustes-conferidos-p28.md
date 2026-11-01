# P-28 — PR #37: quatro ajustes conferidos no commit 67e7fb7

**Atualização de 01/11, após a revisão:** PR #37 **integrado externamente às 18:57 Brasília**, main `13f1dc9` em origem e espelho; árvore idêntica ao head revisado abaixo. [Merge e procedimento TI conferidos; etapa A pronta para decisão](2026-11-01-ti-flow-pr37-runtime-ensaio-conferido-p28.md). As referências a PR aberto/decisão de merge nas seções seguintes registram o estado durante a revisão, já superado.

**Resultado da revisão:** os quatro pontos anteriores foram atendidos. Codex conferiu o delta e executou **86 testes aprovados**, além dos quatro casos independentes com o resultado corrigido. Não há novo ajuste impeditivo nesses quatro pontos verificados. Preparo e execução com material real continuam em etapas próprias.

## 1. Fontes e versão

Relatório entregue por Alyson: **`relatorio-claude-flow-revisao-pr37-p28-2026-11-02.md`**, lido inteiro. O arquivo tem 02/11 no nome e **01/11/2026 no cabeçalho**; a conferência desta rodada ocorreu em 01/11. Não inferir execução em produção ou autorização a partir do anexo.

GitHub confirmou [PR #37](https://github.com/Proh2026Media/flow-proh-media/pull/37) no head **`67e7fb785b7c11163438aa82a41e3d947a3ff212`**, um commit à frente de `90135bb4072f4b443ddf02cfd62582ab96a1e170`, base da main `926298529da2b0e565599eb3e1f86d834e514be1`. Delta de **11 arquivos**, todos em `ferramentas/p28-drive/`, +413/−68. Vinte arquivos da cópia isolada conferidos contra os blobs; módulos que não mudaram mantêm os mesmos hashes da revisão anterior.

Não houve alteração da função instalada #36, interface, migrations ou guardas existentes. Não repetir instalação, diagnóstico ou implementação da bancada por causa dos registros antigos que ainda descrevem o primeiro head.

## 2. Conferência do código e dos casos originais

| Ponto                       | Conferido no novo código                                                                                                                                 | Reprodução independente                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Escopo/código de saída      | `ensaioAprovado` exige renovação, cliente correto, escopo `ok` e leituras presentes/concluídas; CLI usa `ensaio_aprovado`                                | Escopo adicional retorna **2**, aprovação falsa, sem leituras                                         |
| Precisão JSONB              | Captura compara no PostgreSQL o texto JSONB original com o que seria regravado, na mesma transação; validador também verifica literais numéricos         | `9007199254740991.1` é **recusado**; original no banco permanece intacto                              |
| Estado parcial do candidato | Servidor/CLI acompanham candidato salvo; falha posterior e prazo conservam esse estado; callback encerrado não grava candidato tardio                    | Falha na evidência depois de salvar retorna **parcial**, `candidato_guardado: true`, arquivo presente |
| Symlink ancestral           | Caminho físico verificado por componentes, donos/modos; leitura usa descritor com `O_NOFOLLOW`/`fstat`; aliases de sistema macOS tratados explicitamente | Criação, gravação e leitura pelo ancestral linkado são **recusadas**; caminho físico válido funciona  |

Regressões da entrega também cobrem escopo insuficiente/leituras ausentes/interrompidas, erro antes do candidato, prazo antes/depois da gravação, ausência de vazamento, decimais preserváveis e não preserváveis e permissões físicas. A recusa conservadora de número/escala que não volte igual atende ao requisito de não aprovar cópia com valor alterado; não foi exigida aceitação de todo literal JSONB.

As quatro observações de [2026-11-01-flow-revisao-pr37-p28.md](2026-11-01-flow-revisao-pr37-p28.md) passam a ser **histórico do head `90135bb`**, não pendências atuais. A conclusão é limitada aos pontos e à versão examinados; não substitui validação da operação com credenciais reais.

## 3. Verificação independente executada

- Bun **1.4.2**; PostgreSQL **15.8** fictício em container exclusivo, inicialização vazia, porta aleatória somente em loopback. Nenhum banco da VPS usado nos testes.
- **86/86 testes**, **576 asserções**, incluindo os **22 testes de PostgreSQL**; zero falhas. Quatro regressões independentes adaptadas dos mesmos gatilhos anteriores, todas com a correção confirmada. Sem chamadas externas nos testes/reproduções.
- Sem dependências instaladas, sem copiar banco/credenciais reais. Container exclusivo e arquivo de acesso descartável removidos após o ensaio.
- Testes completos do app Flow (**106**), lint/tipos e cinco rodadas de estabilidade são resultados relatados pelo Claude; não repetidos integralmente pelo Codex. Não houve nova sondagem Google nesta rodada.

Apoios temporários: `/tmp/barba-p28-pr37-retorno.yMNq6q`, `regressoes-codex.ts`, `/tmp/barba-p28-pr37-retorno-testes.log` e `/tmp/barba-p28-pr37-retorno-regressoes.log`. Blobs conferidos antes da execução. Nenhum comentário/review, merge ou alteração no repositório Flow enviado por ferramenta.

## 4. Retorno TI aproveitado e complemento próprio

Localizado nesta máquina e lido inteiro **`relatorio-ti-flow-copia-integracoes-p28-2026-11-01.md`**, de **17:29–17:31 Brasília**. Ele confirma por relato a fonte em banco (quatro variáveis ausentes), porta 8765 livre, imagens PostgreSQL disponíveis, cron de produção e proposta de custódia/retenção. Nada capturado/restaurado ou iniciado pela TI nessa sessão.

A indicação “aguardando PR” do relatório é anterior à entrega/revisão atual e foi atendida. Não pedir a abertura do PR outra vez. Aproveitar as conferências já feitas; operador/conta, arquivos relevantes, URI e estados Google continuam dependências reais, e a disponibilidade da porta deverá ser revalidada antes de uso.

Leitura própria da VPS às **21:44:04 UTC / 18:44:04 Brasília**: Bun não localizado no PATH do executor root nem em `/root/.bun/bin/bun`, e nenhuma imagem `oven/bun` em cache; DB/funções Flow saudáveis, com os mesmos horários de início conhecidos. Rede Docker dos dois: `vv3jo93anprhqezhtu4ewcpl`; arquitetura **linux/amd64**. Nenhum ambiente, arquivo ou container remoto alterado.

Consulta ao manifesto público confirmou `oven/bun:1.4.2`, imagem linux/amd64 com digest **`sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2`**. É uma opção fixada para o procedimento a revisar, **não imagem baixada ou executada na VPS**. Preparar conforme [complemento para TI](2026-11-01-ti-flow-pr37-preparacao-operacional-p28.md).

## 5. Próximo passo e limites

A revisão de código dos quatro ajustes está atendida; **não pedir novo PR ou nova correção dos mesmos casos**. O merge continua decisão de Alyson pelas regras do Flow. Mesmo um merge não autoriza captura secreta, consentimento, restauração ou virada.

TI deve concluir o procedimento operacional com a versão fixada e os dados restantes, aproveitando seu retorno anterior. A etapa real depende de um procedimento completo e da decisão do dono. Sem acesso a dados de Drive, novo consentimento, cópia secreta, restauração ou mudança em banco, URI, OAuth, cron, DNS ou outras stacks nesta revisão. Proteção #36/diagnóstico e cliente Barba & Cabelo preservados.
