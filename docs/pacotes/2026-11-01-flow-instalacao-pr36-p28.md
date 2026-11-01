# P-28 — Instalação da proteção Flow: resultado e evidências

**01/11/2026 · Proteção do PR #36 instalada e validada em produção.** Somente os dois arquivos aprovados foram promovidos; recarga limitada ao container das funções Flow. Diagnóstico passou do 404 antigo para HTTP 200 com conexão ativa e as três pastas principais acessíveis. Janela stop→healthy de **8,309 segundos**; demais containers intactos.

## 1. Autorização e limites

Após a apresentação do [pacote TI revisão 2](2026-10-31-ti-flow-implantacao-pr36-revisao2-p28.md), Alyson respondeu **“faça o que for preciso”**. A autorização cobriu os dois arquivos, cópia/retorno, parada e início somente das funções Flow e validação por `diagnostico`, em baixo uso. Posteriormente, informou **“pronto”** após liberar pessoalmente o aviso de segurança do console do Edge. A colagem e o diagnóstico funcionaram na retomada.

Não houve alteração de cliente/refresh token/segredos, configuração de integração, banco, cron, DNS, Google Cloud, guardas dos scripts, stack de teste ou Barba & Cabelo. Não foi usado o instalador restrito à stack de teste, nem Coolify Redeploy. Esta autorização de código não inclui migração Google.

## 2. Fonte e manifesto instalado

Fonte: merge **`926298529da2b0e565599eb3e1f86d834e514be1`**, repositório Flow. Conteúdo obtido pelo conector GitHub com referência fixa; hashes conferidos localmente, na staging e na pasta viva. Na retomada, `main` ainda servia os mesmos blobs.

| Arquivo vivo  | Blob Git conferido                         |
| ------------- | ------------------------------------------ |
| `index.ts`    | `e0db47fccb1e7e52852f385cc227b8df21d574d1` |
| `protecao.ts` | `711879fb7b390fbabfdd67c203139e975ea80f3f` |

Os dois arquivos são `root:root`/`0644`; diretório vivo `0755`. `protecao.test.ts` não foi instalado. Permanecem válidos os 94 testes do módulo e quatro regressões independentes já registrados, pois os blobs são idênticos. O Deno check do Claude sobre esses blobs foi aceito conforme o pacote; não repetido nesta máquina sem Deno.

## 3. Preparação e prova anterior

A operação **`20261101T174338Z`** começou com staging exclusiva e cópia conferida do código antigo, fora da API, às **17:43:38 UTC / 14:43:38 Brasília**. Pasta viva ainda com apenas `index.ts` antigo **`17e98b8278747857329dcf38d1412b682e3c714e`**, helper ausente e funções saudáveis. Houve uma interrupção da preparação para a liberação pessoal do aviso do Edge; nenhum código vivo foi trocado durante essa espera.

Na retomada, os hashes, a cópia, a saúde e a lista de funções foram revalidados. Diagnóstico autenticado prévio em **18:31:05 UTC / 15:31:05 Brasília**, confirmado no Kong: **404**, com a mensagem de ação desconhecida esperada na versão antiga. Autorização usada somente dentro da sessão existente do navegador, sem copiar/exibir token.

Leitura de tráfego às **18:31:41 UTC / 15:31:41 Brasília**, últimos cinco minutos: somente `share-expire` agendado (GET 200), preflight do diagnóstico (OPTIONS 200) e diagnóstico anterior (GET 404). Nenhuma chamada de uso interativo identificada nessa janela. Cron não foi alterado; o resultado da rotina é uma observação pontual, não prova de seu funcionamento futuro.

## 4. Execução e disponibilidade

Somente **`supabase-edge-functions-vv3jo93anprhqezhtu4ewcpl`** foi parado/iniciado. A pasta antiga foi movida para o backup fora da API; staging foi promovida; hashes e permissões foram conferidos antes do início.

| Marco em 01/11/2026            | UTC             | Brasília        |
| ------------------------------ | --------------- | --------------- |
| Início do comando de parada    | 18:32:28.142104 | 15:32:28.142104 |
| Container confirmado parado    | 18:32:29.716147 | 15:32:29.716147 |
| Troca dos arquivos concluída   | 18:32:29.717653 | 15:32:29.717653 |
| Comando de início concluído    | 18:32:30.296125 | 15:32:30.296125 |
| Container novamente saudável   | 18:32:36.451368 | 15:32:36.451368 |
| Diagnóstico posterior HTTP 200 | 18:32:55        | 15:32:55        |
| Conferência final registrada   | 18:34:11.573971 | 15:34:11.573971 |

