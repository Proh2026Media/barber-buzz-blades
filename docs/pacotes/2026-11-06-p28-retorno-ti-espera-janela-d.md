# P-28 — Retorno conciliado: E1 informada como concluída, E2 em espera

**06/11/2026 · ChatGPT/Codex · Registro documental, sem execução operacional.** Responde ao `relatorio-ti-p28-recebimento-pacote-janela-d-2026-11-06.md`, TI às **17h BRT**, lido inteiro (36 linhas, SHA-256 `cef409970d21b353674e140134789c2a4cf82c0b0d3725bffebffd93c9404527`). Atualiza o [encaminhamento anterior](2026-11-06-ti-flow-coordenacao-separacao-p28.md) e a [revisão própria do #45](2026-11-06-flow-revisao-pr45-p28.md).

## Estado recebido e atribuição

| Item                             | Estado informado e fonte                                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **E1 — instalação**              | **Concluída**, conforme TI: autorização de Alyson às 15h51 e execução 15h52–16h01 de 06/11, somente função do Flow; sem Redeploy, D ou alteração do B&C.                             |
| Código instalado                 | `57f8fd4820fad47a4336b4302e1babc7d8ad96b7`, três arquivos. TI relata manifesto 3/3; Claude informa função idêntica à main `32c3d54cf68887ea1695fa0338518edce476df7a`.                |
| Runtime/comandos reais           | Claude informa #46/#47 integrados, ensaio de runtime e `virada-real.ts` entregues, 203/203 ferramentas e 145/145 app. **Evidência Claude, não nova revisão/teste próprio do Codex.** |
| Frontend                         | Claude informa o site publicado com o hook de ticket #43 e conferência pública do artefato. A publicação não deve ser pedida novamente.                                              |
| StartedAt esperado das funções   | `2026-11-06T18:53:37.367156197Z` (15h53min37 BRT), conforme TI. Banco e B&C relatados saudáveis/inalterados.                                                                         |
| Marco                            | `p28-barreira-6`, `2026-11-06T19:00:05.868Z` = **06/11 às 16:00:05.868 BRT**, posterior ao início do container.                                                                      |
| **E2 — espera**                  | **Em andamento**. Marco +168 h = **13/11/2026 às 16:00:05.868 BRT**, condicionado à validade do marco/StartedAt. Não contar a partir do merge.                                       |
| Legado/modelo/autorização real/D | Não executados nem autorizados por este retorno. O pacote da janela foi recebido/aceito pela TI, sem execução de suas Partes 1–3.                                                    |

Foram lidos também os apoios encontrados em Downloads: `relatorio-ti-p28-etapa1-instalacao-2026-11-06 447.md` (141 linhas, SHA-256 `4fac611c703fd3dc1a3ddc48f40ba882f742131496868eab80596fb7cfce2cdd`) e `relatorio-claude-flow-estado-consolidado-p28-2026-11-06.md`, versão 2 (160 linhas, SHA-256 `90db282b545b2766a2fe812e8ae1fde37e18696cb01496218c7417f8732b66e9`). Nenhuma consulta VPS/Google ou de código/GitHub do Flow, leitura do recibo privado ou execução dos procedimentos foi feita nesta rodada; instalação/publicação/testes adicionais permanecem atribuídos aos respectivos relatos.

## Pontos conciliados

- **Espera:** a versão corrigida da E1 diz esperar **até** 13/11, não começar outras 168 h nessa data. A diferença entre as duas versões locais da E1 limita-se à correção dessa frase.
- **Hashes:** a TI às 17h informa que verificou por volta de 16h50 os três SHA-256 completos de 64 caracteres no recibo; o campo de 40 é o commit. Isso responde à dúvida anterior do consolidado Claude. O recibo privado não foi aberto pelo Codex.
- **Recibo fresco:** o de 06/11 não serve como conferência do dia da janela. A validade de 2 h exige nova emissão próxima ao uso, prevista no passo 1.3; não gerar agora nem substituí-lo manualmente.
- **Máquina de operação:** checkout `32c3d54`, Bun 1.4.x e acesso adequado ao banco ainda precisam da checagem operacional 1.1. Arquivos de conexão/origens ficam a cargo do Guardião de Acessos, com modos privados; não pedir valores no chat.

## Acompanhamento e próximo passo

O anexo **registra uma autorização dada à TI às 16h46**, restrita a leitura diária do StartedAt e pré-checagens somente de leitura. Não é autorização nova ao Codex para executar o pacote ou criar outra automação.

| Quem                  | Próxima ação registrada                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TI**                | Leituras diárias de **7 a 13/11, por volta das 10h BRT**, avisando só se o StartedAt mudar. Se mudar, parar/relatar conforme o procedimento; nenhuma remarcação ou reinício automático autorizado aqui. |
| **TI**                | Em **13/11 às 16h15 BRT**, checagens somente de leitura dos passos **1.0, 1.1, 1.2 e 1.4**, conforme a autorização relatada.                                                                            |
| **Alyson + TI**       | Completar a Parte 1 com o **passo 1.3/recibo novo** somente com a A1, perto da janela. A A1 não foi dada/executada nesta conversa por anexar o relatório.                                               |
| **TI → Alyson/Codex** | Relatório pré-janela, distinguindo as checagens já autorizadas da parte que ainda depende da A1. A2/modelo e A3/janela/D são posteriores e não estão autorizados por este registro.                     |
| **Claude/Flow**       | **Nenhuma ação nova necessária agora**, segundo ambos os relatos. Não reenviar o pedido de desenvolvimento/instalação já atendido.                                                                      |
| **Codex/B&C**         | Manter o foco no B&C e conciliar o próximo retorno consolidado. P-28 continua pendente externa, sem impedir manutenção e P-42/P-43.                                                                     |

O pacote operacional citado é `2026-11-06-claude-ti-pacote-janela-d-p28.md`; este registro não altera seus comandos nem solicita uma frase de autorização. O acompanhamento descrito é da TI: **nenhum agendamento/leitura diária duplicados foram criados pelo Codex**.

## Observação do worker de 60 segundos

O último parágrafo do anexo sugere, opcionalmente, avaliar uma atividade que permanece `ativa` após encerramento do worker. Não foi interpretado como pedido do dono para reabrir desenvolvimento do Flow. O anexo não comprova uma ocorrência atual; se a condição aparecer na drenagem, a indicação recebida é parar/relatar pelo procedimento. Não apagar atividades por prazo nem presumir zero para liberar D.

**Permanecem:** espera/preflight, decisões operacionais posteriores, eventual janela D/aceitação e relatório final; depois, propriedade/marca e vídeo/reenvio Google do B&C. P-69, A/B/T1, Picker dos 15, custódia e cliente B&C preservados; sem repetição dos ensaios, consentimento ou renovação.

## Verificação documental B&C

`scripts/verificar.sh` saída 0: tipos, **301 testes B&C**, Prettier dos sete documentos e montagem aprovados; eslint não aplicável, nenhum TS/TSX alterado. **13 links locais novos**, diff e cálculo +168 h em America/Sao_Paulo conferidos. Avisos PWA de padrões sem correspondência iguais aos já registrados, sem mudança de código/PWA. Formatação dos dois registros reconferida após inserir resultados. A cópia própria de coordenação em Downloads, idêntica ao original anterior, recebeu o aviso E1/E2; não se sobrescreveu conteúdo divergente do usuário. Entrega documental, arquivos `.env`/`.vscode/` preservados; nenhuma operação Flow ou agendamento executados pelo Codex.
