# P-28 — Para Claude/Flow: ferramentas de cópia/retorno e bancada de compatibilidade

**01/11/2026 · Implementação e testes isolados no repositório Flow, por PR.** Encaminhar ao Claude que desenvolve o Flow. Este arquivo especifica a próxima entrega; não autoriza executar Google, trocar a conexão viva, restaurar produção, iniciar stack parada ou publicar código.

## 1. O que já está resolvido

Proteção #36 integrada e **instalada/validada em produção**, diagnóstico 200 e três pastas principais acessíveis. [Resultado e retorno TI conciliado](2026-11-01-flow-instalacao-pr36-p28.md). Não repetir PR #35/#36, merge, instalação, diagnóstico de 15:32:55, criação do projeto, páginas/gatilho ou inventários. Não portar ferramentas Flow para o código da Barbearia.

Trabalhar no **`Proh2026Media/flow-proh-media`**, seguindo seu `AGENTS.md`, vez, branch `ia/*`, PR em rascunho, Bun, notas e `PROGRESSO.md`. Claude é o editor do Flow; TI faz conferência operacional conforme [seu pacote](2026-11-01-ti-flow-copia-restauracao-ensaio-p28.md), sem edição paralela. Sem push direto/merge na main, instalação ou mudança das guardas.

## 2. Evidências que orientam a implementação

| Fonte lida pelo Codex                                                    | Ponto relevante                                                                                                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `google-drive/index.ts`, blob `e0db47fccb1e7e52852f385cc227b8df21d574d1` | `loadConfig` 121–135, conexão/cache 248–312, `configure` 711–733, URL/callback 780–844, cron 1544–1553                             |
| `protecao.ts`, blob `711879fb7b390fbabfdd67c203139e975ea80f3f`           | Candidata valida os três IDs antes da gravação; callback pode retornar parcial depois de gravar; cache é por cliente/refresh token |
| `Admin.tsx`, blob `eb3b185beb0bc76a22b9a27f2eb1c65a1e7b193e`             | Inicializa a aba pela URL `?tab=drive` e monta `DriveTabContent`                                                                   |
| `DriveTabContent.tsx`, blob `f1a31301c123169774c193cedac52a34bb40bd8c`   | Linhas 75–89 chamam `status` ao montar e ao retornar; salvar credenciais também refaz a consulta                                   |
| Banco, metadados lidos em transação somente leitura                      | Duas integrações JSONB, mapas de IDs em seis tabelas, gatilhos nas entidades; contrato no pacote TI                                |

**Consequência:** o fluxo atual volta para `/admin?tab=drive`, que chama `status` automaticamente. Não é um ensaio somente de leitura. `configure` troca o cliente antes da autorização candidata e seu `upsert` atual não verifica `error`; não usar a resposta 200 dele como prova de gravação. Registrar essas limitações, sem ampliar este PR para redesenhar o painel.

## 3. Entrega A — cópia e restauração verificáveis

Implementar ferramentas administrativas **fora das funções servíveis** e da interface, com o contrato completo das seções 3–5 do [pacote TI](2026-11-01-ti-flow-copia-restauracao-ensaio-p28.md). Nomes dos comandos são escolha de implementação; documentar os comandos que realmente existirem no PR.

- Captura seletiva JSON versionado, transação consistente de leitura, duas linhas completas e mapas das seis tabelas. Nada de `pg_dump --where`, dumping de todo o banco ou tabelas auxiliares em `public`.
- Aceitar/preservar a ausência legada de `google_drive.dados.client_id` na cópia anterior, sem adicionar emissor fictício; exigir o emissor verificado para o candidato novo.
- Validar a fonte efetiva antes da operação: configuração completa em ambiente prevalece sobre banco; registrar origens sem valores e recusar restauração que não cubra essa fonte. Nenhuma alteração de ambiente para contornar a guarda; incluir o caso nos testes.
- Leitor/validador de artefato privado: versão, origem, presença/ausência, tipos, integridade, duplicidades e campos desconhecidos. Criar arquivo sem sobrescrever/seguir symlink e somente promover após sucesso.
- Planejamento de retorno sem gravar por padrão; execução de retorno nesta entrega permitida **somente em banco isolado com dados fictícios**, com recusa explícita dos alvos Flow produção/Barbearia. Não criar opção que burle a guarda para produção. Comandos de produção serão objeto do procedimento próprio posterior.
- Uma transação restaura o par, com comparação do estado atual esperado sob bloqueio e prazos. Tratar ausência de chave sem permitir inserção concorrente. Preservar metadados de varredura mais recentes conforme política do TI; abortar qualquer outra divergência.
- Referências de entidades/anexos/compartilhamentos entram na comparação e no relatório privado; não são restauradas automaticamente. Nenhum dado de negócio é regravado para recuperar credenciais.
- Entrada segura de JSON/dados, sem segredo em argumento, logs ou SQL interpolado. Erros podem mostrar etapa/código sanitizado; não devem incluir tokens, payloads ou linhas de banco.

