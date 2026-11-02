# P-28 — Preparação C conferida; próximo passo é T1 fictício

**02/11/2026 · Revisão da preparação recebida, sem execução de C.** A/B continuam concluídas. O próximo passo concreto é [T1 — teste fictício do transporte](2026-11-02-ti-flow-transporte-t1-p28.md), pronto para decisão do dono, incluindo instalação delimitada de `socat`. T1 não depende de URI Google, segredo ou manifesto real. Não pedir novamente acesso da TI à conta, PR/correções, backup B ou inventário geral.

## 1. Fontes e fatos aproveitados

Lido inteiro **`relatorio-ti-flow-preparacao-c-p28-2026-11-02 1213.md`**, 188 linhas, elaboração em 02/11 às 00:08 Brasília. SHA-256 do relatório sem segredos: `daa8dfe2bdf0f680513d2bfb1ee7c9c869379739035164980d2222f042f9d15e`. Seu conteúdo é preparação e leitura; propostas não foram tratadas como autorização de instalação, listener, Google ou virada.

| Item                | Evidência / estado                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operador            | **TI tem acesso à conta Drive atual**, confirmado por Alyson; não perguntar novamente                                                             |
| Projeto             | TI conferiu `flow-proh-media-drive`, **930474870480**, no console                                                                                 |
| Cliente             | TI conferiu um cliente **Web application**, **“Flow Drive (produção)”**, criado em 31/10, um segredo habilitado/mascarado                         |
| Origem JS           | TI conferiu `https://flow.proh.media`                                                                                                             |
| URI existente       | TI conferiu apenas `https://supabase.proh.media/functions/v1/google-drive/callback`                                                               |
| URI fictícia/local  | **`http://127.0.0.1:8765/oauth/callback` ausente** segundo TI; não cadastrada                                                                     |
| Audience / Branding | TI relata External/em produção, app Flow PROH Media, domínio `proh.media`, páginas Flow, sem logo e marca ainda não verificada; estados separados |
| API / escopo        | TI relata Drive API habilitada, `drive.file` e verificação de acesso a dados não necessária no estado observado                                   |
| Propriedade         | Associação de propriedade Search Console/projeto ainda não conferida; acesso DNS já conhecido não resolve esse item                               |
| Custódia C          | Proposta `/root/flow-p28-c-<UTC>/`, 0700/0600, root/TI e Guardião; separada de B; não criada                                                      |

As leituras do console são atribuídas à TI, não a uma sessão Google executada pelo Codex. O e-mail de suporte/desenvolvedor não prova a identidade da conta conectada ao Drive; a configuração futura deve usar a conta efetiva, em canal privado.

## 2. Conferências e ajustes do Codex

