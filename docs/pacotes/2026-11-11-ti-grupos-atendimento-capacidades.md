# TI — verificar capacidades para grupos exclusivos do B&C

**Pedido atendido pela TI em 11/11/2026. Não reenviar para repetir.** [Retorno revisado e próxima etapa técnica](2026-11-11-evolution-grupos-retorno-ti.md). O restante conserva o pedido original como histórico.

Data: 11/11/2026. Destinatário: TI/Guardião da integração do **Barba & Cabelo**. Não envolve Flow/Claude.

## Pedido concreto

Conferir **somente por leitura**, usando os acessos já custodiados, se a Evolution efetivamente instalada oferece os controles abaixo. O código oficial 2.3.7 examinado não os expõe integralmente. Relatório e fontes em [grupos de atendimento](../grupos-atendimento-2026-11-11.md).

O dono autorizou implementação local. **Este pacote não autoriza publicar código, instalar migrations, alterar configurações/webhook, criar grupos, parear números, enviar mensagens, promover participantes ou reiniciar serviços.**

## O que conferir

1. Versão efetiva, imagem/digest ou commit e eventuais patches; versão do Baileys. Não copiar variáveis ou segredos.
2. Rota/contrato existente para restringir adição de participantes aos administradores e para ativar aprovação de entrada. Informar método, caminho, schema e referência ao código efetivo, sem chamar mutações.
3. Consulta que devolva estado real desses controles, participantes e administradores. Distinguir `restrict` (edição do grupo) dos dois controles de entrada. Ausência de campo é ausência de comprovação.
4. Aprovação/rejeição de pedido de entrada e identidade confiável do solicitante. Informar como o runtime resolve PN JID/LID sem interpretar LID como telefone.
5. Cabeçalhos personalizados em webhook e garantias reais de entrega/repetição/ordem. O B&C preparou cabeçalho dedicado `x-bc-group-secret`; não configurar agora e não enviar valor ao chat.
6. Possibilidade de reconciliar uma criação com resultado desconhecido usando correlação confiável. Nome do grupo/listagem por nome não atende.
7. Recibos por participante, se existirem: qual identidade confirma entrega ao Cliente, distinguindo aceite geral e leitura por terceiros.

Se não houver suporte, registrar **não disponível** e a evidência. Não instalar versão diferente nem presumir que a existência do recurso no aplicativo WhatsApp significa suporte na API. Propor uma extensão pontual e revisável, caso tecnicamente viável; decisão de mudança de provedor fica fora deste pedido.

## Retorno esperado

Criar relatório Markdown com:

- “Responde a”: este arquivo.
- Data/fuso, ambiente consultado e versão efetiva.
- Tabela por requisito: disponível/não disponível/não confirmado, evidência, limitação, próximo passo.
- Lista de consultas de leitura executadas e confirmação de nenhuma mutação.
- Nenhum token, senha, QR, convite, conteúdo de conversa ou dado pessoal desnecessário.

## Estado do trabalho local

Nº 105 e nº 106 **não instaladas**; nº 101–104 já aplicadas, não repetir. Função `whatsapp-groups` não publicada, novas solicitações desligadas e adaptador real com criação bloqueada. `WHATSAPP_GROUP_WEBHOOK_SECRET` será um segredo dedicado de servidor de pelo menos 32 caracteres aleatórios, gerado/custodiado apenas numa futura instalação autorizada. Não reutilizar a chave da Evolution.

Depois do relatório, o Codex revisará o contrato e completará a integração viável e os testes locais. Ainda faltam saída para grupo, convites/admissão/remoção, tarefas de manutenção, comparação operacional detalhada, recibos e piloto. Não há ação de “ligar tudo” autorizada.

## Reversão

Nesta conferência não deve haver mudança a reverter. Se alguma leitura exigir mutação, não executar; registrar o impedimento. Plano operacional futuro preserva evidências e pausa saídas, sem apagar grupos nem trocar números automaticamente.
