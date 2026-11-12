# TI/Guardião — revisão e preparação do piloto de login em grupos

Data: 11/11/2026. Destinatário: TI do Barba & Cabelo. **Somente revisão/preparação, sem instalar ou ativar agora.** Não há tarefa para Flow/Claude. O pedido é diferente do diagnóstico Evolution já concluído: os novos artefatos de código estão prontos para revisão.

## Entrega concreta

- [Resumo B&C e limites](2026-11-11-p120-primeiro-acesso-grupo.md).
- [Evolution 2.3.7-bc.groups.2](../../integrations/evolution/grupos-v2/README.md): patch completo sobre `cd800f2976e1e5b682fbf86a01ee4d85ae61f370`, SHA-256 e reprodução local. Substitui v1; não aplicar ambos. Imagem construída localmente, ainda sem registry/digest remoto para instalar.
- B&C: nº 105, 106, 107, 108 e **109** (`20261111220000_grupos_primeiro_acesso.sql`), todas ainda locais. Não reaplicar nº 101–104, já relatadas como instaladas.
- Evolution tem **duas migrations próprias**, diferentes das do B&C. Nova tabela `BcGroupLease` não pode ser ignorada.
- Funções afetadas: `auth-otp`, `whatsapp-groups` e módulos compartilhados; cron/reconciliação dependem da função de grupos. Conservar a auditoria/saída protegida da nº 105 e seu pacote anterior.

## Conferência solicitada antes de proposta de janela

1. Conferir patch/hash e dependências em bancada separada, usando o provedor de banco real da Evolution. Não carregar sessões reais nem usar credenciais de produção na bancada. PostgreSQL já ensaiado localmente; se produção usar MySQL, executar ensaio específico antes de propor ativação.
2. Identificar um número/instância de piloto controlado apenas pela plataforma e um cliente de teste consentido. Profissionais não podem acessar conta/aparelho pareado, API key, painel, chat, logs, exportações ou backups. Conferir integrações externas/Chatwoot e evitar espelhar códigos. Não incluir contatos reais no relatório aberto.
3. Inventariar imagem atual por digest, banco/provedor, volumes/sessões, webhook/consumidores e política de logs. Usar evidência anterior quando ainda válida, sem repetir diagnóstico por rotina. Não registrar segredos nem corpos contendo códigos.
4. Propor backup/restauração e janela com medição: ensaiar reinício em bancada; na janela real registrar início/fim da indisponibilidade e estado de cada instância. Não prometer duração ainda não medida.
5. Preparar nomes das configurações, sem valores: Evolution `BC_GROUPS_EXTENSION_ENABLED`, `BC_GROUPS_INSTANCES`, `BC_GROUPS_PLATFORM_JIDS`, `BC_GROUPS_API_SECRET`; B&C `WHATSAPP_GROUP_PILOT_ENABLED`, `WHATSAPP_GROUP_API_SECRET`, `WHATSAPP_GROUP_WEBHOOK_SECRET`, `WHATSAPP_OTP_HMAC_KEY`. API/segredo de webhook diferentes; somente backend.
6. Propor agendamento de `whatsapp-groups` com ação `reconcile`, autenticação de serviço, execução sem sobreposição e conferência das operações pendentes. O webhook auxilia, mas pode faltar, repetir ou chegar fora de ordem. Nenhum job deve enviar código vencido ou repetir tentativa incerta.

## Restrição antes de publicar globalmente

Esta entrega valida **cliente novo e login de cliente**, inclusive em várias barbearias. O cadastro público de **nova barbearia** (`/cadastrar`/`register-shop`) ainda depende de prova legada cujo emissor privado é bloqueado pela nº 108. Desenvolver/validar sua alternativa autenticada antes de publicação geral. Não instalar a nova autenticação global isoladamente. Avisos/marketing/recibos do módulo completo de grupos também não estão sendo declarados prontos por este pacote.

É possível preparar um piloto isolado; isso não autoriza alterar o serviço de produção nem usar sessões reais automaticamente.

## Etapas futuras, cada uma com autorização específica

Depois de revisão, tratamento dos bloqueios aplicáveis e aprovação da janela: publicar/fixar imagem por digest; aplicar migrations Evolution; recriar container preservando volumes; configurar webhook; instalar nº 105–109/funções B&C; ativar flags e executar um piloto consentido. Não deduzir autorização dessas etapas da entrega do arquivo.

Para o piloto, testar: primeiro acesso por e-mail/Google; adesão com cliente + números autorizados; convite e admissão; telefone ainda não confirmado até o código; OTP somente no grupo; código único/expirado/incorreto; cliente ausente ou terceiro bloqueia; segundo grupo em outra loja com mesma conta/telefone; nome do grupo alterado conserva JID; pausa/saída impede envio; perda de resposta não repete nem troca número; profissionais sem acesso às conversas; recuperação por e-mail disponível. Nenhum teste de contorno de restrição ou rodízio.

## Volta e relatório

Interromper piloto e desligar flags ao primeiro desvio de composição/isolamento. Aplicar reversão operacional B&C nº 109 somente quando autorizada. Preservar diário, operações desconhecidas e `BcGroupLease`; trava após queda não deve ser apagada automaticamente. Confirmar ausência de processo/comando em curso e revisar a tentativa antes de qualquer liberação manual. Imagem anterior só retorna conforme plano de compatibilidade do banco; nunca apagar sessões/grupos como “limpeza”.

Devolver um relatório curto com: **Responde a: este arquivo**; revisão/hash conferidos; provedor de banco; itens aptos/não aptos e evidência sanitizada; isolamento; proposta de janela/medição/reversão; bloqueios; confirmação do que não foi alterado. Não devolver códigos, tokens, telefone completo ou dados de clientes. Este retorno não exige novo relatório do Claude.
