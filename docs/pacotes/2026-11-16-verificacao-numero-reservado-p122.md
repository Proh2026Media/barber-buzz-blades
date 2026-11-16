# P-122 — verificação administrativa do número reservado

**Já instalado e publicado com autorização:** ver [devolutiva final](2026-11-16-codex-verificacao-reservado-instalada.md). As instruções abaixo registram o plano anterior; não executar de novo.

Estado: correção local, sem publicação ou instalação. Não ativa piloto ou envios.

## Diagnóstico comprovado

As fotos do titular mostram CHANNEL_RESERVED ao verificar o final8585. A função local e a instalada têm o mesmo hash de base `2ef7a1fb947cad0e381ca7b23e88e4d49318982234ba1e0c1372d4eda0d91b0c`. A proteção da instância definida em PLATFORM_EVOLUTION_INSTANCE rejeitava também a leitura quando o cadastro tinha destino de loja/profissional. O preflight do diálogo convertia esse erro em mensagem enganosa de suporte a código ausente. Não há prova de queda ou bloqueio WhatsApp pelas fotos.

## Alteração pronta para revisão

- Admin autenticado pode consultar status sem method de pareamento. Autorização continua no servidor; número pessoal continua bloqueado.
- Para número identificado, exige telefone real retornado pela Evolution, não o telefone armazenado como fallback, e grava observação pela RPC existente record_whatsapp_distribution_connection com identidade e routing_version. Divergência, identidade ausente e versão rejeitada não viram prova recente.
- Consultar não cria instância, não conecta, não desconecta, não troca telefone, não despausa, não envia nem acessa grupos. Cadastro ainda sem telefone conserva o fluxo anterior.
- A trava da instância reservada permanece para QR, connect, pairing-status, restart-pairing e logout. Operações excepcionais continuam exigindo seu próprio fluxo operacional.
- Frontend traduz a proteção e não diz que falta habilitar código no servidor quando recebe CHANNEL_RESERVED.

Função nova: SHA-256 `5eefc86c22d752f95b2ded0727972885f7abeb5b2dcfea883171435b67f6914a`. Nenhuma SQL, variável de ambiente ou dependência nova; usa RPC já instalada. Não mudar PLATFORM_EVOLUTION_INSTANCE para contornar a proteção. Não reutilizar instaladores completos anteriores.

## Janela futura — ainda não autorizada

1. Sincronizar fonte exata e conferir hashes. Conferir somente por leitura as pausas, políticas e timers; preservar o estado e não iniciar envio, piloto ou distribuição.
2. Identificar o bind mount real do container supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn. Comparar a função instalada com o hash de base acima; se divergir, interromper e reconciliar, nunca sobrescrever versão desconhecida.
3. Guardar cópia privada integral da função anterior, hash e permissões. Instalar atomicamente somente platform-whatsapp/index.ts, preservando permissões. Não tocar segredos, outras funções ou Compose.
4. Reiniciar somente esse container Edge, com autorização específica e aviso de breve indisponibilidade das funções. Medir até prontidão. Não Redeploy Coolify, não reiniciar banco/API/proxy/Evolution ou VPS.
5. Conferir hash/saúde e controles. Publicar o frontend somente pela origem, sincronizado com essa instalação. Retorno: restaurar só a cópia validada da função e reiniciar apenas Edge; não restaurar banco ou pacote inteiro.
6. Titular usa Verificar nos finais8585 e5627. Aceite: telefone comprovado, estado real e observação recente; sem QR/criação/logout/envio. Depois Conferir liberação deve reconhecer as observações dentro de dois minutos. Não liberar teste automaticamente. Homologação de grupo/código/login ainda é outra etapa.

## Verificação local

scripts/verificar.sh concluído com tudo ok: tipos, 669 testes (zero falhas), lint, formatação e montagem. Handlers reais executados em memória, sem rede/credenciais. Cobertura inclui admin/dono, instância correta, leitura reservada, operações mutantes bloqueadas, identidade divergente/ausente, CAS recusado e tradução do erro. Não afirmar homologação de WhatsApp real com base nesses testes.
