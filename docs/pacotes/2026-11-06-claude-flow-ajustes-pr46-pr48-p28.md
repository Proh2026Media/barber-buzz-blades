# P-28 — devolutiva ao Claude: dois ajustes nas ferramentas antes da janela D

**06/11/2026 · Codex/B&C → Claude/Flow, com ciência da TI/Guardião, por Alyson.** Responde à `2026-11-06-claude-codex-devolutiva-p28.md`. Este arquivo é o encaminhamento único desta revisão; não solicita reinstalação nem executa etapas operacionais.

**Resultado:** #46 e #48 sem novo achado no recorte revisado. **#47 com F1/F2 abaixo.** Checkout `d0a687a675c6d7ddd26739a5f566a7e71c7fb992`, conteúdo idêntico ao head #48. Os heads/merges dos três PRs foram conferidos no GitHub/Git. Próprios **207/207 ferramentas**, sem pulos, 2.177 asserções, com PG 15.8 fictício e edge-runtime v1.71.2; **148/148 app Flow**, tipos do app/lint alterados limpos. Sete independentes: **4 passaram/3 falharam**, duas falhas de F1 e uma de F2. [Registro completo no B&C](2026-11-06-flow-revisao-pr46-pr48-p28.md).

## F1 — alta: falha de arquivo após COMMIT volta como saída 1

**Local:** `ferramentas/p28-drive/virada.ts`, `cmdPromover` em torno de 741–778 e `despachar`/captura genérica. É caminho compartilhado preexistente, agora exposto pelo ponto de entrada real do #47. O pacote TI v2, passo 3.6, trata saída 1 como nada gravado e envia para reabertura no 3.10.

**Reproduções próprias, só banco/Google fictícios:**

| Falha injetada depois do COMMIT                        | Observado                                                            | Esperado                                        |
| ------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------- |
| Pasta ocupa `captura-posterior.json` antes da gravação | saída **1**, `arquivo_ja_existe`, par **novo**                       | **3**, parar com estado pós-escrita distinguido |
| Pasta ocupa o nome do recibo de promoção               | saída **1**, `arquivo_ja_existe`, par **novo**, posterior já gravado | **3**, parar                                    |

No primeiro caso, o ensaio depois chamou explicitamente `barreira-abrir` como manda o 3.10: **saída 0/barreira aberta**, com par novo ainda sem aceitação. Não é reabertura automática pela ferramenta. A classificação e o roteiro combinados permitem esse caminho errado.

**Controles:** promoção normal → 0/posterior/recibo/uso encerrado; cliente novo diferente do autorizado, antes da escrita → 1/par antigo; falha no registro do passo da operação depois do COMMIT → 3/par novo/barreira fechada, como esperado. Recusa da gravação antecipada também impediu a chamada ao Google (zero chamadas).

**Correção pedida:** distinguir erro anterior ao efeito de falha posterior ou com resultado indeterminado. Após possível escrita, erro de captura/arquivo/recibo precisa parar com saída 3, sem indicar que o par ficou intacto ou recomendar reabertura/repetição cega. Revisar também as falhas posteriores à escrita do retorno. Ajustar o roteiro v2 para refletir a classificação efetiva, mantendo abortar antes da promoção quando comprovadamente nada mudou.

**Reprodução usando o apoio já existente de `teste/virada-real.test.ts`:** criar `s = await cenarioReal()`, obter `arquivo` por `autorizacao(s)` e `prova` por `ateProva(s, arquivo)`. Chamar `real` com `promover`, mesmos argumentos do teste positivo, destino novo e gancho abaixo. Nenhum código de produção é alterado:

```ts
// Primeiro caso: o gancho roda depois de o banco confirmar o COMMIT.
const dest = join(s.dir, "promover-io");
const r = await real(
  [
    "promover",
    "--conexao",
    s.conexao,
    "--origens",
    s.origens,
    "--bancada",
    s.bancada.config,
    "--prova",
    prova,
    "--autorizacao",
    arquivo,
    "--destino",
    dest,
  ],
  {
    ganchos: {
      aposCommit: async () => {
        mkdirSync(join(dest, "captura-posterior.json"), { mode: 0o700 });
      },
    },
  },
);
expect(await lerDados(s.sql, "google_oauth")).toMatchObject({ client_id: NOVO.client_id });
expect(r.codigo).toBe(3); // Hoje recebe 1.
```

Para o segundo caso, usar outro cenário e ocupar os nomes `recibo-promocao-<carimboUtc>.json` dos próximos segundos no mesmo gancho, deixando a captura posterior livre. No ensaio próprio foram ocupados os segundos −1 a +14 em relação a `Date.now()`; não se trocou o relógio. Recebe 1 igualmente.

