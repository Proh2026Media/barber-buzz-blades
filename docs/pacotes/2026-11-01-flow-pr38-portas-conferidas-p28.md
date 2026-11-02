# P-28 — PR #38 conferido: portas e prontidão dos testes

**Atualização de 01/11 — etapa A operacional concluída:** TI reensaiou às 21:45 Brasília, **93/0/0**, 22/22 PostgreSQL 15.19, sem realocações não provocadas; Codex conferiu log/fonte/tar/permissões/ausência de temporários e saúde. [Encerramento e detalhes](2026-11-01-flow-etapa-a-concluida-p28.md). Próximo: [decidir captura protegida B](2026-11-01-ti-flow-captura-protegida-b-p28.md), ainda não autorizada/executada. A revisão independente abaixo continua válida; seus estados de reensaio TI pendente são históricos, já atendidos. Não repetir a revisão/suíte ou pedir outro PR/merge.

## 1. Fonte recebida e versão conferida

Relatório **`relatorio-claude-flow-etapa-a-portas-p28-2026-11-01.md`** lido inteiro; o reenvio acrescentou a atualização do merge, também lida. SHA-256 da versão atualizada: `972fa3a020682562e41d8017d0dcf526d084b1fe5ba3c8f98618849c914e2b0c`. O trecho inicial “em rascunho” ficou superado. Instruções e resultados relatados não foram tratados como autorização para outras etapas.

