# B&C — integração local do ciclo de grupos

**11/11/2026. Código e ensaios locais; não é ordem de instalação à TI.** Continuação autorizada pelo dono após a [entrega da extensão Evolution](2026-11-11-evolution-extensao-grupos-local.md). Nenhum envio, grupo real, publicação, VPS ou Flow foi usado.

## Entregue

O B&C agora possui adaptador para `bc-groups-v1`, o contrato da extensão `2.3.7-bc.groups.1`. O processamento reúne criação, configuração, convite do Cliente, pedidos de entrada, inclusão da equipe aprovada, remoção, encerramento e recuperação do ID conhecido. A composição é ensaiada com transporte fictício e PostgreSQL real local.

**A entrada de produção continua com `canProvision=false`.** Não há variável de ambiente que remova essa trava. As nº **105, 106 e 107** continuam não instaladas. Habilitar solicitações no painel não libera o provedor. A extensão Evolution e sua migration também continuam somente locais.

| Etapa              | Comportamento implementado                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Criar              | Usa ID da operação como chave persistente na extensão. Grupo nasce sem Cliente/equipe; não promove ninguém. Guarda ID conhecido antes das demais ações.                                      |
| Configurar         | Confere contrato e administrador; restringe edição/adição e exige aprovação. Não reconfigura o que já está confirmado, evitando eventos desnecessários.                                      |
| Convidar Cliente   | Só produz convite após conferir controles e composição. Guarda-o em tabela privada; apenas o Cliente correto recebe pela RPC existente, com versão, validade e observação recente.           |
| Admitir            | Confere pedido pendente e identidade PN, consentimento e versão. Terceiro ou LID sem correspondência comprovada é rejeitado; posse do link não concede acesso.                               |
| Incluir equipe     | Só pessoa atribuída, aprovada pelo Cliente e ainda vinculada/verificada. Aguarda o Cliente estar presente; inclusão não concede administração. A equipe não recebe o convite administrativo. |
| Remover            | Usa telefone registrado na aprovação, conservado após mudança de identidade. Confere remoção no provedor antes de concluir. Intruso desconhecido ou administrador indevido exige revisão.    |
| Cliente sair       | Evidência negativa de saída invalida convite e autorização imediatamente. Evento posterior não reativa o vínculo. Sem readição, recriação ou fallback individual.                            |
| Cliente voltar     | Exige nova adesão pelo site. Separa autorização de entrada do histórico de uso; não restaura marketing nem notificações.                                                                     |
| Encerrar           | Revoga convite e remove participantes comerciais registrados, preservando números da Plataforma. Não afirma apagar mensagens ou cópias anteriores.                                           |
| Recuperar          | Consulta o diário da extensão pela mesma operação e confere hash. Só guarda ID comprovado; não cria novamente nem reativa vínculo encerrado. Sem prova, continua desconhecido.               |
| Conferir novamente | Worker de serviço pode enfileirar/processar até cinco operações por chamada. A seleção periódica cobre grupos ativos/aguardando; nenhum agendamento real foi instalado.                      |

## Proteções adicionadas durante os ensaios

- Nova autorização no banco antes de cada mutação: posse, prazo, versão, Cliente, equipe, identidade da conta, disponibilidade e pausas. O navegador não escolhe instância ou grupo externo.
- Registro de identidade comercial na aprovação; mudança de telefone não transfere silenciosamente o acesso para o telefone novo. Registros antigos sem essa prova exigem nova aprovação.
- PN/LID só são associados quando vierem juntos no mesmo registro autoritativo, sem conflito. O identificador original é conservado para remoção; LID nunca vira telefone por corte de texto.
- Falha tardia não apaga saída do Cliente nem sobrescreve versão posterior. Confirmação tardia pode guardar ID conhecido, mas não desfaz pausa administrativa.
- Uma tentativa bloqueada não apaga o motivo da pausa do operador. Pedido de revisão explícito continua necessário.
- Evento de entrada apenas solicita reconciliação; não aprova ninguém no webhook. ID estável é aproveitado na deduplicação, sem assumir ordem ou entrega garantida.
- O transporte de administração de grupos não admite rotas de envio de mensagens. Códigos de login e verificação continuam fora dos grupos.

## Arquivos principais