Janela do início da parada até saudável: **8,309 s**. DB/Auth/Kong/Storage/REST/MinIO conservaram IDs e horários de início; não foram reiniciados. Logs das funções desde o início da intervenção disponíveis, com **zero falhas de importação e zero ocorrências de erro/exceção** na conferência final.

O volume continua com as sete pastas esperadas: `admin-reset-password`, `google-drive`, `hello`, `invite-marca-user`, `main`, `seed-demo-data`, `status-check`. Sem backup, staging ou cópia `.pre-pr36` servível sob `volumes/functions/`.

## 5. Diagnóstico posterior

A chamada administrativa ao mesmo endpoint retornou **HTTP 200**, provando o carregamento do novo handler/módulo, além da saúde e dos hashes:

- Conexão existente: **ativa**.
- Pastas principais: **Raiz, Clientes e Lixeira = ok**.
- Registros amostrados: **0**.
- Pastas e fichas da amostra: todas as contagens de ok/lixeira/inacessível/erro iguais a **0**.

Não foram retornados IDs privados ou credenciais no relatório. A amostra vazia **não demonstra que o Drive esteja vazio**, nem comprova acesso de um cliente OAuth de outro projeto. Não houve recriação de pastas, chamada a `status`, abertura da aba Drive, upload, callback ou ensaio de migração/renovação real. A instalação e o diagnóstico da conexão atual não aprovam a futura migração.

## 6. Backup e retorno

| Item                                       | Local na VPS                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Pasta viva, versão aprovada                | `/data/coolify/services/vv3jo93anprhqezhtu4ewcpl/volumes/functions/google-drive`      |
| Backup privado desta operação              | `/root/backup-flow-google-drive-pr36-20261101T174338Z`                                |
| Pasta original, fonte do retorno           | `pasta-viva-pre-pr36`, dentro do backup                                               |
| Cópia adicional conferida do código antigo | `copia-arquivos`, dentro do backup                                                    |
| Registro da operação                       | `preflight.json`, dentro do backup, modo `0600`                                       |
| Staging original, já promovida             | `/root/staging-flow-google-drive-pr36-20261101T174338Z` — não permanece neste caminho |

Pasta original e cópia adicional conferidas com apenas o blob antigo **`17e98b8278747857329dcf38d1412b682e3c714e`**, sem helper. Registro remoto na fase **`instalacao_validada`**, com horários, manifesto, estados/contagens e comparação dos containers. Backup privado em `/root`, fora das funções servíveis; não contém banco, credenciais ou configuração de integração.

**Retorno não necessário nem executado.** O [procedimento revisão 2, seção 5](2026-10-31-ti-flow-implantacao-pr36-revisao2-p28.md#5-rollback-concreto) continua disponível: conferir o backup antes de parar, preservar a versão nova em `pasta-pos-pr36` fora da API, restaurar a pasta original e validar. Não restaurar banco nem revogar Google para um retorno de código. Em intervenção futura, reavaliar o estado atual antes de aplicar este retorno.

## 7. O que ainda falta na P-28

Instalação da proteção e primeira linha de base atendidas. Não repetir PR, merge, instalação, projeto Google, páginas/gatilho ou inventário já concluídos.

Próxima etapa: preparar o pacote protegido de cópia/restauração das integrações e o ensaio de compatibilidade com o projeto já criado, considerando o cron ativo e seus campos de varredura. Exigir retorno coerente entre configuração/conexão/cache, teste de IDs reais e renovação real. Operador que autorizará o Drive, propriedade Google associada, marca e revisão de contato/jurídico continuam pendentes. Cópia de código desta entrega não substitui o backup da migração. Migração, vídeo e reenvio não executados.

## 8. Verificação da documentação

No Barba & Cabelo: tipos, **301 testes**, formatação dos **12 documentos** e montagem aprovados; **25 links/âncoras locais novos** conferidos e diff sem erros de espaço. ESLint não aplicável, sem TypeScript alterado. Verificações do repositório distintas da validação real Flow descrita acima; testes isolados dos mesmos blobs não repetidos. `.env` e `.vscode/` locais preservados e excluídos do envio.
