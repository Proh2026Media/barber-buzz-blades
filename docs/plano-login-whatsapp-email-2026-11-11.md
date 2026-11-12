# Preparação do login no grupo exclusivo e alternativa por e-mail

**Continuação implementada em 11/11:** [adesão provisória, confirmação no grupo e contrato protegido v2](pacotes/2026-11-11-p120-primeiro-acesso-grupo.md). Os itens de primeiro acesso do cliente, múltiplos números e rota de envio agora foram ensaiados localmente. Nº 109 não instalada; flags desligadas. Permanecem isolamento/piloto, alternativa do cadastro público de nova barbearia e comunicação geral. Histórico anterior abaixo não significa que as partes entregues devam ser refeitas.

Data: 11/11/2026. P-120. Destinatário: desenvolvimento do Barba & Cabelo.

**Implementação parcial local em 11/11/2026:** [entrega e verificações](pacotes/2026-11-11-p120-login-grupo-local.md). A restrição de participantes, autorização de login de grupo, bloqueio de OTP privado e alternativa por e-mail já estão no código e foram ensaiados. O plano abaixo permanece como matriz de aceite completa; não está concluído. Faltam primeiro acesso, confirmação inicial do telefone, rota protegida na extensão e homologação/isolamento antes de ativar.

Nenhum comportamento ou dado real foi alterado. Nº 105–108 não instaladas e chamada real de envio bloqueada. Esta etapa local não deve ser publicada isoladamente: a confirmação inicial do telefone ainda precisa ser adaptada ao grupo. Não há código por e-mail; a alternativa reutiliza e-mail/senha e recuperação por link.

## 1. Escopo definido

| Tema                           | Regra para implementar                                                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Participantes                  | Exatamente um cliente e o conjunto de números autorizados e controlados pela plataforma para aquele grupo. Nenhum número pessoal de dono, barbeiro ou funcionário.                                          |
| Código de login                | Somente no grupo exclusivo validado. Nunca por mensagem privada, pelo número pessoal do profissional ou em grupo de outra pessoa.                                                                           |
| Remetente                      | Número autorizado para autenticação, escolhido no servidor entre os números da plataforma presentes no grupo. Sem rodízio automático de autenticação.                                                       |
| Acesso às conversas            | Sem leitura de conversas/códigos pelos profissionais no B&C, na Evolution, em aparelhos pareados, logs, exportações ou painéis. Ser administrador de uma loja não concede acesso à instância da plataforma. |
| Conta global                   | A autenticação continua sendo da pessoa, não da barbearia. O destino deve estar vinculado à mesma conta/telefone confirmado do desafio.                                                                     |
| E-mail alternativo             | Ação explícita do usuário. Primeira versão reaproveita e-mail/senha e recuperação por link existentes. Código de login por e-mail exige desenvolvimento separado.                                           |
| Sem grupo seguro               | Nenhum envio de código por WhatsApp. Oferecer e-mail, sem criar grupo nem adicionar cliente silenciosamente durante uma tentativa anônima de login.                                                         |
| Horário                        | Login solicitado pela pessoa pode funcionar em qualquer horário, sujeito às pausas e limites. Sem fila noturna que mande códigos horas depois.                                                              |
| Compartilhamento               | Preservar P-119: um número da plataforma pode atender várias barbearias, com grupos e destinatários isolados. Não foi adotada a exigência do anexo de três números exclusivos e um reserva por loja.        |
| Restrição ou resultado incerto | Pausar, não repetir automaticamente e não trocar de número para contornar a restrição. E-mail permanece alternativa.                                                                                        |
| Comunicação                    | Avisos e marketing continuam sujeitos ao consentimento e às cotas próprias. Não condicionar acesso à conta ao aceite de marketing.                                                                          |
| Apresentação                   | Mensagem clara do B&C, código íntegro, validade real e aviso de não compartilhar. Sem erros propositais, reações, simulação de digitação ou atrasos para aparentar atendimento humano.                      |

O anexo `logica-envio-codigo-login-whatsapp-2026-11-11 5464567.md` (v7, arquivo local com espaço final) permanece referência. A autorização para código no grupo não adota automaticamente rodízio, proxies, números exclusivos por loja, reações ou aleatoriedade desse anexo.

## 2. Base da preparação e mudanças planejadas (histórico)

