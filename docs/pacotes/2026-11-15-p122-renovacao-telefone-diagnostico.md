# P-122 — janela interrompida, diagnóstico e correção de identidade

**Estado: piloto pausado. Não seguir o roteiro anterior de entrada.** Relatório 2 da TI/Guardião, corte **15/11/2026, 15:00:34 BRT**, supera a fotografia de 03:17:41. Instalação preservada, matrícula não renovada e nenhuma entrada/novo acolhimento/código/agendamento comprovados. Arena e retorno/encerramento continuam pendentes.

Este documento reúne análise local e plano de desenvolvimento. Não é ordem para a TI trocar telefone, reativar piloto, executar migração ou pedir novos cliques. Nenhuma alteração de produção foi executada pelo Codex.

## 1. Fatos e limites

| Comprovado no retorno                                                                                                           | O que não foi demonstrado                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Perfil/grupo/ciclo/matrícula/customerJid configurado usam a variante de oito dígitos após DDD; titular informou nove, final4593 | Alias legítimo entre as variantes ou identidade WhatsApp física do titular dentro do grupo          |
| Normalizador vivo preserva o nono dígito e trata as variantes como valores diferentes                                           | Que o normalizador removeu um dígito, quem digitou o valor antigo ou autoria humana da alteração    |
| Observações antigas de conexão bloquearam elegibilidade live às 13:34–13:35                                                     | Que esse foi o motivo de todos os cliques, inclusive o posterior à atualização legítima às 13:36:49 |
| Retomar confirmação apresentou aviso genérico; matrícula permaneceu vencida, sem commit parcial comprovado                      | HTTP/code/message do último clique ou falha de read final como causa efetiva                        |
| Contagens preservadas: quatro etapas aceitas, cinco operações piloto/seis globais                                               | Entrada, recebimento do acolhimento atual, confirmação, login ou aviso homologados                  |

Estado relatado ao encerrar: pausa global=true v17, ciclos=false v12, distribuição=false v3; timers novos inactive/disabled; zero leases/filas/incertos. Grupo/JID/ciclo/admissão/ano/consentimentos/preferências preservados. Leituras remotas são evidências do Guardião, não novas consultas da VPS pelo Codex.

## 2. Análise na fonte e correções locais concluídas

`CareGroupPanel` descartava os erros recebidos e compartilhava um booleano entre read, polling e renovação. O mesmo texto genérico não identificava qual operação falhou. O botão de retomada não considerava `data.enabled=false`, e o componente de telefone ainda podia oferecer/pesquisar convite nessa condição.

Correções somente locais, sem alterar regras no servidor:

- Mensagens distintas para leitura, retomada, solicitação, preferências e encerramento. Restrições de telefone/composição só são identificadas quando o código correspondente é realmente capturado; não são deduzidas a partir da captura anterior.
- “Copiar diagnóstico” retém origem=interface, operação, código controlado, status HTTP disponível e horário. Não inclui telefone, payload, SQL bruto, hint/details, e-mail, token, convite, OTP ou identidade da conta. Não é um request ID de servidor e não captura retroativamente o clique antigo.
- Falha de polling não apaga a falha da ação. Leitura recuperada remove apenas o aviso de leitura; atualizar situação continua uma ação de consulta, sem repetir renovação.
- Retomada indisponível quando a leitura informa grupos desabilitados. Convite/código/polling de convite bloqueados nessa condição, inclusive se um ready antigo ainda existir. Convite em memória e respostas antigas são invalidados ao indisponibilizar o atendimento.
- Textos nos dicionários pt-BR/pt-PT/en-US/es; en-GB herda en-US. Tokens/cantos/componentes MB preservados. Nenhuma publicação executada.

Isso melhora a clareza e a coleta futura, **não corrige a identidade nem comprova a causa histórica da falha**. Todos os gates de banco/Evolution, timestamps de conexão e regras de consentimento foram preservados.

## 3. Dependência que precisa de desenho próprio

Na fonte instalada, `care_group_begin` exige composição live válida antes de renovar a matrícula. Observação live dura dois minutos; matrícula dura uma hora; timers novos estão desligados. Não existe atualização live autônoma garantida para tornar a retomada de qualquer cliente viável. Esse acoplamento está comprovado na fonte e no retorno, mas não substitui a resposta técnica ausente do último clique.

O botão retoma com `data.phone`, lido do grupo, não com um suposto novo valor digitado em outro campo. A função recusa telefone diferente do grupo. Alterar apenas profile, apenas customerJid, apenas matrícula ou apenas frontend deixaria contratos divergentes. Não autorizar UPDATE manual nem equivalência automática entre oito/nove dígitos.

A retomada de consentimento e a prontidão para operar grupo precisam ser tratadas como etapas diferentes em uma futura mudança coordenada. Qualquer separação deve manter conexão/identidade/proteções revalidadas imediatamente antes dos efeitos; não remover o gate de envio para facilitar matrícula.

