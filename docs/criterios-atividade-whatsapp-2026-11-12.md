# Perfil de atividade dos números — preparação local

## Pesquisa e significado

Consultado em 12/11/2026: a [documentação dos remetentes Twilio](https://www.twilio.com/docs/whatsapp/api/senders) distingue conexão, classificação de qualidade e limites. O [guia do próprio fornecedor](https://www.twilio.com/en-us/blog/scaling-whatsapp-business-platform-part-1), publicado em 2023, explica a relação entre qualidade e reação dos destinatários, incluindo bloqueios/denúncias. As regras de limites desse artigo antigo não foram copiadas para o B&C.

Essas fontes não fornecem um cálculo de “aquecimento” que possa ser reproduzido na integração Evolution usada aqui. A conclusão de projeto é manter **perfil operacional interno**, baseado em dados observados, separado da qualidade oficial do WhatsApp. Volume, idade e falta de erros não demonstram ausência de restrições. Não estimular mensagens artificiais nem aumentar volume para conquistar um selo.

## Critério interno v2 — somente grupos (13/11/2026)

Janela: 30 dias civis UTC, incluindo o dia atual. Parâmetros iniciais de produto, propostos nesta entrega, **não são limiares oficiais ou comprovados de aquecimento**.

| Perfil no cartão         | Critério                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Sem histórico suficiente | Dados ausentes, sem prova de grupo, inválidos, sem aceites ou medição com mais de 24 h |
| Atividade inicial        | Há aceites, sem atingir os mínimos abaixo                                              |
| Atividade regular        | Pelo menos 20 aceites, 7 dias ativos e 7 dias observados                               |
| Histórico consistente    | Pelo menos 100 aceites, 14 dias ativos e 14 dias observados                            |
| Revisar atividade        | Há pausa ou resultado incerto na janela, antes de qualquer preferência por volume      |

**Todos os aceites e dias desta tabela são de envios comprovados para grupos.** Não há conversas privadas no uso aprovado. Dias conectado não substituem dias ativos; não medimos a idade real da conta WhatsApp.

Picos num único dia não substituem o tempo de atividade. O cartão mostra contadores com ícones, descrições acessíveis pelo texto do indicador e detalhes de mouse. Os exemplos da prévia estão marcados como fictícios. Não há score de saúde nem selo de número seguro.

## O que é medido

- Aceites: operações do diário `whatsapp_send_attempts` com estado `accepted` e escopo `groups`, comprovado pela rota do código para um grupo válido; **não comprovam entrega**. Eventos legados, privados ou sem prova ficam `unknown` e não entram no perfil.
- Dias ativos: datas UTC distintas com aceites.
- Tempo observado: intervalo desde a primeira tentativa válida da identidade atual na janela; não é a idade da conta WhatsApp, do chip ou da compra do número.
- Incertos: `unknown` e operações `started` sem conclusão após dois minutos.
- Falhas definitivas não têm estado separado nesse diário. Não são inventadas nem confundidas com resultados incertos. Desconexão e pausa são informações distintas.
- Cobertura atualmente limitada aos códigos de login/confirmação com rota comprovada de grupo no diário protegido do B&C: não representa conversas fora do sistema nem operações da extensão que não alimentem esse diário. Uma integração futura deve ampliar a coleta sem duplicar tentativas ou mensagens.

Não coletar conteúdo, código OTP, telefone do destinatário ou QR para calcular estes indicadores. A prova minimizada guarda somente referência interna de grupo e identidade operacional durante a retenção do diário; não guarda JID nas métricas. Criar grupo, ajustar foto/nome, fixar mensagem, verificar conexão, receber mensagens e sinalizar digitação não contam como envios. Avisos/marketing de outros fluxos ainda precisam de coleta comprovada e deduplicada; não declarar cobertura total.

## Identidade e instalação futura

Migration nova `20261113002000_whatsapp_metricas_atividade.sql`, somente local. Tabela privada registra quando o telefone atual foi observado conectado à instância; trigger acompanha mudanças. Registros anteriores a essa observação não são atribuídos automaticamente ao número atual, pois a conexão pode ter sido pareada com outro telefone. O primeiro uso em produção começa sem histórico atribuído; não importar retroativamente sem prova de identidade.

A RPC `platform_whatsapp_number_activity` e o diretório administrativo devolvem somente agregados e exigem administrador da plataforma. Sem a migration, a interface permanece com histórico indisponível. Nenhuma consulta nova é enviada ao servidor antigo: as métricas chegam pelo diretório quando ele tiver a capacidade instalada.

## Uso na distribuição assistida

A carga de vínculos continua sendo o primeiro critério. Para principal, em empate de carga, prefere menor volume medido em grupos, depois o perfil. Não considera ausência de dados como zero. Para reservas, compara carga de reservas, consistência do histórico e carga de principais. Esse histórico não é prova de segurança. Não há preferência por volume bruto ilimitado. Pausados ou com resultado incerto ficam fora da proposta automática para revisão; escolhas manuais mantêm as proteções existentes. Telefones desconectados/repetidos seguem excluídos. Restrição histórica do mesmo telefone impede recomendá-lo por meio de uma nova instância sem revisão. Nunca alternar números para contornar restrições ou trocar emissor automaticamente.

Limitação: vínculo é aproximação de carga, não previsão de mensagens. Antes de ativar para dados reais, validar períodos/limiares, capacidade, atualidade da conexão, revisão de incertos e coleta dos fluxos de grupos. O indicador não habilita envio.

## Histórico e atribuição automática — preparação local de 13/11

Novas migrations `20261113003000` e `20261113004000`, dependentes da `20261113002000`, **não instaladas na VPS**. O catálogo conserva telefones já observados conectados e agregados por telefone/identidade/dia/escopo. Restrição registrada pertence ao telefone observado, não a qualquer conta que reutilize a instância. Dados históricos ficam visíveis sem oferecer arraste/seleção para nova atribuição. Sem prova de envio para grupo, os totais não são exibidos como atividade de grupos.

Os aceites/estados finais incertos de grupos acumulam uma vez por transição terminal. Repetir snapshot, reentregar conclusão ou expurgar parte de um dia não reduz nem duplica esses totais. Incerteza temporária `started` conta no perfil atual após dois minutos; histórico agregado de grupos acumula apenas estados finais observados. Agregados legados desconhecidos ficam separados e não são usados para preferência. Não atribuir retrospectivamente eventos a telefones sem prova de identidade.

A prévia oferece atribuição automática local para barbearias **sem configuração geral**, com no mínimo dois telefones físicos elegíveis e, quando disponível, uma segunda reserva. O lote considera as atribuições anteriores no cálculo de carga; não reordena escolhas já definidas nem altera profissionais personalizados. Ativar não envia mensagem nem cria grupo, e avisos continuam pausados. Se faltar par elegível, a barbearia aguarda configuração. Não há geração artificial de mensagens para “aquecer”, alternância por mensagem ou retomada automática de número restrito.

**Ainda pendente para operação real:** segunda reserva no contrato do banco, atribuição transacional no cadastro de loja e sincronização versionada com composição/admins dos grupos. Antes de criar ou alterar grupos, é necessário verificar duas contas autorizadas da plataforma, conexão, restrições, identidade, consentimento, versão e composição observada; manter o grupo em revisão durante divergência ou resultado incerto. Não remover um admin antes de confirmar o substituto. Esta lógica de grupo não foi ativada por esta prévia. O pacote em execução pela TI permanece intocado.

## Verificação

`npm run test:distribution` inclui classificação, limites, dados insuficientes/expirados, pausa/incerteza e preferência na proposta. `scripts/testar-atividade-numeros.mjs` confere cartões, exemplos fictícios, proposta e ausência da sombra colorida unilateral. SQL em `supabase/tests/whatsapp_atividade.sql` testa contagem, dias distintos, janela, permissões e troca de telefone; rollback em banco descartável. Os 45 testes anteriores da distribuição também foram repetidos com a nova coleta.

Não instalado/publicado; não altera nem substitui o pacote que a TI já está executando. Próxima janela exige pacote incremental revisado e autorização do dono, preservando as migrations anteriores.
