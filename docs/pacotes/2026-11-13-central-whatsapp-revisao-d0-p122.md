# P-122 — revisão da D0 e base para o desenvolvimento

**Data:** 13/11/2026, America/Sao_Paulo.

**Evidência:** `relatorio-ti-d0-central-whatsapp-compatibilidade-2026-11-13.md`, lido integralmente; SHA-256 `f23bb3379d4a806760d1e896e76a6b863ab78585eb5c0ea1e7270f4caf7c9681`. Relatório da TI às 01:00; fatos de produção abaixo são **relatados pela TI**, não uma nova consulta do Codex à VPS.

**Estado: D0 concluída. Nenhuma nova tarefa operacional para a TI nesta devolutiva.** Não reenviar o pedido D0 nem reinstalar as entregas anteriores. Próximo marco: desenvolvimento local de D1–D5 antes do pacote D6.

## 1. O que ficou confirmado

- Frontend publicado: `8b6898b`; correção do iPhone preservada e homologação física ainda pendente. Página WhatsApp aprovada, faixa de estatísticas e automação continuam somente locais.
- Supabase com nº 105–112 e 115–117, além dos incrementais Web Push; nº 113/114 **não instaladas**. Não aplicar as versões parciais da nº 113/114. As quatro migrations locais de 13/11 também não estão instaladas.
- Evolution atual fixada em `ghcr.io/proh2026media/bc-evolution-groups@sha256:f509e931336e76536869762777961deaad8a67f12c8586f61091e825fd030a81`, versão `2.3.7-bc.groups.2`. Patch SHA-256 `894d6d5744f44edc1827f26586ddbfeda5d2ce55e15676c9b28bf7da6b169429` coincide com a fonte local.
- Modelo de produção: principal e uma reserva no canal. `platform_set_whatsapp_route`, segunda reserva, métricas de grupo e serviço de atribuição automática ausentes.
- Distribuição por destino e `whatsapp_group_accounts`/composição de grupo são cadastros separados. Não há autorização implícita de participação ao atribuir número a uma loja.
- Banco e contrato protegido da Evolution ainda permitem composição com uma plataforma; não impõem dois admins. Renomeação após criação, descrição, foto, mensagem de boas-vindas/genérica e fixação estão ausentes desse contrato.
- `whatsapp-dispatch` roda a cada minuto. Os avisos de loja continuam no contrato por canal/instância; não há prova de que todos estejam forçados ao grupo. Isso não demonstra um envio privado nesta D0: não foram consultados destinatários ou mensagens nem efetuado envio.
- Reconciliação de grupos e `purge_whatsapp_send_audit` não possuem agendador. Web Push tem timer ativo e não faz parte desta alteração.
- Flags reais de grupo (`WHATSAPP_GROUP_PILOT_ENABLED`, `enrollment_enabled`, `login_enabled`) estão ligadas segundo a D0; isso **não** demonstra prontidão dos dois admins ou disponibilidade dos números. Não descrever o piloto como desligado nem alterar flags por iniciativa desta revisão.

## 2. Comparação local com os hashes instalados

Foram conferidos os 14 arquivos Edge listados no relatório:

| Resultado neste ramo | Arquivos                                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Coincidem (10)       | `_shared/whatsapp-groups.ts`, `_shared/whatsapp-group-login.ts`, `whatsapp-groups/index.ts`, `auth-otp/index.ts`, `auth-otp/login.ts`, `auth-otp/group-phone.ts`, `web-push/index.ts`, `_shared/evolution-groups.ts`, `whatsapp-dispatch/index.ts`, `whatsapp-health/index.ts` |
| Divergem (3)         | `whatsapp-groups/handler.ts`, `platform-whatsapp/index.ts`, `whatsapp-channel/index.ts`                                                                                                                                                                                        |
| Ausente no ramo (1)  | `_shared/whatsapp-instance-phone.ts`                                                                                                                                                                                                                                           |

Não substituir o receptor instalado por este ramo sem incorporar a correção nº 112. Não substituir o controle de conexão por uma versão que perca a classificação pessoal ou a normalização de identidade instalada.

Localizadas nesta máquina, sem novo pedido à TI, as fontes exatas das nº 111, 112, 115, 116 e 117 e os quatro arquivos Edge divergentes/ausentes. Nove arquivos foram preservados em [referência de compatibilidade](../../integrations/compatibilidade-central-whatsapp-2026-11-13/README.md), todos com SHA-256 coincidente com a D0. Para o receptor foi usado o pacote nº 112: o arquivo mais recente encontrado na pasta principal do projeto tinha outro hash e não foi tomado como base instalada.

As cópias têm sufixo `.referencia` e ficam fora das pastas executáveis. Não entraram em `supabase/migrations`/`supabase/functions`, não foram instaladas nem publicadas. Manifesto compara os hashes e registra proveniência. É referência de desenvolvimento, não backup completo da VPS ou pacote operacional.

## 3. Riscos adicionais encontrados ao comparar a fonte

### 3.1 Não apagar as proteções nº 115–117

