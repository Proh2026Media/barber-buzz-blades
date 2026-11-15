# P-122 — Central WhatsApp, grupos e login: entrega local para TI

**14/11/2026. Codex → TI/Guardião. Revisão e preparação; não é autorização de instalação.** O dono pediu concluir tudo localmente antes deste pacote. Código, banco descartável, integração fictícia, interface e imagem foram verificados. Nenhum push/main, registry, VPS, pareamento ou WhatsApp real foi executado. Marca e Flow preservados.

Este arquivo substitui os pedidos parciais D1–D5 e as v3/v4 locais **não instaladas**. Reutiliza a D0 já concluída; não repetir inventários, iPhone, Web Push ou instalação nº 105–112/115–117. Os arquivos antigos continuam como evidência. Nº 113/114 parciais não entram nesta entrega.

## 1. O que está pronto

- Principal e duas reservas por barbearia/profissional; um mesmo número pode ter papéis diferentes em destinos diferentes. Arraste nas três posições, herança explícita, salvamento com versão, estatísticas e proposta persistida. Atribuição automática preparada, desligada por padrão, sem reordenar escolhas existentes ou ligar avisos.
- Métricas apenas de envios comprovados em grupos, por telefone físico; histórico preservado mesmo após desconexão/restrição. Aceite não é entrega. Perfil regular: 20 aceites/7 dias ativos; consistente: 100/14 dias ativos, janela de 30 dias. Não é classificação oficial nem promessa contra banimento; ausência de dado não significa uso zero.
- Grupos com cliente comum e contas de envio isoladas da plataforma, todas administradoras. União dos números da loja e das rotas dos profissionais, até 20 distintos, apresentada para consentimento. Nenhum usuário/profissional recebe acesso a conversas, pareamentos ou credenciais.
- Foto da loja pelo criador; primeira mensagem pelo segundo administrador, com regras, descrição e fixação. Prova recebida pelo criador antes de liberar acesso. Nome automático restaurado na conferência seguinte, com próximo agendamento quando existir.
- Confirmação de telefone, login, boas-vindas e avisos só no grupo protegido. Nenhum fallback privado, alternância por mensagem ou reenvio de resultado incerto. Reserva é escolhida manualmente por falha técnica; principal offline não impede a reserva autorizada após o preparo.
- Ciclo anual real, retorno sem reiniciar prazo/marketing, encerramento/limpeza por conta, legado somente para encerrar. Preferências apenas no aplicativo; marketing 0/1/3 por mês. Cliente vê nome da barbearia, não B&C.
- Painel administrativo de ativos/preparação/revisão/limpeza e fluxo do cliente com convite sem janela artificial de 30 segundos. Polling conserva código digitado e rascunho; salvar durante leitura lenta funciona e respostas antigas não desfazem o salvamento. Piloto restrito a uma loja e um cliente disponível no banco.

**Login de produção ainda não está homologado por esta entrega.** O localhost normal aponta à API de produção antiga; os fluxos novos foram testados com banco local e provedor fictício. `/previsao-whatsapp` continua sendo demonstração de interface com dados fictícios. Não testar ali presumindo que o backend novo já esteja na VPS.

## 2. Artefatos e provas

O ZIP contém `MANIFESTO.json`, `SHA256SUMS`, `BASE.txt`, `COMMIT.txt` e este roteiro:

| Pasta         | Conteúdo                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `banco-bc/`   | Os 14 incrementais novos de 13/11 e 14/11; aplicar juntos pelo arquivo atômico.                                                   |
| `funcoes/`    | Entradas e dependências relativas completas de WhatsApp/grupos/login/saúde/distribuição. Sem `.env`, chave, sessão ou credencial. |
| `evolution/`  | Fonte completa v5, patch sobre revisão oficial, hashes, construção e publicação preparada.                                        |
| `frontend/`   | Patch e arquivos alterados sobre main `8b6898b9…`; inclui a interface aprovada e preserva iPhone.                                 |
| `operacao/`   | Operador Python, SQL atômico/precondições/pausa/escopo e unidades systemd. Não executam nada ao abrir.                            |
| `bancada/`    | Scripts dos ensaios locais. Nunca apontar à produção.                                                                             |
| `evidencias/` | Registro local e resultados minimizados.                                                                                          |