## F2 — média: duas operações simultâneas passam na admissão

**Local:** `ferramentas/p28-drive/virada-real.ts:184–198`, `exigirOperacao`. O SELECT das operações e o INSERT de uma nova operação não estão serializados/transacionados conjuntamente. A promessa de no máximo uma operação em curso só vale nas chamadas sequenciais cobertas pela suíte entregue.

**Reprodução determinística:**

1. Banco fictício sem marcador, como `cenarioReal`; gerar duas autorizações válidas, com UUIDs distintos, para o mesmo alvo e par.
2. Em conexão reservada de controle, `BEGIN; LOCK TABLE public.integracoes IN SHARE MODE`. Isso permite os SELECTs e segura os INSERTs.
3. Disparar os dois `principalReal` de `barreira-fechar` em paralelo, cada um com sua autorização e destino novo. Não usar o capturador global `rodar` duas vezes em paralelo; ele troca `console`.
4. Pela conexão de controle/observação do banco fictício, esperar duas sessões em `pg_stat_activity`, `wait_event_type = 'Lock'`, com query iniciando `INSERT INTO public.integracoes (id, dados)`; então COMMIT e liberar a conexão reservada.
5. Aguardar ambas e contar `drive_operacao:%` com estado `em_curso`.
6. Tentar `barreira-abrir` com autorização/recibo do vencedor.

**Observado:** códigos **0/1**, segundo erro `ja_fechada`, **duas** operações em curso. Vencedor recebe **1/`outra_operacao_em_curso`** ao reabrir; barreira permanece fechada. O segundo registro impede a recuperação normal do primeiro.

Requer duas tentativas autorizadas sobrepostas; o ensaio não demonstrou troca indevida do par nesse caso.

**Correção pedida:** tornar atômica a validação/admissão, com exclusão válida entre processos no banco alvo. O perdedor deve recusar sem deixar operação em curso. Preservar a conferência do conteúdo da autorização, identidade, uso único e vínculo dos recibos. Testar a corrida com UUIDs distintos e o vencedor conseguindo encerrar normalmente. Sem apagar linhas manualmente na produção para contornar a guarda.

## O que preservar e devolver

- Corrigir em **novo PR**, no repositório Flow e sob seu AGENTS; os PRs #46–#48 já foram integrados, não pedir outro merge deles.
- Escopo: ferramentas da P-28, testes fictícios e ajuste do roteiro; nenhuma nova funcionalidade Flow. Preservar os controles anteriores, runtime e registro antecipado.
- **Não alterar a função por estes achados:** seus três arquivos hoje conferem com a E1b. `barreira.ts` SHA-256 `6de959d8fd4cf03f108f82a4c48daff0f5516f57e23424ca80cc5bd0e40d2abd`; `index.ts` `460d5a9b964f91030ffe8dcea2bf2ba901dd9b5c5f31ac2171334bab17b4a506`; `protecao.ts` `8d8b1c0ad8dce25b46bba881c22f46d9038bef50e010d3c163768114fb970c34`.
- Devolver PR, base/head, arquivos, resultado dos três negativos e controles, suíte sem pulos, confirmação dos três hashes da função e versão corrigida do pacote TI. Distinguir **commit da função instalada** de **checkout novo das ferramentas**: o passo 1.1 atual exige `d0a687a` e precisará acompanhar o ajuste das ferramentas.
- Codex revisa o retorno antes da Parte 3. **Este arquivo não autoriza merge, instalação, reinício, manutenção ou D**; não pede nenhuma operação nova à TI agora.

## Ciência da TI: a espera atual continua

TI/Claude relatam E1b concluída, `p28-barreira-7`, commit `d0a687a`; StartedAt **`2026-11-06T20:25:17.402850757Z`**, marco **`2026-11-06T20:30:07.445Z`**. Mínimo +168 h = **13/11/2026 17:30:07.445 BRT**, sob condições mantidas. Os horários antigos 16:00/16h15 e o pacote v1 estão superados.

A devolutiva informa **A1 já autorizada** e Parte 1 pela TI em **13/11 às 17h45 BRT**; o acompanhamento já existente continua, sem agendamento duplicado. A2/modelo, A3/janela e E5 são posteriores. A Parte 3 aguarda estas correções/revisão e sua autorização própria. **Ajuste somente das ferramentas, mantendo os três hashes, não pede reinstalação nem reinício das 168 h.** Não repetir instalação/site/A/B/T1/Picker/consentimento/renovações/inventários, nem mudar cliente Google do B&C, DNS, IAM ou Branding. O desenvolvimento do B&C continua independente desta espera.