O material com dados fictícios pode ser versionado; cópia real, credencial e token nunca entram no PR. Um teste de modelo em memória não basta para provar COMMIT/ROLLBACK e locks: incluir ensaio em **PostgreSQL 15** isolado, compatível com o **15.8** observado na fonte, com esquema mínimo fictício, sem copiar banco real ou iniciar a stack compartilhada parada.

## 4. Entrega B — candidato OAuth separado da conexão viva

Preparar servidor/ferramenta de bancada acessível apenas em loopback, sem reutilizar handlers de produção. Proposta operacional: **`http://127.0.0.1:8765/oauth/callback`**, servidor na VPS acessado por túnel SSH do computador do dono. A TI revisará porta/URI; nenhum cadastro Google ou início da bancada está autorizado agora.

Fluxo a implementar e testar com provedores simulados:

1. Carregar nova credencial de arquivo privado fornecido pelo Guardião, sem imprimir conteúdo. Recusar o cliente antigo, escopo adicional, URI/host/porta divergentes e bind público. Não precisar do segredo ou refresh token de produção.
2. Gerar `state` imprevisível, de uso único, com prazo e vinculado à sessão/operação do navegador; validar antes de trocar código. Proteger contra requisições locais indevidas, repetição e retorno aberto. Sem códigos/tokens/IDs privados em logs ou HTML; não carregar recursos externos na página de retorno.
3. Solicitar somente `drive.file`, acesso offline e consentimento da conta indicada pelo dono. Tratar cancelamento, escopo insuficiente, ausência de refresh token e erro do provedor sem gravação na integração viva e sem revogação automática.
4. Guardar candidato somente na bancada privada, com permissões e ciclo de vida documentados; comparar conta autorizada e cliente por booleanos/identificadores de operação no relatório. Não expor token no JavaScript do navegador ou em endpoint de leitura genérico.
5. Com o **token candidato**, fazer apenas GET dos três IDs principais e das referências indicadas em **manifesto privado de IDs separado**, mais arquivos antigos relevantes escolhidos pelo operador. A bancada não recebe o snapshot completo com a credencial/token antigos; validar a lista de campos de entrada e recusar esse payload. Devolver estados/contagens. Nenhuma busca/criação automática de raiz, upload, edição, exclusão, permissão, `status`, `sync`, `share-expire`, `configure` ou callback de produção.
6. Forçar caminho de renovação da bancada descartando seu access token em memória; usar o refresh token do candidato e a nova credencial. Testar também após o vencimento registrado pelo provedor, sem novo consentimento, e repetir as leituras. Registrar somente horário, identificador do novo cliente comparado, sucesso de renovação e estados. Métrica genérica no Console é evidência complementar; esperar duas horas/oito dias não prova renovação.
7. Falha de acesso por 403/404/lixeira/erro de rede interrompe o ensaio sem modificar dados vivos ou inventar outra raiz. Encerrar servidor/túnel e preservar a evidência privada conforme a retenção proposta; não revogar ou apagar credenciais como limpeza automática.