Resultados: 628 testes B&C, tipos/lint/formatação/montagem Node aprovados; TypeScript estrito dos contratos Edge novos aprovado; 194 verificações da bancada SQL (149 base/D1/D23 + 21 fundamentos + 24 operação), três disputas novas de concorrência, ciclo integrado completo com PostgreSQL/socket fictício, 51 testes Evolution e 15 PostgreSQL, 63 composições visuais. Oito testes do operador incluem corrupção, base divergente, interrupção de cópia, retorno e recusa de sobrescrever entrega posterior.

Imagem AMD64 construída e API iniciada/recriada em rede Docker interna, sem sessões ou internet, com volume preservado. Recriação local: 16,898 s. **Não estima indisponibilidade/reconexão na VPS.** O build dedicado `build:bc-runtime` evita a falta de memória observada ao compilar centenas de entradas em dois formatos. PostgreSQL é o alvo homologado; MySQL não foi homologado.

## 3. Receber e revisar, sem operar

Extrair em pasta nova e manter o ZIP original. Conferir primeiro o SHA-256 externo informado pelo Codex e depois:

```bash
sha256sum -c SHA256SUMS
python3 operacao/central_whatsapp_operacao.py conferir --pacote .
```

Na cópia de revisão da main exata, `git apply --check frontend/alteracoes.patch`. Não aplicar/push na main agora: push publica o site. Na revisão oficial Evolution `cd800f2…`, conferir/aplicar **o patch v5 completo**, sem empilhar v2/v3/v4. Alternativamente usar `evolution/fonte/` do pacote; testes e Dockerfile estão incluídos. Rodar `npm ci`, gerar Prisma pela bancada e executar os comandos do README v5.

Para repetir a bancada na máquina de revisão (nunca na VPS), usar Node 24+ e Python 3.9+, Docker Unix local e a cópia completa em `bancada/`. Não copiar `.env` de produção. Instalar dependências, copiar `evolution/fonte/` para `/tmp/bc-evolution-revisao-p122/` e usar essa cópia nos scripts. As provas do pacote já foram executadas; não é necessário repeti-las no servidor.

```bash
cd bancada
npm ci
python3 scripts/testar-central-d4-banco.py --preparar
python3 scripts/testar-evolution-ciclo-banco.py /tmp/bc-evolution-revisao-p122
node --import /tmp/bc-evolution-revisao-p122/node_modules/tsx/dist/loader.mjs \
  scripts/testar-central-d4-integrado.mts /tmp/bc-evolution-revisao-p122
python3 scripts/testar-central-d4-concorrencia.py
```

O ensaio do instalador tem segunda bancada própria, sem usar a porta da integração. Em máquina de revisão, criar uma D0 limpa e executar uma única vez (recriar a bancada para repetir):

```bash
BC_BANCO_LOCAL_NOME=barba-central-pacote-local BC_BANCO_LOCAL_PORTA=54341 \
  bash scripts/banco-local.sh subir 20261112232000
python3 scripts/testar-central-d6-pacote.py --pacote /caminho/do/pacote
```

A cópia Evolution precisa de `npm ci` antes. O ensaio integrado exige bancada D4 recém-preparada e vazia de ciclos; executar antes da concorrência e nunca em paralelo à recriação. Para testes de tela, iniciar Vite local em 8090 com configuração pública fictícia e rodar `testar-central-d23-interface.mjs`/`testar-central-d5-interface.mjs`; as duas sessões bloqueiam banco real e WebSocket externo. Os scripts `foto.mjs` explicam o requisito de Playwright/Chrome.

O manifesto distingue hashes comprovados na D0 de hashes das demais dependências provenientes da main. Antes da cópia real, todos devem coincidir. Divergência exige devolver somente caminhos/hashes e estado observado ao Codex; não sobrescrever, desenvolver substituição ou reaplicar um pacote antigo.

Na VPS, a conferência de base usa os caminhos/containers B&C já conhecidos:

