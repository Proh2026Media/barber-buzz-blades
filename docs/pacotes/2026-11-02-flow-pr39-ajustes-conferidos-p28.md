# P-28 — Ajustes do PR #39 conferidos e já integrados

**03/11/2026 — revisão de código atendida e ensaio real recebido.** O dono integrou o PR #39 e a TI executou o Picker em 02/11 com autorização própria. [Resultado conferido](2026-11-03-flow-picker-conferido-p28.md): três pastas e duas renovações aprovadas, amostra antiga 0; D não iniciada. Não repetir merge/correções/A/B/T1/Picker. A revisão de 02/11 abaixo permanece como evidência do código testado.

## 1. Fonte e versão efetivamente conferidas

Relatório **`relatorio-claude-flow-revisao-pr39-picker-p28-2026-11-02.md`** lido inteiro, **335 linhas**, SHA-256 `49171c0c552edbe135f60e64ecc33ada0e9e09681d53da9c7ef7bf1fa2ea60a3`. Sua atualização distingue integração pelo dono de execução pelo Claude; não interpretar o trecho “sem merge” do executor como PR ainda aberto ou como autorização de Google real.

| Item                  | Resultado próprio por leitura GitHub                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR                    | [#39](https://github.com/Proh2026Media/flow-proh-media/pull/39), integrado às **16:31:47 Brasília / 19:31:47 UTC de 02/11**                                    |
| Head corrigido        | `3aa64e93876238395ffdf593fe737b4794d23ff2`                                                                                                                     |
| Merge                 | **`73d5317bb6ef1000198bdca13cb0270af4a059b0`**, main na origem `Proh2026Media` e espelho `PROH-Media`                                                          |
| Árvore completa       | **`07eb6023b1f654b670faaaf13d56b3c9d0a59070`** idêntica no head e merge                                                                                        |
| Ferramentas           | **`8e5be3054294d4762cd16afa53f1f456a75bbcd7`**, 20 arquivos                                                                                                    |
| Delta desde a revisão | Um commit, seis arquivos, **+245/−13**; README/PROGRESSO, bancada, formato do candidato, vínculo Picker e testes                                               |
| Conteúdo              | 23 arquivos obtidos por leitura (20 ferramentas + AGENTS/package/PROGRESSO), todos conferidos pelo SHA-1 de blob; seis SHAs do relatório correspondem ao delta |

Nenhuma mudança no código das funções/app, banco, restauração ou cópia. `ensaio.ts` mudou no formato/validador do candidato para o vínculo; rotina de refresh/GETs continua igual. O Codex não executou merge, publicou comentário/review ou editou Flow.

## 2. Resultado dos quatro casos anteriores

O candidato Picker agora identifica sua origem e aponta evidência privada com hash de arquivo/manifesto, operação e cliente. A renovação recalcula a seleção e exige vínculo completo para aprovar. Perda/divergência pode permitir diagnóstico do refresh, mantendo aprovação falsa e código 2; candidato padrão com configuração Picker é recusado antes da rede.

| Caso independente retomado                       | Antes             | Agora                                                            |
| ------------------------------------------------ | ----------------- | ---------------------------------------------------------------- |
| Seleção só dos principais, sem a amostra         | 0 / aprovado true | **2 / false**, `renovado:true` sem mascarar a seleção incompleta |
| Evidência de seleção removida                    | 0 / true          | **2 / false**, evidência ausente                                 |
| Manifesto alterado após seleção                  | 0 / true          | **2 / false**, manifesto divergente                              |
| Candidato padrão reclassificado via configuração | 0 / true          | **1**, zero chamadas e sem saída de aprovação                    |

Controles positivos próprios: candidato completo permanece Picker mesmo retirando `picker` da configuração, com `vinculo_selecao:ok` e exit 0; candidato padrão/legado continua no caminho padrão e renova com exit 0. Não foi acessado o candidato C real para esses testes.

Os mesmos cenários adicionais foram preservados. Ajustes do apoio: leitura de stdout vazio na recusa de configuração e expectativa **1** nesse quarto caso, conforme o contrato já aceito na revisão anterior; os outros três continuam exigindo **2/false**. Não foi alterada a condição para aceitar um sucesso indevido. Dois controles positivos foram acrescentados.

README agora usa **`permitir_pastas:true` / `filtrar_por_ids:true`** nesta P-28 e exige renovação imediata **e após `access_expira_em`** para concluir C. Operações recebem sufixo aleatório, evitando a igualdade determinística observada em operações no mesmo segundo. Custódia root capaz de reescrever coerentemente candidato/evidência permanece fora da garantia desse vínculo, como registrado pelo Claude.

## 3. Verificação própria, somente fictícia

- **Suíte entregue:** **86 pass / 0 fail**, saída **0**, **692 assertivas**, 14,91 s, Bun 1.4.2 Linux/amd64 fixado. A assertiva a menos que as 693 macOS relatadas é a condição `darwin` já conhecida.
- **Regressões próprias + controles:** **6 pass / 0 fail**, saída **0**, 16 assertivas, 2,17 s; os quatro cenários anteriormente falhos e os dois controles descritos acima.
- **Isolamento:** Docker `network none`, fonte/raiz RO, UID 501:20 coerente com o bind local, capacidades removidas/no-new-privileges, escrita só em tmpfs fictício; nenhum `.env`, token, candidato C/B ou DB real montado. Três realocações de porta provocadas, zero ambientais.
- **Limpeza:** dois containers locais exclusivos removidos em `finally`, zero remanescentes pelo label PR39-v2, sem volumes/redes novos. Artefatos fictícios em `/var/folders/qf/cjj8xr7x1g58t5k07241q8900000gn/T/barba-p28-pr39-v2-lze0jrr_/`: fonte/manifesto, logs/resultados da suíte e seis verificações separadas.
- **Sem repetição desnecessária:** ensaio PostgreSQL/A/B/T1 não repetido; rotinas de banco/retorno intactas. Tipos/lint e as rodadas macOS continuam atribuídos ao Claude. A rodada intermediária 51/1 e sua correção de nome da operação são relatadas por ele, não ocultadas nem executadas pelo Codex.

A primeira gravação local da fonte parou por codificação do script de transporte antes de criar a cópia; o transporte foi refeito como JSON ASCII escapado e os 23 blobs conferidos. Isso foi falha do apoio de revisão, não teste do produto. Nenhuma rodada da suíte foi descartada para obter verde.

## 4. Próximo passo delimitado

O [arquivo para TI/Guardião](2026-11-02-ti-flow-ensaio-picker-p28.md) prepara **uma operação nova**, fonte #39 fixada, novos caminhos/candidato e seleção explícita dos três principais/amostra antiga, sem sobrescrever C anterior. Inclui habilitar Picker API **só se necessário no projeto dedicado**, sem novo cliente/API key, e um consentimento real com drive.file. A URI local já cadastrada é apenas reconferida/preservada.

Novo ensaio requer decisão própria: a autorização C anterior foi usada no consentimento que terminou parcial e não é tomada como permissão automática para outra concessão. Suporte real do fluxo integrado com cliente Web e acesso aos itens antigos seguem não comprovados pelos mocks. Recusa do provedor, seleção incompleta ou 404 não autorizam ampliar escopo/recriar raiz/trocar cliente. D permanece separada.

Nenhum acesso à VPS, Google Cloud/OAuth/Drive real, mudança de credencial ou configuração nesta revisão. Cliente Barba & Cabelo e custódia C anterior preservados. O objetivo continua a dependência Google da P-28 do Barba & Cabelo.

**Verificação dos registros e roteiro:** tipos, **301 testes Barba & Cabelo**, formatação dos oito documentos e montagem aprovados; 19 links novos locais, 13 blocos Bash, cinco trechos JS, JSONs e verificador Python/20 blobs conferidos. São checks documentais, separados da suíte Flow 86/0 e controles 6/0; nenhum ensaio real Picker executado.
