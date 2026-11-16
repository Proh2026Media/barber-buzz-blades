# P-122 — implantação da correção de liberação, 15/11/2026

O titular autorizou expressamente: **“Sim, Codex aplica e mantém tudo pausado”**. Escopo: uma SQL nova e frontend; manter pausa global, piloto, distribuição e timers desligados, sem criar grupo ou enviar mensagem. Esta autorização não libera o teste real.

## Banco instalado e conferido

- Fonte **9cf643e38932523024d6567fcc3da87c98197622**, pacote completo SHA-256 **1db992feddf15fd4770cf1a8c66ad1f69f97258d73d4eee5c2d7d1fcada9d4b1**. Arquivos e manifesto conferidos localmente e na VPS.
- Aplicada somente **20261115004000_whatsapp_piloto_liberacao_atomica.sql**, SHA-256 **609e599e69a0e22a93cba3b953e3bffc4c6cc24f110387dd05a8cf09b6caa8d1**. Onze funções anteriores e quinze definições finais conferidas por hash/proprietário/ACL. Identidades de grupo/ciclo/JID/ano/consentimento e telefone preservadas. `pilot_isolation_required=true`; nenhuma ativação, revisão de telefone, nova intenção ou prova fabricada.
- Backup privado completo `backup-antes/antes.dump`, validado por pg_restore --list; SHA-256 **3516f4adf53f6f2de02f4521b7b86e56f26a76975fe454f8b24196093945d658**. `antes.json` conserva metadados e assinaturas privadas, sem exportação dos dados.
- Operação com backup: **22:53:50–22:53:59 BRT**, duração total **9,038s**. Esse valor inclui backup/conferências, não mede indisponibilidade. SQL em transação com timeout/travas. Nenhum container reiniciado; IDs e StartedAt de todos os containers anteriores preservados.
- Pós-condição real **22:55:32 BRT**: pausa global=true v17; ciclos/assistência=false, política v12; distribuição=false; isolamento=true; acessos0/revisões0. Três timers `bc-central-grupos.timer`, `bc-central-distribuicao.timer`, `bc-central-expurgo.timer`: inactive/disabled.
- Novo RPC reconhecido no REST, com pedido anônimo de leitura recusado: HTTP401/código42501. Chave pública usada somente na VPS, sem impressão ou exportação. Nenhuma sessão administrativa ou JWT foi fabricado; nenhum activate/pause executado.
- Evolution7/v4/imagem fixada, Edge, cofre, SMTP/Auth/Google/Web Push, cron existente e proxies preservados. Sem reaplicar SQLs anteriores, migration Evolution, reconstruir imagem, Redeploy, Flow, marca ou mudança de `.env`.

Evidências/backups privados na VPS: **/root/bc-p122-liberacao-20261115-codex-9cf643e/**. Não anexar dump, configurações, sessão, QR/convite/código ou chave a uma devolutiva.

## Frontend

9cf643e enviado à origin/main sem force, após conferir ancestralidade. Os dois gatilhos concluíram com sucesso: [hub43789179325](https://github.com/Proh2026Media/barber-buzz-blades/actions/runs/43789179325) e [blindagem43789179322](https://github.com/Proh2026Media/barber-buzz-blades/actions/runs/43789179322). Espelho PROH-Media também em 9cf643e. Publicação efetiva concluída e conferida às **23:06:01 BRT**: `/app` e `/platform?aba=whatsapp` HTTP200; novo `/assets/PlatformShell-Ctf9guJ_.js` contém a chamada care_pilot_admin (SHA-25670628b9243de57fc082938af31b918cde5360be0c8fac95e6ebab06f14166453). O cartão do perfil foi agrupado pelo build em `/assets/MyAreas-Bng0ZwZj.js`: chamada real de care.profileSetupHint conferida, não só a entrada no dicionário (SHA-25673eec15c1af03fdf43fb5fcb4d34112f93504accf8d5a10fa07ddccc188b9ab5). A montagem agrupa os módulos de forma diferente da local; não exigir igualdade de nomes/hashes locais para provar publicação. [Evidência sanitizada](../validacoes/implantacao-liberacao-p122-2026-11-15.json).

A conferência final do servidor às **23:08:24 BRT** confirmou novamente pausa=true v17, ciclos/assistência=false política v12, distribuição=false, isolamento=true; zero acessos/revisões/leases/incertos, três timers inactive/disabled e todos os containers com os mesmos IDs/StartedAt. Nenhum envio, piloto ou rotina habilitados. A fonte funcional permanece 9cf643e; commits posteriores de registro mudam apenas documentação.

## Estado e próximo passo

Esta instalação corrige a sequência de liberação e coloca o isolamento nos emissores, sem habilitá-los. Não reinstalar o pacote. A entrega local anterior e o roteiro do pacote ficam como histórico/referência de operação, não uma nova demanda de instalação para a TI.

A próxima janela, quando o titular desejar, pode usar o controle atômico já preparado, com duas conexões reais recentes e escopo singular conferido. No estado atual, **pedir código ainda permanece bloqueado por decisão de manter tudo pausado**. Não repetir tentativas nem supor que matrícula, convite, conexão ou prontidão ficaram renovados pela implantação. A homologação do telefone/entrada/acolhimento/OTP/login real continua pendente.
