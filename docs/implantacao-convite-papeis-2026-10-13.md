# Implantação — convite com link, boas-vindas e regras de papel (13/10/2026) — **aplicado em produção**

Pendências resolvidas: P-02, P-03, P-05, P-06, P-08, P-09, P-15, P-17, P-18 (parte do banco) e P-66 (achado nesta rodada). Autorização do dono em 13/10: criar, ensaiar e aplicar com backup antes e ensaio desfeito sem falha. Horários de Brasília (a VPS marca UTC, 3 h a mais).

## 1. O que entrou

**Migration `20261013210000_convite_boas_vindas_papeis.sql`**

| Parte                       | O quê                                                                                                                                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-15 — link de convite      | Tabela `shop_invite_links` (só o servidor lê): guarda o resumo (hash) do código do link, loja, conta, papel, validade de 7 dias e uso.                                                                                                                                                        |
| P-17 — boas-vindas          | Coluna `shop_members.welcome_seen_at`. Quem já estava na equipe ficou como "já viu" (sem UPDATE em massa). Gatilho `shop_members_reset_welcome` zera a marca em vínculo novo, volta à equipe ou troca de papel (o fundador não vê). Função `mark_shop_welcome_seen(loja)`.                    |
| P-05 — convite aguardando   | `get_my_pending_shop_invites()`: a pessoa convidada vê os próprios convites que esperam o OK dos donos (loja, nome e papel).                                                                                                                                                                  |
| P-06 — primeiro dono        | `apply_add_shop_member`: loja sem dono ativo aceita o primeiro dono com 100% (sem ninguém ceder parte); com dono, a regra de ceder parte continua. Erro claro: "O primeiro dono da barbearia entra com 100%."                                                                                 |
| P-08 — cartão existente     | `apply_add_shop_member`, `shop_add_member` e `platform_add_shop_member` ganham `p_staff_id` (opcional): o convite feito pelo cartão liga a conta ao profissional que já existe. Recusa cartão de outra conta e conta que já tem outro cartão na loja. Versões antigas de 5 argumentos saíram. |
| P-02 — bloqueio próprio     | Permissão nova `manage_own_blocks` ("Bloquear a própria agenda"), ligada por padrão para todos os papéis; a política dos bloqueios próprios usa ela.                                                                                                                                          |
| P-66 — bloqueio pela gestão | Política nova "Team managers manage availability blocks": dono que pode aplicar mudanças e gerencia o funcionamento cria e apaga bloqueios da loja e dos colegas, mesmo sem o `shop_admin` antigo.                                                                                            |
| P-03 — foto própria         | Políticas do bucket `barbershop-services` aceitam envio, troca e exclusão em `<loja>/staff/<id do próprio profissional>/…` por qualquer membro da equipe.                                                                                                                                     |
| P-09 — ficha pela agenda    | `get_team_schedule` devolve `customer_id` só para quem vê a loja inteira ou para o próprio atendimento.                                                                                                                                                                                       |
| P-18 — conta que já existe  | `create_own_barbershop` grava quem fundou (`founded_by_user_id`).                                                                                                                                                                                                                             |
| Outros                      | `save_shop_permissions` mantém desligadas para o Contratado as 4 permissões que não valem para ele; `apply_shop_change` repassa `staff_id`.                                                                                                                                                   |

**Funções do servidor**

- `invite-shop-admin` (atualizada): aceita `staff_id`; primeiro dono entra com 100%; conta nova recebe link de entrada `https://<loja>/convite?t=…` (domínio próprio ativo ou subdomínio); conta que já existe recebe só o endereço de login da loja; põe o convite na fila de e-mail (`team.invite`), exceto endereços de teste (`.invalid`, `.test`, `.example`, `.localhost`). Resposta ganha `invite_link`, `link_kind` e `email_status`. A senha temporária continua na resposta como reserva.
- `shop-invite` (nova, sem sessão): `info` mostra loja, papel e e-mail mascarado; `accept` devolve um acesso de uso único (magic link do Auth) só enquanto a conta ainda tem a senha temporária. Depois que a pessoa cria a senha, o link só leva ao login.

**Segurança do link:** só entra na conta enquanto ela ainda não tem senha própria (conta criada pelo convite). Assim quem convida nunca ganha um jeito de entrar na conta de alguém que já existia. O código do link fica só como hash no banco.

