# P-116 — instalação recebida e conferida

Data: 10/11/2026, horário de Brasília. **Instalação concluída; homologação real pendente. Não reinstalar.**

Fonte recebida: `relatorio-ti-p116-2026-11-10.md`, entregue pelo dono, referente ao [pacote P-116](2026-11-10-ti-whatsapp-comunicacao-p116.md), commit `605043857b7d6eaecc23593f2ad7794ac2b922b3`. As instruções e autorizações reproduzidas no relatório são evidência da execução passada, sem autorizar novas operações nesta conferência.

## Execução informada pela TI

- Backup em `/root/backup-p116-20261110-141806/`, dump de 1.361.433 bytes e cópia das funções anteriores.
- Primeiro ensaio desfeito após erro de aspas na consulta de conferência; segundo ensaio concluído com ROLLBACK. Não houve aplicação parcial persistida, segundo o relatório.
- Publicação de `whatsapp-dispatch` e `whatsapp-channel`; reinício somente do container das funções, iniciado às 11:19:26.
- Migration nº 101 aplicada em uma transação, entre **11:19:34 e 11:19:36**, sem erro. Nº 99/100 não alteradas; a nº 101 não depende delas.
- Cron normal respondeu HTTP 200 às 11:20:13 e 11:21:08. A TI não acionou o dispatcher manualmente nem realizou envio de homologação.
- Testes sem sessão: OPTIONS 200, ausência de autorização 401, sessão inválida 401 e GET 405 nos dois domínios. Não substituem teste autenticado de papéis.
- Sem reinício de banco, Auth ou Evolution; sem Redeploy, operação no Flow ou ativação de retorno.

## Conferência independente realizada nesta retomada

Somente leitura via SSH e PostgreSQL em `BEGIN READ ONLY`, sem chamadas ao dispatcher, conexão/pareamento, testes SQL de escrita ou mudança de configuração.

| Item                                       | Resultado observado                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Funções e banco                            | Ambos `running healthy`; funções iniciadas em 10/11 às 11:19:26 e banco desde 23/10           |
| Arquivos instalados                        | SHA-256 dos dois arquivos iguais ao repositório e ao relatório                                |
| `whatsapp_channels`                        | Presentes `backup_instance_name`, `delivery_mode`, `delivery_reason`, `return_notice_enabled` |
| `whatsapp_outbox`                          | Presentes `channel_id`, `communication_key`, `delivery_started_at`, `delivery_instance`       |
| Orçamento de comunicação                   | Zero registros                                                                                |
| Canais gerais de loja                      | Dois; ambos no principal, sem reserva associada, retorno desligado                            |
| Fila WhatsApp                              | Quatro registros `sent`; nenhum outro estado                                                  |
| `authenticated` executa preparação interna | Não                                                                                           |
| `anon` configura entrega                   | Não                                                                                           |
| `authenticated` insere canal diretamente   | Não                                                                                           |

A TI mencionou duas colunas novas na fila. A conferência encontrou **as quatro previstas na migration**; essa diferença de contagem no relato não exige correção do banco.

Hashes completos conferidos:

- `whatsapp-dispatch/index.ts`: `d6611075561e2c43c2397c5c6c9f94f13dbf566be4b8a5d3dadc8ff60da3737d`.
- `whatsapp-channel/index.ts`: `cf209be408cfa9ca327750cc6bfe6fa4f66206a3a212acafdcc1a2ddca8ff42a`.

O banco não mantém registro em `supabase_migrations.schema_migrations`, segundo a TI. A aplicação fica documentada no inventário do projeto; este retorno não comprova aplicação das nº 99/100.

## O que falta, em ordem

1. **Conta WhatsApp ativada para o canal de teste.** A última informação do dono é que o número Salvy existe apenas no painel. A P-116 não ativa uma conta WhatsApp; Baileys requer conta previamente ativada. O pedido de usar somente o servidor, sem aplicativo principal e sem integração oficial, continua sem solução por este método.
2. **Pareamento e homologação autenticada da Loja Teste.** Quando o pré-requisito estiver atendido, usar a administração da plataforma e destinatário de teste autorizado; validar confirmação, remarcação, cancelamento, duplicidade, retirada de consentimento, limite promocional e restrições de papéis. Não enviar a clientes reais. O relatório não autoriza esta etapa.
3. **Reserva, se houver número preparado.** Ainda não existe instância reserva associada. Sua preparação e validação devem anteceder a seleção por falha técnica na administração. Sem alternância automática.
4. **Retorno por frequência.** Mantido desligado em todas as lojas. Só ativar após homologação e decisão expressa para a loja; não é consequência da instalação.

O estado `open` da Arena e `qr` da Loja Teste é informação salva no banco relatada pela TI, não confirmação de conexão viva com Evolution. A Arena está desabilitada para envios e foi preservada. Não houve consulta à conexão viva nesta retomada.

A bancada já aprovada continua registrada no pacote: 467 testes do app, 1.272 verificações SQL (39 específicas) e 49 verificações de reversão. Não foi repetida no banco de produção. Esta retomada altera somente a documentação do estado da entrega.
