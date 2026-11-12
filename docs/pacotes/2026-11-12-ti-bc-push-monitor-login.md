# B&C — pacote adicional para TI: Web Push, monitor WhatsApp e orientação de login

**Revisão 2 — substitui o roteiro e o ZIP anteriores desta entrega. Não aplicar a revisão 1.**

Data: 12/11/2026. Autor: Codex. Destinatário: TI/Guardião.
Responde ao dono, que informou não ter enviado novos materiais desde o pedido de notificações push, e ao relatório `relatorio-ti-p120-conferencia-117-prontidao-login-2026-11-12.md` (SHA-256 `82fbd0d014e9b4705eda38d45de374ea81699d15905bbdc13ad75343e7220eef`).

## 1. O que mudou desde o último contato

| Assunto                 | Entrega deste pacote                                                                                                                                                            | Dependência da TI                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Notificações web        | Inscrição voluntária por conta/sessão/aparelho, notificações de criação/alteração/cancelamento de agendamentos e teste próprio.                                                 | Banco, função nova, chaves VAPID, execução periódica e publicação do frontend/SW.                       |
| Saúde do WhatsApp       | Ícone no cabeçalho administrativo, também nas áreas de loja e cliente quando a conta é admin global. Detalhes de desconexão, falha, envio incerto, fila atrasada e pausas.      | RPC nova e função nova de leitura da Evolution.                                                         |
| Confirmação do telefone | Falha `whatsapp_unavailable` deixa de orientar genericamente a conferir o número: explica a necessidade do grupo e oferece o atalho no perfil do cliente quando disponível.     | Publicar frontend; não corrige a preparação do grupo por si só.                                         |
| Tom das mensagens       | Regra editorial natural, cordial e profissional. Cliente final vê o nome da barbearia, sem B&C; marca da plataforma somente na comunicação de gestão com donos/administradores. | Tomar ciência; não instalar aleatoriedade, simulação de digitação ou alterações nos textos cadastrados. |

A nº 117/117b não deve ser reaplicada. A consulta ao GitHub nesta entrega encontrou `origin/main` em `aca86fe` com o primeiro acesso já publicado. O pacote anterior `BC-P120-Primeiro-Acesso-2026-11-12.zip` não precisa ser aplicado novamente se essa entrega estiver presente. Conferir o SHA completo em `BASE.txt`; não presumir que a base continue a mesma depois de novas publicações.

O Codex não fez push, instalação, mudança de flags, criação de grupo nem envio real nesta entrega. A pasta da marca permanece fora do escopo. Este pacote é separado das versões locais parciais nº 113/114 e não as contém.

## 1.1 Decisão posterior do dono: identidade da barbearia para o cliente

Esta revisão foi pedida **antes do envio à TI**. O Codex não enviou material a terceiros. O dono determinou que B&C/Barba & Cabelo não apareça como marca do atendimento dos clientes. Nos grupos, push, convites, descrição, boas-vindas, mensagem fixada e código de acesso, a referência comercial é a barbearia. A plataforma permanece na gestão com donos/administradores.

**Implementado localmente neste pacote:** textos de cliente relativos a grupos, consentimento, acesso, conta compartilhada e push sem marca da plataforma; retirada da atribuição comercial no rodapé da página pública de loja. O push de agendamento usa o nome da barbearia obtido pelo agendamento no servidor, revalidado no momento de enviar. O cliente não escolhe esse nome na requisição. O worker respeita esse título e não força o ícone/logotipo da plataforma. Push de teste sem loja usa identificação neutra (“Agendamentos”), sem inventar uma barbearia. Não há nome pessoal nem código na tela bloqueada.

**Ainda não implementado na extensão de grupos instalada:** o texto do OTP continua contendo `Barba & Cabelo` no patch v2 examinado, e a detecção que impede a persistência/reentrega de OTP também reconhece esse texto. A criação usa título padrão da plataforma. Não corrigir só com troca de string na VPS: isso pode quebrar a filtragem dos códigos e não resolve a associação confiável com a barbearia. Esta revisão não contém atualização da extensão nem migration do contrato de grupos.

