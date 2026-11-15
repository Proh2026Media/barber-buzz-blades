# P-122 — primeiro acesso assistido, somente local

**15/11/2026. Desenvolvimento e ensaio locais; nenhuma instalação, publicação ou liberação do piloto.** Este documento não autoriza a TI a operar o servidor. O último corte remoto continua sendo o relatório 2, às 15:00:34 BRT: pausa global ligada, ciclos/distribuição desligados e timers novos desligados.

## O que ficou estabelecido após o retorno da TI

1. **Já instalado pela TI:** Central/14 incrementais de 13–14/11, acolhimento pós-entrada, correção safeupdate, comparação canônica da marca e frontend `e5f3ec0`. Evolution instalada `2.3.7-bc.groups.6-brand.1`, contrato privado v4. Não reaplicar essas entregas, refazer D0 ou trocar a imagem por causa deste incremento.
2. **Piloto real não concluído:** cliente fora do grupo e matrícula vencida no corte. Há variante de telefone divergente da informada pelo titular, sem prova de alias. As observações antigas bloquearam tentativas anteriores; o código/status do último clique não foi capturado. Não atribuir todos os erros à mesma causa.
3. **Correção local anterior:** erros separados por operação, diagnóstico sanitizado, bloqueio de retomada/convite/código sob indisponibilidade. Não foi publicada.
4. **Trabalho desta rodada:** automatizar a conferência live e o acompanhamento do primeiro acesso, preservando os gates instalados. Desenvolvimento é responsabilidade do Codex; a TI não precisa inventar essa lógica no servidor.
5. **Atualização da mesma data:** revisão coordenada concluída e ensaiada nas duas camadas, incorporando esta automação. Ver [entrega integrada atual](2026-11-15-p122-telefone-concluido-local.md). A ausência de alteração de identidade nesta etapa isolada permanece registrada como histórico, sem afirmar uma pendência atual.

## Jornada implementada localmente

| Pessoa                                                                                | Aplicativo/servidor                                                                                                             |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Entra por Google ou e-mail/senha, confere o telefone e aceita os números apresentados | Abre uma intenção autenticada com prazo fixo de 20 minutos; não confirma o telefone                                             |
| Toca em criar/continuar                                                               | Consulta a Evolution e registra observações reais **somente** dos números consentidos, com identidade e versão atuais           |
| Aguarda o convite na própria página                                                   | Usa `care_group_begin` original **depois** da prova live; prepara o mesmo ciclo pelo motor durável instalado                    |
| Abre o convite, solicita entrada no WhatsApp e volta ao aplicativo                    | Acompanha a página visível a cada 10 segundos e ao recuperar foco, sujeito ao intervalo/posse no banco                          |
| Aguarda a conferência de entrada                                                      | Motor confere o pedido real; cliente entra como comum. Outro administrador acolhe, escreve a descrição e fixa depois da entrada |
| Toca em receber código, lê no grupo e confirma no aplicativo                          | Libera o botão só após prontidão/prova do acolhimento atual; usa o OTP existente, sem reenvio automático                        |

O convite é buscado imediatamente quando disponível; não exige clicar em “Obter convite” ou aguardar o primeiro intervalo de cinco segundos. A página mostra **Preparar → Entrar → Confirmar**, o número utilizado e uma ação principal por etapa. Textos repetidos e a consulta manual concorrente foram retirados do caminho assistido; recuperação explícita permanece nos avisos de erro. Números consentidos continuam visíveis antes do aceite. Preferências ficam recolhidas.

Acompanhamento automático depende de página visível, sessão válida, intenção vigente e políticas liberadas. Não é processamento offline nem promessa de execução com o navegador fechado. O motor/timers existentes permanecem independentes. Não há SLA medido em produção; o tempo de entrada do cliente, respostas do WhatsApp e provas de recebimento continuam variáveis.

## Contratos e proteção

