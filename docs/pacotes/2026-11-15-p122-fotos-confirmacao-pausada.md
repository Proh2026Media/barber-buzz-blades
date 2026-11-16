# P-122 — retorno das fotos do perfil, 15/11/2026

O titular encaminhou a devolutiva de implantação à TI e apresentou três fotos do perfil da conta Gmail na Loja Teste. Este registro separa a implantação concluída da liberação do teste real.

## Diagnóstico conferido em produção, somente leitura

Às **21:43:20 BRT**, pausa global=true v17, ciclos=false, assistência=false, distribuição=false; zero revisões/acessos. Os três timers novos continuam inactive/disabled. É o estado que a autorização de implantação mandou preservar, não evidência de falha na instalação.

Às **21:44:43 BRT**, consulta da leitura do próprio atendimento, em transação read only e identidade da conta das fotos, confirmou:

- Grupo existente; estado e ciclo `waiting_customer`, motivo `customer_absent`.
- Dois números de atendimento na composição retornada.
- `enabled=false`, `phone_ready=false`, `phone_confirmed=false`.
- Confirmação temporária expirada; assistência/revisão desabilitadas enquanto o piloto permanece pausado.
- Nenhuma revisão pendente. O telefone retornado pelo atendimento não tem o mesmo comprimento internacional do número digitado na foto; não inferir equivalência pelo nono dígito. O fluxo protegido instalado deve comprovar a identidade antes de alterar o perfil.

Não foi solicitado OTP, pesquisado candidato na Evolution, renovada matrícula ou alterado telefone/grupo/configuração. Nenhuma mensagem enviada. As fotos e este corte não demonstram bloqueio da Meta nem mostram um código entregue.

**Por que o código não chega:** a operação está bloqueada e o grupo ainda não tem prova de entrada/prontidão. A validade anual do grupo é diferente do prazo temporário para confirmar o telefone.

## Correção de interface concluída localmente

Havia duas entradas independentes para confirmar o telefone: o cartão geral do perfil oferecia “Enviar código” sem consultar a prontidão do atendimento, enquanto o painel do grupo respeitava a pausa. O backend recusava a primeira tentativa, gerando o erro genérico visto na foto.

- Para cliente ainda não confirmado dentro de uma loja, o cartão do perfil passa a abrir **Continuar confirmação**, sem chamar auth-otp ou iniciar grupo.
- Os atalhos de confirmação do resumo levam diretamente ao atendimento. O painel continua visível mesmo quando indisponível, inclusive sem grupo existente.
- O próprio atendimento continua sendo o único lugar para informar/revisar o número, aceitar a composição, entrar e receber/confirmar o código com as provas existentes.
- Durante indisponibilidade, o painel orienta a continuar por e-mail/Google e oculta as etapas de retomada/criação que não podem ser usadas. A validade anual passa a ser identificada como **Grupo válido até**.
- Textos nos dicionários pt-BR/pt-PT/en-US/es; en-GB herda en-US. Identidade visual, modos de canto, permissões, backend e política de envios preservados.

Verificação: ensaio local isolado, sessão/telefones fictícios e rede externa bloqueada. Navegação do cartão não dispara OTP; pausa impede renovação/convite/código, invalida convite antigo e conserva diagnósticos das falhas. **45 composições** (três cantos × cinco larguras × três estados), sem corte/erro de execução. Captura de 390px inspecionada. Tipos, lint dos três componentes e formatação aprovados; montagem de produção concluída com sucesso (incluindo SSR e cópia do service worker). Não equivale a homologação física do iPhone ou login real.

**Estado desta correção:** somente local/ramo de revisão; não publicada na main e não instalada na VPS. A implantação já concluída permanece válida. Nenhuma nova migration ou função de servidor é necessária para esta alteração de interface.

## Orientação objetiva para a TI

1. **Não reinstalar a P-122 nem reaplicar SQLs.** A devolutiva de implantação não autorizou despausar. Não reiniciar containers para tentar eliminar o aviso.
2. Combinar a janela de homologação com o titular. Antes de liberar, conferir novamente o estado atual, o escopo restrito à Loja Teste/cliente, as duas contas aprovadas e possíveis filas: os cortes acima são históricos.
3. Usar os contratos administrativos versionados do roteiro completo já entregue para assistência/ciclos. **Despausar global precisa de autorização específica**; não reutilizar versões históricas nem fazer UPDATE direto, habilitar todas as lojas, timers ou distribuição para testar um cliente. Nenhuma autorização nova é concedida por este arquivo.
4. Na janela autorizada, o titular confere o telefone que está no WhatsApp. Havendo divergência, utiliza **Corrigir meu número**, no mesmo grupo, sem remover/adicionar nono dígito por suposição e sem novo grupo/novo ano.
5. Depois: entrada do titular, acolhimento/descrição/pin após entrada, prova de recebimento, OTP e confirmação/login. Preservar as regras existentes e registrar resultado sanitizado; não solicitar QR, convite ou código no relatório.

Se a TI já tiver iniciado essa janela depois dos cortes acima, apenas conciliar o estado: não repetir ações. O usuário não precisa ficar clicando em “Enviar código” enquanto a liberação não ocorreu.
