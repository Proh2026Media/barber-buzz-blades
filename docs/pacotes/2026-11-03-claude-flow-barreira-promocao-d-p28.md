# P-28 — Para Claude/Flow: preparar a barreira e a promoção/retorno D

**Retorno recebido em 05/11:** #42 entregue e integrado pelo dono em `3c77d32`. [Revisão própria](2026-11-05-flow-revisao-pr42-p28.md): suítes 145/0/0 + 122/122, independentes 1/4, quatro correções. [Novo pacote Claude](2026-11-05-claude-flow-ajustes-pr42-p28.md); não repetir entrega/merge do #42 ou ensaio dos 15. VPS ainda com arquivos #36 e sem barreira, sem instalação/D. Pedido original abaixo.

**03/11/2026 · Implementação e testes só com fictícios; nenhum alvo de produção habilitado nesta entrega.** [Ensaio dos 15 concluído/conferido](2026-11-03-flow-acervo-15-conferido-p28.md): seleção/GETs e duas provas v2, conta/cliente/escopo/vínculo corretos, temporários retirados. Não repetir A/B/T1/Picker, consentimento, renovação real, inventário ou acesso. Essa é dependência P-28 do Barba & Cabelo, sem nova frente funcional geral do Flow.

## 1. Escopo e regras

Partir da main com #41, merge `d3f1c90e60b678db9d4a6da1d32b3ea7f6babbfa`, ferramentas `1d65e1afc9bd5411f175a71cce087398ca7b919e`/25 arquivos; reler AGENTS vigente e usar a vez/ramo `ia/*`, PR em rascunho. A composição e a aceitação externa já foram revisadas, **136/0/0 + 8/0** próprios; não refazer esses PRs.

Entregar as peças que faltam entre uma conexão candidata aprovada e uma virada revisável: **barreira de admissão/drenagem**, **promoção/retorno/reconciliação em alvo fictício** e um procedimento operacional concreto. Não acessar VPS, Google/cofre, B, candidato, manifesto ou provas reais. Não integrar main nem instalar/reiniciar serviço. Entradas e consentimentos de teste são simulados.

O AGENTS do Flow restringe scripts de instalação/migração à stack de teste, produção “Nunca” (§6). **Manter essas guardas e a de `restaurar-ficticio` intactas.** Esta entrega não cria bypass/force, não altera AGENTS nem autoriza escrita real. Implementar/ensaiar o novo mecanismo com produção bloqueada e identificar exatamente o que precisará de decisão específica de Alyson antes de qualquer ativação real. Não chamar motor fictício de CLI de produção pronta.

## 2. Barreira que possa ser provada

Preferir um desenho que controle o Drive enquanto o runtime permanece saudável, sem depender de parar o processo para interromper trabalho. Escolher o menor mecanismo que demonstre os contratos abaixo; não introduzir migration, tabela, rota pública ou mudança de permissão sem necessidade técnica demonstrada. Se houver esquema novo, ensaiar somente em PostgreSQL fictício, RLS/permissões restritas e sem aplicação real.

- **Cobertura:** todos os caminhos que podem gravar integração/Drive, inclusive `status`, `configure`, callback, compartilhamentos, sync/upload/mover/excluir, chamadas internas e `share-expire`. Auditar os chamadores; fechar a aba admin ou parar só o cron não cobre o conjunto.
- **Admissão atômica com a contagem de atividade:** registrar antes de ler conexão/iniciar efeito; ao fechar admissão, nenhuma requisição nova pode entrar no intervalo entre “verificar modo” e “contar atividade”. Definir estados e transições observáveis. Controle administrativo somente por canal autorizado, sem segredo em frontend/URL ou chave simples pública.
- **Requisições em andamento:** permitir terminar e persistir resultados coerentes; decrementar atividade só após encerrar os efeitos/tarefas relevantes. Não deixar tarefas em background fora da prova. Uma chamada aguardando Google continua ativa mesmo sem sessão SQL aberta. `pg_stat_activity`, logs/contagens quietos ou TTL não substituem essa prova.
- **Workers/instâncias/reinício:** contador isolado por worker não prova zero global. Identificar a geração/runtime/escopo da barreira; troca/recriação inesperada invalida a prova ou mantém fechamento seguro, nunca “reiniciou então zero”. Não depender de `restart=no`/vigília como se impedissem ação do Coolify.
- **Falha ou efeito externo incerto:** timeout, aborto ou reinício entre uma ação Drive e a gravação local pode deixar resultado desconhecido. Recusar a virada até reconciliar o caso; contador zero depois de interrupção não é sucesso. Prazo de drenagem vencido interrompe a preparação, sem matar e declarar concluída.
- **Cache:** com escritores drenados/admissão mantida, definir e provar a atualização de configuração/conexão/token (TTLs atuais 60 s/30 s e chave cliente+refresh), evitando par misto. Reinício não é mecanismo de drenagem. Manter outros módulos/regras/autenticação normais fora do escopo Drive.

