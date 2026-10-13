# Pendências — lista única e priorizada

Situação em **13/10/2026** (rodadas do Cursor: a segunda com as decisões do dono do mesmo dia; a terceira com a aplicação das 5 migrations e os testes reais na Loja Teste; antes, 12/10/2026). Esta é a lista única do que falta fazer. O registro detalhado de cada entrega continua em [CONTINUIDADE.md](../CONTINUIDADE.md), do mais novo para o mais antigo. Porta de entrada: [LEIA-PRIMEIRO.md](../LEIA-PRIMEIRO.md).

**Como usar**

- Cada item tem um id fixo (`P-01`, `P-02`…). Cite o id em commits, pedidos e no CONTINUIDADE. Não renumere: item resolvido fica marcado como **feito** com a data, e item novo recebe o próximo número livre.
- Situação: **pendente**, **feito — falta aplicar no banco**, **a decidir** (depende do dono), **não confirmado** (não deu para conferir daqui).
- Cada item foi conferido no código e nas migrations em 12/10/2026. As linhas citadas são dessa data.
- **Papéis da equipe no banco × nomes na tela:** `owner` e `partner` = **Dono** (sócio; `partner` é o nome antigo e aparece igual), `associate` = **Parceiro**, `employee` = **Contratado** ([roles.tsx](../../src/features/shop/roles.tsx), linhas 16-27; rótulos em `pt-BR.ts`, linhas 718-721). `shop_admin` é o papel antigo de `memberships`, que pode existir sem vínculo de equipe (CONTINUIDADE, onda 1 de 09/10).
- Último id usado: **P-65**.

**Índice**

