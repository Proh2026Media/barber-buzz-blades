# TI — WhatsApp por QR Code ou código de pareamento (P-115)

**Histórico da primeira instalação:** a TI confirmou aplicação de `c49a783` e publicação do frontend em 09/11, 15h41–15h45. A correção posterior de retomada/país está no [registro atualizado](2026-11-09-whatsapp-p115-retomada-e-pais.md); não reinstalar o ZIP inicial por cima dela.

**Preparado em 09/11/2026. Destino: Barba & Cabelo.** Pedido confirmado pelo dono: permitir os dois métodos na plataforma e nas barbearias, usando a Evolution API existente. Desenvolvimento local concluído; **instalação das funções e pareamento real ainda não confirmados**.

## 1. O que instalar

Usar a entrega correspondente no `origin` do B&C; registrar o commit e conferir os hashes do pacote `barba-cabelo-whatsapp-p115-2026-11-09.zip` com `sha256sum -c SHA256SUMS` antes da cópia. São somente estes três arquivos de runtime:

- `supabase/functions/platform-whatsapp/index.ts`
- `supabase/functions/whatsapp-channel/index.ts`
- `supabase/functions/_shared/whatsapp-pairing.ts`

O helper `_shared/evolution.ts` já existente permanece necessário e não muda. **Não há migration nem variável nova.** P-49/Mercado Pago, P-70, Flow e Salvy são frentes independentes; não modificá-las nesta implantação. A publicação do frontend não instala estas funções automaticamente.

A conta de teste do B&C permite acessar o painel, mas não fornece um telefone WhatsApp. Para o ensaio, usar uma loja controlada e um número com WhatsApp cujo aparelho esteja sob controle do dono/TI. Não substituir o número ativo da plataforma nem desconectar uma loja real para testar.

## 2. Pré-conferência e instalação

1. Identificar o serviço B&C `supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn` e seu volume montado em `/home/deno/functions`. Conferir somente nome, saúde e mounts; não imprimir todo o ambiente do container.
2. Verificar presença, sem exibir valores, de `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `PLATFORM_EVOLUTION_INSTANCE` e das variáveis Supabase já usadas pelas funções. Não trocar chaves nem criar instâncias avulsas no painel.
3. A versão registrada da Evolution em `https://evolutionapi.contheiner.digital` é **2.3.7**; conferir a versão efetiva. Esta entrega não manda atualizar a Evolution/Baileys. Se a instalação efetiva não gerar `pairingCode`, devolver versão e erro sanitizado para diagnóstico.
4. Fazer backup protegido dos dois handlers e registrar se o helper novo já existia. Preservar proprietário e permissões. O backup fica fora da pasta servida pelas funções.
5. Copiar os três arquivos da mesma entrega para o volume correto, preservando todas as outras funções e helpers. Não usar sincronização com `--delete`.
6. Reiniciar somente o container das funções B&C, se necessário para recarregar arquivos. Não reiniciar Evolution, banco, Auth, Kong, proxy ou a pilha inteira. Conferir saúde e ausência de erro de importação/compilação no runtime Edge real.
7. Confirmar que o frontend publicado contém a opção **Conectar com código**, além de **Ler QR Code**. Se o site ainda servir pacote anterior, conferir a montagem/publicação Hostinger a partir do `origin`; não enviar só ao espelho `hostinger`.

**Validação local:** 428/428 testes, checagem de tipos, lint, formatação e montagem aprovados. Plataforma/loja conferidas no navegador com rede simulada, de 320 a 1280 px, altura reduzida, teclado, três modos de canto e temas claro/escuro. Código atrasado/atualizado, fechamento/reabertura, backend antigo, conflito e QR cobertos.

Os testes locais executam os handlers reais com dependências em memória. Eles não substituem a conferência de imports no runtime Edge nem a conexão no telefone.

## 3. Contrato e comportamento esperado

