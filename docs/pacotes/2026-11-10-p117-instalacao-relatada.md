# P-117 — instalação relatada pela TI e homologação pendente

Recebido em 10/11/2026: `relatorio-ti-p117-2026-11-10.md`, referente ao [pacote de instalação](2026-11-10-ti-central-whatsapp-login-p117.md), commit `94e0726874114ce86eead938a444a778951423e2`.

## Conferência deste retorno

Os quatro hashes SHA-256 completos e tamanhos informados pela TI correspondem aos arquivos locais do commit entregue: `platform-whatsapp/index.ts`, `whatsapp-channel/index.ts`, `auth-otp/index.ts` e `auth-otp/login.ts`. Esta é uma conferência documental/local; não houve nova consulta à VPS ou teste autenticado pelo agente de código nesta rodada.

## Instalação informada pela TI

- Migration nº 102 aplicada em transação em **10/11/2026, 13:47:04–13:47:05 (Brasília)**, após backup e ensaio com ROLLBACK. **Não reinstalar.**
- Quatro arquivos publicados antes da migration; somente o container de funções reiniciado, saudável às 13:46:55. Demais serviços preservados.
- Backup completo em `/root/backup-p117-20261110-164554/`, dump de 1.390.985 bytes e catálogo válido; manifesto do pacote 9/9 OK segundo a TI.
- Cron do dispatcher respondeu 200 às 13:47:07 e 13:48:06; imports das funções sem erro relatado. Respostas sem sessão/validação de entrada conferidas nos dois domínios.
- Permissões da central restritas por RPC ao administrador; pedidos de login e preparação de envio exclusivos do serviço. RLS do histórico ativa.
- Dois vínculos existentes preservados; zero movimentações. Fila antes/depois: quatro enviados históricos, nenhum pendente, em envio ou incerto. Nenhum código ou mensagem enviado nesta instalação.
- Nº 99/100, Flow e pagamentos não foram alterados.

## O que continua pendente

A instalação não comprova conexão viva nem entrega de mensagens. A Loja Teste permanece com status salvo `qr`; Arena Barber mantém avisos desabilitados. O estado salvo não substitui consulta de conexão.

Próximo passo: executar a seção **Homologação dirigida após instalar** do pacote existente, com conta WhatsApp já ativada, conta pessoal de teste com telefone confirmado e destinatário combinado. Conferir central/permissões, pareamento, distribuição geral/individual, transferência com histórico e login real (erro, acerto e reutilização), incluindo domínio global e da loja.

A autorização de instalação relatada excluiu pareamento, habilitação/transferência e mensagens. Esses testes reais precisam ser combinados com o dono antes da execução pela TI. Não repetir instalação, não usar lojas reais como bancada e não gerar novo pedido ao Claude/Flow. Número Salvy somente no painel não comprova conta WhatsApp ativada.

P-117: **instalação feita conforme relatório; homologação real pendente**. Este registro não autoriza operações externas.

SHA-256 do relatório recebido: `b09148df8b9f3959fcd9214b6fe8e9e5b055b2f815de132ebd4ca3c85f213370`.
