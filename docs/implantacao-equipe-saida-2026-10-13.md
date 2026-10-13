# Implantação — papéis atuais, fuso rápido e saída da equipe (13/10/2026) — **aplicado em produção**

Pendências resolvidas: P-56, P-57, P-58, P-59, P-60, P-61, P-62 e P-64 (achado nesta rodada). Autorização do dono em 13/10: criar, ensaiar e aplicar com backup antes e ensaio desfeito sem falha. Horários de Brasília (a VPS marca UTC, 3 h a mais).

## 1. O que entrou

| Migration                                  | O quê                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261013180000_papeis_atuais_e_fuso.sql`  | `shop_tz` sem varrer `pg_timezone_names` (P-56); `list_pending_shop_changes` volátil (P-57); as 19 funções que só aceitavam o `shop_admin` antigo passam a usar os papéis da equipe por 4 auxiliares centrais (`shop_is_team`, `shop_can_see_booking`, `shop_can_act_on_appointment`, `shop_can_view_reports`), que nunca devolvem nulo (P-58).                                                         |
| `20261013190000_saida_equipe_reservas.sql` | Reconvite reativa quem saiu e avisa "já está na equipe" para quem está ativo (P-59); reativar devolve a ficha de profissional e pausar apaga o acesso antigo de dono (P-60); o banco não deixa tirar da equipe nem liberar a saída de quem tem reserva futura, e o dono passa a reserva para um colega livre ou cancela com aviso (P-61); Parceiro que leva clientes espera a liberação do dono (P-62). |
| (mesma)                                    | P-64: `apply_add_shop_member` e `apply_update_shop_member` estavam abertas para qualquer conta logada; agora só o servidor as chama (as telas usam `shop_add_member`/`shop_update_member`, que conferem a permissão).                                                                                                                                                                                   |

Funções novas: `staff_future_appointment_count`, `list_departure_appointments`, `reassign_appointment_staff`, `cancel_shop_departure`; gatilho `shop_members_exit_future_bookings`. Testes novos: `supabase/tests/papeis_atuais_e_fuso.sql` (26) e `supabase/tests/saida_equipe_reservas.sql` (28); `regras_papel_banco.sql` ajustado (20).

## 2. Ensaio

Cada arquivo de teste em `BEGIN … ROLLBACK` no banco de produção, com as duas migrations: todos passaram, sem FAIL nem ERROR, com as mesmas contagens de antes mais os novos (25 arquivos avulsos e 9 cadeias depois de `booking_reliability.sql`; contagens por arquivo no CONTINUIDADE). Duas regressões apareceram no primeiro ensaio e foram corrigidas antes de aplicar: auxiliares que devolviam nulo (e `if not nulo` deixava passar) e mudança indevida do código de erro de 8 funções que respondiam "Not allowed" sem código.

## 3. Aplicação

1. Backup: `/root/backup-barba-cabelo-20261013-1942.dump` (1,2 MB, 98 tabelas com dados), 16:42:35.
2. `20261013180000`: 16:42:49–16:42:50, numa transação.
3. `20261013190000`: 16:42:54–16:42:55, numa transação, com `NOTIFY pgrst`.
4. Conferência: auxiliares existem (`t|t|t`); `apply_*` fechadas para `authenticated`, `reassign_appointment_staff` fechada para `anon` e aberta para `authenticated` (`f|f|f|t|f`); `list_pending_shop_changes` volátil.

Desfazer: `pg_restore` do backup acima (só se algo grave aparecer; as migrations não apagam dados).

## 4. Medições (P-56)

| O quê                                     | Antes            | Depois                           |
| ----------------------------------------- | ---------------- | -------------------------------- |
| `shop_tz` por chamada                     | ~407 ms          | 1,3 ms                           |
| Página pública da Loja Teste (banco)      | 4.410 ms         | 92,7 ms (1ª), 5,6 ms (seguintes) |
| Página pública da Arena (banco)           | 1.391 ms         | 4,8 ms                           |
| Página pública da Loja Teste no navegador | estourava os 3 s | dados prontos em 0,65 s          |

`landing.show_today` foi religado na Loja Teste.

## 5. Site

Commit `44aaa1f` (banco, tela e testes) publicado; montagem na Hostinger concluída. Depois dos retestes, um segundo envio com: confirmação "Reserva passada…" que não sumia mais junto com a última reserva; reservas na própria janela Gerenciar quando a pausa é recusada; selo "Sem horário livre hoje" no lugar de "Lotado hoje" (P-65).

## 6. Retestes no site publicado (13/10, contas da Loja Teste)

- **Página pública:** cartão "Hoje" com o próximo horário e os horários de cada profissional (com a antecedência baixada para 30 min por alguns minutos e devolvida para 2 h); tocar em 17:45 leva a `/auth` com "Seu horário · Falta confirmar · Dono · ter 13/10 · 17:45". Com 2 h de antecedência e fechamento às 19:00 não sobrava horário: o selo dizia "Lotado hoje" (corrigido para "Sem horário livre hoje", P-65).
- **Equipe sem "sem permissão" (P-58, pela API com o login de cada conta):** sócio com tudo 200; Parceiro com horários, termos, espera, cancelamentos e números 200, e presença do atendimento de outro profissional recusada (correto); cliente sem acesso aos números da loja; `list_pending_shop_changes` 200 para os donos (antes falhava sempre).
- **Reservas de quem saiu (P-61):** Ajustes → Equipe e sociedade mostrou "Reservas de quem saiu da equipe" com as 2 reservas de 14/10; "Passar" para o Sócio deu "Reserva passada para Sócio Teste. O cliente recebe o aviso da mudança." (o Sócio sumiu da lista de livres da outra); "Cancelar e avisar" abriu a confirmação com quando, cliente e serviço e cancelou. A fila registrou os avisos de remarcação e de cancelamento (por e-mail: o cliente de teste não tem WhatsApp).
- **Reativar (P-60):** Gerenciar → Ativo no Contratado: vínculo e ficha ativos, a janela passou a mostrar "Ativo" e "Mudanças de Contratado salvas".
- **Reconvite (P-59):** convidar `contratado@` (ativo) mostrou "Esta pessoa já está na equipe. Para mudar o papel, use Gerenciar."; convidar `parceiro@` (que tinha saído) como Parceiro deu "entrou na equipe", com vínculo e ficha reativados.
- **Saída do Parceiro levando clientes (P-62):** com uma reserva de 15/10, o pedido nasceu `pending_release` com 1 reserva; o Parceiro não conclui sozinho ("Aguarde a liberação do sócio"), outro Parceiro não aprova, o dono não libera com reserva pendente. Na tela do dono, "Liberar clientes" ficou desligado até passar a reserva para o Dono; depois, "Clientes liberados: a saída foi concluída" e o Parceiro ficou inativo.
- **Saída do Contratado sem levar clientes, com reserva (P-61):** `pending_release`; recusar responde "A saída sem levar clientes não pode ser recusada…"; o sócio não desiste por ele; o próprio Contratado desistiu (`cancelled`). Pausar o Contratado com a reserva em Gerenciar foi recusado com "Ainda há reservas marcadas com este profissional…".

Não verificado: painel do Parceiro e do Contratado no navegador (conferido pela API); OTP real de WhatsApp e login real do Google; fotos em 320 e 1280 e no tema escuro.

## 7. Estado deixado na Loja Teste

Antecedência 2 h; `show_today` ligado. Equipe: Dono 70%, Sócio 30%, Cliente Dois (Parceiro) e Contratado ativos; Parceiro saiu de novo para a Loja Teste B. Reservas do `cliente@`: 14/10 10:00 com o Sócio (passada), 14/10 10:00 cancelada, 15/10 14:00 com o Dono (passada), 15/10 15:00 com o Contratado. Arena e Externa: nenhum dado mudou.
