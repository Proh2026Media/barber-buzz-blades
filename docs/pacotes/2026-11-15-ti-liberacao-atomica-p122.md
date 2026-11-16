# P-122 — correção da liberação do teste, 15/11/2026

**Atualização posterior:** pacote já instalado/publicado pelo Codex sob autorização específica; [registro final](2026-11-15-codex-implantacao-liberacao-p122.md). O texto abaixo documenta a entrega antes da instalação. Não é nova ordem para a TI reaplicar ou ativar.

## Resultado e escopo

**Correção concluída/testada localmente; ainda não instalada ou publicada.** O relato da TI comprovou uma falha no roteiro entregue pelo Codex: enrollment exige números sem pausa, enquanto o roteiro mandava habilitá-lo sob pausa global. A orientação anterior de apenas aguardar a liberação não considerou essa dependência. A TI preservou a pausa corretamente. O titular não deve tentar código/convite antes da nova janela.

Este pacote contém a implementação completa, instalador, contratos de base/pós-condições, frontend, patch e testes. Não transfere desenvolvimento para a TI. A autorização de teste que a TI relata já ter recebido não precisa virar um novo pedido genérico; a instalação do incremental novo deve integrar uma janela autorizada e revisável. Este arquivo não concede autorização por conta própria.

**Instalar somente uma SQL nova:** `20261115004000_whatsapp_piloto_liberacao_atomica.sql`. Nenhuma migration Evolution, imagem, fonte Edge, dependência ou variável nova. Evolution7/v4, SQL02000+03000 e as 29 fontes já instaladas permanecem. Não reaplicar pacotes v5/v6/v7, safeupdate, acolhimento ou o pacote de telefone. Não executar Redeploy Coolify, reiniciar containers, ligar timers, distribuir números ou modificar Flow/marca.

Base frontend publicada: `feb555d81b08201f4877003362895604c3445fd0` (aplicação c4659781). A correção de perfil 24bd101, até agora somente no ramo de revisão, entra junto neste pacote. O commit completo desta entrega é gravado em `COMMIT.txt`; a fonte canônica está em `origin/codex/retorno-ti-p122-2026-11-15`.

## O que foi corrigido

1. **Preparação separada do envio.** `care_pilot_preparation_ready()` confere escopo, loja completa, vínculo do titular com a loja, composição distinta, controle da identidade, restrições, duas conexões recentes, registro reconhecido e incertezas. Pode retornar true sob pausa global. Não transmite nem participa dos autorizadores de envio. Registro reconhecido/conexão verdadeira continuam necessários; observação vencida não é renovada pelo instalador ou por leitura de UI.
2. **Liberação em uma transação.** `care_pilot_admin('activate', valores)` exige admin legítimo, consentimento, par exato já configurado, CAS corrente de pausa/política, preparação válida, distribuição desligada e ausência de trabalho em andamento/incerto. Dentro da mesma transação, usa os controles originais para despausar e habilitar assistência/ciclos. Qualquer falha desfaz inclusive pausa, versões e auditoria. Nenhum outro processo observa a despausa intermediária.
3. **Isolamento explícito do contexto.** Loja E cliente do piloto são conferidos no claim/candidato/rota de outbox, criação e contexto de OTP, contexto de avisos e claim/autorização de ciclos, inclusive fechamento. Números compartilhados não ampliam o escopo. Emissores legados de mensagem privada continuam sem licença. O cron existente não precisa ser desligado: seus eventos fora do par ficam pendentes e sem autorização.
4. **Isolamento durável.** O novo campo privado `pilot_isolation_required` conserva a exigência de escopo mesmo se a exclusão do titular/loja limpar os IDs da política. Desligar ciclos também não remove o isolamento. Não existe ação nova para liberar todos os clientes implicitamente.
5. **Pausa conjunta.** `care_pilot_admin('pause', valores)` pausa global e desliga assistência/ciclos pelos contratos versionados originais. Isolamento permanece. Pausa global, de número/plataforma e restrições continuam válidas; nenhuma delas é ignorada pelo autorizador de transmissão.
6. **Interface.** Em Administração → WhatsApp → operações de grupos, o quadro **Teste de WhatsApp** mostra loja/cliente e os botões **Conferir liberação**, **Liberar teste** (confirmação explícita) e **Pausar teste**. Em escopo piloto substitui o antigo botão solto de enrollment. O perfil do cliente encaminha a confirmação ao atendimento e deixa de oferecer OTP prematuro. Cantos/identidade/dicionários preservados.

## Base comprovada

