# P-28 — Para TI/Guardião: fechar somente os requisitos restantes de C

**Respondido pelo C2 em 02/11, não repetir:** segredo disponível, responsáveis/custódia e navegador aproveitados. [Revisão e conciliação](2026-11-02-flow-preparacao-c2-conferida-p28.md), com correções operacionais incorporadas ao [procedimento C para decisão](2026-11-02-ti-flow-execucao-c-p28.md). O texto abaixo é o pedido histórico respondido; não é nova coleta nem autorização de C/D.

**02/11/2026 · Preparação específica, sem executar C/D.** [T1 concluído e conferido](2026-11-02-flow-t1-concluido-p28.md). Este arquivo é para a **TI com o Guardião**, sem novo pedido de código ao Claude. O objetivo segue a separação Google necessária à P-28 do **Barba & Cabelo**.

## 1. Aproveitar as entregas atendidas

A, B e T1 estão concluídos. Socat já instalado, transporte fictício validado na máquina da TI, limpeza conferida. Projeto `flow-proh-media-drive` (**930474870480**), cliente Web **“Flow Drive (produção)”**, origem/URI de produção e operador com acesso já foram identificados. Não repetir inventário, PR/merge, suíte fictícia, captura B ou teste de túnel; não pedir novamente acesso à conta Google ou DNS.

Este pedido aproveita o retorno de preparação e o T1. Responder somente aos pontos abaixo, com **confirmado/pendente**, fonte e impedimento concreto. Não devolver outro levantamento geral.

## 2. Dados e responsabilidades que ainda faltam

| Ponto                             | Devolutiva necessária agora                                                                                                                                                                                 | Limite desta preparação                                                                                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segredo existente do cliente novo | Guardião confirma **disponível e sob custódia / não disponível / ainda não localizado**, sem valor, fragmento ou hash. Confirmar que corresponde ao cliente novo já criado                                  | Ver máscara habilitada não prova disponibilidade. Não baixar, copiar para C, criar/rotacionar/desativar segredo para atender este pedido. Se faltar, informar a lacuna para decisão específica                              |
| Referências antigas para o ensaio | TI/Guardião confirma responsabilidade e fonte privada dos três IDs principais e referências/arquivos antigos relevantes, inclusive os casos que serão usados para comprovar compatibilidade                 | Não extrair/gravar manifesto nem reler/exportar B nesta preparação. Valores ficam fora do relatório. `cliente_antigo_id` é o OAuth Drive atual do Flow, não Auth Barba & Cabelo; contagem de mapas não comprova Drive vazio |
| Custódia C                        | Confirmar a proposta `/root/flow-p28-c-<UTC>/`, diretórios 0700/arquivos 0600, root/TI; Guardião deposita credencial somente na futura etapa autorizada; candidato parcial será preservado para diagnóstico | Separada de B e configuração viva; sem transferência de segredo para chat, Git ou máquina do navegador. Não criar pasta com credencial/candidato agora. Explicitar responsável e regra de retenção, sem limpeza automática  |
| Propriedade/marca                 | Informar somente a evidência que faltou sobre associação de propriedade do domínio ao projeto; manter separados propriedade, Audience em produção e marca não verificada                                    | Só leitura de metadados. Não alterar TXT/IAM/Branding nem enviar verificação. Se continuar pendente, explicar se afeta o ensaio ou a futura verificação; não pressupor que toda pendência de marca impede tecnicamente C    |

A conta efetiva deve ser a já usada pelo Drive do Flow; suporte/dev do aplicativo não serve como prova. Acesso da TI está confirmado, não é nova pendência. Nome/e-mail completo da conta e IDs privados ficam em canal privado com os responsáveis.

## 3. Fechar o desenho operacional de C, aproveitando T1

1. **Navegador e retorno:** T1 usou `ssh -L` e curl no box da TI. Indicar onde estará o navegador interativo do consentimento e onde terminará o túnel. O retorno `http://127.0.0.1:8765/oauth/callback` deve chegar ao listener correto a partir desse navegador. O teste no box não demonstra esse caminho a partir de outro computador. Não iniciar túnel/listener nem abrir consentimento nesta preparação; aproveitar a ponte por ID completo já testada.
2. **HTTPS Google e bloqueio do banco:** propor os comandos exatos da rede/saída que C usará, alcance e retirada dos recursos próprios. T1 usou `none`; C precisará de saída Google. Não basta criar uma bridge nem provar que o nome do banco não resolve. Explicar como ficará impedido o acesso a redes/IPs/portas da produção, sem rede host, Docker socket dentro do runner, portas públicas ou alterações abrangentes nas regras das stacks. Validações propostas devem usar configuração/regras delimitadas ou alvos fictícios, **sem sondar o banco real**. Não criar rede, aplicar regras, containers ou novo teste agora.
3. **URI nova:** a última leitura encontrou somente `https://supabase.proh.media/functions/v1/google-drive/callback`. A inclusão futura de `http://127.0.0.1:8765/oauth/callback` é **apenas no cliente novo**, preservando a URI de produção. Não cadastrar por este arquivo; se outro responsável já a tiver adicionado em escopo próprio, apenas informar fonte/data e não duplicar.
4. **Procedimento C para decisão:** depois dessas respostas, Codex consolida os comandos, custódia, verificações, encerramento e efeitos para a decisão de execução. C testa candidato separado, escopo `drive.file`, GETs dos IDs/arquivos antigos e renovação real depois do vencimento registrado; não promove na integração viva. Nenhuma autorização de T1 inclui essa execução.

Não é necessário outro PR do Flow para responder. Se surgir uma lacuna concreta nas ferramentas já revisadas, identificar antes de propor código; não contornar validações. Não usar o painel/retorno de produção, `configure` ou `status` como bancada, pois esses caminhos podem persistir configuração ou criar pastas.

## 4. Devolutiva única, sem valores privados

Entregar um Markdown com:

- Segredo novo existente: **disponível / não disponível / não localizado**, responsável pela custódia e fonte da confirmação, sem valores.
- Manifesto futuro: responsável, fonte privada e cobertura proposta dos casos antigos, sem IDs; confirmar que distingue os clientes Flow e Barba & Cabelo.
- Custódia C: proposta confirmada ou ajuste preciso, responsável/retenção; candidato parcial preservado.
- Propriedade/marca: evidência específica restante ou impedimento, sem repetir o inventário do projeto.
- Navegador/túnel: máquina do navegador e endpoint local coerente; plano de rede/egresso/isolamento com comandos e encerramento, ainda não executado.
- URI local: último estado conhecido e ação proposta; lista explícita do que **não foi executado** nesta preparação.

Se algo continuar desconhecido, apontar apenas o item e quem pode resolvê-lo. Não criar segredo/token, consentir, usar B ou alterar produção para completar o relatório. A virada **D**, remoção de grants/clientes antigos e vídeo/reenvio Google do Barba & Cabelo continuam etapas posteriores próprias.