## 4. Fluxo suportado proposto — NOVO, ainda não implementado

Aplicação inicial restrita a **telefone ainda não verificado e grupo sem cliente presente**, sempre na mesma conta autenticada e grupo/ciclo vigente. Número já verificado, grupo com cliente/terceiro, composição alterada, ciclo encerrado/vencido ou efeito incerto exigem revisão; não reutilizar automaticamente esse caminho.

1. **Revisão explícita na conta:** titular informa o telefone correto no próprio aplicativo; vê número atual e candidato, ambos identificados, e confirma intenção e números da plataforma consentidos. Não inferir o candidato adicionando/removendo dígitos. Criar intenção pendente versionada com prazo; não reescrever perfil nem declarar telefone verificado.
2. **Conferência protegida sem envio:** validar sessão/loja/conta, versões, duas contas administrativas e snapshot real. Guardar prova da intenção e composição. Se existir alias, aceitá-lo apenas com mapeamento PN/LID autenticado e rastreável; customerJid configurado não é essa prova. Não consultar rota genérica vedada ou outra conta para contornar a proteção.
3. **Prova pelo pedido de entrada:** se não houver alias comprovado, preparar uma janela específica da intenção pendente, no mesmo grupo. Titular usa convite privado e solicita entrada com o candidato. Uma operação protegida futura consulta somente o pedido correspondente ao candidato consentido e resolve PN/LID. O process normal não pode rejeitar/aprovar essa pendência como se já fosse uma identidade ativa. Ausência/divergência de prova mantém pausa, sem mensagem ou código.
4. **Conciliação coordenada dos dois bancos:** somente com prova real do pedido, aplicar identidade configurada no provedor e vínculo no B&C por operação durável/idempotente, CAS, payload lacrado e nova admissão. Preservar grupo/JID/criação/ano/conta e preferências. Falha entre camadas fica pendente para leitura/recuperação pelo mesmo diário; nunca repetir criação ou inventar aceite.
5. **Admissão e confirmação final:** aprovar somente o candidato comprovado como membro comum; outro administrador acolhe, descreve e fixa depois da entrada. Provas da admissão atual precedem OTP no grupo. Só consumir o desafio do telefone novo permite consolidar o telefone verificado do perfil, respeitando conflitos com outra conta verificada e o uso da mesma conta em várias barbearias.
6. **Sem sucesso presumido:** alias não comprovado, novo pedido desconhecido, timeout, terceiro ou divergência congelam a intenção. Não enviar código ao contato antigo/candidato por PV, não trocar o usuário do grupo, não usar um novo grupo para contornar nem atribuir esse desenvolvimento à TI.

Este plano precisa de contratos novos B&C/Evolution, migrações/recuperação, interface de consentimento e testes antes de qualquer pacote operacional. Não é uma função já existente; não pedir que a TI a improvise no servidor.

## 5. Critérios para a futura entrega completa

Cobrir: formato oito/nove preservado; candidato informado explicitamente; sessão/conta/loja; titular real com PN/LID comprovado; pedido de terceiro; número pertencente a outra conta verificada; mesma conta em várias lojas; expiração/concorrência/CAS; dois administradores; grupo com cliente já presente; operação incerta entre camadas; reentrega sem nova criação/mensagem; matrícula sem envio e envio sempre com gate live; OTP e consumo únicos; JID/ano/preferências sem reset. Incluir códigos específicos e diagnóstico sanitizado, fonte completa/hashes e retorno em estado pausado. Só depois pacote TI para revisão/janela.

Enquanto isso, preservar o estado pausado. Não pedir tentativas cegas. Se houver logs já existentes com resposta correlacionável ao clique anterior, eles podem complementar o diagnóstico em privado, sem nova execução, payload ou credenciais. Ausência de registro deve continuar declarada como ausência de prova.

## 6. Verificações desta rodada

638 testes B&C aprovados (incluindo classificação de falhas, privacidade do diagnóstico e idiomas), tipos, lint, formatação e montagem. Navegador local com API/sessão fictícias, rede externa bloqueada e fonte Inter real: 45 composições — três modos de canto, larguras 320/390/768/1024/1440, estados indisponível/telefone em revisão/erro de leitura. Verificados pausa sem begin/convite/OTP, erro da ação preservado durante polling, diagnóstico sanitizado, ausência de correção automática do telefone e descarte do convite em memória ao pausar. Capturas revisadas visualmente; nenhum corte horizontal ou erro de execução.

O ensaio de componente usa uma página HTML isolada com preâmbulo React de desenvolvimento e arquivos da fonte local, sem inicializar o roteador da aplicação. Evita interferência de montagem/HMR na medição; não representa homologação real de sessão, telefone, WhatsApp ou API. Nenhuma chamada real de grupo foi executada e nenhuma imagem/SQL/Edge publicada. O roteiro antigo em Downloads permanece um artefato histórico, superado expressamente pelo relatório 2 e por este documento.
