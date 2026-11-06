# P-28 — revisão dos PRs #46–#48 e novo marco da E1b

**06/11/2026 · ChatGPT/Codex.** Responde à devolutiva `2026-11-06-claude-codex-devolutiva-p28.md`, lida inteira: 91 linhas, SHA-256 `c51d48d7f756f6e05e866538500839f77973f02214ef4247eda5a535226f5066`. A revisão anterior do [#45](2026-11-06-flow-revisao-pr45-p28.md) permanece válida para seu conteúdo. Esta rodada confere o delta posterior, sem instalar ou operar o Flow.

**Resultado:** #46 e #48 sem novo achado no recorte examinado; **dois achados nos comandos reais do #47**, com três reproduções negativas. Suíte entregue: **207 passaram/0 falharam/0 pulados**, 2.177 asserções; app Flow **148/148**; tipos do app e lint dos arquivos alterados limpos. Independentes: **4 passaram/3 falharam**, 36 asserções. A Parte 3/D aguarda correção e revisão desses achados. [Devolutiva única para Claude, com ciência da TI](2026-11-06-claude-flow-ajustes-pr46-pr48-p28.md).

## Código efetivamente conferido

GitHub autenticado e checkout separado, sem alteração de fonte do Flow. Integrações confirmadas por metadados dos PRs e Git; cada merge tem conteúdo idêntico ao respectivo head.

| PR                                                              | Head                                       | Merge                                      | Integração em 06/11, BRT |
| --------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------ | ------------------------ |
| [#46](https://github.com/Proh2026Media/flow-proh-media/pull/46) | `3c3358e8c60ffed8b3f6373ad1a17987cce7c3fc` | `57f8fd4820fad47a4336b4302e1babc7d8ad96b7` | 14:49:46                 |
| [#47](https://github.com/Proh2026Media/flow-proh-media/pull/47) | `abf7288b2805b85a958c1cea6e264dda95e6c4a3` | `32c3d54cf68887ea1695fa0338518edce476df7a` | 15:38:47                 |
| [#48](https://github.com/Proh2026Media/flow-proh-media/pull/48) | `e162fdd21eddb21f2a65086b57ef1df2e8a97641` | `d0a687a675c6d7ddd26739a5f566a7e71c7fb992` | 17:15:45                 |

Delta #45→#48: **16 arquivos, +2.043/−98**. Árvore completa do merge #48 `1ede36c52d9a621b550f384f851c0908a1ebf4d3`; ferramentas `ae3ed708daffc92c76fa2503363b22c290b368dd`; função `19096550f8930afcc12932d4e153f4c867397cf3`. Os três SHA-256 da função neste checkout são iguais aos publicados no relato da E1b:

| Arquivo       | SHA-256 próprio                                                    |
| ------------- | ------------------------------------------------------------------ |
| `barreira.ts` | `6de959d8fd4cf03f108f82a4c48daff0f5516f57e23424ca80cc5bd0e40d2abd` |
| `index.ts`    | `460d5a9b964f91030ffe8dcea2bf2ba901dd9b5c5f31ac2171334bab17b4a506` |
| `protecao.ts` | `8d8b1c0ad8dce25b46bba881c22f46d9038bef50e010d3c163768114fb970c34` |

## Ensaios próprios e limites

Ambiente descartável: Bun 1.4.2 nativo, PostgreSQL **15.8** vazio, acessível somente por loopback e arquivo de conexão fictícia 0600. Testes da versão real usam um banco local sem o marcador fictício, ligado à autorização de ensaio pela identidade do PostgreSQL; nenhum alvo real. Google simulado e rede externa da função recusada pelo ponto de entrada do ensaio. Não se abriu `.env` nem qualquer recibo/candidato/cópia B real.

Runtime **`supabase/edge-runtime:v1.71.2`**, digest local `sha256:2c0994891f47466d8791b714bac9a05842dec637feba050fc736e4fdedae0a43`, arm64. `P28_EDGE=1` e PostgreSQL habilitados: **os dez cenários de runtime rodaram**, inclusive ALS no mesmo worker, erro capturado pelo cron, falha de escrita, upload com ticket/aba antiga/outro usuário, morte do worker, retorno à #36 e troca v6→v7. O retorno usou o commit #36 `926298529da2b0e565599eb3e1f86d834e514be1` obtido do Git. A suíte inteira completou em aproximadamente 59 s, sem pulos.

Limites mantidos: PostgREST simulado, sem Kong/JWT real, Google real, carga/limites da VPS ou arquitetura amd64 da produção. O digest informado para a VPS é evidência externa da TI/Claude; aqui foi conferida a imagem local. Autoria dos arquivos de autorização/recibo continua dependente da custódia operacional. Criação interrompida sem ID continua bloqueando com resultado desconhecido, como previsto. Não são testes de produção nem garantia irrestrita de ausência de bugs.

| Independente                                                            | Esperado                                               | Observado                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| Promoção normal, posterior/recibo e encerramento da operação ao reabrir | 0, par novo e uso encerrado                            | **Passou**                                                            |
| Par autorizado diferente, antes do COMMIT                               | 1, par antigo                                          | **Passou**                                                            |
| F1a: falha ao salvar posterior, após COMMIT                             | 3, exigir intervenção                                  | **Falhou:** 1, par novo; reabertura explícita do ensaio aceitou 0     |
| F1b: falha ao salvar recibo, após COMMIT                                | 3, exigir intervenção                                  | **Falhou:** 1, par novo, posterior existente                          |
| Falha ao registrar passo da operação, após COMMIT                       | 3, manter barreira fechada                             | **Passou**                                                            |
| F2: dois fechamentos com autorizações distintas, simultâneos            | no máximo uma operação em curso, vencedor pode reabrir | **Falhou:** duas em curso, códigos 0/1; vencedor não consegue reabrir |
| Registro antecipado recusado pelo banco                                 | nenhuma chamada mutante ao Google                      | **Passou**, zero chamadas                                             |

F1 foi provocado por colisão de nomes na pasta fictícia **depois** do COMMIT, pelo gancho de teste existente: pasta com nome `captura-posterior.json` ou com o nome do recibo. Sem adulterar o código revisado, relógio, par ou prova. F2 foi sincronizado com `LOCK TABLE ... IN SHARE MODE` em conexão de controle: as duas sessões puderam ler, e ambas ficaram esperando o INSERT; só então o teste liberou a trava. Assim não depende de acertar uma corrida por acaso.

Artefatos locais desta revisão: `/tmp/p28-pr48-diretorio` aponta para o diretório privado de trabalho; `independentes.test.ts` SHA-256 `df70ac886f6184b9c891145430c1e604c7ed5762fc9481d5667e2f99613a0588`, resumo permitido SHA-256 `aa4815fc776973c733a9fb1b097bc9182e25a59b79203fccaa549f4588f6f984`. Não são hashes de material secreto. Ao fim, PostgreSQL e containers de runtime próprios retirados (seis nomes, oito execuções); conexão fictícia apagada, fonte Flow intacta. Não se modificou repositório/serviço remoto do Flow.

## Achados a corrigir

**F1 — alta: saída 1 depois de o par já ter mudado.** `virada.ts:741` (`cmdPromover`), gravações do posterior/recibo em torno de 765–778 e captura genérica em `despachar`; integração real do #47 usa esse caminho compartilhado preexistente. A alteração do par pode estar confirmada quando a gravação privada falha; a captura genérica devolve 1. O roteiro v2, passo 3.6, interpreta 1 como nada gravado e manda ao 3.10 para reabrir sem aceitação/retorno. O teste confirmou par novo e saída 1; a barreira só abriu porque o ensaio chamou explicitamente `barreira-abrir` seguindo essa orientação — a ferramenta não a abriu automaticamente. É preciso distinguir falhas anteriores à escrita das posteriores ou de resultado indeterminado, com saída 3 nestas últimas e procedimento coerente. Também revisar a classificação após a escrita do retorno, sem ampliar escopo funcional.

**F2 — média: admissão da operação não atômica.** `virada-real.ts:184–198`, `exigirOperacao`: SELECT dos registros e INSERT acontecem sem exclusão/transação conjunta. Duas autorizações distintas passam na ausência inicial de operação. Uma fecha a barreira; a outra recebe `ja_fechada`, mas ambas deixam `drive_operacao:*` em curso. O vencedor recebe `outra_operacao_em_curso` ao tentar reabrir; nenhuma recuperação normal é possível com essas autorizações. Requer duas tentativas autorizadas sobrepostas, não demonstrou troca indevida do par. Serializar a decisão e persistência, sem linha ativa para o perdedor, preservando vínculo e uso único. Não é pedido de limpar linhas à mão na produção.

## E1b recebida: horários que substituem os de 17h

Fontes de apoio lidas integralmente: TI E1b (154 linhas, SHA-256 `a3e0e3017b2865363d10e0ded57610fff84713ab40062cd1583cfbd21e1319f8`); conferência Claude E1b (64, `fb6dd7369779305968e00a73d825ae71c3b7be1eb4f2ed1d80b38e032494c8fb`); pacote da janela v2 (297, `3311c162026f04d2abfbe956cc4998a43446a5528b86348ccd153f56309f2513`). O consolidado Claude v3 foi lido como histórico anterior à execução: seu pedido de reinstalar já foi atendido pelo relato TI E1b posterior. **As frases contidas nesses documentos registram o que foi relatado; não são autorização nova ao Codex.**

| Item            | Estado recebido, atribuído à TI/Claude                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| E1b             | Concluída; autorização R1 às 17h23 e reinício somente das funções Flow; código #48 / `p28-barreira-7`              |
| StartedAt       | `2026-11-06T20:25:17.402850757Z`                                                                                   |
| Marco           | `2026-11-06T20:30:07.445Z` = **06/11 17:30:07.445 BRT**                                                            |
| Marco +168 h    | **13/11/2026 17:30:07.445 BRT**, se mantidas as condições operacionais                                             |
| Parte 1         | Devolutiva informa **A1 já autorizada** e TI agendada para **13/11 às 17h45 BRT**, com recibo novo de validade 2 h |
| Partes 2/3 e E5 | Modelo/A2, janela D/A3 e relatório final ainda pendentes; D não executada no relato                                |

Os horários **16:00:05.868/16h15** e o pacote da janela v1 estão superados. Não duplicar monitoramento, pedir novamente A1 já relatada, reinstalar, republicar site, repetir A/B/T1/Picker dos 15, consentimentos, renovações ou inventários.

**Próximo:** Claude corrige F1/F2 em PR de ferramentas, com testes e ajuste do roteiro. Esses achados não exigem mudar os três arquivos da função: **não indicam reiniciar as 168 h atuais**. Se a correção mantiver os hashes da função, atualizar apenas checkout e referência da ferramenta no pacote TI; comprovar isso no retorno. TI mantém acompanhamento já registrado; a Parte 3 espera correção/revisão e sua autorização específica. Codex continua o B&C; P-28 é dependência externa. Após D e E5, restam propriedade/marca e vídeo/reenvio Google do B&C. Sem SSH/VPS/Google real, instalação, agendamento duplicado ou operação D nesta rodada.

## Verificação da entrega documental B&C

`scripts/verificar.sh` saída 0: tipos, **301 testes B&C**, Prettier dos nove documentos e montagem aprovados. ESLint não aplicável ao delta documental. **19 links locais para os novos registros** e `git diff --check` aprovados; cálculo +168 h conferido. Avisos PWA de padrões sem correspondência iguais aos anteriores, sem alteração de código/PWA. A cópia anterior de coordenação em Downloads só é sincronizada se igual à referência anterior; a devolutiva nova é entregue como arquivo próprio, sem sobrescrever arquivo divergente. `.env`/`.vscode/` preservados.
