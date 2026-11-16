# Evolution7-entry.1 — diagnóstico privado de entrada

Somente local, sem instalação ou publicação. Aplica phone-revision.patch sobre a fonte exata da v7 já entregue; copiar join-request-diagnostics.ts para src/api/integrations/channel/whatsapp/bc-groups/. A patch não muda a comparação: ainda exige o resolvedor autoritativo e falha em pedidos ambíguos. Acrescenta requestStatus com contagens total/matching/unresolved/other; sem telefones ou LIDs no diagnóstico. Campos de telefone não reconhecidos no pedido não viram prova.

A fonte completa de bancada está em /private/tmp/bc-entry-evolution-source. A versão do package/lock e do Dockerfile local é2.3.7-bc.groups.7-entry.1; base OCI fixa da entrega anterior, sem dependência ou migration nova. A fonte original recebida em Downloads permanece intacta. Os testes específicos usam node --test join-request-diagnostics.test.ts. A regressão do motor foi executada sem rede na imagem anterior, montando a fonte nova somente para leitura, com dependências exatas da imagem.

Não trocar imagem por tag mutável, construir no meio do piloto, desligar as guardas, imprimir segredos ou interpretar contagens como autorização de entrada. Publicação/fixação/recriação requerem janela específica. Ver docs/pacotes/2026-11-16-primeiro-acesso-servidor-local-p122.md para a entrega do B&C e os limites do diagnóstico real.

## Pedido expirado —7-entry.2

O titular autorizou implantação e conferência do pedido pendente em16/11. A operação status agora pode ler as contagens de um pedido pending após o prazo, ainda exigindo quórum/admins conectados. Não devolve convite, não modifica o diário nem renova prazo. Prepare/bind continuam bloqueados depois do prazo. O teste adicional cobre explicitamente esses limites; patch de teste em estado-expirado.test.patch. Fonte e imagem final de bancada em7-entry.2, compilação completa e oito testes focados de revisão aprovados.
