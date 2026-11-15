# Extensão Evolution 2.3.7-bc.groups.7 — revisão protegida do telefone

Entrega somente local, sobre a imagem `6-brand.1` instalada e fonte `ad88eae`. Mantém o contrato `bc-groups-v4`; acrescenta a capacidade obrigatória `protectedPhoneRevision` e a rota privada `POST /group/bcPhoneRevision/:instance`.

O pacote inclui fonte completa, patch completo sobre a revisão oficial `cd800f2976e1e5b682fbf86a01ee4d85ae61f370` (snapshot local `db5c51b57047beaac1bb83fd8b951bf152bb5d64`) e incremental exato `ad88eae → e9748ffd3363af89f97996c1a7119d5a4825274d`. Não há dependência nem migration Evolution nova. As três migrations antigas permanecem na fonte para reprodução em banco vazio; **não reaplicá-las na VPS**.

## Operação privada

- `prepare`: intenção idempotente, mesmo grupo/ano, somente administradores exclusivos da plataforma, titular ainda fora. Consulta somente o candidato consentido com `onWhatsApp`; aceita exatamente um PN autoritativo. Não há heurística oito/nove dígitos, diretório público ou consulta em massa.
- `status`: recupera diário persistente após perda de resposta; não inventa sucesso nem repete criação.
- `bind`: somente após pedido real correspondente ao PN/LID autenticado. Troca a configuração do mesmo ciclo, cria nova admissão e invalida prontidão. B&C registra a intenção antes de chamar.
- `finalize`: exige o comprovante secreto da conciliação já gravada no B&C. Só então o motor normal pode admitir o cliente e preparar o acolhimento pós-entrada. O segredo não chega à interface.
- `abort`: cancela apenas antes do vínculo; mantém lápide contra replay. Se já houve bind, devolve o estado real e exige conciliação; nunca promete cancelamento falso. Cancelamento sem consulta não fabrica identidade.

Operações concorrentes usam trava de grupo e CAS persistente. `binding/bound` mantêm recuperação após o prazo para concluir o mesmo efeito; novas consultas e novos vínculos não ganham prazo extra. Alterações normais ficam congeladas durante a revisão. Encerramento seguro continua disponível, inclusive após remoção da conta, somente com a prova lacrada correspondente.

O perfil mantém o telefone declarado pelo titular. PN físico pode ser diferente apenas com prova do WhatsApp; uso do alias em login/outra barbearia exige o OTP consumido. Permanece cliente comum + pelo menos dois administradores da plataforma, nenhum profissional, código somente no grupo, sem recriação/rotação/PV para contornar estados incertos.

## Construção e conferência

`evolution/fonte/Dockerfile.bc-groups` fixa a imagem base oficial pelo índice SHA-256 `1bd8afc4…`, versão7 no rótulo e extensão desligada por padrão. Não confundir índice OCI, filho AMD64 e configuração. O Guardião preserva os segredos e parâmetros existentes, sem exportá-los.

No pacote completo, o publicador pronto fica em `operacao/evolution/publicar-imagem.py`. `construir` usa somente tag local e `--load`; `publicar` exige autorização e `--autorizado`, registry dedicado e entrega JSON com digest. Nenhuma das ações instala ou recria container. Conferir o manifesto antes. Não executar este script isolado fora do pacote.

61 regressões de motor/rota/identidade/revisão; 17 verificações PostgreSQL, incluindo persistência e CAS entre clientes; construção AMD64 e ensaio HTTP isolado sem sessões WhatsApp. A medição de recriação na bancada não estima o retorno de instâncias reais. A regressão canônica da marca instalada foi preservada.
