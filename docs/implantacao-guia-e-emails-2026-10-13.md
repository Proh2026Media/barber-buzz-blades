# Implantação — guia da loja no banco, logo e e-mails na plataforma (13/10/2026) — **aplicado em produção**

Pendências resolvidas: P-20 (banco e tela), P-12 (banco e tela), P-11 (só tela) e P-13 (já tinha saído na `20261013210000`; só faltava marcar). Autorização do dono em 13/10: criar, ensaiar e aplicar com backup antes e ensaio desfeito sem falha. Horários de Brasília (a VPS marca UTC, 3 h a mais).

## 1. O que entrou

**Migration `20261013230000_guia_loja_e_emails.sql`**

| Parte                | O quê                                                                                                                                                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-20 — guia no banco | Tabela `shop_setup_guides` (sem acesso direto) com o que a pessoa marcou à mão: horários conferidos, link enviado, "Trabalho sozinho", guia escondido e comemoração vista. `get_shop_setup_guide(loja)` e `save_shop_setup_guide(loja, mudança)`, que só aceita essas 5 chaves com verdadeiro/falso. |
| Quem usa o guia      | `can_use_shop_setup_guide(loja)`: dono ou sócio da equipe, o `shop_admin` antigo e o admin da plataforma (as mesmas pessoas que veem o guia na Agenda).                                                                                                                                              |
| P-12 — e-mails       | `platform_user_emails(contas)`: só o admin da plataforma recebe o e-mail das contas pedidas (até 500 por vez).                                                                                                                                                                                       |

**Tela (sem banco):**

- **P-20:** o guia "Deixe sua barbearia pronta" abre com a cópia do aparelho e junta com a do banco (o banco vence; o que só existia no aparelho sobe para o banco). Passo novo **Equipe e sócios** (6 passos): pronto com mais de um profissional ativo ou com "Trabalho sozinho"; o botão leva a Ajustes → Equipe e sociedade. "Esconder guia" e "Mostrar guia" passam a valer em qualquer aparelho.
- **P-11:** a lista e a ficha da loja na plataforma mostram o logo (imagem inteira sobre a cor de fundo da marca); sem logo, as iniciais como antes.
- **P-12:** a equipe na ficha da loja mostra o e-mail de cada pessoa (`list_shop_team_members` já devolvia); a lista de gerentes de conta mostra o e-mail pela função nova.

O site funciona antes e depois da migration (sem ela, o guia fica só no aparelho e os gerentes aparecem sem e-mail).

## 2. Ensaio

Em `BEGIN … ROLLBACK` no banco de produção, com a migration: `guia_loja_e_emails.sql` 11 PASS (novo) e `shop_role_permissions.sql` 39. Nenhum FAIL nem ERROR.

## 3. Aplicação

1. Backup: `/root/backup-barba-cabelo-20261013-210805.dump` (1,2 MB), 18:08.
2. Migration numa transação (`psql -1`), 18:08:08, com `NOTIFY pgrst`.
3. Conferência: `shop_setup_guides` existe e não é lida direto por `authenticated`; `platform_user_emails` fechada para `anon`; `save_shop_setup_guide` aberta para `authenticated`.

Desfazer: `pg_restore` do backup acima (a migration não apaga dados). Nenhuma função do servidor mudou.

## 4. Reteste na Loja Teste (pela API)

5 checagens, todas certas: o dono lê o guia (vazio), grava "Trabalho sozinho" (chave desconhecida ignorada) e lê de novo o mesmo estado; o Contratado não lê (403); o dono não usa a função de e-mails da plataforma (403). O guia de teste foi apagado depois. A lista de e-mails pelo admin da plataforma **não foi testada** com login real (exige a conta de admin do dono); o teste SQL cobre.
