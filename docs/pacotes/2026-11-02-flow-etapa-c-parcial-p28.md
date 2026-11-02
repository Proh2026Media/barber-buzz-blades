# P-28 — C parcial: raiz antiga inacessível; temporários encerrados

**02/11/2026 · C executada parcialmente, não aprovada; D não iniciada.** Conta/cliente/escopo confirmados, raiz 404, candidato preservado e nenhuma renovação. Temporários já encerrados pelo Codex, custódia e produção preservadas. Preparação Picker entregue no PR #39 e revisada: [ajustes para Claude no mesmo PR](2026-11-02-flow-revisao-pr39-picker-p28.md), sem integrar/executar Google real antes da correção. O histórico de C abaixo continua válido; não repetir consentimento/limpeza.

## 1. Fonte e autorização relatada

Lido inteiro **`relatorio-ti-flow-etapa-c-p28-2026-11-02.md`**, **215 linhas**, SHA-256 `db11308fbf9a2baeb5ec31e1095ade2b7cbe8931b346bce8133bae8f4a7029ad`. TI registra autorização explícita de Alyson às **14:44 Brasília / 17:44 UTC** para C e confirmação ao Guardião para o depósito ~15:00 / 18:00. Aproveitar essa autorização como fato relatado da execução; não pedir C de novo nem tratar alternativas/pergunta do anexo como instruções automáticas.

Operação **`20261102T174701Z-ad137cf3`**, base **`/root/flow-p28-c-20261102T174701Z-ad137cf3/`**, root:root/0700. [Procedimento C que delimitou a operação](2026-11-02-ti-flow-execucao-c-p28.md). A/B/T1 permanecem atendidos. Esta frente é dependência Google da **P-28 do Barba & Cabelo**, sem alteração de seu cliente Auth.

## 2. Resultado e atribuição das evidências

| Item                      | Resultado                                                                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Isolamento sem credencial | TI relata alvos fictícios ativos inacessíveis, contadores INPUT/encaminhamento e HTTPS sem token 404/401; alvos/rede fictícios retirados antes da credencial. Não repetido pelo Codex                                         |
| URI local                 | TI relata adição **14:53 Brasília / 17:53 UTC** somente no cliente novo “Flow Drive (produção)”, projeto `flow-proh-media-drive` / 930474870480; URI de produção preservada. Local permanece; console não reaberto pelo Codex |
| Credencial                | Guardião depositou segredo existente, sem criar outro. Cópia B não montada no runner. Não foram lidos valores de credencial/candidato pelo Codex                                                                              |
| Configuração              | Primeiro conferir falhou por versão ausente; Guardião ajustou versão/chave extra. `conferir-2` exit 0 / resultado ok, conferido por leitura do resumo permitido                                                               |
| Manifesto                 | TI relata três principais, referências **0**, operador **0**. Ausência de fonte em B não prova ausência de arquivos no Drive; compatibilidade de arquivos antigos não exercitada                                              |
| Consentimento             | **15:05:56 Brasília / 18:05:56 UTC**; conta/cliente novo conferem, escopo ok/somente drive.file; aviso de app não verificado não observado segundo TI                                                                         |
| Saída iniciar             | **2**, conferida na VPS; JSON traz `situacao:concluido` para o consentimento, mas `leituras.interrompido:true` / `principal_raiz_inacessivel` e candidato guardado. **Resultado global parcial**, não sucesso                 |
| Raiz / demais itens       | HTTP **404** na raiz segundo TI; Clientes/Lixeira não lidos porque a ferramenta interrompe no primeiro principal; sem prova de acesso aos três                                                                                |
| Renovação                 | Não executada; nenhuma prova imediata/após vencimento. Candidato existente e consentimento correto não aprovam C                                                                                                              |

Codex leu apenas campos permitidos de `iniciar.json`, `conferir-2.json` e o exit code. Conferiu modos/tamanho/dono dos arquivos sem abrir credencial/configuração/manifesto/candidato. O corpo privado do log de início, B e os valores de ambiente não foram lidos/exportados.

## 3. Recursos observados e encerramento realizado

Leitura própria antes da retirada confirmou container com **somente `sleep`**, sem processo OAuth ativo; UID 0:0, rede única C, nenhuma PortBindings, fonte RO e base privada RW. Rede tinha apenas esse endpoint e labels exatos da operação. Porta 8765 e servidor fictício 18080 já sem listener na VPS. Ponte/túnel e link temporário no box haviam sido encerrados pela TI, segundo seu relatório.

