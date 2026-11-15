# Central WhatsApp — continuidade local em 14/11/2026

O dono pediu concluir todas as pendências localmente **antes de gerar o pacote TI**. Não publicar, instalar, enviar mensagens, modificar marca/Flow ou operar a VPS. Este arquivo é registro interno de desenvolvimento, não roteiro de instalação.

## Fechamento D4/D5 e entrega D6 — somente local

Implementação local concluída em B&C `82570cb`, com ajuste final de concorrência visual em `3bccbf4`; fonte Evolution v5 `d020247`, contrato `bc-groups-v3`. [Roteiro único e completo para TI](pacotes/2026-11-14-ti-central-whatsapp-p122.md) e [evidências minimizadas](validacoes/central-whatsapp-2026-11-14.json). O pacote final é gerado somente após as verificações descritas abaixo; não autoriza produção.

D4 acrescenta sete migrations (`20261114003000` a `09000`), junto às cinco D1 e duas D2/D3: **14 incrementais em uma transação**, sobre a D0 já instalada. As duas políticas novas nascem desligadas. Nenhum reaproveitamento de flags antigas como prova de prontidão; nova flag `WHATSAPP_GROUP_CYCLE_ENABLED` e escopo opcional de piloto por loja/cliente. Exclusão do alvo do piloto desliga a política, sem liberar outros usuários.

Composição consentida reúne as contas de envio da loja e das rotas dos profissionais, com telefones distintos, controle exclusivo e todos administradores; não inclui usuários da equipe. Até 20 contas, sem truncamento silencioso, mínimo de duas. Mudanças exigem autorização atual do cliente e mantêm o criador histórico. Reserva 1/2 escolhida manualmente funciona com principal offline depois do preparo; restrição física e resultado incerto continuam bloqueando sem alternância.

Criação única lacrada antes da rede; recuperação por diário/prova, jamais pelo nome/descrição. Logo da loja validada antes de criar; foto pelo criador, boas-vindas/descrição/fixação por outro administrador. Prova recebida pelo criador antes de convite/código. Confirmação, login e avisos vão apenas ao grupo; revalidação viva e autorização transacional após a rede, sem fallback privado. Marca da barbearia e preferências somente no app; marketing segue 0/1/3 por mês.

Ciclo de um ano civil a partir da criação comprovada, não da última entrada. Retorno conserva JID, fim e preferências. Encerramento retira cliente/contas e preserva o último administrador até a saída final; limpeza por conta só com intervalo comprovado. Legado sem preparo novo apenas pode ser adotado para encerrar. Dados redundantes de ciclos fechados/limpos minimizados após 90 dias; revogações/lápides impedem reativação atrasada. Limpeza sem prova permanece pendente, sem afirmar exclusão do histórico de terceiros.

D5 mostra atividade, preparação, revisão, validade e limpeza no admin; cliente recebe passos/convite/confirmar telefone, consentimento atualizado e acesso direto pelo link de preferências. Polling em segundo plano não desmonta o código, apaga rascunho ou aceita silenciosamente números novos. Ação do usuário durante leitura lenta não é descartada; a resposta antiga não desfaz o salvamento. Busca automática de convite é silenciosa. Preservados identidade e três modos de canto. Marca/brand kit e Flow continuam fora da tarefa.

Verificações finais: **628 testes B&C**, tipos/lint/formatação e build Node/Nitro; TypeScript estrito dos contratos Edge; **194 verificações SQL** (149 base/D1/D23 + 21 fundamentos + 24 operação), três disputas D4 em conexões reais; ensaio integrado com PostgreSQL e socket fictício, incluindo confirmação/login, reserva manual, avisos, saída/retorno, fechamento/limpeza e legado. **51 testes Evolution + 15 PostgreSQL**, build/lint; imagem AMD64 construída e API iniciada/recriada em rede interna sem WhatsApp, volume preservado. Medição local 16,898 s não prevê indisponibilidade na VPS. PostgreSQL homologado; MySQL não.

Navegador: 42 composições dos grupos e 21 da faixa operacional, sete larguras (320–1920), três cantos, API/sessão fictícias; sem erros JS/estouro horizontal nos cenários executados. Conferência visual dos PNGs móvel/PC. Isso não substitui iPhone físico, WhatsApp real ou entrega ao cliente.

D6 inclui fonte completa v5/patch, fontes Edge/dependências, frontend sobre a main `8b6898b`, SQLs atômicos, bancada reproduzível sem `.env`, manifesto/hashes, operador/retorno e unidades. **Oito falhas simuladas do operador**, seis unidades verificadas em Linux, patchs aplicáveis em bases limpas e ensaio do próprio instalador numa segunda D0 descartável: 14 SQLs aplicam juntos, reaplicações B&C/Evolution são recusadas e escopo do piloto é configurado sem ativar. Duas migrations Evolution já instaladas permanecem byte a byte iguais; só a terceira é nova.

**Fora do local e ainda pendente:** revisão/aceite da TI, janela autorizada, publicação da imagem pelo digest, migration Evolution, instalação SQL/Edge/frontend, segredos persistentes/webhook, rotinas e piloto real consentido. Nada disso foi executado. Login de produção não é liberado pelo resultado fictício. Não reaplicar nº 105–112/115–117, Web Push/iPhone, nº 113/114 parciais nem pedir nova D0. Não executar autossave/push deste ramo. `.env` anterior preservado e excluído da entrega. Pasta da marca não deve ser editada até nova autorização do dono.

