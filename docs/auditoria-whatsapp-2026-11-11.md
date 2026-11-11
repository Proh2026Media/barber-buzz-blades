# Auditoria e correções locais do WhatsApp — 11/11/2026

**Escopo aprovado pelo dono: auditar e corrigir localmente, sem publicar nem alterar a produção.** Base `93e3f1ce8b67882dfa314b16e06ab4727fe10ff5`; ramo `auditoria/whatsapp-confiabilidade-2026-11-10`. A migration nº 105 e as funções desta entrega **não estão instaladas na produção**. Não refazer nº 101–104. Nenhuma operação no Flow.

## Incidente: fatos e limites

A [investigação anterior](pacotes/2026-11-10-diagnostico-whatsapp-sessoes.md) já identificou Evolution 2.3.7 e Baileys 7.0.0-rc.9. Esta auditoria reutilizou essas evidências; não fez novos envios, pareamentos nem consultas à produção para reproduzir a restrição.

| Horário de Brasília, 10/11 | Evento                                 | Correlação minimizada                                    | Evidência                                                  | Conclusão permitida                                                                |
| -------------------------- | -------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 22:37:50–51                | Um código com confirmação de entrega   | Número da plataforma; um identificador único             | Três registros da mesma mensagem, incluindo `DELIVERY_ACK` | Um evento entregue; três registros não são três mensagens                          |
| 22:37:52                   | Vínculo removido                       | Instância da plataforma                                  | `401`, `device_removed`                                    | Sessão WhatsApp removida; o erro sozinho não identifica a causa da Meta            |
| 22:43:40–23:03:07          | Falhas ao consultar o painel           | 66 chamadas da interface e 66 recusas do Auth            | `session_not_found`, antes de chamar Evolution             | Falha de sessão B&C distinta da sessão WhatsApp                                    |
| 23:03:18                   | Outra tentativa sem entrega confirmada | Segundo identificador único                              | Somente `PENDING`                                          | Resultado pendente; não afirmar entrega nem rejeição definitiva                    |
| 23:03:20                   | Outra remoção de vínculo               | Mesma instância                                          | `401`, `device_removed`                                    | Nova perda da sessão                                                               |
| 23:10                      | Duas conexões de barbearias abertas    | Números identificados apenas pelos finais no diagnóstico | Estados `open`                                             | Não houve queda simultânea de todos os números                                     |
| 23:16                      | Captura do aplicativo WhatsApp         | Relato do titular; imagem sem telefone visível           | Restrição temporária e contador                            | Restrição da conta confirmada naquele momento; não é prova de banimento permanente |

Seis desafios de autenticação no B&C não equivalem a seis transmissões. Faltam registros anteriores de correlação entre clique, pedido HTTP e tentativa externa para reconstruir todos os pedidos. A informação disponível é compatível com um código recebido. **Não é possível determinar o critério interno da Meta nem atribuir a restrição a um bug específico corrigido aqui.** O contador da captura não informa a situação atual da conta.