O [procedimento C, seção 8](2026-11-02-ti-flow-execucao-c-p28.md#8-encerramento-e-devolutiva) já incluía retirar temporários após o ensaio/falha. Codex escolheu concluir esse encerramento, sem manter infraestrutura ociosa para uma renovação que não resolveria por si só o 404. Não foi nova autorização de Google, Picker ou D. O candidato pode ser usado em futura bancada revisada sem manter este container/rede ativos.

**Retirada própria: 15:18:02.941–15:18:03.788 Brasília / 18:18:02.941–18:18:03.788 UTC, em 02/11.** Revalidou IDs/labels, rede/endpoints, ausência de tarefa em curso, saltos únicos e arquivos privados antes de alterar:

- Container removido: **`44d7a18dfbc97c9d6d6f168e23709b28fdd2084c41c8d6c32b3c08369da03eb1`**.
- Rede removida: **`a0dc869f9f5881c42218d0ec1200f3381bc0a929efbd0b9e04be2cebb8382e71`**, `flow-p28-c-20261102T174701Z-ad137cf3`, bridge `p28cad137cf3`.
- Saltos exclusivos da operação retirados de DOCKER-USER/INPUT; esvaziadas/excluídas **somente** `P28CF_ad137cf3` e `P28CI_ad137cf3`.
- Conferência posterior: **zero containers/redes da operação**, nenhum listener 8765/18080 na VPS e cadeias-pai idênticas ao estado anterior sem os dois saltos C. Não houve flush global, prune, `pkill`, restart ou remoção de arquivo privado.
- Metadados dos seis arquivos conferidos — credencial, configuração, manifesto, candidato, resumo iniciar e exit — iguais antes/depois: inode, tamanho, mtime, dono e modo 0600. Não calcular/publicar hash de segredo como prova. Base/cópia B não alteradas; socat instalado e URI local mantidos.

| Serviço      | ID preservado                                                      | Saúde   | Início preservado                |
| ------------ | ------------------------------------------------------------------ | ------- | -------------------------------- |
| Banco Flow   | `80c3d9164c0785eb79b717f2153dca544dfb78bf2dd51ce767b5e752098d313f` | healthy | `2026-10-23T20:44:50.472960587Z` |
| Funções Flow | `d411e8225ad969f98d929f9ed471eb32450f098aab52206ce5b892f8aa49e2d4` | healthy | `2026-11-01T18:32:29.790943603Z` |

Sessão tmux histórica `p28c` não foi apagada; janela consultada `iniciar:bash`, sem listener/container C. Não confundir shell histórico com bancada ativa. Os PIDs/IDs do relatório são históricos e não devem ser reutilizados.

## 4. Interpretação e próximo trabalho

404 pode representar item inexistente ou falta de acesso; não comprova exclusão da raiz. `drive.file` concede acesso por item associado/selecionado para o app. A mudança para o cliente no projeto dedicado é compatível com a hipótese de falta de autorização aos itens antigos, mas **não a comprova**. Sem nova consulta Google nesta revisão, ainda falta excluir divergência na seleção dos IDs. [Tratamento oficial de 404](https://developers.google.com/workspace/drive/api/guides/handle-errors), [escopo por arquivo](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Próxima preparação recomendada: **seleção explícita dos itens com Google Picker, mantendo drive.file**, em bancada separada e opt-in. A documentação atual oferece seleção integrada ao OAuth com `trigger_onepick=true`, retorno `picked_file_ids`, multisseleção e seleção de pastas. Isso permite estudar uma opção sem distribuir access token no JavaScript do app; suporte ao cliente/fluxo existente ainda deve ser verificado e ensaiado, sem prometer acesso recursivo a todos os descendentes. [Guia oficial do Picker integrado](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker).

O [pacote para Claude](2026-11-02-claude-flow-picker-seletivo-p28.md) pede código e testes **fictícios em PR em rascunho**. Não habilitar API, criar chave/cliente, iniciar novo consentimento, usar o candidato real ou alterar a conexão viva agora. Nova execução real terá revisão/decisão própria, pois C consumiu seu consentimento delimitado. Renovação do candidato parcial, sozinha, não corrige o acesso nem a cobertura antiga.

Não escolher automaticamente recriar raiz, copiar acervo com dois clientes ou ampliar escopos. Se Picker não resolver a compatibilidade delimitada, levar a evidência ao dono antes de alterar a direção de separação escolhida. D e vídeo/reenvio Google do Barba & Cabelo continuam posteriores.

**Validação documental:** tipos, **301 testes Barba & Cabelo**, formatação dos oito documentos e montagem aprovados; 21 links locais e uma âncora conferidos. Nenhum código aplicativo/Flow alterado. A conferência e retirada dos temporários não são renovação nem aprovação de C.
