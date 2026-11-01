# P-28 — Proposta de separar o Drive do Flow preservando o cliente do Barba & Cabelo

**Último estado, 01/11 — PR #37 integrado e procedimento TI conferido:** main `13f1dc9` em origem/espelho, merge externo às **18:57 Brasília**; árvore idêntica ao head dos **86 testes e quatro casos independentes aprovados**. [Conferência e etapa A pronta para decisão](2026-11-01-ti-flow-pr37-runtime-ensaio-conferido-p28.md): runtime temporário e suíte fictícia na VPS, ainda não executados. Nenhum backup secreto, consentimento ou migração iniciados. Detalhes na seção 19; instalação/diagnóstico #36 atendidos.

**01/11/2026 · Proteção Flow instalada e validada em produção às 15:32 Brasília.** Dois arquivos do #36 conferidos; recarga só das funções Flow, **8,309 s** até saudável, demais containers intactos. Diagnóstico pré 404 → pós **200**, conexão ativa e Raiz/Clientes/Lixeira acessíveis; amostra zero não prova Drive vazio. [Resultado e backup](2026-11-01-flow-instalacao-pr36-p28.md). Instalação e primeira linha de base atendidas; próxima etapa é pacote protegido de cópia/retorno e ensaio considerando cron ativo. Destino `flow-proh-media-drive` já criado segundo Guardião, cliente ainda não aplicado; não recriar. Operador, propriedade associada, marca, compatibilidade e renovação real pendentes. P-69 preservada; migração não executada; cron/APP_URL não alterados pelo Codex.

## 1. Proposta concreta

**Direção escolhida: manter o Drive do Flow e planejar sua migração para um projeto Google Cloud dedicado ao Flow, conservando o cliente atual do Barba & Cabelo no `proh-media-drive`.** Depois da migração estável e da retirada planejada do uso antigo do Flow, adequar a marca do projeto atual ao Barba & Cabelo e retomar a P-28. O nome `proh-media-drive`, sozinho, não obriga mudar o cliente do Barba & Cabelo; renomear um projeto também não separa suas credenciais ou sua marca.

| Sistema        | Evidência informada pelo TI                                                                                                            | Proposta                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Barba & Cabelo | Segundo o TI, **1** usuário com login Google e **1** conexão Agenda/Contatos; cliente **Barba e Cabelo Auth**                          | Conservar projeto/cliente, identificador e segredos atuais. Testar login e integrações durante a mudança do Flow |
| Flow produção  | Stack ativa em `supabase.proh.media`; cliente **Supabase Google Drive** identificado na configuração, com uma conexão Drive registrada | Preparar projeto próprio, nova autorização da conta responsável e troca limitada à integração Drive do Flow      |
| Flow teste     | Stack parada em `supabase-teste.proh.media`, com arquivos e volumes preservados                                                        | Manter parada. Não copiar o retorno de teste para produção sem um uso aprovado e ambiente próprio                |

**Por que essa direção:** reduz a mudança de credenciais no sistema com login real em produção, concentrando a migração na conexão Drive identificada. Isso é uma avaliação de impacto a partir do relato, não garantia de ausência de interrupção. O dono confirmou o planejamento; se o levantamento restante revelar outras dependências, revisar o plano antes de executar.

**Alternativa de contingência:** dedicar outro projeto ao Barba & Cabelo e conservar o Flow no atual. Exigiria planejar a troca do cliente de login e de Agenda/Contatos, testar o vínculo das contas existentes e novas autorizações quando necessárias. O levantamento agora informa um login e uma conexão no Barba & Cabelo; não sustenta presumir um grande número de contas Google. A direção escolhida permanece migrar o Drive do Flow. Se domínio, responsável ou compatibilidade com arquivos impedirem essa direção, apresentar a evidência ao dono antes de propor mudança; não trocar a escolha silenciosamente.

A continuidade está confirmada pela resposta direta do dono, sem depender de inferência dos logs. A frase do anexo sobre “projetos dedicados por sistema” continua sendo contexto do relato; a resposta do dono escolheu a direção do planejamento e não autorizou criar ou alterar projetos nesta etapa.

## 2. Evidências e limites

**Levantamentos iniciais de ~17:00/~17:40.** A atualização de ~18:05 está na seção 9 e atende a comparação de hash, detalha a ausência de páginas nos caminhos testados e aponta divergência da hospedagem atribuída ao frontend. Ler o conjunto antes de solicitar nova conferência.

Fontes externas: `relatorio-claude-complemento-p28-2026-10-31.md` (~17:00) e `relatorio-claude-levantamento-p28-flow-2026-10-31.md` (**~17:40 de Brasília**), entregues pelo dono. TI relata leitura SSH/GitHub, sem mudanças, reinícios, desconexão ou abertura de valores de segredos. As condições da VPS/banco abaixo são do relatório; o Codex conferiu separadamente código/Google/DNS na seção 8, sem acessar a VPS. Identificadores pessoais e máscaras de e-mail foram omitidos deste registro.

