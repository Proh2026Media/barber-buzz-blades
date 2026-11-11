# Diagnóstico das conexões WhatsApp — 10/11/2026

Relato do dono: vários avisos de falha/desconexão, percebidos aproximadamente dez minutos antes da investigação. Consultas remotas realizadas somente em leitura, entre 23h03 e 23h10 de 10/11/2026 (Brasília). Não houve envio, logout, pareamento, reinício, alteração de configuração ou escrita no banco nesta investigação.

## Resultado

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

## Próximo passo para dono/TI

1. Conferir o aplicativo da conta final **5627** e a lista de aparelhos conectados. O dono foi perguntado; ainda não informou se existe restrição ou se o aplicativo funciona normalmente.
2. Se a conta estiver funcionando, refazer **somente** o vínculo da plataforma, em Administração → WhatsApp → Códigos de acesso, com o titular/operador autorizado. Não apagar instâncias nem reiniciar o serviço inteiro.
3. Após parear, observar se permanece `open` e se surge novamente `device_removed`. Registrar horário, código e versão sem expor QR, credenciais ou conteúdo de mensagens.
4. Se o vínculo cair outra vez sem remoção manual, revisar a compatibilidade Evolution/Baileys e preparar eventual atualização em ambiente de teste, com cópia e retorno. Não atribuir banimento nem trocar números por esse código isoladamente.
5. Se o aplicativo mostrar bloqueio/restrição, registrar o aviso exato e seguir a recuperação da própria conta. Não alternar números para contornar a restrição.

**Limite:** investigação concluída; recuperação do vínculo da plataforma depende da conferência da conta e do novo pareamento. Os avisos das abas com sessão inválida devem ser reavaliados após entrar novamente. Nenhuma correção funcional ou instalação foi executada por este relatório.
