# P-28 — Revisão do #42 integrado: quatro ajustes antes da instalação

> **Atualização de 06/11:** pedido respondido pelo #43, já integrado. [Revisão atual: correções atendidas e três pendências](2026-11-06-flow-revisao-pr43-p28.md); [próximo arquivo Claude: F1/F2/F3](2026-11-06-claude-flow-ajustes-pr43-p28.md). O conteúdo abaixo permanece como histórico, sem repetir os quatro pedidos do zero.

**05/11/2026 · Código entregue e integrado, ainda não homologado para instalar a barreira ou executar D.** As suítes existentes passaram, mas cinco verificações independentes terminaram em **1 pass / 4 fail**, reproduzindo quatro falhas do fluxo. [Devolutiva para Claude](2026-11-05-claude-flow-ajustes-pr42-p28.md), em **novo PR** a partir da main. Não pedir outro merge do #42, não instalar esta versão e não repetir o ensaio Google dos 15 itens, que permanece concluído.

## 1. Relatório e versão

`relatorio-claude-flow-barreira-promocao-d-p28-2026-11-03.md` lido integralmente, **176 linhas**, SHA-256 `4fd3d777a50fdc325b7827b9e7d0b52e21db137edbd5c0f2588abe5429d3445a`. Desenvolvimento relatado em 03/11, atualização de integração em 05/11. Propostas de instalação/versão real/janela não são autorização para executá-las. O aviso “antes de integrar” e “nenhum merge” do executor são históricos; o dono já integrou.