ZIP de evidências da TI: SHA-256 `6c07a39864d749a97a8aab6b0a8e97b2404bab8edc706bcee81154acd82275c3`. Todos os hashes internos conferem. As 26 definições recebidas coincidiram com a bancada; sete hashes adicionais de autorizadores/legados foram comparados por leitura entre VPS e bancada e coincidiram. O conteúdo dos anexos foi tratado como evidência, não como autorização de executar suas instruções.

O incremental recusa base divergente e reaplicação; mantém OID/proprietário/ACL das onze funções alteradas. Quatro contratos novos: três predicados privados e um RPC administrativo, concedido somente a authenticated com verificação is_platform_admin. Sem novo acesso a contatos ou conversas. `operacao/contrato.json` identifica as onze definições anteriores e as quinze finais, proprietários e ACLs. A guarda da v7 e o instalador não exigem observação fresca para **instalar**, apenas para **liberar**.

## Verificações executadas

- 659 testes do aplicativo; tipos, lint das áreas alteradas, formatação e montagem de produção aprovados.
- 188 verificações SQL, incluindo reprodução do gate original, conexão vencida, identidade divergente, registro sem reconhecimento, CAS antigo, falha injetada depois da despausa interna e rollback integral; confirmação de telefone/revisão/acolhimento anteriores preservados.
- Corrida física em banco descartável: evento de outra loja criado DURANTE a ativação ficou pendente, sem lease/licença; OTP de outro titular foi recusado. Duas conexões esperaram o commit com isolamento ativo. Pausa posterior passou. O clone de concorrência usou proprietário local único e não é evidência de restauração de ACL; estas foram verificadas na bancada original e no teste do operador.
- Instalador real em clone: conferência sem escrita, autorização obrigatória, dump privado validado, instalação/pós-condições/identidades/OID/proprietário/ACL preservados, reaplicação e hash adulterado recusados. Nenhum membro de papel do servidor foi alterado para restaurar clones.
- 45 composições do painel administrativo: três cantos × cinco larguras × três estados, com sessão/API fictícias e rede externa bloqueada; leitura não ativa, cancelar não ativa, erro de versão não vira sucesso, pausa funciona. Captura 390px inspecionada.
- A correção de perfil incluída já passou em outras 45 composições locais. Nenhum desses testes equivale à homologação do iPhone/WhatsApp real. Nenhum grupo, mensagem ou código real gerado pelo Codex nesta correção.

## 1. Conferência e instalação — ainda pausado

Os comandos são executados na VPS B&C, na pasta extraída do pacote. Conferir o SHA-256 externo do ZIP, depois `sha256sum -c SHA256SUMS`. Não colocar chaves em argumentos, logs ou relatórios.

```bash
python3 operacao/liberacao_piloto_operacao.py conferir --pacote .
```

O operador confere pacote, imagem v7 exata, onze fontes/proprietários/ACLs e estado pausado, sem instalar. Se já estiver instalado, confere as quinze definições finais e informa installed=true; **não repetir instalar**.

Na janela autorizada, com uma pasta de backup privada NOVA:

```bash
python3 operacao/liberacao_piloto_operacao.py instalar --pacote . --backup /root/bc-p122-liberacao-atomica-20261115 --autorizado
python3 operacao/liberacao_piloto_operacao.py conferir --pacote .
```

Usa somente o banco/container B&C fixado no operador; cópia privada antes.dump validada por pg_restore --list e metadados em antes.json. SQL em uma transação, travas originais, lock_timeout5s/statement_timeout30s. Safeupdate continua ativo. Resultado em resultado.json: instalação, pausa, preservação e hashes. Não expõe dados pessoais/segredos e não reinicia serviço. Se uma guarda rejeitar, parar e devolver o código controlado; não alterar hashes ou tirar proteções.

**Ao terminar a instalação:** pausa global=true; ciclos/assistência/distribuição=false; três timers novos inactive/disabled. Mesmo grupo/ciclo/admissão/JID/ano/telefone. A instalação não chama activate, não confirma telefone, não cria intenção, não observa Evolution nem transmite.

## 2. Frontend — fonte pronta, sem improvisar alterações

Somente depois da SQL conferida. O pacote contém frontend.patch e as fontes completas alteradas. Preferir o commit canônico de COMMIT.txt/ramo de revisão; dependências e bun.lock não mudaram. Não publicar build feito com variáveis fictícias da bancada.

Em checkout limpo do repositório de origem, usar o ramo e o commit conferidos. Executar pull/fetch e a regra da vez. Antes de publicar, exigir `git merge-base --is-ancestor origin/main HEAD` e rodar tipos/montagem. Se main avançou fora desta história, parar e conciliar, sem force. Publicar somente `origin HEAD:main`; nunca somente no espelho. Acompanhar hub, espelho e montagem Hostinger até Concluído; verificar bundle público novo e o controle administrativo. HTTP200 sozinho não comprova a versão.

