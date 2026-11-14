# P-122 — D1 implementada e ensaiada localmente

Data: 13/11/2026. Estado: **contrato de três posições desenvolvido localmente; não instalado e não homologado em produção**. Não é pacote D6 nem nova tarefa para a TI.

## O que mudou

- Principal, reserva 1 e reserva 2 persistidos por barbearia/profissional em uma gravação com versão esperada. O mesmo telefone pode ter papéis diferentes em destinos distintos; três IDs do mesmo telefone não viram três contas.
- Seleção manual da reserva 2, com confirmação técnica e sem ativar avisos automaticamente. Reserva não é alternância de mensagens nem contorno de restrição.
- Central autenticada reconhece `second_reserve`, envia `p_backup2_id` e relê o resultado. Sem a capacidade instalada, não chama a assinatura nova. Filtros, contadores e destinos incluem a segunda reserva.
- Profissional sem vínculo próprio herda o geral. Próprio pausado prevalece; remover a personalização restaura a herança sem alterar o geral ou outras lojas.
- Formulário antigo com apenas uma reserva não pode apagar silenciosamente uma segunda reserva já cadastrada. A view legada apresenta `backup` e a instância efetiva quando a escolha é reserva 2, para os leitores existentes não enviarem pelo principal.
- Classificação pessoal, pausa de pessoal, reserva sem loja e filtro de loja completa das nº 115–117 preservados. A classificação pessoal não desaparece do histórico se a conexão técnica for excluída ou reaparecer com outro ID.
- Restrição conhecida de um telefone impede usar outro ID da mesma conta para ativar envio. Histórico não é apagado. **A resolução auditada de restrição histórica precisa ser concluída no bloco D2 antes do pacote operacional**; não liberar automaticamente pelo tempo decorrido, status conectado ou cadastro de nova instância.
- Protocolo de travas: egresso antes de roteamento nas operações administrativas de distribuição/classificação/autorização de contas; gatilhos de validação de linha não invertem essa ordem. Autorizar conta de grupo continua separado de atribuir rota.

## Identidade, fila e virada de contrato

`whatsapp_number_links.number_identities` conserva telefone/instância por posição. Cada aviso novo fixa a identidade e versão da rota em `whatsapp_outbox.number_route_identity`. Troca posterior de telefone, versão ou composição impede utilizar aquela autorização.

**Não há backfill de identidade da fila antiga.** A configuração atual não demonstra qual era a identidade prevista quando um aviso foi criado. Na futura instalação, pendências sem essa prova são conservadas com estado de falha/revisão e motivo explícito, sem transmissão automática. Isso não apaga mensagens nem autoriza reenviá-las. O futuro pacote D6 precisa inventariar o impacto e preparar revisão/retomada idempotente das pendências ainda válidas, sem repetir resultado incerto.

A migration nova recusa a virada se houver outbox em `sending`. A instalação real exigirá cron de WhatsApp controlado, ausência de transmissões em andamento e revisão do backlog. **Não executar isso agora**; Web Push e demais serviços não participam dessa alteração.

## Fonte e contrato

Nova migration: `supabase/migrations/20261113005000_whatsapp_tres_posicoes_compativel.sql`. Requer base D0 e os incrementais locais 01000–04000. O conjunto novo 01000–05000 deve ser ensaiado/aplicado **atomicamente**; estados intermediários não são uma implantação válida.

Assinatura nova de `platform_set_whatsapp_route`: `p_shop`, `p_staff`, `p_version`, `p_primary_id`, `p_backup_id`, **`p_backup2_id`**, `p_mode`, `p_enabled`, `p_returns`, `p_technical`. Modo: `primary`, `backup`, `backup2`, `paused`. A assinatura de nove argumentos permanece compatível somente quando não descarta a segunda reserva.

A fonte instalada faltante foi incorporada ao histórico local: nº 111, 112, 115, 116 e 117, mantendo os bytes/SHA-256 informados pela TI. Também foram alinhados `whatsapp-groups/handler.ts`, `platform-whatsapp/index.ts`, `whatsapp-channel/index.ts` e `_shared/whatsapp-instance-phone.ts`. **São correções já instaladas; a incorporação no Git não é instrução para reaplicá-las.** Nº 113/114 permanecem fora.

As cópias originais, manifesto e hashes continuam em `integrations/compatibilidade-central-whatsapp-2026-11-13`. A linha em branco final da nº 111 pertence ao arquivo original; não foi removida para manter a identidade da evidência.

## Validação executada

- PostgreSQL descartável `barba-central-d1-local`, porta local 54339. Preparação limpa: 118 migrations da base; hash da definição do diretório igual à D0 antes dos incrementais.
- Cinco incrementais novos aplicados em uma transação. **102 verificações aprovadas**, incluindo persistência, leitores legados, três telefones físicos distintos, filtros pessoais/lojas completas, privilégio, herança, histórico pessoal, fila anterior, troca de identidade e recusa de conta offline. Inclui ensaio de implantação com envio em andamento: a guarda interrompeu a operação e o rollback restaurou integralmente o diretório e o esquema anteriores.
- Cinco disputas com duas conexões reais: duas edições de um destino; compartilhamento entre destinos; classificação pessoal versus distribuição; atualização física versus classificação; autorização de conta de grupo versus classificação. Sem sobrescrita concorrente, dupla autorização indevida, deadlock ou timeout nos cenários executados.
- **610 testes gerais** e **17 testes do modelo de distribuição**; regressão do receptor nº 112 e do normalizador de identidade incluída. Tipos, lint/formatação e build conferidos na entrega.
- Central autenticada com Supabase simulado: conserva rascunho no erro, não habilita envio, salva/relê reserva 2 com confirmação técnica e mostra o vínculo no inventário. Prévia local mantém arraste/toque/teclado; 21 composições em sete larguras e três modos de canto, sem estouro horizontal ou erros JavaScript nos cenários verificados.
- Nenhuma API de produção/Evolution, conexão de número, grupo, código ou mensagem real. Não é homologação no iPhone/WebKit.

Reprodução local:

```sh
# Recria APENAS a bancada dedicada; não usa .env nem VPS.
python3 scripts/testar-central-d1-banco.py --preparar
# Sem --preparar, roda os testes na bancada já montada.
python3 scripts/testar-central-d1-banco.py
npm run test:distribution
node scripts/testar-distribuicao-central.mjs
```

## O que continua pendente

- D2: cobertura de métricas para todos os envios de grupo, revisão auditada de restrições históricas e operação de retenção. A coleta atual continua limitada ao caminho de código comprovado de grupo.
- D3: proposta/aplicação no servidor e atribuição automática persistente no cadastro. A prévia ainda simula a automação.
- D4: duas contas admins, transições de composição, contrato protegido de nome/logo/descrição/boas-vindas/fixação, ciclo anual, avisos por grupo e homologação de OTP. **Este bloco D1 não libera o login pelos grupos.**
- D5: faixa completa aprovada ligada aos dados/contratos operacionais; o salvamento das três posições já está conectado por capacidade, mas estatísticas/automação da faixa ainda não estão operacionais na produção.
- D6: somente após os blocos faltantes, pacote completo com precondições, instalação/retorno e agendadores ensaiados. Nenhum ZIP operacional novo para enviar à TI nesta rodada.

A página local de demonstração continua em `http://localhost:8090/previsao-whatsapp`, com dados fictícios e alterações em memória. A persistência real desta entrega foi exercitada no banco descartável e no contrato da Central por testes; o localhost normal ainda usa a API configurada, que não recebeu estes incrementais.
