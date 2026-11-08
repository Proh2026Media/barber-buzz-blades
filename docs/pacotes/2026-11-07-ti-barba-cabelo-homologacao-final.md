# TI — Homologação final do Barba & Cabelo (P-40 a P-43)

Preparado em **07/11/2026**, após o dono pedir a execução das pendências e autorizar as melhores decisões. Este pacote reúne os testes reais que a bancada local não comprova. Destinatário: **TI/Guardião**, com o dono para acesso aos aparelhos e contas quando necessário.

## Recado para encaminhar

> TI, execute este roteiro do **Barba & Cabelo** usando somente as lojas e contas de teste e os destinatários controlados por vocês. Aproveite a estrutura existente; não recrie as lojas nem repita as implantações já concluídas. Faça os casos disponíveis e devolva um único relatório, indicando os que passaram, falharam ou não puderam ser executados. Senhas, códigos, tokens e dados de clientes não entram no relatório. A P-28 do Flow continua no roteiro já recebido e não é executada por este pacote.

## 1. Preparação e limites do ensaio

1. Conferir a versão publicada do B&C com a entrega que acompanha este pacote. Anotar commit e horário da conferência. Se a implantação da entrega ainda estiver em curso, aguardar sua conclusão antes dos casos afetados.
2. Confirmar que a Loja Teste e a Loja Teste B continuam destinadas a testes. Endereços: `https://loja-teste.beauty.contheiner.digital` e `https://loja-teste-b.beauty.contheiner.digital`. A consulta inicial é somente de leitura; não criar cópias se já existirem.
3. Conferir os vínculos atuais. O registro de 13/10 informa a Loja Teste B criada pelo `parceiro@loja-teste.invalid`, e `dono@loja-teste.invalid` posteriormente vinculado como Contratado na B. A tabela de criação do roteiro antigo menciona `dono-b`, mas não deve ser usada como retrato da produção atual.
4. Reutilizar as contas `@loja-teste.invalid` existentes quando adequadas. Credenciais permanecem no gerenciador do dono/TI; no Mac do dono, o serviço registrado é **Barba e Cabelo - Loja Teste**, com a conta identificada pelo e-mail. Não solicitar senha em chat ou incluir valores em comandos/relatórios visíveis.
5. Para WhatsApp, e-mail e Google reais, usar número, caixa de e-mail e conta Google de teste sob controle do dono/TI. O roteiro original com `.invalid` não envia e-mail e exclui explicitamente essas integrações; ele sozinho não encerra P-42. Se não houver um destinatário controlado, registrar o caso como **não executado — falta destinatário de teste**.
6. Para ações administrativas, usar uma sessão administrativa já autorizada e limitar as alterações às lojas de teste. Não conceder administração global às contas `.invalid` apenas para facilitar o ensaio. Se a conta necessária não estiver disponível, informar qual papel falta, sem pedir a credencial no relatório.
7. Manter uma lista privada dos registros criados nesta rodada: conta, loja, atendimento, evento Google e arquivo. Usar nomes que indiquem teste e data. Ao finalizar, remover apenas esses registros ou desfazer os ajustes anotados. Não tocar nas lojas Arena, Externa ou em dados de clientes reais.
8. **Esta entrega não traz migration.** Não reaplicar migrations anteriores, recriar proxy, reiniciar a VPS nem executar Redeploy do Supabase. A homologação confere a interface e os contratos existentes.

Os passos de criação, certificado e limpeza integral de [testes-reais-loja-teste.md](../testes-reais-loja-teste.md) são referência histórica. Não executar a limpeza integral ao concluir esta rodada: ela apaga a estrutura de testes acumulada. Certificados das lojas já têm rotina automática.

## 2. Acesso e troca de áreas — P-40

Usar sessões separadas por conta. Nas mudanças de usuário, sair e entrar de fato; não reutilizar uma sessão com outro nome na tela. Caso a combinação de papéis não exista, preparar somente o vínculo necessário entre contas e lojas de teste, anotando o estado anterior para restauração.