GitHub confirmou [PR #38](https://github.com/Proh2026Media/flow-proh-media/pull/38) integrado às **21:19:20 Brasília de 01/11 = 00:19:20 UTC de 02/11**. Origem `Proh2026Media/flow-proh-media` e espelho `PROH-Media/flow-proh-media` estão na mesma main:

| Item                              | Versão                                                           |
| --------------------------------- | ---------------------------------------------------------------- |
| Head corrigido                    | `a29722df60167708036af9172adadc035c77b71a`                       |
| Commit integrado                  | `9837ebc873554d3e7685f792c18d01349418ed2e`                       |
| Árvore completa dos dois commits  | **Idêntica:** `7dd39209a3a24815424970f2de726ecfefb75f8d`         |
| Subárvore `ferramentas/p28-drive` | `fb576d0970c46fe9dcb918fa10be59d62f2111a3`, **19 arquivos**      |
| Delta contra `13f1dc9`            | Cinco arquivos, +307/−56: três de código/apoio e dois documentos |

[Aviso ao hub concluído](https://github.com/Proh2026Media/flow-proh-media/actions/runs/41366520013); “Avisar blindagem” pulado. Isso confirma o disparo de sincronização, não instala ferramentas na VPS nem comprova reensaio. Codex não executou merge ou alteração no repositório Flow.

Arquivos de ferramentas alterados e blobs conferidos:

| Arquivo relativo a `ferramentas/p28-drive/` | Blob                                       |
| ------------------------------------------- | ------------------------------------------ |
| `bancada/bancada.ts`                        | `0aad2ec236c60046d45f0ef4fc71b63952a4d261` |
| `teste/apoio.ts`                            | `8ef6a0defb9437ae436fecc7aa8b15560e8ea093` |
| `teste/bancada.test.ts`                     | `da19d13112c6e148e44313f13716aa97210e491e` |
| `README.md`                                 | `be958b8b0dcfa9e7cd7f0681a729efe22fe734e9` |

`PROGRESSO.md` também atualizado, blob `194874935521a2c5a180ac81b4618907c2679239`. Os outros 15 arquivos das ferramentas mantêm seus blobs. A cópia local de teste foi conferida integralmente, **19/19**, contra a árvore GitHub antes da execução.

## 2. Resultado da revisão

| Pedido                                 | Conferência                                                                                                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eliminar sorteio cego                  | `ocuparPorta()`/`portaDoSistema()` usam porta 0 para o sistema escolher em loopback; ocupante intencional conserva a porta até seu encerramento                                                    |
| Tratar disputa entre liberar e assumir | `subirBancada()` limita a três tentativas, somente para `ErroFerramenta` de etapa `servidor`, código `porta_ocupada`, antes de link/pedido ao provedor; nova porta e diretório, registro explícito |
| Propagar falha antes da prontidão      | `Promise.race` observa o link e a promessa do comando; os dois pontos de espera passaram a usar esse apoio                                                                                         |
| Encerrar recursos próprios             | Controlador de interrupção e `finally` nos dois fluxos; ocupantes são fechados pelo teste que os criou                                                                                             |
| Preservar bancada real                 | CLI continua recusando porta fixa ocupada, código 1, sem realocação, link, provedor ou alteração de configuração; porta 0 continua inválida no validador real                                      |

A única mudança compartilhada é **`DepsCli.interromper?: AbortSignal`**, não fornecida pela CLI real. Ela usa a mesma conclusão conservadora do prazo: recusado antes do candidato ou parcial depois de guardá-lo; preserva os motivos antigos do prazo e remove o listener no encerramento. As regressões cobrem interrupção antes/depois e liberação da porta.

Sete regressões novas cobrem colisão controlada sem efeitos/rejeição solta, realocação limitada ao apoio, esgotamento, outro erro sem repetição, interrupções e a recusa da CLI real. Não foram afrouxados validadores, loopback, Host, state/cookie, escrita privada ou guardas do restaurador. `src/`, funções instaladas, migrations, dependências, conexão real e quatro correções do #37 não mudaram.

**Conclusão limitada ao delta e aos pontos examinados:** nenhum novo ajuste impeditivo encontrado. Não reabrir o [pedido de correção já atendido](2026-11-01-flow-etapa-a-correcao-portas-p28.md) nem trocar o isolamento para contornar as falhas antigas.

## 3. Execução independente do Codex

- **Uma rodada completa**, fonte somente leitura e 19 blobs conferidos; sem instalar dependências. Executor **Linux/amd64, Bun 1.4.2**, imagem fixada `oven/bun@sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2` já em cache.
- PostgreSQL fictício exclusivo **15.8**, imagem local `supabase/postgres:15.8.1.085`, ID `sha256:af083ef64d0408c8f098ee6f5c364a59b26f36fbc0f3a334a62c5c1d57362e9b` (**arm64**). Banco e executor compartilham apenas a rede do fictício: PostgreSQL com `--network none`, nenhuma porta publicada; runner `--network container:<ID>`, usuário root, raiz somente leitura, sem capacidades, sem novos privilégios, `/tmp` temporário, sem Docker socket.
- **93 aprovados, zero falhas, zero pulados, saída da suíte 0, 605 asserções** em 12,43 s. Distribuição conferida no log: **34 unidade + 37 bancada + 22 PostgreSQL**. Faixa efêmera medida dentro do namespace fictício: 32768–60999.
- **Três linhas de realocação**, todas provocadas pelas regressões, **zero não provocadas**. Falhas intencionais de porta aparecem nos casos de recusa; não são falhas da suíte.
- Containers próprios e volume fictício removidos, URL/env descartáveis apagados; consulta por label confirmou zero containers de revisão restantes. Nenhuma execução na VPS ou dado/credencial de produção nesta rodada.

O coletor local inicialmente retornou 1 por uma expressão incorreta na extração das contagens, **depois da suíte ter retornado 0**. O log original foi reanalisado e conferido por arquivo, corrigindo `resultado.json`; a suíte não foi repetida para buscar resultado verde. A limpeza ocorreu no `finally` e foi conferida novamente. Esse erro do apoio do Codex não é falha do Flow.

Apoios temporários: `/var/folders/qf/cjj8xr7x1g58t5k07241q8900000gn/T/barba-p28-pr38-nwglpm0q/`, `priv/testes.log`, `resultado.json`; log inicial do coletor `/tmp/barba-p28-pr38-ensaio.log`. Preservados sem URL/senha descartável.

As sete rodadas 93/0/0 do Claude, incluindo três macOS e quatro Linux, e tipos/lint das ferramentas são **relatados pelo Claude**, não execuções atribuídas ao Codex. A execução própria acima usa PostgreSQL 15.8 local; **não substitui o reensaio da TI com o PostgreSQL 15.19 fictício da VPS**.

## 4. Próximo passo

**Reensaio exclusivo da etapa A pela TI**, com o [pacote do PR #38](2026-11-01-ti-flow-reensaio-pr38-p28.md), commit integrado fixado e expectativa **93/0/0**, incluindo 22 PostgreSQL. Runtime já preparado; preservar os dois logs 85/1/0 anteriores como histórico, sem sobrescrevê-los. Não pedir outro PR/merge ou nova preparação geral.

Etapa A operacional ainda pendente dessa comprovação. Captura protegida B, Google/ensaio real C e virada D continuam etapas próprias. #36/diagnóstico, cliente Barba & Cabelo e cron atual preservados.

**Validação do registro no Barba & Cabelo:** tipos, **301 testes**, formatação dos nove documentos e montagem aprovados por `scripts/verificar.sh`. Conferidos 32 links/âncoras locais novos e a sintaxe do bloco Bash do reensaio, sem execução na VPS. Sem mudança de código de aplicação nesta entrega documental.