Antes de liberar grupos/códigos, a próxima entrega de desenvolvimento precisa:

1. Resolver o nome da barbearia pela relação persistida `grupo → barbearia` no servidor; sem usar nome manual do grupo ou número remetente como identidade. Preservar revalidação, permissões e idempotência.
2. Acrescentar identidade comercial validada ao contrato protegido da extensão, com capacidade/versionamento explícitos e bloqueio quando o runtime antigo não suportar. Não permitir texto arbitrário de OTP fornecido pelo navegador.
3. Compor o código com nome da barbearia e atualizar conjuntamente a proteção de mensagens próprias/citadas, mantendo cobertura de mensagens antigas; demonstrar em testes que nenhum código vai a logs/webhooks/histórico.
4. Aplicar identidade de loja ao título calculado, foto, boas-vindas, descrição e mensagem fixada no ciclo dos grupos já pendente. Não disparar reconciliação ou renomear grupos reais nesta revisão.
5. Validar duas barbearias atendidas pelo mesmo número: nomes corretos por grupo/agendamento, sem vazamento de identidade entre lojas. Conferir também nome/ícone da PWA instalada e entradas públicas sem contexto antes de declarar a experiência inteira sem marca da plataforma. Os metadados globais e o login global ainda têm marca padrão; não estão cobertos por uma afirmação de remoção integral.

A TI pode revisar/instalar o bloco independente de push/monitor conforme este roteiro. **Não considerar esta revisão suficiente para liberar o login em grupos nem afirmar que todas as superfícies de cliente já foram convertidas.** A pendência de contrato/mensagem do grupo continua com desenvolvimento; não enviar nova solicitação ao Claude/Flow. Não apagar identificação jurídica nem renomear identificadores técnicos.

## 2. Conteúdo e conferência antes da instalação

- `alteracoes.patch`: código e documentação desta entrega, sobre `BASE.txt`; inclui novas migrations/funções. Aplicar uma única vez numa cópia de revisão, nunca copiar todo um diretório antigo de funções por cima da produção.
- `arquivos/`: cópias dos arquivos alterados/novos, para inspeção e instalação seletiva. Não é uma cópia completa da aplicação.
- `SHA256SUMS`, `COMMIT.txt`, `VALIDACAO.md` e `evidencias/`: identificação e verificações locais, sem credenciais.
- `comunicacao-notificacoes-2026-11-12.md`: orientação editorial e exemplos.

Conferir `sha256sum -c SHA256SUMS` (ou `shasum -a 256 -c SHA256SUMS`). Na cópia de revisão atualizada, executar `git apply --check alteracoes.patch` antes de aplicar. Se houver divergência, revisar o diff sobre a versão realmente instalada; não usar `--reject`, forçar arquivos nem restaurar uma base antiga. Aplicar e executar `npm run typecheck`, `npm test`, lint dos arquivos alterados e `npm run build`.

A publicação da `main` publica o site. Coordenar a entrega com quem detém a vez; não usar push forçado nem autossave indiscriminado. Fazer backup/identificação da versão anterior e dos arquivos de funções/configuração afetados. Não clicar em Redeploy no Coolify: existe o alerta anterior sobre segredos gravados diretamente nos volumes. Preservar as demais funções, Auth, banco, Evolution e proxies.

## 3. Banco: somente dois arquivos novos

Aplicar em transação, nessa ordem, depois de conferir que ainda não existem as estruturas/funções correspondentes:

1. `supabase/migrations/20261112230000_notificacoes_web_push.sql`.
2. `supabase/migrations/20261112231000_painel_saude_whatsapp.sql`.

Identificar por nome completo e hash. Não foi atribuído número sequencial de operação para evitar colidir com numerações paralelas da TI. Não reaplicar nº 105–117 nem instalar nº 113/114 por causa deste roteiro. As dependências SQL são as tabelas de agendamentos/equipe, Auth com sessões, a saída protegida WhatsApp da nº 105 e `platform_whatsapp_directory()` já existente; o filtro atual do catálogo é respeitado para não reintroduzir o telefone pessoal 4593.

