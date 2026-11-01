# P-28 — Para TI: preparar a cópia protegida e o retorno da integração Flow

**Atualização após correções:** PR #37 no head `67e7fb7`; Codex confirmou **86 testes e quatro casos independentes aprovados**, ajustes atendidos. [Conclusão](2026-11-01-flow-pr37-ajustes-conferidos-p28.md). Retorno TI de 17:29–17:31 incorporado; “aguardando PR” foi atendido. Seguir o [complemento operacional para TI](2026-11-01-ti-flow-pr37-preparacao-operacional-p28.md), com runtime/rede conferidos e dados restantes, sem repetir instalação/diagnóstico/inventário ou executar com material real.

**01/11/2026 · Preparação operacional, sem execução de cópia secreta, restauração ou migração.** Encaminhar este arquivo ao agente de TI. O [arquivo do Claude/Flow](2026-11-01-claude-flow-bancada-migracao-p28.md) define as ferramentas e os testes que ele implementará em PR. A TI confere a operação e devolve o procedimento; não edita o mesmo projeto em paralelo.

## 1. Ponto de partida atendido

Proteção #36 instalada e validada, diagnóstico administrativo 200 às **15:32:55 Brasília**, Raiz/Clientes/Lixeira acessíveis. [Relatório e conciliação do retorno TI](2026-11-01-flow-instalacao-pr36-p28.md). Não repetir instalação, diagnóstico anterior, merge, projeto, páginas ou gatilho. Cópia do código em `/root/backup-flow-google-drive-pr36-20261101T174338Z` não é backup das integrações.

| Item                                            | Alvo conhecido                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Banco fonte, somente leitura nesta preparação   | `supabase-db-vv3jo93anprhqezhtu4ewcpl`, banco `postgres`                        |
| Funções Flow                                    | `supabase-edge-functions-vv3jo93anprhqezhtu4ewcpl`                              |
| API / frontend                                  | `https://supabase.proh.media` / `https://flow.proh.media`                       |
| Projeto Google novo, já criado segundo Guardião | `flow-proh-media-drive`, número `930474870480`, cliente “Flow Drive (produção)” |
| Produção atual                                  | Credenciais/conexão em `public.integracoes`; preservar até uma virada própria   |

A regra do Flow continua restringindo scripts de instalação/migração à stack de teste. Não alterar guardas ou adicionar um desvio para produção. A autorização anterior foi para instalar #36; não se estende à restauração de dados, troca de cliente, novo consentimento, URI Google ou início da stack parada.

## 2. Conferência direcionada já feita pelo Codex

Consulta de metadados e contagens em **transação `REPEATABLE READ READ ONLY`, encerrada com `ROLLBACK`**, sem retornar conteúdo de `dados`, IDs privados ou credenciais:

- PostgreSQL **15.8** confirmado por leitura de versão; ensaiar a transação real em PostgreSQL 15 compatível, com dados fictícios.
- `public.integracoes`: `id text` como chave primária, `dados jsonb NOT NULL`, `updated_at timestamptz NOT NULL`; RLS ativa e zero políticas. Uma linha `google_oauth` com quatro chaves e uma `google_drive` com oito chaves. Sem gatilhos próprios nessa tabela.
- As quatro entidades têm `id uuid`, `drive_folder_id text`, `drive_doc_id text`, `updated_at timestamptz`. Há gatilhos de atividade e atualização de data: não restaurar essas tabelas por cima das alterações de negócio.
- `media_files` também contém referências `drive_file_id` e `drive_folder_id`; `compartilhamentos` contém `alvo_drive_id`, `drive_permission_id` e `drive_doc_id`.
- Zero linhas com essas referências preenchidas nas **seis tabelas** na consulta. Isso não comprova Drive vazio; três pastas principais existem e o operador ainda deve indicar arquivos antigos relevantes fora da amostra do banco.

Não pedir todo o inventário outra vez. Revalidar somente o que a implementação exigir ou o que tiver mudado antes de uma execução futura.

