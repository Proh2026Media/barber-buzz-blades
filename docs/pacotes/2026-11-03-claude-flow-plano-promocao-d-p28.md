# P-28 — Para Claude/Flow: composição da promoção e plano D com fictícios

**03/11/2026 · Preparação de código/procedimento; produção não executável nesta entrega.** Encaminhar ao Claude que desenvolve o Flow. O objetivo continua sendo separar o Drive do Flow do projeto Google compartilhado, dependência da P-28 do Barba & Cabelo. Não abrir melhorias gerais do Flow.

## 1. Ponto já atendido e lacuna concreta

PR #39 integrado pelo dono em `73d5317bb6ef1000198bdca13cb0270af4a059b0`; ferramentas `8e5be3054294d4762cd16afa53f1f456a75bbcd7`. [Resultado real do Picker](2026-11-03-flow-picker-conferido-p28.md): três pastas selecionadas/acessíveis, renovação imediata e após vencimento, vínculo válido, recursos temporários retirados. Amostra antiga 0, cobertura recursiva ainda não demonstrada; [TI faz levantamento de metadados em separado](2026-11-03-ti-flow-cobertura-preparacao-d-p28.md).

As ferramentas atuais capturam, validam, planejam retorno e restauram **somente alvo fictício**. Falta compor, validar e ensaiar o **novo par de promoção** a partir de uma imagem atual e candidato aprovado. `parRestaurado`/`planejar` tratam retorno, não fazem por si essa conversão. Não assumir que o JSON de candidato possa substituir `dados` integralmente.

Leia as regras/AGENTS atuais do Flow e trabalhe em ramo `ia/*`, com sua própria vez; devolver PR em rascunho para revisão. Não integrar main, implantar, acessar VPS/Google/cofre/B/candidato real ou solicitar segredos. Todos os dados desta entrega são fictícios; preservar comandos e guardas existentes.

## 2. Implementação mínima a propor e testar

Adicionar uma composição pura e um plano seguro, reutilizando validadores já existentes quando adequados. Nomes/assinaturas são decisão de implementação; documentar os comandos reais que forem criados, sem inventar uma opção de escrita em produção.

Entradas conceituais: imagem atual completa das duas integrações; credencial nova; candidato novo; evidência de aprovação/seleção e manifesto correspondentes; instante da operação. **Nesta entrega, somente instâncias fictícias dessas entradas.** O futuro uso real exige custódia/procedimento revisados; não buscar os arquivos reais para desenvolver.

| Parte                | Contrato                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Origem               | Ambas as linhas presentes, fonte efetiva em banco, formato correto e nenhuma incompatibilidade de stack; origem desconhecida/ambiente aborta                                                                                                                                                                                                     |
| Candidato            | Cliente novo/conta esperada/escopo drive.file e modo Picker coerentes; origem persistida, operação e vínculo candidato/manifesto/evidência validados; exigir evidências coerentes das duas renovações (uma após vencimento) para o mesmo candidato, sem renová-lo nesta entrega; não aceitar mera flag `ensaio_aprovado` fornecida pelo chamador |
| Conjunto             | Três principais coincidem com a imagem atual. Preservar a diferença entre aprovação do conjunto testado e cobertura do acervo: amostra 0 não libera D nem vira prova recursiva                                                                                                                                                                   |
| `google_oauth.dados` | Partir do objeto atual; substituir apenas `client_id`/`client_secret` do cliente novo. Preservar `token_secret`, `cron_secret` e campos desconhecidos, inclusive ausência/null                                                                                                                                                                   |
| `google_drive.dados` | Partir do objeto atual; substituir `refresh_token` e registrar o `client_id` emissor correto. Preservar todos os IDs, campos desconhecidos e estado de varredura. Explicitar a política de `email`/`connected_at` de acordo com a conta conferida e o formato de produção, sem inventar dados ausentes no candidato                              |
| Dados externos       | Nenhuma escrita nos mapas de referências, entidades, anexos ou compartilhamentos; nenhuma criação/revogação Google                                                                                                                                                                                                                               |
| Plano público        | Somente ações, nomes de campos, contagens e recusas; nunca valores, tokens, e-mail, IDs privados, objetos completos ou hashes de artefatos secretos                                                                                                                                                                                              |

