# Evolution e grupos — revisão do retorno da TI

Data: 11/11/2026. Entrada: `relatorio-ti-evolution-grupos-2026-11-11.md`, entregue pelo dono, referente à inspeção da TI entre 17h41 e 18h00 (Brasília). Documento de evidência, não autorização de mudanças no servidor.

## Conclusão

Diagnóstico anterior confirmado. A TI relata Evolution 2.3.7, Baileys 7.0.0-rc.9 e imagem de digest `sha256:1bd8afc4a6cf48822e6cf02469aeae7bd35a12a6b616eacd1291926307f4d339`, revisão `cd800f2976e1e5b682fbf86a01ee4d85ae61f370`. Relata paridade de quatro arquivos extraídos com o commit oficial e nenhuma mutação.

O Codex não acessou a VPS nesta revisão. Conferiu o código público do commit informado, corrigiu o receptor **local** e manteve a criação real bloqueada. Nº 105/106 continuam não instaladas. Não repetir o diagnóstico já entregue nem encaminhar trabalho ao Flow.

As primitivas da biblioteca Baileys indicadas pela TI não são endpoints disponíveis no serviço. Acrescentar metadados e operações de admissão exige desenvolvimento da integração e testes; não se resolve habilitando a flag do B&C.

## Achado corrigido no B&C

