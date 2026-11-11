# Evolution — extensão local para grupos do B&C

**11/11/2026. Entrega de código para revisão, sem pedido de instalação à TI.** Complementa o [retorno já encerrado](2026-11-11-evolution-grupos-retorno-ti.md). A confirmação da TI foi recebida como evidência; a autorização vigente continua limitada ao desenvolvimento local.

## Resultado

Preparada extensão `2.3.7-bc.groups.1` sobre a revisão pública exata `cd800f2976e1e5b682fbf86a01ee4d85ae61f370`. [Pacote completo](../../integrations/evolution/grupos-v1/README.md), patch com SHA-256, Dockerfile e quatro arquivos de testes. Inclui controles de adição/admissão, pedidos de entrada, tratamento conservador PN/LID, diário persistente de criação, identificação dos eventos e recibos por participante.

**26/26 testes aprovados**, incluindo HTTP em loopback, controlador de webhook e PostgreSQL descartável com duas conexões. Tipos, lint da produção alterada, montagem e schemas Prisma aprovados. Imagem Linux/AMD64 construída localmente. Patch aplicado sem conflito em checkout limpo da revisão exata. Regressão B&C: 534/534 testes, tipos, formatação e montagem aprovados. Nenhum grupo/mensagem real, sessão de produção ou recurso do Flow foi usado.

A criação fica desconhecida quando faltar prova, sem repetição automática. Webhook pode chegar zero vezes, repetido ou fora de ordem; os novos IDs não acrescentam durabilidade. A inicialização da imagem não aplica migrations: alteração de banco exige etapa separada. O pacote inclui migration do banco da Evolution, além das nº 105/106 do B&C ainda pendentes.

## Correção da leitura dos digests

Consulta do manifesto público por `docker buildx imagetools inspect` confirmou: `1bd8afc4…d339` é o índice OCI; `456b4104…dfc81` é seu filho Linux/AMD64. Portanto a diferença descrita no relatório TI não prova que compose e runtime usam imagens distintas. O relatório original permanece preservado como evidência. Ainda se deve fixar imagem revisada por digest na futura janela; tags podem mudar. Nenhuma inspeção da VPS foi realizada nesta entrega.

## O que falta

1. Integrar o adaptador do B&C às novas rotas e finalizar convites, remoções, fila de grupos, reconciliação e recibos. `canProvision` continua falso; não liberar apenas por existir a extensão.
2. Completar ensaios integrados de consentimento, revogação, troca de equipe, falhas e identidade. Capacidade simulada não comprova comportamento do WhatsApp real.
3. Revisar o pacote, produzir imagem distribuível e planejar implantação/reversão com provedor de banco, volumes, consumidores de webhook e versão exata conferidos.
4. Somente com as autorizações específicas: publicar/fixar imagem, migration da Evolution, recriar container, configurar webhook, instalar nº 105/106 e realizar piloto com grupo de teste. Não reaplicar nº 101–104.

**Agora não é necessário enviar nova ordem operacional à TI.** O próximo trabalho continua no código. Não executar `autossave`/push: o envio ao origin publica o B&C. A indisponibilidade de uma futura recriação ainda não foi medida.