| Base local conferida                                                                                                                                                       | Mudança necessária                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [login.ts](../supabase/functions/auth-otp/login.ts): login global, seis dígitos, validade de 10 minutos, reenvio informado de 60 segundos, cinco tentativas de verificação | Resolver e vincular destino de grupo no servidor. Preservar validade, limites, consumo único e verificação do titular.                                                    |
| [auth-otp/index.ts](../supabase/functions/auth-otp/index.ts): envio individual pela plataforma                                                                             | Substituir o caminho de login por envio protegido ao grupo; validar `channel` antes do ramo de login. Não apenas trocar telefone por JID no payload.                      |
| [whatsapp-send.ts](../supabase/functions/_shared/whatsapp-send.ts): saída autorizada, tentativa persistida, pausa e resultado incerto                                      | Acrescentar destino de grupo tipado e autorização específica, mantendo os guardas e sem aceitar destino/texto arbitrários do navegador.                                   |
| [whatsapp-groups.ts](../supabase/functions/_shared/whatsapp-groups.ts): política aceita `approvedPhones` e inclui equipe                                                   | Impedir inclusão/aprovação de profissionais, revisar admissão/remoção e exigir apenas cliente + números autorizados.                                                      |
| [integração de grupos](pacotes/2026-11-11-bc-integracao-grupos-local.md): criação, convite, admissão, encerramento e recuperação                                           | Reutilizar o ciclo e o diário persistente; adaptar permissões, remover proposta de participante profissional e impedir reutilização de grupo antigo sem nova conferência. |
| [migration nº 105](../supabase/migrations/20261110230000_whatsapp_saida_protegida.sql): limites atômicos e HMAC                                                            | Reaproveitar. Não recriar as mesmas proteções; nova regra de destino deverá entrar em migration posterior à nº 107.                                                       |
| [WhatsAppLogin.tsx](../src/features/auth/WhatsAppLogin.tsx): telefone/código/reenvio                                                                                       | Explicar recebimento no grupo e oferecer **Usar e-mail** sem fechar e procurar outra entrada manualmente.                                                                 |
| [auth.tsx](../src/routes/auth.tsx): e-mail/senha e recuperação por link                                                                                                    | Reaproveitar como alternativa e como acesso inicial para preparar a adesão ao grupo. Não apresentar recuperação de senha como OTP de e-mail.                              |
| [login.test.ts](../supabase/functions/auth-otp/login.test.ts): resposta genérica e proteção da conta                                                                       | Estender para grupos, preservando ausência de enumeração e testes de conta/telefone alterado.                                                                             |

As migrations nº 105, 106 e 107 continuam locais/não instaladas. A extensão Evolution local ainda não tem uma rota aprovada de envio de OTP ao grupo. A ativação não pode ocorrer só por alteração de variável de ambiente.

## 3. Sequência de implementação

### A — tornar os grupos estritamente exclusivos

1. Eliminar do fluxo de grupos a proposta, aprovação e inclusão de profissionais. Revogar os acessos correspondentes também nas RPCs/RLS, não apenas ocultar os botões.
2. Manter números da plataforma em cadastro próprio, com instância, identidade e autorização comprovadas. Um telefone pertencente a um usuário com papel administrativo não vira automaticamente número da plataforma.
3. Tratar qualquer profissional anteriormente aprovado como incompatível com autenticação. Bloquear OTP até remoção confirmada e nova leitura de participantes. Preservar histórico e não remover pessoas de grupos reais nesta fase local.
4. Cliente não pode administrar nem autorizar terceiros. Conferir controles de adição/admissão, administrador da plataforma, identidades PN/LID e ausência de participantes desconhecidos/duplicados.
5. Remover das telas e políticas a leitura de ficha/conversa por profissional. O painel de operação exibe estados e falhas sanitizadas, nunca códigos ou corpo das conversas.
6. Rever exportações, permissões das instâncias e captura de mensagens recebidas. OTP enviado pela própria plataforma não deve ser reingerido e guardado como conversa. Não implementar detector de pedido de código por palavras-chave nesta entrega.

### B — resolver o grupo e emitir o desafio