## Histórico do checkpoint D2/D3

As seções seguintes registram o estado intermediário; as pendências de desenvolvimento nelas citadas foram concluídas no fechamento acima.

## Ponto verificado: D2/D3 e faixa operacional

D1 permanece no commit local `3d7c888`. Duas migrations novas, somente locais:

- `20261114001000_whatsapp_metricas_revisao.sql`: observação de conexão, revisão auditada de restrição por telefone, prova minimizada de envio para grupo, correção tardia de resultado incerto e consulta por agregados. Não há backfill de mensagens sem prova. Uma restrição nova invalida a revisão anterior. Retomar a pausa comum não apaga a barreira histórica; revisar não reconecta, reenvia ou retoma avisos. Histórico conserva a evidência passada sem chamá-la de bloqueio atual depois da revisão.
- `20261114002000_whatsapp_distribuicao_servidor.sql`: política desligada por padrão, proposta persistente, prazo de dez minutos, comparação de configuração/carga e revalidação no servidor, aplicação idempotente, atribuição no cadastro autenticado e rodada de cobertura. Dois telefones elegíveis são o mínimo; terceira reserva quando disponível. Configurações existentes não são reordenadas pela automação. Avisos continuam desligados após atribuir.

Elegibilidade automática: telefone operacional, identidade sob controle exclusivo da plataforma confirmada pelo administrador, conexão observada há até dois minutos, ausência de pausa/restrição e ausência de tentativa iniciada/incerta. Alias do mesmo telefone não vira outro candidato. Carga é somada por telefone físico; ausência de medição não vira volume zero. Falta de par deixa a barbearia completa aguardando números, sem desfazer o cadastro.

O novo worker `whatsapp-distribution` consulta a Evolution uma vez, sem pareamento, criação ou envio, e persiste as observações em lote antes da rodada transacional. Falha da API não inventa desconexão/restrição. Identidade/status desconhecidos invalidam a frescura sem apagar a identidade anterior. RPCs operacionais restritas ao serviço; navegador só usa ações administrativas autorizadas.

`WhatsAppOperations` liga a faixa aprovada aos contratos por capacidade `server_distribution`: agregados no topo, política persistida e proposta/aplicação por barbearia. Controle exclusivo e revisão de restrição têm confirmação explícita. A página não simula persistência na API antiga. Os contratos novos não estão instalados na produção usada pelo localhost normal. A prévia em `/previsao-whatsapp` continua fictícia/em memória.

Métricas cobrem apenas caminhos protegidos com prova persistida. A infraestrutura para avisos/boas-vindas está preparada, mas **a cobertura dos emissores só estará completa após D4**. Não anunciar cobertura total antes de ligar/testar esses fluxos.

## Verificação já executada

- Reprodução limpa da base D0 (118 migrations) + D1 + D2/D3 no container exclusivo `barba-central-d1-local`, porta 54339: 149 verificações aprovadas. As SQLs de teste abrem e desfazem suas próprias transações.
- D3: proposta sem efeito, idempotência, plano desatualizado/vencido, cadastro sem par, atualização posterior e revisão de restrição; 33 verificações específicas.
- Quatro disputas reais adicionais com duas conexões: propostas diferentes, reentrega do mesmo plano, dois cadastros e reentrega do mesmo cadastro.
- 614 testes gerais, tipos, lint, formatação e montagem aprovados.
- Faixa autenticada com API simulada: aplicação com perda de resposta mantém a mesma chave, política exige confirmação, nenhuma ação de proposta ao abrir; sete larguras × três modos reais de canto, sem estouro horizontal ou erros JavaScript nos cenários executados. Não equivale a iPhone físico/WebKit.

Reprodução: `python3 scripts/testar-central-d23-banco.py --preparar`; depois `python3 scripts/testar-central-d23-concorrencia.py` e `node scripts/testar-central-d23-interface.mjs`. O primeiro recria somente a bancada nomeada; nenhum lê `.env` ou acessa a VPS. Não executar concorrência enquanto a bancada estiver sendo recriada.

## Trabalho previsto no checkpoint intermediário (concluído acima)

D4: comprovar dois administradores em todas as autorizações, composição desejada/consentida/observada, transição de números preservando JID, identidade da barbearia, foto pelo criador, boas-vindas/descrição/fixação pelo segundo administrador, prova da primeira mensagem, ciclo anual/retorno/encerramento, convite sem ritual de 30 segundos e avisos protegidos em grupos. Preferências somente no aplicativo. Marketing segue 0/1/3 por mês; nenhuma retomada ou alternância para contornar restrição.

A fonte local anterior v3/v4 não foi instalada e é parcial. Foi preparada uma cópia exclusiva da Evolution em `/tmp/bc-evolution-central-20261114`, sobre a base oficial `cd800f2976e1e5b682fbf86a01ee4d85ae61f370` e o patch local v4, para reaproveitar o que passar na revisão. Nenhuma alteração funcional nova foi feita nessa cópia até este ponto. Não tocar nas outras cópias nem apresentar essa v4 como solução completa.

Depois: concluir D5 (estado operacional dos grupos e integração final), ensaio conjunto B&C/extensão com banco e provedor fictício, recuperação/interrupções/concorrência e montagem. **Somente então D6**, com fontes completas/patch, hashes/base, operador, precondições, retorno e roteiro para TI. Não produzir ZIP operacional parcial nem transferir desenvolvimento pendente para TI.
