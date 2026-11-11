# Diagnóstico das conexões WhatsApp — 10/11/2026

Relato do dono: vários avisos de falha/desconexão, percebidos aproximadamente dez minutos antes da investigação. Consultas remotas realizadas somente em leitura, entre 23h03 e 23h10 de 10/11/2026 (Brasília). Não houve envio, logout, pareamento, reinício, alteração de configuração ou escrita no banco nesta investigação.

## Atualização — restrição confirmada pela captura das 23h16

O dono enviou a captura `Captura de Tela 2026-11-10 às 11.16.29 PM.png`, relatando que a conta usada no sistema recebeu somente um código com sucesso. A tela informa restrição da conta por possível atividade de spam, mensagens automáticas ou em massa, com **5h46min51s restantes naquele instante**. Confirma uma restrição temporária da conta mostrada; não é evidência de banimento permanente. A captura não exibe o telefone, sendo associada ao incidente da plataforma pelo contexto informado pelo dono.

A [Central de Ajuda do WhatsApp, sobre contas restritas](https://faq.whatsapp.com/717472490411581?locale=pt_BR), informa que essa condição impede usar dispositivos conectados, pode desconectar dispositivos adicionais e termina automaticamente após o prazo indicado. Isso é compatível com o `device_removed` recebido pela Evolution. O sinal específico que provocou a restrição continua desconhecido; não atribuir o resultado apenas ao volume, à Salvy, ao texto do código ou a uma versão da biblioteca.

**Conferência adicional, somente por agregações no banco da Evolution:** na instância `platform-barba`, desde 00h de 10/11 (Brasília), há quatro registros de saída, mas apenas **dois identificadores de mensagem distintos**. Três registros correspondem à mesma mensagem e ao mesmo conteúdo, registrada às **22h37min50–51s**, com estados `PENDING` e `DELIVERY_ACK`. Portanto, há **uma única mensagem com entrega confirmada**, de acordo com o relato do dono. O outro identificador, de **23h03min18s**, aparece somente como `PENDING`, sem confirmação de entrega nos registros consultados. Não foram lidos códigos, conteúdo das mensagens ou destinatários; somente contagens, estados e horários. A duplicação de registros não comprova envio duplicado ao usuário.

O B&C registra dois pedidos `verify_phone` e quatro `login` no dia para WhatsApp sem barbearia. São pedidos/desafios, não comprovação de seis mensagens enviadas ou recebidas. O código faz uma chamada de envio por pedido admitido; o caminho de login não repete automaticamente após timeout. A mensagem com entrega confirmada precede imediatamente o encerramento das 22h37min52s; essa proximidade temporal não identifica o critério de detecção da Meta.

**Orientação atual, que supera o pareamento imediato sugerido no roteiro inicial:** aguardar o término e a notificação da restrição no aplicativo; não forçar novas tentativas de pareamento ou envio durante o bloqueio. Para acesso ao B&C, usar Google ou e-mail/senha. O baixo volume e a finalidade de confirmação não garantem ausência de restrição numa integração não oficial. As [orientações do WhatsApp](https://faq.whatsapp.com/361005896189245/?locale=pt_BR) tratam automação e envio em massa como práticas distintas, sem fornecer um limite mínimo que torne a automação não autorizada segura. Nenhum envio, pareamento, mudança de provedor ou alteração de configuração foi realizado por este complemento.

## Resultado da primeira conferência, antes da captura

**Foram identificados dois eventos distintos:** recusa de consultas por uma sessão de login do B&C que deixou de existir no servidor e encerramento real da sessão WhatsApp do número da plataforma. Não foi constatada uma desconexão geral de todos os números.

| Número/registro                  | Estado confirmado às 23h10   | Evidência                                                                                                                                 |
| -------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Número final 4593                | Conectado                    | Evolution `connectionState`: HTTP 200, `open`; banco B&C também `open`                                                                    |
| Externa Barbearia 01, final 0022 | Conectado                    | Evolution `connectionState`: HTTP 200, `open`; banco B&C também `open`                                                                    |
| Plataforma, final 5627           | Desconectado                 | Evolution `connectionState`: HTTP 200, `close`; encerramento com `401`, `conflict`, `device_removed`                                      |
| Preparação da loja de teste      | Sem conexão                  | `connectionState`: `close`; listagem `fetchInstances` ainda informa `connecting`, mostrando diferença entre o cadastro e o estado efetivo |
| Cadastro B&C Teste               | Sem instância correspondente | `connectionState`: HTTP 404; banco já estava sem telefone e desconectado às 22h28                                                         |

Os dois últimos registros já estavam sem telefone no banco às 22h28, antes do intervalo relatado. Eles não constituem evidência de que dois números ativos tenham caído agora. O final 0022 conserva um motivo de desconexão antigo, de 14h46, mas está aberto na consulta atual; o histórico não deve ser confundido com o estado presente.

## Evento 1 — autenticação no B&C

- Entre **22h43min40s e 23h03min07s**, foram observados **66 POSTs HTTP 401** para `platform-whatsapp`, originados do site público e de navegador comum.
- No mesmo período, o Auth registrou **66 respostas HTTP 403 em `/user`, com `error_code=session_not_found`**. A correlação indica que as consultas recusadas não passaram da autenticação do B&C.
- O handler retorna 401 antes de chamar a Evolution quando não consegue identificar a sessão. Esses erros não encerram a conexão de um número na Evolution.
- Consultas bem-sucedidas também apareceram no intervalo. Na leitura final, os três POSTs posteriores às 23h06 eram HTTP 200. Isso não comprova recuperação de todas as abas/sessões do navegador.
- Os registros consultados não demonstram por que a sessão do B&C foi invalidada. Não atribuir a causa à expiração, remoção de telefone pessoal, outro login ou ação administrativa sem nova evidência.

**Recuperação dirigida:** se a aba ainda apresentar erro de sessão, sair do B&C e entrar novamente por Google ou e-mail/senha, evitando depender do número de códigos que está desconectado. Depois, usar Atualizar lista. Não refazer QR dos números que a Evolution informa como abertos.

## Evento 2 — vínculo WhatsApp da plataforma

| Horário de Brasília | Registro observado                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| 22h37min52s         | `stream:error code=401`, `conflict type=device_removed`, seguido de `platform-barba - LOGOUT`    |
| 23h02min03s         | Novo registro `platform-barba - LOGOUT`; o log consultado não identifica o agente que o originou |
| 23h02min13s         | `stream:error code=515` durante o ciclo de conexão                                               |
| 23h03min20s         | Novo `401 / device_removed`, persistido como último motivo de desconexão da plataforma           |
| 23h10               | Plataforma continua `close`; os finais 4593 e 0022 continuam `open`                              |

O código `401` aqui pertence à sessão WhatsApp/Baileys, não à autenticação HTTP do B&C descrita acima. A [documentação do Baileys](https://github.com/WhiskeySockets/docs/blob/main/advanced/troubleshooting.mdx) associa `loggedOut/401` a uma sessão que precisa ser autenticada novamente. Esse sinal **não comprova banimento**, nem revela sozinho quem removeu o dispositivo. Há também [relatos no repositório do Baileys](https://github.com/WhiskeySockets/Baileys/issues/2140) de `device_removed` sem remoção manual; são indícios de uma hipótese a investigar, não prova da causa deste incidente.

A primeira ocorrência confirmada, às 22h37, antecede o commit da reorganização da central, feito às 22h56 (`cd42b43`). A mudança visual não explica o início desse evento. Não foi encontrado um logout automático ao abrir a página: status comum somente consulta; logout e recomeço do pareamento são ações explícitas. Os logs de acesso disponíveis não registram o corpo de cada requisição, portanto não permitem excluir ou atribuir uma ação manual específica.

## Infraestrutura e código conferidos

- Evolution **2.3.7**, biblioteca instalada **Baileys 7.0.0-rc.9**. A versão, por si só, não prova defeito nem autoriza atualização direta em produção.
- Evolution ativa desde 23/10; nenhum reinício recente ou indicação de OOM. Funções do B&C ativas desde 10/11 às 16h23; banco ativo há duas semanas. Não foi observada reinicialização desses serviços no período do incidente.
- Acesso autenticado de leitura à Evolution retornou HTTP 200; os números ativos responderam normalmente.
- `platform-whatsapp/index.ts` e `_shared/whatsapp-pairing.ts` instalados têm os mesmos hashes dos arquivos locais. `_shared/evolution.ts` apresentou hash diferente; leitura comparada mostrou somente formatação na expressão da URL, sem diferença funcional.
- A página pública Meta Status foi consultada, mas não forneceu conteúdo legível nesta ferramenta. Não usá-la para declarar ausência de incidente global. As sessões abertas e a resposta da API são as evidências locais contra a hipótese de indisponibilidade generalizada.

## Próximo passo atualizado para dono/TI

1. A restrição já foi comprovada na captura. Aguardar o fim indicado pelo WhatsApp e a notificação no aplicativo; se persistir, consultar a ajuda/suporte da própria conta. Não repetir QR, logout ou envios para tentar remover a restrição.
2. Usar Google ou e-mail/senha para entrar no B&C enquanto o número de códigos estiver indisponível; renovar o login das abas que ainda acusam sessão inválida.
3. Depois da liberação, reavaliar a integração de autenticação antes de retomar testes. O risco da automação não oficial continua existindo mesmo com um único código solicitado. Atualização de biblioteca não pode ser apresentada como garantia contra restrições.
4. Eventual novo pareamento deve atingir somente a plataforma, com o titular/operador autorizado. Os números finais 4593 e 0022 estavam abertos na última conferência; não reconectá-los por causa deste incidente.
5. Registrar novas ocorrências por horário/código/versão, sem expor credenciais ou mensagens. Não alternar números para contornar a restrição.

**Limite:** investigação atualizada com restrição confirmada e uma entrega única comprovada. O motivo específico da classificação da Meta e a recuperação posterior ainda não foram confirmados. A falha de sessão do B&C é um evento separado. Nenhuma correção funcional ou instalação foi executada por este relatório.
