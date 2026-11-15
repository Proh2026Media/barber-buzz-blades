# Evolution B&C — extensão 2.3.7-bc.groups.5

Fonte completa, patch sobre a revisão oficial `cd800f2976e1e5b682fbf86a01ee4d85ae61f370` e contrato privado `bc-groups-v3`. Somente entrega local; não instalada nem publicada no registry. Não sobrepor a v2 com um patch incremental v4 antigo.

O roteiro operacional completo está em `docs/pacotes/2026-11-14-ti-central-whatsapp-p122.md`. A v5 exige os 14 incrementais B&C juntos, as funções completas e a terceira migration da Evolution. O backend B&C usa `WHATSAPP_GROUP_CYCLE_ENABLED`, além da flag antiga, e política própria desligada por padrão. Flags antigas verdadeiras não liberam o contrato novo.

## Implementação e verificações

Dois ou mais números da plataforma administradores, cliente comum, identidade PN/LID comprovada, serialização persistente entre contas, criação única com corpo imutável, recuperação somente por diário e prova real. Foto pelo criador; primeira mensagem, descrição e fixação por outro número. Prova recebida pelo criador antes de liberar convite ou código. Contratos genéricos de envio/edição/chat bloqueados nas instâncias geridas. OTP próprio ou citado não é encaminhado a histórico/webhooks secundários.

Composição aceita até 20 contas de envio distintas. Não são usuários ou telefones pessoais dos profissionais. Inclusões/retiradas por distribuição exigem consentimento atualizado no B&C, preservam JID e mantêm o criador até encerrar. Reserva manual pode transmitir com principal offline depois do preparo; o código nunca escolhe outra conta para retransmitir mensagem incerta ou contornar restrição.

Ciclo de um ano civil em UTC, contado da criação comprovada. Saída/reentrada não reinicia o prazo nem o limite promocional. Encerramento revoga convite, remove o cliente, retira contas intermediárias e confirma a saída do último administrador. Exclusão da conversa é por conta e só com intervalo comprovado; falta de prova fica pendente. Nenhum mecanismo apaga o histórico em aparelhos de terceiros. Marca é removida do diário ao fechar; após limpeza comprovada, dados do cliente/ranges/evidências são minimizados, mantendo a lápide do JID.

51 testes de política/HTTP/eventos/SVG/LID e 15 de PostgreSQL/duas conexões aprovados. Tipos/lint e montagem aprovados. Imagem AMD64 construída sobre digest exato e inicializada/recriada em rede Docker interna sem sessões WhatsApp. Volume sentinela preservado. PostgreSQL é o alvo homologado; o schema MySQL acompanha a fonte, sem homologação de runtime MySQL.

## Reprodução

Em checkout isolado da revisão oficial:

```bash
git apply --check evolution-bc-groups.patch
git apply evolution-bc-groups.patch
npm ci
```

Com Prisma gerado para uma URI fictícia local ou pela bancada fornecida, executar `npm run test:bc-groups`, `npm run lint:check` e `npm run build:bc-runtime`. Os testes de banco só aceitam PostgreSQL descartável em `127.0.0.1:54340`, com marcador `BC_GROUP_TEST_DATABASE=local-only`; usar o script de bancada B&C para criá-lo e removê-lo.

A construção da imagem usa `tsup.bc.config.ts`: somente a entrada do servidor em CommonJS, sem recompilar centenas de entradas redundantes em dois formatos. Mantém recursos e traduções usados pelo servidor. A primeira tentativa com o build genérico excedeu a memória da bancada; a construção dedicada e o início real da API passaram depois do ajuste.

## Migration e imagem

As duas migrations `20261111190000_bc_group_operations` e `20261111220000_bc_group_codes` são byte a byte iguais às da v2 instalada. Não reaplicar, renomear ou cadastrar artificialmente no histórico Prisma. Aplicar somente `20261114003000_bc_group_cycles` no schema `evolution_api`, pelo SQL atômico do pacote. Não usar `prisma migrate deploy` ou `db push` na VPS para esta entrega.

`publicar-imagem.py` constrói a fonte exata em diretório temporário, confere SHA-256, publica AMD64 e grava o digest retornado pelo registry. **Não foi executado.** Exige autorização para publicação e autenticação de registry sob custódia da TI. Usar a imagem nova pelo digest obtido; não confundir digest do índice com o da plataforma AMD64. A imagem nasce com a extensão desligada. Recriação do container, preservação de segredos/volumes e ativação do piloto são etapas separadas de operação.

## Limites de mídia e entrega

Logo obtida pelo B&C somente do bucket público autorizado da loja, sem redirecionamentos, até 2 MiB. PNG/JPEG/WebP e SVG autocontido de caminhos/formas/gradientes são rasterizados e limitados a 4 milhões de pixels/512 px. SVG com texto/fontes, scripts, imagens externas, `use`, filtros ou recursos não permitidos é recusado. Nesse caso a loja precisa fornecer PNG/WebP ou SVG convertido em contornos; não usar logo da plataforma como substituição silenciosa.

Fixação usa durações nativas de 24 horas, 7 ou 30 dias, renovadas pelo worker dentro da validade do ciclo. Não há fixação permanente. Webhook pode faltar, duplicar ou chegar fora de ordem: ele pede conferência; nunca confirma prontidão sozinho. Aceite do provedor, prova por outro administrador e entrega ao cliente são situações distintas. Nenhuma medição ou distribuição garante ausência de restrição pelo WhatsApp.
