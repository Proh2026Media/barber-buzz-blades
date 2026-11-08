# TI — Acesso às contas existentes da Loja Teste

Preparado em **07/11/2026** para destravar a [homologação final do Barba & Cabelo](2026-11-07-ti-barba-cabelo-homologacao-final.md). As contas já existem; ter acesso à VPS não dá à TI a senha dessas contas no aplicativo.

**O primeiro passo do dono é abrir o Acesso às Chaves no Mac e procurar o serviço “Barba e Cabelo - Loja Teste”.** Se não encontrar as senhas ou a TI trabalhar em outro computador sem acesso ao cofre, a alternativa da seção 3 permite à TI redefinir apenas uma senha de teste por vez, preservando a conta.

Aqui, “dono” é a pessoa responsável pelo projeto e pelo Mac onde as senhas foram guardadas. Não é uma solicitação para criar outro usuário do sistema.

## 1. Contas e endereços

O diário de 13/10 registra as senhas definitivas nas **Chaves do macOS**, serviço **Barba e Cabelo - Loja Teste**, com **conta = e-mail completo**. Itens identificados como `temp:<e-mail>` guardam senhas temporárias antigas de convites; não devem ser confundidos com a senha atual.

| Conta                           | Uso esperado; conferir o vínculo atual antes do ensaio                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `dono@loja-teste.invalid`       | Dono da Loja Teste; o histórico posterior também registra Contratado na Loja Teste B.                                   |
| `socio@loja-teste.invalid`      | Sócio da Loja Teste. O último registro da sociedade era 70%/30%, não 50%/50%.                                           |
| `parceiro@loja-teste.invalid`   | Criou a Loja Teste B durante o teste de saída. Não presumir que ainda trabalha na A.                                    |
| `contratado@loja-teste.invalid` | Contratado da Loja Teste; conferir estado ativo.                                                                        |
| `cliente@loja-teste.invalid`    | Cliente de teste.                                                                                                       |
| `cliente2@loja-teste.invalid`   | Cliente que também recebeu vínculo de Parceiro.                                                                         |
| `dono-b@loja-teste.invalid`     | Conta opcional citada no roteiro inicial; sua existência não está confirmada. Não criar só porque aparece nesta tabela. |

- Loja Teste A: `https://loja-teste.beauty.contheiner.digital/auth`.
- Loja Teste B: `https://loja-teste-b.beauty.contheiner.digital/auth`.
- Administração global: sessão administrativa existente no endereço principal `https://beauty.contheiner.digital/platform`, separada das contas da tabela.

**O domínio `.invalid` não recebe e-mail. “Esqueci minha senha” não recupera essas contas por caixa postal.** Não trocar o e-mail para o de um cliente ou usar Google/WhatsApp para contornar esse limite. Os ensaios dessas integrações usam destinatários controlados próprios, conforme o pacote de homologação.

## 2. Caminho preferencial — o dono abre as sessões

1. No Mac onde os testes foram preparados, abrir **Acesso às Chaves** pelo Spotlight (`⌘` + espaço). Procurar por **Barba e Cabelo - Loja Teste** no chaveiro de início de sessão e nos chaveiros disponíveis ao próprio dono.
2. Abrir o item cuja **Conta** seja o e-mail desejado, sem o prefixo `temp:`. Se precisar revelar a senha, o próprio dono desbloqueia o chaveiro com a credencial do Mac. A senha do Mac não é a senha da conta da Loja Teste.
3. Abrir um perfil de navegador dedicado àquela conta, por exemplo **B&C — Dono Teste**, e entrar no endereço da loja. Repetir em perfis separados para Sócio e Cliente. Duas abas ou duas janelas anônimas do mesmo perfil podem compartilhar a sessão; não servem como isolamento garantido para a aprovação entre duas pessoas.
4. Conferir e-mail, loja e papel exibidos. Se aparecer a troca obrigatória de senha, concluir pelo aplicativo e atualizar o item no cofre. Não testar com uma senha temporária já substituída.
5. A TI pode operar essas sessões no computador controlado pelo dono, pelo acesso remoto já autorizado. Se ela usar outro computador, usar compartilhamento restrito no gerenciador de senhas do dono/TI ou a alternativa da seção 3. Não exportar cookies, tokens ou o perfil inteiro do navegador.
6. Ao concluir a homologação, sair das contas e fechar os perfis de teste. Manter as credenciais no cofre para a próxima rodada; registrar apenas que o acesso funcionou.

Não anexar captura da senha nem copiar senha, código ou token para chat, documento, chamado ou relatório. O agente que prepara este roteiro não leu o chaveiro nem conhece essas senhas.

## 3. Alternativa — TI recupera uma conta de teste pela VPS

Usar quando a senha atual não estiver disponível. A nova senha substitui a anterior; **o UUID, os vínculos, os percentuais, as permissões e os dados continuam pertencendo à mesma conta**. A rotina não cria, restaura, confirma e-mail, reativa nem promove usuários. Também não recupera a conta de administração global.

Arquivo: [scripts/recuperar-acesso-loja-teste.py](../../scripts/recuperar-acesso-loja-teste.py). Requer Python 3.8 ou mais recente, Docker e o acesso operacional já existente à **VPS do B&C**. Não instalar bibliotecas Python. Usar um terminal SSH interativo, sem gravação da sessão ou compartilhamento da tela durante a entrada da senha.