Antes de uma captura/virada futura, confirmar a **fonte efetiva** por presença/comparação, sem mostrar valores: o conjunto completo `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `DRIVE_TOKEN_SECRET` tem prioridade sobre o banco, e `DRIVE_CRON_SECRET` pode sobrepor o segredo da rotina. Registrar as origens no manifesto. Se a credencial efetiva tiver passado para ambiente, interromper: este formato de duas linhas não cobre sua restauração. Variáveis preservadas fora do escopo devem permanecer iguais; não alterá-las para fazer o procedimento caber.

## 3. Formato escolhido para a ferramenta a revisar

Exportação seletiva **JSON versão 1**, gerada por `SELECT` em uma única transação de leitura consistente. Não usar uma suposta opção de `pg_dump` para filtrar linhas ou colunas: seus filtros selecionam objetos. [Referência PostgreSQL](https://www.postgresql.org/docs/current/app-pgdump.html).

Conteúdo obrigatório do arquivo privado:

| Bloco             | Conteúdo                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Cabeçalho         | Versão do formato, identificador da operação, UTC, fonte/stack/banco e versão do exportador                                                |
| Integrações       | Linhas completas `id`, `dados`, `updated_at` somente de `google_oauth` e `google_drive`; estado presente/ausente explícito para cada chave |
| Entidades         | Mapa de `id`, `drive_folder_id`, `drive_doc_id`, `updated_at` em clientes/projetos/demandas/conteúdos, incluindo IDs nulos                 |
| Anexos            | `media_files`: `id`, `drive_file_id`, `drive_folder_id`, `updated_at`, `deleted_at`                                                        |
| Compartilhamentos | `id`, `alvo_drive_id`, `drive_permission_id`, `drive_doc_id`, `revogado_em`, `updated_at`                                                  |
| Manifesto         | Quantidades, campos/tipos esperados e integridade do arquivo, sem publicar resumo de valores secretos                                      |

Preservar o objeto `dados` inteiro, inclusive campos desconhecidos, presença de chave, JSON nulo e valores ausentes. Não reconstruir a conexão somente a partir de token/cliente: isso perderia IDs e metadados. Em produção, a ausência inesperada de uma das duas linhas aborta a preparação; os casos de ausência são exercitados com dados fictícios.

Conexões antigas podem não ter `dados.client_id`. Essa ausência legada não invalida a cópia e não autoriza preencher o campo ou inventar a origem do token; preservar e relacionar ao conjunto de configuração capturado. Um candidato novo deverá ter o emissor identificado e verificado.

Os mapas de referências servem para **conferência e investigação**. A restauração normal altera apenas as duas integrações; não reverte entidades, anexos, compartilhamentos ou histórico. Uma divergência nesses mapas pede análise própria, não uma atualização automática dos IDs.

## 4. Arquivos privados e captura futura

Destino proposto: **`/root/backup-flow-integracoes-p28-<UTC>/`**, exclusivo por operação, diretório `0700`, arquivos `0600`, `root:root`, fora de stack, API, Git e diretórios de funções. O nome é modelo; nenhum diretório desse tipo foi criado nesta rodada.

A ferramenta deverá criar o destino sem seguir links simbólicos, sem sobrescrever uma cópia existente e com `umask 077`. Gravar primeiro arquivo temporário privado; somente promover o nome definitivo após término bem-sucedido, validação do JSON, conteúdo esperado e tamanho não nulo. Erros/saída de depuração que possam conter dados ficam privados; o relatório público apresenta só etapa, quantidades, tamanho e verificações aprovadas/reprovadas.

Contrato da captura, a implementar/testar pelo Claude:

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
-- Um SELECT monta o documento descrito na seção 3.
-- A saída vai diretamente ao arquivo privado, nunca ao chat/terminal.
ROLLBACK;
```

