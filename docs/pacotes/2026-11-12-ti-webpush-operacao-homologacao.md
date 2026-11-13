# B&C — Web Push: operação pronta e homologação

Data: 12/11/2026, America/Sao_Paulo. Codex → TI/Guardião.
Responde aos três arquivos enviados pelo dono: instrução atualizada, revisão original e relatório `relatorio-ti-webpush-dispatch-incremental-revisao-2026-11-12 65465.md`. **A seção 8 deste último confirma a instalação às 21:43–21:44 e supera o estado “não instalado” da revisão original.**

## Decisão e responsabilidades

O dono pediu implementação e instruções completas, deixando com cada agente somente o que depende de seu acesso. O Codex concluiu a correção dos testes e preparou o operador/agendador, verificações e retorno. A TI precisa executar os comandos no servidor, medir a interrupção e registrar os resultados. O titular do aparelho precisa permitir notificações e confirmar o recebimento visual. Não transferir desenvolvimento pendente para a TI.

**Nada deste novo pacote foi executado na VPS pelo Codex.** As funções e migrations do incremental anterior já estão instaladas. Este pacote não instala novamente SQL/Edge, não muda frontend, não publica main nem modifica VAPID. Instala um operador no host e um timer systemd (não pg_cron/crontab). A ativação muda somente os dois controles de push, recria somente funções e inicia esse timer.

A autorização anterior foi explicitamente limitada à instalação com push desligado e sem cron. Esta entrega deixa a próxima ação concreta: **ativação de notificações voluntárias e agendador requer autorização do Alyson; teste real requer seu aparelho consentido.** Não interpretar a cópia do pacote como autorização de envio real.

## 1. O que já foi resolvido

- Incremental instalado: `20261112232000_web_push_lotes_limitados.sql`, `web-push/index.ts`, `_shared/web-push-budget.ts` e `_shared/web-push-dispatch.ts`.
- Hashes desses arquivos continuam iguais aos relatados pela TI. **Não reinstalar, renomear migrations, criar ledger, trocar imagem ou alterar limite global do runtime.**
- VAPID existente, subject `mailto:contato@proh.media`; cofre confirmado pelo Guardião às 21:01 segundo relatório. Não gerar outro par.
- Frontend publicado permanece `04bf9276281c5cd8d7f42f48ecb839d1a4a9b17e`; nenhuma publicação necessária.
- Testes de 60/100 ms estabilizados com timers e relógio monotônico controlados, sem mudar os limites de produção. Também retiradas esperas reais dos demais testes de orçamento e da barreira de concorrência.
- Operador: 17 testes aprovados tanto localmente quanto em Linux isolado sem rede; unidades aprovadas por `systemd-analyze verify`. Ações reais de Docker/servidor foram simuladas nos testes do operador; funcionamento operacional na VPS e recebimento no aparelho continuam sendo verificações da TI/titular.
- Node 24.22.1: 50/50 execuções do arquivo, com quatro processos concorrentes, e suíte 606/606. Node 26: 40/40 execuções. Tipos, lint e build verificados; avisos preexistentes registrados nas evidências.

## 2. Conteúdo do pacote

ZIP `BC-WebPush-Operacao-Homologacao-2026-11-12.zip`:

- `LEIA-PRIMEIRO.md`: este roteiro.
- `operacao/webpush_operacao.py`: operador completo, sem dependências Python externas.
- `operacao/test_webpush_operacao.py`: bancada, nunca instalar/rodar como teste de produção.
- `arquivos/`: fontes completos de teste/documentação/operação.
- `alteracoes.patch`: alterações sobre a entrega local `837ef55dfef0a205f1e9e5195b8ff022c047f776` (a cópia de revisão `rev120g` da TI já recebeu os arquivos dessa entrega). **Não aplicar diretamente na main `04bf927`, nem fazer push/main.** O operador funciona independentemente de aplicar esse patch.
- `BASE.txt`, `COMMIT.txt`, `SHA256SUMS`, evidências e relatórios originais.

Na box de revisão, usar a cópia `rev120g` com o incremental anterior aplicado. `git apply --check alteracoes.patch`; aplicar somente nessa cópia e rodar os testes. Se a cópia divergir, comparar os arquivos completos; não sobrescrever a main nem a VPS para consertar a cópia de revisão.

## 3. Receber e conferir — somente leitura na produção

Transferir o ZIP para `/root/pacote-bc-webpush-operacao-20261112.zip`. A VPS não tem unzip; extrair com Python, sem sudo genérico em outro servidor:

