# P-28 — TI/Flow: preparar a implantação da proteção do Drive

**31/10/2026 · Preparação para TI e responsável pelo Flow, após decisão de merge do PR #36.** O Codex revisou o complemento e executou 94 testes do módulo mais quatro regressões independentes. O PR segue em rascunho nesta entrega. Este arquivo prepara um pacote revisável; **não executar cópia, reinício, diagnóstico de produção ou migração por este encaminhamento de preparação**.

## 1. Objetivo e versão

Planejar a instalação **somente do código de proteção**, mantendo a conexão Google atual. Não trocar cliente, token, segredos de assinatura/cron, configuração em banco/ambiente, arquivos ou pastas do Drive. A migração para projeto Google próprio terá pacote separado.

| Alvo                         | Identificação                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repositório                  | `Proh2026Media/flow-proh-media`                                                                                                                                   |
| PR revisado                  | [#36](https://github.com/Proh2026Media/flow-proh-media/pull/36), head `78381de3a0abfbf0c72fcabbf4245caa1252a3f8`, base `e82919c77eed12440409d465b596822cfca1efcb` |
| Flow produção                | Stack `vv3jo93anprhqezhtu4ewcpl`, API `https://supabase.proh.media`                                                                                               |
| Pasta já identificada na VPS | `/data/coolify/services/vv3jo93anprhqezhtu4ewcpl/volumes/functions/google-drive/`                                                                                 |
| Container das funções Flow   | `supabase-edge-functions-vv3jo93anprhqezhtu4ewcpl`                                                                                                                |

**Manifesto dos arquivos correspondentes do PR:**

| Arquivo de execução | Blob Git esperado                          |
| ------------------- | ------------------------------------------ |
| `index.ts`          | `e0db47fccb1e7e52852f385cc227b8df21d574d1` |
| `protecao.ts`       | `711879fb7b390fbabfdd67c203139e975ea80f3f` |

O `index.ts` importa `./protecao.ts`; levar apenas um arquivo quebra a instalação. O arquivo de testes serve à validação, não precisa ser instalado como função. Confirmar merge e conteúdo aprovado antes de preparar a versão definitiva; não substituir por uma main futura sem conferir o delta.

## 2. O que o pacote operacional precisa definir

1. **Procedimento autorizado do Flow.** Ler o [AGENTS.md do Flow](https://github.com/Proh2026Media/flow-proh-media/blob/main/AGENTS.md). Os scripts existentes têm guardas para a stack de teste; não contorná-las nem usar os scripts do Barba & Cabelo para instalar em Flow produção. Devolver qual procedimento será usado e quem o executará, antes de comandos de escrita remota.
2. **Estado anterior e cópia de retorno.** Última leitura do Codex: `index.ts` no blob `17e98b8278747857329dcf38d1412b682e3c714e`, `protecao.ts` ausente. Na preparação operacional, conferir se essa base permanece e registrar a presença/ausência, hashes, proprietário/permissões e local protegido da cópia dos arquivos. Se a versão tiver mudado, revisar o delta; não voltar cegamente ao hash antigo.
3. **Troca dos dois arquivos sem versão misturada.** Definir staging, validação/importação Deno e como impedir que uma requisição carregue `index.ts` novo sem o módulo correspondente. Registrar a forma de recarga do runtime, se necessária. Nunca usar Restart/Redeploy da stack Coolify, reiniciar VPS ou proxy; eventual recarga fica limitada ao container das funções Flow e ao escopo de execução aprovado.
4. **Retorno concreto.** Restaurar os arquivos/estado de presença anteriores e a forma correspondente de recarga. Não restaurar banco inteiro, revogar Google ou desconectar para desfazer código. Este pacote não muda configuração/conexão em banco; a futura migração precisa de sua própria cópia protegida das duas linhas de `integracoes` e dos IDs.
5. **Primeira validação controlada.** Planejar conferência dos hashes implantados, carregamento dos dois módulos e ação `diagnostico` com operador admin autorizado, mostrando apenas estados/contagens. Não abrir a aba Drive como atalho: `status` pode preparar pastas e revogar compartilhamentos vencidos. Não chamar diagnóstico antes de existir a versão nova nem copiar token da sessão para relatório/log.
6. **Condição para interromper.** Erro de importação, versão divergente, diagnóstico com IDs inacessíveis/lixeira ou resultado inconclusivo não autoriza recriar pastas, trocar IDs ou iniciar migração. Registrar o ponto e o retorno previsto. Prova de carregamento/diagnóstico não equivale a ensaio OAuth ou de renovação.

## 3. Devolutiva da preparação

Entregar **`pacote-ti-flow-implantacao-pr36-p28-2026-10-31.md`**, com:

- Commit integrado e manifesto final dos dois arquivos, ou PR ainda não integrado.
- Procedimento previsto, executor, alvo e condição de início; nenhuma exceção silenciosa às guardas do Flow.
- Cópia/retorno dos arquivos, ordem da troca/recarga e impacto esperado nas funções Flow.
- Roteiro de validação inicial e como evitar `status`, criação de pastas, varredura ou revogação como efeito de teste.
- O que está apenas planejado e o que foi conferido por leitura; dependências exatas, sem repetir inventários já concluídos.
- Sem valores de credenciais, tokens ou conteúdo de `.env`.

Nada da preparação autoriza execução automaticamente. Depois de revisado o pacote e autorizado o escopo pelo dono, o TI poderá executá-lo e devolver resultados reais. Google Cloud/OAuth, DNS, cron P-26, teste parado, demais stacks e Barba & Cabelo ficam fora dessa implantação de código.