Web Push nasce com `web_push_settings.enabled=false`. Não acumula retroativamente alterações ocorridas enquanto desligado. Tabelas de assinaturas/fila não são acessíveis ao navegador; operações são funções restritas ao serviço. A inscrição vincula o endpoint à conta e à sessão; logout/expiração ou perda de acesso impedem novos envios na revalidação.

A RPC `platform_whatsapp_health_data()` é restrita a administrador autenticado. Consulta apenas números identificados que também constem do catálogo vigente. Não retorna corpo de mensagem, destinatário, QR ou token. É chamada pela Edge depois de verificar o administrador.

Nunca executar `supabase/tests/` na VPS. As suítes incluídas criam dados fictícios e manipulam gatilhos para isolar cenários; destinam-se exclusivamente à bancada descartável.

## 4. Funções: instalação aditiva

Instalar somente:

- `supabase/functions/web-push/index.ts`;
- `supabase/functions/_shared/web-push.ts`;
- `supabase/functions/whatsapp-health/index.ts`;
- `supabase/functions/_shared/whatsapp-health.ts`.

Não substituir `auth-otp`, `whatsapp-groups`, `platform-whatsapp`, `whatsapp-dispatch` nem o `_shared` inteiro. O monitor importa o `_shared/evolution.ts` já instalado, que deve exportar `evolutionFetch`, `corsHeaders` e `json`. Conferir essa compatibilidade e suas dependências sem sobrescrever a versão da TI com uma cópia antiga.

Runtime: as novas funções usam `@supabase/supabase-js@2.49.1` via esm.sh e `web-push@3.6.7` via import npm. A biblioteca web-push é usada apenas para preparar VAPID/cifra; o transporte é `fetch` com timeout e sem seguir redirecionamentos. Foi conferida com Deno 2.2.8 em bancada. Antes de reiniciar o serviço real, conferir o carregamento no mesmo Edge Runtime da instalação e o acesso às dependências; não prometer compatibilidade só porque o Deno local passou.

Verificar o roteamento existente para `/functions/v1/web-push` e `/functions/v1/whatsapp-health`. As funções validam a sessão no Auth; o dispatcher exige exatamente a chave de serviço. Não abrir o dispatcher para anon nem retirar controles do gateway como solução improvisada.

Se necessário, reiniciar somente o container de funções na janela combinada, registrando a indisponibilidade medida. Não reiniciar ou recriar Evolution para instalar este pacote.

## 5. Configuração Web Push

No armazenamento persistente e protegido usado pelas funções, configurar:

| Variável                   | Valor/uso                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WEB_PUSH_ENABLED`         | `false` durante preparação; `true` na ativação validada.                                                                                                     |
| `WEB_PUSH_PUBLIC_KEY`      | Chave pública VAPID, base64url. Pode ser entregue ao navegador pelo endpoint de configuração.                                                                |
| `WEB_PUSH_PRIVATE_KEY`     | Chave privada VAPID, somente backend/cofre.                                                                                                                  |
| `WEB_PUSH_SUBJECT`         | URI de contato operacional válido, por exemplo `mailto:` de um endereço controlado pela plataforma.                                                          |
| `WEB_PUSH_ALLOWED_ORIGINS` | `https://beauty.contheiner.digital,https://*.beauty.contheiner.digital`; adicionar domínios próprios de lojas somente após confirmar controle e necessidade. |

Reutilizar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SERVICE_KEY`) já protegidos. O monitor reutiliza `SUPABASE_ANON_KEY`/`SUPABASE_PUBLISHABLE_KEY` e a configuração Evolution existente (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY` ou `AUTHENTICATION_API_KEY`). Não expor chave de serviço no frontend.

