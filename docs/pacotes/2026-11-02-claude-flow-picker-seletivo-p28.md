# P-28 — Para Claude/Flow: preparar seleção explícita de itens antigos com Picker

**Entrega atendida, ajustes revistos e já integrados — PR #39:** [head `3aa64e9` / merge `73d5317` conferidos](2026-11-02-flow-pr39-ajustes-conferidos-p28.md), suíte própria 86/0 e seis verificações 6/0. Não pedir implementação/correções/merge de novo. Próximo: [TI/Guardião decidir novo ensaio real Picker](2026-11-02-ti-flow-ensaio-picker-p28.md). O pedido abaixo é histórico atendido; não autoriza executar Google por si só.

**02/11/2026 · Código/testes fictícios em PR em rascunho; sem Google real ou implantação.** [C parcial e recursos encerrados](2026-11-02-flow-etapa-c-parcial-p28.md). Próxima preparação recomendada para a dependência Google da **P-28 do Barba & Cabelo**. Claude desenvolve a ferramenta no Flow; Codex revisa; TI/Guardião só executam futura etapa real após revisão/decisão. Não é novo inventário ou repetição dos PRs #36–#38.

## 1. Problema concreto e base preservada

C confirmou conta/cliente novo/drive.file, gravou candidato, mas parou na raiz com **404**, `iniciar.exit=2` e `leituras.interrompido:true`. Clientes/Lixeira não lidos; listas de arquivos antigos vazias por falta de fonte em B. Não há renovação comprovada nem liberação de D. O candidato parcial e B estão privados na VPS; não os pedir, baixar, abrir ou usar para desenvolver.

Trabalhar no **`Proh2026Media/flow-proh-media`**, lendo seu AGENTS e seguindo vez, Bun, branch `ia/*`, PR em rascunho e PROGRESSO. Base revisada #38: merge `9837ebc873554d3e7685f792c18d01349418ed2e`, ferramentas `fb576d0970c46fe9dcb918fa10be59d62f2111a3`, 19 arquivos, 93 testes/605 assertivas em A. Reconciliar com a main atual antes de editar, sem desfazer outras entregas. Sem merge/push direto na main, deploy ou alteração de guardas.

