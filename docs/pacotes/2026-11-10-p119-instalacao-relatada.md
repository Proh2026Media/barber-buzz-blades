# P-119 — instalação relatada pela TI; homologação pendente

Recebido em 10/11/2026: `relatorio-ti-p119-2026-11-10.md`, SHA-256 `3ffd6f16518aaab87926c973f370f0189b296494e12bdde7e7fa30b5f7799697`, referente ao [roteiro de instalação](2026-11-10-ti-whatsapp-compartilhado-p119.md) e commit `1a420bf63256e1b13e1fb00e14771a2cdfcd80a7`.

## Conferência própria

Hashes e tamanhos completos das duas funções informados pela TI coincidem com os arquivos locais entregues:

| Arquivo                     | Bytes | SHA-256                                                            |
| --------------------------- | ----- | ------------------------------------------------------------------ |
| `whatsapp-channel/index.ts` | 17597 | `73c3e4f97875750553691303beaf2db347413379905049074eabdc787f74d499` |
| `auth-otp/index.ts`         | 25254 | `0eec67f0e18c9e0a5fdf156d3078255b172b1c863b478f038484560bb4f447ca` |

Esta é uma conferência documental/local. Não houve nova consulta própria à VPS, sessão administrativa em produção ou mensagem real nesta rodada.

Conferência própria por HTTP no site público `https://beauty.contheiner.digital`: entrada `/assets/index-CvTpXKMh.js` contém os textos `waShared.*` e `PlatformShell-DXCDjmVM.js` contém a chamada `platform_add_whatsapp_link`. O frontend de compartilhamento já é servido publicamente. Isso confirma publicação do código, não funcionamento autenticado nem envio real.

## Instalação informada pela TI

- Nº 104 aplicada em **10/11/2026, 16:24:03–16:24:04 (Brasília)**, em transação, rc 0 e sem erros/avisos. **Não reinstalar.**
- Duas funções publicadas às 16:23:17; somente o container de funções reiniciado, saudável às 16:23:29. Evolution, banco, Auth, Kong e proxy preservados.
- Ensaio com ROLLBACK às 16:23:01–16:23:03. Estrutura nova removida pelo ROLLBACK; testes fictícios não executados em produção.
- Backup em `/root/backup-p119-20261110-192205/`: dump de 1.416.025 bytes, catálogo válido de 2.120 entradas/108 TABLE DATA; hash informado `a4f31fcc4566d983f260f61d509b626614002582428b1dd4f75741e8462cf239`. Cópias das funções Edge e nove definições SQL preservadas.
- Quatro números mantidos: três vinculados e um livre. Três vínculos equivalentes semeados, um por destino anterior, com preferências e habilitação iguais. Nenhuma reserva associada; nenhuma distribuição/ativação realizada pela instalação. Externa Barbearia preservada.
- Fila idêntica: quatro enviados históricos, nenhum em envio/incerto. Os quatro enviados antigos não possuíam `channel_id`, portanto continuam sem `number_link_id`; isso não indica falha de migração nem exige reenvio.
- `number_sharing=true` conferido pela TI na definição da função, sem execução administrativa. Testes negativos recusaram central/leitura de loja sem permissão; RLS ocultou vínculos e auditoria, e a view não pôde ser lida por authenticated.
- Cron 200 após instalação às 16:24:09. Logs sem erro de inicialização/importação/exceção; avisos de duração descritos como padrão já existente, sem erro associado.

## Observação sobre permissões da view

A TI encontrou privilégios de escrita herdados dos defaults do Supabase para `service_role` na view `whatsapp_delivery_channels`. As tabelas novas não permitem escrita direta por esse papel. A view junta duas tabelas e não possui gatilhos de escrita.

Conferência própria no PostgreSQL local, aplicando a nº 104 em transação desfeita com ROLLBACK: `pg_relation_is_updatable(..., true) = 0` e zero triggers na view. Portanto, os grants herdados não disponibilizam escrita direta na definição atual. Não há motivo, por este achado, para reinstalar a nº 104 ou interromper a homologação.

Registrar o `REVOKE INSERT, UPDATE, DELETE` explícito para a próxima migration que alterar esta view, como restrição preventiva de privilégios. Não editar a migration já instalada, não criar uma nova janela de produção só por este ajuste e não afirmar que a revogação já foi aplicada. Se a view ganhar capacidade de escrita no futuro, revisar seus grants antes de publicar.

## Próximo passo

A instalação está concluída **conforme relatório**. Continuam pendentes a conferência visual autenticada e a homologação dirigida do roteiro existente: segunda loja/profissionais no mesmo número, mensagens identificadas e separadas, pausa individual, reserva, conflito de versão e aparelhos físicos.

Na interface: **Administração → Central de WhatsApp → selecionar número já vinculado → Vincular outra barbearia ou profissional → Adicionar vínculo**. O novo vínculo começa pausado; habilitar é uma ação separada. Não criar outro número apenas para compartilhar o já existente.

Nenhuma escolha de número, destino ou destinatário real foi inferida deste relatório. A dúvida da TI sobre a alteração anterior da Externa Barbearia não autoriza desfazê-la; seu estado foi preservado. Não reenviar pacote de instalação nem repetir nº 101–104. Nº 99/100, Flow e pagamentos seguem fora desta rodada.
