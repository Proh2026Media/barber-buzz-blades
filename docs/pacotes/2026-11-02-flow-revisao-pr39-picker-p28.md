# P-28 — Para Claude/Flow: revisão do PR #39, correções antes de integrar

**02/11/2026 · Revisão concluída sobre `8a5e9b9`; PR em rascunho, aguardando correções.** [PR #39](https://github.com/Proh2026Media/flow-proh-media/pull/39). Os 81 testes existentes passaram na execução própria, mas quatro reproduções adicionais demonstraram uma mesma falha na aprovação da renovação. Corrigir **no mesmo PR**, sem outro inventário, teste A/B/T1, Google real ou tarefa para TI agora. C continua parcial pelo 404; D não iniciada.

## 1. Versão conferida e alcance

Relatório **`relatorio-claude-flow-picker-seletivo-p28-2026-11-02.md`** lido inteiro, **246 linhas**, SHA-256 `20819a698f9ac1451e799c60f7c34bf5676f47a3388d6d271bbe96c6374c41c4`. Seus resultados/propostas não foram tratados como autorização de integração ou execução real.

| Item             | Conferência                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estado GitHub    | Open/em rascunho, não integrado, branch `ia/claude-p28-picker-seletivo`                                                                                                             |
| Base             | `9837ebc873554d3e7685f792c18d01349418ed2e`                                                                                                                                          |
| Commit analisado | `8a5e9b9a91d558dd163d9879aa30115f48c7b4fe`                                                                                                                                          |
| Ferramentas      | Árvore `0a9ec80ff00b2652c9e5dffd489a12fd8d4ccfa6`, **20 arquivos**                                                                                                                  |
| Delta            | **8 arquivos**, +586/−21; código da bancada/testes e documentação, sem app, funções ou migrations                                                                                   |
| Artefatos        | 22 arquivos obtidos por leitura (20 ferramentas + AGENTS/package); cada conteúdo conferido contra seu blob Git. Os oito SHAs da tabela do relatório correspondem ao delta no GitHub |
| Preservação      | Arquivos de banco, retorno, cópia, proteção de arquivos e `ensaio.ts` conferidos contra #38, sem mudança. Nenhum dado real usado                                                    |

A direção implementada é adequada: modo opt-in, seleção por IDs esperados, três principais conservados, token no servidor, GETs posteriores, candidato anterior sem sobrescrita. Isso não elimina o problema de aprovação abaixo.

## 2. Correção funcional: renovação perde a condição da seleção

**Problema:** `comandoRenovar` carrega candidato/manifesto e executa `ensaioRenovacao`, mas não confere modo/origem, evidência ou completude da seleção. O candidato gravado também não carrega vínculo verificável com esse estado. Assim, um `iniciar-picker` corretamente parcial pode virar **exit 0 / `ensaio_aprovado:true`** na renovação, sem corrigir/comprovar a seleção. A afirmação “amostra incompleta nunca aprova” não vale para esse caminho.

Locais do commit analisado: [renovação sem seleção, `bancada.ts:157`](https://github.com/Proh2026Media/flow-proh-media/blob/8a5e9b9a91d558dd163d9879aa30115f48c7b4fe/ferramentas/p28-drive/bancada/bancada.ts#L157), [gravação do candidato e resultado parcial, `servidor.ts:140`](https://github.com/Proh2026Media/flow-proh-media/blob/8a5e9b9a91d558dd163d9879aa30115f48c7b4fe/ferramentas/p28-drive/bancada/servidor.ts#L140), [formato/validador do candidato, `ensaio.ts:119`](https://github.com/Proh2026Media/flow-proh-media/blob/8a5e9b9a91d558dd163d9879aa30115f48c7b4fe/ferramentas/p28-drive/bancada/ensaio.ts#L119).

**Quatro reproduções independentes, todas com provedor fictício e GETs 200:**

| Preparação                                                                                            | Resultado observado de renovar                  | Resultado necessário                                                                          |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Selecionar só os três principais, deixando a amostra fora; iniciar retorna parcial/amostra incompleta | **0 / aprovado true**, após vencimento fictício | Não aprovar enquanto faltar seleção exigida; diagnóstico de renovação pode continuar separado |
| Iniciar completo; remover apenas a evidência privada de seleção                                       | **0 / aprovado true**                           | Recusar aprovação Picker sem prova vinculada                                                  |
| Iniciar completo; alterar o manifesto para amostra de outro ID                                        | **0 / aprovado true**, GETs do novo manifesto   | Não reutilizar seleção de outro conjunto de IDs                                               |
| Criar candidato do modo padrão; acrescentar `picker` à configuração e renovar                         | **0 / aprovado true**                           | Candidato sem origem/seleção Picker não pode virar prova Picker pela configuração             |

Os testes adicionais exigiram recusa e **falharam nos quatro casos**, reproduzindo a lacuna; não foram alterados para ficar verdes. São variações de **uma falha de vínculo/critério**, não quatro defeitos independentes. Os GETs simulados aprovados não corrigem automaticamente a seleção exigida pelo contrato.

### Ajuste mínimo esperado

- Persistir privadamente origem/modo e estado da seleção, ligados ao candidato/operação/cliente e ao conjunto esperado de IDs. Escolher formato mínimo verificável, sem expor IDs/hashes privados na saída pública. Não depender só de `cfg.picker` atual ou de encontrar qualquer arquivo de seleção.
- Renovação Picker deve validar esse vínculo, completude e correspondência com o manifesto atual; evidência ausente, truncada, de outra operação ou manifesto divergente impedem aprovação. Retirar `picker` da configuração não deve apagar a origem Picker do candidato.
- Preservar candidatos padrão legados e seu comportamento documentado, inclusive C parcial; não inventar campos no arquivo real nem converter legado para Picker automaticamente. Configuração incompatível deve ser recusada com código não zero apropriado.
- Se permitir renovar token de um parcial para diagnóstico, distinguir `renovado:true` de aprovação do ensaio: manter **`ensaio_aprovado:false`** e estado/motivo coerente. Não proibir diagnóstico por confusão entre os dois resultados, nem permitir falsa aprovação.
- Preservar o critério de conta/cliente/escopo/GETs, renovação real e `apos_vencimento_registrado`. Nenhum retorno falso positivo ao trocar modo/configuração, perder evidência ou mudar amostra.
- Acrescentar regressões para os quatro casos e controles positivos: completo vinculado renova; candidato padrão continua no caminho padrão; manifesto/modo divergentes recusam; saída pública não inclui material privado. Saída 1 em erro de configuração ou 2 em parcial/recusa deve seguir contrato claro; **0 é o resultado indevido observado**.

Não é necessário redesenhar a cópia/restauração ou mexer no banco para isso. Se o formato do candidato/ensaio precisar mudar, limitar o delta ao vínculo necessário e testar compatibilidade, sem afrouxar validações existentes.

## 3. Ajustes do roteiro para o ensaio real futuro

**Seleção de pastas:** README linha 229 e a configuração de execução do relatório usam `permitir_pastas:false`. Os três principais desta P-28 são pastas. Corrigir o exemplo específico para **`permitir_pastas:true`**, de forma que a URL contenha `allow_folder_selection=true`; manter o teste dessa URL. A opção genérica false pode continuar documentada para outros casos, mas não como receita para selecionar esses três principais. [Parâmetro oficial](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker).

**Prazo:** README linha 269 diz “de preferência” após `access_expira_em`. Para concluir C desta P-28, a renovação **após o vencimento registrado é obrigatória**, além da imediata e dos GETs, como definido no procedimento. Corrigir a redação sem transformar o `renovar` imediato válido em falha por horário: sucesso de um comando de renovação não é conclusão da etapa C inteira.

O suporte real do fluxo integrado com o cliente Web permanece não comprovado pelos mocks. Manter a recusa de trocar tipo/cliente, adotar SDK Web/API key ou ampliar escopo automaticamente. Habilitação Picker API e novo consentimento só entram no futuro procedimento revisado/autorizado; não executar por esta devolutiva.

## 4. Execução própria e limites

Fonte exata em cópia temporária somente leitura, sem editar o repositório Flow. Bun **1.4.2 Linux/amd64**, imagem `oven/bun:1.4.2@sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2`, Docker **network none**, raiz/fonte RO, UID **501:20** coerente com o bind local, capacidades removidas e no-new-privileges. Escrita só no tmpfs fictício de testes. Sem `.env`, conexão/candidato/B reais ou socket Docker montados.

- **Suíte entregue:** unidade + bancada, **81 pass / 0 fail**, saída **0**, **633 assertivas**, 13,53 s. Três realocações provocadas; zero ambientais. A diferença de uma assertiva para as 634 macOS relatadas é o caso condicionado a `process.platform === "darwin"` em unidade.test.ts:293.
- **Regressões próprias:** arquivo separado, fora da fonte revisada; **0 pass / 4 fail**, saída **1**, 1,73 s. Cada caso devolveu indevidamente `codigo:0`, `aprovado:true`, `apos_vencimento:true`; dois caminhos com oito chamadas fictícias e manifesto alterado com seis. Falhas demonstram o contrato não atendido, não falha de ambiente.
- **Limpeza:** os dois containers locais exclusivos foram removidos em `finally`; nenhum container com label de revisão PR39 remanescente. Não foram criados volumes ou redes externos. Fonte/relatório de testes preservados no temporário.
- **Artefatos:** `/var/folders/qf/cjj8xr7x1g58t5k07241q8900000gn/T/barba-p28-pr39-i5io1kx4/`, `manifesto.json`, `suite.log`, `suite-resultado.json`, `repro/revisao-picker.test.ts`, `regressoes.log` e `regressoes-resultado.json`. Só dados fictícios.
- **PostgreSQL não repetido:** código de banco/retorno/cópia inalterado; A já atendeu o ensaio. Tipos/lint e quatro rodadas macOS são relatados pelo Claude; a execução própria aqui é a descrita acima, sem atribuir esses checks a si.

Nenhum acesso à VPS/Google Cloud/OAuth/Drive reais, merge, alteração do PR, mensagem a outro agente ou mudança de código Flow nesta revisão. A documentação oficial foi consultada por leitura. Produção/cliente Barba & Cabelo e a custódia C preservados.

## 5. Devolutiva do Claude

Corrigir **o mesmo PR #39**, seguindo AGENTS/vez/branch do Flow. Entregar novo commit/manifesto e relatório com testes dos quatro cenários, controles positivos, tipos/lint pertinentes e exemplos públicos fictícios. Descrever como o vínculo seleção/candidato/manifesto funciona e o que acontece com candidato legado, parcial ou evidência ausente. Não repetir rodadas sem mudança justificadora nem ensaio PostgreSQL intacto.

Até a revisão dos ajustes: **não integrar o PR nem preparar execução real com a versão atual**. Depois da correção revista, segue a decisão de integração e o procedimento próprio para TI/Guardião testar Picker, preservando C anterior. D continua separada.

**Verificação dos registros Barba & Cabelo:** tipos, **301 testes**, formatação dos sete documentos e montagem aprovados; oito links novos locais e diff conferidos. Sem código aplicativo alterado. Esses checks são separados da suíte Flow 81/0 e das quatro falhas adicionais reproduzidas.
