# Implantação — pausa fixa semanal (13/10/2026) — **aplicado em produção**

Pendência resolvida: P-10. Autorização do dono em 13/10: criar, ensaiar e aplicar com backup antes e ensaio desfeito sem falha. Horários de Brasília (a VPS marca UTC, 3 h a mais).

## 1. O que entrou

**Migration `20261013220000_pausa_semanal.sql`**

| Parte             | O quê                                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Regra             | Tabela `availability_block_rules`: loja, profissional (nulo = loja toda), dias da semana (0 = domingo … 6 = sábado), início, fim, motivo e até que dia já foram gerados os bloqueios.                                          |
| Bloqueios gerados | Coluna `availability_blocks.rule_id`. Criar a regra gera bloqueios comuns nos próximos 120 dias (fuso da loja). Lista de horários, validação da reserva, agenda e página pública não mudaram: continuam lendo só os bloqueios. |
| Extensão          | `extend_availability_block_rules()` (só o servidor) completa a janela de 120 dias sem recriar dias já gerados. Assim apagar o bloqueio de um dia ("hoje não tem almoço") vale só para aquele dia.                              |
| Apagar a regra    | Apaga os bloqueios futuros dela; os passados ficam como histórico (sem `rule_id`).                                                                                                                                             |
| Permissões        | Iguais às dos bloqueios: profissional só na própria agenda (`manage_own_blocks`); loja toda e colegas para quem aplica mudanças e gerencia o funcionamento, o `shop_admin` antigo e o admin da plataforma.                     |
| Lista             | `list_shop_blocks` devolve também `rule_id` (função recriada, mesmas permissões).                                                                                                                                              |

Limite conhecido: sociedade que exige aprovação não cria pausa fixa da loja toda (a regra não passa pela fila de pedidos). Nesse caso o cartão mostra só as pausas que já existem; a pausa na própria agenda continua possível.

**Função do servidor:** `whatsapp-dispatch` chama `extend_availability_block_rules()` uma vez por hora (minuto 23), com erro ignorado se a migration faltar.

## 2. Ensaio

Em `BEGIN … ROLLBACK` no banco de produção, com a migration: `pausa_semanal.sql` 14 PASS (novo), `booking_rules_single_source.sql` 33, `convite_boas_vindas_papeis.sql` 30, `saida_equipe_reservas.sql` 29, `guard_own_professional_rows.sql` 7, `shop_team_governance.sql` 14, `tempo_preparo.sql` 17, `hours_replace_change.sql` 12. Nenhum FAIL nem ERROR.

## 3. Aplicação

1. Backup: `/root/backup-barba-cabelo-20261013-180108.dump` (1,2 MB), 18:01.
2. Migration numa transação (`psql -1`), 18:01:15, com `NOTIFY pgrst`.
3. Conferência: tabela criada e vazia; `extend_availability_block_rules` fechada para `authenticated`; chamada pelo servidor devolveu 0.
4. Função: cópia da pasta em `/root/functions-backup-whatsapp-dispatch-<data>`; enviada `whatsapp-dispatch`; reiniciado só o container das funções. OPTIONS 200.

Desfazer: `pg_restore` do backup acima (a migration não apaga dados) e copiar de volta a pasta `whatsapp-dispatch`, reiniciando só o container das funções. O site novo funciona sem a tabela (o cartão some).

## 4. Reteste na Loja Teste (pela API)

5 checagens, todas certas: o Contratado cria pausa fixa na própria agenda (todos os dias, 12:00–12:30); não cria pausa da loja toda (403); o dono vê os 120 bloqueios gerados com `rule_id`, de 30 minutos; apagar a regra limpa os dias futuros. Nenhum dado de teste ficou.

## 5. Site

Aba Horários: cartão "Pausa fixa" (dias em pílulas, faixa de horário, loja toda ou profissional, motivo), lista das pausas com apagar e confirmação. Nos bloqueios, os gerados aparecem nos próximos 7 dias com a etiqueta "Pausa fixa"; apagar um deles avisa que vale só para aquele dia. A lista "Mais adiante" mostra só os bloqueios avulsos. Fora da demonstração.