1. Na VPS do B&C, abrir a pasta do clone que contém esta entrega. Se a TI recebeu apenas este documento, enviar também o script indicado acima ou obtê-lo no mesmo commit do repositório. Não usar um script copiado do roteiro antigo de criação de contas.
2. Conferir uma conta, **sem alterar nada**:

   ```bash
   python3 scripts/recuperar-acesso-loja-teste.py
   ```

   Digitar o e-mail exato quando solicitado. O programa mostra somente UUID, loja e papéis da conta de teste. Repetir para os papéis necessários, começando por `dono@`, `socio@` e `cliente@`.

3. Se a conta foi conferida e sua senha está indisponível, preparar uma senha única de **16 a 128 caracteres** no cofre privado do dono/TI. Executar:

   ```bash
   python3 scripts/recuperar-acesso-loja-teste.py --redefinir
   ```

   Informar o mesmo e-mail. A senha nova será pedida duas vezes, **sem aparecer na tela**. Não colocar a senha em argumento, variável de shell, arquivo temporário, `curl` ou histórico do terminal. Não usar `set -x`.

4. A rotina encontra somente os containers da stack B&C `z2dbb7dkyzhc8vjiywq34mhn`; recusa seleção ausente ou ambígua. Consulta banco em transação somente de leitura e confere:
   - e-mail pertencente à lista exata da seção 1 e uma única conta existente;
   - Loja Teste A com UUID histórico `16d6da2e-cd2e-4283-9936-2cb6d5e0e834`, nomes/endereço esperados e lojas ativas;
   - vínculo verificável e ativo, sem administração global, gerente de conta ou vínculo em outra loja;
   - equipe, profissional, vínculos de cliente, agendamentos, avisos, preferências e loja fundada sem referência a loja real;
   - Auth e banco apontando para o mesmo UUID/e-mail, identidade de e-mail confirmada, sem suspensão vigente, telefone, provedor externo ou segundo fator.

5. Para conferir o Auth, lê internamente a chave de serviço do container de funções. Depois das conferências, envia **apenas `password`** à API administrativa do Auth, via HTTPS com verificação do certificado e sem seguir redirecionamentos. Chave e senha não aparecem nos argumentos dos processos, saída ou arquivos. Em seguida confere UUID, vínculos e metadados. Não há `UPDATE` direto em `auth.users` nem escrita SQL.
6. Entrar em perfil separado no navegador com a senha guardada no cofre. Conferir papel/loja e eventual troca obrigatória de senha. O script preserva essa exigência; a senha usada depois da troca deve substituir a anterior no cofre.
7. Retomar os cenários da [homologação final](2026-11-07-ti-barba-cabelo-homologacao-final.md). Não executar criação das lojas, certificados, migrations ou limpeza integral para resolver acesso.

**Se houver recusa:** não ampliar a lista de contas nem remover as verificações. Informar o e-mail de teste, a etapa e a mensagem sanitizada. Contas adicionais como `ana-…`/`bia-…`, convite ainda pendente, conta inativa ou ausência de conta exigem conferir o cenário original; não são restauradas automaticamente.

**Se houver erro depois do envio ao Auth:** a senha pode já ter mudado. Não repetir em sequência. Conferir o acesso com a senha que já está no cofre e os vínculos antes de decidir a próxima ação. A consulta ao banco e a chamada ao Auth não formam uma única transação; não alterar a sociedade, os vínculos ou a conta em paralelo durante essa recuperação. O programa confere o estado antes e depois, mas não desfaz alterações concorrentes.

Os testes de administração global dependem da sessão administrativa que o dono já possui. Se ela não estiver disponível para a TI, o dono abre a sessão separada ou executa esses casos acompanhado. **Nenhuma conta de teste ganha administração global por este roteiro.**

## 4. Retorno esperado

Adicionar ao mesmo relatório da homologação, sem credenciais:

```text
Responde a: 2026-11-07-ti-acesso-contas-teste.md
Commit do roteiro/script:
Data/hora:
Caminho usado: sessão aberta pelo dono / redefinição pela VPS
Contas de teste acessíveis (e-mails):
UUID e vínculos preservados: sim / não confirmado
Loja e papel conferidos no aplicativo:
Troca obrigatória de senha: concluída / não solicitada / impedimento
Administração global: sessão do dono disponível / falta sessão
Casos de homologação retomados:
Pendência concreta, se houver:
```

Preparação deste pacote: nenhuma senha foi lida ou redefinida e nenhum acesso à produção foi executado. O script passou por **21 testes com respostas fictícias**; a consulta SQL também foi executada em **somente leitura** no banco local com as 98 migrations, sem criar contas. Isso confere as tabelas/colunas utilizadas, não o estado da produção. O resultado no servidor deve ser registrado pela TI.

Fontes: [roteiro da Loja Teste](../testes-reais-loja-teste.md), [diário de 13/10](../CONTINUIDADE.md) e a API oficial de [atualização administrativa de usuário do Supabase](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), que aplica a alteração pelo UUID e exige uso no servidor. A interface REST correspondente está na [documentação oficial do Auth](https://supabase.github.io/auth/).