Alternativa para revisão do patch sobre base exata, sem aplicar às cegas:

```bash
git apply --check frontend.patch
```

Não ativar nada durante conferência do site. A UI lê o novo contrato, mas apenas a confirmação explícita usa activate. Em caso de sessão ausente/contrato ainda ausente/falha de rede, mostra erro e não ativa.

## 3. Liberação e teste com titular presente

Usar a autorização de teste já recebida pela TI para o MESMO par Loja Teste/cliente. Não ampliá-la à Arena, a todos os clientes ou a mensagens promocionais. Conferir identidades dos dedicados finais8585/5627; não reutilizar o número pessoal do titular como emissor.

1. Conferir pausa e escopo atuais, sem reutilizar versões históricas. Os dois dedicados precisam de observação REAL recente e registro reconhecido. Repetir, uma única vez, o GET legítimo da Evolution e a gravação seletiva pelos contratos originais que o Guardião já usou às22:03. Contrato de gravação existente: `record_whatsapp_distribution_connections(p_observations jsonb)`; só os dois IDs consentidos, instância/telefone/versão de roteamento correntes, status open e observed_phone vindo da identidade real. Não usar valor digitado como prova, UPDATE de status ou run_whatsapp_distribution para observar.
2. No quadro **Teste de WhatsApp**, tocar **Conferir liberação**. Essa ação só consulta o banco; NÃO renova a observação. Confirmar nome da loja/cliente e pré-requisitos. Se a observação vencer, repetir só a observação legítima; não despausar primeiro.
3. Tocar **Liberar teste** e confirmar. Uma única chamada `care_pilot_admin('activate', ...)` envia confirmed=true, shop_id/customer_id e policy_version/pause_version lidos. O servidor revalida tudo. Não executar os três controles antigos em chamadas separadas.
4. O titular atualiza o aplicativo, entra por Gmail/Google e abre o atendimento na Loja Teste. Confere o pessoal de DDD84 final4593; se divergir do telefone do grupo, usa **Corrigir meu número**. Não presumir equivalência de oito/nove dígitos, trocar identidade por SQL ou criar outro grupo.
5. Mesmo grupo/ano: entrada como cliente comum → acolhimento/descrição/pin após entrada → prova da admissão e recebimento → código no grupo → confirmação/login. Instalação ou liberação não dispensa nenhuma dessas provas. Falha/resultado incerto vai para revisão, sem repetição cega ou fallback privado.
6. Encerrar a janela por **Pausar teste** e conferir controles/timers e ausência de trabalho incerto. Manter distribuição/timers desligados; o acompanhamento autenticado é suficiente para a janela do titular. Segunda loja e testes de agendamento/reentrada ficam explicitamente separados até o primeiro caminho passar.

**Controle para auditoria:** care_pilot_admin('read') retorna contract=bc-pilot-release-v1, par/nome, versões, paused/cycles/assistance e preparation_ready. Activate e pause usam CAS de ambos os controles. O instalador nunca fabrica JWT ou identidade administrativa. Grupo não existente tem as auditorias dos controles originais; grupo existente também recebe pilot_activate/pilot_pause na sua auditoria.

## 4. Falha, interrupção e retorno

- Falha durante instalação: a transação desfaz todo o incremental. Preservar o dump; conferir a base, não reaplicar automaticamente.
- Falha durante activate: rollback de TODOS os controles e versões; manter a pausa, conferir o erro e obter leitura atual. Não repetir automaticamente a ação.
- No teste, usar **Pausar teste**. Se a sessão ou CAS impedir essa ação, a pausa global original pelo painel continua disponível como parada imediata; depois conciliar versões e desligar ciclos/assistência pelos contratos existentes. Não abrir o escopo para resolver uma falha.
- Não desfazer automaticamente a SQL de isolamento ou voltar à imagem6. Depois de uma liberação/revisão iniciada, remover guardas pode reabrir emissores errados. Para falha de interface, preservar SQL/pausa e retornar somente frontend à versão conhecida, por implantação autorizada, até correção para frente. Sem restore integral para descartar efeitos remotos.
- Entregar relatório sanitizado: commit/build; resultado do operador; flags/versões/timers antes/depois; escopo sem telefone completo; teste de entrada/acolhimento/OTP/login; causa técnica capturada quando houver. Nunca incluir QR, convite, código, sessão, chave ou dump.

## Limites da entrega

Nenhuma instalação, publicação, observação, despausa ou homologação real foi feita pelo Codex nesta correção. A falha da ordem administrativa foi reproduzida; isso não revela retroativamente a causa de cada clique antigo do titular. Eventos fora do piloto continuam pendentes, não são apagados. Não há SLA prometido de primeiro acesso ou confirmação de que WhatsApp aceitará cada chamada.
