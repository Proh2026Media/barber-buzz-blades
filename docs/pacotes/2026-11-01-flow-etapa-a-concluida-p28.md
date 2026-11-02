# P-28 — Etapa A concluída: reensaio do PR #38 conferido

**Atualização de 01/11 — A e B concluídas:** A passou com 93/0/0; TI/Guardião posteriormente capturou/validou as integrações reais às 23:10/23:11 Brasília, com [resultado e custódia de B conferidos](2026-11-01-flow-etapa-b-concluida-p28.md). Próximo: [preparar C, sem consentimento/URI/token/virada](2026-11-01-ti-flow-preparacao-c-p28.md). Não repetir A/B, revisão/correção/PR/merge ou preparação geral. O histórico de A abaixo continua válido; menções de B ainda não autorizada são do estado anterior, já atendido.

## 1. Fonte e execução da TI

Lido inteiro **`relatorio-ti-flow-reensaio-a-pr38-p28-2026-11-01.md`**, 163 linhas. O relatório registra autorização de Alyson **somente para o reensaio de A**; seu recebimento não autoriza B/C/D.

| Item                 | Resultado relatado pela TI                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Linha de base        | **21:42:33 Brasília de 01/11 / 00:42:33 UTC de 02/11**                                                                                                                                                 |
| Suíte completa       | **21:45:23–21:45:38 Brasília / 00:45:23–00:45:38 UTC**                                                                                                                                                 |
| Limpeza              | Imediatamente após, aproximadamente 21:46 Brasília                                                                                                                                                     |
| Commit               | `9837ebc873554d3e7685f792c18d01349418ed2e`, idêntico em conteúdo ao head `a29722df60167708036af9172adadc035c77b71a`                                                                                    |
| Árvore / ferramentas | `7dd39209a3a24815424970f2de726ecfefb75f8d` / `fb576d0970c46fe9dcb918fa10be59d62f2111a3`, 19 arquivos                                                                                                   |
| Fonte preservada     | `/root/flow-pr38-20261102T004233Z/src/`, `root:root`, sem escrita                                                                                                                                      |
| Imagens              | Bun 1.4.2 Linux/amd64, digest `296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2`; PostgreSQL 15.19 fictício, digest `54e0dd8e8cddcdbb9156c2486eed5a43eccb7214d7c6828097d41ce049fb3984` |
| Isolamento           | PG `--network none`, sem porta publicada; runner no namespace do fictício, fonte/entrada RO, sem Docker socket                                                                                         |
| Resultado            | **93/0/0**, saída **0**, **605 asserções**, aproximadamente 14,24 s                                                                                                                                    |
| Distribuição         | **34 unidade + 37 bancada + 22 PostgreSQL**                                                                                                                                                            |
| Realocações          | **Três provocadas pelas regressões; zero não provocadas**                                                                                                                                              |

Transporte apenas das ferramentas, pela API GitHub autorizada, com conferência de cada blob; sem clone, `.git` ou `.env`. SHA-256 do tar de código: **`2c0e5513492be783ba7212a871d87308f690f7e222fe9e98f297d335505b2d93`**. O runtime precisou obter novamente a imagem Bun pelo digest fixado; não presumir cache permanente por causa de uma execução anterior.

TI relata remoção do runner, PostgreSQL fictício e seu volume pelo ID, descarte da senha/URL e preservação dos mesmos **36 IDs**, sem alteração de início/status nos serviços existentes. Fonte/logs antigos do #37 preservados; as duas corridas 85/1/0 continuam históricas. Sem captura de produção, Google, cron/env, implantação, migração, stack de teste compartilhada ou reinício de serviços existentes.

## 2. Conferência própria do Codex

**SSH somente leitura, sem nova suíte ou ação remota de escrita:**