Devolver prova/estado resumido sem dados pessoais, IDs Drive, cookies ou segredos. A operação futura precisa relacionar a barreira válida à captura imediatamente anterior e invalidá-la se houver reabertura/troca de geração antes do COMMIT. Não basta um booleano fornecido pelo operador sem uma prova coerente do mecanismo.

## 3. Promoção, retorno e COMMIT desconhecido — alvo fictício

Reutilizar `comporPromocao`, `aceitarPromocao`, validação/captura existentes e o contrato transacional de `restaurarPar`. Separar o novo fluxo dos instaladores/migrations e do comando histórico de restauração fictícia, sem enfraquecer guardas.

1. Barreira válida → captura fresca → composição a partir dessa imagem e das provas v2 do mesmo candidato. Não usar B histórica como estado imediatamente anterior. Entrada por arquivos privados, sem valores em argumentos/log público.
2. Conferir fonte efetiva, stack/banco, par atual esperado e referências antes e dentro da transação. Bloquear divergências, linha ausente ou origem ambiente; nada de `--force`.
3. Aplicar as duas linhas em **um COMMIT**. Preservar IDs, `token_secret`, `cron_secret`, desconhecidos/null/presença e a política atual de varredura. Nenhuma escrita nas referências/entidades/anexos/compartilhamentos. Conferência por outra conexão.
4. Capturar o pós-COMMIT e usar a **aceitação externa existente**: par que veio do banco, emissor/conta/escopo e GET dos IDs. Escritores continuam barrados; nada de `status`/callback/criar pastas. O retorno em caso de falha também exige seu próprio COMMIT coerente, estado esperado e campos atuais de varredura.
5. Perda de conexão no COMMIT: não tentar novamente cegamente. Releitura sob barreira classifica estado anterior / promovido / divergente-misto. Promovido segue aceitação; anterior significa não aplicado; divergente não admite retorno forçado. Exercitar a reconciliação com falhas injetadas.
6. Reabrir escritores só depois da aceitação e prova de cache. Diagnóstico do handler vivo é acompanhamento posterior; não reabrir o runtime para conseguir uma aceitação que devia ocorrer sob barreira. Arquivos criados depois da reabertura podem não estar acessíveis ao cliente antigo, portanto retorno das duas linhas não promete reversão completa após novo uso.

Definir comandos reais de **ensaio fictício**, códigos de saída, arquivos privados novos/atômicos e recibos/resumos permitidos. Não fazer o comando aceitar stack real nesta entrega. O desenho futuro de execução real deve nomear as pré-condições, controles e aprovação necessários, sem ocultar a restrição do AGENTS.

## 4. Provas e entrega

- Testes de corrida: requisição admitida antes da barreira termina; nova requisição é recusada; não há janela de admissão/contagem; nenhum escritor antigo regrava token/IDs depois da composição/aplicação.
- Espera no Google sem SQL ativo não vira drenagem; worker paralelo, reinício, timeout, callback e cron em andamento não geram falso zero. Efeito externo incerto recusa a operação.
- PostgreSQL 15 fictício: par completo em COMMIT, falha intermediária em ROLLBACK, referências/unknowns/varredura preservados, concorrência recusada e resultado desconhecido reconciliado sem dupla aplicação.
- Ponta a ponta fictícia: fechar/drenar → capturar → promover → capturar → aceitar externamente → reabrir; e falha → retorno coerente antes da reabertura. Testar isolamento, produção recusada, zero vazamento e regressões pertinentes; não repetir Google real ou A/B/T1.
- PR/head/manifesto, escolhas e alternativas rejeitadas que expliquem a prova, comandos existentes, resultados por plataforma e lacunas reais restantes. Descrever separadamente código pronto, ensaio fictício e qualquer passo ainda não permitido em produção.

Depois da revisão, Codex concilia com TI/Guardião e prepara a implantação/virada concreta para decisão do dono. **Não executar D por este arquivo.** Não mudar domínio/marca/Google, revogar cliente antigo ou tocar Barba & Cabelo. A autorização do ensaio dos 15 foi concluída e não cobre a virada.