| Assunto                | Resultado informado pelo TI                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Flow produção          | Coolify `flow-producao`, stack `supabase-vv3jo93anprhqezhtu4ewcpl`, API `https://supabase.proh.media`; teste `jp4s2rsvrthdronl3ws71asj` permanece parado                                                                                   |
| Frontend               | `https://flow.proh.media`, Hostinger; `/admin?tab=drive` é a aba da integração. HTTP 200 de uma SPA não comprova funcionamento de cada tela ou existência de política pública                                                              |
| Código                 | Repositório privado `Proh2026Media/flow-proh-media`; função `supabase/functions/google-drive/index.ts`. Autoria Git é pista, não comprovação de quem pode autorizar a conta Drive                                                          |
| URLs OAuth             | `APP_URL` e `PUBLIC_SUPABASE_URL` ausentes no ambiente informado. `publicBase` deduz a API pública pelos cabeçalhos; retorno: `https://supabase.proh.media/functions/v1/google-drive/callback`. Ensaio ao vivo ainda não executado         |
| Escopo                 | Somente `https://www.googleapis.com/auth/drive.file`, com `include_granted_scopes=true`; sem escopos Agenda/Contatos do Barba & Cabelo                                                                                                     |
| Configuração viva      | `public.integracoes`, registros `google_oauth` (cliente/segredo e segredos de assinatura/cron) e `google_drive` (conexão, token e IDs de pastas). Variáveis Google ausentes segundo o TI; cópia só de `.env` não restaura a integração     |
| Tarefas de fundo       | Crontab root a cada 15 min aponta para **`https://supabase-teste.proh.media/functions/v1/google-drive/share-expire`**, teste parado. `scheduled_tasks` vazio e sem `ultima_varredura` na conexão; cron efetivo de produção não evidenciado |
| Dados Flow             | `compartilhamentos`: **0**; `media_files` ativos: **0**; identidades de login Google: **0**. Isso não inventaria o conteúdo real das pastas no Drive                                                                                       |
| Barba & Cabelo         | **1** identidade/usuário de login Google; **1** conexão com refresh token e permissões Calendar e Contacts. Sua tabela `integracoes` vazia é distinta de `google_connections`; não confundir vazio com ausência de integração              |
| Sobreposição de contas | **Não**, segundo comparação dos e-mails de conexão Drive com login e conexão Google do Barba & Cabelo, apenas no estado atual informado                                                                                                    |
| Responsável            | Pistas de autoria/administração no repositório e conta Google conectada. Pessoa/função autorizada a reconectar o Drive ainda não formalmente identificada                                                                                  |
| Google                 | Destino e domínio/marca não conferidos pelo TI nesta rodada. Relato anterior: marca Proh Media não verificada, Audience Externo/Em produção; propriedade de `proh.media` associada ao IAM não comprovada                                   |

## 3. Cuidados que mudam a ordem da execução