| Caso                                  | Passos                                                                                                                                                                                 | Critério de aceite                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A1 — Administrador no domínio da loja | Abrir `/platform` no domínio da Loja Teste com a sessão administrativa, sem editar outras lojas. Repetir a navegação de um admin sem vínculo de loja, se houver essa conta disponível. | Direcionamento para o endereço principal; administração acessível sem exigir uma loja; nenhuma permissão de dono inventada.                |
| A2 — Uma pessoa, dois papéis          | Com conta que é Dono na A e Contratado na B, alternar “Minhas áreas” e loja. Conferir Agenda, Ajustes e ações permitidas em cada contexto.                                             | Nome e loja corretos; permissões da A não permanecem na B; dados da loja anterior não ficam visíveis.                                      |
| A3 — Duas lojas como dono             | Com conta que tenha os dois vínculos, trocar A → B → A e recarregar.                                                                                                                   | Abre a loja escolhida, com agenda e configuração correspondentes; nenhum vínculo extra criado.                                             |
| A4 — Cliente de duas lojas            | Abrir a conta do cliente nas duas lojas e alternar pelo seletor.                                                                                                                       | Loja selecionada e seus agendamentos corretos; a troca mantém o comportamento de domínio aprovado para o produto.                          |
| A5 — Endereço de outra loja           | Entrar pelo domínio A com vínculo de trabalho apenas na B e abrir a área profissional.                                                                                                 | A orientação sobre a loja correta aparece; o painel não concede acesso de trabalho à A.                                                    |
| A6 — Link de horário                  | Na página pública, escolher horário, entrar e chegar à confirmação.                                                                                                                    | Serviço/dia/horário preservados quando disponíveis; nenhum agendamento criado antes da confirmação; indisponibilidade posterior explicada. |

Não criar artificialmente um `shop_admin` legado para repetir um papel em desuso. Se existir uma conta de teste desse tipo, verificar seu acesso; caso contrário, registrar **não aplicável ao inventário atual**, mantendo a cobertura automatizada do papel legado separada da evidência real.

## 3. Sociedade 50%/50% — complemento da P-41

Os ensaios de dono 100%, sociedade 70/30, matriz do Contratado, bloqueios sem informação de colegas e saída do Contratado já possuem resultados de 13/10. Repetir apenas se uma alteração desta entrega afetar o fluxo ou se surgir falha.

1. Na loja de teste, anotar modo de sociedade, percentuais e ajuste escolhido. Usar configuração 50%/50% pelo fluxo normal do sistema, com as aprovações exigidas.
2. Pelo dono A, solicitar alteração reversível de Agendamento. Antes de salvar, conferir indicação de aprovação; depois de enviar, o valor vigente continua igual para ambos.
3. Pelo dono B, recusar. Conferir que o valor vigente não mudou e o pedido deixou de estar pendente.
4. Solicitar novamente e aprovar pelo dono B. Conferir aplicação única e mesmo valor nas duas sessões após atualização.
5. Solicitar convite para uma conta de teste nessa sociedade. Antes da aprovação, tentar entrar pela conta convidada: não deve ganhar acesso de equipe antecipadamente. Aprovar e conferir vínculo, papel, senha obrigatória quando aplicável e boas-vindas da loja correta.
6. Restaurar o ajuste e a configuração de sociedade anotados, também pelo fluxo normal. Não alterar tabelas diretamente para saltar aprovações.

**Aceite:** nenhuma alteração/entrada antecipada; recusa preserva o estado anterior; aprovação aplica exatamente o pedido correspondente; cada papel recebe apenas suas ações.

## 4. Cadastro e integrações reais — P-42

