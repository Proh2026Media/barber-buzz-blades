# P-122 — imagem da Loja Teste B e preparação do grupo

## Causa confirmada

O titular iniciou o pedido em18/11 às00:02:13 BRT. O telefone já estava confirmado, mas o grupo permaneceu como solicitação registrada. Acompanhamento apontava review; ciclo paused/preparation_required, sem creation_issued_at e sem etapas no provedor. Não era espera normal nem falha de confirmação do telefone.

Na preparação anterior, o Codex havia copiado somente a URL da foto autorizada da Loja Teste para B. `loadCareGroupLogo` exige caminho `barbershop-logos/<ID_DA_PROPRIA_LOJA>/logo-...`; a rejeição da pasta A para contexto B estava correta. O HTTP200 registrado antes foi uma verificação insuficiente. Não afrouxar essa proteção.

## Correção operacional concluída

Com a autorização já recebida para reutilizar a mesma imagem fictícia, o Codex copiou os bytes pela API oficial de Storage para a pasta B e atualizou apenas a referência B, conferindo o valor anterior. Arquivo17738bytes, SHA-256 `768c7189cdd9bee5e9d395fd9ae2c12c8b321658a75f98d8c8af960bc1f26b07`, igual à origem. A primeira consulta a objeto ainda ausente retornou400 nesta versão do Storage; o operador parou sem mutação, depois confirmou existência no catálogo antes de copiar. Não houve sobrescrita de objeto ou nova imagem.

Credencial de serviço usada apenas na memória da VPS, sem exportação ou valor em logs. Nenhuma configuração de envio/piloto, fonte, migration, restart, número ou prazo foi alterado. Não se fabricou sessão de cliente. A pasta da marca não foi tocada.

## Evidência da retomada normal

Mesmo grupo B `40c3f11b-4430-4d96-a79c-619b09baef50` e ciclo `4f6377b4-7ccc-4872-9913-d03dfde92a09` preservados. Rotina já instalada retomou o pedido consentido:

- `create`: início00:16:54.725; accepted00:16:57.202 BRT.
- `prepare`: início00:16:57.387; accepted00:17:00.815 BRT.
- Cerca6,1segundos do início efetivo da criação à preparação concluída. É uma execução; não uma média ou o tempo completo até código/login. O período anterior de falha de configuração não deve ser omitido da duração vivida pelo titular.
- Estado posterior waiting_customer/customer_absent, prepared=true, dois números, first_received=false; apenas create/prepare no diário. Nenhuma boas-vindas/fixação prematura.

## Próximo passo

O titular deve atualizar o perfil da Loja Teste B/Gmail e usar Entrar no grupo com seu WhatsApp pessoal final4593. Não criar outro pedido/grupo. Após entrada comprovada, a rotina aplica descrição, boas-vindas pelo segundo administrador e fixação antes de liberar códigos. A intenção original expira00:22:13 BRT; se vencer, exigir retomada explícita no mesmo grupo, sem alterar prazos por SQL. Login real B e duração completa seguem pendentes. Nada para reinstalar ou enviar à TI.

## Prevenção

Ao reutilizar imagem entre lojas, copiar o objeto para o prefixo da loja de destino e validar pelo mesmo contrato de `loadCareGroupLogo`. Verificar origem HTTP e SHA é necessário, mas não substitui a validação do prefixo e da mídia. Os testes existentes de care-group-content já recusam imagens de outra loja; não removê-los nem adaptar a validação para aceitar compartilhamento por URL.
