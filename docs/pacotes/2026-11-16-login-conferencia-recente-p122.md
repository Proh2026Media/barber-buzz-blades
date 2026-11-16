# P-122 — login com conferência recente dos números

## Evidência e causa

Consulta de16/11/2026 confirmou telefone verificado às15:21:18BRT, grupo/ciclo active/verified, controles válidos, alias verificado e mesma identidade física. Pedido de login de15:37:21BRT usou o número confirmado, mas não ganhou rota nem tentativa de envio. Não é evidência de falha de entrega da Meta/Evolution: não houve transmissão desse código.

Causa comprovada: care_cycle_send_ready=false/care_cycle_available=false por conexão envelhecida; as mesmas verificações com p_live=false eram verdadeiras. Alias, acolhimento, recibo e fixação estavam válidos. A primeira entrada deixa de renovar status depois de terminar; o login exigia observação recente sem atualizá-la antes de escolher a rota. A janela de dois minutos não foi ampliada.

## Correção local pronta

Uma SQL nova `20261116003000_whatsapp_login_conferencia_recente.sql` e três fontes compartilhadas: nova `_shared/whatsapp-login-preflight.ts`, alteradas `_shared/whatsapp-group-login.ts` e `_shared/evolution.ts`. Nenhuma interface, imagem Evolution, configuração de ambiente ou timer novo.

Quando o contexto do código não está pronto, o serviço pede ao banco um preflight limitado ao desafio de login já criado, não consumido, dentro do prazo, telefone pessoal confirmado e grupo ativo consentido. Usa o mapeamento autoritativo já confirmado; não altera telefone ou grupo, cria desafio ou gera código nessa conferência. Consulta a Evolution uma vez, grava somente os números selecionados pelo banco com identidade e versão conferidas e anexa a rota ao mesmo desafio. Antes do envio, relê o contexto original e conserva inspeção real do grupo, capacidades, dois administradores, autorização atômica e diário. Sem envio privado, rotação, reenvio após incerteza ou renovação de consentimento.

A conclusão exige mesma composição/versão/grupo/ciclo/admissão, duas conexões reais recentes e o contrato de prontidão original. Pausa, restrição, desconhecido, troca de identidade, desafio expirado/consumido ou mudança durante a rede impedem a rota. As novas APIs são só service_role; os auxiliares de elegibilidade não são expostos. Resposta pública continua sem revelar conta cadastrada.

## Validação

725 testes, tipos, lint, formatação e montagem aprovados. Dezesseis testes focados de transporte/preflight incluídos no total. Banco Docker limpo, sem dados reais: 22 verificações SQL, reproduzindo a solicitação real sem rota com observação antiga e sua recuperação; 96 regressões de piloto/telefone/acompanhamento; instalação atômica preservou todos os OIDs/owners/ACLs/corpos dos contratos anteriores e a política, com rollback integral. Funções-base e hashes das duas fontes instaladas coincidem com a versão usada na implementação.

## Implantação pendente de autorização

Somente consultas foram feitas no servidor nesta entrega. A autorização anterior abrangia imagem7-entry.4 e interface; a nova SQL não fazia parte dela. Nenhuma publicação/instalação desta correção foi realizada. Telefone confirmado, grupo e piloto permanecem como estavam. Não usar “Conferir liberação” manualmente como solução permanente nem pedir novo cadastro/grupo/retomada ao cliente.

O Codex consegue instalar após autorização específica. A TI não precisa desenvolver ou diagnosticar novamente.

## Procedimento preparado

