# Perfil de atividade dos números — preparação local

## Pesquisa e significado

Consultado em 12/11/2026: a [documentação dos remetentes Twilio](https://www.twilio.com/docs/whatsapp/api/senders) distingue conexão, classificação de qualidade e limites. O [guia do próprio fornecedor](https://www.twilio.com/en-us/blog/scaling-whatsapp-business-platform-part-1), publicado em 2023, explica a relação entre qualidade e reação dos destinatários, incluindo bloqueios/denúncias. As regras de limites desse artigo antigo não foram copiadas para o B&C.

Essas fontes não fornecem um cálculo de “aquecimento” que possa ser reproduzido na integração Evolution usada aqui. A conclusão de projeto é manter **perfil operacional interno**, baseado em dados observados, separado da qualidade oficial do WhatsApp. Volume, idade e falta de erros não demonstram ausência de restrições. Não estimular mensagens artificiais nem aumentar volume para conquistar um selo.

## Critério interno v1

Janela: 30 dias civis UTC, incluindo o dia atual. Parâmetros iniciais de produto, propostos nesta entrega, **não são limiares oficiais ou comprovados de aquecimento**.

| Perfil no cartão | Critério |
| --- | --- |
| Sem histórico suficiente | Dados ausentes, inválidos, sem aceites ou medição com mais de 24 h |
| Atividade inicial | Há aceites, sem atingir os mínimos abaixo |
| Atividade regular | Pelo menos 20 aceites, 7 dias ativos e 7 dias observados |
| Histórico consistente | Pelo menos 100 aceites, 14 dias ativos e 14 dias observados |
| Revisar atividade | Há pausa ou resultado incerto na janela, antes de qualquer preferência por volume |

Picos num único dia não substituem o tempo de atividade. O cartão mostra contadores com ícones, descrições acessíveis pelo texto do indicador e detalhes de mouse. Os exemplos da prévia estão marcados como fictícios. Não há score de saúde nem selo de número seguro.

## O que é medido

- Aceites: operações do diário `whatsapp_send_attempts` com estado `accepted`; **não comprovam entrega**.
- Dias ativos: datas UTC distintas com aceites.
- Tempo observado: intervalo desde a primeira tentativa válida da identidade atual na janela; não é a idade da conta WhatsApp, do chip ou da compra do número.
- Incertos: `unknown` e operações `started` sem conclusão após dois minutos.
- Falhas definitivas não têm estado separado nesse diário. Não são inventadas nem confundidas com resultados incertos. Desconexão e pausa são informações distintas.
- Cobertura limitada ao diário de saída protegido do B&C: não representa conversas fora do sistema nem operações da extensão que não alimentem esse diário. Uma integração futura deve ampliar a coleta sem duplicar tentativas ou mensagens.

Não coletar conteúdo, código OTP, telefone do destinatário ou QR para calcular estes indicadores.

## Identidade e instalação futura

Migration nova `20261113002000_whatsapp_metricas_atividade.sql`, somente local. Tabela privada registra quando o telefone atual foi observado conectado à instância; trigger acompanha mudanças. Registros anteriores a essa observação não são atribuídos automaticamente ao número atual, pois a conexão pode ter sido pareada com outro telefone. O primeiro uso em produção começa sem histórico atribuído; não importar retroativamente sem prova de identidade.

A RPC `platform_whatsapp_number_activity` e o diretório administrativo devolvem somente agregados e exigem administrador da plataforma. Sem a migration, a interface permanece com histórico indisponível. Nenhuma consulta nova é enviada ao servidor antigo: as métricas chegam pelo diretório quando ele tiver a capacidade instalada.

## Uso na distribuição assistida

A carga de vínculos continua sendo o primeiro critério. O perfil de atividade desempata candidatos com carga equivalente. Não há preferência por volume bruto ilimitado. Pausados ou com resultado incerto ficam fora da proposta automática para revisão; escolhas manuais mantêm as proteções existentes. Telefones desconectados/repetidos seguem excluídos. Nunca alternar números para contornar restrições ou trocar emissor automaticamente.

Limitação: vínculo é aproximação de carga, não previsão de mensagens. Antes de ativar para dados reais, validar períodos/limiares, capacidade, atualidade da conexão, revisão de incertos e coleta dos fluxos de grupos. O indicador não habilita envio.

## Verificação

`npm run test:distribution` inclui classificação, limites, dados insuficientes/expirados, pausa/incerteza e preferência na proposta. `scripts/testar-atividade-numeros.mjs` confere cartões, exemplos fictícios, proposta e ausência da sombra colorida unilateral. SQL em `supabase/tests/whatsapp_atividade.sql` testa contagem, dias distintos, janela, permissões e troca de telefone; rollback em banco descartável. Os 45 testes anteriores da distribuição também foram repetidos com a nova coleta.

Não instalado/publicado; não altera nem substitui o pacote que a TI já está executando. Próxima janela exige pacote incremental revisado e autorização do dono, preservando as migrations anteriores.
