# P-122 — entrada acompanhada pelo servidor, somente local

## Situação real e pedido do titular

O titular pediu que a preparação e a entrada no grupo fossem rápidas e automáticas, sem depender de manter uma página aberta. A conferência administrativa instalada na entrega anterior permanece publicada. Esta entrega nova é local, em ramo de revisão; não foi instalada, publicada ou ativada em produção.

Na consulta real de 16/11, o pedido do cliente autorizado chegou ao B&C às13:18:42 BRT, por dois eventos group.join-request do mesmo grupo. O titular confirmou usar o WhatsApp DDD84 final4593. Havia uma revisão de telefone consentida, ainda em waiting/pending, com consulta autoritativa do candidato já registrada e PN físico diferente do declarado. A operação privada status da Evolution respondeu requestPresent=false. Isso comprova que o pedido ainda não foi reconhecido pelo resolvedor; **não comprova a causa**, que pode ser ausência na listagem, identificação LID sem prova ou identidade diferente. Não afirmar bloqueio da Meta, retirar nono dígito por suposição, aprovar por nome/link ou recriar o grupo.

Nenhuma aprovação, bind, finalize, código, mensagem, novo grupo ou reativação foi executada nesta investigação. A produção foi consultada somente para diagnóstico. O piloto existente não foi pausado nem ampliado.

## Jornada implementada localmente

1. O cliente dá o consentimento na plataforma uma vez. A intenção conserva loja, cliente, telefone, números aprovados e prazo original de20 minutos.
2. O servidor continua o trabalho, mesmo com o navegador fechado. Usa somente intenções persistidas e vigentes do par loja/cliente autorizado.
3. O motor existente prepara grupo/nome/foto/dois administradores/proteções antes de disponibilizar o convite. Não envia boas-vindas nem descrição antes da presença comprovada.
4. O pedido correspondente autoriza as etapas coordenadas de vínculo. Preserva PN/LID, diário, CAS, quórum, grupo, ano e identidade; uma resposta perdida tem recuperação durável, inclusive na passagem de revisão concluída para acesso.
5. Depois da entrada real, o mesmo motor executa acolhimento pelo segundo administrador, descrição, fixação e prova de recebimento. Só a prontidão verdadeira permite solicitar o código.
6. A página somente lê o progresso a cada 3 segundos quando esse modo está habilitado. Não conduz mais os avanços periódicos. A confirmação do telefone ainda exige o OTP; entrar no grupo não significa verificar automaticamente a conta.

Não há envio espontâneo de código de login, alteração automática de preferências ou extensão silenciosa do consentimento. Continuar um primeiro acesso consentido é diferente de iniciar um novo login.

## Componentes novos

- SQL20261116002000: automação desligada por padrão; fila privada, continuação derivada de intenção, progresso e leitura autorizada. Variantes internas conservam os corpos exatos dos contratos atuais, trocando auth.uid por identidade explícita derivada da intenção. Não usam set_config, claims inventados ou JWT de outro usuário. Nenhum papel da API recebe EXECUTE das variantes internas. Wrappers do serviço exigem intenção/posse e revalidam pausa, escopo, perfil, composição e prazo. Os contratos originais e sua identidade permanecem.
- Edge whatsapp-entry-background e orquestrador compartilhado. Endpoint privado, exige o segredo de serviço exato, aceita somente corpo vazio/{} e busca escopo exclusivamente no banco. Máximo 4 candidatos por fila e 4 passagens por chamada; apenas etapas que avançaram podem continuar imediatamente. Falhas conservam diário/posse e retornam revisão; não inventam sucesso.
- Fila de passagem handoff recupera a conciliação já committed sem depender de a resposta ter chegado ao navegador. Não fabrica consentimento e não prolonga o prazo.
- Timer novo bc-primeiro-acesso.timer, separado dos três timers anteriores: intervalo de 3 segundos depois da execução anterior, sem sobrepor a mesma unidade. É configuração preparada, **não instalada nem habilitada**. O tempo real inclui rede/WhatsApp/operações/recibos; 3 segundos não é promessa de conclusão ou entrega.
- Interface reutiliza componentes/cantos/cores e mostra acompanhamento, identificação pendente ou revisão. Textos em quatro dicionários; en-GB herda en-US. Mantém o caminho anterior enquanto o novo modo está desligado.
- Incremental Evolution7-entry.1 de diagnóstico: acrescenta somente contagens de pedidos correspondentes, não resolvidos e outros. Não expõe telefones/LIDs/convites, não aceita campos desconhecidos como prova nem amplia a regra de correspondência. A falha específica atual só pode ser atribuída após a nova observação. O diagnóstico não é um conserto fictício da identidade.

## Segurança e limites

