# Testes reais com a "Loja Teste" (P-40 e P-41)

Preparado em 13/10/2026. O dono autorizou uma loja de teste no próprio subdomínio, com contas de teste. **Nada disto foi criado ainda.** Só começar depois da implantação da noite ([implantacao-noite-2026-10-13.md](implantacao-noite-2026-10-13.md)): a limpeza depende da migration 1 (apagar loja inteira) e o teste de convite depende da função `invite-shop-admin` publicada.

Princípios:

- a loja de teste é uma loja à parte: nenhuma outra loja ganha cliente, reserva ou membro de equipe;
- contas com e-mail `@loja-teste.invalid` (domínio reservado, que não recebe e-mail): o sistema não manda e-mail de verdade a ninguém, e a limpeza acha as contas pelo domínio;
- **sem código real de WhatsApp e sem login real com Google**: as contas entram com e-mail e senha;
- senhas escolhidas pelo dono na hora, digitadas sem aparecer na tela e guardadas no gerenciador de senhas dele. Nunca em documento, commit ou relatório.

## 1. Nome, endereço e contas

| Item     | Valor                                                                                  |
| -------- | -------------------------------------------------------------------------------------- |
| Loja     | **Loja Teste**, endereço `loja-teste` → `https://loja-teste.beauty.contheiner.digital` |
| Opcional | **Loja Teste B**, `loja-teste-b` (só para os casos com duas lojas)                     |

Em 13/10/2026 (consulta só de leitura): os dois endereços estavam livres e não havia nenhuma conta `@loja-teste.invalid`.

| Conta                           | Papel                            | Como nasce                                                                                |
| ------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| `dono@loja-teste.invalid`       | Dono 100% da Loja Teste          | passo 2 (servidor) e passo 3 (script cria a loja com ele como dono)                       |
| `socio@loja-teste.invalid`      | Dono (sócio) com 30%             | convite pelo dono no app (passo 5): testa a senha temporária e a troca obrigatória (P-16) |
| `parceiro@loja-teste.invalid`   | Parceiro                         | convite pelo dono no app                                                                  |
| `contratado@loja-teste.invalid` | Contratado                       | convite pelo dono no app                                                                  |
| `cliente@loja-teste.invalid`    | Cliente da Loja Teste            | passo 2, já ligada à loja (`shop: loja-teste` nos dados da conta)                         |
| `cliente2@loja-teste.invalid`   | Cliente que depois vira Parceiro | passo 2, ligada à loja; o dono convida o mesmo e-mail como Parceiro (conta que já existe) |
| `dono-b@loja-teste.invalid`     | Dono da Loja Teste B (opcional)  | passo 2 e passo 3 com a variante B                                                        |

## 2. Criar as contas (servidor, com o dono)

Na VPS. A chave de serviço é lida do container de funções e não aparece; a senha é digitada sem eco. Use senha só com letras e números (12 ou mais), para não quebrar o JSON.

```bash
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions)
SRK=$(docker exec "$FN" printenv SUPABASE_SERVICE_ROLE_KEY)
API=https://supabase-barbearia.proh.media
conta() {  # conta <email> "<nome>" [loja]
  local meta="{\"full_name\":\"$2\"${3:+,\"shop\":\"$3\"}}"
  read -rs -p "Senha para $1: " PW; echo
  curl -s -o /dev/null -w "$1 %{http_code}\n" -X POST "$API/auth/v1/admin/users" \
    -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PW\",\"email_confirm\":true,\"user_metadata\":$meta}"
  unset PW
}
conta dono@loja-teste.invalid "Dono Teste"
# só depois do passo 3 (a loja precisa existir):
conta cliente@loja-teste.invalid "Cliente Teste" loja-teste
conta cliente2@loja-teste.invalid "Cliente Dois Teste" loja-teste
# opcional: conta dono-b@loja-teste.invalid "Dono B Teste"
unset SRK
```

**Ordem:** criar o `dono@`, rodar o passo 3 e só então criar os clientes. O cadastro só liga o cliente à loja se ela já existir; antes disso, a ligação falha em silêncio (achado de 13/10/2026, P-63).

Esperado: `200` em cada linha. Criar pela API de administração não manda e-mail (`email_confirm: true`). Se o Auth recusar o domínio `.invalid` (`400`/`422`), **parar**: não trocar por e-mail de outra pessoa; combinar com o dono um endereço dele (a limpeza do passo 8 precisa ser ajustada junto, porque acha as contas pelo domínio). Em 13/10/2026 o Auth aceitou `.invalid` (`200`).

## 3. Criar a loja (servidor)

O script [supabase/manutencao/loja-teste-criar.sql](../supabase/manutencao/loja-teste-criar.sql) chama a mesma função do app (`create_own_barbershop`) como se fosse o dono, só dentro da transação. Ele aborta sem gravar nada se a conta do dono não existir, se ela já estiver na equipe de alguma loja ou se o endereço `loja-teste` estiver em uso.

