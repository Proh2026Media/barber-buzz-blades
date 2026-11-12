# P-121 — mesma conta e telefone em várias barbearias

Pedido do dono em 11/11/2026: cliente já cadastrado em uma barbearia deve poder usar o mesmo número pessoal em outra. Correção local, sem alteração de produção.

O modelo já permite vários vínculos `memberships` de cliente por pessoa, com carteira de pontos por loja. O telefone confirmado pertence ao perfil global; não é exclusivo de uma barbearia. **Não remover a unicidade entre pessoas nem juntar contas silenciosamente pelo telefone.**

A tela de cadastro da loja agora destaca **Usar minha conta do B&C** e explica o uso da mesma conta/WhatsApp. Conserva o e-mail e o destino ao trocar para entrada. Se o serviço de autenticação informa conta já existente, volta à entrada com orientação de recuperação por e-mail. Não consulta a existência de um telefone publicamente.

O retorno do login dá prioridade à barbearia do link atual. Se o destino anterior traz outra loja, descarta o profissional/horário/serviço daquela loja; o cliente confirma o novo vínculo pelo fluxo existente. Entrar na segunda loja não cria outro perfil nem pede outro telefone.

O grupo de atendimento também permite o mesmo telefone da mesma conta em duas lojas, com grupos separados. Ajustado o limite provisório que impediria a segunda adesão na primeira hora: até cinco novos grupos por pessoa/hora, mantendo uma associação por pessoa/loja e não recriando tentativas incertas.

Validação: testes de retorno e teste SQL com a mesma pessoa/telefone confirmado em duas lojas, entrada repetida sem duplicar vínculo, 75 pontos na primeira e zero na segunda, grupo independente e ausência de privilégio profissional. Interface de cadastro/entrada conferida em 320, 390, 768, 1024 e 1440 px.

Contas duplicadas já existentes não foram fundidas nem alteradas. A pessoa deve entrar na conta que já usa; se criou duas identidades distintas, vincular/transferir dados exige prova e procedimento próprio. O teste desta entrega não inspecionou uma conta real nem atribui o problema a um usuário específico.