1. Pela sessão real do admin, pausar o piloto; conferir pausa global=true, ciclos/assistência=false, isolamento durável e par Loja Teste/Alyson Gmail intactos. Não fabricar JWT ou renovar intenção. Aguardar leases e transmissões ativas terminarem. Preservar distribuição e três timers antigos desligados.
2. VPS: fontes em `/data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn/volumes/functions`; container de banco `supabase-db-z2dbb7dkyzhc8vjiywq34mhn`; container Edge `supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn`. Criar pasta privada root0700 para a janela e backup completo pg_dump -Fc, validado com pg_restore --list. Copiar fontes anteriores e conferir os hashes do MANIFESTO antes de alterar. Não usar Redeploy no Coolify, não imprimir segredos.
3. Ensaiar a SQL nova em BEGIN/ROLLBACK, depois instalar em transação única com psql -X -v ON_ERROR_STOP=1. A SQL valida as duas funções-base exatas e cria somente quatro funções novas; não modifica contratos anteriores, políticas ou dados. Confirmar permissões somente do serviço e ausência de efeitos nos registros existentes. Não reaplicar migrations anteriores.
4. Copiar atomicamente somente as três fontes do pacote, conferir SHA-256, reiniciar somente o container Edge uma vez. Confirmar importação/prontidão por OPTIONS de auth-otp e chamada privada whatsapp_login_preflight com UUID inexistente, que deve retornar null sem criar desafio ou enviar código. Banco/Auth/proxy/Evolution permanecem intocados.
5. Reativar somente o piloto Loja Teste/Alyson Gmail pela sessão real do admin após conferir os dois números. Confirmar persistência, isolamento e timers. Não solicitar código pelo usuário. O titular faz uma nova solicitação no login; a solicitação anterior não deve ser reenviada, pois o código não é recuperável a partir do hash. Conferir rota/estado sem ler código ou token. Login só fica homologado após validação real e abertura de sessão.
6. Se falhar: manter pausa e preservar diário. Restaurar somente as duas fontes antigas por hash e reiniciar Edge, se necessário; a fonte nova pode permanecer sem uso. Não restaurar um dump sobre o banco em uso, apagar desafios ou desfazer a confirmação do telefone. As funções SQL novas podem permanecer sem uso; eventual remoção exige revisão própria.

## Implantação autorizada concluída em16/11

Titular autorizou explicitamente uma SQL e três fontes, restart exclusivo das funções e teste somente Loja Teste. Pausa realizada pela sessão real do admin. Backup completo validado em `/root/bc-login-conferencia-20261116-c37afbe/antes.dump`, SHA-256 `c7820cb37c695d08a343aea623c22e1145528a0ac78b099b1df819861df0cf51`. SQL SHA-256 `f5a9b3dfa1dd32a0536d894e9df898d2644feaa7e36249a1f6ebe06017fc1fa7` ensaiada com rollback e aplicada em transação única. OIDs/owners/ACLs/corpos de todos os contratos anteriores, política, identidades e telefones preservados. Três fontes instaladas e conferidas por hash; fontes antigas e inspeção guardadas na mesma pasta privada.

Somente Edge reiniciada, StartedAt18:58:35UTC. A inspeção inicial comparou a ordem dos mounts e interrompeu a verificação; conferência canônica de todos os campos confirmou os mesmos quatro mounts, mesmo ID/container/configuração/env, sem precisar reiniciar novamente. Prontidão comprovada19:00:13UTC: OPTIONS auth-otp200 e RPC privado com desafio inexistente=null. Essa janela não mediu a duração exata da indisponibilidade; não converter o horário do StartedAt em promessa de tempo fora do ar. Nenhum OTP/desafio/grupo novo pelo instalador. Evolution/banco/Auth/proxy e configurações existentes preservados.

Depois de conferir os dois números, o teste foi reativado pela sessão real de admin para Loja Teste/Alyson Gmail. Não repetir instalação ou pedir à TI outro desenvolvimento. Aguardando teste real de login do titular após a recência expirar naturalmente, sem depender de nova conferência administrativa. Telefone confirmado e grupo ativo continuam preservados; sessão real por WhatsApp só fica homologada após código validado pelo titular e evidência de abertura de sessão.

## Corte após liberação e condição fria

Às16:02:23BRT, política33: pausa=false, piloto/background=true, isolamento=true, somente Loja Teste/Alyson Gmail, outras lojas/clientes recusados, distribuição=false, rotina nova ativa e três timers antigos inativos.

Às16:04:12BRT, sem alterar timestamps ou estender prazos, as duas observações expiraram naturalmente: ready=false, recent_numbers=0 e preflight_eligible=true. O estado que falhava foi reproduzido em produção após a instalação, preservando a exigência de nova leitura real. Titular recebeu pedido para uma nova solicitação no login e confirmação do resultado, sem compartilhar código. Não homologar recebimento/sessão apenas com essa elegibilidade; aguardar nova rota/tentativa e consumo real.
