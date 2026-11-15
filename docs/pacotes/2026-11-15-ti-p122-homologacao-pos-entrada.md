# TI/Guardião — P-122: retomar homologação após entrada

**Pedido do titular: coordenar a continuação do piloto já autorizado, com ele presente. Não é pacote de instalação.** Tudo deve continuar no grupo existente da **Loja Teste**, com a conta cliente já indicada na política e o WhatsApp pessoal final **4593**. A TI coordena; o Guardião mantém operações autenticadas e credenciais sob sua custódia.

## 1. Base confirmada: não instalar novamente

Usar o próprio `RELATORIO-TI-CONSOLIDADO-P122-2026-11-15.md` como referência. O Codex conferiu o ZIP de correções `0aa020671003b7f59631cfbf92f8820eb69e600fbd5ae8323681f3436b4a330d`, conciliou as fontes localmente e reproduziu/aprovou as regressões. Nenhuma entrega de código nova acompanha este roteiro.

- Frontend `e5f3ec0`; 14 incrementais B&C, terceira migration Evolution, 26 dependências Edge e operadores já instalados.
- Acolhimento `20261115001000_whatsapp_acolhimento_apos_entrada.sql` e safeupdate `20261115001000_whatsapp_singletons_safeupdate.sql` **ambos instalados**, apesar do prefixo igual. Não reaplicar, renumerar ou criar ledger.
- Evolution **2.3.7-bc.groups.6-brand.1**, contrato **bc-groups-v4**, **postAdmissionWelcome=true**. Imagem AMD64 fixada: `ghcr.io/proh2026media/bc-evolution-groups@sha256:bb66b337063aa3fb82500642d0e332ff32f94a6a04692d1652b016ca735c9f3e`.
- `_shared/care-group-content.ts` instalado: `189d2f721db7c72bd9d23777e371cbeefdc7a2c3aab7893551270348a38b2e74`; `_shared/care-cycles.ts`: `d815b844befe027af64965865410d8fd901b13dd123d687195d1c4121e0d9b82`. A fonte de conteúdo formatada localmente tem hash diferente só por formatação; usar os hashes instalados nesta conferência.
- Leitura da interface `cycle_contract=bc-groups-v3` é compatibilidade esperada, distinta do protocolo privado v4.

Não repetir D0, publicar main/imagem, aplicar migrations, trocar Edge, usar Redeploy, recriar containers/grupo, refazer pareamento, regenerar segredos ou alterar Web Push/dispatch/Flow. Se a base divergir, registrar a diferença e devolver antes de intervir.

## 2. Combinar a janela com o titular

Enviar ao titular, sem convite ou código:

> Podemos retomar o teste. Você está com o WhatsApp pessoal final 4593 disponível e consegue abrir a conta cliente autorizada da Loja Teste? Deixe a tela Minha conta → Grupos de atendimento aberta e me avise “pronto para entrar”.

O titular pode usar o acesso já funcional por Google/e-mail enquanto o WhatsApp não foi confirmado. Não substituir pela conta admin nem alterar e-mail, telefone, papéis ou vínculos. A matrícula/convite/observações do corte **03:17:41 BRT de 15/11** não devem ser considerados atuais.

A autorização anterior cobre o piloto restrito, em sequência; esta etapa é **somente Loja Teste + cliente já autorizado**. Arena — Testes permanece para a segunda etapa. Não ampliar para outras lojas/clientes, ligar distribuição automática ou os três timers novos. Se o estado atual exigir mudança fora desse piloto, explicar a necessidade antes de executar.

## 3. Conferência atual, sem efeitos de grupo

1. Conferir escopo, flags/políticas, imagem/capacidades e saúde reais. As contas dedicadas finais **8585 e 5627** precisam continuar sob controle exclusivo da plataforma e presentes como administradoras. Não usar o pessoal4593 ou o pessoal do admin como remetentes.
2. Atualizar legitimamente as observações de conexão pelo mesmo fluxo autenticado já usado no piloto; verificar identidade, status aberto e observação recente nas duas contas. O contrato exige conexão observada há menos de dois minutos para os números usados. Não alterar datas/estados diretamente para simular conexão.
3. Identificar o **ciclo existente** vinculado à política e conferir mesmo JID, admissão, datas, números consentidos e preferências. Não criar novo cadastro/ciclo nem mudar a distribuição para obter um convite.
4. Conferir ausência de lease ativo, envio em andamento, operação started/unknown ou alteração de composição não consentida. Resultado incerto precisa de revisão; não apagar nem reenviar por outra conta.
5. Registrar uma linha de base privada: identificadores do grupo/ciclo/admissão, JID, datas, marca/descrição, etapas aceitas, operações, mensagens e preferências. No relatório de retorno, apresentar apenas igualdade/diferenças e contagens, sem dados sensíveis.