Conferência própria pelo Git/CLI GitHub (plugin indisponível nesta sessão): [PR #42](https://github.com/Proh2026Media/flow-proh-media/pull/42) integrado às **12:41:20 Brasília / 15:41:20 UTC de 05/11**.

| Item                | Resultado                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Head                | `8c7edbc23679d3dc2d1bbddad71121098e09c6f2`                                                                    |
| Merge               | `3c77d329667adc13ed01767598307545af579d37`, também na main do espelho `PROH-Media`                            |
| Árvore completa     | `47c6c1d19f694a6a489ef168c4f82ee57fa238a3`, igual no head e merge                                             |
| Ferramentas         | `abd056fe5063600c28711ebd0e49415ba818c996`, **27 arquivos**                                                   |
| Função google-drive | `e9ae215bf192c0db42027049d2297a885c5bedda`, **cinco arquivos**                                                |
| Fonte local         | **34 blobs** conferidos: ferramentas + função + AGENTS/package; cópia RO e checkout Flow intactos após testes |

`banco.ts` agora admite pré-condição dentro do LOCK e ganchos de teste; `virada.ts` só aceita alvo fictício. Instaladores, guardas, AGENTS, bancada e composição/aceitação anteriores foram preservados. O trabalho nesta revisão foi leitura/testes, sem editar ou enviar código/review no Flow.

## 2. Verificações próprias

- **Ferramentas:** Bun **1.4.2 Linux/amd64** fixado + PostgreSQL **15.8** fictício arm64, **145/0/0**, **1.738 assertivas**, saída 0, ~28 s. Um assert a menos que macOS é o teste de caminho condicionado à plataforma.
- **App/função:** Vitest nativo, **122/122**, cinco arquivos, incluindo os **16 testes da barreira** e 94 da proteção. Saída 0. Dependências pelo bun.lock congelado, sem alterar lock ou fonte.
- **Independentes finais:** classe/motor/CLI reais contra PostgreSQL fictício, **1 pass / 4 fail**, oito assertivas, saída 1. Controle positivo de promoção/retorno normal passou. O caso B foi refinado para uma intercalação determinística de fechamento; a rodada final preserva as quatro reproduções. Não são ocorrências em dados reais.
- Isolamento: PG em rede Docker internal exclusiva sem porta publicada; runner UID 501:20, raiz/fonte RO, capacidades removidas e tmpfs próprio. Google simulado/fetch real bloqueado. Nenhum dado real montado.
- Quatro containers, volumes anônimos associados e rede internal próprios retirados; 34 blobs intactos e checkout Flow sem alterações. Artefatos fictícios em `barba-p28-pr42-x7_4mbnk`, fora do repositório B&C. Tipos/lint e contraprovas do anexo são evidências Claude, não checks próprios atribuídos indevidamente.

## 3. Quatro achados

### A. Upload retomável fica fora da contagem entre início e finalização

`src/hooks/use-drive-upload.ts:89–115` abre a sessão, envia o arquivo por **PUT direto ao Google** e só depois chama `upload-finish`. `index.ts:866–899` devolve `session_url` sem registrar o ciclo completo; a barreira encerra a atividade ao devolver a resposta do init. Assim, pode contar zero enquanto o navegador ainda escreve no Drive.

Modelo independente do intervalo, com a classe real e PG: `upload-init` retorna 200; envio externo continua pendente; fechar/drenar **emite prova**, e `upload-finish` recebe **503**. O modelo não executa o handler ou Google reais; o intervalo é corroborado pelo código do hook/handler e é reconhecido no próprio relatório. Anunciar a janela não elimina esse escritor. A documentação Google confirma que a sessão e os PUT subsequentes são etapas separadas. [Uploads retomáveis do Drive](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

**Corrigir:** acompanhar sessão/efeitos até finalização, cancelamento comprovado ou reconciliação; barrar novos inícios e permitir concluir apenas continuações previamente admitidas, com autorização. Upload abandonado/incerto não vira zero por TTL. Tratar também sessões legadas e compatibilidade do frontend/backend durante a instalação; não supor que contador recém-criado conhece os uploads antigos.

### B. Falha em voo pode perder a incerteza durante o fechamento

`barreira.ts:94–110` lê a barreira numa falha e apaga a atividade se viu aberta. A leitura e o DELETE são operações separadas. Intercalação reproduzida: resposta **502** → `encerrar` lê aberta → pausa antes de apagar → operador fecha (uma atividade presente) → DELETE prossegue → contagem zera, **incertas=0 e prova emitida**.

Não é apenas uma falha concluída antes da manutenção: o caso final mantém a requisição ativa no momento de fechar. **Corrigir:** preservar efeito potencialmente incerto sem depender de uma leitura aberta que pode envelhecer antes da limpeza. Outra releitura isolada não torna a decisão atômica. Falha comprovadamente sem efeito pode ter tratamento distinto, com prova, sem apagar incerteza para viabilizar D.

### C. Retorno ignora o par posterior esperado e sobrescreve divergência

`virada.ts:255–267` valida `--posterior`, mas usa uma **nova captura atual** como estado esperado na restauração. O arquivo posterior fornecido fica fora dessa comparação. A nova captura é útil para custódia, mas não pode legitimar qualquer alteração ocorrida desde a promoção.

Reprodução com a CLI real: promover → acrescentar campo desconhecido à conexão → retornar usando as capturas anterior/posterior originais. Resultado **código 0, `retornado`, alteração posterior apagada**. Esperado: recusar divergência e preservar o estado para análise, mantendo apenas a exceção explícita de varredura.

**Corrigir:** usar o par posterior conhecido como esperado, conferir dentro da transação e comparar referências conforme contrato; imagem pré-retorno nova não substitui esse esperado. Sem force, sem restaurar entidades e sem apagar desconhecidos alterados silenciosamente.

### D. Reconciliação devolve sucesso mesmo depois de perder a barreira

`virada.ts:134–149` captura qualquer erro da aplicação e classifica somente o par relido, sem revalidar estado/geração/atividades da barreira. Reprodução: gancho depois do COMMIT reabre a barreira pelo **próprio `abrirBarreira`** e lança erro simulando perda da resposta. A CLI devolve **0 / `aplicado_reconciliado`**, apesar de a barreira estar aberta e em outra geração.

**Corrigir:** reconciliação precisa de prova coerente de barreira ainda fechada, mesma geração e sem atividade/incerteza. Se essa condição foi perdida, relatar aplicação possível com barreira perdida/estado divergente e parar; não declarar sucesso seguro nem tentar nova aplicação/retorno automático. O par pode ter sido gravado e isso não deve ser ocultado como “não aplicado”.

## 4. VPS conferida: barreira do #42 ainda não está instalada

Leitura SSH própria em **05/11 após o merge**, sem ambiente/banco/segredos ou alteração remota:

| Artefato/serviço             | Resultado                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `google-drive/index.ts` vivo | 83.446 bytes, blob `e0db47fccb1e7e52852f385cc227b8df21d574d1`, ainda a entrega #36 |
| `protecao.ts` vivo           | 20.558 bytes, blob `711879fb7b390fbabfdd67c203139e975ea80f3f`, #36                 |
| `barreira.ts` vivo           | **Ausente**                                                                        |
| DB                           | `80c3d9164c07…`, healthy, início `2026-10-23T20:44:50.472960587Z`, RestartCount 0  |
| Funções                      | `d411e8225ad9…`, healthy, início `2026-11-01T18:32:29.790943603Z`, RestartCount 0  |

Isso fecha a dúvida sobre o estado dos arquivos vivos no momento da consulta; não depende de inferir implantação pelo workflow de espelho. Não foi instalado/revertido código nem reiniciado serviço. Não há autorização D, promoção de credenciais ou novo consentimento nesta revisão. O ensaio dos 15 continua concluído; candidato/provas sob custódia, sem releitura/reexecução.

## 5. Próximo passo

[Arquivo Claude — corrigir em novo PR](2026-11-05-claude-flow-ajustes-pr42-p28.md), partindo da main já integrada, só com dados fictícios e guardas preservadas. Sem instalar #42, habilitar comandos reais ou pedir repetição dos ensaios concluídos. Após correções/testes e revisão, preparar a operação concreta para decisão própria do dono. Cliente B&C, Google e produção permanecem fora das alterações desta entrega.

## 6. Verificação da entrega documental B&C

`scripts/verificar.sh` saída 0: tipos, **301 testes B&C**, Prettier dos sete documentos e montagem aprovados; eslint não aplicável (nenhum TS/TSX alterado). **17 links locais novos** conferidos e diff sem erro de espaço. Isso valida a documentação publicada, sem ocultar os **quatro casos independentes Flow ainda reprovados**. Formatação dos dois registros reconferida após inserir os resultados. `.env`/`.vscode/` locais fora da entrega.
