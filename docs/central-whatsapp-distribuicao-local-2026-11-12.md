# Central WhatsApp — distribuição por destino

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