Consulta de identificação **somente leitura**, com o acesso de banco que o Guardião já utiliza:

```sql
select enabled, pilot_shop_id, pilot_customer_id, version
from public.whatsapp_care_cycle_policy where singleton;

select c.id as cycle_id, c.state, c.reason,
       c.group_jid is not null as grupo_ja_criado,
       c.admission_id, c.created_at, c.expires_at,
       c.lease_until, g.entry_pending,
       public.care_cycle_send_ready(g.id) as send_ready
from public.whatsapp_care_cycle_policy p
join public.whatsapp_care_groups g
  on g.barbershop_id=p.pilot_shop_id and g.customer_id=p.pilot_customer_id
join public.whatsapp_care_cycles c on c.id=g.current_cycle_id
where p.singleton;
```

Esperado: exatamente o piloto conhecido e seu ciclo aberto. Se o escopo estiver vazio/global, diferente, sem grupo ou encerrado/vencido, parar e devolver o diagnóstico; não cadastrar outro para prosseguir.

## 4. Renovar a janela e disponibilizar o convite

1. Com o titular pronto, atualizar a tela autenticada da conta cliente. Se aparecer matrícula expirada, o próprio titular usa **“Retomar confirmação”**. Esse fluxo chama `care_group_begin` e renova a matrícula do mesmo grupo. Não dar UPDATE manual em matrícula, telefone, admissão, consentimento ou prazo anual.
2. Fazer **uma conferência direcionada ao cycle_id existente**, sob a mesma trava operacional `/run/lock/bc-central-whatsapp.lock`. Não usar o comando genérico de lote `grupos`/`reconcile`, que também pode selecionar outros ciclos ou encerramentos.
3. O contrato já instalado é o seguinte; o Guardião usa sua autenticação interna existente, sem imprimir a chave em terminal/relatório/chat:

```text
POST https://supabase-barbearia.proh.media/functions/v1/whatsapp-groups
Authorization: Bearer <chave interna sob custódia do Guardião>
Content-Type: application/json

{"action":"process","cycle_id":"<UUID do ciclo existente obtido acima>"}
```

A rota existe no handler instalado e valida a política/posse/composição. Substituir apenas o UUID; não inventar parâmetro de usuário, JID ou número. Não enviar action=reconcile, recover ou purge. Não transformar esta chamada em timer ou repetição contínua.

4. Antes da entrada, esperado **waiting_customer**, convite válido na UI e **zero novas mensagens, descrição, pin, código ou criação**. Conteúdo legado da v5 pode estar presente e deve ser preservado, sem confundi-lo com efeito novo. A renovação do convite pode atualizar seu registro/hash/versão conforme o contrato; documentar a diferença, sem exigir imobilidade artificial de todos os contadores.
5. O titular atualiza a tela e toca **Abrir meu grupo**, pelo próprio aparelho/WhatsApp final4593. Não abrir, copiar ou compartilhar o convite em nome dele. Solicita entrada e informa somente **“pedido enviado”**.

Se o convite não aparecer, conferir motivo/validade/composição e a resposta direcionada. Não recriar grupo, forçar send_ready/descriptionHash ou ampliar a janela por edição direta.

## 5. Entrada, acolhimento e provas

1. Ao titular informar o pedido, atualizar as observações legítimas de conexão se necessário e executar a mesma chamada **process para o mesmo ciclo**, serializada. Ela já consulta pedidos e aprova somente o cliente consentido. Não promover o cliente nem aprovar terceiros manualmente.
2. Comprovar presença real do cliente como membro comum e dois ou mais administradores exclusivos da plataforma. O criador não pode enviar a primeira mensagem; outro administrador deve enviar o acolhimento.
3. Conferir nesta ordem lógica: presença do cliente → boas-vindas → descrição/regras → fixação. Mensagem e descrição devem usar o nome da **Loja Teste**, com preferências controladas pelo aplicativo. Sem B&C/Barba & Cabelo na comunicação ao cliente final.
4. Registrar a operação da admissão atual, mensagem aceita, descrição e pin vigentes. Confirmar recebimento técnico por outra conta autorizada e a prova inicial pelo criador. **Aceite do provedor não equivale a leitura/recebimento pelo cliente.** O titular precisa confirmar que viu a nova mensagem e consegue consultar regras/descrição/fixação.
5. Enquanto faltar prova, esperado **waiting_first_receipt/send_ready=false**. Webhook pode faltar, repetir ou chegar fora de ordem. Uma nova conferência direcionada é permitida após evidência nova/pendência de observação, sempre no mesmo ciclo e sem fabricar outra operação. Não reenviar acolhimento para acelerar o teste.
6. Só com prova da **admissão e mensagem atuais**, composição/proteções/pin válidos, esperar **active/send_ready=true**. Se não ocorrer, guardar evidência do bloqueio e devolver; não escrever os campos de prova manualmente.