Gerar o par VAPID uma única vez com `web-push@3.6.7`/`generateVAPIDKeys()` em ambiente controlado, salvando diretamente no cofre/arquivo protegido; não colar a chave privada em chat, logs, Git ou relatório. Não usar gerador público de chaves e não gerar um par novo a cada reinício. Não usar variáveis `VITE_` para esses segredos.

Permitir HTTPS de saída para os serviços de push aceitos pelo código (Google, Mozilla, Apple e subdomínios WNS/notify da Microsoft), além das dependências de runtime. A lista restrita evita transformar o endpoint de inscrição em requisições arbitrárias a destinos internos.

Preparar um agendador de servidor a cada minuto, com segredo obtido do cofre/ambiente persistente, sem colocá-lo no texto do cron, URL ou argumento visível. Requisição:

```http
POST /functions/v1/web-push
Authorization: Bearer [chave de serviço obtida do ambiente protegido]
Content-Type: application/json

{"action":"dispatch"}
```

Usar o endereço interno/HTTPS efetivo do gateway na instalação; não presumir nomes de containers. Evitar sobreposição com trava do agendador. Cada chamada reserva até 20 tarefas com `SKIP LOCKED`; revalida cada envio. Configurar timeout suficiente para o lote (até aproximadamente 200 segundos em timeouts sequenciais). `processed` é número de tentativas processadas, não prova de entrega. HTTP 200 com `enabled:false` é pausa, não teste de envio bem-sucedido.

Depois de validar dependências e registrar o agendador, ativar a variável e a configuração SQL:

```sql
begin;
update public.web_push_settings set enabled=true where singleton=true;
commit;
```

Essa ativação é só Web Push: não muda pausas, consentimentos, instâncias ou flags do WhatsApp. Nenhum código de login ou marketing é enviado por Web Push nesta entrega. Usuários ainda precisam optar por receber no próprio navegador/aparelho.

## 6. Frontend, SW e homologação

Publicar o frontend somente com as funções e RPCs disponíveis. Confirmar HTTPS e os arquivos `/sw.js`, `/push-events.js`, manifesto e ícones, todos com conteúdo correto e sem fallback HTML. O push usa o nome da barbearia; o SO ainda pode mostrar o nome/ícone da PWA previamente instalada, o que deve ser conferido antes de declarar a experiência inteira com a marca da loja. O SW gerado importa `/push-events.js`; o build coloca ambos em `.output/public`. Preservar a atualização/instalação PWA existente; não remover outros caches indiscriminadamente.

Acesso: menu da conta do administrador/profissional → **Notificações neste aparelho**; perfil do cliente → mesma seção. Permissão só é solicitada quando o titular clica em **Ativar notificações**. No iPhone/iPad, a tela orienta instalar na tela inicial e abrir pelo ícone; a disponibilidade também depende do sistema/navegador compatível. Nunca alterar manualmente a permissão do usuário.

Homologar com conta de teste e consentimento do titular:

1. Ativar, enviar **um teste** e confirmar visualmente o recebimento. Não basta fila `accepted` ou HTTP 200. Não é necessário ativar WhatsApp para testar push.
2. Criar/alterar/cancelar agendamento fictício em loja de teste e verificar destinatários: cliente, profissional do agendamento e donos/sócios ativos, sem duplicar quem acumula papéis. Parceiro independente recebe apenas o atendimento de que participa, não toda a agenda por ser parceiro. Conta estranha não recebe.
3. Desativar e conferir ausência de novos avisos; trocar/sair da conta e conferir que a assinatura não migra para outra pessoa.
4. Verificar Chrome/Android, navegador de computador e Safari instalado no iPhone/iPad quando houver aparelhos disponíveis. Registrar o que foi realmente testado; a bancada não substitui prova no aparelho físico.
5. No admin, conferir o ícone em plataforma, loja e área de cliente. A leitura é a cada 20 segundos com página visível e ao retornar à aba; cache de conexão de até 15 segundos. Não há WebSocket nem monitoramento garantido com a página fechada. Ausência de atividade não gera alarme; falha da API resulta em situação desconhecida, sem afirmar que todos desconectaram.
6. Conferir que 4593 não reaparece como número da plataforma e que cadastros sem telefone não entram no monitor. Principal 8585 e reserva 5627 permanecem conforme o catálogo; o monitor não liga envio nem reconecta ninguém.