```bash
python3 operacao/central_whatsapp_operacao.py base --pacote . \
  --funcoes /data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn/volumes/functions \
  --db supabase-db-z2dbb7dkyzhc8vjiywq34mhn
```

A precondição SQL exige pausa global e nenhum envio em andamento. Fora de janela autorizada, uma recusa por falta de pausa é esperada: **não pausar apenas para conseguir passar essa conferência**. Hashes e leitura do roteiro bastam para a revisão inicial. O operador não imprime valores de ambiente, SQL de dados, códigos ou convites.

## 4. Janela futura: ordem preparada

A autorização atual do dono é **somente local**. Publicação da imagem, migration Evolution, recriação de container, configuração do webhook, instalação B&C/frontend e piloto real continuam dependendo da janela autorizada com a TI. Não executar essas etapas por receber o ZIP.

### A. Custódia, pausa e retorno

1. Preservar as imagens exatas atual/nova, Compose, volumes e funções em backup privado. Banco em backup consistente sob custódia da TI; não exportar credenciais/dump para o chat. Confirmar espaço e método de restauração antes da janela.
2. **Não clicar em Redeploy no Coolify.** Há segredos previamente gravados só nos arquivos da VPS. Reconciliar a configuração persistente com o Guardião antes de qualquer recriação, preservando VAPID, Auth, SMTP, Google e chaves já existentes. Não gerar chaves novas para resolver divergência.
3. Pausar o job `/etc/cron.d/barba-whatsapp-dispatch` somente durante o corte e preservar sua configuração privada. Ele também dispara e-mail/Google/lembretes: retomar após o runtime saudável, sem instalar um segundo dispatch. Não alterar o timer Web Push.
4. Aplicar `operacao/pausar.sql` com `psql -X -v ON_ERROR_STOP=1`. Não apagar nem dar baixa em licenças incertas para drenar a fila. Se houver `sending`/tentativa iniciada recente, parar e conferir a execução; o SQL recusa o corte.
5. Medir a interrupção real separadamente da prontidão HTTP e da volta das instâncias WhatsApp. Não prometer “alguns segundos”.

### B. Imagem e banco Evolution

Publicação preparada, somente na máquina de construção autenticada no registry e depois de autorizada:

```bash
python3 evolution/publicar-imagem.py /copia/oficial/evolution \
  ghcr.io/proh2026media/bc-evolution-groups:2.3.7-bc.groups.5 /saida-privada/imagem-v5.json
```

O comando publica, **não instala**. Usar o digest retornado pelo registry; índice e manifest AMD64 são identificadores distintos. A imagem atual de retorno é `ghcr.io/proh2026media/bc-evolution-groups@sha256:f509e931336e76536869762777961deaad8a67f12c8586f61091e825fd030a81`.

Com banco Evolution identificado pela TI, `sql-evolution --pacote . --db CONTAINER_POSTGRES --banco postgres --autorizado` aplica só a terceira migration em `evolution_api`, numa transação e com precondições. As duas anteriores já estão instaladas como SQL avulsa: **não reaplicar e não usar Prisma migrate deploy/db push** na VPS. Não criar `schema_migrations` nem forjar histórico Prisma.

Fixar a imagem nova por digest na configuração persistente e recriar **somente** a Evolution, mantendo todos os volumes/redes/portas. A imagem nasce com extensão desligada. Para a preparação controlada, preservar/configurar no ambiente da Evolution `BC_GROUPS_EXTENSION_ENABLED=true`, `BC_GROUPS_MANAGED_INSTANCES=true` e `BC_GROUPS_API_SECRET` igual ao segredo privado B&C. Não colocar telefone de cliente ou profissional na autorização de plataforma; o registro é sincronizado pelo B&C, com identidade viva/versionada.

### C. SQL B&C e funções completas

Com dispatch parado, sem transmissão em andamento e backup pronto:

```bash
python3 operacao/central_whatsapp_operacao.py sql-bc --pacote . \
  --db supabase-db-z2dbb7dkyzhc8vjiywq34mhn --autorizado
```

Aplica os 14 arquivos numa transação, confere D0 e direitos e mantém as duas políticas novas desligadas. Qualquer falha desfaz a transação. Não aplicar os arquivos soltos. Não reaplicar nº 105–112/115–117, Web Push ou as nº 113/114 antigas.