```bash
umask 077
mkdir /root/pacote-bc-webpush-operacao-20261112
python3 -m zipfile -e /root/pacote-bc-webpush-operacao-20261112.zip /root/pacote-bc-webpush-operacao-20261112
cd /root/pacote-bc-webpush-operacao-20261112/BC-WebPush-Operacao-Homologacao-2026-11-12
sha256sum -c SHA256SUMS
python3 operacao/webpush_operacao.py conferir
```

Não é necessário abrir cofre/copiar chaves: a conferência lê o ambiente do container e do Compose em memória e mostra somente o resultado. Confere os hashes Edge instalados, VAPID/origens/subject iguais no container e configuração persistente, flags desligadas, claim de quatro, permissões e ausência de agendadores Web Push em pg_cron/crontab. Não invoca dispatcher nem transmite notificações.

A TI deve conferir também se não existe outro timer/processo externo de Web Push além deste pacote; os relatórios anteriores não registraram nenhum. Se houver mudança de versão, flag, configuração, cron ou base desde o relatório, devolver o estado observado antes de prosseguir.

## 4. Preparar o agendador — ainda desligado

Com autorização para preparar os arquivos no host:

```bash
python3 operacao/webpush_operacao.py preparar
```

O operador instala:

- `/opt/barba-cabelo-webpush/webpush_operacao.py` (pasta restrita/root);
- `/etc/systemd/system/bc-webpush.service`;
- `/etc/systemd/system/bc-webpush.timer`.

Valida as unidades com `systemd-analyze verify`, recarrega somente a configuração do systemd e deixa o timer **desabilitado e parado**. Não recria container, não altera `.env`/SQL, não envia teste. Recusa substituir operador/unidade preexistente divergente. Verificações:

```bash
systemctl is-active bc-webpush.timer
systemctl is-enabled bc-webpush.timer
```

Resultados esperados: `inactive` e `disabled` (esses comandos retornam status não zero para estado parado; isso não representa falha da preparação).

## 5. Ativar — somente depois da autorização do Alyson

Frase pronta, caso o dono decida autorizar esta etapa:

> Autorizo preparar e ativar o Web Push do B&C com o agendador deste pacote, preservando as chaves existentes e recriando somente o container de funções. Vou usar meu próprio aparelho para homologar e confirmar visualmente o recebimento.

**Efeito da ativação:** o controle de notificações passa a estar disponível aos usuários compatíveis. Só aparelhos que concederem permissão e ativarem a opção terão inscrição; não é um piloto restrito a uma única conta por allowlist. Novos agendamentos elegíveis poderão gerar push. Se o dono quiser limitar a uma conta no backend, parar e devolver essa escolha ao Codex antes da ativação; não improvisar filtro no servidor.

Com a autorização, na janela combinada:

```bash
python3 operacao/webpush_operacao.py ativar --autorizado
```

O comando já faz, nesta ordem:

1. Reconfere estado desligado e operador/unidades exatos.
2. Cria backup protegido `/root/backup-bc-webpush-ativacao-AAAAmmdd-HHMMSS`; preserva `.env` sem mostrar valores.
3. Altera atomicamente **só** `WEB_PUSH_ENABLED=false` para `true` no `.env`, preservando as demais linhas/permissões e exigindo uma ocorrência única da variável.
4. Confere a configuração resolvida e a identidade VAPID/origens, recria **somente** `supabase-edge-functions` com `--no-deps --force-recreate --pull never` e espera saudável.
5. Reconfere VAPID/origens/subject; só então habilita `web_push_settings.enabled=true`.
6. Habilita/inicia o timer e reconfere estado ativo. Se falhar, tenta pausar os dois controles e o agendador; uma pausa incompleta é explicitamente reportada.

Não usar Redeploy do Coolify; não reiniciar banco/Auth/Kong/proxy/Evolution. Medir a indisponibilidade com o mesmo método da TI. Os cerca de 2 s da janela anterior não são garantia desta.

O timer dispara 15 s após ativação e 15 s **depois do término** da execução anterior. `Type=oneshot`, trava de arquivo e limite de 55 s impedem sobreposição. O operador faz uma única chamada por execução, sem repetir automaticamente uma chamada HTTP incerta. A fila do servidor continua responsável por não reenviar tarefas incertas. Não existe garantia de entrega por essa mecânica.

A chave de serviço é lida do container em memória: não entra no cron, argumentos de processo, unidade, arquivo novo de configuração ou log. HTTPS com verificação de certificado, redirecionamentos recusados e proxy de ambiente ignorado. O operador imprime somente contadores e mensagens operacionais, nunca payload, endpoint de assinante, token ou destinatário.

## 6. Homologar no aparelho — passos prontos

A TI não deve declarar homologação só porque recebeu HTTP 200 ou `processed>0`. O titular precisa confirmar a notificação visual. O pacote não contém conta, senha nem destinatário predefinido.