Usar cliente não interativo, sem leitura de `.psqlrc`, sem eco de consultas/dados. Não passar JSON, senha ou token por argumento de processo. Não interpolar valores secretos em SQL; entrada de restauração precisa de mecanismo de dados separado e testado. [Semântica da transação de leitura](https://www.postgresql.org/docs/current/sql-set-transaction.html).

**Retenção proposta:** TI responsável pela custódia até 30 dias após a virada ser aceita como estável. Se a migração não acontecer, conservar a cópia até reavaliação. Sem exclusão automática ou transferência a outro serviço; definir descarte/destino com o dono no pacote de execução. A proposta de retenção não autoriza apagar arquivos.

## 5. Restauro: par coerente, concorrência e falha parcial

O código de `share-expire` pode reler e gravar **a conexão inteira**, além de `ultima_varredura` e `varredura_erros`. Bloquear uma linha durante o COMMIT não elimina um handler que já leu dados antigos e gravará depois. Fechar a aba ou colocar um aviso não é barreira de escrita.

O procedimento futuro deve demonstrar a suspensão/controle de **todos os escritores da integração**, inclusive requisições em andamento, cron e callbacks, antes de capturar a imagem imediatamente anterior e restaurar. Não mudar agora a rotina do cron. Se a opção for parar funções, nomear somente o container Flow acima, listar o impacto nas cinco funções e prever retorno; não presumir que a autorização antiga cubra essa janela de dados.

Contrato do restaurador a ensaiar **somente com dados fictícios**:

1. Validar formato, origem, integridade e correspondência entre configuração/conexão. Recusar outra stack, fonte desconhecida, cópia truncada ou falta de uma linha esperada. Guardar imagem privada do estado imediatamente anterior à tentativa.
2. Conferir mapas de referências e imagem esperada do estado atual. Qualquer edição concorrente de cliente/token/IDs/segredos/campo desconhecido aborta; não oferecer `--force` para ignorar a diferença.
3. Em uma transação curta, com prazo de lock/execução, bloquear e comparar novamente o conjunto de integração. Tratar presença/ausência sem janela de inserção concorrente; a implementação deve demonstrar o bloqueio correspondente. Um lock consultivo só serve se todos os escritores o respeitarem.
4. Restaurar `google_oauth` **e** `google_drive` no mesmo COMMIT. Preservar campos desconhecidos; nenhum estado com cliente novo e refresh token antigo pode ficar visível.
5. Política operacional explícita: no retorno de credenciais, manter da imagem atual os campos `ultima_varredura`/`varredura_erros`, inclusive sua presença/ausência, para não apagar uma varredura posterior. Só esses campos são exceção à comparação do estado esperado; qualquer outra diferença exige análise. A versão histórica integral continua preservada no arquivo privado. Não restaurar tabelas de compartilhamento para desfazer efeitos externos da rotina.
6. `updated_at` das linhas restauradas recebe o horário da restauração; o horário original permanece no arquivo. Falha entre as duas gravações deve provocar `ROLLBACK` de ambas. Não desabilitar gatilhos, RLS ou auditoria.
7. Após COMMIT, conferir o par e os campos preservados sem imprimir valores; validar cache/renovação pela ferramenta e procedimento revisados. Os TTLs atuais são 60 s para configuração e 30 s para conexão; esperar um TTL não é barreira contra escritores antigos. Recarga limitada de funções, se necessária, pertence à janela autorizada.

Não restaurar banco inteiro, recriar raiz, revogar Google ou rodar `disconnect` para desfazer. Retorno após reabrir gravações reais pode envolver arquivos criados pelo cliente novo que o antigo não acessa: não prometer reversão completa só com duas linhas. O pacote da virada precisa definir a barreira de gravação e o ponto de aceitação antes de liberar uso normal.

## 6. Ensaio separado da produção

Direção escolhida para preparar: bancada privada do [pacote Claude](2026-11-01-claude-flow-bancada-migracao-p28.md), sem usar `configure`, `auth-url` ou `callback` de produção. O consentimento e os tokens candidatos ficarão fora das duas linhas vivas.

Proposta de retorno OAuth: **`http://127.0.0.1:8765/oauth/callback`**, servidor ligado somente no loopback da VPS e acessado pelo navegador do dono por túnel SSH local. Verificar porta livre, host exato e túnel sem abrir firewall público. URI só pode ser adicionada ao **cliente novo**, preservando todas as entradas existentes, após autorização própria; não foi cadastrada nem foi iniciado servidor/túnel. O Google admite retorno local e exige correspondência exata com a URI cadastrada. [Regras oficiais](https://developers.google.com/identity/protocols/oauth2/web-server#redirect-uri-validation-rules).

A TI confirma somente os dados restantes: operador/conta Google autorizada a consentir; acesso aos três IDs principais e indicação privada de arquivos antigos relevantes; metadados do cliente novo/URI proposta; custódia da nova credencial; propriedade verificada associada ao projeto e estado separado de Audience/marca. Não pedir novamente acesso DNS, escolha de manter o Drive ou criação do projeto. Sem mudar IAM, DNS, Branding, URI ou credenciais por este encaminhamento.

## 7. Entrega esperada da TI

Devolver **um relatório sem segredos** com:

- Revisão dos scripts/PR do Claude: commit/manifesto, mecanismo real de captura e transação de retorno, prova de bloqueio/ausência de escritores e política dos campos de varredura.
- Caminhos/permissões/custodiante/retenção propostos; validação de que nenhum artefato sensível ficou no Git, schema exposto ou API.
- Resultado do ensaio restaurável com dados fictícios: alvo exato e prova de isolamento, par completo, falha intermediária revertida, concorrência recusada e ausência de mudanças em referências/outros dados.
- Operador e estados restantes do Google por comparação/confirmado ou pendente, sem e-mail privado, segredo, token ou IDs de arquivos no documento.
- Plano da bancada: comando real de inicialização/túnel, URI exata, encerramento e resultados permitidos. Aguardar o PR antes de inventar comandos que ainda não existem.
- Separação clara entre **conferido**, **proposto**, **testado com dados fictícios** e **não executado**. Nenhum novo inventário geral ou repetição da instalação #36.

Depois dos dois retornos, Codex revisa e monta a etapa executável para decisão do dono. Não iniciar Google real, restaurar produção ou ligar a stack de teste só porque este pacote foi recebido.