```bash
DB=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep '^supabase-db-')
docker exec -i "$DB" psql -U postgres -d postgres -X < supabase/manutencao/loja-teste-criar.sql
# opcional, Loja Teste B com dono-b:
sed -e "s/'loja-teste'/'loja-teste-b'/g; s/'Loja Teste'/'Loja Teste B'/g; s/dono@loja-teste\.invalid/dono-b@loja-teste.invalid/g" \
  supabase/manutencao/loja-teste-criar.sql | docker exec -i "$DB" psql -U postgres -d postgres -X
```

Esperado: `NOTICE: slug=loja-teste dono_100=1`, `NOTICE: LOJA TESTE CRIADA`, `COMMIT`. Conferido em 13/10/2026 numa cópia da estrutura do banco (com as 5 migrations da noite): loja criada com o endereço `loja-teste` e o dono a 100%.

A loja nasce com os horários padrão e sem serviços: o dono cadastra um serviço pelo app (Serviços) antes dos testes de reserva.

## 4. Certificado do subdomínio (servidor)

O DNS curinga `*.beauty` já leva à VPS; **não mexer em DNS**. Falta o certificado, que é por loja (P-27). Acrescentar um bloco em `/data/coolify/proxy/dynamic/beauty-shop-certs.yaml`, igual aos que já existem:

```bash
F=/data/coolify/proxy/dynamic/beauty-shop-certs.yaml
cp -a "$F" "/root/beauty-shop-certs.yaml.bak-$(date +%Y%m%d-%H%M)"
cat >> "$F" <<'YAML'
    beauty-shop-loja-teste:
      rule: Host(`loja-teste.beauty.contheiner.digital`)
      entryPoints:
        - https
      service: hostinger-beauty@file
      priority: 30
      tls:
        certResolver: letsencrypt
YAML
sleep 60
echo | openssl s_client -connect loja-teste.beauty.contheiner.digital:443 -servername loja-teste.beauty.contheiner.digital 2>/dev/null | openssl x509 -noout -issuer -subject
curl -s -o /dev/null -w '%{http_code}\n' https://loja-teste.beauty.contheiner.digital/
```

Esperado: emissor Let's Encrypt (não "TRAEFIK DEFAULT CERT") e `200`. O Traefik relê a pasta sozinho; não reiniciar o proxy. Para a Loja Teste B, outro bloco com `loja-teste-b`.

## 5. Montar a equipe (no app, pelo dono)

Entrar em `https://loja-teste.beauty.contheiner.digital/auth` com `dono@loja-teste.invalid`. Aceitar os termos quando a janela pedir (também conta como teste). Em Ajustes → Equipe e sociedade, "Novo profissional" → "Com acesso ao painel":

1. `socio@…` como **Dono (sócio)** com 30%;
2. `parceiro@…` como **Parceiro**;
3. `contratado@…` como **Contratado**;
4. `cliente2@…` como **Parceiro** (conta que já existe: não deve aparecer senha temporária).

Para cada conta nova, anotar a senha temporária mostrada só no gerenciador de senhas. Cadastrar um serviço e conferir os horários.

## 6. Roteiro P-40 — destino depois do login e troca de áreas

Para cada conta, em janela anônima (uma conta por vez):

| Caso                                           | Conta                                         | Conferir                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Primeiro acesso por convite (P-16)             | socio, parceiro, contratado                   | "Crie sua senha" aparece antes de qualquer tela e não deixa seguir sem trocar; a senha nova funciona; a temporária deixa de funcionar |
| Destino vindo de "Agendar"                     | cliente                                       | página pública → horário → `/auth` com "Seu horário · Falta confirmar" → `/app` com dia e hora escolhidos; nunca reserva sozinho      |
| `/` no subdomínio da loja                      | dono, parceiro                                | barra "Você está vendo como cliente · Abrir painel" quando cabe; "Minhas áreas" troca entre painel e app                              |
| `/` no endereço principal                      | dono                                          | vai à área certa sem misturar lojas                                                                                                   |
| Cliente promovido a Parceiro                   | cliente2                                      | depois do convite, aparece o painel; continua cliente no app                                                                          |
| Dono com 2 lojas (opcional, Loja B)            | dono-b convida `dono@…` como sócio na B       | troca de loja sem sobrar permissão da anterior                                                                                        |
| Dono numa loja, Contratado em outra (opcional) | dono-b convida `socio@…` como Contratado na B | aviso "Você está no endereço da A, mas trabalha na B" ao abrir o endereço errado                                                      |
| Cliente de duas lojas (opcional)               | cliente entra pelo link da Loja Teste B       | seletor de loja do cliente                                                                                                            |
| Contratado removido                            | dono remove `contratado@…`                    | ao entrar de novo, sem painel; sem dados da loja                                                                                      |
| `/platform` no domínio da loja                 | conta de admin do dono (só abrir, sem mexer)  | vai ao endereço principal                                                                                                             |