Referências conferidas na investigação: [contas restringidas](https://faq.whatsapp.com/717472490411581?locale=pt_BR), [uso responsável](https://faq.whatsapp.com/361005896189245/?locale=pt_BR) e [diagnóstico do Baileys](https://github.com/WhiskeySockets/docs/blob/main/advanced/troubleshooting.mdx). Baixo volume e avisos esperados não garantem ausência de restrição em integração não oficial.

## Caminhos reais de envio

| Origem                                            | Entrada                                                                                      | Autorização e persistência                                                            | Saída após a correção                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Login por WhatsApp, inclusive link de agendamento | `auth-otp`, `whatsappLogin`                                                                  | Número pessoal confirmado; desafio e limites atômicos                                 | Autorizador comum; número exclusivo da plataforma                         |
| Confirmação do telefone de uma conta              | `auth-otp`, `handleVerifyPhone`                                                              | Sessão válida, destinatário e conta ligados ao desafio                                | Mesmo autorizador; nunca outbox da barbearia                              |
| Recuperação de senha                              | `auth-otp`                                                                                   | Loja ativa, número pessoal confirmado; vínculo conferido novamente ao consumir código | Mesmo autorizador; remetente da plataforma                                |
| Cadastro do dono                                  | `register-shop`                                                                              | Desafio `signup`; prova do código antes de abrir a conta                              | Mesmo autorizador; remetente da plataforma                                |
| Confirmação, alteração, cancelamento e lembrete   | Funções SQL de agendamento → outbox → cron                                                   | Evento, destinatário, preferências e chave única no banco                             | `whatsapp-dispatch` → autorizador → Evolution                             |
| Avisos manuais e comunicações de retorno          | `deliver_client_notice`, `process_pending_client_notices`, `process_whatsapp_return_notices` | Consentimentos, finalidade, orçamento e deduplicação existentes                       | Mesma outbox e mesma conferência final                                    |
| QR, código de pareamento e estado da conexão      | `platform-whatsapp`, `whatsapp-channel`                                                      | Permissões administrativas/da loja e controles de pareamento existentes               | Somente administração de instâncias; cliente genérico não envia mensagens |

Não foi encontrado outro emissor de WhatsApp em `src`, `supabase/functions` ou scripts operacionais do repositório. Não há recebedor de comprovantes de entrega, webhook de mensagens recebidas nem emissor de IA implementado nesta integração. E-mail e Agenda Google têm despachantes próprios; não comprovam posse do telefone.

## Achados e correções

Não foi demonstrada exploração P0. Correções P1:

1. **Limites não atômicos e separados por finalidade** em `auth-otp/index.ts` e `register-shop/index.ts`: contagens HTTP podiam falhar como zero e pedidos simultâneos não tinham espera uniforme. Agora o gatilho `guard_whatsapp_otp_request` serializa a criação no PostgreSQL: 60 segundos entre pedidos, três por destino em 15 minutos, seis confirmações por conta/hora. O limite por conta vale somente para confirmação autenticada, para não diferenciar número conhecido/desconhecido no login. A capacidade global de pedidos é configurável e começa em 120/hora.
2. **Verificador de seis dígitos sem segredo:** substituído por HMAC-SHA-256, com `WHATSAPP_OTP_HMAC_KEY` exclusiva do servidor e geração sem viés por amostragem por rejeição. Ausência de chave bloqueia a geração; nenhum retorno para hash fraco. Conta, telefone, finalidade e loja integram o contexto aplicável.
3. **Emissores diretos sem pausa comum nem diário de tentativa:** todos passam por `_shared/whatsapp-send.ts`, `authorize_whatsapp_send` e `finish_whatsapp_send`. O transporte de administração só aceita rotas de instância. Pedido, desafio, tentativa e identificador do provedor têm referências distintas. O corpo/telefone de avisos vem do banco; códigos nunca vão para a outbox legível pela loja.
4. **Repetição de pedido HTTP:** `request_id` possui unicidade no banco e é enviado pelas telas de código. Repetir o corpo não substitui o código ainda válido, inclusive depois dos 60 segundos. Clientes antigos sem identificador continuam sujeitos à espera e ao limite atômicos; deduplicação por identificador depende da retenção do desafio.
5. **Código invalidado após timeout no login:** não invalidar silenciosamente um código que pode ter chegado. Resultado desconhecido não provoca retry nem troca de remetente. Nova solicitação explícita, após os limites, substitui o desafio da mesma conta/finalidade/loja; o código anterior é invalidado.
6. **Worker abandonado ou antigo:** posse por cinco minutos, identificador de posse e verificação antes da transmissão. Só trabalho sem licença de transmissão pode ser recuperado. Licença persistida, processo morto ou resposta perdida conservam incerteza e impedem repetição. A conferência de consentimento/evento ocorre depois da leitura de conexão, imediatamente antes da chamada externa.
7. **Pausa incompleta:** global, número da plataforma ou número cadastrado, com motivo, responsável e histórico. Vale para todos os vínculos do número. Trabalho pausado não esgota seu orçamento de tentativas. Três resultados desconhecidos em 15 minutos interrompem novas transmissões daquela conta até revisão manual; não são apresentados como prova de banimento.
8. **Telefone não confirmado usado como alternativa de compatibilidade:** removida a busca antiga sem `whatsapp_verified_at` na recuperação. Vínculo e impedimento de acesso são novamente conferidos antes da sessão. Pedido de código não liga avisos por omissão do campo de preferência; marketing continua dependendo do consentimento específico existente.
9. **Avisos sem evento ou envelhecidos:** a conferência final descarta referência de agendamento que deixou de existir e aviso vencido há mais de 24 horas de sua data programada, além dos cancelamentos/alterações já tratados.

Correções P2: painel **Pausas e acompanhamento**, aceites separados de resultados desconhecidos, mensagens de código sem promessa de entrega, estado incerto em confirmação/cadastro, normalização e espera de 60 segundos no acesso pelo link do agendamento, bloqueio síncrono de cliques repetidos. Dicionários pt-BR, pt-PT, en-US/en-GB e es atualizados. Identidade e modos de canto preservados.

## Estados e controles operacionais

- Pedido/challenge não é mensagem. `whatsapp_send_attempts` só nasce ao conceder a licença final, antes de transmitir. Mesmo assim, um processo pode morrer entre licença e transmissão: esse caso é conservadoramente desconhecido.
- `started` significa licença em andamento; após dois minutos sem resultado, `unknown`. `accepted` exige identificador do provedor, não confirmação de entrega. Resultado tardio desconhecido não regride um aceite registrado.
- A outbox conserva seus estados legados por compatibilidade: `sent` representa aceite, e `failed` pode representar descarte, expiração ou incerteza, conforme motivo/diário. Não introduzimos um estado fictício de entrega. Não há consumidor de recibos que possa atualizar `delivered` de modo confiável.
- Uma transmissão por instância em andamento, lote de até cinco avisos e capacidade inicial de cinco transmissões/minuto/instância. Valores são controles internos de capacidade; não são limites oficiais nem técnica contra banimento. Ajustes de capacidade ficam em `whatsapp_send_policy`, restrita ao serviço.
- Preferências e consentimentos são conferidos ao enfileirar e antes da transmissão. Pausa global conserva a fila pendente. Desativação/descadastro continua pelas configurações de perfil/cliente já existentes; não há leitura automática de respostas “pare” sem um recebedor de mensagens. Não afirmar o contrário.
- Pausa e licença usam a mesma trava no banco. Depois da licença, uma chamada em voo ainda pode terminar; nenhum controle promete recolher uma mensagem já transmitida.
- Retenção: diário sem conteúdo/telefone por 30 dias, exceto aviso ainda pendente/em processamento; histórico de pausas por 180 dias. Limpeza acionada no cron existente. Desafios mantêm a limpeza já existente. Logs de transmissão mostram somente tentativa, estado e confirmação da gravação.
- A trilha de tentativas começa na instalação; não reconstrói transmissões antigas. Avisos antigos em `sending`, sem posse da versão nova, permanecem bloqueados para conferência na janela. Não transformar ausência de registro antigo em certeza de que não houve envio. O roteiro da TI contém a consulta agregada desses registros.

## Verificação local

Testes de unidade/handlers incluem HMAC, segredo ausente, limites/pausa, proteção do remetente, timeout, resposta sem identificador, falha na gravação do aceite e preservação da resposta genérica do login. SQL cobre autorização, consentimento retirado, vínculo entre empresas, expiração, finalidade/canal errado, repetição tardia, posse vencida, processo abandonado, pausa e interrupção de falhas persistentes.

`scripts/testar-whatsapp-concorrencia.py` cria e apaga um container exclusivo com dados fictícios. Duas conexões reais disputam pedido, consumo, job e licença; no máximo uma consegue cada efeito. Não chama Evolution. A suíte SQL roda transações com rollback em `barba-db-local`.

Playwright com todas as chamadas do sistema respondidas por dados fictícios: pausa global/por número, erro sem falso sucesso, clique duplo, foco por teclado, texto ampliado; 360/390/768/1024/1440 px, dois temas e três modos de canto. Emulação de navegador não equivale a homologação física em iPad/celular.

Os resultados finais e comandos executados estão registrados na entrada de 11/11 do [CONTINUIDADE](CONTINUIDADE.md). Roteiro concreto para posterior implantação: [TI — saída protegida](pacotes/2026-11-11-ti-whatsapp-saida-protegida.md).

## O que permanece externo

1. Autorizar uma janela de implantação e configurar o segredo de HMAC, sem enviá-lo por conversa. Publicação não autorizada nesta entrega.
2. Titular/TI confirmar a situação atual da conta no aplicativo WhatsApp. O provedor não oferece aqui sinal confiável da restrição exibida no aparelho; registrar pausa manual quando houver restrição informada.
3. Homologar o pacote instalado com autorização separada para qualquer mensagem de teste e com destinatário controlado. Não retomar pela contagem de tempo da captura.
4. Recibos automáticos, recebimento/descadastro por mensagem e eventual API oficial exigem integração e decisão próprias. Nenhuma infraestrutura ou assinatura foi contratada. Não foi inventada assinatura de webhook nem reconciliação automática.

Abuso de endpoint público e a decisão da Meta não são eliminados por esta correção. Limites distribuídos reduzem repetição/capacidade; autenticação por WhatsApp continua dependente do serviço. Google e e-mail já configurados permanecem alternativas de acesso, sem marcar telefone como confirmado.