O monitor usa tentativas/fila já registradas no B&C. Não lê chats, não prova bloqueio pela Meta nem detecta evento que nunca foi registrado. Falhas/incertezas têm janela de 24 horas; mensagens pendentes são sinalizadas após 5 minutos, salvo pausa configurada. O indicador conserva a última leitura quando a atualização falha e avisa que pode estar desatualizada. Este pacote não envia push de incidentes ao administrador: o painel operacional é no cabeçalho; Web Push atende aos agendamentos.

## 7. Login Gmail: pendência continua explícita

A conta escolhida já é `alyson21viana@gmail.com`, pessoal DDD 84 final 4593. O administrador continua `alyson@proh.media`, final 5778. Não pedir novamente essa escolha nem transferir o grupo antigo …78e3 para Gmail.

O relatório da TI registrou Gmail sem telefone confirmado/consentimento/adesão/grupo; grupo antigo pertencente ao admin; convite/adesão antigos expirados; 8585 sem extensão/webhook e 5627 com extensão; regras completas de dois admins/ciclo anual/boas-vindas não instaladas. São fatos daquele relatório, não uma leitura nova do servidor feita pelo Codex.

Não reapresentar as flags como desligadas: o relatório diz piloto/adesão/login ligados e pausa global desligada, mas os números da plataforma com envio desabilitado. Não liberar o piloto apenas ligando `enabled`.

A mudança de texto deste pacote orienta o titular a abrir o grupo; **não torna o login real pronto**. A identidade de grupo também precisa atender à seção 1.1. Não há solicitação para renovar convite por corrida de 30 segundos, executar reconcile, enviar código, instalar versões parciais 113/114, ligar extensão em outra instância, migrar/criar grupo ou alterar consentimento. Esses blocos seguem com o desenvolvimento e precisam de entrega própria antes da operação. A TI não precisa repetir toda a conferência já respondida para instalar os dois recursos independentes deste pacote.

## 8. Pausa e retorno

Se houver falha no Web Push: desativar o agendador, `WEB_PUSH_ENABLED=false` e `web_push_settings.enabled=false`. Preservar assinaturas/fila e evidências; não remover tabelas nem apagar outras funções como primeiro recurso. Para evitar avisos antigos ao retomar, cancelar tarefas ainda não iniciadas de forma explícita após avaliar a ocorrência. Tarefas incertas não são reenviadas automaticamente; expiradas saem do fluxo. A fila retém histórico por até sete dias durante processamento e a assinatura expira em 90 dias sem renovação.

Para regressão de interface, restaurar somente a publicação anterior identificada. Para regressão nas funções, retirar do roteamento somente as funções novas/restaurar backup seletivo, sem tocar nas funções WhatsApp existentes. Não executar rollback destrutivo das novas tabelas durante diagnóstico.

## 9. Retorno pedido à TI

Enviar **um relatório consolidado** respondendo a este arquivo, com SHA do pacote/base/publicação, migrations realmente aplicadas, hashes das quatro funções/helpers instalados, compatibilidade de runtime, configuração persistente sem valores secretos, agendador ativo/inativo, indisponibilidade medida, teste recebido por dispositivo, resultado do indicador e pendências do login.

Separar **revisado**, **instalado**, **ativado** e **homologado**. Se só revisar, registrar isso; não declarar Web Push entregue ao usuário nem P-120 concluída. Não incluir tokens, endpoints completos de assinaturas, QR, convites nem códigos.

Referências técnicas: [Microsoft — Web Push em PWA](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/push), [WebKit — push no iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) e [web-push 3.6.7](https://github.com/web-push-libs/web-push/tree/v3.6.7). A entrega real continua sujeita à permissão do titular, às políticas do navegador/SO e à conectividade.
