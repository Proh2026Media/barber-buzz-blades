# Google: conferir `proh.media` antes da P-28 — 31/10/2026

**Situação após o relatório de ~16:05:** P-69 concluída; conferência de domínio recebida. `proh.media` consta em dois retornos do cliente **Supabase Google Drive** e nos três links do Branding **Proh Media**. **Manter a configuração nesta etapa.** A P-28 depende de resolver a identidade compartilhada e a comprovação do domínio. [Resultados e encaminhamento](#8-resultado-da-conferência-recebido-em-3110-1605) abaixo. As seções 1–7 preservam o registro e o roteiro anterior; não repetir o inventário já entregue nem executar remoções.

## 1. P-69 recebida — não refazer

Fonte: `instrucoes-claude-p69-dominio-proh-media.md`, relatório do assistente operacional de TI entregue pelo dono, datado de **31/10/2026, 15:40 de Brasília**. O registro abaixo resume o relato; não é uma conferência independente do console ou dos testes pelo Codex.

Projeto **`proh-media-drive`**, número **`1072350331037`**, cliente Web **Barba e Cabelo Auth**:

- Retirado de **Authorized redirect URIs**: `https://supabase-teste.proh.media/auth/v1/callback`.
- Depois do primeiro teste aprovado, retirado separadamente de **Authorized JavaScript origins**: `https://supabase-teste.proh.media`. Essa segunda alteração é informada pelo relatório e excede a única mudança prevista no pacote original; não foi executada nesta sessão.
- Alyson testou **Entrar com Google** em `https://beauty.contheiner.digital` após cada alteração, com sucesso nas duas vezes.
- Segundo o relatório, nenhum segredo, outro cliente ou Branding foi alterado.

**Listas restantes informadas:**

| Tipo              | Endereço                                                     |
| ----------------- | ------------------------------------------------------------ |
| Origem JavaScript | `https://beauty.contheiner.digital`                          |
| Origem JavaScript | `https://supabasebeauty.contheiner.digital`                  |
| Retorno           | `https://supabasebeauty.contheiner.digital/auth/v1/callback` |
| Retorno           | `https://beauty.contheiner.digital/auth/google-apps`         |
| Retorno local     | `http://localhost:8080/auth/google-apps`                     |

No primeiro relato, Branding continuava com `proh.media` e `contheiner.digital` em **Authorized domains**, e o outro cliente Web **Supabase Google Drive** ainda não havia sido aberto. Essas lacunas foram parcialmente resolvidas no relatório de ~16:05 (seção 8). Os dois testes de login não validam a integração Agenda/Contatos, o outro cliente ou a propriedade dos domínios.

## 2. Diagnóstico possível no repositório

Conferência local em 31/10/2026, sem ler `.env`, segredos ou configuração da VPS:

- Não há referência literal a `proh.media` nem ao nome **Supabase Google Drive** em `src/`, `supabase/` ou `scripts/` (excluídos arquivos `._*`). A ausência no código não comprova ausência na configuração em execução nem em outros aplicativos.
- [google.ts](../../supabase/functions/_shared/google.ts) lê `GOOGLE_OAUTH_CLIENT_ID` e, como reserva, `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID`. O retorno de Agenda/Contatos pode vir de `GOOGLE_OAUTH_REDIRECT_URI`; o padrão usa `APP_URL`/`SITE_URL` ou `https://beauty.contheiner.digital/auth/google-apps`. O código não identifica pelo nome os clientes do console.
- O [registro de implantação](../guia/banco-e-implantacao.md), seções 10–11, e [mb-operacao.md](../mb-operacao.md) ainda documentam `supabase-barbearia.proh.media` como endereço da API, junto do alias `supabasebeauty.contheiner.digital`. Isso impede afirmar que toda a infraestrutura usa apenas `contheiner.digital`, mas **uma URL de API, isoladamente, não prova que o domínio seja necessário no Branding**. É preciso localizar seu uso nos campos OAuth relevantes.
- O guia de implantação, seção 8, registra uma rotina `google-drive/share-expire` de outro projeto, mantida por decisão do dono (P-26). Não há evidência que a vincule ao cliente **Supabase Google Drive**; não apagar nem alterar essa rotina para esta investigação.

**Conclusão preliminar, antes do relatório de ~16:05:** não havia base suficiente para recomendar a retirada de `proh.media`. O relatório posterior identificou usos nos campos OAuth e no Branding (seção 8), confirmando que a retirada não deve seguir nesta etapa.

## 3. O que o Google exige

Consulta à [documentação oficial de verificação da marca](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification) em 31/10/2026:

- Os domínios autorizados devem abranger os domínios registráveis usados nos links de Home, Privacidade e Termos e nas origens JavaScript ou retornos dos clientes Web.
- A propriedade desses domínios precisa ser verificada no Search Console por conta associada ao projeto como Owner ou Editor.
- Um projeto pode conter vários clientes OAuth e uma tela de consentimento. Portanto, olhar somente o cliente do Barba & Cabelo não encerra a conferência do projeto.
- Mudanças no Branding podem ficar em rascunho e exigir verificação/publicação. O Google não permite modificações de Branding durante uma verificação em andamento. Este pacote **não autoriza cancelar uma análise**, editar ou publicar Branding.

Essas regras justificam o inventário. Elas não permitem afirmar, sem conferir o console, que retirar um domínio causaria imediatamente uma falha de login. **Authorized domains**, origens JavaScript e retornos são campos distintos.

A [ajuda oficial do Search Console sobre propriedade](https://support.google.com/webmasters/answer/9008080?hl=pt-BR), também consultada em 31/10, distingue proprietário verificado de acesso concedido e explica a abrangência das propriedades de domínio. A conferência abaixo coleta essa evidência sem criar ou alterar propriedades.

## 4. Recado para encaminhar ao TI

> Leia este documento inteiro. A P-69 já foi concluída: não retire novamente nenhum endereço. Confira somente por leitura o projeto `proh-media-drive` (nº `1072350331037`), especialmente o cliente Web “Supabase Google Drive”, Branding e propriedade dos domínios no Search Console. Devolva o formulário da seção 6. Nenhuma tela recebe Save, Verify, Publish, Submit ou cancelamento de análise. Não crie/exclua clientes ou projetos, não abra/baixe segredos e não altere servidor, DNS, banco ou código.

## 5. Conferência no console — somente leitura

1. Abra [o projeto no Google Cloud](https://console.cloud.google.com/home/dashboard?project=proh-media-drive). Confirme ID e número. Se a conta não tiver acesso ou os dados forem outros, pare e relate; não use o projeto `barba-e-cabelo`.
2. Em [Clients](https://console.cloud.google.com/auth/clients?project=proh-media-drive), anote os nomes e tipos de **todos** os clientes. Abra **Supabase Google Drive** para ler todas as **Authorized JavaScript origins** e **Authorized redirect URIs**. Transcreva o texto do aviso, se disponível, sem tentar corrigi-lo. Anote qual aplicativo/equipe usa esse cliente, se isso puder ser confirmado; o nome sozinho não é prova. Não abra a área de segredos nem baixe JSON.
3. Confira as listas do cliente **Barba e Cabelo Auth** contra a seção 1, sem salvar. Nos demais clientes Web, procure origens e retornos em `proh.media` ou seus subdomínios. Se houver mais de cinco outros clientes, devolva o inventário e indique quais não foram abertos; uma conferência incompleta não permite recomendar retirada.
4. Em [Branding](https://console.cloud.google.com/auth/branding?project=proh-media-drive), copie **App home page**, **Privacy policy**, **Terms of service** e a lista completa de **Authorized domains**. Registre se a tela mostra configuração publicada, rascunho ou ambas; se não conseguir distinguir, informe isso. Não mude campo nem salve.
5. No [Verification Center](https://console.cloud.google.com/auth/verification?project=proh-media-drive), anote o status e a existência de análise em andamento. Se o atalho não abrir, use o menu Google Auth Platform → Verification Center. Não envie, cancele ou reinicie análise.
6. No [Search Console](https://search.google.com/search-console), confira a propriedade dos dois domínios. Prefira registrar a propriedade de domínio (`sc-domain:proh.media`, `sc-domain:contheiner.digital`), quando existente. Informe o tipo, a abrangência e a condição de proprietário verificado; ter acesso à propriedade não é o mesmo que ter verificado a propriedade. Uma propriedade de prefixo de URL pode cobrir apenas parte do uso. Confira se há uma conta proprietária verificada associada ao projeto Cloud como Owner ou Editor. Se não conseguir comprovar essa associação, marque **não confirmado**. Não adicione conta, domínio ou registro DNS.
7. Saia das telas com a navegação de voltar. Se pedir para salvar alterações, descarte a edição acidental e relate. Não é necessário novo login, conexão, sincronização ou gravação de dados para este inventário.

Não inclua senhas, tokens, Client Secret ou Client ID completo no relatório. Se anexar imagens, recorte apenas os campos necessários, ocultando dados pessoais e credenciais.

## 6. Relatório para devolver

```text
Conferência de domínio antes da P-28 — somente leitura
Data/hora (Brasília):
Projeto e número conferidos: sim | não
Clientes existentes (nome e tipo):
Supabase Google Drive — origens JavaScript completas:
Supabase Google Drive — retornos completos:
Supabase Google Drive — texto do aviso:
Supabase Google Drive — aplicativo/equipe responsável e como foi confirmado:
Barba e Cabelo Auth — listas iguais às da seção 1: sim | não (diferenças)
Outros clientes com proh.media — nome, campo e URL:
Clientes não conferidos (ou “nenhum”):
Branding — Home:
Branding — Privacidade:
Branding — Termos:
Branding — Authorized domains completos:
Branding — publicado/rascunho e diferenças, ou “não confirmado”:
Verification Center — status; análise em andamento: sim | não | não confirmado
Search Console — proh.media: propriedade, tipo, abrangência, proprietário verificado:
Search Console — contheiner.digital: propriedade, tipo, abrangência, proprietário verificado:
Conta proprietária verificada associada ao Cloud como Owner/Editor: sim | não | não confirmado (por domínio; sem e-mail pessoal)
Nenhuma configuração ou dado alterado: sim | não (descrever)
Limites ou acessos ausentes:
```

## 7. Decisão depois do relatório

| Evidência                                                                                           | Encaminhamento                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Algum cliente ou link de Branding ainda usa `proh.media`                                            | Manter por enquanto e conferir sua propriedade. Identificar o uso e o responsável antes de propor qualquer retirada.                                                                                  |
| Inventário completo sem uso de `proh.media`, links corretos e estados publicado/rascunho conhecidos | Há base para preparar uma proposta de retirada para decisão do dono, com cópia das listas, uma única mudança, testes dos aplicativos afetados e como desfazer. Este pacote não executa essa proposta. |
| Dependência ou propriedade não confirmada                                                           | Não retirar nem reenviar a verificação; devolver o que falta.                                                                                                                                         |

Se o outro cliente atender a um aplicativo diferente, separar projetos pode ser avaliado posteriormente, com plano próprio de credenciais, consentimento e migração. Não é uma ação automática nem necessária para concluir este inventário.

**P-28:** P-69 atendida pelo relatório recebido. A conferência foi entregue posteriormente; resultados, limites e próximo passo nas seções 8–9. O [pacote de vídeo/reenvio](2026-10-15-google-reenviar-verificacao-p28.md) depende da resolução de marca/domínios. Nenhuma verificação foi reenviada pelo Codex.

## 8. Resultado da conferência recebido em 31/10, ~16:05

**Fonte externa:** `relatorio-claude-conferencia-dominios-2026-10-31.md`, entregue pelo dono, executado pelo assistente operacional de TI no navegador. Não é inspeção independente do Google Cloud pelo Codex. E-mails pessoais do anexo foram omitidos deste registro.

| Campo                                 | Resultado informado                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Projeto                               | `proh-media-drive`, nº `1072350331037`, conferido                                                                                                                                    |
| Inventário                            | Dois clientes, ambos Web: **Barba e Cabelo Auth** e **Supabase Google Drive**; nenhum cliente ficou sem conferência                                                                  |
| Barba e Cabelo Auth                   | Listas iguais às da seção 1; P-69 preservada                                                                                                                                         |
| Google Drive — origens JavaScript     | Nenhuma                                                                                                                                                                              |
| Google Drive — retornos               | `https://supabase-teste.proh.media/functions/v1/google-drive/callback` e `https://supabase.proh.media/functions/v1/google-drive/callback`                                            |
| Google Drive — uso                    | Criado em 03/09; último uso exibido em 29/09. Aplicativo/equipe responsável **não confirmado**                                                                                       |
| Aviso do Google Drive                 | Aviso sobre dois segredos ativos, criados em 03/09 e 30/09; nenhum valor aberto ou alterado. Não era aviso sobre os endereços. Não há autorização de rotação/exclusão nesta entrega  |
| Branding — nome                       | **Proh Media**                                                                                                                                                                       |
| Branding — Home, Privacidade e Termos | Os três campos apontam para `https://proh.media`                                                                                                                                     |
| Domínios autorizados                  | `proh.media` e `contheiner.digital`                                                                                                                                                  |
| Branding — publicado/rascunho         | **Não confirmado.** Console pede verificar a marca antes de mostrá-la aos usuários                                                                                                   |
| Verification Center                   | Sem análise em andamento; segundo o TI, console pede verificar/publicar a marca antes da verificação de acesso a dados                                                               |
| Search Console — contheiner.digital   | Propriedade de domínio; conta executora como proprietária confirmada, também Owner (Legacy) no IAM do projeto                                                                        |
| Search Console — proh.media           | Conta executora sem acesso à propriedade de domínio. Prefixos de URL e eventual outra conta proprietária não conferidos; propriedade **não confirmada**, não comprovadamente ausente |
| Alterações                            | Nenhuma configuração ou dado alterado pelo TI, segundo o relato                                                                                                                      |

**Conclusões a partir do relato:**

- `proh.media` continua em uso na configuração do projeto, tanto em retornos de outro cliente quanto nos links de Branding. Não retirar o domínio com o objetivo de concluir a P-28.
- Os retornos `functions/v1/google-drive/callback` pertencem ao outro cliente e são diferentes do retorno de login `auth/v1/callback` removido pela P-69. **Não aplicar a limpeza da P-69 ao cliente Google Drive.**
- Dois clientes OAuth foram confirmados; isso não identifica, por si só, dois aplicativos independentes ou marcas diferentes. A associação do cliente Drive a EventFlow/Flow continua sendo hipótese, inclusive no relatório do TI.
- Marca e links cadastrados divergem dos esperados no pacote do Barba & Cabelo. Os registros de aprovação de marca/páginas de 03/10 são históricos; não comprovam aprovação da configuração atual. Não é possível determinar por esses relatos quando ou por que ocorreu a divergência.
- “Último uso em 29/09” não prova abandono. O aviso de múltiplos segredos também não autoriza desativar um deles. Responsável e uso em execução precisam ser identificados antes de uma proposta de mudança.

## 9. Próxima etapa: definir a identidade OAuth sem afetar o outro uso

**Recomendação técnica:** se o cliente Drive pertencer a um aplicativo de outra marca, usar projetos separados para as marcas. O [Google recomenda um projeto por marca distinta](https://developers.google.com/identity/siwg/best-practices), pois todos os clientes de um projeto compartilham nome, logo, suporte e links de consentimento. Criar apenas outro cliente no mesmo projeto não separa a marca. Isso é uma direção para planejamento, **não autorização para criar, migrar ou excluir recursos**.

| Situação confirmada pelo dono/TI                                 | Proposta a preparar                                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drive atende a outro aplicativo de marca distinta e segue em uso | Planejar a separação dos projetos. Primeiro mapear os dois usos e escolher qual integração migrar, considerando login, conexões existentes, renovação de tokens e testes. Não presumir que é o Barba & Cabelo que deve mudar de cliente |
| Drive é parte do mesmo aplicativo/marca                          | Preparar uma configuração de marca que represente o aplicativo e todos os usos, com links corretos e propriedade de cada domínio. Mudança compartilhada exige avaliar os dois clientes                                                  |
| Dono informa que Drive não é mais utilizado                      | TI confirma dependências em execução e responsável; depois preparar eventual desativação em pacote próprio. Não excluir cliente, segredo ou retorno só com base na data de último uso                                                   |
| Uso ainda desconhecido                                           | Manter configuração e levantar apenas as lacunas abaixo; não iniciar vídeo/reenvio                                                                                                                                                      |

**Recado para o TI — complemento de leitura, sem repetir a P-69 ou o inventário já entregue:**

> Identifique o aplicativo e o responsável pelo cliente “Supabase Google Drive”. Se já tiver acesso autorizado à infraestrutura desse aplicativo, confira apenas por leitura qual serviço/configuração usa o cliente e seus retornos; compare identificadores no próprio ambiente e relate somente a correspondência, sem valores de credenciais. Não abra outros projetos/contas sem acesso autorizado. Confira se existe proprietário verificado de `proh.media` no Search Console, associado ao Cloud como Owner ou Editor; a falta de acesso pela conta atual não prova que o domínio esteja sem verificação. Registre o estado publicado/rascunho do Branding, se a tela permitir identificar, sem clicar em Verify, Publish ou Save. Não altere DNS, marca, cliente, segredo, rotina `share-expire` ou servidor.

Devolver: **(1)** aplicativo e responsável pelo Drive, com evidência e estado de uso; **(2)** correspondência do cliente com configuração em execução, ou limite de acesso; **(3)** propriedade de `proh.media` e associação ao IAM, sem e-mail pessoal; **(4)** estado publicado/rascunho, ou não confirmado. Não repetir a lista de clientes/URLs já registrada, salvo divergência.

Depois do retorno e da definição do dono sobre a identidade, preparar a mudança concreta com cópia de segurança, testes dos dois usos, impacto nas conexões e como desfazer. Se houver troca de cliente em alguma integração, ela precisa de ensaio próprio; os testes de login da P-69 não cobrem essa troca. A verificação/publicação de marca vem antes do pedido de acesso a dados, conforme o estado do console relatado e os requisitos do Google. Só então revisar o roteiro de vídeo/reenvio da P-28 para a configuração escolhida.
