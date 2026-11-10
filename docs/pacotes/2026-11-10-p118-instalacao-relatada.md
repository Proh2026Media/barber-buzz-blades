# P-118 — instalação informada pela TI

Relatório recebido: `relatorio-ti-p118-2026-11-10.md`, SHA-256 `a46f0211336f06eb0b3f4463f28e9360a60893bb9173a72dbfbeba4b7b34b58d`. Referência: commit `240a5ab24f83f071a7631f56c53f11fe654eac90` e [pacote nº 103](2026-11-10-ti-whatsapp-reserva-visual-p118.md).

Segundo a TI, a migration nº 103 foi aplicada em **10/11/2026, 15:37:35 (Brasília)**, depois de ensaio com ROLLBACK às 15:37:24–25. Sem erro/aviso, reinício ou troca de funções Edge. **Não reinstalar.** Esta conferência é documental; não houve nova consulta à VPS nesta rodada.

- Backup em `/root/backup-p118-20261110-183638/`, dump de 1.406.877 bytes; catálogo válido com 2.109 entradas e 107 TABLE DATA. Hash informado: `36ff77465f27711ebc8eeeed5f7a5b69ab027697143d561c2695f37fb7b8d8db`.
- RPC, helper privado, RLS e capacidade `number_reserves` conferidos pela TI. Manifesto informado como válido; não presumir conferência própria dos arquivos no servidor.
- Quatro números preservados: um livre, Loja Teste, Arena Barber e Externa Barbearia. Nenhuma reserva associada; modo principal e retorno automático desligado em todos. Um movimento já existia antes da instalação.
- Fila antes/depois: quatro enviados históricos, nenhum pendente, em envio ou incerto. Cron 200 às 15:38:07. A TI não conectou, habilitou, transferiu ou enviou mensagens.
- O relatório registra Externa Barbearia como vínculo criado pelo aplicativo antes da instalação. Sua origem/intenção não foi verificada aqui; preservado, sem atribuir essa mudança à TI ou desfazê-la.

Instalação concluída conforme relato; homologação autenticada e mensagens reais continuam pendentes. O pedido posterior de compartilhar um número entre destinos é a **P-119/nº 104**, não uma falha nem reaplicação da nº 103.