A migration local `20261113001000` reescreve `platform_whatsapp_directory` com consulta direta ao catálogo. Sem adaptação, pode perder os filtros já instalados de número pessoal e de loja completa. Também reescreve `whatsapp_sending_paused` sem conservar a verificação de `personal_number` introduzida pela nº 115.

Antes de instalar, preservar explicitamente: número pessoal excluído do catálogo operacional, bloqueado para vínculos/grupos/envios; identidade correta; reserva sem loja; loja ativa com nome/slug/configurações/dono ativo. Não exigir logo, serviços ou equipe para uma loja nova legítima. Preservar os históricos e os números já classificados, sem alterá-los durante a migration.

A função local `whatsapp_operational_number` não substitui a classificação da nº 115: verificar o perfil pessoal não basta quando já existe uma classificação administrativa persistida. Proteger também ambos os números de reserva.

### 3.2 Ordem de travas precisa ser unificada

`platform_set_whatsapp_route` local obtém `whatsapp-egress` e depois `whatsapp-channel-routing`. A fonte instalada da nº 115 (`platform_mark_whatsapp_personal`) e da nº 116 obtém roteamento e depois egresso. Misturar essas ordens pode gerar impasse concorrente. É uma hipótese de concorrência identificada no código, **não** um incidente observado na VPS.

D1 deve estabelecer ordem única, testar duas transações simultâneas com classificação pessoal/configuração de rota e garantir que edição com versão antiga falhe sem sobrescrever. Não publicar a 01000 atual como contrato final de três posições.

### 3.3 Compatibilidade com a fila ativa

A fila de avisos já tem cron. Migração de rota deve manter vínculo/versão/identidade e impedir que uma tarefa preparada na versão anterior use o novo remetente sem nova autorização. Resultado incerto não pode autorizar troca de número nem reenvio. O cron de Web Push não substitui conciliação ou expurgo de WhatsApp.

### 3.4 Recriação não é diagnóstico

O `.env` em disco guarda chaves Web Push que podem se perder em um Coolify Redeploy. Não regenerar segredos nem usar Redeploy como ativação da página. O relatório menciona instâncias fora do ar por “alguns segundos” em uma recriação futura, mas a D0 não mediu essa duração; a futura janela precisa medir e registrar a interrupção real, sem prometer prazo.

## 4. Próxima sequência de desenvolvimento local

1. **Base compatível:** compor banco descartável e fontes a partir da evidência instalada, preservando nº 111/112/115/116/117 e sem aplicar nº 113/114. Esta composição ainda não foi executada nesta revisão; as cópias de referência não são instalação.
2. **D1 — três posições reais:** finalizar principal + reserva 1 + reserva 2 por destino, mesmas identidades físicas recusadas, herança, auditoria, versões, ordem única das travas e compatibilidade dos leitores antigos. Testar as proteções da seção 3 antes de preparar migration final.
3. **D2/D3 — dados e automação:** coleta comprovada somente de grupos, histórico minimizado sem backfill inventado; proposta/aplicação servidor idempotente, carga cumulativa e gatilho transacional no cadastro. Falta de par não desfaz a loja: comunicação aguarda números. Automação operacional nasce desligada.
4. **D4 — grupos e envio protegido:** completar contrato da extensão e B&C para dois admins, mudanças versionadas de composição, nome/logo/descrição/boas-vindas/fixação, ciclo anual, avisos efetivos por grupo e OTP. Não usar rotas genéricas bloqueadas nem fallback privado para compensar capacidade ausente.
5. **D5 — página autenticada:** ligar faixa aprovada e três posições a contratos reais, sem dados fictícios, preservando iPhone, cantos, teclado e carregamento somente quando necessário.
6. **D6 — pacote pronto:** arquivos completos sobre a base real, hashes, dependências, instalação/retorno ensaiados, agendadores sem duplicação e teste integrado. Somente depois cabem revisão operacional e instalação autorizada pela TI.

Os critérios de negócio e aceite continuam no [plano P-122](2026-11-13-ti-central-whatsapp-diagnostico-impactos-p122.md). Esta revisão acrescenta a evidência real e os cuidados de compatibilidade; não reduz o escopo aprovado nem declara D1–D5 concluídos.

## 5. Validação e limites desta revisão

- Relatório D0 lido por inteiro; hash conferido. Fonte do guia referida pela TI coincide com a entrega enviada.
- Quatro migrations locais e patch Evolution coincidem com os hashes informados pela TI; 14 arquivos Edge comparados; nove referências instaladas preservadas e conferidas.
- Nenhum segredo, `.env`, QR, código OTP ou conteúdo de conversa foi lido ou incluído na referência. Apenas fonte de código e hashes.
- Nenhuma mudança no runtime, banco, flags, cron, frontend publicado ou pasta da marca. Não houve novo teste de WhatsApp real, revalidação de número ou homologação no iPhone.
- Não foram repetidos testes funcionais de uma implementação que não mudou. A conferência executada é de integridade/compatibilidade das evidências e da documentação.

**Para o dono:** não precisa enviar outro pedido D0 à TI agora. O trabalho retorna ao desenvolvimento local. O próximo envio operacional será um pacote completo de implementação, sem pedir à TI para completar código faltante durante a instalação.