`token_secret` no handler atual é chave de assinatura HMAC, **não** uma instrução para criptografar/rotacionar o refresh token. Preservar a semântica e o armazenamento já existentes; esta entrega não redesenha segredos. Não transportar campos auxiliares do candidato (seleção/expiração/versão) para `dados` sem contrato do handler.

Separar composição pura da futura aplicação. Um resultado composto não é autorização operacional de virada: barreira, captura fresca, cobertura e aceitação continuam requisitos externos. Se gerar artefatos de ensaio, usar exclusivamente dados fictícios, caminhos privados exclusivos e recusas existentes de symlink/sobrescrita. Não adicionar comando que aceite banco real, flags de bypass/force, alteração das guardas do instalador/migração ou desbloqueio de `restaurar-ficticio`.

## 3. Provas necessárias, sem repetir toda A/B/T1

Usar Bun e PostgreSQL 15 fictício compatível para o que envolver transação. Reaproveitar o ensaio isolado já existente, sem ligar a stack de teste real/parada.

- Composição positiva conserva IDs, `token_secret`, `cron_secret`, metadados e campos desconhecidos/presença/null; não muta as entradas. Emissor novo e token novo formam o mesmo par.
- Recusas por cliente/conta/escopo/modo incompatíveis, seleção incompleta, manifesto/evidência alterados, principais divergentes, fonte ambiente, linha ausente e tentativa de reclassificar candidato padrão. Não aceitar resultado sem prova de vínculo.
- Plano/erros não vazam valores ou hashes secretos. Cobertura zero permanece explicitamente limitada; não converter sucesso de três pastas em aprovação global.
- No banco **fictício**, aplicar o par composto e retornar à imagem anterior atomicamente; provocar falha entre as duas linhas e provar ROLLBACK integral. Mudança concorrente de credencial/ID/campo desconhecido deve recusar. Varredura segue a política já estabelecida, com estado atual preservado; referências e demais dados não são reescritos.
- Regressões dos comandos atuais, inclusive modo padrão legado e restauração fictícia bloqueando produção. Executar os checks exigidos pelo repositório; identificar o que foi novo, reaproveitado e não executado, sem atribuir os testes reais da TI ao Claude.

Lock/transação fictícia prova atomicidade do par, mas não elimina handler de produção em andamento que já leu estado antigo. Essa barreira pertence ao procedimento D, não pode ser presumida pela aprovação dos testes SQL.

## 4. Procedimento proposto e devolutiva

Além do PR/commit/manifesto e resultados, devolver uma sequência futura **sem executar**: barreira de escritores/cron/callbacks e requisições em andamento → captura privada imediatamente anterior → validação/composição → aplicação atômica por mecanismo a revisar → tratamento de caches → aceitação sem criar pastas, antes de liberar gravações → retorno em caso de falha.

Considerar prioridade de ambiente, cache de configuração **60 s**, conexão **30 s**, token por `(client_id, refresh_token)` e `share-expire` salvando a conexão inteira. `configure`, callback e abertura da aba Drive/`status` não são aceitação sem efeitos. Não propor um simples intervalo entre dois upserts, nem usar B histórica como imagem imediatamente anterior. Retorno depois de novas gravações pode exigir acesso por arquivo entre clientes; não prometer reversão total só com as duas linhas.

Informar quais peças da **aplicação real** continuam ausentes. Não apresentar um plano puro/ensaio fictício como ferramenta de produção pronta. Codex revisará o PR e conciliará com a cobertura/proposta operacional da TI antes de montar D para decisão específica de Alyson. Nenhuma troca viva, novo consentimento, revogação, marca/domínio ou reenvio ao Google está autorizada por este pacote.
