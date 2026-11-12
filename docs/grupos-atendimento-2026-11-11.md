# Grupos exclusivos de atendimento — preparação local

**Decisão posterior do dono em 11/11 — P-120:** os grupos terão **somente cliente + números autorizados da plataforma**, sem profissionais nem acesso deles às conversas. Códigos deverão ir ao grupo, não ao privado. [Preparação da mudança](plano-login-whatsapp-email-2026-11-11.md). **Ainda não implementada:** permissões/equipe/OTP individual descritos abaixo são o código anterior e precisam ser adaptados antes de ativar. Bloqueio real permanece.

**Atualização posterior de 11/11 — ciclo integrado localmente:** [adaptador, controles e ensaio completo do ciclo](pacotes/2026-11-11-bc-integracao-grupos-local.md). Nº 107 acrescenta autorização por etapa, identidade aprovada e retorno voluntário; convite/admissão/remoção/encerramento/recuperação já implementados e testados. As descrições abaixo registram a preparação inicial. Permanecem bloqueio real, fila/envio, recibos e demais pendências expressas na nova entrega.

**Atualização 11/11 — extensão do provedor preparada:** [pacote local](pacotes/2026-11-11-evolution-extensao-grupos-local.md) implementa as rotas/diário/eventos sobre a revisão exata, com 26 testes e imagem local construída. Isso supera a etapa de apenas propor a extensão, mas não libera o adaptador B&C nem confirma capacidade em produção. Integração, ensaios e autorizações operacionais continuam pendentes.

Data: 11/11/2026. Autorização: o dono adotou `INSTRUCOES_CODEX_GRUPOS_EXCLUSIVOS_BARBA_CABELO.md` para implementação **somente local**. Ramo `desenvolvimento/grupos-exclusivos-2026-11-11`, sobre a auditoria local `9549513`. Sem publicação, migration em produção, grupos, mensagens ou operação no Flow. Não executar autossave/push.

**Retorno TI recebido em 11/11:** diagnóstico confirmou as lacunas; [revisão e contrato seguinte](pacotes/2026-11-11-evolution-grupos-retorno-ti.md). Não repetir o pedido de diagnóstico. Correção adicional do receptor local com dois testes; nenhuma liberação da criação real.

## Resultado e limite desta entrega

Implementados cadastro de solicitações, consentimento, preferências, atribuição de participantes, estados, controles no banco, processamento com provedor simulado, webhook protegido e telas. A criação automática real permanece bloqueada no adaptador. Isso é uma preparação verificável, **não uma integração de grupos pronta para ativar**.

A versão anteriormente identificada é Evolution 2.3.7/Baileys 7.0.0-rc.9. Nesta rodada conferimos o código oficial da tag 2.3.7; não voltamos à VPS nem confirmamos alterações posteriores de runtime. A API dessa tag não expõe todos os controles obrigatórios de admissão. Não basta ligar uma configuração no B&C.

## Capacidades verificadas

