# P-28 — Proposta de separar o Drive do Flow preservando o cliente do Barba & Cabelo

**31/10/2026 · Direção de planejamento confirmada pelo dono; execução ainda não autorizada.** Após o complemento, o dono escolheu: **“Manter o Drive do Flow e planejar essa separação”**, preservando o cliente atual do Barba & Cabelo. O responsável operacional e os detalhes da seção 4 ainda precisam ser levantados. Nenhum recurso Google, credencial ou serviço foi alterado nesta preparação.

## 1. Proposta concreta

**Direção escolhida: manter o Drive do Flow e planejar sua migração para um projeto Google Cloud dedicado ao Flow, conservando o cliente atual do Barba & Cabelo no `proh-media-drive`.** Depois da migração estável e da retirada planejada do uso antigo do Flow, adequar a marca do projeto atual ao Barba & Cabelo e retomar a P-28. O nome `proh-media-drive`, sozinho, não obriga mudar o cliente do Barba & Cabelo; renomear um projeto também não separa suas credenciais ou sua marca.

| Sistema        | Evidência informada pelo TI                                                                                                            | Proposta                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Barba & Cabelo | Login em produção com usuários reais e integrações Agenda/Contatos; cliente **Barba e Cabelo Auth**                                    | Conservar projeto/cliente, identificador e segredos atuais. Testar login e integrações durante a mudança do Flow |
| Flow produção  | Stack ativa em `supabase.proh.media`; cliente **Supabase Google Drive** identificado na configuração, com uma conexão Drive registrada | Preparar projeto próprio, nova autorização da conta responsável e troca limitada à integração Drive do Flow      |
| Flow teste     | Stack parada em `supabase-teste.proh.media`, com arquivos e volumes preservados                                                        | Manter parada. Não copiar o retorno de teste para produção sem um uso aprovado e ambiente próprio                |

**Por que essa direção:** reduz a mudança de credenciais no sistema com login real em produção, concentrando a migração na conexão Drive identificada. Isso é uma avaliação de impacto a partir do relato, não garantia de ausência de interrupção. O dono confirmou o planejamento; se o levantamento restante revelar outras dependências, revisar o plano antes de executar.

**Alternativa a comparar antes da decisão de execução:** dedicar outro projeto ao Barba & Cabelo e conservar o Flow no projeto atual. Essa opção evita alterar o Flow e depende dos domínios do Barba & Cabelo, mas exige planejar a troca do cliente de login e de Agenda/Contatos, testar o vínculo das contas existentes e obter novas autorizações quando necessárias. A proposta de mover o Drive depende de acesso ao frontend/responsável Flow e dos requisitos de `proh.media`; se isso impedir o avanço, reavaliar a alternativa. O relatório não traz contagens de usuários de login Google e conexões Agenda/Contatos do Barba & Cabelo para encerrar essa comparação. Nenhuma das duas opções está autorizada para execução por este documento.

A continuidade está confirmada pela resposta direta do dono, sem depender de inferência dos logs. A frase do anexo sobre “projetos dedicados por sistema” continua sendo contexto do relato; a resposta do dono escolheu a direção do planejamento e não autorizou criar ou alterar projetos nesta etapa.

## 2. Evidências e limites

Fonte: `relatorio-claude-complemento-p28-2026-10-31.md`, relatório de leitura do assistente operacional de TI, **31/10/2026, ~17:00 de Brasília**, entregue pelo dono. [Histórico consolidado](2026-10-31-google-dominio-p28.md), seção 10. O Codex não acessou o Google Cloud, o banco ou a VPS para confirmar esses dados.

- **Flow produção:** Coolify `flow-producao`, stack `supabase-vv3jo93anprhqezhtu4ewcpl`, em execução; rota `supabase.proh.media`. Função `google-drive` com retorno `{publicBase}/functions/v1/google-drive/callback`; configuração `integracoes/google_oauth` corresponde ao cliente Drive. Conexão em `integracoes/google_drive` registrada em 30/09.
- **Flow teste:** `flow-teste`, stack `jp4s2rsvrthdronl3ws71asj`, parada, sem containers em execução segundo o TI. Não iniciar nem apagar seus volumes.
- **Uso:** registros disponíveis até 02/10; logs podem estar incompletos após restart de 23/10. A interface do Google mostrava último uso em 29/09, enquanto banco e logs registram atividade posterior; nenhum desses registros prova desuso atual.
- **Frontend do Flow:** não localizado no Coolify consultado. A função redireciona para `{APP_URL}/admin?tab=drive`, mas a URL pública real e o responsável não foram conferidos.
- **Google:** um único principal no IAM, a conta operacional como Owner (Legacy). Essa conta não acessa as propriedades de domínio `proh.media` nem os prefixos `https://proh.media/` e `https://www.proh.media/` no Search Console. Outros acessos não conferidos; propriedade associada ainda **não comprovada**.
- **Estado:** Audience Externo, Em produção, limite OAuth exibido em 1 de 100; marca salva **Proh Media**, sem logo e não verificada. “Em produção” não significa marca ou escopos aprovados. Estado publicado/rascunho não identificado pelo texto da tela.

## 3. Cuidados que mudam a ordem da execução

