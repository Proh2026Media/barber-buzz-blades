# P-28 — #45 conferido: correções atendidas e dependência operacional externa

> **Atualização posterior de 06/11:** [E1b recebida e #46–#48 revisados](2026-11-06-flow-revisao-pr46-pr48-p28.md). Novo marco até **13/11 17:30:07.445 BRT**, Parte 1 TI às 17h45/A1 já autorizada segundo a devolutiva; há dois achados nas ferramentas reais #47, com [devolutiva única Claude/TI](2026-11-06-claude-flow-ajustes-pr46-pr48-p28.md). Não pedem reinstalação. Abaixo permanece a revisão histórica do #45; seus testes não são conferência da instalação nem substituem a revisão posterior.

**06/11/2026 · ChatGPT/Codex.** Relatório `relatorio-claude-flow-ajustes-pr44-p28-2026-11-06.md` lido inteiro: **245 linhas**, SHA-256 `4c71ca83608bf4b445f8781df1a34677c34479159044deed6658d0f40e1711ec`. [Pedido respondido](2026-11-06-claude-flow-ajustes-pr44-p28.md), [revisão anterior](2026-11-06-flow-revisao-pr44-p28.md).

**Resultado:** F1a/F1b/F2a atendidas nesta revisão, sem novo pedido de correção. Ferramentas **181/0/0**, aplicativo/função **145/145**, **nove controles independentes passaram**. Isso encerra esta rodada de revisão do código do Flow, **não autoriza instalação ou D**.

**Direção do dono nesta rodada:** voltar ao desenvolvimento do Barba & Cabelo. P-28 fica como dependência externa coordenada pela TI/Guardião e Claude/Flow, com [encaminhamento único](2026-11-06-ti-flow-coordenacao-separacao-p28.md). O restante do B&C pode avançar; não abrir funcionalidades do Flow nem exigir seu encerramento para trabalhar no B&C.

## 1. Código e integração

[#45 integrado](https://github.com/Proh2026Media/flow-proh-media/pull/45) em **06/11 às 13:33:35 Brasília** (`16:33:35Z`), confirmado no GitHub. A atualização de merge ao fim do anexo prevalece sobre seu cabeçalho de rascunho.

| Identificação                | Conferência própria                        |
| ---------------------------- | ------------------------------------------ |
| Base #44                     | `e9b65d4813052aa3d37ef78a3e36028f88530eaf` |
| Head #45                     | `4b26a4a800fe9a620b0cd12aa0c197612edd1c03` |
| Merge, main origem e espelho | `4c728e695ac6ad5bbb5d3c2a6c4e8afb60b27684` |
| Árvore completa, head e main | `7331163266d2fcd73855af26ade5f37e8ab578c3` |
| Ferramentas, 27 arquivos     | `bb33674bd648879f914d10ce3e23f7791995300f` |
| Função, 5 arquivos           | `7a1f35e7e23c3a5bbfd550a8a5ba6db6ceec84f7` |

Delta **7 arquivos, +722/−52**, prefixos SHA-256 do anexo conferidos. **36 blobs Git completos** verificados/copiados para ensaio; AGENTS igual (`39431fcc3af1a362593c85210f8b151d894e90af`), sem mudança em src, instaladores/migrations ou guardas. A integração não instala a função; não pedir outro merge nem uma publicação de frontend por causa do #45.

## 2. Verificações próprias

| Verificação                                                  | Resultado                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Ferramentas: Bun 1.4.2 Linux/amd64, PostgreSQL 15.8 fictício | **181 passaram, 0 falharam, 0 pulados**, 1.974 assertivas, saída 0 |
| Vitest nativo                                                | **145/145**, incluindo 36 barreira, 94 proteção e 3 hook           |
| `tsc -p tsconfig.app.json`                                   | Saída 0                                                            |
| ESLint ferramentas e função                                  | Saída 0                                                            |
| Nove independentes                                           | **9 passaram, 0 falharam**, 21 assertivas, saída 0                 |

Comandos: `P28_PG_URL_ARQUIVO=<arquivo fictício 0600> bun test ferramentas/p28-drive`, `bun run test` e ESLint do escopo. A assertiva macOS adicional do anexo é a condição de caminho `/private/var/` em `unidade.test.ts:293`. Tipos estritos Bun, rodadas extras, contraprovas e lint global do anexo são evidências Claude; não foram atribuídos a esta execução.

Google simulado/fetch real bloqueado, PG em rede Docker internal própria sem portas/dados reais; fonte/raiz dos executores somente leitura, capacidades removidas. Cron exercitado por extração de três corpos originais do index #45, dependências simuladas e classe real. Handler Deno completo/runtime da VPS não executados. **Três containers próprios, volumes associados e rede retirados**, 36 blobs intactos e checkout Flow limpo; artefatos fictícios em `barba-p28-pr45-76rjg6vw`, fora do B&C.

## 3. Resultado das três correções

| Caso independente                                                       | Resultado no #45                                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **F1a:** DELETE perde resposta; cron captura, grava erro e responde 200 | `incertas=1`, **sem prova**. O envelope 200 não apaga o efeito desconhecido.                 |
| **F1b:** P ativa em B, criação de P em A sem vínculo no banco           | **0 reconciliadas/1 pendente**, duas chamadas simuladas (token + permissão de A), sem prova. |
| **F2a:** token `pagina-ficticia-2=` com órfão na segunda página         | **Duas páginas/um órfão**, sem prova; não encerra silenciosamente.                           |

Controles também passaram: retorno normal; divergência posterior preservada/recusada; resposta perdida após COMMIT com barreira reaberta gera `barreira_perdida`; incerta entre gerações continua bloqueando; aba antiga conclui e usuário diferente é recusado sem Google; paginação pelo token simples encontra órfão e bloqueia.

A revisão do delta confirma: classificação por resultado externo, registro de falha de escrita do banco, compensação com evidência, chave arquivo+permissão e GET limitado da permissão, token opaco codificado, checagem de resposta/paginação sem recibo aprovador em falha. Não foi encontrada nova lacuna impeditiva nesse escopo.

## 4. Limites que pertencem à operação

- **Instalação e runtime:** conferir AsyncLocalStorage e o fetch customizado do supabase-js usado pelo handler em ambiente isolado equivalente; cópia/retorno e janela próprios. Instaladores continuam restritos à stack de teste pelo AGENTS.
- **Legado:** procedimento precisa comprovar corte de todos os workers antigos e marco válido. A proposta usa **≥168 h desde o marco**, mais verificação sem órfãos; merge não inicia nem comprova esse prazo. O comportamento de files.list sem resultados, mencionado no anexo, não foi observado no Google real; uma resposta incompatível recusa com `sem_files` e exige tratamento, não liberação.
- **Comandos reais e D:** ainda não existem comandos de virada liberados para produção. Preparar implementação/procedimento próprios, sem desligar as guardas fictícias, com revisão independente e decisão do dono antes da execução real.
- **Estado real:** última leitura própria foi em **06/11 às 11:24:07 Brasília**, antes do #45: arquivos #36, barreira ausente e serviços saudáveis, conforme [revisão anterior](2026-11-06-flow-revisao-pr44-p28.md#7-estado-real-conferido). Não foi repetida consulta VPS nesta rodada nem inferida instalação a partir do merge. O anexo declara nenhuma execução real.
- **Google B&C:** separação/propriedade/marca e posterior vídeo/reenvio continuam pendentes. P-69, A/B/T1, Picker dos 15 e custódia continuam atendidos, sem novo consentimento/renovação ou inventário.

## 5. Continuidade focada no B&C

[Pacote único de coordenação externa](2026-11-06-ti-flow-coordenacao-separacao-p28.md) consolida o restante para TI/Guardião e Claude/Flow. Não há novo pacote de correção do #45. Retorno consolidado de execução/conclusão ou decisão necessária, preservando segredos e evidências; B&C segue com validações P-42/P-43 e manutenção própria, mantendo P-74/P-95 como decisões do dono.

## 6. Verificação da entrega documental B&C

`scripts/verificar.sh` saída 0: tipos, **301 testes B&C**, Prettier dos oito documentos e montagem aprovados; eslint não aplicável, nenhum TS/TSX alterado. **25 links locais novos** conferidos e diff sem erro de espaço. Mesmos avisos de padrões PWA sem correspondência (`icons/*`, `manifest.webmanifest`) da rodada anterior, sem mudança de código/PWA nesta entrega. Os dois registros foram formatados/conferidos novamente após inserir os resultados. Somente documentação; `.env`/`.vscode/` locais preservados e fora da entrega.
