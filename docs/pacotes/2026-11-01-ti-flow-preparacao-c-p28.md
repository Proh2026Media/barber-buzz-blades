# P-28 — Para TI: preparar C com os dados restantes, sem consentimento

**Retorno recebido/conferido; T1 também concluído em 02/11:** [resultado do transporte fictício](2026-11-02-flow-t1-concluido-p28.md). Não repetir preparação geral, instalação ou teste. Próximo: [somente requisitos restantes para TI/Guardião](2026-11-02-ti-flow-requisitos-restantes-c-p28.md): segredo já guardado, responsabilidade/fonte privada do manifesto, custódia/propriedade e plano de navegador/egresso/isolamento. O texto abaixo é o pedido inicial respondido, não autorização de C real/D.

**01/11/2026 · Somente preparação e leitura dos metadados necessários.** [A e B concluídas](2026-11-01-flow-etapa-b-concluida-p28.md). O objetivo é destravar a verificação Google do **Barba & Cabelo** pela separação já escolhida do Drive do Flow. Este arquivo é para a **TI**, não é pedido de desenvolvimento geral ao Claude e não autoriza consentimento ou virada.

## 1. Aproveitar o que já está resolvido

- Código #38 integrado/revisado, commit `9837ebc873554d3e7685f792c18d01349418ed2e`, ferramentas `fb576d0970c46fe9dcb918fa10be59d62f2111a3`, 19 arquivos. Ensaio fictício 93/0/0 e captura/validação reais atendidos. Não repetir testes/cópia/PR/merge/#36/diagnóstico.
- Cópia secreta de B já sob custódia TI/root: `/root/backup-flow-integracoes-p28-20261102T020042Z/`, 0700/0600. Não anexar, transferir ou reler seu conteúdo para montar relatório público; não apagar.
- Projeto novo **`flow-proh-media-drive`**, número **930474870480**, cliente **“Flow Drive (produção)”**, já criado segundo os retornos anteriores. Não criar outro. Projeto/cliente do Barba & Cabelo no `proh-media-drive` preservados.
- Acesso DNS da TI a `proh.media` já confirmado. Não perguntar novamente, alterar TXT/IAM ou confundir acesso administrativo com propriedade Google verificada.

## 2. Confirmar apenas os dados que C exige

| Item                           | Devolutiva necessária, sem segredo                                                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operador                       | **Confirmado por Alyson em 01/11: a TI tem acesso à conta Google já usada pelo Drive do Flow. Não perguntar novamente.** A TI organiza os detalhes privados da operação; e-mail completo e credenciais ficam fora do relatório. A confirmação de acesso não autoriza iniciar consentimento. |
| Cliente novo                   | Confirmar projeto/cliente existentes, tipo e estado atual, sem baixar ou revelar segredo. Cliente novo deve ser diferente do antigo e pertencente ao projeto dedicado                                                                                                                       |
| Audience / marca / propriedade | Registrar separadamente estados conferidos e pendentes, inclusive propriedade associada ao projeto. “Em produção” não comprova marca verificada; não publicar/enviar verificação agora                                                                                                      |
| URI                            | Conferir se **`http://127.0.0.1:8765/oauth/callback`** já existe **somente no cliente novo**. Se não existir, propor adição preservando entradas; não cadastrar ainda                                                                                                                       |
| Arquivos antigos               | Confirmar quem indicará os três IDs principais e arquivos antigos relevantes em **manifesto privado só de IDs**, sem conteúdo ou credencial. Contagens do banco não provam Drive vazio; ainda não extrair/gravar esse manifesto por este pacote                                             |
| Custódia nova                  | Propor caminhos 0700/0600, dono/UID, responsável e ciclo de vida de credencial nova, candidato e evidências; separados da cópia B e das linhas vivas. Não obter valores ou gerar candidato agora                                                                                            |

Se algum dado já tiver sido confirmado por evidência acessível, aproveitá-lo e registrar a fonte; não pedir outra coleta geral ou outro relatório ao Claude. Nenhuma senha, token, segredo de cliente, cookie, URL privada ou IDs de arquivos no relatório público.

## 3. Fechar o transporte da bancada antes de pedir execução real

A bancada exige **127.0.0.1** e URI/Host coerentes. O runtime preparado é Bun em Docker. O comando antigo `bun … iniciar` no host não corresponde a esse desenho; publicar porta Docker, sozinho, não alcança um listener preso ao loopback interno. Essa pendência já foi identificada, não é motivo para alterar o validador ou abrir porta pública.

Entregar **uma proposta concreta** com comandos e desenho de onde termina o túnel, onde o processo escuta, UID, mounts privados, acesso de saída necessário ao Google, confirmação de ausência de acesso ao banco e ordem de encerramento. O navegador deve alcançar o mesmo loopback/namespace do servidor. Sem rede host, Docker socket dentro do runner ou mudança para `0.0.0.0` na bancada. Não iniciar listeners/túnel por este pacote.

Se a alternativa for executar Bun **na máquina do operador**, explicitar essa escolha e a nova custódia local antes: não instalar runtime silenciosamente nem transferir credenciais para outro computador sem essa decisão. Se houver necessidade real de adaptação de código, explicar a lacuna e propor uma entrega mínima no Flow; não abrir outro PR para refazer as ferramentas atendidas.

O procedimento deve separar o futuro teste fictício de transporte e a execução com credencial nova/Google. Apresentar os comandos e verificações primeiro; sua execução será delimitada após revisão. O endereço de callback e o transporte precisam estar fechados antes de consentir; não improvisar sobre o callback/painel atual de produção.

## 4. Contrato preservado para a futura execução C

Depois da preparação revista e da decisão própria de execução:

- Credencial/refresh candidato **novos**, guardados fora da configuração viva e de B; conferir conta, cliente emissor e apenas escopo `drive.file`. Nenhuma ampliação de escopo para contornar 403/404.
- Leituras dos IDs principais/antigos por GET e teste de renovação real do novo par, inclusive depois do vencimento registrado. Token em cache não comprova renovação; esperar o dia 8 não comprova configuração Google.
- Resultado parcial deve preservar o candidato e informar seu estado; não repetir consentimento cegamente, revogar ou apagar para “limpar”.
- Não usar `configure`, `status`, retorno de produção/aba Drive ou outro fluxo que possa persistir configuração/criar pastas. Nenhum upload, nova raiz, compartilhamento ou substituição de IDs por esta preparação.
- C valida um candidato; a promoção na conexão real pertence a **D**, com barreira contra cron/requisições/callbacks, nova imagem imediatamente anterior, aceitação e reabertura controlada.

Essas linhas delimitam o futuro procedimento; não são autorização de C/D nem instruções para executar agora.

## 5. Retorno único esperado

Markdown objetivo, sem segredos: itens da seção 2 com **confirmado/pendente e fonte**; acesso do operador TI já confirmado pelo dono, sem nova pergunta; proposta de custódia; proposta completa do transporte/encerramento; etapas e efeitos cuja execução será decidida depois. Distinguir leitura conferida de proposta e teste ainda não executado.

Não repetir B, inventariar todas as stacks, mudar Google/URI/DNS/IAM/Branding, iniciar consentimento, criar token ou tocar nas duas integrações. A autorização de B já foi usada e não cobre essas ações. Com os dados fechados, Codex prepara o procedimento de execução C para decisão do dono.
