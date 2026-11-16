# P-122 — verificação de número reservado instalada

Implantação concluída em 16/11/2026 pelo Codex, com autorização explícita do titular para instalar a função, publicar a interface e manter piloto/envios desligados. **Não reinstalar o pacote ou refazer pareamento por causa do erro antigo CHANNEL_RESERVED.**

## O que foi aplicado

Fonte funcional `06e0d9c0dbe5eb8874a5e672db982abd482e6eb8`, confirmada na origem e no espelho. Uma função: platform-whatsapp/index.ts, SHA-256 `5eefc86c22d752f95b2ded0727972885f7abeb5b2dcfea883171435b67f6914a`. Backend instalado às01:18 BRT; novo módulo da interface servido e conferido às01:23:14 BRT. Sem SQL, variável, segredo, dependência, imagem ou atualização da Evolution.

O admin pode verificar a conexão reservada sem iniciar pareamento. A observação exige identidade live e CAS da versão, pela RPC existente. QR/conexão/desconexão da instância reservada continuam sujeitos à proteção. Interface traduz a proteção e distingue falha do preflight de suporte ao código ausente.

## Backup e prontidão

Pasta privada na VPS: `/root/bc-p122-reservado-20261116-06e0d9c/`. Contém `index-antes.ts`, `antes.json`, `index-instalado.ts`, `resultado.json` e `final.json`. Hash da cópia anterior: `2ef7a1fb947cad0e381ca7b23e88e4d49318982234ba1e0c1372d4eda0d91b0c`. Permissões preservadas; substituição atômica.

Somente o container Edge foi reiniciado. 8,245s do início do restart até OPTIONS200 interno; isso mede essa prontidão, não uma garantia de disponibilidade de todos os fluxos. O ID do container Edge foi preservado; demais IDs/StartedAt não mudaram. Nenhum Restart/Redeploy Coolify, reinício de banco/API/proxy/Evolution ou VPS.

## Estado final e limites

Pausa global=true; ciclos=false; assistência=false; distribuição=false; três timers de grupos/distribuição/expurgo inactive/disabled; leases/sending/incertos0. Sem grupo criado, mensagem, código, reconexão ou ativação de piloto. A única alteração operacional de banco possível pelo novo botão será o registro da consulta real feita pelo titular; nenhuma observação foi inventada para liberar o teste.

Tipos, 669 testes, lint, formatação e montagem locais passaram. Handler em memória cobre identidade, versão, permissão e ações reservadas bloqueadas. Backend/hash/prontidão e módulos públicos conferidos. Na sessão já aberta do navegador do computador, o painel informou sessão expirada; não foram lidas/exportadas credenciais nem fabricado JWT, e não houve homologação autenticada dos números pelo Codex.

## Próximo passo do titular

Atualizar a página; se houver aviso de sessão expirada, entrar novamente no B&C. Em WhatsApp → Números, abrir os finais8585 e5627 e usar **Verificar** em cada um. Se ambos confirmarem conexão, voltar em seguida a Grupos de atendimento → Teste de WhatsApp → Conferir liberação, dentro dos dois minutos. Não usar QR/código para corrigir somente a consulta. Não liberar teste ou enviar OTP automaticamente; a janela de grupo/login real ainda é separada.

A TI não tem instalação pendente desta correção. Manter timers e piloto desligados. Futuro retorno, se necessário: validar a cópia privada, restaurar somente esta função e reiniciar apenas Edge em janela autorizada; nunca restaurar banco ou pacotes anteriores inteiros.