O [Google recomenda projetos separados para marcas distintas](https://developers.google.com/identity/siwg/best-practices), porque todos os clientes de um projeto compartilham a marca de consentimento. Outro cliente dentro do mesmo projeto não resolve essa separação.

Na [documentação OAuth para aplicações Web](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke), o Google informa que a revogação alcança os escopos e tokens concedidos ao projeto, incluindo outros clientes. **Aplicação ao caso:** revogar a autorização antiga do Flow pode afetar também autorizações do Barba & Cabelo da mesma conta Google. Não significa revogar todas as contas do sistema. O plano deve identificar essa sobreposição antes de qualquer chamada a `revoke`, botão de desconectar ou remoção de acesso pela conta Google. Não usar revogação como etapa automática de migração ou de desfazer.

A troca de cliente precisa de nova autorização planejada para o Flow. Não misturar o token antigo com as novas credenciais; no retorno ao estado anterior, restaurar o conjunto correspondente. O mesmo guia descreve a renovação com o refresh token e a configuração do cliente. Essa consequência orienta o plano; nenhuma credencial foi lida ou copiada para este documento.

O [guia geral OAuth](https://developers.google.com/identity/protocols/oauth2) informa que tokens de renovação de apps externos em Testing expiram em sete dias, salvo a exceção de escopos básicos de identidade. Portanto, uma conexão de ensaio do Drive em Testing não comprova uma configuração duradoura de produção. Mapear os escopos reais e as exigências do projeto Flow antes da troca definitiva.

## 4. O que o TI ainda precisa levantar por leitura

Não repetir P-69, inventário de clientes nem identificação já concluída. Para transformar esta proposta em execução verificável, faltam:

1. **Responsável operacional:** quem mantém o Flow e quem pode autorizar sua conta Drive. A continuidade e a direção de planejamento já foram confirmadas pelo dono; não perguntar novamente nem inferir abandono pela data de logs.
2. **Endereço e caminho real:** URL do frontend Flow, `APP_URL`, `publicBase`, retorno efetivamente emitido e ação usada em `/admin?tab=drive`. Registrar só URLs, nomes de configuração e correspondências; nunca valores de segredos/tokens.
3. **Configuração do Drive:** escopos realmente solicitados e APIs necessárias; onde cliente/segredo/conexão são persistidos e carregados. Mapear todas as fontes para uma troca ou retorno não ser desfeito num restart. Não copiar escopos Agenda/Contatos do Barba & Cabelo para o Flow.
4. **Projeto de destino:** se já existe um projeto dedicado ao Flow, seu ID/número, uso, proprietários, marca e clientes. Sem destino confirmado, não criar nem reutilizar projeto por suposição; o `barba-e-cabelo` não está escolhido como destino.
5. **Domínio e marca Flow:** propriedade verificada de `proh.media` associada ao projeto escolhido, links próprios de Home/Privacidade/Termos, requisitos de verificação/publicação e situação dos escopos do Drive. Não alterar DNS ou IAM nesta leitura.
6. **Dependências e ensaio:** outras conexões/serviços que usem esse cliente, tarefas de fundo do Flow e quais contas Google também têm autorização no Barba & Cabelo. Levantar também as contagens de usuários de login Google e conexões Agenda/Contatos do Barba & Cabelo para comparar o impacto das duas opções. Relatar contagens e sobreposição, sem dados pessoais. Definir um arquivo/pasta de teste isolado e o comportamento funcional esperado.

**Recado para encaminhar ao TI:**

> O cliente Drive já foi identificado como Flow produção; não repetir esse diagnóstico nem a P-69. O dono confirmou manter o Drive e planejar sua migração para projeto dedicado, preservando o cliente atual do Barba & Cabelo. Leia o plano completo e devolva apenas as seis lacunas acima, até onde seu acesso já autoriza. Não crie projeto/cliente, não troque credenciais, não desconecte/revogue contas, não altere Branding/DNS/IAM e não inicie a stack de teste. Não envie segredos ou tokens. A autorização atual é de planejamento; nenhum ambiente deve ser alterado por este levantamento.

## 5. Sequência proposta, após decisão e pacote de execução completo

Estas fases definem o resultado a revisar. **Ainda não há comandos ou autorização para executá-las.** O pacote operacional futuro deve nomear destino, fontes de configuração, cópias de segurança, testes e responsáveis a partir dos dados da seção 4.

| Fase                               | Mudança prevista e condição para avançar                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Preparar                       | Confirmar decisão de continuidade, responsável, escopos e destino. Anotar as listas OAuth/Branding dos dois usos e criar cópia protegida da configuração e conexão Flow; registrar local/data, sem valores no relatório ou Git                                                                                                                                                      |
| 2 — Configurar destino             | Preparar o projeto dedicado, APIs e cliente Web do Flow, com retorno de produção conferido, marca/links corretos e requisitos de domínio/verificação atendidos. Não importar automaticamente retornos de teste ou permissões de outros sistemas                                                                                                                                     |
| 3 — Trocar apenas Flow             | Atualizar suas fontes persistidas de configuração conforme o pacote operacional e obter nova autorização pela conta responsável. Preservar a cópia do conjunto anterior para desfazer; nenhum cliente/segredo do Barba & Cabelo muda                                                                                                                                                |
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

**Devolutiva do TI para preparar esse pacote:** responsável; URLs reais; escopos/APIs; fontes de configuração; projeto de destino conferido; evidência de domínio/marca; dependências/contagens; ensaio de Drive/renovação e plano de retorno. Apenas nomes, estados, URLs e evidências sem credenciais. Na entrega atual foram preparados documentos; nenhuma migração, criação/exclusão de cliente, revogação ou reenvio foi realizado.
