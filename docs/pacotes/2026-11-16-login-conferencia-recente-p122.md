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