1. Alyson entra com a conta de teste e aparelho de sua escolha. Mantém o login por e-mail/Google já funcional; este teste não depende do OTP por grupo.
2. Abre a opção de notificações do aparelho na conta/perfil. Só ao tocar em ativar deve aparecer o pedido de permissão do navegador. Se já negou, revisar a permissão do site no navegador antes de tentar novamente.
3. Ativa a opção e toca em enviar teste **uma vez**. Registra horário, navegador/aparelho e se recebeu visualmente. A fila tem limite de um teste por minuto; não clicar repetidamente para compensar atraso.
4. Minimiza/coloca a página em segundo plano e confirma título/texto/clique. Em iPhone/iPad, usar o aplicativo adicionado à Tela de Início e verificar a opção no contexto instalado. Registrar se essa combinação não foi testada.
5. Em uma barbearia de teste com destinatários consentidos, criar/alterar/cancelar agendamento fictício. Confirmar que o título usa a barbearia correta e não inclui telefone, código ou dados pessoais na tela bloqueada. Quando não há loja (teste avulso), título neutro é esperado.
6. Desativar a opção no aparelho; após a revogação, gerar novo evento fictício e confirmar que não recebe. Uma notificação já aceita pelo provedor antes da revogação ainda pode chegar; diferenciar os horários.
7. Sair/trocar de conta no mesmo aparelho; conferir que a conta anterior não continua inscrita para novos envios. Testar outro aparelho somente com consentimento e sua própria permissão.
8. Conferir login/agendamento comuns e ícone de saúde WhatsApp do admin; não testar grupos/WhatsApp nem mudar números nesta janela.

Acompanhamento pela TI, sem exibir segredos:

```bash
systemctl status bc-webpush.timer bc-webpush.service --no-pager
journalctl -u bc-webpush.service -n 30 --no-pager
```

`processed` conta resultados finalizados, incluindo incertos; não conta recibos visuais. `uncertain>0`, erro HTTP, timeout ou ausência de recebimento exigem diagnóstico da fila/estado/permissões, não reset de tarefas nem reenvio em massa. O serviço `oneshot` pode aparecer `inactive` entre execuções enquanto o timer está `active`; isso é normal.

## 7. Pausa e retorno prontos

Se houver falha relevante ou o dono quiser encerrar o teste:

```bash
python3 operacao/webpush_operacao.py pausar
```

O comando desabilita/para o timer, para a execução corrente, tenta desligar o controle SQL, altera só a flag do `.env` para false e recria somente funções se necessário. Tenta ambos os controles mesmo se um comando falhar; informa pausa incompleta em vez de declarar sucesso. Parar uma chamada corrente pode deixar resultado incerto, que não deve ser reenviado automaticamente.

Não apaga inscrições/fila, não troca chaves, não restaura `.env` inteiro nem faz downgrade do dispatch. Notificações já aceitas pelo provedor não podem ser recolhidas. Para retomar posteriormente, conferir a causa e obter a autorização apropriada; usar o comando de ativação, sem reinstalar migrations.

Se o operador não conseguir executar a pausa por falha de infraestrutura, a TI ainda dispõe dos comandos diretos:

```bash
systemctl disable --now bc-webpush.timer
systemctl stop bc-webpush.service
docker exec -i supabase-db-z2dbb7dkyzhc8vjiywq34mhn psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 <<'SQL'
update public.web_push_settings set enabled=false where singleton;
SQL
```

O controle SQL interrompe novas autorizações assim que a alteração for efetivada. Conferir também `.env`/container `WEB_PUSH_ENABLED=false`; o comando `pausar` pode ser repetido após corrigir a infraestrutura. Nunca substituir o arquivo de ambiente inteiro por backup antigo.

## 8. Retorno esperado da TI

Preencher um único relatório:

- **Responde a:** B&C — Web Push: operação pronta e homologação.
- Conferido / operador preparado / ativado / homologado: sim ou não, separadamente.
- Autorização usada, horários BRT, backup e indisponibilidade observada.
- Hash do operador instalado; funções/migrations anteriores preservadas; chaves/subject/origens preservados (sem valores secretos).
- Estado do timer/serviço e controles SQL/ambiente. Nenhum agendador duplicado.
- Resultado visual em cada aparelho/navegador efetivamente usado; ações de teste e horário; itens não testados.
- Se pausou: motivo, estado final e se houve tarefas incertas. Não incluir credenciais, endpoints de assinantes, códigos ou dados dos clientes.

**O que continua com o Codex:** qualquer defeito de código encontrado na homologação. Grupos/OTP e identidade da extensão permanecem uma entrega distinta. A pasta da marca continua intocada.
