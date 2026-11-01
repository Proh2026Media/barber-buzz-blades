# P-28 — Revisão do PR #35 do Flow e ajuste antes da implantação

**Atualização — correção entregue no PR #36 e revisada:** os pontos abaixo foram atendidos no head `78381de3a0abfbf0c72fcabbf4245caa1252a3f8`. Codex executou 94 testes do módulo e as quatro regressões independentes com sucesso. [Conclusão da revisão e próximos passos](2026-10-31-flow-revisao-pr36-p28.md). PR ainda aberto/em rascunho; não confundir correção na branch com merge ou implantação. Este arquivo preserva o achado da versão #35; não pedir outro PR para o mesmo ajuste.

**31/10/2026 · Devolutiva para o Claude/Flow.** O gatilho de publicação foi corrigido e comprovado. O [PR #35](https://github.com/Proh2026Media/flow-proh-media/pull/35) de proteção já foi integrado; **não refazer o PR original**. A revisão dirigida abaixo identificou uma lacuna reproduzível nos IDs de Clientes/Lixeira. Preparar um PR complementar com testes isolados, conforme o encaminhamento do dono e o `AGENTS.md` do Flow. Este documento não executa implantação ou migração.

## 1. Estado conferido

| Frente         | Evidência                                                                                                                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gatilho        | [Origem 41256948853](https://github.com/Proh2026Media/flow-proh-media/actions/runs/41256948853) e [hub 41256954251](https://github.com/PROH-Media/hub-control/actions/runs/41256954251) com sucesso, passos específicos conferidos pelo Codex. Issue #17 fechada. Não disparar novamente para repetir a prova |
| PR de proteção | #35 integrado em **31/10, 21:32:55 de Brasília** (01/11, 00:32:55 UTC), commit `e82919c77eed12440409d465b596822cfca1efcb`. Origem e espelho nesse commit na consulta posterior do Codex                                                                                                                       |
| Fonte nova     | `google-drive/index.ts`: blob `83d9965eaa58ddd7f7ed5bc82259df0300473ee8`; novo `protecao.ts`: blob `10f7a3c8d9614f7a9f6a782a791a474ac8525716`                                                                                                                                                                 |
| Servidor       | Leitura SSH do Codex, sem chamadas à função ou alterações: `index.ts` implantado ainda no blob antigo `17e98b8278747857329dcf38d1412b682e3c714e`; `protecao.ts` ausente. O push/espelho do frontend não implantou a função da VPS                                                                             |
| Site           | HTTP 200 nas quatro URLs públicas consultadas; bundle atual `index-BtYtShCP.js`, posterior ao `index-C_Xk5GVy.js` do relatório TI. Essa leitura estática não é novo teste de interface nem de OAuth                                                                                                           |

O PR descreve 47 testes com mocks; o Codex não executou essa suíte do Flow nesta rodada. Leu o módulo de proteção e trechos da integração e executou **quatro reproduções adicionais**, sem rede, banco ou credenciais reais. Testes gerais do Barba & Cabelo são uma verificação separada.

## 2. Achado reproduzido: IDs de subpastas não são validados

Na fonte do commit acima:

- [`garantirRaiz`, linhas 93–107](https://github.com/Proh2026Media/flow-proh-media/blob/e82919c77eed12440409d465b596822cfca1efcb/supabase/functions/google-drive/protecao.ts#L93), inspeciona somente `root_folder_id`. `clientes_folder_id` e `trash_folder_id` já gravados são devolvidos diretamente. Se uma subpasta estiver inacessível, não há erro; se a outra estiver sem ID, ainda pode ocorrer criação/gravação sem conferir primeiro todos os IDs existentes.
- [`validarEGravarCandidata`, linhas 277–299](https://github.com/Proh2026Media/flow-proh-media/blob/e82919c77eed12440409d465b596822cfca1efcb/supabase/functions/google-drive/protecao.ts#L277), valida a raiz com o token candidato, mas salva a nova conexão sem conferir os dois IDs de subpastas. A raiz acessível não demonstra que todos os IDs necessários foram aceitos pelo novo token.

**Reprodução isolada do Codex:**

| Caso com dados fictícios                         | Resultado observado na fonte do PR #35       | Resultado esperado                                |
| ------------------------------------------------ | -------------------------------------------- | ------------------------------------------------- |
| Raiz acessível, Clientes 404                     | Somente raiz inspecionada; operação aceita   | Erro explícito antes de qualquer criação/gravação |
| Raiz acessível, Lixeira 403                      | Somente raiz inspecionada; operação aceita   | Erro explícito, IDs preservados                   |
| Raiz acessível, Clientes na lixeira              | Somente raiz inspecionada; operação aceita   | Erro explícito, IDs preservados                   |
| Callback: raiz acessível, subpastas inacessíveis | Candidata gravada; somente raiz inspecionada | Rejeitar candidata e conservar conexão anterior   |

Os helpers foram convertidos para JavaScript em pasta temporária para executar apenas as funções puras; todas as dependências foram substituídas por funções locais. Nenhuma chamada ao Drive, banco, callback ou painel de produção foi feita.

## 3. Ajuste solicitado no PR complementar

1. **Conferir todos os IDs existentes antes de produzir efeitos.** Em `garantirRaiz`, inspecionar raiz, Clientes e Lixeira que já tenham ID. Diante de 403, 404, lixeira ou falha de inspeção, interromper antes de criar uma subpasta ausente ou salvar IDs. Manter a criação legítima para IDs ainda ausentes, após validar os existentes.
2. **Usar o token candidato nas três verificações do callback.** Antes de salvar a candidata, validar cada ID principal já gravado e tratar dados incoerentes, como subpastas sem raiz. Conservar conexão inteira, IDs, cliente anterior e campos de varredura se a validação falhar. Não revogar concessões como limpeza.
3. **Testar a orquestração real do callback, além do helper.** [`handleCallback`, linhas 827–847](https://github.com/Proh2026Media/flow-proh-media/blob/e82919c77eed12440409d465b596822cfca1efcb/supabase/functions/google-drive/index.ts#L827), ainda chama `ensureRootFolders` depois de salvar a conexão candidata. Cobrir falha de preparação de pasta/persistência nessa etapa e demonstrar recuperação ou estado parcial explicitamente tratado; não afirmar que nada foi gravado quando já ocorreu gravação. Não usar desconexão/revogação para desfazer.

**Casos de regressão:** 403/404/lixeira em cada uma das três pastas; falha de inspeção; uma subpasta inválida e a outra sem ID; subpastas sem raiz; todas acessíveis; primeira conexão sem IDs; callback com token candidato; falha após a gravação da candidata. Conferir chamadas e estado final: nenhuma criação/gravação nos casos barrados, nenhuma substituição silenciosa de ID, campos anteriores preservados. Executar também os testes existentes do Flow.

Devolver link do PR complementar, commits e resultados/limites dos testes. Seguir branch/PR e gerenciador de pacotes do Flow; não editar/publicar pelo fluxo do Barba & Cabelo. Testes locais com mocks não precisam iniciar a stack de teste ou configurar Google.

## 4. Ordem seguinte

Após corrigir e revisar a versão complementar, preparar o pacote de implantação/ensaio com o TI. A versão nova importa `./protecao.ts`: uma futura implantação precisa levar **os dois arquivos correspondentes**, com cópia/retorno e validação, sem copiar apenas `index.ts`. Não executar essa instalação pelo relatório do gatilho nem contornar as guardas dos scripts do Flow.

Destino/operador Google, propriedade associada, acesso às pastas do novo app, cópia protegida/restauração e renovação real continuam pendentes. Páginas e gatilho estão atendidos; não refazer. Cliente Barba & Cabelo, cron P-26 e teste parado preservados. P-28 ainda não está pronta para vídeo/reenvio ou migração.