| Caso                          | Passos                                                                                                                                                                                       | Critério de aceite                                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1 — WhatsApp                 | No número de teste controlado, enviar código, confirmar, testar reenvio e entrar/recuperar acesso pelo fluxo disponível. Conferir também a preferência de receber avisos.                    | Mensagem recebida no número correto; código válido funciona; repetição respeita bloqueios; preferência não é alterada por tentativa ou recuperação.                                                       |
| I2 — Cadastro de cliente      | Cadastrar uma conta descartável no endereço da loja de teste e concluir o fluxo, inclusive os termos conforme a escolha feita.                                                               | Conta e vínculo na loja correta; sem cadastro em loja alheia; primeiro acesso e perfil funcionam após recarregar.                                                                                         |
| I3 — Cadastro de dono         | Com conta de teste, concluir cadastro de loja nova em endereço de teste livre; também conferir “Entrar e abrir minha barbearia” quando o e-mail já possui conta.                             | Uma conta e uma loja correspondentes à confirmação; dono inicial correto; erro não deixa ação presa nem duplica a solicitação. Registrar a loja nova para limpeza controlada.                             |
| I4 — Senha, termos e chegada  | Usar convite novo de teste. Trocar a senha temporária e observar termos/boas-vindas. Repetir saída/troca de conta durante uma leitura.                                                       | Sequência correta, sem janelas sobrepostas; senha anterior não permite entrar; campos e retornos antigos não aparecem na conta seguinte; “Agora não” segue a regra vigente dos termos.                    |
| I5 — Google Agenda            | Conectar Google de teste; selecionar uma agenda de teste; criar evento fictício nela e conferir importação. Criar agendamento fictício B&C e conferir cópia na agenda escolhida.             | Eventos da conta e agenda corretas, sem acesso por colega/cliente indevido e sem duplicação nas sincronizações subsequentes.                                                                              |
| I6 — Desconectar Google       | Desconectar apenas a integração B&C da conta Google de teste. Conferir o estado no app e a revogação do acesso concedido ao B&C.                                                             | Conexão deixa de funcionar como ativa; não revogar clientes OAuth globais nem integrações de outros sistemas. Remover apenas os eventos de teste identificados.                                           |
| I7 — Fotos                    | Como dono da loja de teste, enviar e substituir uma imagem fictícia de serviço e de profissional. Recarregar e conferir outro aparelho.                                                      | Imagem correta persiste; ações respeitam o papel; remover depois somente as imagens criadas para este caso. A foto própria do Contratado já tem evidência anterior.                                       |
| I8 — Pontos e diretório       | Abrir `/shop/pontos` como dono; buscar WhatsApp formatado e apelido; inverter ordenação; conferir cliente com saldo, saldo zero e balcão; repetir como Contratado sem permissão para pontos. | Dados pertencem à loja; `0` e `—` têm sentidos distintos; ordenação correta; coluna de pontos ausente para quem não pode vê-la.                                                                           |
| I9 — Privacidade e exportação | Alterar escolhas, salvar e recarregar; baixar dados de conta descartável. Iniciar uma operação e sair/trocar de conta antes do retorno.                                                      | Escolhas persistem; cópia contém somente os dados esperados da conta; resposta antiga não dispara download nem modifica a nova sessão. Conferir o arquivo em ambiente privado, sem anexá-lo ao relatório. |
| I10 — Exclusão da conta       | Preparar uma conta descartável sem sociedade ativa. Confirmar com a palavra exigida e aguardar o resultado.                                                                                  | Exclui somente a conta de teste escolhida; retorna à entrada; não informa sucesso sem resposta. Não usar conta do dono/TI nem apagar a conta histórica responsável pelas lojas de teste.                  |

**I11 — Gestão técnica na ficha administrativa (P-74):** em Administração → Barbearias, abrir a ficha de uma loja de teste e conferir os três painéis de domínio, redirecionamentos e fuso. Trocar de ficha e confirmar que todos mostram a loja escolhida. Anotar o fuso original, alterar para um fuso de teste e conferir a persistência na ficha/loja; restaurar o valor original. Fazer isso em loja de teste sem agendamentos que possam ser afetados. Conferir a remoção apenas de um redirecionamento fictício, não protegido, preparado para o ensaio; preservar links protegidos e históricos. Salvar, validar e remover domínio somente se houver hostname e DNS de teste controlados pela TI. Sem esses recursos, marcar apenas essa parte como **não executada**, sem usar domínio de cliente. **Aceite:** conta/loja corretas, operações autorizadas persistem, erros recuperáveis e nenhum efeito sobre outra loja ou domínio.

Falha ou demora de rede não prova que nada foi gravado. Antes de repetir uma criação, envio ou exclusão, consultar o estado da própria conta/registro de teste. Relatar o ponto exato em que parou; não repetir alterações de resultado desconhecido só para obter uma tela de sucesso.

## 5. Aparelhos e uso real — P-43

Registrar modelo, sistema, navegador, orientação e se o app estava instalado. Fazer nos aparelhos disponíveis; informar os ausentes como **não executado**, sem substituir por emulação.

| Ambiente                         | Conferir                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| iPhone — Safari e app instalado  | Login Google e retorno ao app, conexão Google Agenda, teclado virtual aberto, áreas seguras do aparelho, campos e botões de confirmação alcançáveis.               |
| Android — Chrome e app instalado | Entrada/retorno, teclado, voltar do sistema, rolagem das janelas e preservação do rascunho.                                                                        |
| iPad em pé e deitado             | Navegação lateral, quadro da equipe, agendamento do cliente, tabelas/filtros, edição de serviço/profissional; giro com formulário preenchido sem perda dos campos. |
| Computador                       | Navegação por teclado, foco visível, Enter/Escape quando cabíveis, zoom de 200%, tabelas e ações alinhadas; janela menor sem conteúdo cortado.                     |

Em cada ambiente, abrir entrada pública/login, cliente, loja e administração conforme as contas disponíveis. Percorrer a navegação principal, abrir uma tarefa longa e uma confirmação curta. Usar temas claro/escuro e os três modos de canto, incluindo pelo menos um formulário com texto/nome longo.