**URI Web:** a documentação oficial Google mantém exceção de localhost/IP local para HTTPS/IP e exige correspondência com o redirect cadastrado. Portanto a URI proposta é compatível com cliente Web; sua adição ainda é ação própria, preservando a entrada existente. Não cadastrar para executar T1. [Regras de redirect](https://developers.google.com/identity/protocols/oauth2/web-server#redirect-uri-validation-rules), [gestão de clientes](https://support.google.com/cloud/answer/15549257).

**Segredo novo:** a documentação informa que o segredo completo é visível/baixável na criação; depois o console mostra apenas identificação parcial. Ver um segredo habilitado/mascarado **não comprova que o Guardião tem o JSON/valor guardado**. Guardião deve confirmar somente disponibilidade e custódia do segredo já existente, sem enviar valor. Se não estiver guardado, não criar/rotacionar/desativar outro automaticamente: preparar decisão específica. Isso bloqueia a execução real de C, **não T1**. [Visibilidade do segredo](https://support.google.com/cloud/answer/15549257#client-secret-handling-and-visibility).

**Cliente antigo:** `cliente_antigo_id` da bancada deve representar o **cliente OAuth do Drive atualmente usado pelo Flow**, não o cliente de login do Barba & Cabelo. Ambos devem ser preservados; não usar o identificador B&C como substituto por conveniência. Identidade/conta reais continuam privadas e não são necessárias para T1.

**Transporte:** o desenho host/túnel/loopback é pertinente. Para reduzir a dependência de PID de host e tornar o procedimento executável, o pacote T1 usa `socat` no host → `docker exec` no **ID completo fixado** → retransmissor Bun só para loopback. Não há Docker socket dentro do runner, pacote dentro da imagem, mudança na ferramenta Flow ou rede host. A alternativa Python do anexo era apenas esboço e não foi promovida a comando aprovado.

**Servidor de teste:** `python3 -m http.server` sozinho não verifica Host como a bancada. O pacote traz servidor Bun fictício que exige `Host` exato, retorna 421 para Host incorreto, 405 para método errado e 404 para callback; nenhuma rota inicia OAuth.

**Isolamento:** falha de DNS do nome do DB não prova, sozinha, impossibilidade de alcançá-lo por IP/porta publicada. T1 usa **`--network none`**, sem DNS/egresso, rede Flow ou porta Docker publicada. Para C real, que precisará de HTTPS Google, o isolamento de rede deve ser conferido à parte; não atribuir a uma consulta `getent` uma garantia maior. [Modelo de redes bridge Docker](https://docs.docker.com/engine/network/drivers/bridge/).

## 3. Leitura própria da VPS, sem mudanças

Por SSH, apenas presença de ferramentas e consulta/simulação de pacotes:

- `python3` e `nsenter` presentes; **`socat` ausente**.
- Candidato do repositório Ubuntu Noble/amd64: **`socat=1.8.0.0-4ubuntu0.1`**.
- `apt-get -s --no-install-recommends install socat`: **zero atualizações, um pacote novo, zero remoções**, saída 0. Não executar `apt autoremove` sugerido incidentalmente pela saída; outro pacote fora do escopo não é parte do teste.
- Hook `/etc/apt/apt.conf.d/99needrestart` e `/usr/lib/needrestart/apt-pinvoke` lidos: a instalação deve usar **`NEEDRESTART_SUSPEND=1` somente no comando APT**, evitando o acionamento automático de reinícios sem alterar configuração permanente. Nenhum hook foi executado por esta revisão.
- Nenhuma instalação, `apt update/upgrade`, listener, túnel ou escrita remota. Sem ler B, segredo Google, valores de env ou banco.

## 4. Pendências para C real e responsáveis

1. **Guardião:** confirmar disponibilidade do segredo novo já guardado e custódia proposta. Somente confirmação, sem valores no relatório.
2. **TI/operador:** responsável proposto pelo manifesto privado dos três IDs principais e referências/arquivos antigos relevantes, na futura preparação autorizada de C. Não pedir ao dono que escolha um desenvolvedor para essa coleta; dados ficam privados. Não extrair/gravar agora por este relatório.
3. **TI:** confirmar propriedade associada ao projeto e fechar metadados/custódia/conta efetiva. Não inferir a conta Drive pelo suporte do aplicativo, modificar marca, DNS ou IAM.
4. **Após T1 revisto e decisão própria de C:** adicionar a URI local somente ao cliente novo se ainda ausente, colocar credencial/manifesto privados, conferir configuração, executar candidato e renovação/GETs. A conexão viva e o backup B ficam intactos.
5. **D continua própria:** barreira de escritores, nova captura imediatamente anterior, promoção/aceitação/reabertura. Nenhuma autorização de T1 inclui C/D.

O objetivo permanece a P-28 do Barba & Cabelo pela separação Google escolhida do Flow. Esta revisão não abre frente funcional, novo PR ou migração automática. O [pacote T1](2026-11-02-ti-flow-transporte-t1-p28.md) é a próxima ação delimitada para decisão; não é necessário repetir a preparação geral.

**Validação do registro e pacote:** tipos, **301 testes Barba & Cabelo**, formatação dos oito documentos e montagem aprovados; 20 links/âncoras locais e sintaxe de quatro blocos Bash conferidos. Servidor/retransmissor tiveram seis verificações locais aprovadas após correção do EOF; T1 socat/SSH/VPS não foi executado. Não confundir esses resultados com autorização ou execução de C real.