1. [As 5 recomendadas para a próxima rodada](#1-as-5-recomendadas-para-a-próxima-rodada)
2. [Banco e servidor: precisa de migration](#2-banco-e-servidor-precisa-de-migration) (P-01 a P-14 e P-56 a P-62)
3. [Onda 4 do plano de ambientes](#3-onda-4-do-plano-de-ambientes-convite-e-primeira-chegada) (P-15 a P-20)
4. [Migrations escritas e não aplicadas; operação do servidor](#4-migrations-escritas-e-não-aplicadas-operação-do-servidor) (P-21 a P-29)
5. [Decisões do dono em aberto](#5-decisões-do-dono-em-aberto) (P-30 a P-39 e P-53)
6. [Testes manuais com contas reais](#6-testes-manuais-com-contas-reais) (P-40 a P-43)
7. [Dívida técnica](#7-dívida-técnica) (P-44 a P-48, P-51, P-52, P-55, P-63, P-64 e P-65)
8. [Ideias futuras](#8-ideias-futuras) (P-49, P-50 e P-54)

---

## 1. As 5 recomendadas para a próxima rodada

Atualizada em 13/10/2026, depois da aplicação de `20261013180000` e `20261013190000` (16:42), que resolveram P-56 a P-62 e P-64 ([implantacao-equipe-saida-2026-10-13.md](../implantacao-equipe-saida-2026-10-13.md)). Antes, na mesma data, a aplicação das 5 migrations (15:12) e os testes reais na Loja Teste. P-21, P-22, P-23, P-01, P-04, P-07, P-16 e P-54 estão aplicados; P-40 e P-41 foram testados (resultados na seção 6).

| Ordem | Itens      | O quê                                                                              | Por quê                                                                                                                             |
| ----- | ---------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1     | P-15       | Convite com link de entrada (WhatsApp e e-mail)                                    | Com a P-16 aplicada, a pessoa já é obrigada a trocar a senha; falta o link para não depender de repassar a senha à mão (decisão 9). |
| 2     | P-02, P-03 | Bloqueio da própria agenda e troca da própria foto pelo Contratado, no banco       | Últimas regras de papel da decisão 7 que ainda dependem da matriz de permissões.                                                    |
| 3     | P-17       | Boas-vindas "Você agora é Parceiro na Barbearia X"                                 | Fecha a onda 4 para quem já tinha conta.                                                                                            |
| 4     | P-08       | "Dar acesso ao painel" liga ao profissional que já existe                          | Hoje cria outro profissional.                                                                                                       |
| 5     | P-05, P-06 | Convite aguardando aprovação visível; primeiro dono de loja criada pela plataforma | Restos da sociedade no banco.                                                                                                       |

----- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | P-21, P-22, P-23, P-01, P-04, P-07, P-16, P-54 | Aplicar as 5 migrations e publicar 4 funções pelo guia único [implantacao-noite-2026-10-13.md](../implantacao-noite-2026-10-13.md) | Autorizado pelo dono para a noite de 13/10. Ensaio completo (144 PASS) feito numa cópia da estrutura do banco. Até aplicar, fuso, preparo, regras de papel, senha do convite e antecedência ficam parados. |
| 2 | P-40, P-41 | Testar com contas reais na "Loja Teste" ([testes-reais-loja-teste.md](../testes-reais-loja-teste.md)) | Autorizado pelo dono em 13/10. Roteiro, criação e limpeza prontos; depende da aplicação da noite. |
| 3 | P-15 | Convite com link de entrada (WhatsApp e e-mail) | Com a P-16 feita, a pessoa já é obrigada a trocar a senha; falta o link para não depender de repassar a senha à mão (decisão 9). |
| 4 | P-17 | Boas-vindas "Você agora é Parceiro na Barbearia X" | Fecha a onda 4 para quem já tinha conta. Precisa guardar "boas-vindas vista" por vínculo (banco). |
| 5 | P-02, P-03 | Bloqueio da própria agenda e troca da própria foto pelo Contratado, no banco | Últimas regras de papel da decisão 7 que ainda dependem da matriz de permissões. |

---

## 2. Banco e servidor: precisa de migration

Regra para todos os itens: migration nova em `supabase/migrations/`, teste SQL em `supabase/tests/` rodado em `BEGIN … ROLLBACK`, e um guia de implantação para o agente da VPS (modelo: [implantacao-preparo-2026-10-05.md](../implantacao-preparo-2026-10-05.md)). Detalhes em [banco-e-implantacao.md](banco-e-implantacao.md). Exceção: a parte de equipe de P-12 é só tela.

### P-01 — Contratado não pode sair levando clientes, também no banco · feito — aplicado em 13/10/2026 (15:12, horário de Brasília)

- **Aplicado e testado em 13/10/2026:** na Loja Teste, a saída do Contratado só oferece "Deixar aqui" e o pedido concluiu em `forfeit`, com o cliente ficando na loja. Restos, resolvidos em 13/10/2026 (noite): o subtítulo do Contratado agora diz "Deixar a equipe. Seus clientes continuam nesta barbearia." (commit `531feff`); o 403 de `list_shop_departure_requests` saiu com a P-58.

- **Feito em 13/10/2026 (Cursor):** `20261013120000_regras_papel_banco.sql` recusa `take` de `employee` com `42501`; teste `regras_papel_banco.sql` (19 PASS no ensaio em produção, cobre Contratado, Parceiro e dono único). Aplicação autorizada para a noite de 13/10 pelo guia único [implantacao-noite-2026-10-13.md](../implantacao-noite-2026-10-13.md) (detalhes em [implantacao-regras-papel-2026-10-13.md](../implantacao-regras-papel-2026-10-13.md)).

- **Por quê:** decisão 7 do [plano-ambientes.md](../plano-ambientes.md) (seção 5): o Contratado sai sem levar clientes. Os modos de saída são `take` (levar a carteira) e `forfeit` (sair sem ela).
- **Regra de hoje:** em `request_shop_departure` ([20261003150000_correcoes_auditoria.sql](../../supabase/migrations/20261003150000_correcoes_auditoria.sql), linhas 382-389), `take` de `owner`/`partner` vira `pending_release` (espera a liberação de outro dono), com `42501` só para o sócio único. Qualquer outro papel, o Contratado (`employee`) inclusive, cai no `else`: o pedido nasce `approved` e `complete_shop_departure` move a carteira na hora (linhas 399-402). Basta a pessoa já estar ativa na equipe da loja de destino (linhas 360-365). Hoje só a tela impede.
- **Saída:** recusar `take` quando `member.role = 'employee'`, com errcode `42501`.
- **Gancho na tela:** [ShopDepartureCard.tsx](../../src/features/shop/settings/ShopDepartureCard.tsx) já esconde a opção (`canTakeClients`, linhas 69, 93 e 217), pela regra `takeClientsOnLeave` ([capabilities.ts](../../src/lib/auth/capabilities.ts), linha 130).
- **Pronto quando:** `p_mode = 'take'` com membro `employee` falha com `42501`; `forfeit` continua aceito; teste SQL cobre Contratado, Parceiro e dono.
- Fonte: CONTINUIDADE, onda 3 de 09/10 ("Pendências de banco").

### P-02 — Bloqueio da própria agenda para o Contratado sem depender de "serviços próprios" · pendente

- **Por quê:** decisão 7. A política "Professionals manage own blocks" exige `shop_can_manage_own_services` ([20260917150000_shop_role_permissions.sql](../../supabase/migrations/20260917150000_shop_role_permissions.sql), linhas 277-282), que vem desligada para o Contratado.
- **Duas saídas:** (a) permissão nova `manage_own_blocks` no `shop_permission_catalog`, ligada por padrão para todos os papéis, usada na política; (b) só tirar a exigência da política.
- **Gancho na tela:** [capabilities.ts](../../src/lib/auth/capabilities.ts) (linhas 97-99) já lê `manage_own_blocks` se ela vier em `get_my_shop_permissions`.
- **Pronto quando:** Contratado com a matriz padrão cria e apaga só o próprio bloqueio; bloqueio de colega continua recusado.

### P-03 — Contratado troca a própria foto · pendente

- **Por quê:** as políticas do bucket `barbershop-services` ([20260924140000_service_description_staff_media.sql](../../supabase/migrations/20260924140000_service_description_staff_media.sql): envio nas linhas 162-180, troca 182-216, exclusão 218-236) aceitam o admin da plataforma (`is_platform_admin`), o `shop_admin` antigo, `owner`/`partner`/`associate` e quem tem `manage_services` ou `manage_own_services`. O Contratado só entra se o dono lhe der `manage_own_services`, que vem desligada para ele (`shop_permission_default`, [20260917170000_shop_permission_money_semantics.sql](../../supabase/migrations/20260917170000_shop_permission_money_semantics.sql), linha 51).
- **Pré-requisito:** hoje a foto é gravada em `<loja>/staff/<uuid aleatório>.<ext>` ([service-image.ts](../../src/lib/shop/service-image.ts), linha 79). O caminho não diz de quem é a foto, então nenhuma política consegue limitar o Contratado ao próprio perfil. Gravar em `<loja>/staff/<staff_id>/…`, para a política comparar a pasta com `current_staff_id(loja)` ([20260917120000_shop_team_governance.sql](../../supabase/migrations/20260917120000_shop_team_governance.sql), linha 88).
- **Gancho na tela:** em [MyProfileCard.tsx](../../src/features/shop/settings/MyProfileCard.tsx) a foto do Contratado aparece travada ("A foto quem troca é o dono da barbearia."). A trava vem de `ownPhoto` ([capabilities.ts](../../src/lib/auth/capabilities.ts), linha 126), que precisa mudar junto com a política.
- **Pronto quando:** o Contratado envia e troca só arquivos em `<loja>/staff/<seu staff_id>/` (políticas de insert e update), sem acesso às fotos de serviço nem às dos colegas.

### P-04 — Bloqueios de colegas sem nome e sem motivo vindos do banco · feito — aplicado em 13/10/2026 (15:12, horário de Brasília)

- **Aplicado e testado em 13/10/2026:** o bloqueio do dono com motivo escrito aparece ao Parceiro como "Colega indisponível"; na rede, `list_shop_blocks` devolve `reason` e `staff_display_name` nulos, e a leitura direta da tabela devolve lista vazia.

- **Feito em 13/10/2026 (Cursor):** mesma migration da P-01. Política de leitura refeita (visão geral lê tudo; os demais, os próprios e os da loja inteira) e RPC `list_shop_blocks` com motivo e nome nulos para colegas. O `ShopShell` já usa a RPC e volta à leitura antiga enquanto ela não existir. Vai na aplicação da noite de 13/10 ([implantacao-noite-2026-10-13.md](../implantacao-noite-2026-10-13.md)); a conferência na aba Rede está no roteiro da loja de teste (P-41).

- **Por quê:** decisão 14. A política "Professional members read blocks" ([20260917120000_shop_team_governance.sql](../../supabase/migrations/20260917120000_shop_team_governance.sql), linhas 446-447) libera a linha inteira para qualquer profissional, e o painel lê `select("*, staff:staff(display_name)")` ([ShopShell.tsx](../../src/features/shop/ShopShell.tsx), linhas 613-617). Motivo e nome chegam ao aparelho; só a tela esconde ("Colega indisponível").
- **Saída:** RPC ou visão para quem não tem `view_agenda_all`, sem `reason` nem `display_name` de colegas, ou filtro na política.
- **Arquivos da tela:** `ShopShell.tsx` e [BlocksCard.tsx](../../src/features/shop/hours/BlocksCard.tsx).
- **Pronto quando:** a resposta da API para Parceiro/Contratado não traz motivo nem nome de colega (conferir na aba Rede do navegador).

### P-05 — Convite "aguardando aprovação" legível pela pessoa convidada · pendente

- **Por quê:** em sociedade igualitária o convite fica em `shop_change_requests`, que a pessoa convidada não lê. O motivo `aguardando` nunca é detectado.
- **Gancho na tela:** `ACCESS_NOTICES` já tem `"aguardando"` ([destination.ts](../../src/lib/auth/destination.ts), linha 24), com texto pronto. Falta [session.ts](../../src/lib/auth/session.ts) (`professionalRefusal`, linhas 177-195) chamar uma RPC como `get_my_pending_shop_invites()` (loja e papel).
- **Pronto quando:** a conta com convite pendente cai em `/app?aviso=aguardando` e vê o aviso.

### P-06 — Primeiro dono de uma barbearia criada pela plataforma · pendente

- **Por quê:** `apply_add_shop_member` exige que um dono existente ceda parte ([20260925140000_shop_society_founder_and_team.sql](../../supabase/migrations/20260925140000_shop_society_founder_and_team.sql), linhas 103 e 134) e o [invite-shop-admin](../../supabase/functions/invite-shop-admin/index.ts) recusa 100% (linhas 79-81). Loja sem dono não consegue receber o primeiro.
- **Gancho na tela:** [NewShopDialog.tsx](../../src/features/platform/NewShopDialog.tsx) oferece "Adicionar pessoa"; depois da mudança pode oferecer "Adicionar dono" com o papel já escolhido.
- **Pronto quando:** loja sem dono ativo aceita `owner` com 100% (ou sem %), e a regra de ceder parte continua para lojas que já têm dono.

### P-07 — Contagem de "Administradores" na plataforma (PLAT-01, decisão 12) · feito — aplicado em 13/10/2026 (15:12, horário de Brasília)

- **Aplicado em 13/10/2026:** conferência do guia ok. A tela `/platform` não foi aberta nos testes (exige a conta de admin do dono).

- **Feito em 13/10/2026 (Cursor):** RPC `list_platform_shop_owners` (mesma migration da P-01); `shopCounts.ts` conta por ela, com volta ao `shop_admin` enquanto ela não existir; demonstração com o dono fictício. Levantamento (só leitura): 0 contas `shop_admin` sem vínculo de equipe; as 2 lojas ativas dão o mesmo resultado nas duas contas. Vai na aplicação da noite de 13/10 ([implantacao-noite-2026-10-13.md](../implantacao-noite-2026-10-13.md)).

- **Por quê:** [shopStats.ts](../../src/features/platform/shopStats.ts) (linhas 9-19) conta `memberships.role = 'shop_admin'`, e [PlatformDashboard.tsx](../../src/features/platform/PlatformDashboard.tsx) (linhas 87-88) usa essa conta. Donos adicionados pela plataforma ficam de fora. A ficha da loja já conta pela equipe (`list_shop_team_members`).
- **Saída:** RPC agregada que devolva, por loja, quantos donos e sócios ativos há em `shop_members`. Usar em `shopStats.ts`, no `PlatformDashboard`, no `PlatformShell` e na lista de atenção. Trocar também o dado da demonstração (`shop_admin` "demo-admin" em [PlatformShell.tsx](../../src/features/platform/PlatformShell.tsx), linha 175).
- **Antes:** levantar no banco quantas contas têm `shop_admin` sem vínculo de equipe (risco da seção 6 do plano de ambientes).
- **Pronto quando:** painel geral, lista de atenção e ficha mostram o mesmo número.

### P-08 — "Dar acesso ao painel" liga ao profissional que já existe · pendente

- **Por quê:** dar acesso a um profissional "só na agenda" cria outro profissional. `apply_add_shop_member` procura o `staff` pelo `user_id` (mesma migration de P-06, a partir da linha 70) e não recebe o id do profissional existente.
- **Pronto quando:** o convite feito pelo cartão do profissional liga a conta à linha de `staff` existente, sem duplicar. Fonte: CONTINUIDADE, onda 3 de 08/10.

### P-09 — Ficha do cliente pela Agenda na visão de equipe · pendente

- **Por quê:** `get_team_schedule` ([20261003150000_correcoes_auditoria.sql](../../supabase/migrations/20261003150000_correcoes_auditoria.sql), linhas 959-1011) devolve `customer_name`, mas não `customer_id`. Na agenda própria e na demonstração o nome já abre a ficha.
- **Pronto quando:** a RPC devolve `customer_id` só para quem pode ver aquele cliente, e o nome abre a ficha também na visão de equipe.

### P-10 — Pausa fixa semanal · pendente

- **Por quê:** `availability_blocks` só tem início e fim ([20260915160000_shop_availability.sql](../../supabase/migrations/20260915160000_shop_availability.sql), linhas 18-28), sem repetição. Hoje o almoço diário é um bloqueio por dia.
- **Pronto quando:** existe bloqueio que se repete por dia da semana, respeitado por `available_slots_internal` e desenhado em Horários.

### P-11 — Logo da barbearia nos cartões da plataforma · pendente

Listado em "Banco ou regra de dados" no CONTINUIDADE (onda 3, 08/10). A lista da plataforma não usa `logo_url` (só a prévia do login usa, `PlatformShell.tsx` linha 844). O que falta no banco: **não confirmado** (pode ser só leitura de `barbershop_settings`).

### P-12 — E-mail para diferenciar pessoas com o mesmo nome na plataforma · pendente

Mesma fonte de P-11. Na plataforma, as pessoas aparecem pelo nome em duas listas (conferido em `src/features/platform/` em 12/10):

- **Equipe na ficha da loja — só tela, sem banco.** `list_shop_team_members` já devolve `email` ([20260925140000](../../supabase/migrations/20260925140000_shop_society_founder_and_team.sql), linha 541) e aceita o admin da plataforma (linha 520). O tipo `TeamMember` já tem o campo ([team.tsx](../../src/features/shop/team.tsx), linha 17). Falta mostrar o e-mail em [ShopTeamList.tsx](../../src/features/platform/ShopTeamList.tsx) (linhas 118-129).
- **Gerentes de conta — precisa de banco.** [AccountManagersPanel.tsx](../../src/features/platform/AccountManagersPanel.tsx) lê só `profiles.full_name` (linhas 117-123), e `profiles` não tem e-mail (`src/integrations/supabase/types.ts`, linhas 175-184). Precisa de uma RPC, só para o admin, que devolva o e-mail de `auth.users`.

Se o pedido original incluía outras listas: **não confirmado**.

### P-13 — `save_shop_permissions` zera as permissões travadas do Contratado · pendente (opcional)

A tela já trava e ignora `manage_services`, `manage_operations`, `manage_team` e `manage_permissions` no papel `employee`, mas o banco ainda aceita gravá-las, sem efeito (função na [20260925140000](../../supabase/migrations/20260925140000_shop_society_founder_and_team.sql), linha 754).

### P-14 — "Última área" e loja escolhida guardadas no perfil · pendente (opcional)

Hoje ficam no aparelho e por domínio: `arena:last-area:<user_id>`, `arena:active-shop-actor:<user_id>` e `arena:last-customer-shop:<user_id>` (CONTINUIDADE, ondas 1, 2 e 5 de 09/10; no código, `destination.ts` linha 167, `shop-acting.ts` linha 282 e `shop-choice.ts` linha 13, conferido em 12/10). No perfil, valeriam entre aparelhos e domínios. Origem do pedido: relatório da onda 2, fora do repositório; nenhum documento do projeto registra esta pendência.

### P-56 — Fuso da loja lento derruba a página pública e os horários · feito — aplicado em 13/10/2026 (16:42)

- **Feito em 13/10/2026:** `20261013180000_papeis_atuais_e_fuso.sql`. `shop_tz` caiu de ~407 ms para 1,3 ms por chamada; a página pública da Loja Teste, de 4,4 s para 93 ms no banco (0,65 s até os dados chegarem ao navegador); a Arena, de 1,4 s para 5 ms. `landing.show_today` religado na Loja Teste e conferido no site.

- **Achado nos testes de 13/10/2026.** `shop_tz` valida o fuso varrendo `pg_timezone_names` (~0,5–0,75 s por chamada) e é chamada 2 vezes por `available_slots_internal` (~1,4 s por profissional e dia). A página pública da Loja Teste (5 profissionais) levou ~7 s e o visitante tem limite de 3 s; a Arena leva ~1,7 s e piora a cada profissional novo. Vem da `20261002190000_booking_rules_single_source` (antiga, não das de 13/10).
- **Saída sugerida:** migration que valide o fuso sem varrer `pg_timezone_names` (por exemplo, `now() at time zone` em bloco protegido, ou guardar o fuso já validado) e chame `shop_tz` uma vez por consulta.
- **Contorno em uso:** na Loja Teste, `landing.show_today` desligado.

### P-57 — `list_pending_shop_changes` sempre falha · feito — aplicado em 13/10/2026 (16:42)

- **Feito em 13/10/2026:** marcada `VOLATILE` na mesma migration da P-56; responde 200 aos donos e 403 aos demais.

Marcada `STABLE`, mas faz `UPDATE` (expira pedidos antigos): o Postgres recusa com `0A000`. A tela de aprovação usa outro caminho e funcionou nos testes; a função fica quebrada para quem a chamar. Vem de 24/09/2026. Saída: tirar o `UPDATE` ou marcar `VOLATILE`.

### P-58 — 19 funções só aceitam o `shop_admin` antigo · feito — aplicado em 13/10/2026 (16:42)

- **Feito em 13/10/2026:** mesma migration da P-56. Inventário central em 4 auxiliares (`shop_is_team`, `shop_can_see_booking`, `shop_can_act_on_appointment`, `shop_can_view_reports`) que seguem a matriz atual e nunca devolvem nulo; o `shop_admin` antigo continua aceito. Teste por papel em `supabase/tests/papeis_atuais_e_fuso.sql` (26 PASS). Conferido pela API com o login de cada conta da Loja Teste. `list_shop_departure_requests` abre para toda a equipe (cada um vê os próprios pedidos).

- **Achado nos testes de 13/10/2026.** Estas funções conferem só `has_shop_role(loja, 'shop_admin')` (tabela `memberships`) e recusam quem entrou pela equipe (`shop_members`): `cancel_appointment`, `create_booking_series`, `create_direct_appointment`, `get_appointment_attendance`, `get_appointment_cancellations`, `get_available_slots`, `get_business_insights`, `get_occurrence_insights`, `get_service_interest_insights`, `get_staff_busy_intervals_without_waits`, `get_waiting_state`, `guard_waiting_settings`, `pick_available_staff`, `record_attendance`, `record_customer_survey_response`, `record_customer_usage`, `save_appointment_occurrence`, `waiting_action`, `withdraw_appointment_confirmation`.
- **Efeito:** o sócio de 30% e o Parceiro recebem "Not allowed" até em `get_appointment_attendance`; a Agenda mostra "Você não tem permissão para fazer isso com esta conta.". Também `list_shop_departure_requests` responde 403 ao Parceiro e ao Contratado. Nas lojas reais, hoje, cada loja tem só o dono original com `shop_admin`, por isso ainda não apareceu.
- **Saída:** migration que troque a conferência pela permissão da equipe certa (`shop_can…`/`has_shop_member_role`), mantendo o `shop_admin` antigo, com teste por papel.

### P-59 — Reconvidar quem saiu da equipe · feito — aplicado em 13/10/2026 (16:42)

- **Feito em 13/10/2026:** `20261013190000_saida_equipe_reservas.sql`. O convite reativa a linha (papel novo e ficha de profissional ativa); conta ativa recebe "Esta pessoa já está na equipe. Para mudar o papel, use Gerenciar." Retestado no site.

Convidar de novo uma conta que já saiu dá `This account already belongs to the professional team` (a linha inativa continua em `shop_members`); a tela mostra só "Não foi possível enviar o convite". Contorno: Gerenciar → Ativo. Saída: o convite reativar a linha, ou a tela explicar e oferecer "Reativar".

### P-60 — Reativar membro e janela Gerenciar · feito — aplicado em 13/10/2026 (16:42)

- **Feito em 13/10/2026:** mesma migration da P-59. Ativar/pausar o vínculo leva junto a ficha de profissional; pausar apaga o acesso antigo de dono (`shop_admin`). A janela Gerenciar passa a mostrar o estado salvo. Retestado no site.

Reativar o membro em Gerenciar não reativa a ficha `staff` dele (continua fora da agenda e da página pública); e a janela Gerenciar continua mostrando o estado antigo depois de salvar, até fechar e abrir de novo.

### P-61 — Reservas futuras com quem saiu da equipe · feito — aplicado em 13/10/2026 (16:42)

- **Feito em 13/10/2026 (decisão do dono: resolver antes de liberar):** o banco recusa tirar da equipe, concluir ou liberar a saída de quem tem reserva futura (gatilho `shop_members_exit_future_bookings`, `complete_shop_departure`, `approve_portfolio_release`). Saída sem levar clientes com reserva vira pedido que o dono não recusa (só resolve e libera) e que o próprio profissional pode desistir (`cancel_shop_departure`). Em Ajustes → Equipe e sociedade, o dono passa cada reserva para um colega livre (`reassign_appointment_staff`, que gera o aviso de remarcação) ou cancela com o aviso já existente; reservas de quem saiu antes aparecem em "Reservas de quem saiu da equipe". Retestado no site.

Depois da saída do Contratado e do Parceiro, as reservas futuras com eles continuaram "confirmadas", com profissional inativo. Decidir: cancelar e avisar o cliente, passar para outro profissional, ou pedir ao dono que resolva antes de liberar a saída.

### P-62 — Parceiro leva a carteira sem liberação do dono · feito — aplicado em 13/10/2026 (16:42)

- **Feito em 13/10/2026 (decisão do dono: depende da liberação):** a saída levando clientes de qualquer papel espera a liberação de um dono. Retestado no site: o Parceiro não conclui sozinho, outro Parceiro não aprova, o dono só libera depois de resolver as reservas.

`request_shop_departure` só pede liberação quando quem sai é dono/sócio (`owner`/`partner`); o Parceiro (`associate`) sai na hora levando a carteira para a loja de destino, que ele mesmo pode criar no próprio fluxo. O roteiro de teste esperava liberação do dono. Decidir se a regra fica assim (e corrigir o roteiro) ou se o Parceiro também passa pela liberação.

---

## 3. Onda 4 do plano de ambientes: convite e primeira chegada

Fonte: [plano-ambientes.md](../plano-ambientes.md), seção 4 ("Onda 4") e decisões 6 e 9 (aprovadas em 09/10). **Nada da onda 4 foi começado** (conferido em 12/10: nenhuma marca de troca de senha nem de boas-vindas no código ou nas migrations). Precisa de banco e de função.

| Id   | O quê                                                                                                                                                                            | Situação hoje (conferida)                                                                                                                                                                                                                                                                                   | Pronto quando                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| P-15 | Convite com link de entrada no domínio da loja, por e-mail (fila `email_outbox`) ou WhatsApp, com cartão pronto para compartilhar                                                | [invite-shop-admin](../../supabase/functions/invite-shop-admin/index.ts) cria a conta com senha temporária (linhas 166-181) e não envia nada. O texto diz "Envie a senha temporária para a pessoa" (`pt-BR.ts`, linha 865). Tela: [ShopTeamAccessCard.tsx](../../src/features/shop/ShopTeamAccessCard.tsx). | A pessoa recebe um link que abre a loja certa; quem já tinha conta também é avisado |
| P-16 | Troca obrigatória da senha temporária no primeiro login — **feito — função `invite-shop-admin` publicada em 13/10/2026 (15:13)** e testada com 3 contas convidadas na Loja Teste | Janela "Crie sua senha" (`PasswordChangeGate.tsx`) pela marca `must_change_password` nos dados da conta, gravada pela função de convite. Publicação na noite de 13/10: [implantacao-noite-2026-10-13.md](../implantacao-noite-2026-10-13.md), passo 6                                                       | Conta criada por convite não usa o painel antes de trocar a senha                   |
| P-17 | Tela "Você agora é Parceiro na Barbearia X", também para quem já tinha conta                                                                                                     | Não existe. Exige guardar "boas-vindas vista" por vínculo                                                                                                                                                                                                                                                   | Aparece uma vez por vínculo novo, com loja, papel e resumo de "Seu acesso"          |
| P-18 | `/cadastrar` com sessão aberta ("Você vai usar a conta x@y") e, no erro de e-mail em uso, "Entrar e abrir minha barbearia"                                                       | [cadastrar.tsx](../../src/routes/cadastrar.tsx) não lê a sessão. O plano aponta `register-shop` e trechos de `cadastrar.tsx` (linhas de 09/10)                                                                                                                                                              | Cliente com conta abre uma barbearia com o mesmo e-mail                             |
| P-19 | Gerente de conta: esconder o convite até existir tela (decisão 6)                                                                                                                | O painel da plataforma ainda mostra [AccountManagersPanel](../../src/features/platform/AccountManagersPanel.tsx) (`PlatformShell.tsx` linha 573, `ShopDetail.tsx` linha 245). O gerente entra pelo `/app` ([session.ts](../../src/lib/auth/session.ts), linhas 39-45)                                       | Não há como criar gerente sem tela própria, ou a tela própria existe                |
| P-20 | Guia de configuração da loja guardado no banco, com o passo "Equipe e sócios" (S9)                                                                                               | [ShopSetupChecklist.tsx](../../src/features/shop/ShopSetupChecklist.tsx) guarda no aparelho (`shopSetup:<loja>`, linhas 34-48)                                                                                                                                                                              | O progresso do guia é o mesmo em qualquer aparelho                                  |

---

## 4. Migrations escritas e não aplicadas; operação do servidor

### Migrations (aplicar nesta ordem)

**Aplicadas em 13/10/2026.** As três abaixo, mais a `20261013120000` (P-01, P-04, P-07) e a `20261013150000` (P-54), foram aplicadas entre 15:12:47 e 15:12:55 (horário de Brasília) pelo guia [implantacao-noite-2026-10-13.md](../implantacao-noite-2026-10-13.md): estado antes `f|f|f|f|f`, backup `/root/backup-barba-cabelo-20261013-1811.dump` (1,2 MB), ensaio 144 PASS desfeito, conferências iguais às esperadas. Última aplicada: `20261013150000_antecedencia_minima`. Detalhes no CONTINUIDADE (13/10).

Como conferir no servidor: a consulta do passo 1 de [implantacao-preparo-2026-10-05.md](../implantacao-preparo-2026-10-05.md) (linha 37) responde pela 220000 (`purge_auth_otp_challenges`) e pela 230000 (`set_shop_timezone`). O guia de ajustes finais não tem consulta, e nenhum guia confere a própria 05120000, que cria a coluna `barbershop_settings.prep_minutes` (`20261005120000_tempo_preparo.sql`, linha 28). Consulta sugerida para as três de uma vez (só leitura; não está nos guias):

```sql
select
  exists(select 1 from pg_proc where proname = 'purge_auth_otp_challenges') as tem_220000,
  exists(select 1 from pg_proc where proname = 'set_shop_timezone') as tem_230000,
  exists(select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'barbershop_settings'
           and column_name = 'prep_minutes') as tem_05120000;
```

| Id   | Migration                                   | Funções a publicar                    | Guia                                                                                    | O que destrava na tela                                                                                                                                                                         |
| ---- | ------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-21 | `20261003220000_ajustes_finais.sql`         | `google-connect`, `whatsapp-dispatch` | [implantacao-ajustes-finais-2026-10-03.md](../implantacao-ajustes-finais-2026-10-03.md) | Apagar loja inteira; `save_my_whatsapp` sem revelar número de outra conta; limpeza de OTP; janela da Agenda Google −7/+60 dias                                                                 |
| P-22 | `20261003230000_decisoes_whatsapp_fuso.sql` | `register-shop`                       | [implantacao-decisoes-2026-10-03.md](../implantacao-decisoes-2026-10-03.md)             | Avisos só para WhatsApp confirmado; fuso da loja no cadastro e em Ajustes ([ShopTimezoneCard.tsx](../../src/features/shop/settings/ShopTimezoneCard.tsx) fica "disponível em breve" sem a RPC) |
| P-23 | `20261005120000_tempo_preparo.sql`          | nenhuma                               | [implantacao-preparo-2026-10-05.md](../implantacao-preparo-2026-10-05.md)               | Campos de tempo de preparo (escondidos até a coluna `prep_minutes` existir)                                                                                                                    |

Situação dos três: **feito — aplicado em 13/10/2026 (15:12, horário de Brasília)**; funções `google-connect`, `whatsapp-dispatch` e `register-shop` publicadas às 15:13. Histórico: aplicação autorizada pelo dono para a noite de 13/10/2026, junto com a `20261013120000` e a `20261013150000` (P-54), pelo guia único [implantacao-noite-2026-10-13.md](../implantacao-noite-2026-10-13.md) (ensaio completo esperado: 144 PASS). Em 13/10/2026 (Cursor), uma consulta de leitura no banco de produção confirmou `f|f|f` (nenhuma das três aplicada), e o ensaio encadeado das três com os testes dos guias deu **111 PASS** em transação desfeita, sem deixar nada gravado (CONTINUIDADE, registro de 13/10). Sempre: backup, ensaio em `BEGIN … ROLLBACK`, nunca rodar arquivo de `supabase/tests/` fora de transação (incidente de 03/10 no CONTINUIDADE).

### Operação do servidor (sem migration)

- **P-24 — Acesso de push da VPS ao GitHub · pendente.** A VPS não envia ao `origin` (`vez.sh pedir` falhou em 03/10), então cada implantação precisa ser registrada por outra máquina. CONTINUIDADE, linha 270.
- **P-25 — Realtime volta a parar num "Redeploy" · feito (13/10/2026).** Por decisão do dono, a configuração salva do Coolify (`docker_compose_raw` e `docker_compose` do serviço) passou a ter, no `realtime-dev`, `restart: unless-stopped` e o limite de 0,5 CPU / 512 MB; o arquivo do servidor ganhou o mesmo limite. Backups antes de mexer; só o `realtime-dev` foi recriado (os outros containers mantiveram o mesmo id). Realtime conferido antes (2/2 sinais recebidos) e depois (3/3, média de ~160 ms). Detalhes no CONTINUIDADE, entrega de 13/10. Continua valendo: não usar "Redeploy" sem necessidade.
- **P-26 — Tarefa do crontab do root chamando `google-drive/share-expire` · a decidir.** Função que não existe neste projeto (erros 500 inofensivos a cada 15 min). Provavelmente de outro projeto; não remover sem o dono confirmar. CONTINUIDADE, linha 418.
- **P-27 — Certificado de subdomínio para cada loja nova · pendente (passo manual).** Ao criar loja, acrescentar o roteador dela em `/data/coolify/proxy/dynamic/beauty-shop-certs.yaml`. CONTINUIDADE, linha 495. Exemplo pronto, com conferência do certificado: passo 4 de [testes-reais-loja-teste.md](../testes-reais-loja-teste.md).
- **P-28 — Reenviar a verificação OAuth do Google · pendente (dono).** Política e funcionalidade corrigidas em 03/10; falta gravar o vídeo e reenviar no projeto `proh-media-drive`. Guia: [google-verificacao.md](../google-verificacao.md).
- **P-29 — Conferir no servidor: logs de 6 meses (Marco Civil) e VPN do painel · não confirmado.** Citados a partir da documentação de operação, nunca conferidos. CONTINUIDADE, linha 304.

---

## 5. Decisões do dono em aberto

Quando o documento de origem não traz recomendação, a coluna diz **sugestão** (não aprovada).

| Id   | Pergunta                                                                                                                                                         | Hoje                                                                                                                                                                             | Recomendado / sugestão                                                                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-30 | "Toda semana" × "A cada 7 dias": existe diferença real?                                                                                                          | Uma pílula só, "Toda semana", que grava `kind = weekday` ([BookingParts.tsx](../../src/features/customer/booking/BookingParts.tsx), linha 949). O servidor aceita as duas formas | Sugestão: manter uma opção só, como está                                                                                                                                                  |
| P-31 | Quem escolhe "Qualquer profissional" vê as vagas de todos na lista de espera?                                                                                    | Não vê: na tela de agendar, a espera filtra pelo profissional escolhido, e "Qualquer profissional" não escolhe nenhum (ver notas)                                                | Sem recomendação registrada                                                                                                                                                               |
| P-32 | Nome da aba "Reservas"                                                                                                                                           | `nav.bookings` = "Reservas" (`pt-BR.ts`, linha 376)                                                                                                                              | Sem recomendação registrada                                                                                                                                                               |
| P-33 | Aba Esportes sempre visível ou só com jogos?                                                                                                                     | Aparece só com `sports_enabled` da loja ([ArenaApp.tsx](../../src/features/customer/ArenaApp.tsx), linhas 2539-2541), ligado pelo admin da plataforma                            | Sem recomendação registrada                                                                                                                                                               |
| P-34 | Bônus de check-in em dia de jogo                                                                                                                                 | O texto foi retirado porque a regra de pontos não existe                                                                                                                         | Se quiser, vira regra de verdade no clube de pontos (precisa de banco)                                                                                                                    |
| P-35 | Acerto de contas com o Parceiro: as 3 perguntas de 08/10 (origem fora do repositório, ver notas)                                                                 | Não existe pagamento, comissão, aluguel de cadeira nem repasse. Cada profissional vê só a própria produção (`get_partner_wallet`); qualquer acerto acontece fora do app          | Responder: (1) comissão em %, aluguel fixo, mistura ou sem repasse? (2) o cliente paga ao caixa ou ao barbeiro? (3) só o cálculo do mês ou também cobrança online (Pix, cartão)? Ver P-50 |
| P-36 | Seletor de loja do cliente no domínio próprio de uma loja (C9): levar ao domínio da outra loja? (origem: ver notas)                                              | A troca vai para `/app?shop=<loja>` no domínio atual (`customerShopHref`, [shop-choice.ts](../../src/features/customer/shop-choice.ts), linhas 122-127)                          | Sugestão: manter no domínio atual, porque as sessões são separadas por domínio e a troca pediria novo login ([plano-ambientes.md](../plano-ambientes.md), linha 256)                      |
| P-37 | Profissional que abre o app da própria loja (C11): criar ficha de cliente?                                                                                       | Cria a ficha, e o [ShopJoinDialog.tsx](../../src/features/customer/ShopJoinDialog.tsx) avisa ("Isso cria sua ficha de cliente nesta barbearia", linha 76)                        | Se mudar (não criar, ou marcar como ficha de equipe), mexe em `join_shop_as_customer` e nas regras de `memberships`                                                                       |
| P-38 | Avisos por WhatsApp do dono no cadastro da loja                                                                                                                  | `register-shop` grava o consentimento sempre ligado (`p_opt_in: true`, [index.ts](../../supabase/functions/register-shop/index.ts), linha 122)                                   | Sem recomendação registrada. Fonte: CONTINUIDADE, linha 253                                                                                                                               |
| P-39 | Acordo de Tratamento de Dados (`/acordo-de-dados`)                                                                                                               | Rascunho                                                                                                                                                                         | Revisão por advogado (foro, RGPD art. 28, arts. 33/34 no pt-PT). CONTINUIDADE, linhas 230 e 250                                                                                           |
| P-53 | Grade de horários: (a) a contagem recomeça no fim de cada bloqueio (almoço/folga)? (b) no modo de 15 em 15, recusar reserva de cliente que comece fora da grade? | **Feito — decidido pelo dono em 13/10/2026: manter as duas.** Implementado assim em 02/10 (`booking_rules_single_source`; CONTINUIDADE, "Regras de agendamento numa fonte só")   | Nada a mudar. Sem (a), depois de um almoço que termina às 13:10 os horários seguiriam 13:15, 13:30…; sem (b), um cliente poderia marcar 13:07 por fora da tela                            |

**Notas e fontes da tabela**

- **P-30 a P-34:** CONTINUIDADE, onda 3 de 08/10, lista "Decisões do dono" em "Pendências que dependem do dono ou de outra rodada".
- **P-31:** a espera filtra por `w.staff_id === selectedStaffId` ([ArenaApp.tsx](../../src/features/customer/ArenaApp.tsx), linhas 1868-1871 e 3336). Com "Qualquer profissional", `selectedStaffId` é nulo (linha 565), e `slot_waits.staff_id` nunca é nulo no banco ([20260916500000_slot_waiting.sql](../../supabase/migrations/20260916500000_slot_waiting.sql), linha 10), então nenhuma vaga aparece. O banco devolve as vagas da loja sem filtrar por profissional (`get_waiting_state`, mesma migration, linhas 176-196; filtro nas linhas 192-194): o filtro por profissional é só da tela.
- **P-35 (e P-50):** origem: transcrição de uma conversa de 08/10, fora do repositório. Nenhum documento do projeto registra as 3 perguntas. Confirmar as perguntas com o dono antes de usar.
- **P-36:** `customerShopHref` é chamado por `openCustomerShop` ([ArenaApp.tsx](../../src/features/customer/ArenaApp.tsx), linhas 463-467: seletor do topo, aviso e link de reserva de outra loja) e por Conta → Minhas barbearias ([CustomerProfile.tsx](../../src/features/customer/CustomerProfile.tsx), linha 504). [CustomerShops.tsx](../../src/features/customer/CustomerShops.tsx) só desenha o seletor e chama `onPick`. "C9" aparece só na lista de atritos do [plano-ambientes.md](../plano-ambientes.md) (linha 35); a pergunta em si não está registrada em nenhum documento do projeto: origem **não confirmado**.
- **P-37:** [plano-ambientes.md](../plano-ambientes.md), linha 215 (onda 5, C11).

Também em aberto, menor: fila de aprovação fictícia nas visões de sócio da demonstração (`/demo?view=equal` e `minority`). Hoje o Salvar avisa "No real, vai para aprovação de Ana" e aplica na hora (CONTINUIDADE, linha 174). Esforço para simular a aprovação: **não confirmado**. Sem id até o dono pedir.

---

## 6. Testes manuais com contas reais

A demonstração não cobre várias lojas, domínio de loja nem login real, e `localhost` conta como endereço principal. Fazer num subdomínio real, sem gravar dados de teste em lojas de clientes. Registrar o resultado no CONTINUIDADE.

**13/10/2026:** a "Loja Teste" (`loja-teste.beauty.contheiner.digital`) foi criada e testada com contas `@loja-teste.invalid` (dono, sócio, Parceiro, Contratado, cliente e cliente promovido a Parceiro), sem código real de WhatsApp nem login real do Google. Durante o P-41 nasceu também a "Loja Teste B" (`loja-teste-b`, destino da saída do Parceiro, sem certificado próprio). Senhas só nas Chaves do macOS do dono (serviço "Barba e Cabelo - Loja Teste"). Roteiro e limpeza: [testes-reais-loja-teste.md](../testes-reais-loja-teste.md). Registro completo: CONTINUIDADE, 13/10.

### P-40 — Contas de teste e o que conferir em cada uma · feito em parte (13/10/2026)

- **Passou:** troca obrigatória da senha (P-16) nas 3 contas convidadas (a janela não fecha com Esc, toque fora, `/app` nem recarregar; senha nova entra, temporária é recusada); "Agendar com Dono" na página pública → login → `/app` com o Dono já escolhido; janela de aceite dos termos para todas as contas; Contratado removido vai a `/app?aviso=removido` ("Você não faz mais parte da equipe"); cliente promovido a Parceiro vê o painel e continua cliente no app; `/` no subdomínio para profissional mostra "Você está vendo como cliente · Abrir painel"; `/` no endereço principal leva o dono ao painel.
- **Não testado:** destino depois de escolher um horário na página pública (o cartão "horários de hoje" ficou desligado na Loja Teste por causa de P-56; **testado depois, em 13/10 às 16:48**: o horário escolhido leva a `/auth` com "Seu horário · Falta confirmar"); `/platform` e admin sem loja (exigem a conta de admin do dono); dono com 2 lojas, Contratado em outra loja e `shop_admin` antigo sem vínculo; troca por "Minhas áreas" e aviso "endereço da A, trabalha na B".
- Achados: P-58, P-59, P-60.

Contas (seção 6 do plano de ambientes, mais as das ondas de 09/10):

- admin da plataforma que também é dono; admin sem loja;
- dono em uma loja e Contratado em outra; dono com 2 lojas;
- cliente de duas lojas; cliente promovido a Parceiro;
- Contratado removido; `shop_admin` antigo sem vínculo de equipe.

Para cada uma: destino depois do login vindo de "Agendar" na página pública; `/` no endereço principal e no domínio da loja (barra "Você está vendo como cliente · Abrir painel"); troca por "Minhas áreas"; troca de loja sem sobrar permissão da anterior; aviso "Você está no endereço da A, mas trabalha na B"; `/platform` no domínio de loja indo ao endereço principal.

### P-41 — Sociedade, matriz e saída · feito (13/10/2026), com achados

- **Dono 100%:** muda a antecedência sozinho e vale na hora.
- **Dono 70% × sócio 30%** (modo "decide quem tem a maior parte"): o de 70% decide sozinho; o de 30% vê "Vai para aprovação de Dono" e "Mudança enviada aos demais sócios"; o de 70% aprova e a mudança é aplicada. O sócio não recebe aviso de que foi aprovada (só vê o valor novo). O teste 50%/50% não foi feito.
- **Matriz do Contratado:** itens de dono travados ("Contratado não muda a loja…").
- **Bloqueios de colegas (P-04)** e **saída do Contratado (P-01):** passaram (ver os itens).
- **Saída do Parceiro levando a carteira:** concluiu **na hora**, sem liberação do dono; o roteiro esperava que aguardasse (P-62). A carteira levada é só de quem teve atendimento concluído com ele, então o cliente de teste (só com reserva futura) ficou na loja.
- Achados: P-57, P-58, P-61, P-62.

Ajustes → Equipe e sociedade com dono 100%, 50% e 30%; "Vai para aprovação de…" antes de salvar; aprovação pelo outro sócio; matriz travada para o Contratado; saída do Contratado sem levar clientes; saída do Parceiro levando a carteira (a `request_shop_departure` corrigida em 03/10 nunca foi usada com login real).

### P-42 — Integrações e cadastro · pendente

- Login e recuperação por WhatsApp; confirmação do número (`WhatsappConfirmBanner`).
- Google: desconectar revoga o acesso; eventos importados aparecem; cópia real de agendamentos para a Agenda Google.
- Janela de aceite dos Termos (`TermsUpdateGate`); troca de fuso em Ajustes (depois de P-22).
- Cadastro de cliente e de dono de ponta a ponta; `/shop/pontos` com login de dono; envio real de foto de serviço e de profissional.

Fontes: CONTINUIDADE, linhas 229, 252, 281, 367, 369 e 393 (as linhas 367 e 369, de 02/10, registram que o envio real de foto ao storage pela tela nunca foi testado com login de dono); [mb-revisao.md](../mb-revisao.md).

### P-43 — Aparelho físico · pendente

Teclado virtual aberto e safe-area do iOS, leitor de tela real, rede lenta, app instalado (PWA). Nunca feito ([mb-revisao.md](../mb-revisao.md), linha "Validação em aparelho real"; CONTINUIDADE, linhas 214 e 384).

---

## 7. Dívida técnica

Medido em 12/10/2026 com `npx eslint .` e com o build de 12/10/2026, 14:16 (pasta `.output`). Para rodar tudo de uma vez: `scripts/verificar.sh` ([scripts/README.md](../../scripts/README.md)).

### P-44 — Avisos e erros do eslint · pendente

- **35 avisos** `react-refresh/only-export-components` em 17 arquivos de `src` (mais em `src/features/shop/roles.tsx`: 8; `src/features/shop/team.tsx`: 5; `ShopSetupChecklist.tsx` e `service-icon.tsx`: 3 cada). Saída: mover o que não é componente para um `.ts` ao lado. O aviso antigo do `MyAreas.tsx` já não aparece.
- **Erros de prettier** em 4 funções do servidor: `whatsapp-channel/index.ts` (17), `platform-whatsapp/index.ts` (5), `_shared/domain-manager.ts` (3), `_shared/evolution.ts` (1).
- A pasta `scratch/` é ignorada pelo git, mas não pelo eslint: gera mais 52 erros só na máquina local. Saída: incluir `scratch/` nos ignores do `eslint.config.js`.

### P-45 — Tamanho do pacote · pendente

No build de 12/10/2026 (14:16), o maior `index-*.js` de `.output/public/assets/` (nesse build, `index-BusXRZec.js`; o nome muda a cada build) tem 1.753.793 bytes, e `ShopShell-*.js` tem 448.742 bytes. Os maiores arquivos de código, fora os dicionários: `ArenaApp.tsx` (3.714 linhas), `ShopShell.tsx` (2.617) e `routes/auth.tsx` (2.502). Saída: dividir por rota e por aba com carregamento sob demanda. Tamanho comprimido: **não confirmado**.

### P-46 — Pacote sem uso `@lovable.dev/mcp-js` · pendente

Continua em `package.json` (linha 24) e em `bunfig.toml` (linha 6) desde que o MCP de exemplo saiu (03/10). Remover com `npm uninstall @lovable.dev/mcp-js` numa rodada com build completo, porque mexe no lockfile.

### P-47 — Chaves de texto sem uso · pendente

- Já saíram do `pt-BR.ts`: as citadas pelas ondas (`cust.noShopLinked`, `demo.role.partner`, `demo.role.partnerHint`) e as de 03/10 (`fix.ajustes-marca.waTooLongFilled`, `auth.info.createdWithWhatsapp`, `fix.fidelidade-insights.policyTiersNotice` e `fix.fidelidade-insights.policyPointRate`; CONTINUIDADE, linha 304).
- `fix.fidelidade-insights.policyFooter` continua no `pt-BR.ts` (linha 3931) e **está em uso** ([politica.tsx](../../src/routes/politica.tsx), linha 278). Não apagar.
- Uma busca simples em 12/10 (3.960 chaves, descontando prefixos montados com `${…}`) achou só uma suspeita: `catalog.access.close`, que nenhum arquivo de `src` usa. Ela existe em 4 dicionários: `pt-BR`, `pt-PT`, `en-US` e `es` (o `en-GB` herda do `en-US` com `...enUS`). Conferir e tirar dos quatro; o teste `translate.test.ts` exige paridade.

### P-48 — Pequenos restos · pendente

- `supabase/tests/privacy_requests.sql` só passa como `supabase_admin` na cópia local (CONTINUIDADE, linha 238).
- Fila `google_calendar_pushes` continua depois de desconectar o Google ([google-verificacao.md](../google-verificacao.md), item 6 do fim).
- `professionalRefusal` ([session.ts](../../src/lib/auth/session.ts), linha 182) e `requireProfessional` ([guards.ts](../../src/lib/auth/guards.ts), linha 43) sem teste automático: conferido no código em 12/10, nenhum `*.test.ts` cita as duas. Precisariam simular o Supabase. Origem do item: relatório da onda 2, fora do repositório.
- No celular de 360 px o exemplo "Mínimo 6 caracteres" corta (CONTINUIDADE, linha 214). Se ainda acontece: **não confirmado**.
- `.env` é versionado (1 commit, `95bc8b4`), só com variáveis públicas (`SUPABASE_URL`, `*_PUBLISHABLE_KEY`, `*_PROJECT_ID`). A cópia local foi apontada para o servidor atual (CONTINUIDADE, linha 398) e essa alteração não deve entrar em commit. O `scripts/autossave.sh` já exclui `.env` e `.env.*` (linha 17; AGENTS.md, seção 9). Um `git add` manual não exclui, e o `.gitignore` não vale para arquivo que já está versionado.

### P-51 — Testes que o `npm test` não roda · feito (13/10/2026)

- **Feito em 13/10/2026 (Cursor):** `favicon.test.ts` e `slugify.test.ts` entraram na lista do `package.json`, junto com os testes novos da rodada; `npm test` passou a rodar 258 testes.

- O `npm test` lista os arquivos de teste um por um ([package.json](../../package.json), linha 13), e o `scripts/verificar.sh` roda o `npm test`.
- Dois testes versionados ficam fora da lista e nunca rodam: `src/lib/shop/favicon.test.ts` e `src/lib/shop/slugify.test.ts`. Rodados à mão em 12/10 (`node --test`), passam: 3 testes.
- **Saída:** acrescentar os dois à lista. Todo teste novo também precisa entrar nela, senão não roda.

### P-52 — Documentos-fonte desatualizados · pendente

- [mb-operacao.md](../mb-operacao.md) (atualizado em 23/09), "Mapa rápido" (linhas 16-19): dá a API de hoje como `supabase-teste.proh.media`, `supabasebeauty.contheiner.digital` com "DNS A pendente", o e-mail Titan como "A configurar" e o login Google como "A configurar no Coolify".
- Pelo CONTINUIDADE de 29/09 e 02/10 (linhas 397-400): o endereço oficial é `supabase-barbearia.proh.media`; `supabase-teste` agora leva a outro servidor (não usar); `supabasebeauty` está no mesmo servidor e é o que o site publicado usa; o login Google foi restaurado em 30/09; o e-mail do sistema é o SMTP da Hostinger (Titan abandonado).
- [AGENTS.md](../../AGENTS.md) (seção "Operação") ainda aponta a mb-operacao.md para "e-mail Titan". O CONTINUIDADE ("Comece aqui", linha 7) foi corrigido em 13/10/2026: agora manda começar pelo [LEIA-PRIMEIRO.md](../LEIA-PRIMEIRO.md).
- CONTINUIDADE, "Comece aqui" (linha 9): manda usar a porta 8080, mas nesta máquina o servidor local roda em 8090, o padrão do `scripts/foto.mjs`. O cabeçalho (linha 3) diz "Atualizado em 03/10/2026", mas há entregas até 09/10.
- **Saída:** atualizar esses trechos numa rodada própria. Nesta rodada, os documentos-fonte ficaram só para leitura.

### P-55 — Montagem do site quebrada por versão nova do TanStack Start · feito (13/10/2026)

As montagens na Hostinger falharam de 12/10 21:12 a 13/10 (5 seguidas) porque o npm instalava `@tanstack/react-start` 1.169.x, que dá "Could not resolve entry module index.html". Corrigido no `package.json` com `>=1.167.50 <1.169.0` (instala 1.168.61); montagem conferida numa cópia limpa e na Hostinger. O projeto não tem `package-lock.json` (só `bun.lock`), então outra dependência pode repetir isso: avaliar travar as versões da montagem.

### P-63 — Roteiro da loja de teste desatualizado · feito (13/10/2026)

O roteiro mandava criar os clientes antes da loja (a ligação do cliente à loja falha em silêncio se a loja não existe) e esperava aprovação no modo "decide quem tem a maior parte" para o dono de 70%. Corrigido em [testes-reais-loja-teste.md](../testes-reais-loja-teste.md).

### P-64 — Funções internas da equipe abertas a qualquer conta logada · feito — aplicado em 13/10/2026 (16:42)

Achado ao escrever P-59/P-60: `apply_add_shop_member` e `apply_update_shop_member` (que gravam vínculo, papel e % sem conferir quem chama) podiam ser chamadas direto pela API por qualquer conta logada. A `20261013190000_saida_equipe_reservas.sql` tirou o acesso de `public`, `anon` e `authenticated` e deixou só o servidor; as telas continuam pelo `shop_add_member`/`shop_update_member`, que conferem a permissão. Teste em `saida_equipe_reservas.sql`; conferido em produção (`f` para `authenticated`).

### P-65 — Selo "Lotado hoje" quando só não sobra horário · feito (13/10/2026)

Na página pública, sem horário livre no resto do dia por causa da antecedência ou do fechamento, o selo dizia "Lotado hoje", o que dá a entender que a agenda encheu. Trocado por "Sem horário livre hoje" (pt-BR e pt-PT), "No times left today" (en) e "Sin horarios libres hoy" (es).

---

## 8. Ideias futuras

### P-49 — Módulo de reembolso e cancelamento · a decidir

Registrado em 16/09/2026 em [reembolso-futuro.md](../reembolso-futuro.md): cancelamento grátis com 3 horas ou mais, retenção de 30% abaixo disso por esquecimento, pedido de reembolso integral. Depende de meio de pagamento, que não existe. O documento não autoriza ativar cobrança.

### P-50 — Acerto de contas com o Parceiro · a decidir

Depende das respostas de P-35. Hoje a carteira (`get_partner_wallet`, [20260917180000_partner_tools.sql](../../supabase/migrations/20260917180000_partner_tools.sql), linha 50) mostra a cada profissional só a própria produção: atendimentos concluídos e valor. Módulo novo: cálculo do mês por regra combinada e, se o dono quiser, cobrança online junto com P-49.

Fonte das perguntas: transcrição de uma conversa de 08/10, fora do repositório; nenhum documento do projeto as registra. Confirmar as perguntas com o dono antes de usar.

### P-54 — Antecedência mínima para reservar · feito — aplicado em 13/10/2026 (15:12, horário de Brasília)

- **Aplicado e testado em 13/10/2026:** todas as lojas ficaram com 30 min (Arena e Externa conferidas). Na Loja Teste, o dono a 100% mudou para 1 h e valeu na hora; com 2 h, a reserva do cliente para dentro do prazo foi recusada com "Este horário precisa ser reservado com pelo menos 2 h de antecedência. Escolha um horário mais tarde." e a de fora do prazo passou; a remarcação feita pelo dono não é barrada. A tela aberta do cliente se atualizou sozinha depois da mudança.

- **Pedido do dono em 13/10/2026:** antecedência configurável por loja, padrão 30 minutos.
- **Feito em 13/10/2026 (Cursor):** migration `20261013150000_antecedencia_minima.sql` (coluna `barbershop_settings.min_lead_minutes`: 0, 15, 30, 60, 120, 240, 720 ou 1440; padrão 30). A lista de horários livres (app, "qualquer profissional", página pública) não oferece horário antes de agora + antecedência. A reserva ou remarcação feita pelo próprio cliente dentro da antecedência é recusada com mensagem amigável (`22023`, tolerância de 5 min). O painel da equipe, os cancelamentos, a lista de espera e as séries recorrentes não são barrados. Mesma aprovação entre sócios das outras regras de agendamento (`settings.operational`).
- **Tela:** Ajustes → Agendamento, cartão "Antecedência mínima" logo abaixo de "Como os horários aparecem", com escolhas de "Sem mínimo" a "24 h" e a prévia "Se um cliente abrir o app agora". Só aparece quando a coluna existe no banco. Também no resumo do topo e na demonstração.
- **Testes:** `supabase/tests/antecedencia_minima.sql` (14 PASS na cópia da estrutura do banco); 2 testes novos em `appointments.test.ts`.
- **Ao aplicar, todas as lojas passam a exigir 30 minutos.** Aplicação autorizada para a noite de 13/10: [implantacao-noite-2026-10-13.md](../implantacao-noite-2026-10-13.md).

Outras ideias já registradas, sem id até virarem pedido: modo de suporte do admin com registro e prazo (decisão 4 do plano de ambientes); limite de tentativas por IP nas funções (ficou de fora em 03/10, CONTINUIDADE, linha 316).
