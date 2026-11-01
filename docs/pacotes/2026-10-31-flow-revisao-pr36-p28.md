# P-28 — Revisão do PR #36 do Flow

**Atualização após consolidado:** merge confirmado às **22:02:39 de Brasília**, commit `926298529da2b0e565599eb3e1f86d834e514be1`; os blobs revisados não mudaram. Origem/espelho atualizados; função da VPS ainda antiga, confirmada por hash nesta rodada. [Pacote TI, revisão 2 com adendo do Codex](2026-10-31-ti-flow-implantacao-pr36-revisao2-p28.md), preparado e aguardando decisão de execução do dono. O estado aberto/rascunho abaixo corresponde à revisão anterior; não pedir novo merge ou repetir os testes dos mesmos blobs.

**31/10/2026 · Resultado: sem achados impeditivos nos três pontos solicitados na revisão do PR #35.** O complemento corrige a validação das subpastas e explicita a falha posterior à gravação da conexão. O [PR #36](https://github.com/Proh2026Media/flow-proh-media/pull/36) continua **aberto e em rascunho**, aguardando a decisão do dono sobre o merge. Não houve comentário/review enviado ao GitHub, merge, publicação, implantação ou migração pelo Codex.

## 1. Fonte e versão revisadas

Relatório externo `relatorio-claude-flow-pr36-p28-2026-10-31 04.md`, entregue pelo dono e lido inteiro. GitHub confirmou branch `ia/claude-drive-protecao-subpastas`, commit **`78381de3a0abfbf0c72fcabbf4245caa1252a3f8`**, base **`e82919c77eed12440409d465b596822cfca1efcb`**. Origem/espelho `main` permanecem na base nesta consulta; o commit de merge de teste exibido pela API não é um merge efetivamente realizado.

| Arquivo                                            | Blob Git do PR #36                         |
| -------------------------------------------------- | ------------------------------------------ |
| `supabase/functions/google-drive/index.ts`         | `e0db47fccb1e7e52852f385cc227b8df21d574d1` |
| `supabase/functions/google-drive/protecao.ts`      | `711879fb7b390fbabfdd67c203139e975ea80f3f` |
| `supabase/functions/google-drive/protecao.test.ts` | `c5033f1ce178d7b56075dae66307c3bb3de68f86` |

Revisão do módulo de proteção, dos testes e do diff de integração em `handleCallback`. Cópias temporárias do módulo/testes tiveram os hashes conferidos com o GitHub; nada da fonte Flow foi incorporado ao código do Barba & Cabelo.

## 2. Pedidos atendidos

| Ponto da revisão anterior                        | Resultado conferido                                                                                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inspecionar IDs existentes antes de criar/gravar | `garantirRaiz` verifica coerência e todas as pastas gravadas antes dos efeitos. 403/404/lixeira/falha de inspeção em Clientes ou Lixeira interrompem também a criação da outra subpasta ausente                                |
| Validar candidata com o próprio token            | `validarEGravarCandidata` confere os três IDs com o token candidato antes de salvar. Nos casos barrados, conserva conexão, cliente anterior, IDs e dados de varredura                                                          |
| Tratar falha após a gravação                     | `concluirCallback` concentra a sequência usada pelo handler real e retorna `parcial` quando a preparação falha depois do commit. A mensagem informa que a nova conexão foi gravada. Não usa revogação/desconexão para desfazer |

O handler real monta as dependências de `concluirCallback`; sucesso volta com `drive=ok`, erro/parcial com `drive=erro` e mensagem correspondente. O estado parcial não é rollback: a nova conexão fica gravada e a próxima preparação tenta completar somente IDs ausentes. Essa diferença permanece no plano de operação.

## 3. Verificação independente e limites

- **94/94 testes do módulo aprovados**, executados pelo Codex em cópia isolada, com Vitest **3.2.4** conforme a dependência declarada do Flow, ambiente Node e dependências simuladas. Sem servidor, Drive, banco, tokens reais ou stack de teste. Instalação do executor ocorreu apenas em `/tmp`, com scripts de instalação desativados; sem alteração de dependências/lockfiles do projeto.
- **Quatro regressões independentes aprovadas:** Clientes 404, Lixeira 403, Clientes na lixeira e callback com subpasta inacessível. As três primeiras interrompem antes de efeitos e conservam IDs; a quarta rejeita a candidata sem salvar, usando explicitamente o token candidato nas inspeções.
- **106 testes do projeto, Deno check, tipos e lint do Flow** são resultados declarados pelo Claude; não foram repetidos integralmente pelo Codex. O Deno não está instalado neste ambiente. Não confundir os 94 testes isolados com a suíte completa ou com validação da função em produção.
- O escopo desta revisão são as correções pedidas para o #36. Permanecem os limites declarados do #35: `moveFile` trata 404 na exclusão como “já movido”, e a troca de `google_oauth` antes da reconexão pode deixar a conexão anterior sem uso até restaurar a configuração correspondente. Cobrir esses comportamentos no plano/ensaio da migração; não presumir arquivo inexistente por falta de acesso do novo cliente.
- Nenhum ensaio Google real realizado. A última leitura do servidor pelo Codex, na rodada anterior, encontrou `index.ts` antigo e `protecao.ts` ausente; não houve novo SSH nesta revisão. O relatório atual também informa ausência de implantação.

## 4. Próxima etapa concreta

**Decisão do dono sobre integrar o PR #36.** A revisão dos pontos solicitados está concluída; não pedir outro PR para as mesmas correções. Se o head mudar, conferir o delta antes de usar esta conclusão. Seguir o fluxo de PR do Flow; não enviar código direto à main ou aplicar pelo autossave do Barba & Cabelo.

**Preparação para TI/Flow já disponível:** [pacote de preparação da implantação dos dois arquivos](2026-10-31-ti-flow-preparar-implantacao-pr36-p28.md). É preparação condicionada ao merge e à definição do procedimento autorizado do Flow; não é ordem de executar mudanças na VPS. Código de proteção pode ser preparado para instalação com a conexão atual; destino Google/domínio pertencem à migração posterior.

Páginas e gatilho concluídos; não refazer. Destino/operador Google, propriedade associada, cópia/retorno e ensaio de compatibilidade/renovação continuam pendentes para a migração. Cron P-26, teste parado e cliente Barba & Cabelo preservados. P-28 ainda sem vídeo/reenvio.