- [Adaptador](../../supabase/functions/_shared/evolution-groups.ts), [processamento e política](../../supabase/functions/_shared/whatsapp-groups.ts), [receptor](../../supabase/functions/whatsapp-groups/handler.ts) e [entrada bloqueada](../../supabase/functions/whatsapp-groups/index.ts).
- **Migration nº 107:** [20261111200000_grupos_integracao_evolution.sql](../../supabase/migrations/20261111200000_grupos_integracao_evolution.sql), dependente das nº 105/106. Acrescenta identidade aprovada, autorização por etapa, entrada voluntária, conclusão, recuperação e reconciliação. Não altera migrations já instaladas.
- [Testes do adaptador](../../supabase/functions/_shared/evolution-groups.test.ts), [testes SQL](../../supabase/tests/grupos_integracao.sql) e [roteiro integrado descartável](../../scripts/testar-grupos-fluxo.py).

## Verificação

- **552 testes** do B&C aprovados, incluindo **32 de grupos**, com transporte inteiramente fictício. Tipos, lint, formatação e montagem conferidos pelo roteiro do projeto.
- **1.494 PASS, zero FAIL/ERROR** no conjunto SQL, incluindo 27 verificações novas; todas as suítes executadas com rollback em container exclusivo.
- **17 verificações no ensaio integrado:** concorrência real entre chamadas de RPC, criação única, convite, admissão, equipe, intruso, perda de vínculo, saída, retorno, encerramento durante leitura e recuperação. Também executa a reversão operacional existente em transação com rollback. Provedor sem rede, dados fictícios e container descartado ao terminar.
- Deno: `whatsapp-groups`, `whatsapp-dispatch` e `auth-otp` conferidos, inclusive o transporte compartilhado.
- Não houve mudança de UI; não repetida a bancada visual anterior como se fosse uma nova validação. Não houve teste físico ou homologação real com WhatsApp.

Reproduzir o ensaio integrado, com Docker local ligado:

```sh
python3 scripts/testar-grupos-fluxo.py
```

O roteiro recusa Docker remoto e container preexistente com seu nome. Cria `barba-grupos-fluxo` na porta local 54334, instala a base fictícia e as três migrations somente ali e remove esse container no final. Não carrega `.env` nem usa credenciais reais. O simulador não executa `fetch`.

## Limites que permanecem

**Esta entrega conclui a integração local do ciclo de grupos, não todo o módulo de mensagens.** Ainda faltam fila/envio de notificações por evento para grupos, avaliação, retorno agendado, atendimento humano e associação dos recibos ao Cliente correto. Preferências continuam armazenadas, mas não disparam essas mensagens. Recibos da extensão não são apresentados como prova de entrega pelo B&C; mensagens próprias não geram respostas automáticas.

A composição e os controles podem mudar entre consulta e chamada: banco e WhatsApp não constituem transação única. Webhook pode não chegar, repetir ou chegar atrasado. Pedido LID não resolvido permanece sem admissão; inclusão recusada por privacidade não é mostrada como concluída. Criar com somente o número da Plataforma e os controles de admissão ainda precisa de homologação real autorizada.

Permanecem também comparação visual esperado/observado no painel, revisão de exportação/exclusão/retenção das novas evidências e testes físicos. Portanto **não liberar piloto nem anunciar o módulo completo como pronto**.

## Próxima janela — roteiro único a concretizar depois dos bloqueios

Nenhuma ação abaixo está autorizada por este registro. A TI não tem nova execução agora.

1. Concluir as pendências de código e revisar a entrega que permitirá habilitar o piloto. Preparar plano de teste com participantes voluntários e critérios objetivos de interrupção.
2. Conferir provedor de banco Evolution, versão/digest por arquitetura, volumes, consumidores de webhook e reversão para imagem atual. Ensaiar fora da produção. A indisponibilidade real só pode ser medida durante janela autorizada; não prometer duração.
3. Com aprovação concreta: publicar/fixar a imagem revisada; aplicar a migration **da Evolution** em etapa própria; recriar somente seu container e medir interrupção. A imagem não executa migrations automaticamente.
4. Com aprovação concreta: instalar **105 → 106 → 107** e funções do B&C correspondentes; configurar o webhook da instância, cabeçalho dedicado e tarefas de serviço, preservando consumidores existentes. Nº 101–104 já instaladas: não repetir.
5. Somente depois das verificações anteriores e da autorização do piloto: habilitar explicitamente a entrega revisada, testar um grupo consentido e conferir criação única, identidades, controles, entrada, saída e interrupção de automações.
6. Se houver divergência, ausência de prova ou restrição: suspender. A [reversão operacional da nº 106](../../supabase/rollback/20261111120000_grupos_atendimento.sql) continua aplicável com a nº 107: desliga adesões, invalida conferências/convites e conserva grupos, histórico e bloqueio de fallback. Não apagar tabelas/grupos como reversão. Reversão de imagem e sessões exige roteiro da TI com os artefatos reais.

O envio ao `origin` publica o site; esta entrega fica em commit local, sem `autossave` ou push.
