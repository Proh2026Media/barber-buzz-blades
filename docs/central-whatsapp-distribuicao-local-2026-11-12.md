# Central WhatsApp — distribuição por destino

## Esclarecimento de identidade — cantos compartilhados

A pedido do dono, a prévia não tem seletor nem estado próprio de cantos. Superfícies e ações herdam `--panel-radius`, `--control-radius` e `--button-radius` do sistema/ambiente. Isso supera os raios fixos/pílulas forçadas da rodada visual anterior. Círculos de seleção e trilhas de switch conservam a forma funcional. A validação injeta temporariamente os três modos somente no navegador de testes, sem criar uma preferência paralela de página.

A antiga pílula “Usa o geral” foi renomeada para “Usa números da barbearia”, com ícone de estabelecimento. Indica herança do principal e das reservas da loja pelo profissional sem configuração própria; não é um número global da plataforma nem um indicador de aquecimento. Continuamos sem métrica de aquecimento: conexão e contagem de vínculos não provam volume, entrega ou saúde de conta. A geração local atual não usa esse indicador inexistente.


## Estatísticas primeiro e geração assistida — somente prévia

Estatísticas/sugestões são o primeiro bloco após o cabeçalho. A ação Selecionar barbearia → Gerar distribuição apresenta a proposta antes de Aplicar na prévia. Não grava no servidor, não habilita avisos e preserva profissionais com configuração própria. Duas reservas reais e telemetria de envio continuam pendentes de contrato/implementação.

Protótipo da heurística implementado em `distribution-suggestion.ts`: considera apenas telefones identificados, conectados e fisicamente distintos. Para principal, compara quantidade de vínculos principais, depois reservas; para reservas, compara reservas, depois principais. Empates usam telefone para resultado determinístico. Desconsidera somente o vínculo geral que será substituído; inclui vínculos próprios dos profissionais. Não consome dados reais de envio, capacidade, fila ou aquecimento e não garante equidade de volume. Há três vagas no máximo; com menos números elegíveis, deixa reservas vazias e informa a quantidade. Proposta fica inválida se os vínculos mudarem antes de aplicar.

Dados úteis para evolução: atendimentos previstos por profissional/loja, profissionais cobertos por herança, clientes com consentimento, fila atual e prazos, volume 7/30 dias, dias ativos, último envio, taxa de falhas/resultados incertos, capacidade definida pelo operador, pausas/restrições e atualidade da confirmação de conexão. Implementar elegibilidade e limites antes da ordenação. Pesos/limiares precisam de definição e validação; não inventar score de saúde nem representar aceitação como entrega. Sugestões não devem disparar failover, alternância, migração de grupos ou mensagens automaticamente. Equidade deve ser avaliada por carga e prazo, não só pela contagem de vínculos.

Ligar/desligar foi reconstruído como botão acessível com `role=switch`, círculo independente e centralizado, trilha 44×26, foco visível, estados desabilitados e operação por teclado. Não depende mais de pseudo-elemento de input para desenhar o círculo.

Verificações reproduzíveis: `npm run test:distribution` e `node scripts/testar-distribuicao-assistida.mjs`, além da matriz de interface existente. Fonte somente local, sem publicação ou nova instalação TI.


## Refinamento aprovado pelo dono — 12/11/2026

Composição aprovada, com ajustes locais: retirar faixas coloridas de uma só lateral, separar melhor as barbearias, arredondar superfícies e usar ações em pílulas. Principal/Reserva continuam identificados por ícone e texto; azul indica seleção/confirmação, verde conexão confirmada e vermelho remoção. Preferências usam ligar/desligar; a escolha de telefone abre opções circulares, sem select nativo. Arrastar e alternativas por teclado/toque permanecem.

**Três números na prévia:** um principal, reserva 1 e reserva 2. As três escolhas são distintas e salvas apenas no estado da prévia. O contrato de produção/local SQL preparado anteriormente ainda aceita somente uma reserva: esta rodada NÃO alterou a migration nem afirma que a segunda já participa dos envios. Na integração real o recurso segue limitado ao contrato disponível. Antes de disponibilizar segunda reserva real, ampliar RPC, banco, concorrência, histórico, revalidação e seleção manual do emissor; nunca descartar silenciosamente a segunda escolha.

**Estatísticas e sugestões são demanda NOVA, ainda NÃO implementada.** A prévia mostra espaços sem valores, identificados como proposta. Desenvolvimento posterior deve medir por telefone: envios aceitos por período (7/30 dias), dias com atividade, usos por destino, último envio e falhas/resultados incertos, distinguindo aceitação de entrega. A distribuição atual não oferece estes indicadores nem recomendações.

“Aquecido” não é um estado verificado nem garantia de conta saudável. Preferir “Atividade recente”, com período e métricas claros. Sugestões futuras devem explicar o critério e a qualidade dos dados, considerar conexão/pausas/capacidade e exigir escolha do administrador; volume isolado não deve gerar selo de segurança nem provocar troca automática ou alternância de números. Primeiro especificar eventos, agregação, período, atualização e critérios; depois implementar e homologar.

Entrega somente local, para aprovação visual do dono. Nenhuma publicação, instalação de migration na VPS, pareamento ou mensagem real. O pacote de iPhone que a TI está revisando não foi substituído.