1. Pedido começa no app, com referência estável de idempotência. O navegador não escolhe o JID, remetente, destinatário efetivo nem conteúdo.
2. Resolver no servidor a conta pelo número pessoal confirmado e o grupo elegível dessa mesma pessoa. No contexto de loja, usar somente o vínculo correspondente. Na entrada global, adotar um vínculo elegível definido no servidor com regra estável; sem vínculo elegível, oferecer e-mail. Não transmitir a vários grupos.
3. Vincular o desafio ao titular, telefone, finalidade, grupo, versão da composição e instância remetente. Alteração de telefone, vínculo, composição ou encerramento invalida a autorização de envio e deve impedir uso indevido de código antigo.
4. Autorizar uma única tentativa persistente antes de chamar o provedor. Repetir o mesmo pedido não manda novo código. Resultado incerto não gera outro envio nem fallback privado.
5. Resposta pública não revela existência de conta/grupo, barbearias associadas, e-mail ou motivo individual da indisponibilidade. Mensagem sugerida: **Se receber o código no seu grupo do B&C, digite abaixo. Se não chegar, use o e-mail.**
6. Validar `purpose` e `channel`: pedido declarado como e-mail não pode iniciar envio por WhatsApp. Prazo de reenvio/validade na tela deve vir do contrato do servidor, com compatibilidade validada.

### C — conferir e enviar no provedor

1. Criar contrato de envio específico de OTP de grupo, separado das rotas de administração de grupos e do envio individual existente. Credenciais somente no backend; rota fechada para navegadores e operadores de loja.
2. Conferir no provedor, imediatamente antes do envio, o ID imutável, a composição exata, o cliente presente, o remetente autorizado e os controles. Não usar nome/descrição do grupo como identidade nem somente um webhook/snapshot antigo.
3. Serializar envio e mutações de participantes controladas pela plataforma para a mesma instância/grupo; revalidar versão no banco antes de autorizar. Mudança de membros, identidade ambígua ou leitura incompleta bloqueia o código.
4. Persistir chave da operação e resultado; timeout após início permanece desconhecido e não pode ser repetido cegamente. Aceitação pelo provedor não significa entrega ao cliente.
5. Revisar todos os pontos de envio de código: login, confirmação de WhatsApp, cadastro e recuperação. O produto não pode anunciar **código somente no grupo** enquanto algum desses caminhos ainda envia códigos privados. Em caminho ainda não adaptado, oferecer o meio alternativo existente e não enviar WhatsApp.
6. Não prometer atomicidade entre consulta de membros e envio externo: WhatsApp e banco não formam uma transação. A liberação exige testar mudanças concorrentes e demonstrar que as contas administrativas/instâncias usadas não podem ser operadas por profissionais. Incerteza sobre esse isolamento bloqueia o piloto de OTP.

### D — primeiro acesso, entrada global e alternativa por e-mail

1. Quem ainda não possui grupo acessa pela alternativa já existente (e-mail/senha, recuperação ou Google). Preparar a adesão numa sessão autenticada; não depender de OTP no grupo para criar o próprio grupo.
2. Convite é apresentado no app autenticado. Entrar no grupo não autentica automaticamente no B&C nem confirma sozinho a vinculação de um telefone a uma conta. Conferir identidade e aplicar desafio de confirmação vinculado à sessão/titular quando necessário.
3. Se o cadastro atual exigir código privado para chegar a essa etapa, adaptar o cadastro antes da liberação; testar usuário inteiramente novo, não apenas contas com WhatsApp já verificado.
4. Administrador sem barbearia/grupo continua com e-mail/Google. Cliente com várias lojas recebe em um único grupo elegível, nunca em todos. Não criar barbearia fictícia para viabilizar o login.
5. **Usar e-mail** fecha a janela WhatsApp e foca o formulário existente, preservando o e-mail que a pessoa digitou e o destino autorizado após login. Não descobrir e-mail a partir de telefone anônimo.
6. Ignorar respostas tardias após trocar de método/conta ou fechar a janela. Novo login não pode substituir uma sessão de outra pessoa iniciada durante a espera.
7. Código por e-mail é desenvolvimento separado: verificar contrato/modelos do Supabase Auth, impedir cadastro automático indevido, testar expiração/consumo/limites com SMTP fictício. Não afirmar que já está implementado.

Textos novos passam pelos cinco idiomas. Aplicar componentes MB, foco/teclado, toque de 44 px, temas e três modos de canto. Não redesenhar toda a tela de entrada.

### E — limites, auditoria e aceite