O [enum oficial de eventos](https://github.com/EvolutionAPI/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/types/wa.types.ts) usa `group-participants.update`, com hífen. O receptor local aceitava o alias `GROUP_PARTICIPANTS_UPDATE` da configuração, mas ignorava o nome nativo. Agora normaliza os dois para a mesma conferência e chave, sem interpretar `participantsData.phoneNumber` como identidade.

Também corrigida a chave de reentrega de mensagens: quando há ID da mensagem, uma mudança na data do envelope não cria um evento novo. Remetente resolvido e finalidade negativa distinguem complementos legítimos. Eventos de grupo sem identificador estável continuam com deduplicação por conteúdo/envelope; isso não garante identificar todas as retransmissões. Eventos atrasados só pausam, nunca reativam.

Dois testes novos reproduzem o contrato nativo e reentrega com outra data, verificando que `apikey` e texto não são persistidos pelo receptor. Total: **534 testes**, incluindo **14** de grupos; tipos/lint/formatação/montagem e checagem Deno aprovados. Sem alteração SQL/UI nesta revisão; as 1.467 verificações SQL, quatro concorrências e 128 verificações UI da entrega anterior continuam como evidência daquela versão, sem alegar nova execução.

## Ajustes necessários à proposta da TI

### Recuperação após criação incerta

Não adotar descrição como garantia de correlação: no [serviço oficial](https://github.com/EvolutionAPI/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts), a descrição é gravada **depois** de criar. A falha pode ocorrer antes do marcador. Nome, horário, criador ou descrição isolados não autorizam associar automaticamente um grupo ao Cliente.

Devolver `correlationId` na resposta/webhook, sozinho, também não resolve queda entre criação e persistência. A extensão precisa registrar a operação antes da chamada, conservar estados conhecidos/desconhecidos e impedir repetição da criação. Mesmo com diário durável, se o WhatsApp criou e o processo caiu antes de registrar o ID, não há garantia de recuperação automática. Nesse caso a resposta é **desconhecido + revisão**, nunca nova criação. O B&C já mantém essa trava.

### Eventos e manutenção

O [webhook oficial](https://github.com/EvolutionAPI/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/integrations/event/webhook/webhook.controller.ts) tem tentativas finitas, em memória. Pode haver **zero entregas**, repetição e inversão de ordem. Portanto não classificar como garantia de “pelo menos uma vez”. UUID/sequência ajudam a reconhecer eventos; não tornam a entrega persistente nem ordenada. Um ID deve ser preservado entre retries, e qualquer sequência que seja usada para ordenar exige persistência e semântica após reinício.

Webhook não substitui consulta autoritativa periódica e imediatamente anterior às ações sensíveis. Cabeçalho personalizado é recurso do webhook **local da instância**; o caminho global examinado não o envia. Não substituir o destino atual sem mapear seus consumidores. Não logar corpo bruto: o payload pode conter `apikey`, independentemente de uma futura conferência do valor de configuração.

### Identidades e recibos

Continuar rejeitando LID convertido em telefone por corte de texto. Campos PN/LID oriundos dos metadados originais podem embasar uma associação, desde que pertençam ao mesmo participante e sejam validados contra a identidade confirmada do Cliente. Associação ambígua ou conflitante exige pausa. A resolução real em execução ainda não foi testada.

Recibo agregado não prova entrega ao Cliente. A extensão de recibos pode ser posterior: enquanto não existir, o produto deve continuar exibindo apenas aceite/entrega não confirmada. Não fabricar recibos nem bloquear todo o desenvolvimento por essa melhoria opcional.

## Próxima etapa técnica, sem instalação

Preparar uma extensão revisável sobre o commit exato informado, com testes simulados e contratos fechados antes de integrar no B&C. Não trocar pela ramificação `develop` nem pela tag mutável. Os nomes propostos pela TI abaixo são **contratos de desenvolvimento**, não rotas que já podem ser chamadas.

| Bloco                  | Entrega e critérios de aceitação                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A — controles/consulta | Expor modos de adição e aprovação com enumeração estrita; validar JID de grupo, credencial e instância; conferir privilégios reais do número. Retornar `memberAddMode`, `joinApprovalMode`, `addressingMode` e participantes na consulta, sem inventar valores quando faltarem. Não confundir `locked` com adição restrita.                                              |
| B — entrada/identidade | Listar, aprovar e rejeitar pedidos; conservar PN e LID originais; tratar evento de pedido de entrada sem autopromover ninguém. B&C decide pela identidade, consentimento e vínculo, nunca pela posse do link. Testar terceiro com convite, PN/LID ausente/conflitante, Cliente que retirou adesão e troca de equipe.                                                     |
| D — tentativa durável  | Operação por instância + chave, registrada antes de criar; concorrência única; ID conhecido persistido antes de descrição/configuração posteriores; repetição devolve estado anterior. Falhas antes/depois da chamada e queda entre criação/persistência devem manter desconhecido quando não houver prova. Nenhuma promessa de execução exatamente uma vez no WhatsApp. |
| C — observabilidade    | ID de evento estável nas retransmissões, contrato de versão e deduplicação; separar melhoria de identificação de uma eventual fila persistente. Sem depender de ordem de entrega. Receptor deve tolerar implantação gradual e ignorar campos extras.                                                                                                                     |
| E — recibos            | Opcional para o primeiro piloto; se implementado, expor identidade e tipo/horário do recibo por participante. Sem identificação do Cliente, estado permanece não confirmado.                                                                                                                                                                                             |

O escopo não se limita necessariamente aos quatro arquivos mencionados no relatório: DTOs, registro de eventos, persistência, testes e build podem exigir mudanças. Apresentar diff, testes, contrato e artefato por digest para revisão; não prometer alteração pequena sem verificar essas dependências.

Ainda será necessário completar a saída de grupo/convites/remoção no B&C conforme [pendências locais](../grupos-atendimento-2026-11-11.md#pendências-antes-de-qualquer-piloto). Esta revisão não implementa o fork da Evolution e não libera o adaptador.

## TI e janela futura

Não há nova execução operacional pedida à TI agora. A inspeção recebida encerra o pedido anterior. Conservar o relatório original como evidência.

Antes de uma futura janela autorizada: revisar a diferença de digest relatada, conferir opções efetivas sem revelar valores sensíveis, preservar volumes/sessões, identificar consumidores de todas as instâncias, preparar reversão por digest e interromper emissores quando necessário. Fixar imagem, recriar container, configurar webhook, instalar migrations ou criar grupo de teste são mudanças separadas; não estão autorizadas por este documento. Duração da indisponibilidade não foi medida e não deve ser prometida como “alguns segundos”.
