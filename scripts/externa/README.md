# Espelho da Externa Barbearia

A VPS lê a planilha de reservas da Externa a cada cinco minutos. Na ficha do estabelecimento no painel global, o monitor mostra a última leitura, o total de linhas, os vínculos com a agenda e as linhas que precisam de revisão. Uma falha conserva o último retrato válido. Sem uma leitura bem-sucedida por quinze minutos, o painel sinaliza o atraso.

O leitor consulta o arquivo indicado pelo estabelecimento em modo de leitura. A aba de reservas é identificada por `gid=0`. Cada linha conserva todas as colunas de origem, inclusive o e-mail informado e a página de reserva. Colunas extras e outras abas listadas pelo Google ficam no espelho privado. A criação de reservas usa o modelo conhecido da aba principal. [Planilha de origem](https://docs.google.com/spreadsheets/d/1fqb5vW5Y1vJ7-OCbK6vs8LN2SolXsjjbU5bRt3ESqUc/edit?gid=0)

Datas com barras seguem dia/mês/ano. Os dígitos de hora e minuto são os do relógio da barbearia, mesmo quando a origem traz um sufixo como `Z`. O banco armazena o instante necessário para exibir esse mesmo dia e horário na Externa. O carimbo da reserva é a base de identificação. A referência privada da migração conserva as correspondências revisadas em 25/11/2026.

O leitor reutiliza as fichas e os identificadores da importação. Uma colisão com a agenda ou um telefone inválido fica pendente até a próxima leitura que possa conciliá-los. Se uma linha sair da planilha, o leitor registra a ausência e preserva a reserva no sistema. O ciclo usa uma transação e registra a última leitura junto com os dados. Os dados nominais e a referência privada ficam restritos à VPS.

## Operação na VPS

- `systemctl list-timers aurset-externa-espelho.timer` informa a próxima execução.
- `journalctl -u aurset-externa-espelho.service` mostra contagens ou o código da falha.
- Na pasta `/opt/aurset/externa-espelho`, `python3 -B espelho.py --ensaio` compara o estado atual em uma transação revertida. `systemctl start aurset-externa-espelho.service` executa uma leitura completa.
- Para aposentar a planilha, execute `systemctl disable --now aurset-externa-espelho.timer` e aguarde eventual execução do serviço terminar. A agenda e as fichas continuam na plataforma.

O dono da Externa e o administrador com acesso à ficha podem consultar o e-mail informado em cada reserva, com sua data e hora. Esse e-mail é um dado da reserva. A confirmação do endereço da conta continua no fluxo de autenticação.

Para reinstalar, gere `referencia.json` com `leitor.py preparar-referencia DIRETORIO_DA_MIGRACAO DESTINO`. Proteja o arquivo com modo 0600 na pasta 0700 da integração. Ao substituir uma referência em uso, transfira para um nome temporário e só depois renomeie o arquivo completo. Aplique `instalar.sql`, `monitor.sql` e `contatos.sql` numa transação administrativa, confira o ensaio e só então ative o timer. O arquivo de referência e as exportações com clientes ficam fora do Git.