O [Google recomenda projetos separados para marcas distintas](https://developers.google.com/identity/siwg/best-practices), porque todos os clientes de um projeto compartilham a marca de consentimento. Outro cliente dentro do mesmo projeto não resolve essa separação.

Na [documentação OAuth para aplicações Web](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke), o Google informa que a revogação alcança os escopos e tokens concedidos ao projeto, incluindo outros clientes. **Aplicação ao caso:** o TI informou ausência de sobreposição de contas neste levantamento; isso reduz o risco identificado para o estado atual, sem alterar a regra de revogação nem autorizar remoção automática. Revalidar a comparação antes do encerramento do uso antigo. Não significa revogar todas as contas do sistema. Não usar revogação como etapa automática de migração ou de desfazer.

A troca de cliente precisa de nova autorização planejada para o Flow. Não misturar o token antigo com as novas credenciais; no retorno ao estado anterior, restaurar o conjunto correspondente. O mesmo guia descreve a renovação com o refresh token e a configuração do cliente. Essa consequência orienta o plano; nenhuma credencial foi lida ou copiada para este documento.

O [guia geral OAuth](https://developers.google.com/identity/protocols/oauth2) informa que tokens de renovação de apps externos em Testing expiram em sete dias, salvo a exceção de escopos básicos de identidade. Portanto, uma conexão de ensaio do Drive em Testing não comprova uma configuração duradoura de produção. Mapear os escopos reais e as exigências do projeto Flow antes da troca definitiva.

## 4. Situação do levantamento e o que falta

**Atualização vigente:** páginas públicas atendidas pelo retorno do Flow; complemento TI de 19:50–19:52 recebido, não aguardando nova rodada. Detalhes e revisão do desenho na seção 10 e na [devolutiva](2026-10-31-flow-retorno-e-protecao-p28.md). A tabela abaixo mantém a base do levantamento inicial quando indicar horários anteriores.

| Item pedido                 | Situação após ~17:40 e conferência própria                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Continuidade/direção        | Confirmadas diretamente pelo dono; não perguntar novamente                                                                                                        |
| Responsável                 | Pistas atendidas; operador autorizado para a futura conexão ainda falta identificar                                                                               |
| URLs, escopo e persistência | Atendidos por leitura, com ressalvas de precedência e retorno explicadas na seção 8                                                                               |
| Projeto de destino          | Inventário lido pelo Codex: não identificado um dedicado ao Flow entre seis projetos acessíveis. Nenhum escolhido/criado; não prova inexistência em outras contas |
| Domínio e marca             | Propriedade associada ao IAM e links públicos próprios ainda não comprovados; não inventar URLs com base em HTTP 200                                              |
| Dependências/contagens      | Levantadas pelo TI. Cron de produção não evidenciado; conta Drive sem sobreposição atual. Ensaio real ainda não feito                                             |

**Três blocos restantes para fechar o pacote de execução:**

1. **Destino Google e operador:** consolidado informa que Guardião criou **`flow-proh-media-drive`**, número **`930474870480`**, cliente “Flow Drive (produção)”, ainda não aplicado. Não repetir escolha/criação do destino. Falta confirmar operador da autorização Drive, propriedade associada e marca/Audience no estado atual; criação relatada não comprova tudo isso. O cliente Barba & Cabelo permanece no projeto atual. Nenhuma configuração Google alterada pelo Codex.
2. **Domínio e marca:** acesso DNS já confirmado; comprovação Google associada ao destino ainda pendente, sem acrescentar TXT/IAM nesta preparação. Páginas de apresentação, privacidade e Termos já publicadas pelo Flow, conferidas no navegador isolado. Não recriar nem usar as URLs do Barba & Cabelo na marca Flow. Revisão jurídica/contato ainda não confirmados. Hostinger atende o público; divergência do registro Pages não obriga limpeza DNS para preparar o PR. Corrigir o gatilho é tarefa própria, com causa conhecida.
3. **Compatibilidade e ensaio:** versão implantada **já conferida pelo TI**; não pedir novo hash. Preparar a troca respeitando efeitos de callback/status, acesso por arquivo do novo app e regras do Flow (seção 8). Cópia protegida das **duas linhas** de `integracoes`, IDs e segredos de assinatura/cron; teste de acesso às pastas antes da criação/substituição automática, nova autorização, renovação real e retorno. A igualdade de código e as contagens zero no banco não substituem o ensaio de pastas no Drive.

**Recado anterior para encaminhar ao TI — histórico, substituído pela devolutiva da seção 10:**

> Relatórios de ~17:40/~18:05 recebidos: não repetir URLs, escopo, banco, contagens, zona/TXT ou hash já atendidos. A direção continua manter/migrar o Drive preservando o cliente do Barba & Cabelo. Seguir o encaminhamento das páginas públicas e do ensaio; formalizar destino/operador e preparar a comprovação Google do domínio. Confirmar o pipeline diante do CNAME Pages. Não abrir a aba Drive/chamar status como leitura, criar/configurar recursos Google, trocar credenciais, iniciar teste, corrigir cron ou alterar DNS/IAM por esta preparação. Não enviar segredos/tokens. Ler o AGENTS do Flow antes de qualquer tarefa nesse repositório.

## 5. Sequência proposta, após decisão e pacote de execução completo

Estas fases definem o resultado a revisar. **Ainda não há comandos ou autorização para executá-las.** O pacote operacional futuro deve nomear destino, fontes de configuração, cópias de segurança, testes e responsáveis a partir dos dados da seção 4.

| Fase                               | Mudança prevista e condição para avançar                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Preparar                       | Confirmar decisão de continuidade, responsável, escopos e destino. Anotar as listas OAuth/Branding dos dois usos e criar cópia protegida da configuração e conexão Flow; registrar local/data, sem valores no relatório ou Git                                                                                                                                                      |
| 2 — Configurar destino             | Preparar o projeto dedicado, APIs e cliente Web do Flow, com retorno de produção conferido, marca/links corretos e requisitos de domínio/verificação atendidos. Não importar automaticamente retornos de teste ou permissões de outros sistemas                                                                                                                                     |
| 3 — Trocar apenas Flow             | Atualizar a fonte persistida conforme o pacote operacional; obter nova autorização com controle dos efeitos do callback. Validar o acesso às pastas existentes pelo novo app antes de permitir `ensureRootFolders` trocar IDs/criar outra raiz. Preservar as duas linhas anteriores e os segredos de assinatura/cron para desfazer; nenhum cliente do Barba & Cabelo muda           |
| 4 — Validar                        | Conferir início do consentimento, retorno ao frontend correto, conta conectada, ação Drive em arquivo de teste, renovação sem nova interação e tarefa de fundo efetivamente usada. Conferir login e conexões existentes do Barba & Cabelo, considerando a sobreposição de contas. Não fazer teste destrutivo nem revogar a concessão antiga por rotina                              |
| 5 — Observar e encerrar uso antigo | Com estabilidade comprovada, preparar a retirada do cliente antigo do Flow e de suas dependências do projeto compartilhado, com impacto e autorização definidos no pacote. Não excluir cliente/segredo só porque a primeira conexão nova passou                                                                                                                                     |
| 6 — Adequar Barba & Cabelo         | Após encerrar o uso Flow no projeto atual, adequar Branding à identidade do Barba & Cabelo e aos links `https://beauty.contheiner.digital`, `/privacidade` e `/termos`, conferir todos os domínios necessários e verificar/publicar a marca. Retirar `proh.media` só se o inventário final comprovar ausência de usos relevantes e essa mudança estiver incluída no pacote aprovado |
| 7 — Retomar P-28                   | Revisar o roteiro de vídeo/reenvio para a configuração final; mostrar login e cada permissão Agenda/Contatos, com a conta de teste e demais requisitos do pacote. Não reutilizar a aprovação histórica de 03/10 como prova do estado atual                                                                                                                                          |

Não alterar por esta proposta a rotina `google-drive/share-expire` mantida pela decisão P-26, nem apagar a cópia de função sem uso relatada no Barba & Cabelo. O levantamento da tarefa real do Flow é distinto dessa rotina; qualquer correção dela fica em escopo próprio.

## 6. Como planejar o retorno ao estado anterior

- Antes da retirada do cliente antigo ou da troca de Branding, uma falha na migração deve interromper o avanço e restaurar **somente o Flow**, pelo conjunto anterior de configuração/conexão. Se a autorização antiga tiver expirado ou sido invalidada, será necessário o responsável autorizá-la novamente; a cópia não garante um token válido.
- Confirmar que o Flow voltou ao comportamento registrado antes da mudança e que o Barba & Cabelo continua autenticando e usando suas conexões. Não restaurar banco inteiro, reiniciar todos os serviços ou revogar acesso Google para “limpar” a tentativa.
- A retirada do cliente antigo e as alterações de Branding terão seus próprios pontos de retorno no pacote de execução. Não avançar para essas fases enquanto a reversão da troca Flow não estiver descrita e o ensaio aprovado.

## 7. Decisão e devolutiva

**Direção confirmada pelo dono em 31/10:** manter o Drive do Flow e planejar a separação, migrando essa integração e preservando o cliente atual do Barba & Cabelo. A pergunta apresentada explicitava que a escolha era sobre o plano, sem alteração de configuração nesta etapa. Não pedir a mesma decisão novamente. O complemento do TI e essa escolha não autorizam executar a migração; os detalhes operacionais da seção 4 precisam constar do pacote antes da execução.

**Levantamento recebido:** URLs, escopo, persistência e contagens atendidos. A devolutiva restante corresponde aos três blocos da seção 4; não solicitar todo o levantamento de novo. Somente nomes, estados, URLs e evidências sem credenciais. Na entrega atual foram preparados documentos; nenhuma migração, criação/exclusão de cliente, revogação ou reenvio foi realizado.

## 8. Conferências próprias de leitura em 31/10

### Google Cloud, Search Console e DNS

O Codex consultou o gerenciador de recursos pela sessão já conectada da conta operacional: seis projetos acessíveis, incluindo o atual e projetos de outras finalidades; nenhum destino dedicado ao Flow identificado/selecionado. Isso não autoriza reaproveitar projetos genéricos nem comprova que não haja outro em conta diferente. Nenhum recurso criado, renomeado ou excluído.

A conta pessoal já conectada também exibiu **sem acesso** à propriedade de domínio `sc-domain:proh.media`. Prefixos dessa conta e outras contas não foram examinados; proprietário verificado associado ao projeto continua não comprovado. Não houve clique em verificar propriedade, inclusão de DNS ou mudança de IAM. Abas temporárias de leitura encerradas.

Consulta DNS pública retornou `ns1.dns-parking.com` e `ns2.dns-parking.com` como servidores de nomes. Isso indica o serviço DNS a localizar, não prova acesso ao painel, titularidade ou verificação Google. Não foi lido nem alterado painel DNS.

### Código fonte do Flow — diferença entre leitura e execução

Fonte lida pelo conector GitHub: [google-drive/index.ts](https://github.com/Proh2026Media/flow-proh-media/blob/main/supabase/functions/google-drive/index.ts), blob **`17e98b8278747857329dcf38d1412b682e3c714e`**, e `src/App.tsx`. A igualdade com a função da VPS foi posteriormente **comprovada pelo TI segundo o relatório de ~18:05** (seção 9). O Codex não acessou a VPS; análise da fonte vinculada ao arquivo implantado pelo relato, sem ensaio funcional executado.

- **Precedência corrigida:** `loadConfig` (linhas 116–134) prefere o conjunto completo de variáveis `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `DRIVE_TOKEN_SECRET`; usa o banco quando esse conjunto não está completo. Como o TI informou variáveis ausentes, o banco é a fonte viva relatada. Não tratar “banco primeiro” como regra do código. Cache de configuração de 60 s e cache de acesso exigem testar renovação real; não basta uma chamada com token antigo ainda válido.
- **Retorno OAuth:** `handleAuthUrl` guarda a origem da requisição no `state` assinado; `handleCallback` recupera essa origem do `state`, não depende de o Google enviar o header Origin na volta (linhas 730–767). `APP_URL` ausente só leva ao fallback da API se também faltar origem na geração do estado. Não declarar bug normal comprovado nem alterar `APP_URL` automaticamente; o ensaio deve conferir retorno a `https://flow.proh.media/admin?tab=drive` e cancelamento.
- **Consulta com efeitos:** `handleStatus` chama `ensureRootFolders` e `revogarVencidos` (linhas 685–705). `ensureRootFolders` pode criar raiz/subpastas e salvar a conexão (403–424). `loadConfig` também pode persistir `cron_secret` ausente. Portanto, abrir a aba da integração ou chamar esses endpoints não é garantia de somente leitura; nesta conferência foram lidos arquivos e telas de metadados, sem chamar a função Flow.
- **Falha parcial no callback:** o token novo é salvo antes da confirmação das pastas; `ensureRootFolders` pode trocar IDs se a raiz anterior aparecer ausente (782–799 e 403–424). Falha de conexão/retorno não garante que nada foi persistido. O pacote precisa recuperar o conjunto coerente das duas linhas do banco, sem desconectar/revogar para “limpar”.
- **Assinaturas:** a configuração existente conserva `token_secret`/`cron_secret` em `handleConfigure` (663–681). Preservar esses valores no planejamento evita invalidar assinaturas existentes por trocar apenas o cliente OAuth; nenhum valor foi lido.

### Arquivos existentes, escopo e regras do projeto Flow

O [Google classifica `drive.file` como não sensível e limitado aos arquivos usados/compartilhados com o app](https://developers.google.com/workspace/drive/api/guides/api-specific-auth). **Inferência para a migração:** um novo projeto representa outro app; não presumir que o novo token verá os IDs de pastas criados/autorizados pelo antigo. Testar esse acesso de forma controlada antes do callback/status que podem recriar a raiz. Diante de 403/404, preparar uma solução de acesso/migração de arquivos com o responsável; não ampliar para `drive` nem substituir os IDs automaticamente. Zero `media_files` no banco não prova Drive vazio.

O [AGENTS.md do Flow](https://github.com/Proh2026Media/flow-proh-media/blob/main/AGENTS.md), lido inteiro, exige PR para alterações de código e restringe os scripts de instalação/migração à stack de teste. Não contornar essas guardas, enviar código direto à main do Flow ou usar scripts do Barba & Cabelo nessa instalação. A diretriz de segredos em ambiente diverge da configuração em banco observada pelo TI e aceita pelo código; o responsável pelo Flow precisa resolver a forma de persistência antes de um pacote de mudança, sem mudar a fonte silenciosamente nesta migração. Nenhum arquivo do Flow foi editado nesta entrega.

O cron P-26 continua preservado por decisão anterior do dono. Seu endereço foi identificado como teste parado; uma correção eventual requer escopo próprio. Não tornar o funcionamento desse cron de teste um requisito para recriar dados ou iniciar a stack parada durante a migração de produção.

## 9. Relatório de ~18:05: domínio, páginas e hash

Fonte externa lida inteira: `relatorio-claude-p28-blocos-2-3-2026-10-31.md`, entregue pelo dono. TI relata leitura Hostinger/HTTP/SSH, sem alterações, restart, chamadas à função Drive ou abertura de valores de segredos/tokens. O Codex não repetiu a consulta à zona ou à VPS nesta rodada.

| Frente            | Resultado e limite                                                                                                                                                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domínio/DNS       | `proh.media` ativo na conta Hostinger conectada, NS dns-parking. Zona retornada sem TXT Google; não comprova ausência de propriedade Search Console por outro método ou associação ao destino                                                                                                         |
| Hospedagem        | Raiz/www em ALIAS/CNAME Hostinger; **flow CNAME `flow-proh-media.pages.dev.`**. Diverge da atribuição anterior de frontend Hostinger; confirmar conta/pipeline antes de publicar, sem alterar DNS                                                                                                     |
| Homes/políticas   | Homes sem links legais no HTML consultado. Caminhos comuns: Flow devolve o mesmo shell 200, PROH/www devolvem 404. Não são URLs oficiais de políticas; renderização cliente não ensaiada pelo TI. Leitura anterior de App.tsx também sem rotas dedicadas; não generalizar para todo possível endereço |
| Código implantado | `/data/coolify/services/vv3jo93anprhqezhtu4ewcpl/volumes/functions/google-drive/index.ts`, 79588 bytes/1551 linhas; **git hash-object `17e98b8278747857329dcf38d1412b682e3c714e`**, igual ao blob analisado. Hash de arquivo Git, não commit ou ensaio funcional                                      |
| Ainda pendente    | Destino/operador, propriedade associada, páginas válidas, cópia protegida e ensaio OAuth/pastas. Não concluídos pelo relatório de hash                                                                                                                                                                |

**Trabalho preparado:** [encaminhamento das páginas públicas e do ensaio Flow](2026-10-31-flow-paginas-publicas-e-ensaio-p28.md). Apresentação proposta em `/sobre-o-flow`, privacidade em `/privacidade`, Termos se oferecidos em `/termos`; rotas **propostas, não publicadas**. Conteúdo/implementação pertencem ao Flow e seguem sua revisão. Não copiar política do Barba & Cabelo nem cadastrar URLs sem verificar a publicação real.

## 10. Retorno Flow, páginas entregues e desenho ainda a revisar

Fonte principal: `relatorio-claude-flow-retorno-p28-2026-10-31 2.md`, entregue pelo dono e lido inteiro. Relatórios complementares de entrega e conferências TI encontrados nesta máquina; o retorno TI de **19:50–19:52** já atende a rodada que o Claude marcava como aguardada. Não pedir de novo espelho, cron ou nomes de variáveis.

Codex confirmou pelo GitHub o PR #33 integrado às **19:18:22 de Brasília**, origem e espelho no commit `2cc490788209e32480282f8730e4f4062dfad2e7`. Claude atribui a publicação ao Alyson; Codex não publicou no Flow. Hostinger confirmada nos cabeçalhos públicos; três rotas renderizadas sem sessão em 375/768/1440 px, com backend bloqueado/simulado, sem rolagem lateral, erros de console ou recursos `/functions/v1/`. Esses testes não são ensaio OAuth/Drive nem aprovação jurídica/Google.

TI identificou falta de `HUB_DISPATCH_TOKEN` no gatilho instantâneo; workflow atual está habilitado para a origem Flow, contrariando a afirmação anterior de que ambos eram pulados. Origem/espelho iguais não provam sincronização reparada. TI também reconfirmou cron no teste e ambiente Google/APP_URL ausente; fonte viva relatada continua no banco.

**Próximo trabalho proposto:** PR em rascunho do Flow para proteger IDs, validar autorização antes de substituir conexão, tratar falha parcial/persistência/cache e diagnóstico sem gravação, com mocks locais. Não depende de iniciar a stack de teste nem de obter token real. [Escopo, testes e responsáveis](2026-10-31-flow-retorno-e-protecao-p28.md).

O desenho recebido não está aceito para execução: zero linhas no banco não justifica nova raiz; retirar revogação automática do token em erro; diagnóstico não pode herdar gravações de `loadConfig`/`status`; cópia auxiliar no próprio banco precisa de proteção/restauração; teste no dia 8 não comprova estado de publicação Google. APP_URL e correção do cron não viram exigências automáticas. Projeto/operador, propriedade associada, ensaio real e pacote operacional ainda faltam. Não remover cliente antigo, mudar Branding ou reenviar P-28 nesta etapa.

## 11. Gatilho encerrado e revisão da proteção entregue

Relatório TI `relatorio-ti-flow-gatilho-p28-2026-10-31.md` lido inteiro: validação de **21:30–21:32 de Brasília**, credencial já cadastrada pelo responsável e cadeia do push #34 com sucesso. Codex confirmou execuções/etapas específicas pelo GitHub e issue #17 fechada. [Encerramento e evidências](2026-10-31-ti-flow-gatilho-publicacao-p28.md#7-resultado-recebido-e-conferido). Não criar outra credencial nem repetir disparo/inventário.

Consulta posterior confirmou origem e espelho no commit `e82919c77eed12440409d465b596822cfca1efcb`, PR #35 integrado às **21:32:55 de Brasília**. Publicação do frontend não prova implantação da função: leitura SSH do Codex encontrou `index.ts` no blob antigo `17e98b8278747857329dcf38d1412b682e3c714e` e `protecao.ts` ausente. Nenhuma função, diagnóstico ou painel Drive chamado; nenhum arquivo remoto alterado.

**Próxima tarefa:** PR complementar do Flow para validar os IDs principais já gravados em `garantirRaiz` e na autorização candidata. Quatro reproduções locais com dependências fictícias mostraram raiz aceita com Clientes/Lixeira inacessíveis ou na lixeira e candidata gravada sem essas verificações. Cobrir também falha na preparação de pastas após gravar a candidata; não revogar para desfazer. [Código, linhas e critérios de regressão](2026-10-31-flow-revisao-pr35-p28.md).

A versão futura exige `index.ts` e `protecao.ts` correspondentes; preparar implantação/retorno somente depois da correção/revisão. Destino/operador, domínio associado, compatibilidade de arquivos, cópia protegida e ensaio real ainda faltam. Páginas e gatilho atendidos; P-28 não concluída por isso. Nenhuma ação Google, DNS, cron, implantação ou migração executada pelo Codex.

## 12. PR #36 recebido e revisado

Relatório `relatorio-claude-flow-pr36-p28-2026-10-31 04.md` lido inteiro. GitHub confirma PR #36 aberto/em rascunho, head `78381de3a0abfbf0c72fcabbf4245caa1252a3f8`; origem/espelho main continuam em `e82919c77eed12440409d465b596822cfca1efcb`. Nenhum merge ou implantação realizado pelo Codex.

O módulo agora confere coerência e os três IDs existentes antes de criar/gravar; candidata usa o próprio token nas três inspeções. A orquestração usada pelo callback real retorna estado parcial explícito quando a preparação falha depois da gravação. Codex executou **94 testes do módulo** em cópia isolada e repetiu **quatro regressões independentes**, todos aprovados. Não repetiu os 106 testes completos, Deno check, tipos/lint do Flow declarados pelo Claude. [Conclusão versionada e limites](2026-10-31-flow-revisao-pr36-p28.md).

**Próximo passo:** decisão do dono sobre merge; depois preparar o procedimento autorizado de implantação dos dois arquivos, com cópia/retorno e primeira validação controlada por diagnóstico, sem abrir `status`. [Arquivo de preparação para TI/Flow](2026-10-31-ti-flow-preparar-implantacao-pr36-p28.md). Não repetir o PR para os mesmos pontos nem confundir integração no Git com função na VPS. A migração Google continua dependendo de destino/operador, propriedade, compatibilidade e ensaio próprios.

## 13. Consolidado de ~22:40 e revisão 2 da implantação

Consolidado entregue pelo dono e lido inteiro. Também lidos o pacote TI revisão 2 de **22:28**, a revisão do Claude e o desenho de ensaio corrigido. Merge #36 às **22:02:39 de Brasília**, origem/espelho em `926298529da2b0e565599eb3e1f86d834e514be1` e manifesto idêntico ao revisado confirmados pelo Codex. Não repetir 94 testes/quatro regressões dos mesmos blobs como nova tarefa; continuam como evidência da revisão.

Leitura SSH confirmou `index.ts` antigo `17e98b8278747857329dcf38d1412b682e3c714e`, `protecao.ts` ausente, container `running healthy`. Também confirmou cron a cada 15 min apontando para produção e comparação de APP_URL com o frontend esperado. Nenhum valor de segredo/ambiente impresso; nenhuma função, diagnóstico, status ou varredura acionada. Logs 2xx do cron não conferidos.

Segundo Guardião, senha root trocada e projeto/cliente dedicado criados, ainda não aplicados ao Flow. São fatos relatados, sem consulta própria ao cofre/Google ou tentativa de verificar senha. Atualizar a premissa do planejamento: o projeto já existe e o cron agora pode atualizar `ultima_varredura` em `google_drive`. Não reverter essas alterações externas nem usar a antiga decisão P-26 como retrato do estado atual.

[Pacote vigente, revisão 2 com adendo do Codex](2026-10-31-ti-flow-implantacao-pr36-revisao2-p28.md): backup/staging fora das funções servíveis, ambos os módulos juntos, stop/start limitado ao container das funções, prova de versão e diagnóstico admin, retorno com backup verificado e preservação da versão nova fora da API. Preparação concluída; falta decisão do dono sobre essa intervenção de produção e janela de baixo uso, não outro inventário/PR. Nenhuma escrita remota realizada pelo Codex.

Após instalação comprovada, diagnóstico de linha de base → pacote de cópia/restauração considerando cron ativo → ensaio e renovação real → virada autorizada. Propriedade associada/operador, marca e contato/jurídico continuam pendentes. Não reenviar P-28 ou migrar credenciais por causa deste consolidado. Desenho de backup seletivo ainda exige procedimento próprio ensaiado; não promover a proposta de `pg_dump` seletivo a comando aprovado sem definir sua execução.

## 14. Instalação autorizada e preparação remota de 01/11

Alyson autorizou o pacote revisão 2. Codex conferiu os artefatos exatos do merge, criou staging e cópia do código antigo fora de `volumes/functions/` e registrou o estado inicial dos containers. Pasta viva permanece com `index.ts` antigo, sem helper; container saudável e sem reinício. [Registro da operação `20261101T174338Z`, caminhos, hashes e retomada](2026-11-01-flow-instalacao-pr36-p28.md).

O acesso existente ao Flow foi usado sem revelar senha. O Edge bloqueou a colagem do diagnóstico com aviso de segurança que exige intervenção pessoal do dono; liberação já solicitada. Diagnóstico ainda não executado e container não parado. Não pedir novamente autorização de instalação nem tratar a preparação como implantação concluída. Após a liberação, revalidar condições e seguir o pacote; autorização não inclui a migração Google.

## 15. Instalação e primeira linha de base concluídas em 01/11

Alyson concluiu pessoalmente a liberação do console e informou “pronto”. Codex revalidou os mesmos blobs em main, staging e backup, executou o diagnóstico anterior e instalou os dois arquivos pelo procedimento autorizado. Parada às **15:32:28.142104**, saudável às **15:32:36.451368 de Brasília**; demais containers intactos. Diagnóstico às **15:32:55 = HTTP 200**, conexão atual ativa e três IDs principais acessíveis; zero IDs de registros na amostra. [Relatório operacional completo](2026-11-01-flow-instalacao-pr36-p28.md).

Proteção e primeira linha de base atendidas. Não houve retorno, recriação de pastas, troca de configuração/cliente, SQL, cron, DNS ou migração Google. Amostra zero não permite concluir Drive vazio nem compatibilidade com outro projeto OAuth. Próximo: preparar cópia/restauração protegida da integração e ensaio com IDs/renovação reais, considerando a rotina ativa e retorno coerente de configuração/conexão/cache. Operador, propriedade e marca continuam pendentes; não repetir instalação, PR, projeto ou inventários resolvidos.

## 16. Pacotes de cópia/retorno e bancada isolada preparados

Preparados [arquivo para Claude implementar/testar no Flow](2026-11-01-claude-flow-bancada-migracao-p28.md) e [arquivo para TI revisar a operação](2026-11-01-ti-flow-copia-restauracao-ensaio-p28.md), com tarefas e devolutivas separadas. Não são autorização de restauração de produção, URI/consentimento Google ou início da stack parada. Não há novo pedido para refazer inventário ou #36.

**Leitura direcionada própria:** PostgreSQL 15.8; `integracoes(id text, dados jsonb, updated_at timestamptz)`, chave primária por ID, RLS ativa e zero políticas. Duas linhas de integração; quatro/oito chaves nos respectivos objetos, sem exibir valores. Mapas de referências em clientes/projetos/demandas/conteúdos, `media_files` e `compartilhamentos`; zero linhas com referências preenchidas nas seis tabelas. Gatilhos de atividade/data nas entidades. Consulta de metadados/contagens em transação somente leitura e `ROLLBACK`; sem cópia secreta ou escrita persistente. Contagens zero continuam sem comprovar Drive vazio.

**Código conferido:** `configure` persiste o cliente antes da reconexão e não verifica o erro retornado pelo upsert. `Admin.tsx` e `DriveTabContent.tsx` montam a aba `?tab=drive`, chamam `status` ao entrar e refazem a consulta no retorno. Assim, o callback atual pode conduzir a efeitos mesmo quando o roteiro manda “só diagnosticar”. Não usar esse painel como bancada.

**Direção de preparação:** snapshot seletivo JSON consistente; retorno do par em um COMMIT, comparação do estado esperado, metadados de varredura atuais preservados e referências apenas conferidas. Prova de atomicidade/locks em PostgreSQL fictício compatível antes de uma operação real. Candidato OAuth em servidor privado de loopback/túnel e fora das linhas vivas; só recebe manifesto de IDs, nunca a cópia com segredo antigo. Testar GETs e renovação sem criar/revogar; falha de acesso pede análise, não outra raiz. Promoção futura preferencial do par validado, sem intervalo entre cliente novo e conexão antiga; barreira de escritores/cache e aceitação antes de reabrir gravações ainda exigem procedimento próprio revisado.

**Próxima ação concreta:** Claude devolve PR/manifesto/testes/comandos reais; TI devolve revisão operacional e operador/estados restantes, sem segredos. Codex concilia os dois e prepara a etapa executável para decisão do dono. Não foi gerado backup sensível, implementada ferramenta no Flow, executado restore, iniciado servidor/túnel/novo consentimento ou alterado Google/banco/cron/DNS por esta preparação.

## 17. PR #37 recebido e quatro ajustes reproduzidos

Anexos `relatorio-claude-flow-bancada-p28-2026-11-01.md` e `… 1.md` são byte a byte idênticos; conteúdo integral lido, sem nova autorização. GitHub confirma head `90135bb4072f4b443ddf02cfd62582ab96a1e170`, base `9262985`, PR #37 aberto/em rascunho e não integrado.

Codex revisou os módulos e executou **72/72 testes**, 438 asserções, em cópia isolada com Bun 1.4.2 e PostgreSQL 15.8 fictício exclusivo. Blobs locais conferidos com a referência fixa. Quatro reproduções independentes mostraram sucesso de CLI com escopo incorreto, decimal JSONB arredondado com cópia/retorno aprovados, candidato salvo reportado como não salvo após falha da evidência e symlink ancestral aceito. [Código, evidência e regressões solicitadas](2026-11-01-flow-revisao-pr37-p28.md).

Corrigir no mesmo PR e rever antes do ensaio real. Restauro continua restrito ao fictício; 106 testes completos/lint/tipos do Flow e 15 rodadas são resultados declarados pelo Claude, não repetidos integralmente aqui. Container exclusivo removido; sem banco da VPS, credencial real, consentimento, merge ou implantação. Duas sondagens de protocolo ao tokeninfo usaram apenas marcador fictício e devolveram 400/invalid_token; não são ensaio OAuth válido. Retorno operacional da TI e demais condições de operador/propriedade/marca permanecem próprios. Não repetir #36 ou o diagnóstico concluído.

## 18. Correções do PR #37 conferidas e retomada operacional

Relatório `relatorio-claude-flow-revisao-pr37-p28-2026-11-02.md` lido inteiro; cabeçalho 01/11, apesar do nome 02/11. GitHub confirma novo head `67e7fb785b7c11163438aa82a41e3d947a3ff212`, mesmo PR aberto/rascunho e sem merge; delta de 11 arquivos só das ferramentas. Codex conferiu os blobs e executou **86/86 testes**, 576 asserções, em PostgreSQL 15.8 fictício, além de quatro regressões independentes com a correção confirmada. [Evidências e limites](2026-11-01-flow-pr37-ajustes-conferidos-p28.md). Não pedir as mesmas correções novamente.

Localizado e lido inteiro o retorno TI `relatorio-ti-flow-copia-integracoes-p28-2026-11-01.md`, 17:29–17:31 Brasília. Fonte em banco/porta/cron/imagens/custódia relatados incorporados; “aguardando PR” era anterior à entrega. Leitura própria SSH confirma às 18:44 Brasília Bun ausente e nenhuma imagem Bun em cache, arquitetura linux/amd64, DB/funções saudáveis com início inalterado e rede Flow. Manifesto público de Bun 1.4.2 consultado, sem baixar/rodar imagem na VPS.

Preparado [complemento operacional para TI](2026-11-01-ti-flow-pr37-preparacao-operacional-p28.md), com versão/imagem fixadas, isolamento do runner/PG fictício e dados restantes. A revisão técnica dos quatro ajustes está atendida; merge é decisão do dono e não autoriza execução real. Cópia secreta, consentimento/URI, restauração e virada continuam próprios. Nenhum código Flow editado, comentário/review publicado, merge/deploy ou mudança remota realizada nesta rodada. Container fictício local removido; #36/diagnóstico preservados.

## 19. PR #37 integrado e procedimento TI conferido

Alyson informou aprovação do PR e entregou `procedimento-ti-flow-pr37-runtime-ensaio-p28-2026-11-03.md`, lido inteiro; cabeçalho de **01/11, 18:55–18:56 Brasília**. É preparação, não execução. GitHub confirmou merge externo às **18:57:00 Brasília / 21:57:00 UTC**, commit `13f1dc9bc50d3ac15f62944d832a02cd66ef3a2a`, main de origem/espelho; árvore `ef708d8e4fd6cd24afc79d568f6d5682615982a7` idêntica ao head revisado. Aviso ao hub concluído com sucesso. Não repetir merge, correções ou 86 testes/quatro casos sobre a mesma árvore; o aviso não prova instalação da ferramenta na VPS.

[Complemento operacional conferido](2026-11-01-ti-flow-pr37-runtime-ensaio-conferido-p28.md) resolve o comentário que interrompia o comando do PostgreSQL, define fonte exata, transporte, runtime, banco sem rede, namespace compartilhado, senha fictícia por arquivo, suíte e limpeza do volume temporário. O trecho OAuth do anexo depende de transporte compatível com o runtime Docker, sem Bun instalado no host nem porta pública; fica para C. Não é necessária nova devolutiva geral da TI ou do Claude para decidir A.

**Próxima etapa concreta: A — runtime temporário e suíte exclusivamente fictícia na VPS**, aguardando decisão específica de Alyson. Conta Google, IDs antigos, custódia do candidato e metadados/URI continuam pendências de C, sem bloquear A. Captura protegida B e virada D também próprias; barreira contra cron/requisições/callbacks continua indispensável antes de D. Nenhuma ação remota, backup secreto, consentimento ou migração executados nesta rodada. P-28 permanece pendente; #36/diagnóstico preservados.
