# P-122 — retorno da TI conferido em 15/11/2026

**SUSPENSO após o relatório 2 — corte 15/11, 15:00:34 BRT.** Piloto pausado; renovação não concluída e identidade/telefone divergentes. Não seguir a orientação antiga de renovar/entrar. [Diagnóstico atual e plano](2026-11-15-p122-renovacao-telefone-diagnostico.md). O conteúdo abaixo é histórico.

**Instalação concluída conforme relatório TI/Guardião. Preparação antes da entrada aprovada; login real e sequência após entrada ainda não homologados. Este arquivo é registro de conciliação, não pedido de instalação nem documento para reenviar à TI.**

Fonte recebida: `RELATORIO-TI-CONSOLIDADO-P122-2026-11-15.md` e ZIP `P122-CORRECOES-FONTES-2026-11-15.zip`, SHA256 `0aa020671003b7f59631cfbf92f8820eb69e600fbd5ae8323681f3436b4a330d`. [Evidências preservadas](../../integrations/estado-instalado-p122-2026-11-15/README.md). Integridade dos 11 arquivos conferida. Operações de produção são sustentadas pelo Guardião no relatório da TI; o Codex não consultou a VPS nesta rodada.

## Estado instalado relatado

- Os 14 incrementais B&C e a terceira migration Evolution da v5, 26 dependências Edge, operador/seis unidades e frontend `e5f3ec0` já foram instalados. Web Push e dispatch anteriores preservados; timers novos de distribuição/grupos/expurgo desligados.
- A SQL `20261115001000_whatsapp_acolhimento_apos_entrada.sql` foi aplicada às 02:05:36–02:05:37 BRT, com hashes e preservação do grupo. Não reaplicar.
- Correção safeupdate já aplicada às 00:31:01–00:31:05 BRT: `20261115001000_whatsapp_singletons_safeupdate.sql`. Mesmo prefixo, nome/conteúdo diferentes. WHERE singleton nos três UPDATE, proteção ativa, sem mudança de ACL/OID/proprietário. Não renomear nem inferir instalação por prefixo/ledger.
- Correção da comparação de marca instalada às 03:06:41: Evolution `2.3.7-bc.groups.6-brand.1`, protocolo v4 e `postAdmissionWelcome=true`. A leitura pública da UI continua v3. Sem novas SQL/env/frontend nesta correção.
- Imagem AMD64 fixada: `ghcr.io/proh2026media/bc-evolution-groups@sha256:bb66b337063aa3fb82500642d0e332ff32f94a6a04692d1652b016ca735c9f3e`. Índice OCI `e8ce0f84dd4da9807284d1b0c80ae448bf9c37ee9bdfa29d97f604996943ca10`. Referências diferentes são níveis da mesma cadeia; não confundir com ID local.

**Corte da leitura real: 03:17:41 BRT.** Somente Loja Teste + cliente consentido; Arena — Testes sem ciclos, segunda etapa sequencial. Cliente fora, duas contas de plataforma abertas naquela leitura, send_ready=false, filas/efeitos em aberto zero. Convite/observações/matrícula eram temporários e não são presumidos válidos agora. Não ativar timers/liberação global ou disparar conferências por causa deste registro.

## Conciliação local e verificação independente

SQL safeupdate preservada byte a byte e adicionada à fonte canônica, sem mexer nas 14 anteriores ou na SQL de acolhimento. Duas fontes Edge conciliadas: `care-cycles.ts` corresponde ao hash instalado `d815b844befe027af64965865410d8fd901b13dd123d687195d1c4121e0d9b82`; a comparação em `care-group-content.ts` é equivalente à instalada `189d2f721db7c72bd9d23777e371cbeefdc7a2c3aab7893551270348a38b2e74`, com apenas a formatação local padrão. Versões exatas instaladas guardadas como referência inerte para futuros hashes.

Reproduzida a falha JSON no motor antes do patch: reordenar chaves anulava descriptionHash. Depois, preserva prova/versão/diário; mudança real continua invalidando. 54 testes Evolution + duas regressões, lint e build; teste Edge de ordem/campos inválidos incorporado à suíte comum. Com safeupdate realmente carregado na sessão PostgreSQL local, duas falhas originais do painel foram reproduzidas; correção, pausa, CAS, permissões, OID/ACL/proprietário e proteção contra UPDATE sem filtro passaram. Reaplicação ensaiada só localmente, sem recomendação de reaplicar produção. Fontes ativas formatadas conferidas contra o formatador das fontes anexas.

Reprodução somente local: bancada v5/acolhimento descartável conforme os scripts anteriores; depois `python3 scripts/testar-singletons-safeupdate.py`. A senha local é a fictícia definida no script de bancada. Nenhum `.env`, credencial produtiva, WhatsApp ou servidor externo é usado. Não executar este roteiro na VPS.

Validação final local: 633 testes B&C, 54 testes Evolution + duas regressões, tipos estritos Edge, lint/formatação e montagem aprovados. Evolution local salvo em `ad88eae`; fontes anexas do Guardião preservadas separadamente.

Nenhuma imagem foi republicada/reconstruída para produção, nenhum pacote TI novo gerado e nenhuma mensagem real enviada. Marca visual/brand kit, Flow e frontend preservados.

## Próximo passo pessoal

O titular precisa estar com o WhatsApp pessoal final 4593 disponível e combinar com a TI a renovação legítima da janela. Na conta cliente autorizada da **Loja Teste**: **Minha conta → Grupos de atendimento → Abrir meu grupo → solicitar entrada**. Avisar somente **“pedido enviado”**; não mandar convite, QR ou código no chat.

Depois, TI observa a admissão e a sequência no mesmo grupo: outro administrador acolhe, escreve a descrição e fixa; titular confirma recebimento; prova técnica da admissão atual libera confirmação de telefone/login. Após isso, homologar um aviso de agendamento. Saída/reentrada/encerramento e Arena — Testes continuam para etapas consentidas posteriores. Não declarar experiência completa aprovada antes desses resultados.

## Roteiro de retomada solicitado pelo titular

Instruções para encaminhar à TI: [homologação pós-entrada](2026-11-15-ti-p122-homologacao-pos-entrada.md). É continuidade do piloto já instalado, com o titular presente; não é pacote de instalação.