Fora deste roteiro: "admin da plataforma que também é dono" (exigiria pôr a conta real de admin na equipe da loja de teste) e "`shop_admin` antigo sem vínculo de equipe" (em 13/10 não havia nenhuma conta assim no banco).

## 7. Roteiro P-41 — sociedade, matriz e saída

1. Com o dono a 100%: mudar um ajuste de Agendamento (ex.: "Antecedência mínima" para 1 h) aplica na hora.
2. Depois do sócio com 30%, no modo padrão "decide quem tem a maior parte": o dono de 70% continua decidindo sozinho. Entrando como o sócio de 30%, o mesmo ajuste mostra "Vai para aprovação de Dono" antes de salvar; o pedido aparece para o dono, que aprova ou recusa; o valor novo aparece para os dois. (Para testar aprovação vinda do dono, usar 50%/50%.)
3. Ajustes → Acessos: a matriz do Contratado fica travada nos itens de dono.
4. Bloqueios (P-04): o dono cria um bloqueio com motivo. Entrando como Parceiro, Horários mostra "Colega indisponível" e, na aba Rede do navegador, a resposta de `list_shop_blocks` vem sem motivo e sem nome.
5. Saída do Contratado: só aparece "sair sem levar clientes"; o pedido conclui sem levar a carteira (P-01).
6. Saída do Parceiro levando a carteira: escolher "Levar comigo" pede a barbearia de destino (pode ser criada ali mesmo, ex.: "Loja Teste B"). O pedido espera a liberação do dono (P-62, desde 13/10). Com reserva futura do Parceiro, "Liberar clientes" fica desligado até o dono passar a reserva para um colega ou cancelar avisando (P-61). Vão junto só os clientes com atendimento **concluído** com o Parceiro; para ver a carteira mudar de loja, concluir antes um atendimento dele.
7. Antecedência (P-54): com 1 h, o cliente não vê horários na próxima hora. Com a tela de agendar aberta desde antes da mudança, tentar um horário que entrou na janela mostra "Esse horário está muito em cima da hora…". O dono ainda remarca para perto (em 13/10 conferido pela API).
8. Reservas de quem sai (P-61): com uma reserva futura do Contratado, Gerenciar → Pausado é recusado e mostra a reserva; o pedido de saída dele vira "esperando você" sem "Recusar"; ele pode desistir. Reservas de quem já saiu aparecem em "Reservas de quem saiu da equipe".
9. Reconvite (P-59/P-60): convidar quem saiu reativa a pessoa e a ficha; convidar quem está ativo mostra "Esta pessoa já está na equipe".

Registrar o resultado de cada linha no `docs/CONTINUIDADE.md` (o que passou, o que falhou, com print quando ajudar). Primeira rodada: 13/10/2026 (resultados em [pendencias.md](guia/pendencias.md), P-40 e P-41). Segunda rodada, no mesmo dia, depois de P-56 a P-62: [implantacao-equipe-saida-2026-10-13.md](implantacao-equipe-saida-2026-10-13.md), seção 6.

## 8. Apagar tudo

1. Apagar pelo app as fotos enviadas nos testes (serviço, profissional, marca). O script recusa apagar enquanto houver arquivo da loja no armazenamento.
2. Ensaio da limpeza (desfeito no fim):

   ```bash
   sed 's/^commit;$/rollback;/' supabase/manutencao/loja-teste-apagar.sql | docker exec -i "$DB" psql -U postgres -d postgres -X
   ```

   Esperado: `NOTICE: lojas=1 contas=N vinculos_em_loja_real=0 pessoas_reais_na_loja_teste=0 admins=0 fotos_no_storage=0`, `NOTICE: LOJA TESTE APAGADA`, `ROLLBACK`.

3. Limpeza de verdade: o mesmo comando sem o `sed` (`docker exec -i "$DB" psql … < supabase/manutencao/loja-teste-apagar.sql`). Esperado: as mesmas linhas e `COMMIT`.
4. Tirar o bloco `beauty-shop-loja-teste` (e o da B) de `beauty-shop-certs.yaml`, ou voltar o backup do passo 4.
5. Conferir: `select count(*) from public.barbershops where slug like 'loja-teste%'` e `select count(*) from auth.users where email like '%@loja-teste.invalid'` dão `0`.

O script de limpeza só apaga as lojas `loja-teste`/`Loja Teste` e `loja-teste-b`/`Loja Teste B` e as contas `@loja-teste.invalid`. Ele **aborta sem apagar nada** se: alguma conta de teste estiver em equipe, reserva ou aviso de outra loja; alguma pessoa de verdade tiver reservado ou entrado na loja de teste; alguma conta de teste for admin da plataforma ou gerente de conta; ou se sobrar resíduo no fim. Conferido em 13/10/2026 numa cópia da estrutura do banco: loja com equipe de 4, cliente e uma reserva apagadas por inteiro, sem sobrar conta, perfil ou sinal de agenda.