O escopo `drive.file` é por arquivo; a seleção pelo Google Picker é uma forma documentada de conceder acesso. **Não presumir** que trocar de projeto conserve acesso a todo o conteúdo, nem que selecionar uma pasta autorize todos os descendentes. Se o candidato não acessar IDs existentes, devolver o caso e uma proposta específica de seleção/compatibilidade antes de implementar Picker ou ampliar escopo. [Escopo oficial](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Picker](https://developers.google.com/workspace/drive/picker/guides/web-picker).

Retorno local deve coincidir exatamente com o cadastrado no cliente **novo**, após decisão do dono. O consentimento real criará uma autorização desse novo aplicativo; não é uma simulação e não será iniciado nesta entrega. Revogação pode afetar os clientes do mesmo projeto para a conta, por isso não integra o tratamento automático de erro. [OAuth oficial](https://developers.google.com/identity/protocols/oauth2/web-server).

## 5. Promoção futura e pontos de interrupção

Esta entrega termina antes da virada. A estratégia preferida para desenhar depois é validar o candidato fora da produção e preparar **a promoção atômica do par** configuração/conexão, preservando `token_secret`, `cron_secret`, IDs e campos desconhecidos da imagem viva mais recente. Não passar pelo intervalo `configure` novo + conexão antiga nem pela volta automática à aba Drive. Nenhum token candidato será aplicado à produção neste PR.

O procedimento de virada ainda deve fechar: barreira real de escritores (inclusive cron/requisições em andamento), imagem fresca, comparação anterior ao COMMIT, cache coerente, diagnóstico controlado antes de reabrir gravações e retorno coerente. Identificar o impacto/recarga limitada se essa for a solução; não prometer retorno de arquivos criados pelo cliente novo com acesso do cliente antigo. Não acrescentar agora uma manutenção global do app ou alterar proxy/cron para “facilitar” o ensaio.

Se a implementação demonstrar necessidade de outra fonte de configuração, nova tabela/rota/permissão, acesso mais amplo ou instalação adicional, registrar o delta concreto e deixar essa parte para revisão. Não editar as guardas ou assumir que #36 autoriza produção.

## 6. Matriz mínima de testes

| Grupo                          | Casos e evidência                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artefato                       | Truncado, versão/origem errada, duplicado, ausência esperada/inesperada, JSON nulo, chave ausente, campos desconhecidos e strings com aspas/barra/Unicode                                         |
| Arquivo privado                | Permissão, arquivo já existente/symlink, falha na escrita/captura e nenhuma promoção de arquivo incompleto; stdout/stderr sem material secreto                                                    |
| Retorno real em banco fictício | Par completo, falha entre gravações revertendo ambas, prazo/lock, edição concorrente, ausência/inserção concorrente, campo desconhecido divergente e manutenção de dados de negócio               |
| Varredura                      | Campo atual posterior preservado, presença/ausência/nulo diferenciados, divergência fora da lista abortada e processo antigo ainda em voo modelado; lock consultivo sozinho não aceito como prova |
| OAuth da bancada               | Cancelamento, `state` inválido/vencido/repetido ou de outra sessão, conta/cliente/escopo errados, resposta sem refresh token e falha de renovação                                                 |
| Acesso candidato               | Três IDs + arquivo interno; 403/404/lixeira/erro transitório; zero criação/gravação/revogação e zero uso do token antigo                                                                          |
| Cache                          | Access token anterior não pode mascarar renovação; novo cliente/refresh token e retorno usam o par correspondente                                                                                 |
| Isolamento                     | Testes falham se tentar contato com Google/API/VPS reais; ferramentas recusam alvo de restauração produção/Barbearia; painel e handlers vivos não são alterados                                   |

## 7. Relatório de volta para Codex

Entregar um Markdown com PR/branch/commit e manifesto dos arquivos, comandos reais, resultados dos testes unitários **e do PostgreSQL fictício**, estado de lint/tipos e limitações. Descrever formato do snapshot, entrada segura, atomicidade/concorrência e política de varredura; como iniciar/parar a bancada e quais dados privados ela exigirá quando autorizada.

Separar resultados próprios de propostas. Incluir uma amostra sanitizada de relatório de ensaio, sem credenciais, e testes de que essa saída não vaza dados. Registrar que não houve Google real, cópia secreta, restauração/alteração de produção, merge/deploy, mudanças de URI, DNS, IAM, Branding, cron ou outras stacks. Enviar o relatório a Alyson para ele trazer ao Codex; não iniciar o próximo estágio por conta própria.
