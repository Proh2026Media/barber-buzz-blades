# Domínio da plataforma

O domínio público é `aurset.app`. Cada loja conserva o prefixo no novo endereço. A Externa usa `externabarbearia.aurset.app`. Um domínio próprio ativo continua sendo o endereço preferencial da loja.

O domínio principal e www estão vinculados ao aplicativo Node da Hostinger. As lojas usam o registro DNS A curinga para a VPS do Coolify. O Traefik encaminha as requisições ao aplicativo e emite um certificado por loja ativa. O gerador está em `scripts/vps/cert-lojas-sync.sh`. Donos que usam domínio próprio recebem `dominios.aurset.app` como destino CNAME.

O código publicado da migração começa em `a6a6904`. A instrução de CNAME foi atualizada em `45a7dd1`. Incorporar essas alterações à cópia do redesenho antes de publicar. Os domínios independentes da API Supabase continuam válidos.

A entrada pelo endereço anterior conserva o caminho e a consulta. A integração de Agenda e Contatos ainda usa o retorno anterior até o cadastramento de `https://aurset.app/auth/google-apps` no cliente OAuth existente e a troca de `GOOGLE_OAUTH_REDIRECT_URI`. O login Google pelo Supabase tem retorno próprio na API.

Notificações push exigem inscrição pelo endereço novo. No iPhone, instalar pelo link da loja e ativar os avisos nesse app. Para o e-mail, a existência da caixa `noreply@aurset.app` e dos registros DNS é separada da troca da credencial SMTP no Auth e no serviço de avisos. Conferir o remetente efetivo antes de anunciá-lo.
