# P-122 — conferir os números sem trocar de tela

**Entrega local pronta para revisão. Ainda não instalada ou publicada.** O pedido autoriza desenvolver a conferência automática. A nova SQL precisa de autorização própria para produção. Não ativar o piloto como parte da instalação.

## Resultado implementado

Um clique em **Conferir liberação** executa:

1. Consulta administrativa sem argumentos: obtém o escopo já autorizado e os números da composição atual do atendimento. Não recebe loja, cliente ou instância escolhidos pelo navegador. Composição inclui a conta criadora histórica quando aplicável; não trunca reservas nem ignora números exigidos pelas regras.
2. Confere somente essas contas usando a função **platform-whatsapp já instalada**, com `action=status` e `channel_id`. Sem method/phone/QR, connect, logout, grupos ou mensagens. Máximo de quatro consultas em paralelo; sem repetição automática, prazo total de 30s. Exige retorno da conta exata, aberta, telefone idêntico ao plano e gravação CAS aceita pelo endpoint existente.
3. Relê a prontidão. Escopo, identidade, composição, ciclo ou versões alterados invalidam o resultado. O resultado continua bloqueado se qualquer outro requisito de segurança falhar.
4. Mostra pendência em amarelo ou preparação concluída. **Liberar teste** continua separado, com confirmação e o contrato atômico original. A conferência não habilita enrollment, assistência, distribuição, timers ou envios. Carregar o painel não dispara verificações na Evolution.

A política existente permanece **Loja Teste → Alyson Viana**. O código não troca a política, não aceita alvos externos e não amplia o piloto para outras barbearias. Números compartilhados podem ter a observação real renovada; isso não concede licença de envio a outros destinos.

## Arquivos e compatibilidade

- Uma SQL nova: `supabase/migrations/20261116001000_whatsapp_conferencia_piloto.sql`.
- Uma RPC nova, `care_pilot_connection_check()`: leitura, SECURITY DEFINER, search_path fixo e autorização platform_admin no servidor. EXECUTE somente a authenticated; clientes autenticados comuns, anon e service_role não recebem o plano. Preserva as quatro definições/OIDs/owners/ACLs existentes conferidas no contrato.
- Frontend: `CarePilotRelease`, orquestração `pilot-check.ts`, tipagem da RPC e dicionários pt-BR/pt-PT/en-US/es; en-GB herda. Sem dependência ou variável nova.
- A função Edge instalada em 16/11, hash `5eefc86c22d752f95b2ded0727972885f7abeb5b2dcfea883171435b67f6914a`, é reutilizada. **Nenhuma Edge será instalada/reiniciada.** Nenhuma mudança de imagem ou migration Evolution.

Não instalar novamente SQL04000, a correção CHANNEL_RESERVED ou os pacotes anteriores. Referências e testes no ZIP não são instruções de instalação.

## Verificações realizadas

- `scripts/verificar.sh`: tipos, **695 testes** (669 anteriores + 26 da orquestração), lint, formatação e montagem aprovados.
- **19 verificações SQL**, mais a confirmação de rollback: escopo server-side, somente contas autorizadas, permissões, versão antiga, identidade divergente, relógio vencido, observação renovada, ausência de ativação e trocas de loja/cliente. PostgreSQL descartável local com dados fictícios; nada em produção.
- Integração da interface: clique consulta os dois números, repete a leitura, não ativa; abrir/cancelar confirmação não ativa; falha, demora e recuperação. **45 composições**, três cantos e larguras320/390/768/1024/1440. Rede e sessão simuladas; screenshot390 inspecionada. Isso não é homologação física do iPhone nem teste real do WhatsApp.
- Operador real em outro banco descartável: conferência não instala, autorização obrigatória, dump privado validado, instalação atômica, pós-condições, OIDs/owners/ACLs e identidades preservados, reaplicação e hash adulterado recusados. Clone removido; sem mudar papéis do servidor.

## Instalação futura — autorização ainda pendente

1. Usar o ZIP exato e conferir `SHA256SUMS`, manifesto e `COMMIT.txt`. Preservar o frontend publicado até a SQL nova estar instalada.
2. Manter pausa global ligada, piloto/enrollment/assistência/distribuição desligados e timers de grupos/distribuição/expurgo inactive/disabled. Não mudar timers. Se algum controle estiver ligado ou houver envio/lease/incerto em curso, parar e combinar janela; não limpar filas para liberar.
3. Na VPS, em pasta privada extraída, conferir:

   ```bash
   python3 operacao/conferencia_piloto_operacao.py conferir --pacote "$PWD"
   ```

   Operador verifica a imagem Evolution7 já fixada, as definições/proprietários/ACLs exatas e a pausa. Não toca a Evolution. Se disser que já está instalado, não reaplicar.

4. Somente com autorização explícita para esta SQL, executar:

   ```bash
   python3 operacao/conferencia_piloto_operacao.py instalar --pacote "$PWD" --backup /root/bc-p122-conferencia-20261116/backup-antes --autorizado
   ```

   A pasta de backup deve ser nova. O operador faz pg_dump completo privado, valida o catálogo via pg_restore --list, instala uma SQL sob transação/travas, confere definições novas e preservação das antigas e das identidades/controles. `NOTIFY pgrst` atualiza o esquema. **Sem restart, Redeploy ou alteração de segredos.** Não copiar backup para o chat/repositório.

5. Publicar o frontend verificado pela origem, nunca somente pelo espelho e sem force-push. O patch tem base registrada; não aplicar sobre versão divergente sem reconciliação. Não enviar `.env` ou `node_modules`.
6. Conferir módulo público e estado do servidor. Titular atualiza o site, entra como admin se a sessão tiver expirado e clica **Conferir liberação** uma vez. Os dois números devem ser conferidos sem navegar a outra tela; o piloto continua pausado. Não clicar Liberar teste nem enviar código como parte desta implantação.

## Retorno e limites

Antes de uma aplicação nova, erros transacionais não instalam parcialmente a RPC. Depois de sucesso, manter pausado e investigar sem restaurar dump cegamente. Se precisar voltar a interface, usar apenas a versão anterior compatível; a RPC nova de leitura pode permanecer sem ser usada. Não remover guardas, dados, grupos ou números para contornar falha. Qualquer remoção da RPC instalada é outra alteração autorizada e deve ser coordenada com o frontend.

A aprovação para instalar esta melhoria não aprova grupo, mensagem, OTP, timers, distribuição ou ativação de piloto. O teste real de confirmação/login permanece etapa separada.
