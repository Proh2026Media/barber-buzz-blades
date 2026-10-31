# P-28 — Encaminhamento técnico: páginas públicas e ensaio do Flow

**31/10/2026 · Preparação para o agente responsável pelo Flow.** O dono confirmou manter o Drive e planejar sua separação, preservando o cliente atual do Barba & Cabelo. Este documento concretiza as tarefas identificadas; não autoriza publicar páginas, criar/configurar recursos Google, alterar DNS/IAM ou executar a migração nesta etapa.

## 1. Leituras concluídas — não repetir

- Flow produção: repositório privado `Proh2026Media/flow-proh-media`, frontend `https://flow.proh.media`, API `https://supabase.proh.media`. URLs, escopo, persistência e contagens já levantados.
- Função Drive analisada: blob Git **`17e98b8278747857329dcf38d1412b682e3c714e`**. Segundo o relatório TI de **~18:05**, o arquivo implantado em produção tem esse mesmo hash. Comparação de versão atendida; ensaio funcional não executado.
- Acesso DNS do TI confirmado pelo dono. Zona Hostinger consultada pelo TI sem TXT `google-site-verification`; isso não comprova ausência de propriedade Google por outro método ou associação ao projeto de destino.
- P-69 preservada; cron P-26 fica como está. Cliente/credenciais atuais do Barba & Cabelo fora da troca proposta.

Fontes externas: `relatorio-claude-levantamento-p28-flow-2026-10-31.md` (~17:40) e `relatorio-claude-p28-blocos-2-3-2026-10-31.md` (~18:05), entregues pelo dono. [Plano de separação e limites](2026-10-31-google-separacao-flow-p28.md).

## 2. Confirmar a publicação do frontend

O TI informou **`flow CNAME flow-proh-media.pages.dev.`**, divergindo da atribuição anterior de frontend Hostinger. A [documentação Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/custom-domains/) descreve esse CNAME para subdomínios; é indício do serviço de entrega, não prova da conta, branch ou pipeline que publica o app.

O agente Flow deve identificar por leitura projeto de hospedagem, repositório/branch, comando de montagem e fallback das rotas. Registrar a correspondência com `flow.proh.media` antes da publicação. Não alterar DNS, trocar hospedagem ou usar o fluxo de publicação do Barba & Cabelo por suposição.

## 3. Páginas propostas para implementação/revisão no Flow

O [Google pede apresentação pública do aplicativo e política de privacidade acessível](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification), coerentes com os dados acessados. Termos são opcionais nesse requisito; se oferecidos/cadastrados, precisam de conteúdo válido. Não usar a página inicial como política nem transformar Termos em condição universal da verificação.

| Página                | Rota proposta, ainda não publicada | Conteúdo/comportamento                                                                                         |
| --------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Apresentação          | `/sobre-o-flow`                    | Identificar Flow PROH Media e funções reais, explicar a integração Drive, vincular política e entrada `/login` |
| Privacidade           | `/privacidade`                     | Política própria do Flow, seção sobre dados Google e contato responsável confirmado                            |
| Termos, se oferecidos | `/termos`                          | Documento próprio revisado; se não adotado, não inventar URL nem preencher o campo Google com outra página     |

Preservar a entrada atual do app. Rotas públicas fora de `ProtectedRoute` e da estrutura que inicia tarefas do painel; reutilizar identidade/componentes do Flow, mantendo funções internas, celular e permissões. Preservar React/Vite e padrões do repositório.

**Preparação do texto:** confirmar responsável pelo produto, suporte/contato de privacidade e práticas reais. Autoria de commits ou conta conectada não comprovam esses dados. Cobrir dados de cadastro/trabalho, arquivos/pastas/documentos, `drive.file`, uso/compartilhamento, armazenamento/retenção, revogação e exclusão. Distinguir dados Google das demais informações do produto.

Não copiar a política do Barba & Cabelo, que tem outros escopos/funções. Não prometer criptografia em repouso, prazos, certificações ou práticas não conferidas. Preparar o conteúdo para revisão do responsável; texto, implementação e publicação são entregas distintas.

## 4. Critérios de aceite das páginas

1. Em navegador sem sessão, abrir cada rota diretamente e recarregar; verificar texto real renderizado, título e links. Uma SPA pode renderizar o conteúdo no navegador; HTTP 200 ou HTML inicial idêntico não comprova cada página.
2. Apresentação identifica o Flow e a integração Drive, com política no mesmo domínio e sem exigir cadastro. Vincular Termos somente se existirem.
3. Páginas não chamam `google-drive/status`, `auth-url`, `callback`, sincronização, criação de pastas, varredura ou revogação. Verificar rede em ambiente isolado/mocks; não executar funções de produção para provar isso.
4. Conferir celular, tablet, computador, teclado e retorno à entrada; manter a aparência do Flow.
5. Ler o [AGENTS.md do Flow](https://github.com/Proh2026Media/flow-proh-media/blob/main/AGENTS.md) antes de editar. Seguir seu fluxo de branch/PR, gerenciador de pacotes e verificações. Preparar PR revisável; este documento não autoriza push direto à main, merge ou publicação.

Devolver arquivos/rotas, validação sem sessão, ausência de chamadas Drive, testes e PR quando a tarefa for autorizada. Só após publicação autorizada/verificada informar URLs reais para possível cadastro no Branding. Não cadastrar rotas propostas como já existentes.

## 5. Ensaio separado, sem trocar produção para descobrir se funciona

| Condição a demonstrar    | Critério                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Arquivos do app anterior | Novo cliente com `drive.file` acessa os IDs necessários, ou há solução explícita de concessão/migração aprovada; mesma conta Google não prova acesso   |
| IDs preservados          | Um 403/404 não pode levar ao aceite silencioso de outra raiz/substituição dos IDs. Validar antes dos efeitos de `ensureRootFolders` no callback/status |
| Cópia/retorno            | Cobrir `integracoes/google_oauth` e `google_drive`, segredos de assinatura/cron e IDs. Sem valores no relatório; apenas `.env` não basta               |
| Falha parcial            | Detectar/restaurar conexão já gravada quando etapa posterior do callback falha; sem desconectar/revogar como limpeza                                   |
| Renovação                | Provar renovação real, não chamada com token em cache. Configuração completa de ambiente precede banco no código analisado                             |
| Escopo preservado        | Cliente/segredos do Barba & Cabelo, cron P-26, teste parado e permissões atuais fora de mudanças automáticas                                           |

Para ensaio real, definir destino/cliente, domínio comprovado, operador e autorização de execução. Antes disso, preparar desenho/casos isolados para revisão, sem criar cliente ou coletar token de produção. A igualdade do hash não substitui esses resultados.

## 6. Ordem de trabalho e devolutiva

**Preparação independente:** confirmar pipeline e dados de conteúdo; preparar tarefa das rotas públicas; formalizar operador/dados do projeto Google; preparar comprovação do domínio e desenho do ensaio. Não repetir inventários já concluídos.

**Execução futura:** publicar páginas após revisão; configurar/verificar Google por pacote aprovado; obter autorização e ensaiar de forma controlada; migrar; observar/encerrar uso antigo; adequar marca Barba & Cabelo e retomar P-28. Usar resultados reais de cada fase.

**Devolver só o trabalho novo:** pipeline confirmado, dados de conteúdo faltantes, tarefa/PR das páginas quando autorizada, destino/operador, evidência de propriedade associada e desenho/resultado do ensaio conforme autorização. Sem novo inventário de URLs antigas, hash atendido ou credenciais.