| Necessidade                                              | Capacidade/evidência                                                                                                                                                                           | Limitação e alternativa                                                                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidade permanente                                    | `groupJid` nos [DTOs 2.3.7](https://github.com/EvolutionAPI/evolution-api/blob/2.3.7/src/api/dto/group.dto.ts); criação retorna ID                                                             | B&C guarda `group_jid`; renomear não perde o vínculo. Outro grupo com o mesmo nome não é associado.                                                           |
| Criar, consultar, editar e remover participantes         | [Rotas oficiais](https://github.com/EvolutionAPI/evolution-api/blob/2.3.7/src/api/routes/group.router.ts)                                                                                      | Endpoints existentes não equivalem a fluxo seguro completo; adaptador real de mutação permanece bloqueado.                                                    |
| Restringir edição                                        | `locked/unlocked` nos DTOs e `restrict` nos metadados do [serviço](https://github.com/EvolutionAPI/evolution-api/blob/2.3.7/src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts) | Restrição de edição não prova restrição de adição de participantes.                                                                                           |
| Somente administradores adicionam e aprovação de entrada | Não encontrados controles correspondentes nas rotas/DTOs da tag; `findGroup` não devolve `memberAddMode/joinApprovalMode`                                                                      | Bloqueador. TI precisa verificar eventual extensão efetivamente instalada; não inventar endpoints nem trocar provedor por suposição.                          |
| Reconciliação de criação incerta                         | Listagem e consulta por ID existem                                                                                                                                                             | Não há correlação de criação confiável demonstrada. Timeout sem ID exige revisão; não procurar por nome nem criar novamente.                                  |
| Identidade de participante                               | Metadados/eventos contêm JIDs                                                                                                                                                                  | Só PN JID canônico é convertido em telefone. LID e campos derivados por corte de sufixo não são prova de identidade. Ausência de identidade suspende/rejeita. |
| Eventos                                                  | `groups.update`, `group-participants.update`, `messages.upsert` no serviço                                                                                                                     | Eventos nunca reativam por conta própria; marcam divergência e pedem leitura autoritativa. Sem registro de webhook real.                                      |
| Autenticidade do webhook                                 | [Controlador oficial](https://github.com/EvolutionAPI/evolution-api/blob/2.3.7/src/api/integrations/event/webhook/webhook.controller.ts) aceita cabeçalhos personalizados                      | Preparado `x-bc-group-secret`, segredo dedicado + TLS. Não é assinatura criptográfica do corpo. Deduplicação não substitui autenticação.                      |
| Entrega/leitura pelo Cliente                             | Não implementada nem comprovada nesta etapa                                                                                                                                                    | Aceite/recibo agregado não é entrega ao Cliente. Não há contador fictício de entrega.                                                                         |

## Implementação local

- Migration nº **106**, dependente da nº **105**: `20261111120000_grupos_atendimento.sql`. As duas estão somente locais. Nº 101–104 já instaladas; não repetir.
- `whatsapp_group_settings.enrollment_enabled` nasce `false`. Habilitar solicitações não libera o adaptador de criação. Nenhum lote ou importação de clientes.
- `whatsapp_group_accounts` exige declaração explícita de controle pela Plataforma e autorização por estabelecimento. Alterar telefone/instância invalida essa autorização. Após atribuição, a operação não troca automaticamente para outro remetente.
- `whatsapp_care_groups`: unicidade estabelecimento + Cliente, ID do provedor único, versão, identidade confirmada e identidades dos números autorizados registradas na adesão. Nome não participa da identificação.
- `whatsapp_care_participants`: proposta não concede acesso; Cliente aprova pessoa vinculada e verificada. Saída/mudança de papel ou telefone revoga aprovação e pausa o vínculo. Remoção externa ainda não é executada.
- `whatsapp_care_operations`: operação/versionamento, posse temporária e início persistido antes de chamar o provedor simulado. Qualquer início anterior sem ID impede outra criação, inclusive em nova versão após expiração. Resultado desconhecido não volta automaticamente à criação.
- `whatsapp_care_audit/events/invites`: trilha, eventos deduplicados e convite privado. RPC de convite exige Cliente correto, telefone ainda confirmado, estado válido, conferência recente e versão/expiração. **Nenhum convite é produzido nesta entrega.**
- `whatsapp_customer_contact_preferences`: ofertas 0/1/3 por mês civil em America/Sao_Paulo, limite global entre lojas e remetentes, sem ativação por adesão. Mantido adicionalmente o limite legado mais restritivo de duas comunicações opcionais em sete dias. Não há promessa de frequência segura contra restrição.
- Reserva da cota usa o mesmo bloqueio por Cliente da fila existente; tentativa aceita/incerta continua contando. Funções antigas renomeadas não podem ser chamadas pelo serviço para contornar as novas regras.
- A autorização de saída individual respeita pausa/consentimento e bloqueia fallback quando o vínculo já passou a usar grupo. OTP continua na rota individual existente. O destino de grupo não foi acrescentado ao emissor.
- `whatsapp-groups`: serviço só processa operações autenticadas; webhook tem segredo dedicado, corpo limitado a 128 KiB, até 50 eventos, associação exata instância/ID, separação entre remetente e conversa. Não armazena corpo de conversa, chave da Evolution, código ou conteúdo de mídia. Mensagem própria é ignorada; texto só pode expressar descadastro inequívoco, nunca consentimento positivo ou privilégios.
- Limpeza disponível como ação de serviço: eventos após 30 dias, auditoria operacional após 180 dias (evidências de consentimento preservadas), convites expirados, operações vencidas como desconhecidas. **Sem agendamento de limpeza instalado.**

A comparação autoritativa exige Cliente presente, administradores exclusivamente da Plataforma, nenhuma identidade inesperada e controles de admissão comprovados. Se o Cliente saiu de vínculo ativo, não há mensagens individuais como substituição automática. Retorno exige nova adesão e deixa marketing desligado. Mudanças externas entre consulta e chamada continuam possíveis; banco e WhatsApp não constituem uma transação única.

## Telas e permissões

Administração → WhatsApp → **Grupos de atendimento**: números autorizados por estabelecimento, solicitações, pausa, pedido de conferência e proposta de participante. Aviso explícito de criação bloqueada. Duas colunas no computador e sequência vertical no celular/tablet estreito.

Conta do Cliente: adesão desmarcada, participantes previstos, aprovação/remoção, preferências, data única de retorno e encerramento com confirmação recuperável em falha. Ficha do Cliente na loja: somente leitura, condicionada à atribuição aprovada. Os textos passam pelos dicionários dos idiomas existentes; estilos e modos de canto preservados.

| Identidade                           | Poder efetivo no B&C                                                       | Poder administrativo no WhatsApp                          |
| ------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------- |
| Plataforma                           | Autoriza seus números, propõe pessoas vinculadas, pausa e solicita revisão | Reservado a números autorizados; adaptador real bloqueado |
| Cliente                              | Solicita/aceita, aprova participantes, escolhe preferências e encerra      | Nenhum                                                    |
| Dono (`owner`, legado `partner`)     | Leitura da ficha do grupo apenas quando atribuído, aprovado e ativo        | Nenhum                                                    |
| Parceiro (`associate`)               | Mesmo limite de atribuição                                                 | Nenhum                                                    |
| Funcionário/colaborador (`employee`) | Mesmo limite de atribuição                                                 | Nenhum                                                    |

Backend nega administração comercial e registra a tentativa. Tabelas privadas têm RLS e não são acessíveis diretamente pelo usuário. Não foram expostos credenciais, QR ou convites à equipe.

## Verificações executadas

- `scripts/verificar.sh`: tipos, 532 testes (12 novos de grupos), lint, formatação e montagem aprovados. `.vscode/` preexistente excluída somente da checagem por configuração temporária; `.env` não lido nem incluído.
- `deno check --no-lock supabase/functions/whatsapp-groups/index.ts`: aprovado.
- `scripts/banco-local.sh testes supabase/migrations/20261110230000_whatsapp_saida_protegida.sql supabase/migrations/20261111120000_grupos_atendimento.sql`: **1.467 PASS, 0 FAIL/ERROR**, incluindo **45** de grupos, todas as suítes com rollback.
- Reversão operacional ensaiada em transação local com rollback: três verificações adicionais de adesões desligadas, vínculo preservado e conferências invalidadas.
- `python3 scripts/testar-grupos-concorrencia.py`: **4 PASS**, duas conexões reais em container descartável próprio. Mesma solicitação, uma operação, uma posse de criação, uma última cota entre duas lojas; sem provedor externo.
- Bancada Playwright com componentes reais e toda API simulada: **128 verificações**, 36 telas, larguras 320/390/768/834/1024/1440 e três modos de canto. Adesão desmarcada, clique duplo, marketing desligado, erro de encerramento preservando janela, retorno exigindo nova adesão, seleção de conta e ausência de rolagem horizontal. Capturas de celular e computador inspecionadas. Isso não é teste físico nem aprovação visual do dono.

Testes unitários cobrem renomeação sem mudança do vínculo, JID distinto, LID, administradores comerciais, Cliente ausente, controles omitidos, texto sem poderes, concorrência, timeout, falha de persistência, bloqueio por capacidade e autenticação/deduplicação do webhook. SQL inclui acesso entre Clientes, atribuição, versão ausente, identidade/equipe alterada, tentativa expirada sem ID, encerramento sem fallback e cota global.

## Pendências antes de qualquer piloto

1. Comprovar os controles de admissão/adição e metadados no runtime real. [Pedido à TI](pacotes/2026-11-11-ti-grupos-atendimento-capacidades.md) é de diagnóstico somente de leitura.
2. Completar e homologar o adaptador real de criação/configuração, aprovação de entrada por identidade, convites e remoção. Só então habilitar capacidade; não remover a trava apenas para testar em produção.
3. Implementar saída de mensagens para grupo: conferência imediatamente anterior, conteúdo permitido, fila por evento, avaliação única após atendimento concluído, retorno na data escolhida, cancelamento/expiração, atendimento humano e recibos individuais verificáveis. As preferências já são armazenadas, **mas não geram essas mensagens**. O campo reservado `human_until` ainda não governa um fluxo de atendimento.
4. Completar painel de comparação esperado/observado e histórico/contadores operacionais. Hoje os estados e ações estão na tela; detalhes de auditoria permanecem no banco, sem transcrição de conversa.
5. Instalar/homologar a proteção nº 105 em janela autorizada; depois preparar instalação conjunta da nº 106, função, segredo e tarefas de manutenção. Nada disso está autorizado por esta entrega local.
6. Revisar conservação/exportação/exclusão das novas evidências e testar aparelhos reais, idiomas, fonte ampliada e integração ponta a ponta antes do piloto.

## Ativação futura e reversão

Somente após resolver as pendências: piloto pequeno, Clientes voluntários, números próprios autorizados, nenhum conteúdo sensível, acompanhamento de divergência/saída/desconexão/resultado desconhecido. Medir somente fatos confirmados. Sem rotação para contornar restrição e sem promessa de evitar banimentos.

Reversão operacional preparada em `supabase/rollback/20261111120000_grupos_atendimento.sql`: desliga adesões, pausa vínculos, invalida conferências/convites, conserva identidades e evidências. Não apaga grupos do WhatsApp nem libera envio individual como fallback. A instalação e a reversão reais exigem nova autorização; esta rodada executa apenas ensaio local.