## 6. Confirmação do telefone e login WhatsApp

1. Com o grupo pronto, o titular pede **um código de confirmação** pela interface da conta cliente. Esperado: somente no grupo correto, com a marca da loja; nada por PV ou grupo de outra barbearia.
2. O titular lê e digita o código exclusivamente na plataforma. TI/Guardião não precisam conhecer seu valor. Comprovar confirmação real de telefone; entrar no grupo sozinho não confirma.
3. Preservar a sessão funcional atual. Abrir janela privada separada para testar o login WhatsApp com o mesmo pessoal4593, no contexto da Loja Teste. Pedir um código, recebê-lo no mesmo grupo e concluir o acesso como a conta cliente esperada.
4. Conferir identidade, papel comum e loja correta após entrar. Não encerrar a única sessão alternativa do titular. Clique/reentrega não pode gerar novo acolhimento ou fallback privado; resultados incertos não são motivo para outro envio por reserva.
5. Respeitar validade/cooldown e não fazer tentativas em sequência. Se confirmação ou login falhar, devolver etapa/estado/erro sem o código e sem trocar telefone/identidade.

## 7. Um aviso de agendamento

Depois de confirmação e login aprovados, combinar com o titular **um agendamento de teste na Loja Teste**, pelo fluxo normal, com notificações consentidas. Conferir uma confirmação esperada no mesmo grupo, nome da loja e destinatário correto; registrar aceite e observação do titular separadamente. Não inserir aviso/recibo manualmente nem disparar marketing, PV ou mensagem livre para substituir o evento real.

Não cancelar/remarcar o agendamento em seguida só para testar mais eventos: isso gera outros avisos. Encaminhar o encerramento desse teste de forma combinada com o titular. Saída/reentrada/encerramento do grupo e Arena — Testes ficam para a sequência acordada, após a primeira etapa passar.

## 8. Se algo falhar / estado ao terminar

Em falha ou resultado incerto, interromper novas transmissões, preservar grupo, JID, operações e preferências. Não limpar filas/diários, repetir criação, trocar de número para reenviar, forçar prova ou restaurar software. Usar a pausa operacional já prevista para o piloto se necessária, registrando a mudança e preservando serviços independentes. Devolver diagnóstico com o ponto exato e evidências mínimas; não improvisar novo hotfix sem necessidade demonstrada.

Ao terminar, registrar estado real de políticas, pausa e timers. Manter o escopo restrito, distribuição automática e os três timers novos desligados. Não ligar cron/automação geral ou avançar à Arena implicitamente. Preservar sessões, dispatch/Web Push e a marca visual. Se o titular se ausentar, encerrar a janela assistida sem deixar um loop de testes funcionando.

## 9. Relatório de retorno

Responder a **2026-11-15-ti-p122-homologacao-pos-entrada.md**, com horários BRT e esta tabela preenchida:

| Etapa                                     | PASS / FALHOU / PENDENTE | Evidência resumida |
| ----------------------------------------- | ------------------------ | ------------------ |
| Base/escopo/duas contas atuais            |                          |                    |
| Matrícula/convite renovados legitimamente |                          |                    |
| Antes da entrada sem novos efeitos        |                          |                    |
| Pedido e presença do cliente comum        |                          |                    |
| Acolhimento após entrada por outro admin  |                          |                    |
| Descrição e pin após entrada              |                          |                    |
| Prova técnica da admissão atual           |                          |                    |
| Mensagem vista pelo titular               |                          |                    |
| Confirmação do telefone                   |                          |                    |
| Login WhatsApp e identidade correta       |                          |                    |
| Aviso único de agendamento no grupo       |                          |                    |
| Estado final de políticas/pausa/timers    |                          |                    |

Informar preservação do mesmo grupo/JID, ciclo, admissão, ano, consentimentos e preferências; contagens antes/depois; operações novas esperadas e quaisquer diferenças; erro exato sanitizado e ação interrompida quando houver falha. Diferenciar legado da v5, efeitos novos e manutenção legítima do convite. Registrar Arena/retorno/encerramento como não executados nesta janela, se for o caso.

**Não incluir convite, QR, OTP, token, ambiente, telefone completo, JID ou dump no relatório. Não declarar homologação completa se qualquer etapa estiver pendente.**