Parar **somente** o container de funções; então:

```bash
python3 operacao/central_whatsapp_operacao.py funcoes --pacote . \
  --funcoes /data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn/volumes/functions \
  --backup /root/backup-bc-central-FUNCOES-DATA-HORA \
  --db supabase-db-z2dbb7dkyzhc8vjiywq34mhn \
  --edge supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn --autorizado
```

O operador exige container parado e política desligada, confere todos os arquivos antes de copiar, cria backup privado, troca só o conjunto do manifesto e tenta restaurar se a cópia for interrompida. Não toca `.env` nem reinicia containers automaticamente.

Na configuração persistente do Edge, adicionar `WHATSAPP_GROUP_CYCLE_ENABLED=false`, preservando segredos/flags antigos e tudo do Web Push. Iniciar/recriar só funções conforme a necessidade da variável nova, preservando o ambiente. Validar saúde e:

```bash
python3 operacao/central_whatsapp_operacao.py configuracao \
  --edge supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn \
  --servico /data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn
```

Esse comando compara somente em memória os valores persistidos e vivos, retornando estado, nunca o conteúdo secreto. Se divergir, não recriar novamente às cegas.

### D. Frontend e webhook

Com backend saudável e políticas desligadas, preparar branch de revisão sobre a main exata e aplicar `frontend/alteracoes.patch`. Rodar tipos/testes/build com as variáveis públicas já configuradas para a API B&C. **O frontend é Node/Nitro, não uma pasta estática de HTML.** Só publicar na janela autorizada pelo fluxo `origin/main` → hub → Hostinger; nunca push somente no espelho. Conferir que a main não avançou antes de aplicar o patch.

O webhook usa a URL B&C `https://supabase-barbearia.proh.media/functions/v1/whatsapp-groups` e cabeçalho `x-bc-group-secret`, igual a `WHATSAPP_GROUP_WEBHOOK_SECRET`. Configurar apenas instâncias geridas/autorizadas, com `group-participants.update`, solicitações de entrada e `groups.update`, conforme os nomes aceitos pelo provedor instalado. `messages.upsert` não concede prontidão nem altera preferências; OTP é filtrado antes de histórico/integrações secundárias. Preservar outras configurações, sem eventos globais ou publicação de códigos.

### E. Preparar piloto restrito e agendadores

Identificar na base real a **Loja Teste/Arena convertida para teste** e a conta cliente `alyson21viana@gmail.com`. O telefone pessoal DDD 84 final 4593 pertence à conta cliente; `alyson@proh.media` e final 5778 são pessoais do administrador. Não transformá-los em números de envio. Conferir o estado atual dos números dedicados no B&C; não presumir conexão a partir dos relatórios antigos ou criar outro cadastro sem necessidade.

Configurar somente o escopo, ainda desligado:

```bash
python3 operacao/central_whatsapp_operacao.py piloto --pacote . \
  --db supabase-db-z2dbb7dkyzhc8vjiywq34mhn \
  --shop UUID_DA_LOJA_TESTE --cliente UUID_DA_CONTA_GMAIL --autorizado
```

Executar pelo acesso PostgreSQL local sob custódia da TI; não colocar URI/senha nos argumentos, histórico ou relatório. O SQL exige loja completa/cliente vinculado e não liga nada. Exclusão da loja/conta do piloto desliga a política, sem liberar os demais usuários.

Com autorização para preparar o piloto, definir `WHATSAPP_GROUP_CYCLE_ENABLED=true` no Edge/Compose e manter a política SQL desligada. Isso permite sincronizar o registro e conferir capacidade sem criar grupo novo. Manter as flags/segredos antigos coerentes. Retomar a pausa global **pelo painel**, com versão atual e só depois de revisar as causas existentes; não limpar restrição física de número para conseguir um candidato.

Rodar uma vez `distribuicao --edge CONTAINER_EDGE --autorizado`, depois `grupos --edge CONTAINER_EDGE --autorizado`. Com política desligada, o segundo sincroniza o registro; não inicia adesões. Conferir também a logo da loja: deve ser pública no bucket autorizado, em formato aceito; a ausência da logo bloqueia antes de criar. Cliente deve ver a lista exata de pelo menos dois números dedicados/isolados. Conta offline sem prova não é cadastrada como autorizada por suposição.