## 2. Ensaio

Em `BEGIN … ROLLBACK` no banco de produção, com a migration: `convite_boas_vindas_papeis.sql` 30 PASS (novo), `saida_equipe_reservas.sql` 29, `shop_role_permissions.sql` 39 (catálogo passa a ter 12 permissões), `regras_papel_banco.sql` 20, `papeis_atuais_e_fuso.sql` 26, `shop_team_governance.sql` 14, `correcoes_auditoria.sql` 10. Nenhum FAIL nem ERROR.

## 3. Aplicação

1. Backup: `/root/backup-barba-cabelo-20261013-205006.dump` (1,2 MB), 17:50:06.
2. Migration numa transação (`psql -1`), 17:50:22, com `NOTIFY pgrst`.
3. Conferência: `shop_invite_links` existe; coluna `welcome_seen_at` existe e nenhum vínculo antigo ficou sem marca; `mark_shop_welcome_seen` fechada para `anon`; `apply_add_shop_member` fechada para `authenticated`; `shop_add_member` aberta; 3 funções de convite (sem versões antigas); 12 permissões no catálogo.
4. Funções: cópia da pasta em `/root/functions-backup-20261013-205036`; enviadas `invite-shop-admin` e `shop-invite`; reiniciado só o container das funções (`supabase-edge-functions-…`), 17:50:40. OPTIONS 200 nas duas. Correção do endereço do link (abaixo) publicada às 17:53.

Desfazer: `pg_restore` do backup acima (a migration não apaga dados) e copiar de volta as duas pastas de funções do backup, reiniciando só o container das funções.

## 4. Achado na publicação

No container das funções, `PLATFORM_BASE_HOST` vale `dominios.beauty.contheiner.digital` (o alvo dos domínios próprios), não a base das lojas. O primeiro link saiu como `loja-teste.dominios.beauty…`. A `invite-shop-admin` passou a tirar o `dominios.` do começo. O ambiente do Coolify não foi alterado (registrado como P-67).

## 5. Reteste na Loja Teste (pela API, com as contas de teste)

34 checagens, todas certas depois da correção do endereço:

- Dono cria um cartão "só na agenda" e convida um e-mail novo pelo cartão: conta criada, ligada ao mesmo cartão, nenhum cartão duplicado (P-08).
- Link `https://loja-teste.beauty.contheiner.digital/convite?t=…`; e-mail de teste não enviado (`skipped_test`).
- `shop-invite`: informação com a loja, o papel e o e-mail mascarado, sem entregar acesso; o aceite abre a sessão e a conta ainda pede a troca de senha. Depois da senha criada, o link só leva ao login e não entra mais.
- Boas-vindas: vínculo novo sem marca; marcar funciona e não volta (P-17).
- Contratado sem "serviços próprios": envia foto só na própria pasta (colega e serviço recusados) e grava a foto no perfil (P-03); bloqueia e apaga a própria agenda, e não a do colega (P-02).
- Conta que já existe (dono da Loja Teste) convidada para a Loja Teste B: entra sem senha nova e recebe só o endereço de login da B; passa a ter vínculo em 2 lojas, com boas-vindas pendentes na nova (P-40, dono com 2 lojas).
- `get_team_schedule`: o dono recebe `customer_id`; o Contratado não recebe o cliente dos colegas (P-09).

Dados criados na Loja Teste (só contas `@loja-teste.invalid`): cartão "Ana Convite …" com a conta `ana-…@loja-teste.invalid` (Contratado), conta `bia-…@loja-teste.invalid` (Contratado, convite não usado) e o vínculo do dono como Contratado na Loja Teste B. Saem com o roteiro de limpeza de [testes-reais-loja-teste.md](testes-reais-loja-teste.md).

## 6. Site

Mesma entrega: página `/convite`, cartão do convite com link, WhatsApp e situação do e-mail, janela de boas-vindas, aviso "aguardando aprovação", foto própria do Contratado, linha "Bloquear a própria agenda" na matriz, nome do cliente na agenda da equipe abrindo a ficha, "Adicionar dono" na loja recém-criada pela plataforma, `/cadastrar` com a conta aberta (P-18) e convite de gerente de conta escondido (P-19). O site funciona antes e depois da migration (chamadas novas são opcionais).