O 404 é compatível com falta de autorização por item para o app novo, não prova de raiz apagada. Antes da futura tentativa real, TI/Guardião deverá conferir privadamente a correspondência dos três IDs selecionados com a fonte original, devolvendo apenas booleanos; não solicitar esse material real para os testes locais. [Erros Drive](https://developers.google.com/workspace/drive/api/guides/handle-errors), [drive.file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

## 2. Desenho preferencial para a prova isolada

Estudar/adicionar modo **opt-in** de seleção integrada ao OAuth existente, fora da API/painel de produção. O guia oficial atual documenta `prompt=consent`, **`trigger_onepick=true`**, `allow_multiple=true`, `allow_folder_selection=true`, filtro opcional `file_ids` e retorno **`picked_file_ids`** junto de code/scope. Também referencia configuração Web; verificar explicitamente a adequação ao cliente **Web existente**, sem transformá-lo em Desktop ou criar cliente automaticamente. [Integração oficial](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker).

Esse é o desenho recomendado para evitar uma página JavaScript do app recebendo access token. Não assumir que todos os modos Picker são equivalentes: o SDK Web usa `setOAuthToken`, com outra superfície/custódia. Não implementar esse fallback silenciosamente. Se houver incompatibilidade comprovada do fluxo integrado com o cliente atual, registrar o delta mínimo para revisão, sem habilitar APIs, cadastrar origens, criar API key ou construir uma interface paralela por conta própria. [Comparação oficial dos modos](https://developers.google.com/workspace/drive/picker/guides/overview).

O caminho real pode exigir habilitar Google Picker API no projeto dedicado; isso é pré-requisito a confirmar/autorizar pela TI depois. Nenhuma ação Cloud ou novo consentimento está autorizada por este pacote. Testes simulam o provedor e sua resposta, não presumem que mocks comprovam suporte do Google real.

## 3. Contrato da implementação

1. **Opt-in e isolamento.** Preservar os comandos atuais `conferir`, `iniciar`, `renovar` e seus comportamentos. Documentar comando/configuração real do novo modo, sem ligar Picker por padrão. Recusar fonte/credencial antigas, projeto errado, escopo extra, bind fora de loopback, arquivo inseguro ou destino já existente. Não usar API/DB/handlers de produção.
2. **Candidato separado.** Nova operação/diretório privado, sem sobrescrever, mover ou apagar candidato C parcial. Nenhum segredo/refresh token em URL, navegador, argv, HTML, logs públicos ou PR. Troca do código/refresh no servidor; link de início/state/code/IDs privados não aparecem no relatório público. Manter proteções de arquivos/symlinks/UID.
3. **Sessão antes de dados.** State imprevisível/uso único, cookie e prazo vinculados à operação; validar antes de processar seleção/trocar código/gravar. Tratar cancelamento, erro, repetição, query duplicada, parâmetros malformados e retorno de outra sessão. Não abrir redirect arbitrário ou endpoint de token.
4. **Seleção estrita.** Analisar `picked_file_ids` com formato de ID, limites de quantidade/comprimento e sem duplicados inflando cobertura. Validar seleção contra a lista privada esperada. Os três principais originais devem ser conservados/comprovados; seleção não pode substituí-los por uma raiz criada ou outro ID conveniente. Se faltar item obrigatório, registrar seleção incompleta e impedir aprovação. Callback sem seleção válida não equivale a acesso demonstrado.
5. **Cobertura antiga explícita.** Permitir incluir amostra pequena de arquivos antigos indicada pelo operador, separada dos três principais; nos testes tudo fictício. Definir contrato privado e ação explícita para novos IDs de amostra; não acrescentar itens retornados arbitrariamente ao manifesto existente. Não assumir que selecionar uma pasta concede acesso recursivo a todos os arquivos/subpastas. Cobertura limitada não prova migração do acervo inteiro.
6. **Dados de seleção não substituem a prova.** Após token/conta/cliente/escopo corretos, fazer **GET** dos mesmos IDs principais e amostra, usando a porteira revisada. Metadados/IDs no retorno do Picker não comprovam leitura do Drive. Recusar 403/404/lixeira/rede; nenhuma busca/criação de raiz, upload, cópia, movimento, edição, compartilhamento, permissão ou revogação para contornar a falha.
7. **Renovação e parcial.** Preservar os critérios conservadores: exit 0 só com leituras concluídas e escopo exato; 1 para falha de configuração/execução; 2 para recusa/parcial conforme contrato documentado. Se candidato já gravado e algo falhar, declarar parcial/candidato guardado, sem sucesso genérico. `renovar` deve comprovar o novo par e repetir GETs, inclusive após `access_expira_em`. Não pedir consentimento para cada renovação nem usar access token em cache como prova.
8. **Relatórios e limites.** Persistir seleção/evidências privadamente 0600; público só etapa/horário/estados/contagens/booleanos. Mensagens pt-BR. Registrar a diferença entre seleção válida, acesso confirmado, renovação aprovada e cobertura total; não marcar D liberada automaticamente.

Manter `scope=drive.file`, offline, conta esperada, cliente novo e sem `include_granted_scopes` ampliando concessão. Não adicionar Calendar/Contacts/drive.readonly/drive nem usar o token antigo como substituto na prova. Não alterar a experiência do app Barba & Cabelo ou a integração viva Flow.

## 4. Testes mínimos úteis, somente fictícios

| Caso                                                                    | Resultado necessário                                                                                |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Modo atual sem opt-in                                                   | Continua sem parâmetros Picker; comportamento #38 preservado                                        |
| Modo Picker                                                             | URL aponta ao Google fixo, parâmetros/escopo/cliente/URI corretos; nenhum segredo ou refresh na URL |
| State/cookie/prazo inválidos, replay ou query duplicada                 | Recusa antes de efeitos; zero troca/gravação e sem vazamento                                        |
| Cancelamento/ausência/seleção incompleta, ID inválido/duplicado/excesso | Não aprova; não substitui principais; não inicia consentimento em loop                              |
| Seleção aparentemente correta, GET da raiz 404                          | Reproduz o problema atual como parcial quando candidato já guardado; exit não zero                  |
| Pasta selecionada, filho antigo não selecionado/inacessível             | Não assume herança de acesso nem declara cobertura completa                                         |
| Três principais + amostra acessíveis                                    | Evidências privadas coerentes e relatório público sem IDs/conta/código/tokens                       |
| Renovação de cliente errado, escopo errado, 403/404 ou cache anterior   | Não aprova; renovação depois do vencimento distingue horário e repete GETs                          |
| Candidato C pré-existente/symlink/falha após gravar                     | Sem sobrescrita; preserva parcial; nada é revogado/apagado                                          |
| Chamada de escrita/listagem/API real no teste                           | Trava falha o teste; zero contato com Google/VPS/DB reais                                           |

Executar testes atingidos e a suíte pertinente, sem repetir A/B/T1 ou testes de produção. Nenhuma necessidade de ligar stack compartilhada, migrar banco ou rodar novamente o ensaio PostgreSQL se código de banco/retorno permanecer intacto; justificar a seleção dos checks. Não adicionar dependência/SDK só para gerar uma URL se o fluxo integrado atender.

## 5. Devolutiva única

Entregar Markdown com branch/PR em rascunho/commit, manifesto dos arquivos, comandos reais, resultados de testes e regressões, fonte oficial do suporte ao fluxo/cliente e limitações não comprovadas por mocks. Mostrar um relatório **fictício** sanitizado de seleção/parcial/sucesso. Explicar como testar no futuro, dados privados mínimos e delta Cloud/URI/custódia necessário, sem executá-lo.

Nada de conta, ID de arquivo, credencial ou candidato reais no PR/relatório. Não habilitar Picker API, cadastrar API key/origem, criar cliente, consentir, renovar o candidato real, promover em produção ou executar D. Após o retorno, Codex revisa o código e prepara a decisão específica do ensaio real Picker. C continua parcial até prova de acesso/renovação e cobertura adequada.