- Log `/root/flow-pr38-20261102T004233Z/priv/testes.log`: **93 aprovados, zero falhas/pulados, 605 asserções**, distribuição 34/37/22; três linhas de realocação, todas provocadas. Saída 0 do processo é registrada no relatório da TI; não foi reexecutado para medi-la novamente.
- **19/19 blobs** da fonte preservada são idênticos à árvore conferida do #38. SHA-256 recalculado do tar coincide com o relatado.
- Base/privados **0700**, log/tar/manifestos **0600**, `src` **0500**, dono/grupo **0:0** nos itens conferidos. Fonte atual pertence ao root; tar contém UID 1000, corroborando a necessidade da normalização de dono no preparo.
- Filtro `p28.pr38=ensaio` sem containers; `pg.password` e `conexao-ficticio.url` ausentes. Presença do log antigo #37 e do log de descoberta inválida confirmada. Remoção do volume e preservação integral dos 36 IDs são evidências relatadas pela TI; não inventar uma comparação anterior própria que não foi capturada pelo Codex.
- **36 containers atuais**, funções Flow `d411e8225ad9…` e DB `80c3d9164c07…` saudáveis, com os inícios conhecidos: `2026-11-01T18:32:29.790943603Z` e `2026-10-23T20:44:50.472960587Z`. Sem reinícios pelo Codex.

Uma consulta auxiliar SSH teve timeout; a leitura posterior concluiu. Isso não é falha da suíte nem motivo para refazê-la.

## 3. Falhas de preparo preservadas

O relatório não esconde os erros anteriores à execução integral:

1. A descoberta inicial não conseguiu acessar os testes. O log privado `priv/testes-descoberta-falha-perms.log`, lido pelo Codex, informa **nenhum arquivo de teste encontrado**, sem executar os 93 casos; não mostra literalmente `EACCES`. A TI atribui o problema ao tar com UID 1000, fonte restrita e runner root sem `CAP_DAC_OVERRIDE`. Normalizou apenas o dono da fonte para `root:root`, conservando-a sem escrita. Tar UID 1000 e fonte atual UID 0 foram conferidos pelo Codex.
2. Um PostgreSQL fictício inicial não leu `initdb.d` 0700, segundo a TI. Foi removido com seu volume e recriado com a **pasta vazia de inicialização** 0755. Isso não tornou os privados/credenciais públicos; eles permaneceram 0700/0600. Não foi mudança em stack existente.

Essas falhas de preparo permanecem no histórico. A corrida completa válida foi única e limpa; não houve seleção de uma corrida verde entre falhas dos casos de negócio. Não repetir A para apagar esse histórico. Em operações futuras, conferir dono/modos com o UID efetivo do runner; não afrouxar acesso aos arquivos secretos para contornar erro de permissão.

## 4. Estado depois do encerramento

| Etapa                         | Estado                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A — runtime e ensaio fictício | **Concluída em 01/11**, reensaio TI do #38 conferido                                                               |
| B — captura protegida         | **Concluída em 01/11**, [captura/validação offline e limpeza conferidas](2026-11-01-flow-etapa-b-concluida-p28.md) |
| C — Google/ensaio real        | Operador/conta, IDs privados, custódia do candidato, metadados/URI e transporte do callback continuam próprios     |
| D — virada                    | Procedimento/barreira contra cron/requisições/callbacks, promoção e aceitação próprios                             |

**P-28 não está concluída:** A atesta ferramentas/isolamento com dados fictícios e B, concluída posteriormente, preserva a configuração real em cópia privada. O ensaio Google C e a virada D continuam próprios. Cliente Barba & Cabelo, #36/diagnóstico e cron atual preservados.

**Validação do registro:** tipos, **301 testes Barba & Cabelo**, formatação dos onze documentos e montagem aprovados. Conferidos 33 links/âncoras locais novos, a sintaxe dos dois blocos Bash e o modelo JSON do pacote B, sem executá-lo. Sem alteração de código de aplicação nesta entrega documental.