## Problema e decisão

A reserva era propriedade exclusiva da conexão física: filtros, banco e alguns pontos da fila entendiam que um número reserva não poderia ter outros usos. Isso impedia o principal da Arena de ser reserva no Centro e fazia o detalhe mostrar apenas o primeiro “dono” encontrado.

O papel passa a pertencer ao **destino** — barbearia inteira ou profissional. Exemplo implementado na prévia:

| Destino | Principal | Reserva |
| --- | --- | --- |
| Arena de teste | Número A | Número B |
| Barbearia do Centro de teste | Número B | Número A |
| Outra barbearia/profissional | Pode reutilizar A ou B | Pode reutilizar outro telefone |

Cada par exige dois telefones físicos distintos. Conexões com IDs diferentes do mesmo telefone também não formam um par válido. Profissional sem configuração própria usa o geral; o painel distingue herança de vínculo próprio. Remover um próprio exige confirmação e devolve a herança, sem remover o geral ou vínculos de outras lojas.

## Plano executado

1. Trocar a organização por número/dono global por um quadro de distribuição por destino.
2. Exibir Principal e Reserva lado a lado, com ícones, cores e estados de conexão. Azul identifica principal, âmbar identifica reserva; o texto continua presente.
3. Mostrar o catálogo de telefones com contadores independentes de usos e destacar os locais onde o telefone selecionado aparece. No celular, catálogo compacto em faixa horizontal; no computador, coluna junto aos destinos.
4. Oferecer arrastar como cópia de vínculo e alternativa equivalente por seleção, clique, toque, teclado ou seletor. A alteração vira rascunho: salvar/cancelar são explícitos. Número não é movido de outro destino.
5. Separar conexão do telefone, uso principal/reserva e avisos ligados/pausados. Nova configuração nasce com avisos pausados. Ativação de reserva continua manual e exige confirmação técnica.
6. Preparar o contrato do banco e a fila para operar por vínculo/versão, com histórico e prevenção de edição concorrente. Não aplicar nada na produção nesta fase.

## Como aprovar localmente

Abrir **http://localhost:8090/previsao-whatsapp** no Mac. Não exige login. Os dados são fictícios, e as alterações são guardadas apenas na memória da página. Recarregar ou “Recomeçar prévia” reinicia o ensaio.

Experimentar selecionar um telefone e tocar no campo Principal ou Reserva, arrastar no computador, cancelar, salvar, buscar uma barbearia e personalizar um profissional. As duas lojas iniciais já demonstram papéis invertidos. A prévia está indisponível no build de produção.

O login normal do localhost teve a configuração local alinhada ao domínio atual da API; esta cópia apontava para um projeto antigo. Vite reiniciado, endereço servido e CORS conferidos, sem usar credenciais ou efetuar login. `.env` permanece alteração local e não integra a entrega.

## Fonte e limites

- Quadro: `src/features/platform/WhatsAppDistribution.tsx` e `src/styles/whatsapp-distribution.css`.
- Integração real: `WhatsAppCentral.tsx`, com capacidade `destination_routing`. Sem essa capacidade no servidor, a nova edição permanece desabilitada, em vez de prometer compartilhamento que o banco antigo recusaria.
- Contrato novo: `platform_set_whatsapp_route`, campos por vínculo em `whatsapp_number_links` e snapshot de versão na fila, na migration `20261113001000_whatsapp_distribuicao_por_destino.sql`, **somente local**.
- Login/grupos e identidade física das instâncias não são transferidos pelos gestos do quadro. Usos de envio não concedem acesso às conversas e não criam grupos.
- Textos nos cinco dicionários, identidade visual e modos de canto preservados. Pasta da marca e Flow intocados.

## Verificações

Tipos, montagem, lint dos arquivos alterados e comparação de alterações conferidos. Testes de navegador reproduzíveis:

```sh
node scripts/testar-distribuicao-interface.mjs
node scripts/testar-distribuicao-central.mjs
```

Incluem 21 composições (7 larguras × 3 modos de canto), papéis cruzados, clique/arraste/teclado, rascunho, confirmação de remoção/herança, número repetido e falha simulada que conserva as escolhas. A Central integrada foi exercitada em mais cinco larguras com RPCs fictícias, verificando versão e criação sem habilitar envios. Não é homologação em aparelho físico ou em contas WhatsApp reais.

Testes de banco e concorrência estão em `supabase/tests/whatsapp_distribuicao.sql` e `scripts/testar-distribuicao-concorrencia.py`; executados somente em PostgreSQL descartável. Resultado final: **45 PASS SQL com ROLLBACK e três concorrências reais aprovadas**. Dois ensaios adicionais verificaram a preservação do estado legado. A revisão da fila inclui pausa por instância exata após resultados incertos e adiamento de reserva pausada sem consumir tentativas. O build de produção também foi servido localmente para confirmar que `/previsao-whatsapp` mostra a página não encontrada, sem o quadro fictício.

## Próximo passo

O dono aprova ou ajusta a composição local. Depois da aprovação, preparar um pacote incremental completo para a TI com base exata, hashes, instalação coordenada de banco/frontend, reversão e ensaio; **este documento não é ordem de instalação**. Não executar autossave/push, não reaplicar migrations anteriores e não modificar o pacote que a TI já está executando.
