# P-122 — telefone e primeiro acesso, entrega local integrada

**15/11/2026. Correção implementada e ensaiada localmente; produção e piloto real não alterados pelo Codex.** Entrega reúne feedback, acompanhamento assistido e revisão coordenada da identidade. O roteiro operacional está em [instruções completas para TI](2026-11-15-ti-primeiro-acesso-telefone-p122.md). O último corte remoto continua sendo o relatório TI 2 de 15:00:34 BRT; não presumir conexão, convite, alias ou login homologados agora.

## Resultado

- Titular confere ou corrige o telefone na mesma conta autenticada e grupo existente. Número novo não é inferido a partir de oito/nove dígitos. Só a consulta privada de um candidato e o pedido real PN/LID comprovam a identidade física.
- B&C e Evolution conciliam a revisão por intenção persistente, CAS e comprovante de conclusão. Resposta perdida após bind/finalize é recuperada pela mesma operação. Não cria outro grupo, reinicia o ano, renova consentimento a cada consulta ou envia código automaticamente.
- O telefone declarado fica no perfil e no login; o PN físico pode ser diferente apenas com prova autenticada do WhatsApp. Uso desse alias em outra barbearia/login exige OTP consumido. Não toma número de outra conta verificada nem funde pessoas.
- Primeiro acesso mostra Preparar → Entrar → Confirmar. Confere somente os números consentidos e acompanha a página visível/foco. Intervalo mínimo entre tentativas permanece dez segundos, inclusive com erro de rede; verificação do horário tem precisão de um segundo para evitar espera extra por desalinhamento de intervalos. Convite privado é buscado assim que disponível.
- Antes da entrada: nome/foto/admins/proteções/convite. Depois da entrada: segundo administrador acolhe, descreve e fixa. Acolhimento antigo permanece no histórico, mas não substitui recibo da admissão atual. Só então código explícito no grupo e consumo no aplicativo.
- A confirmação do telefone mantém o gatilho original de invalidação da identidade. A janela autenticada do desafio permite nova conferência real do grupo, sem repetir acolhimento/código ou estender o prazo. Não marca o grupo pronto por atualizar perfil.
- Retenção conserva revisão incerta e provas enquanto a limpeza não foi confirmada. Após limpeza comprovada/90 dias, minimiza a revisão; alias verificado pertence à conta e sobrevive ao descarte daquele grupo. Exclusão da conta elimina o alias. Corrigida a ordem das cascatas de auditoria na exclusão: ator é destacado antes da remoção do perfil/grupo, preservando a semântica já prevista pelo FK.

## Código e contratos

Duas SQLs B&C novas: `20261115002000_whatsapp_primeiro_acesso_assistido.sql` e `20261115003000_whatsapp_revisao_telefone_protegida.sql`. Instalação conjunta com pausa/políticas desligadas, hashes exatos, ausência de leases e transação integral. Nenhum telefone existente é modificado pela instalação; assistência nasce false. Tabelas de intenção/prova são privadas; service_role usa contratos, sem acesso direto a alias. Leitura mantém OID/dono/ACL.

Nova Edge autenticada `whatsapp-group-access`, helper privado de revisão e conjunto completo de dependências. Frontend usa dicionários pt-BR/pt-PT/en-US/es; en-GB herda en-US. Estados de revisão/cancelamento/expiração, pausa e diagnóstico sanitizado não exportam número, JID, token, convite, OTP ou SQL bruto.

Evolution `2.3.7-bc.groups.7`, commit `e9748ffd3363af89f97996c1a7119d5a4825274d`, sobre a revisão instalada `ad88eae`. Protocolo v4 preservado, capacidade nova `protectedPhoneRevision`, rota privada `bcPhoneRevision`. Fonte completa, patch oficial e delta incluídos. Zero migrations/dependências Evolution novas. Operações normais congeladas durante revisão; encerramento de conta removida usa prova lacrada da mesma revisão, sem relaxar identidade dos envios normais.

## Evidência local

