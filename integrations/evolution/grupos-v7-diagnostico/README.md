# Evolution7-entry.1 — diagnóstico privado de entrada

Somente local, sem instalação ou publicação. Aplica phone-revision.patch sobre a fonte exata da v7 já entregue; copiar join-request-diagnostics.ts para src/api/integrations/channel/whatsapp/bc-groups/. A patch não muda a comparação: ainda exige o resolvedor autoritativo e falha em pedidos ambíguos. Acrescenta requestStatus com contagens total/matching/unresolved/other; sem telefones ou LIDs no diagnóstico. Campos de telefone não reconhecidos no pedido não viram prova.

A fonte completa de bancada está em /private/tmp/bc-entry-evolution-source. A versão do package/lock e do Dockerfile local é2.3.7-bc.groups.7-entry.1; base OCI fixa da entrega anterior, sem dependência ou migration nova. A fonte original recebida em Downloads permanece intacta. Os testes específicos usam node --test join-request-diagnostics.test.ts. A regressão do motor foi executada sem rede na imagem anterior, montando a fonte nova somente para leitura, com dependências exatas da imagem.

Não trocar imagem por tag mutável, construir no meio do piloto, desligar as guardas, imprimir segredos ou interpretar contagens como autorização de entrada. Publicação/fixação/recriação requerem janela específica. Ver docs/pacotes/2026-11-16-primeiro-acesso-servidor-local-p122.md para a entrega do B&C e os limites do diagnóstico real.

## Pedido expirado —7-entry.2

O titular autorizou implantação e conferência do pedido pendente em16/11. A operação status agora pode ler as contagens de um pedido pending após o prazo, ainda exigindo quórum/admins conectados. Não devolve convite, não modifica o diário nem renova prazo. Prepare/bind continuam bloqueados depois do prazo. O teste adicional cobre explicitamente esses limites; patch de teste em estado-expirado.test.patch. Fonte e imagem final de bancada em7-entry.2, compilação completa e oito testes focados de revisão aprovados.

## Implantação final — 7-entry.3, 16/11/2026

Instalada na janela autorizada, fixada no índice OCI `sha256:5b9093e6ab17fe7f82dfbc7be45a17eac7ab72f2bb072bce7ab640350747e001`. Filho AMD64 `sha256:c540fe5fc71fa1c7f5b13e187fa0886af5a97552691b3ed683b062e1e847bd2d`. Config `sha256:47e4b2376344d526ed5612d574dac3ec72e552e683389932a267641ddc16b13f`. Não confundir índice, filho e config.

A causa comprovada do pedido não reconhecido era o reverse lookup PN/LID depender exclusivamente do cache. `mapeamento-autoritativo.patch` acrescenta `ensurePhoneMapping` usando USync `getLIDForPN`, somente para o PN já comprovado na intenção. A status consulta as contagens sob quórum/admins; nenhuma equivalência por dígitos, nome ou evento. O pedido real passou de unresolved=1 para matching=1, sem alterar diário ou prazo, devolver convite, aprovar, fazer bind ou enviar mensagem.

Sessenta regressões do motor passaram sem rede, além de cinco testes de contagens; compilação completa aprovada. A tentativa anterior venceu e requer clique explícito do cliente em “Retomar com este número”; a rotina não renova consentimento. Consulte a devolutiva de implantação em `docs/pacotes/2026-11-16-codex-entrada-automatica-instalada-p122.md`.

## Cancelamento — 7-entry.4 instalada

Em16/11, correção autorizada de persistência: BcGroupOperation.state é varchar(16), e o marcador antigo phone_revision_aborted tinha22caracteres. Novo marcador phone_rev_abort tem15; leitura preserva compatibilidade com o nome legado. Sem migration. Teste impõe o limite real para cancelamento antes/depois de prepare, repetição e replay. Imagem fixada no índice OCI sha256:2468fc5ea6bedbc7fcd8dbb56c7ae6a71e16735942075230c765a68c211aca30, pronta em26,081s. Cancelamento real passou HTTP200 e lápide da mesma revisão foi conferida no banco. Ver devolutiva de cancelamento em docs/pacotes.
