# P-115 — Retomada do pareamento e país automático

**09/11/2026 — Barba & Cabelo.** Correção solicitada pelo dono após aviso de tentativa em andamento na administração; pedido adicional de país automático no campo do telefone.

## Diagnóstico

O relatório TI de 09/11 confirma a primeira instalação (`c49a783`), com três hashes iguais ao repositório, imports Edge sem erro e frontend publicado às 15h44. Não repetir a instalação inicial. Pareamento físico ainda pendente.

Consulta própria de leitura: plataforma em `connecting` no runtime; Loja Teste em `close`; outra loja operacional em `open`. O estado `connecting` não comprova aparelho conectado. O helper antigo recusava toda nova solicitação nesse estado com `PAIRING_IN_PROGRESS`, deixando a pessoa sem recuperação pelo código.

## Correção

1. Solicitação normal em `connecting` informa preparação anterior e oferece **Recomeçar com este número**. Não interrompe a preparação ao abrir a página nem ao primeiro pedido de código.
2. `restart-pairing` exige as mesmas permissões do canal. Reconfere o estado imediatamente antes de encerrar a preparação. `open` retorna conectado, sem logout. Só prossegue após constatar `close`/ausência; falha retorna mensagem recuperável, sem reutilizar código anterior. Não usa delete/restart de instância. A Evolution não oferece comparação e logout atômicos; não operar o mesmo canal em duas janelas enquanto alguém confirma no aparelho.
3. Resposta HTTP 200 com `instanceName` e sem `state`, usada pela Evolution 2.3.7 quando não há instância no runtime, é reconhecida sem depender apenas de 404.
4. País sugerido por preferência manual salva → fuso da loja → fuso do aparelho → região do navegador → idioma do app. É uma sugestão editável, não comprovação de localização. Sem consulta de IP/GPS; não pede permissão de localização. Número pode ser nacional, com DDD, ou internacional completo, sem duplicar prefixo. Só a preferência de país é lembrada; telefone/código não são persistidos pelo formulário.
5. Dependência `libphonenumber-js/min`, com atualização do `bun.lock`. Backend continua recebendo apenas dígitos internacionais; sem migration/env nova.

## Verificações

**452/452 testes** e checagem de tipos, lint, formatação e montagem aprovados. Testes executam helper e handlers reais com dependências simuladas, incluindo permissões do novo recomeço, mudança para `open` entre consultas, encerramento incerto e ausência em HTTP 200. Onze testes de país/telefone cobrem Brasil, Portugal, Reino Unido, França, EUA, DDD 55, número internacional colado e configurações inválidas.

Bancada do navegador: admin em 320/834/1280 px, preparação anterior com saída explícita, nenhuma interrupção automática, telefone nacional normalizado, país alterado ao colar internacional, edição manual, falha recuperável e sessão já concluída. Nenhum aparelho real conectado nesse ensaio.

## Implantação

Correção de runtime: os mesmos três caminhos da entrega inicial — `platform-whatsapp/index.ts`, `whatsapp-channel/index.ts` e `_shared/whatsapp-pairing.ts`. Conferidos contra os hashes do relatório TI antes de substituir. Apenas o serviço de funções B&C poderá ser reiniciado; Evolution, banco, Auth, proxy e demais serviços ficam preservados.

**Estado nesta preparação:** código verificado; aplicação e conferência final do servidor serão registradas abaixo. O ZIP da primeira entrega não deve ser reinstalado por cima desta correção.