Reutilizar as travas da nº 105: intervalo de 60 segundos, três pedidos em 15 minutos, teto global configurável e proteções adicionais de confirmação pessoal. O teto de dez pedidos diários do anexo não está implementado e não deve aparecer como existente. Não confundir limite operacional com garantia contra restrição.

Registrar referências internas de desafio/tentativa/grupo, estado e motivo sanitizado com acesso restrito. Não registrar código, token, texto, credencial ou contato completo. Logs, histórico de loja, exportações e recibos não podem expor o código. Manter consentimento e cotas de marketing separados de autenticação.

## 4. Matriz de aceite

| Cenário                                                                       | Resultado obrigatório                                                                        |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Cliente + conjunto exato de números autorizados                               | Um único envio no grupo correto, por remetente autorizado.                                   |
| Profissional, terceiro, administrador externo ou identidade desconhecida      | Bloqueio de OTP, sem envio privado.                                                          |
| Cliente ausente, grupo encerrado, controles ausentes ou metadata indisponível | Bloqueio e alternativa de e-mail.                                                            |
| Alteração de participantes entre leitura e envio                              | Teste de concorrência, pausa/invalidação; nenhuma promessa de segurança baseada só em cache. |
| Nome do grupo alterado                                                        | Associação conservada pelo ID, sem busca por nome.                                           |
| JID de outro cliente/loja injetado no pedido                                  | Ignorado/recusado; destino resolvido no servidor.                                            |
| Duas lojas compartilham um número                                             | Isolamento dos grupos/desafios preservado; nenhum envio ao grupo errado.                     |
| Novo cadastro, sem grupo ou WhatsApp confirmado                               | Acesso alternativo e adesão sem dependência circular nem código privado.                     |
| Administrador sem loja; cliente com vários grupos                             | E-mail quando não houver grupo; no máximo um grupo elegível por pedido.                      |
| Timeout, pedido repetido e duas abas                                          | Sem repetição automática, consumo único e limites no servidor.                               |
| Código vencido/usado; telefone alterado; conta bloqueada                      | Sessão recusada.                                                                             |
| `channel=email` ou inválido                                                   | Nenhum envio por WhatsApp.                                                                   |
| Profissional tenta consultar conversa, convite, código ou operação            | Acesso recusado no backend, não apenas na tela.                                              |
| Login após meia-noite                                                         | Sem fila matinal; respeita pausa/limites e oferece alternativa.                              |
| 320, 390, 768, 1024 e 1440 px                                                 | Sem cortes; foco, teclado, temas, cantos e retorno consistentes.                             |

Verificar testes direcionados, `scripts/verificar.sh`, Deno, SQL local descartável e ensaio integrado com provedor fictício. Incluir regressão de todos os emissores de OTP. Depois, piloto real somente com aprovação e conta de teste; nenhum envio real nesta preparação.

## 5. Próxima entrega e instalação

O próximo trabalho é **do desenvolvimento**: concluir D (primeiro acesso/confirmar telefone no grupo), C (contrato da extensão/isolamento) e E (ensaio integral). A e B têm implementação local descrita na entrega vinculada no topo. Não há nova tarefa TI agora.

Manter grupos/OTP de grupo desativados até concluir o conjunto. Não publicar a mudança parcial que remove o privado sem oferecer um caminho de acesso funcional. A nº 108 está escrita e testada localmente, posterior à nº 107 e não substitui a migration própria da extensão Evolution. Nº 101–104 não devem ser reaplicadas.

Preparar pacote de implantação com commits, hashes, ordem, backup, medição de indisponibilidade, ensaio e reversão. Imagem, migrations, recriação, webhook e piloto permanecem etapas de produção separadas da autorização local. Reversão mantém pausas e provas de tentativa, desativa OTP de grupo e conserva o acesso alternativo; **não restaura envio privado silenciosamente**.

## 6. Verificação da preparação inicial (histórico)

Anexo lido integralmente e contratos locais citados conferidos. Documento define decisões, alterações, dependências e critérios; funcionalidades e testes novos ainda pendentes. Nenhum código funcional, dado real, VPS, Flow, grupo ou mensagem foi alterado. A revisão inicial da documentação passou na verificação geral (552 testes, tipos, formatação e montagem); isso não valida funcionalidades futuras. A versão final deste plano é conferida quanto a referências, formatação e diferença de arquivos.