- Nova migration **`20261115002000_whatsapp_primeiro_acesso_assistido.sql`**. Instalação futura exige pausa, ciclos desligados, ausência de posse em andamento e hashes exatos das funções de leitura/acolhimento. Testado preservar OID, dono e ACL da leitura original. Não editar nem reaplicar os SQLs já instalados.
- Nova Edge **`whatsapp-group-access`**, com JWT validado por `auth.getUser`. Navegador informa loja/intenção/aceite; não escolhe ciclo, instância, identidade de provedor ou posse de worker.
- Tabela privada de intenções, sem leitura/escrita direta para cliente ou `service_role`. Contratos internos delimitam titular/loja, prazo, perfil, composição, ciclo/admissão, posse de dois minutos e intervalo mínimo entre chamadas. Duas abas compartilham o mesmo controle.
- Nenhuma chave nova. Reutiliza URL/chaves e configuração Evolution já disponíveis no backend. Nenhum segredo segue para o navegador ou diagnóstico.
- `assisted_access_enabled=false` por padrão. O contrato `bc-assisted-v1` só aparece disponível se a política própria e a de grupos permitirem. A interface mantém compatibilidade com backend anterior/flag desligada; não simula prontidão.
- Ativação futura usa `care_access_admin(boolean,bigint)`: administrador global autenticado e versão esperada. Não liga o piloto, a distribuição, timers ou o controle global. Pausa global interrompe novas execuções e é refletida na leitura.
- A consulta live usa a rota administrativa de instâncias e PN comprovado pelo provedor; LID sem prova, duplicidade ou telefone diferente não renovam conexão aberta. Falha de rede não vira desconexão/banimento nem prolonga observação antiga. Nunca chama o operador de distribuição para apenas observar conexões.
- O contrato original conserva os gates live. Antes de cada efeito, o motor revalida posse, revisão, identidade, composição e pausa. A automação não muda destinatário, preferências, marketing, anualidade, JID ou números de envio.
- Repetir clique não estende automaticamente o prazo; polling não cria nova intenção, renova matrícula a cada chamada ou envia OTP. Timeout/criação incerta preservam o diário e não concedem segunda criação. Troca de sessão/perfil, composição, admissão ou política invalida a intenção.
- Antes da entrada: nome, foto, administradores, controles e convite. Depois: acolhimento pelo segundo administrador, descrição/pin e provas. Cliente nunca administrador; profissionais sem acesso; sem fallback privado. Marca do cliente continua a da barbearia.

## Verificação local

- Suite geral: **650 testes**; checagem de tipos, lint, formatação e montagem.
- Bancada PostgreSQL descartável: **36 verificações** da intenção/permissões/CAS/pausa/expiração/identidade, além das regressões da cadeia de instalação e safeupdate. Migração conserva exatamente a identidade/permissões da leitura.
- Ensaio integrado: PostgreSQL B&C real + motor Evolution local `6-brand.1`, socket fictício. Conexão antiga → conferência real simulada → preparação/convite → entrada → acolhimento/provas → OTP explícito no mesmo grupo → consumo. Chamadas sobrepostas compartilham posse; uma só criação, prazo preservado, sem repetição de acolhimento.
- Navegador Chromium, sessão/API fictícias e rede externa bloqueada: **45 composições** (três cantos × 320/390/768/1024/1440 px × três etapas), toque/teclado, aceite, convite, foco/retorno, código explícito e parada após confirmar. Regressão de indisponibilidade/diagnóstico verificada separadamente. Não equivale a teste físico do iPhone ou piloto real.

Reproduzir somente na bancada descartável local:

```sh
python3 scripts/testar-primeiro-acesso-assistido.py --preparar
node --import /tmp/bc-evolution-pos-entrada-20261115/node_modules/tsx/dist/loader.mjs scripts/testar-primeiro-acesso-integrado.mts /tmp/bc-evolution-pos-entrada-20261115
npm run test
npm run typecheck
```

A preparação reconstrói exclusivamente `barba-central-d1-local`; exige Docker Unix local e recusa `DOCKER_HOST`. O ensaio integrado exige bancada recém-preparada. Interfaces usam `scripts/testar-primeiro-acesso-interface.mjs` e `scripts/testar-p122-feedback-interface.mjs` com Vite local na porta 8091 e sem montagem simultânea.

## O que fica com a TI e o que ainda fica com o Codex

**Etapa isolada incorporada à entrega completa de telefone.** Consultar o [roteiro TI atual](2026-11-15-ti-primeiro-acesso-telefone-p122.md) e o resultado integrado. Nenhuma operação de produção está autorizada por este documento; o roteiro antigo continua suspenso.

**Codex:** revisão/recuperação integradas e testadas localmente. A entrega unificada inclui código e material operacional pronto; nenhum desenvolvimento é delegado à TI.

**TI, depois desse pacote e da janela autorizada:** conferir a base real e os hashes; aplicar somente o incremental aprovado; instalar a nova função/frontend conforme o roteiro; manter o piloto restrito e comprovar telefone/entrada/acolhimento/confirmar/login/agendamento no caso consentido. A entrega integrada exige imagem7 e não exige migration Evolution ou mudança de webhook. A afirmação anterior se referia somente à automação isolada. Sem SQL manual de telefone, novo grupo para contornar, Redeploy Coolify, reenvio de código ou reativação indiscriminada.

Brand kit, Flow, `.env`, servidores e WhatsApp reais não foram tocados.