O modo servidor desta entrega exige explicitamente isolamento durável e os IDs exatos do piloto. Remover ou ampliar o escopo bloqueia este worker; não se transforma silenciosamente em automação geral. Distribuição automática e timers antigos não são ligados. Parar o timer/flag impede novos agendamentos; para interromper envios já autorizados usa-se a pausa global existente, revalidada pelo motor antes dos efeitos.

O webhook validado antecipa a próxima consulta quando chega um evento do grupo; ele apenas desperta a intenção, nunca prova identidade ou recebimento. Se esse despertador falhar ou o webhook não chegar, o timer recupera a consulta. Testes cobrem evento sem autenticação e falha após gravação durável.

Os leases originais impedem concorrência entre browser/worker/abas. Uma tentativa de criação incerta não cria outro grupo. Contas excluídas, telefone/perfil alterado, composição diferente, quórum insuficiente, cliente fora do piloto ou janela vencida falham fechados. O serviço não recebe dados de cliente no corpo HTTP. Progresso não é prova de entrega.

## Validação local

- 714 testes do B&C, incluindo jornada do worker da revisão até a passagem de acesso, sem navegador/OTP; tipos, lint, formato e montagem aprovados.
- 66 verificações SQL em PostgreSQL descartável, sempre BEGIN/ROLLBACK. Incluem início de ciclo pelo serviço sem JWT de cliente, conexão recente, posse, pausa, troca loja/cliente, janela vencida, perfil alterado, retomada idempotente, ausência de OTP/verificação silenciosa e grants privados.
- 45composições de interface:3 estados × 3 modos de canto ×320/390/768/1024/1440px, sem corte horizontal/erroJS, rede externa bloqueada. Atualização apenas de leitura, sem avançar grupo, criar ou solicitar OTP. Captura390inspecionada.
- 56 regressões do motor/identidade/revisão/foto da Evolution em container local sem rede, com sockets simulados, mais5testes específicos das contagens. Rotas/webhook não foram alterados; não chamar esse ensaio de teste real de WhatsApp.

A imagem AMD64 de diagnóstico foi construída com TypeScript e tsup aprovados. Índice OCI local434412e1…; configuraçãof342849a…; não são digests publicados. Smoke sem rede confirmou versão7-entry.1, extensão=false e requestStatus no bundle. O hash conjunto da patch+helper é7b70d618826d1d5572e0c719b95186e2be64b56bc3f3c2870a6847e7a8b18c57. O teste específico foi movido para test/, fora dos módulos de produção. Nenhuma imagem foi publicada ou instalada. As quatro regressões SQL anteriores passaram também, com117verificações adicionais; a migration final inteira foi ensaiada atomicamente em base local limpa, com rollback.

Nenhuma medição local de compilação prevê indisponibilidade das instâncias reais.

## Antes de produção

Esta é uma alteração nova: uma SQL, quatro fontes Edge novas e três fontes existentes alteradas, frontend, um timer novo e um incremental de imagem Evolution para diagnóstico. Não estão cobertos pela instalação anterior da conferência administrativa.

A instalação exige janela explícita. Preservar fontes/digests/controles anteriores e backup do banco validado; aplicar SQL em transação única; trocar somente as sete fontes incrementais e reiniciar somente funções; publicar frontend verificado. Para imagem Evolution, fixar digest e preparar retorno para a imagem atual, preservando volumes e configuração. Não usar Redeploy/Restart do serviço inteiro no Coolify. Não reinstalar migrations antigas ou migrations Evolution: este incremental não acrescenta schema Evolution.

As duas unidades passaram em systemd-analyze verify na bancada Linux local; não foram instaladas ou habilitadas.

O timer lê URL pública em /etc/bc-primeiro-acesso.env (BC_ENTRY_URL) e headers em /etc/bc-primeiro-acesso.headers, ambos root:root0600. BC_ENTRY_URL deve ser a rota /functions/v1/whatsapp-entry-background da API existente do B&C, não um domínio arbitrário. Headers devem ser preenchidos no servidor a partir dos segredos já existentes: Authorization Bearer de serviço e apikey, nunca enviados ao chat/arquivo de código. O segredo não vai em argumento de processo. Não cadastrar chave fictícia ou sobrescrever arquivos atuais do serviço.

Habilitar background_access_enabled e o novo timer somente com autorização específica, loja/cliente exatos, intenção válida e demais controles conferidos. Não ligar distribuição ou timers anteriores por conveniência. O diagnóstico do pedido deve anteceder qualquer nova aprovação; o motor continua exigindo identidade comprovada. Primeiro acesso/OTP/login reais permanecem não homologados.

Não encaminhar esta documentação como ordem para a TI desenvolver a lógica. As fontes e ensaios são do Codex; a operação futura é backup/instalação/verificação na janela aprovada. Não há ordem de execução remota nesta entrega e ainda não foi gerado ZIP operacional final.