- A API continua `POST /functions/v1/platform-whatsapp` (somente `platform_admin`) e `POST /functions/v1/whatsapp-channel` (permissão `shop_can_manage_whatsapp` no JWT da pessoa; incluir `barbershop_id`). O cliente não escolhe o nome da instância.
- QR: `action: "connect"`, método ausente ou `method: "qr"`. Enquanto a janela está aberta, `action: "status", method: "qr"` acompanha o estado e atualiza a imagem da tentativa em andamento. Não cria nova tentativa quando a instância já está fechada.
- Código: `action: "connect", method: "code", phone: "<DDI+DDD+número>"`. O servidor normaliza o número e chama a Evolution com `number`. A resposta traz `pairing_supported: true` e `pairing_code` quando disponível.
- A janela acompanha com `action: "pairing-status"`, mesmo número e mesmo escopo. Consulta sem instância/tentativa ativa não cria outra instância. `status` comum também não inicia conexão; pode atualizar o estado do canal no banco.
- **O código de pareamento tem oito caracteres**, digitados no WhatsApp em **Aparelhos conectados → Conectar aparelho → Conectar com número de telefone**. O código SMS de seis dígitos serve a outro fluxo, o registro do número; não deve ser pedido nem usado aqui. OTP de login/confirmação do B&C continua como antes.
- Uma sessão já aberta é preservada. Uma tentativa já em andamento recebe `409 / PAIRING_IN_PROGRESS` ao tentar iniciar outro código. Concluir a tentativa atual ou esperar terminar; não usar logout/delete como atalho para trocar o método. Não há bloqueio distribuído entre operadores; evitar dois operadores iniciando simultaneamente o mesmo canal.
- Telefone e código novos não são gravados pelo B&C. O código permanece somente no estado da janela e na sessão da Evolution; se a pessoa escolher copiar, também passa pela área de transferência do aparelho. Não registrar QR, código, telefone completo, chave, JWT ou corpo de respostas nos relatórios.
- A consulta de QR mantém a ação `status` reconhecida pelo backend anterior; `method: "qr"` seleciona a atualização de imagem no backend novo. Frontend novo diante de resposta antiga sem `pairing_supported` informa que a função precisa ser instalada. Não declarar o pareamento disponível com base apenas no botão visível.

Fontes primárias consultadas: [controller Evolution 2.3.7](https://github.com/EvolutionAPI/evolution-api/blob/2.3.7/src/api/controllers/instance.controller.ts), [integração Baileys da Evolution](https://github.com/EvolutionAPI/evolution-api/blob/main/src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts) e [pareamento de oito caracteres no Baileys](https://github.com/WhiskeySockets/Baileys/blob/master/src/Socket/socket.ts).

## 4. Homologação dirigida

1. `OPTIONS` responde com CORS. POST sem sessão é recusado; usuário sem poder de administração/gestão não consegue gerar código nem consultar o canal alheio.
2. Abrir o painel com canal desconectado não inicia pareamento sozinho.
3. Na loja de teste: escolher **Conectar com código**, informar o número internacional controlado e gerar. Conferir exibição em dois grupos de quatro caracteres, atualização/expiração e conexão após digitar no aparelho. Fechar a janela limpa o código da tela; reabrir acompanha a mesma tentativa, sem iniciar outra.
4. Não registrar imagem ou código real. Registrar apenas método, papel, resultado, horário e erro sanitizado quando existir. Conferir que o canal correto ficou conectado; nenhuma outra loja foi alterada.
5. Testar QR com outra sessão controlada desconectada ou após desconectar explicitamente apenas a sessão criada para esse ensaio. Conferir atualização da imagem e conexão. Não desconectar números operacionais.
6. Na plataforma já conectada, confirmar estado preservado. Se não houver número/instância de plataforma disponível para ensaio isolado, registrar que o teste real desse escopo ficou pendente; não alterar `PLATFORM_EVOLUTION_INSTANCE` para improvisar.
7. Conferir celular, tablet e computador, fechamento/reabertura, telefone inválido, erro de conexão e tentativa concorrente. Não enviar mensagens a clientes reais; eventual envio de teste deve ser somente ao número controlado do operador.

## 5. Retorno e reversão

Se houver erro de runtime, restaurar os dois handlers anteriores e o helper anterior, se existia, a partir do backup, e reiniciar somente funções. Se o helper era novo, ele pode permanecer sem uso até revisão. Não excluir instâncias, sessões, dados ou chaves. Restaurar handlers antigos também restaura seus comportamentos antigos de consulta; registrar isso.

Devolver `relatorio-ti-whatsapp-p115-AAAA-MM-DD.md` contendo:

- **Responde a:** `2026-11-09-ti-whatsapp-pareamento-evolution-p115.md`.
- Commit instalado, três hashes e versão efetiva Evolution.
- Horário/saúde do serviço e resultado dos imports no Edge.
- Frontend novo confirmado ou publicação ainda pendente.
- Tabela de resultados por escopo (plataforma/loja), método (QR/código), papel e aparelho, distinguindo simulação de pareamento real.
- Confirmação de preservação dos canais operacionais e de ausência de mudanças no banco/Flow/Mercado Pago.
- Pendência concreta, se faltar aparelho/número controlado ou algum acesso; sem credenciais no documento.
