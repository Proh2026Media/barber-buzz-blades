# P-28 — Para TI: concluir a preparação operacional do PR #37

**Atendido em 01/11:** procedimento TI de 18:55–18:56 recebido e lido inteiro; PR #37 integrado externamente às 18:57, main `13f1dc9` com conteúdo idêntico ao revisado. [Resultado, correções dos comandos e etapa A pronta para decisão](2026-11-01-ti-flow-pr37-runtime-ensaio-conferido-p28.md). Não pedir outro relatório geral, repetição dos testes locais ou nova decisão de merge. A execução de runtime/ensaio fictício na VPS ainda não ocorreu; Google não bloqueia essa etapa. O texto abaixo preserva o pedido de preparação original.

**01/11/2026 · Complemento ao pacote de cópia/retorno, somente preparação.** O PR #37 já existe e seus quatro ajustes foram [conferidos pelo Codex](2026-11-01-flow-pr37-ajustes-conferidos-p28.md): **86 testes + quatro casos independentes aprovados**. Usar o head **`67e7fb785b7c11163438aa82a41e3d947a3ff212`**. Não repetir abertura de PR, instalação #36, diagnóstico de 15:32:55 ou inventário geral.

## 1. Aproveitar o retorno já entregue

`relatorio-ti-flow-copia-integracoes-p28-2026-11-01.md`, 17:29–17:31 Brasília, foi encontrado e lido pelo Codex. Suas conferências de fonte em banco, porta, cron, imagens e custódia/retenção estão incorporadas. O trecho “aguardando PR” ficou atendido; não é motivo para outro levantamento ou bloqueio.

O [contrato de cópia/retorno](2026-11-01-ti-flow-copia-restauracao-ensaio-p28.md) continua válido: JSON seletivo consistente, par coerente, arquivos privados, referências sem restauração automática, varredura atual preservada e procedimento próprio para a futura virada. Retenção/custódia continuam propostas; nada apagar automaticamente.

## 2. Runtime e isolamento: fechar o procedimento

Leitura própria de 01/11, 18:44 Brasília: **VPS linux/amd64, Bun não localizado no PATH do root nem em `/root/.bun/bin/bun`, sem imagem Bun em cache**. DB/funções saudáveis e sem reinício adicional; rede Flow `vv3jo93anprhqezhtu4ewcpl`. Não é necessário reinstalar ou reconfigurar a aplicação para preparar as ferramentas.

Opção a revisar: runner temporário com **`oven/bun:1.4.2@sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2`**, manifesto linux/amd64 conferido no registro público. Nenhum pull ou execução remota foi feito pelo Codex. Não instalar Bun no host nem usar tag `latest` para encurtar o roteiro.

Entregar os comandos reais e o encerramento, distinguindo:

| Uso                              | Condição a demonstrar                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ler código/configuração sem rede | Fonte fixada fora de stack/API/funções, montada somente leitura; arquivos privados com dono/modos corretos; runner sem rede quando possível                    |
| Testar restauração fictícia      | PostgreSQL novo/exclusivo, sem cópia real e sem publicar sua porta; URL local para passar pela guarda; sem conectar a rede de produção                         |
| Captura real futura              | Runner separado, somente após autorização própria, acesso apenas pela rede Flow e conexão em arquivo privado; nenhum comando da suíte de teste usa esse acesso |
| OAuth futuro                     | Só loopback/URI exata e túnel local; nenhuma porta pública ou substituição da configuração/conexão vivas                                                       |

A guarda do restaurador exige host local. Em runner separado, `127.0.0.1` aponta para o próprio namespace, não para um serviço Docker vizinho. Para o ensaio fictício, uma solução a conferir é **compartilhar somente o namespace de rede do container fictício** (`--network container:<container-ficticio>`), mantendo o PostgreSQL sem porta publicada; outra solução precisa demonstrar o mesmo isolamento. Não usar rede `host`, encaminhar o Postgres real para satisfazer a guarda ou remover a guarda.

Antes de rodar a suíte, comprovar o alvo pelo ID/label do container fictício e conferir que a URL privada aponta para ele: o apoio dos testes cria/remove bancos-modelo fictícios. Não fornecer a ele a conexão de produção. Para os arquivos `0600`/`0700`, resolver explicitamente usuário e mounts do runner; nunca tornar credenciais legíveis por todos para fazê-lo funcionar. Sem Docker socket dentro do runner, mounts amplos de `/root`, segredos em argumentos ou aplicação de ferramentas sob `volumes/functions`.

O relatório anterior já identifica imagem PostgreSQL 15 disponível. Escolher a imagem exata/digest do ensaio, confirmar compatibilidade e não ligar a stack de teste compartilhada parada. A execução dessa preparação na VPS ainda deve ser proposta para decisão; não foi autorizada pelo recebimento deste arquivo.

## 3. Dados restantes: confirmar sem repetir inventário

1. Operador/conta Google que pode consentir; identidade completa fica no canal privado/cofre, resultado público só confirmado/pendente.
2. Arquivos antigos relevantes fora da amostra do banco, indicados em manifesto privado somente de IDs. Não presumir Drive vazio pelos mapas zerados.
3. Metadados atuais do **cliente novo já criado** em `flow-proh-media-drive` (930474870480), Audience e marca separados; propriedade verificada associada. Não criar outro projeto/cliente ou pedir novamente acesso DNS.
4. Custódia da credencial nova e ciclo de vida do candidato, com diretórios exatos e destinatário privado aprovado; sem enviar valores ao Codex/Git/relatório.
5. Porta/URI/túnel e ordem de encerramento. Proposta preservada: `http://127.0.0.1:8765/oauth/callback`, somente no cliente novo, sem alterar entradas existentes. Consultar estado primeiro; adicionar URI exige decisão própria.

Nesta rodada não capturar as duas linhas, obter refresh token, iniciar consentimento, criar permissões, alterar Google/URI/DNS/IAM/Branding ou revogar. Usar os comandos reais documentados no head conferido para montar o roteiro, sem executá-los com dados vivos.

## 4. Devolutiva única esperada

Retornar um Markdown sem segredos com:

- Versão do código e manifesto dos arquivos; runtime/imagens fixados; caminhos, mounts, usuário, rede/namespace, comandos de início/validação/encerramento e como preservar outros containers.
- Classificação por etapa: **somente proposta**, **leitura conferida**, **teste fictício já executado** ou **execução real ainda não feita**. Os 86 testes do Codex são evidência própria dele; não atribuir sua execução à TI.
- Operador e estados restantes confirmados/pendentes, sem credenciais/IDs de arquivos em texto público. Aproveitar as conferências do relatório anterior; revalidar só itens que mudem ou dependam do instante de execução.
- Escopo e autorização a solicitar depois: primeiro runtime/ensaio fictício e captura protegida, com suas etapas separadas; consentimento Google e virada não ficam incluídos automaticamente. Se propor outro agrupamento, explicitar efeitos e como desfazer.
- Para a futura virada, manter a pendência da barreira contra cron/requisições em andamento/callbacks, cache e aceitação antes de reabrir gravações. Essa parte não é resolvida apenas por os testes de código terem passado.

Não repetir os quatro ajustes do Claude: estão atendidos no head indicado. Não executar merge, instalação/migration em produção, mudanças de cron/env ou qualquer ação com material real por este encaminhamento. Codex revisará o procedimento concreto e então levará a etapa de execução ao dono.