- **659 testes gerais B&C**, checagem de tipos, lint sem erros e montagem. Quatro avisos de lint já existentes em componentes fora desta correção ficam registrados, sem ocultá-los.
- **36 verificações SQL de acesso assistido + 51 de revisão/retomada/falhas/retenção**, além das regressões de instalação, distribuição, concorrência e safeupdate na bancada descartável.
- **61 testes Evolution + 17 PostgreSQL**, incluindo reinício de clientes/CAS e persistência da revisão. Hotfix canônico da marca preservado.
- **Três jornadas integradas** com PostgreSQL B&C real e socket Evolution fictício: PN exato com resposta de bind perdida; alias autoritativo + pedido LID com resposta de finalize perdida e acolhimento legado; conta excluída durante bind incerto. Mesmo grupo/ano, nenhuma repetição de criação, perfil somente após OTP, login e segunda loja com número declarado.
- **195 composições de interface Chromium**: revisão105, primeiro acesso45, diagnóstico45. Três cantos, 320/390/768/1024/1440 px, Inter real, toque/teclado, convite, consentimento, código explícito, foco/retorno, cancelamento/expiração/pausa. Sem corte horizontal ou erro de execução; rede/sessão/API fictícias. Capturas revisadas visualmente. Não equivale a teste físico no iPhone ou piloto real.
- Imagem AMD64 montada localmente, inicialização/recriação em rede Docker interna sem sessões WhatsApp. Volume preservado; API vazia levou **20,6 s** na bancada. Não estima indisponibilidade/reconexão real. Sem publicação no registry.
- Operador: dez testes de integridade, divergência da base, falha no meio da cópia, retorno exato, proteção de entrega posterior, autorização e identificação da imagem. Ensaio do pacote está registrado no JSON final da entrega.

Reprodução local:

```sh
python3 scripts/testar-revisao-telefone.py --preparar
node --import /tmp/bc-evolution-pos-entrada-20261115/node_modules/tsx/dist/loader.mjs scripts/testar-revisao-telefone-integrado.mts /tmp/bc-evolution-pos-entrada-20261115
python3 scripts/testar-evolution-ciclo-banco.py /tmp/bc-evolution-pos-entrada-20261115
npm test
npm run typecheck
npm run lint
npm run build
```

Bancadas exigem Docker Unix local, recusam DOCKER_HOST e usam dados fictícios. O integrado exige banco recém-preparado e não deve rodar junto de outra reconstrução da mesma bancada. Scripts de interface usam Vite 8091; não montar a aplicação simultaneamente com eles. Operador do pacote pode ser ensaiado com `scripts/testar-pacote-primeiro-acesso-telefone.py --pacote CAMINHO_ABSOLUTO`.

## O que falta fora do código local

Revisão/janela da TI, backup/cofre/registry, instalação autorizada dos dois SQLs, imagem7, funções completas e frontend; depois piloto com o titular. A TI recebe comandos, hashes de base, pós-condições, cópia/retorno e critérios de aceitação. Nenhuma necessidade de inventar equivalência, reescrever telefone por SQL, refazer D0 ou desenvolver a lógica no servidor.

Não voltar à imagem6 com revisão iniciada: ela não conhece o congelamento novo. Retorno conservador mantém v7/SQL/fontes pausados e provas intactas. Pacotes já instalados ficam imutáveis. Marca/Flow/`.env`, VPS, números, grupos e mensagens reais não foram tocados. Commits somente locais; nenhum push/autossave.

**Ajuste adicional testado nesta entrega:** trava de roteamento antecipada para antes das tuplas de `whatsapp_channels`, evitando a inversão entre escrita física de conexão e classificação pessoal. A base antiga reproduziu o deadlock nessa corrida; o ensaio completo adia somente esse caso durante a montagem da base antiga e o executa integralmente após o SQL03000. Não conta a parte adiada como teste aprovado. Nenhum incremental já instalado foi reescrito. Fonte B&C inclui o `bun.lock` versionado; não há dependência nova.
