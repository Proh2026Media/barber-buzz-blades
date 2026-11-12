# Evolution — contrato protegido de grupos v2

Entrega local em 11/11/2026. **Não instalada nem publicada.** Este pacote substitui integralmente o patch v1 para construções novas; não aplicar os dois patches em sequência. Não autoriza operação na VPS.

## Fonte, versão e reprodução

Base: `EvolutionAPI/evolution-api`, commit `cd800f2976e1e5b682fbf86a01ee4d85ae61f370`. Versão `2.3.7-bc.groups.2`, contrato `bc-groups-v2`. Dependências preservadas no lockfile. [Patch completo](evolution-bc-groups.patch), incluindo testes e migrations dos dois provedores, e [SHA-256](SHA256SUMS). Aplicação conferida em cópia limpa da base.

A partir de checkout separado da base exata, conferir SHA-256, executar `git apply --check` e aplicar o patch. Depois:

```sh
npm ci --ignore-scripts --no-audit --no-fund
DATABASE_CONNECTION_URI='postgresql://local:local@127.0.0.1:59999/local' npx --no-install prisma generate --schema prisma/postgresql-schema.prisma
npx --no-install tsc --noEmit
npm run test:bc-groups
npm run build
```

`python3 testar-banco-local.py /caminho/do/checkout` instala as duas migrations da extensão em PostgreSQL descartável próprio, porta 54332, testa e remove somente seu container. Exige Docker local; não lê `.env` nem acessa a VPS.

Dockerfile fixa a base em `evoapicloud/evolution-api@sha256:1bd8afc4a6cf48822e6cf02469aeae7bd35a12a6b616eacd1291926307f4d339` (índice OCI). O filho AMD64 é `sha256:456b4104b0ddffbb092d6b3c0560a4ae86fc3e014e885b882aca4b1b371dfc81`. As referências não demonstram divergência de implantação.

Imagem local construída: `local/bc-evolution-groups:2.3.7-bc.groups.2`, Linux/AMD64. Índice/ID local `sha256:109213e71679b426dada691d5116eabb502f60274385b44ce3b6578829fec259`; configuração `sha256:5f4336075df8468f873f3f15a32152a3f422aa5108ca88603e44660f51ef7a2b`. Não são um endereço de registry disponível à TI. A imagem inicia `node dist/main.js`, sem aplicar migrations automaticamente.

## Proteções acrescentadas

- Treze rotas com guarda existente, segredo adicional `x-bc-group-key`, parâmetros fechados e instância somente no caminho. Todas exigem `BC_GROUPS_API_SECRET` com ao menos 32 caracteres.
- `POST /group/bcSendCode/:instanceName`: aceita UUID de tentativa, JID de grupo/cliente, conjunto autorizado de JIDs da plataforma, finalidade `login`/`verify_phone`, expiração e código de seis dígitos. Texto produzido internamente; não aceita texto arbitrário.
- Conferência ao vivo de cliente presente, composição exata, identidade não ambígua, cliente sem administração e controles de entrada. Nome/descrição não identificam o grupo.
- Diário antes do envio: `code_unknown` até comprovação de aceitação; repetição da mesma chave consulta o diário, sem transmitir novamente. Código/texto não entram no diário, nem no hash enumerável da operação. Aceitação não comprova entrega/leitura.
- Trava persistente por instância em `BcGroupLease` serializa comandos do contrato, inclusive envio e mutações. Não expira automaticamente: queda do processo pode exigir revisão manual. Outro processo não pode remover a trava sem o token correto.
- `bcSetting`, `bcMember`, `bcInvite`, `bcRevoke` substituem caminhos legados usados pelo B&C. Inclusão aceita apenas números autorizados da plataforma; não adiciona cliente automaticamente nem promove profissional. Rotas antigas de `/group` são recusadas para instâncias habilitadas.
- Mensagens próprias de código e suas citações são descartadas antes do histórico/upsert da aplicação e do webhook correspondente. O envio direto não usa o caminho de persistência de texto da Evolution. Isto não apaga cópias recebidas, backups anteriores ou o histórico do aparelho.

As outras oito rotas e os eventos descritos no [pacote v1](../grupos-v1/README.md) permanecem com o contrato v2. Webhook não garante entrega, ordem ou unicidade; reconciliação continua obrigatória. Consultar status de criação incerta nunca recria grupo.

## Configuração e banco

Padrão `BC_GROUPS_EXTENSION_ENABLED=false`. Ativação também exige `BC_GROUPS_INSTANCES`, mapa `BC_GROUPS_PLATFORM_JIDS` e segredo. No B&C: `WHATSAPP_GROUP_PILOT_ENABLED=true` e `WHATSAPP_GROUP_API_SECRET` correspondente, além do segredo de webhook separado. Nenhuma configuração real foi alterada.

Migrations próprias da Evolution: `20261111190000_bc_group_operations` e `20261111220000_bc_group_codes` (campo `messageId` e tabela de trava). São distintas das nº 105–109 do Supabase B&C. PostgreSQL ensaiado; MySQL exige homologação específica se for o provedor real. Não executar migrations com URLs/segredos aparecendo no relatório.

## Testes e limites

29 testes de política/HTTP/webhook e quatro com PostgreSQL real/duas conexões passaram. Tipos, lint dos fontes alterados, montagem e construção da imagem passaram. Incluem segredo obrigatório das 13 rotas, falta de controles/cliente, terceiros, cliente administrador, expiração, concorrência, resultado incerto e persistência da trava/aceitação após reinício dos clientes de banco.

A trava coordena os comandos deste contrato; não controla ações externas do próprio WhatsApp. Rotas gerais de mensagens/chats e integrações externas não constituem uma sandbox por usuário da barbearia. A TI deve comprovar que os profissionais não têm credenciais, sessão/aparelho pareado, acesso a painéis, logs, backups ou exportações desses números. Não habilitar OTP se esse isolamento não estiver demonstrado. Não houve grupo/mensagem real, ensaio PN/LID ao vivo ou medição de indisponibilidade. Não há promessa de eliminação de restrições da Meta.

## Preparação posterior à revisão TI

O cadastro de barbearia ganhou alternativa autenticada (B&C nº 110), sem alterar este patch. Roteiro vigente: [implantação e piloto](../../../docs/pacotes/2026-11-11-ti-p120-implantacao-piloto.md). O dono autorizou os quatro itens; conexão do número e identificação do cliente ainda faltam.

`testar-banco-local.py` agora espera TCP do PostgreSQL; quatro testes passaram em três execuções. `testar-reinicio-local.py` mediu três recriações em rede interna (13,413 / 13,373 / 13,472 segundos), sem WhatsApp real e preservando volume sentinela. Isso não prevê indisponibilidade na VPS.

`publicar-imagem.py CHECKOUT_BASE ghcr.io/ORGANIZACAO/bc-evolution-groups:2.3.7-bc.groups.2 SAIDA_JSON` prepara fonte exata, constrói e publica AMD64, retornando digest. Exige credencial Docker de publicação do Guardião; não foi executado contra registry nesta máquina. Não instala nem altera produção.