Para preparar os timers, copiar operador para `/opt/barba-cabelo-central/central_whatsapp_operacao.py` e as seis unidades para `/etc/systemd/system/`. Conferir integridade, `systemd-analyze verify` e `systemctl daemon-reload`, mantendo todos parados/desabilitados até a autorização de rotina. `bc-central-distribuicao` observa a cada 60 s; `bc-central-grupos` reconcilia a cada 30 s, até cinco ciclos por rodada; `bc-central-expurgo` minimiza diariamente. Trava comum impede sobreposição. **Não duplicam/substituem o dispatch existente nem o timer Web Push.**

### F. Homologação real, só depois da preparação

Com titular consentido, números dedicados conectados e controle exclusivo confirmado, o admin pode ativar “Ativar grupos e códigos”. O painel sinaliza **Piloto limitado**, preservando o escopo SQL escolhido. Ativação global futura exige decisão explícita de retirar esse escopo; não fazer isso no piloto.

Validar, nesta ordem:

1. Cliente entra por e-mail/Google, abre Conta → Grupos, confere números/telefone e solicita adesão.
2. Criador cria/configura foto/nome e administra com o segundo número. O segundo envia boas-vindas, descrição e fixação. A primeira mensagem recebida pelo criador libera o convite.
3. Cliente abre convite, solicita entrada e é admitido como membro comum. Nenhum funcionário aparece.
4. “Receber código no grupo” confirma o telefone; somente depois sair da conta e testar login WhatsApp. Não enviar código, QR ou convite à TI/Codex.
5. Um agendamento/alteração/cancelamento consentido gera aviso no mesmo grupo, com marca da loja. Aceite do provedor é registrado sem chamá-lo de entrega ao cliente.
6. Conferir reserva manual, saída/retorno sem reset de preferências e encerramento/limpeza na conta de teste. Não simular banimento nem alternância automática. Não testar outras contas ou marketing real.

O titular precisa observar os aparelhos reais e confirmar recebimento. Essa é a parte que a bancada não substitui.

## 5. Retorno seguro

Antes de qualquer retorno, parar somente timers novos e aplicar `operacao/pausar.sql`. Preservar diários, volumes, JIDs, provas e resultados incertos. **Não remover tabelas, redefinir telefone, recriar grupos ou retransmitir para “consertar”.** E-mail/Google podem continuar pelos caminhos existentes com funções saudáveis; manter a janela curta do dispatch.

Com funções paradas, `restaurar-funcoes --funcoes PASTA --backup BACKUP_DA_ETAPA_C --edge CONTAINER --autorizado` restaura somente os arquivos exatos; recusa sobrepor uma entrega posterior. Deixar flags de grupo desligadas nas configurações persistidas/vivas. Retornar a imagem Evolution anterior somente com volumes preservados e extensão desligada; manter SQL aditivo e política pausada. Imagem antiga não deve operar os ciclos v3.

Restauração completa de banco é procedimento de contingência separado: depois de novas escritas de agendamento, restaurar o retrato antigo pode apagar trabalho real. Não fazê-la automaticamente. Efeitos reais do WhatsApp não são revertidos por restaurar SQL; conservar as tarefas pendentes e devolver o diagnóstico ao Codex.

## 6. Relatório de retorno pedido à TI

Um arquivo Markdown responde a este roteiro, com SHA-256 do ZIP/commit, etapa autorizada/concluída, horários Brasília, hashes instalados, digest índice/AMD64, estado das políticas/escopo, persistência dos segredos conferida **sem valores**, unidades antigas preservadas/novas únicas e resultado de cada teste consentido. Informar falhas/limpezas pendentes e o método de retorno mantido. Não incluir números completos de cliente, e-mail novo, códigos, convites, QR, sessão, dump ou credenciais.

Se a revisão não identificar divergência e ainda não houver janela autorizada, responder **“pacote conferido; aguardando autorização da janela; nada instalado”**. Não iniciar outra implementação no servidor.
