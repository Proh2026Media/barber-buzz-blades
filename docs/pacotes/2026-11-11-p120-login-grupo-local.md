# P-120 — exclusividade e login pelo grupo, entrega local

**Continuação posterior:** [entrega de primeiro acesso e extensão v2](2026-11-11-p120-primeiro-acesso-grupo.md) resolve os itens 1–3 de desenvolvimento listados abaixo. Nº 109, confirmação, envio protegido e multiloja ensaiados. Este arquivo registra a primeira etapa; sua descrição de bloqueio fixo no código foi substituída por piloto configurável, desligado por padrão. Não instalado nem liberado globalmente.

Data: 11/11/2026. Destinatário: desenvolvimento do Barba & Cabelo. **Não é pedido de instalação à TI.**

## Resultado e alcance

Implementada a base local da decisão do dono: somente cliente + números autorizados da plataforma participam do grupo. Profissionais não ganham acesso por serem donos, parceiros, contratados ou integrantes da loja. O caminho de login resolve o grupo no servidor e possui ensaio completo de envio/validação com PostgreSQL real local e Evolution fictícia.

**Não está liberado para uso real.** O emissor em `evolution.ts` permanece desabilitado no código; a nº 108 também nasce com `login_enabled=false`. Não basta ligar uma variável. Nada foi publicado, instalado na VPS, enviado a um número real ou criado no WhatsApp. O compartilhamento de números P-119 permanece.

## Alterações

- Nº 108, `20261111210000_grupos_exclusivos_plataforma.sql`, depende de 105/106/107. Revoga participantes profissionais, conserva histórico, invalida controles/convites anteriores e impede nova aprovação. Leitura do grupo exige o próprio titular, inclusive quando a chamada vem de administrador. Funções anteriores renomeadas perdem concessões de execução para navegador e serviço.
- A administração mantém cadastro dos números autorizados, estados e pausa/revisão. Saíram seleção/proposta de profissionais e o painel de grupos da ficha do cliente vista pela loja. Não existe tela de conversa/código para o profissional.
- O processador admite somente o cliente. Remove identidade antiga conhecida quando autorizada para remoção; intrusos/administradores indevidos exigem revisão. Confere a presença efetiva do cliente depois da admissão. Todos os números aprovados da plataforma devem estar presentes; ausência ou identidade ambígua impede ativação.
- `request_whatsapp_group_login` reaproveita idempotência/limites existentes e vincula desafio a titular, telefone, grupo, versão e instância. Na entrada global escolhe um único vínculo elegível, ordenado por solicitação e ID. Nenhum JID é aceito do navegador.
- O emissor de bancada consulta `bcInspect`, exige composição exata e controles, revalida o contexto no banco e persiste uma tentativa antes do `sendText`. Usa o JID inteiro, sem converter grupo em telefone. Timeout permanece desconhecido, sem repetição ou desvio ao privado. Aceitação não é recibo de entrega.
- A autorização central recusa OTP privado também para confirmação de telefone/cadastro/recuperação. Esses caminhos não podem contornar a regra usando o emissor antigo. Isso exige concluir o primeiro acesso antes de publicar: não se afirma que todos já funcionam pelo grupo.
- Validação do código confere o contexto atual, posse da conta, tentativa registrada e consumo único. Alteração de telefone, conta bloqueada, revogação ou mudança de versão invalida o caminho.
- A janela informa recebimento no grupo e oferece **Usar e-mail**, fecha e foca o formulário existente, preservando o valor. Troca durante solicitação ignora resposta tardia; durante confirmação da sessão, fechamento/troca ficam bloqueados. Resposta pública continua genérica. Prazo de reenvio usa o retorno validado do servidor.

## Verificações realizadas

| Verificação                              | Resultado                                                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/verificar.sh`                   | 562 testes aprovados; tipos, lint, formatação e montagem aprovados. Lint mantém três avisos preexistentes nos componentes de grupos; montagem mantém avisos de dependências/tamanho. |
| SQL local descartável                    | 1.519 PASS, zero FAIL/ERROR, incluindo nova `grupos_login.sql`.                                                                                                                      |
| `python3 scripts/testar-grupos-fluxo.py` | 21 PASS: ciclo de grupos, duas chamadas concorrentes com uma transmissão, titular/consumo único e reversão nº 108. PostgreSQL real, transporte inteiramente fictício.                |
| Deno                                     | `auth-otp`, `whatsapp-groups` e `whatsapp-dispatch` conferidos.                                                                                                                      |
| Interface de grupos                      | 128 verificações, 36 capturas; 320, 390, 768, 834, 1024 e 1440 px, três modos de canto.                                                                                              |
| Interface do login                       | 150 verificações, 30 capturas; 320, 390, 768, 1024 e 1440 px, claro/escuro, três modos de canto. Foco/valor de e-mail, ausência de envio na troca e resposta tardia ensaiados.       |

Bancadas de interface usam dados fictícios e interceptação da rede. Capturas representativas inspecionadas. Não equivalem a teste de toque/WhatsApp em aparelho físico nem a aprovação da experiência pelo dono. Artefatos temporários: `/tmp/bc-p120-*.log`, `/tmp/bc-p120-login-*.png` e `/tmp/bc-grupos-*.png`; podem desaparecer na limpeza do computador.

## Pendências que impedem publicação

1. **Primeiro acesso e confirmação inicial do telefone.** E-mail/senha, recuperação por link e Google continuam disponíveis. Porém a adesão atual exige telefone já confirmado; a confirmação antiga por WhatsApp foi bloqueada. Preparar uma adesão provisória vinculada à sessão e prova do telefone no grupo, sem tomar entrada no grupo como autenticação nem marcar telefone confirmado silenciosamente. Testar usuário inteiramente novo. Administrador sem grupo usa a alternativa existente.
2. **Contrato de envio na extensão Evolution.** A bancada usa consulta e `sendText` separados; não existe transação atômica entre WhatsApp e PostgreSQL. Completar rota específica, diário, coordenação das mutações controladas, casos concorrentes e isolamento de credenciais/aparelhos/painéis. A extensão `2.3.7-bc.groups.1` anterior não foi modificada nesta entrega.
3. **Mais de um número da plataforma no mesmo grupo.** A conferência exige o conjunto exato; o ciclo atual cria o grupo só com o remetente. Preparar inclusão controlada dos demais números antes de oferecer essa configuração como pronta. Não adicionar cliente/profissional como efeito colateral.
4. **Demais finalidades e privacidade operacional.** Confirmar comportamento de cadastro/recuperação/confirmação, alternativas visíveis, webhook/recibos, logs, exportações e acesso externo. Nenhum bloqueio local comprova sozinho isolamento do servidor/aparelhos. Código por e-mail não foi implementado.
5. **Ensaio integral e piloto autorizado.** Só depois dos itens anteriores preparar um pacote de implantação completo, com versão exata, backup, indisponibilidade medida, ordem/reversão e autorizações de cada etapa. Nº 105–108 continuam não instaladas; nº 101–104 não devem ser reaplicadas.

A P-120 permanece **parcial**. O próximo passo é desenvolvimento, não reabrir o diagnóstico da TI nem enviar esta etapa incompleta para instalação.

## Reversão operacional preparada

`supabase/rollback/20261111210000_grupos_exclusivos_plataforma.sql` desliga adesão e login, invalida controles/convites, bloqueia operações pendentes e conserva desafios, rotas, tentativas e histórico. Não devolve permissões a profissionais e não restaura OTP privado. Ensaiada em transação descartada no teste integrado. Sua existência não autoriza execução em produção.