Nas janelas móveis alteradas pela P-95, conferir especialmente: abertura pela parte inferior, título e fechamento alcançáveis, rolagem do conteúdo, campo focado acima do teclado, ações no fim da tarefa e retorno do foco ao fechar. Não exigir que uma confirmação destrutiva feche durante o envio.

**Aceite:** sem sobreposição, corte de texto/ações ou rolagem lateral involuntária; campos legíveis e tocáveis; foco não fica atrás da janela; nenhuma perda de dados ao girar/redimensionar. A avaliação deve indicar a tela e ação examinadas, sem declarar “todo o sistema aprovado” com base apenas na página inicial.

### Fatos técnicos para a revisão do acordo de dados — P-39

Responder no mesmo relatório, com o estado conferido e a data da consulta. Usar nomes de serviços, países/regiões, prazos e funções; não informar credenciais, IPs privados, chaves, conteúdo de backup ou dados pessoais. A TI fornece os fatos; a revisão jurídica fica com o profissional responsável.

- Fornecedor e região/país da VPS, armazenamento e backups; existência de cópias em outras regiões.
- Suboperadores efetivamente utilizados para hospedagem, autenticação, e-mail, WhatsApp, Google e suporte, identificando o serviço prestado por cada um.
- Prazos de retenção vigentes para dados ativos, registros técnicos e backups; o que é eliminado, anonimizado ou mantido após exclusão.
- Quem tem acesso de suporte/administração, como esse acesso é concedido/revogado e quais operações ficam registradas.
- Como a loja pode obter seus dados ao encerrar o serviço; distinguir a exportação da loja da cópia individual disponível ao cliente.
- Procedimento existente de exclusão e tratamento de incidentes: responsável, canal e evidências disponíveis, incluindo limitações ainda não resolvidas.

Onde não houver confirmação, escrever **não confirmado** e indicar o responsável pela informação. Não declarar conformidade jurídica nem inventar prazos contratuais.

## 6. Pendência Google externa — P-28

Continua valendo somente o [roteiro TI v3.1 já entregue](2026-11-07-ti-flow-janela-d-v3-conferida-p28.md). O próximo retorno documentado é a Parte 1 de **13/11/2026 às 17h45 de Brasília**, respeitando o mínimo de **17h30min07s** e as condições do marco. Não duplicar o agendamento, reinstalar funções, refazer inventários/consentimentos ou reiniciar a espera.

Este pacote B&C não contém comandos de operação do Flow. Depois do retorno e das etapas próprias previstas naquele roteiro, seguem propriedade/marca/domínios e o [vídeo/reenvio Google do B&C](2026-10-15-google-reenviar-verificacao-p28.md). Conectar Google de teste para homologar o B&C não equivale a concluir a verificação externa da P-28.

## 7. Limpeza e relatório único

1. Restaurar os ajustes de teste anotados antes da rodada e encerrar as sessões de teste.
2. Remover somente contas descartáveis, eventos, agendamentos, lojas novas e arquivos que esta rodada criou e identificou. Preservar Loja Teste, Loja Teste B e contas históricas, salvo decisão específica de encerramento dessas estruturas.
3. Não executar automaticamente a limpeza integral antiga: ela recusa fotos restantes, vínculos com lojas reais ou contas com papel global e não deve ser contornada.
4. Devolver um arquivo em Markdown com o modelo abaixo. Capturas, se necessárias, devem ocultar informações pessoais e nunca mostrar console com sessão/token.

```text
Relatório — homologação Barba & Cabelo
Responde a: 2026-11-07-ti-barba-cabelo-homologacao-final.md
Data/hora e fuso:
Commit publicado / como foi conferido:
Lojas de teste usadas (somente nomes de teste):
Aparelhos/navegadores/orientações:

ID do caso | Passou / Falhou / Não executado / Não aplicável | Evidência resumida
A1 ...
I1 ...
P-43 ...

Para cada falha:
- Tela e papel da conta:
- Passos:
- Esperado / observado:
- Estado confirmado antes de repetir a ação:
- Captura sanitizada, se ajudar:

Limpeza:
- O que foi criado e removido (sem credenciais ou dados pessoais):
- Configurações restauradas:
- Resíduos ou itens que exigem decisão:

Fatos técnicos P-39: resposta aos seis tópicos / não confirmado / responsável.

O que falta para encerrar P-40/P-41/P-42/P-43, separadamente:
```

Registrar **não executado** quando faltar aparelho, conta, destinatário, acesso ou condição de teste. O Codex conciliará esse retorno com os ensaios locais; código entregue e teste emulado não substituem a comprovação real.
