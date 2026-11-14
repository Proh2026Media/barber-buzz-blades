# Central WhatsApp — continuidade local em 14/11/2026

O dono pediu concluir todas as pendências localmente **antes de gerar o pacote TI**. Não publicar, instalar, enviar mensagens, modificar marca/Flow ou operar a VPS. Este arquivo é registro interno de desenvolvimento, não roteiro de instalação.

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

## Trabalho ainda em execução

D4: comprovar dois administradores em todas as autorizações, composição desejada/consentida/observada, transição de números preservando JID, identidade da barbearia, foto pelo criador, boas-vindas/descrição/fixação pelo segundo administrador, prova da primeira mensagem, ciclo anual/retorno/encerramento, convite sem ritual de 30 segundos e avisos protegidos em grupos. Preferências somente no aplicativo. Marketing segue 0/1/3 por mês; nenhuma retomada ou alternância para contornar restrição.

A fonte local anterior v3/v4 não foi instalada e é parcial. Foi preparada uma cópia exclusiva da Evolution em `/tmp/bc-evolution-central-20261114`, sobre a base oficial `cd800f2976e1e5b682fbf86a01ee4d85ae61f370` e o patch local v4, para reaproveitar o que passar na revisão. Nenhuma alteração funcional nova foi feita nessa cópia até este ponto. Não tocar nas outras cópias nem apresentar essa v4 como solução completa.

Depois: concluir D5 (estado operacional dos grupos e integração final), ensaio conjunto B&C/extensão com banco e provedor fictício, recuperação/interrupções/concorrência e montagem. **Somente então D6**, com fontes completas/patch, hashes/base, operador, precondições, retorno e roteiro para TI. Não produzir ZIP operacional parcial nem transferir desenvolvimento pendente para TI.
