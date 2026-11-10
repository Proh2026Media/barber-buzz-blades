# TI — um número para várias barbearias/profissionais (P-119)

10/11/2026. **Instalação concluída pela TI em 10/11, 16:24:03–16:24:04, conforme [relatório recebido](2026-11-10-p119-instalacao-relatada.md). Não reinstalar. Conferência visual e homologação real pendentes.** Etapas de instalação abaixo preservadas como histórico e referência. O dono pediu compartilhar os números já cadastrados no B&C. Nº 103 instalada às 15:37:35, segundo [relatório recebido](2026-11-10-p118-instalacao-relatada.md). Não reinstalar nº 101–103, não aplicar nº 99/100 e não operar Flow.

## Resultado esperado

Na Central de WhatsApp, selecionar um número já vinculado abre **Quem usa este número**. **Vincular outra barbearia ou profissional → Adicionar vínculo** mantém os destinos existentes e começa o novo com avisos pausados. Habilitar/salvar cada vínculo é uma ação separada. Remover um vínculo pede confirmação e cancela somente suas pendências. Antes de remover ou excluir o último destino, retirar a reserva e voltar ao modo Principal; isso evita deixar um número livre com rota pendente. Exclusão de loja/profissional também aguarda seus envios em andamento/incertos.

A conexão Evolution continua única. Principal/reserva e pausa global afetam todos os vínculos daquele número; a tela informa esse alcance. A reserva é exclusiva do principal físico, podendo atender seus vários destinos. Não há rodízio, troca automática ou troca por banimento. Telefone pessoal e número da plataforma usado no login permanecem separados.

Preferências, modelos e histórico de mensagens continuam por loja. Avisos compartilhados recebem a identificação da barbearia. Preferências do profissional prevalecem sobre as gerais, inclusive quando pausadas. Consentimento e limite global de comunicações por cliente permanecem os da P-116; adicionar vínculo não reinicia contagem.

## Arquivos e ordem

O pacote ZIP contém roteiro, migration, reversão, teste exclusivamente local, duas funções, `COMMIT.txt` e `SHA256SUMS`.

1. `supabase/functions/whatsapp-channel/index.ts`.
2. `supabase/functions/auth-otp/index.ts`.
3. `supabase/migrations/20261110190000_whatsapp_numero_compartilhado.sql` — **nº 104**.

As funções usam o contrato anterior apenas se a nova RPC ainda não existir (`PGRST202/42883`); erros de permissão/rede não permitem esse desvio. Publicar os dois arquivos antes da migration e reiniciar somente o serviço de funções, se necessário à arquitetura instalada. Preservar os demais arquivos/imports, variáveis e segredos. `platform-whatsapp`, dispatcher, Evolution e Auth não precisam de alteração.

## Instalação controlada

Na janela combinada com o dono:

1. Identificar o serviço B&C `z2dbb7dkyzhc8vjiywq34mhn` e conferir SHA-256 do pacote. Confirmar nº 103 presente e nº 104 ausente pela estrutura real, sem inventar controle de migrations.
2. Registrar saúde e contagens da fila, números, vínculos atuais e reservas, sem expor telefones, payloads ou segredos. Aguardar ausência de envios em andamento/resultados incertos antes da implantação. Não reenviar mensagens para limpar fila.
3. Backup completo em diretório protegido (700/arquivos 600), com tamanho, hash e catálogo conferidos; guardar cópia dos dois arquivos Edge atuais e definições das nove funções substituídas. O SQL de reversão contém a base nº 103 conferida localmente.
4. Instalar as duas funções. Conferir importação/saúde e que consultas ainda usam o contrato nº 103. Não parear, iniciar recuperação de conta ou gerar códigos como teste de instalação.
5. Ensaiar **somente a migration** com `BEGIN … ROLLBACK` e `ON_ERROR_STOP=1`. Não executar `supabase/tests/` em produção. A estrutura nova deve desaparecer após o ensaio.
6. Aplicar somente nº 104 em uma transação: `psql -X -v ON_ERROR_STOP=1 -1 -f <migration>`. A migration semeia vínculos equivalentes e fixa a referência dos avisos antigos; não altera conexão, habilitação, reserva, destinatário ou estado da fila.
7. Conferir: um vínculo ativo por destino anterior; mesmos números/instâncias/preferências/reservas; `platform_whatsapp_directory` anuncia `number_sharing=true` quando chamada com contexto administrativo. Sem contexto administrativo deve negar acesso, não contornar a checagem.
8. Conferir RLS e privilégios: leitura direta das associações e auditoria somente admin; sem escrita direta authenticated/anon/service_role nas novas tabelas. Visão efetiva não acessível ao authenticated. `shop_whatsapp_channel` só devolve a loja permitida; preferências por RPC com vínculo, versão e permissão; distribuição somente platform_admin. Helpers internos de escrita sem EXECUTE público.
9. Conferir saúde e cron normais, sem disparar dispatcher manualmente. Abrir central e Ajustes → Avisos com contas autorizadas, somente leitura. Confirmar capacidade instalada, vínculos prévios e controles de cada loja. Frontend segue a publicação normal origin → espelho → Hostinger.

Não alterar os vínculos reais, especialmente Externa Barbearia, por inferência do relatório anterior. Esta instalação não habilita nem distribui números automaticamente.

## Homologação após instalar

Combinar duas barbearias/profissionais de teste, número já cadastrado e destinatário autorizado. Sem criar linhas ou comprar números se há inventário disponível.

1. Adicionar a segunda loja ao mesmo número. Quantidade de números/instâncias não muda; o primeiro vínculo fica intacto e o novo começa pausado. Habilitar explicitamente apenas os avisos de teste necessários.
2. Testar também profissionais de lojas distintas. Um destino já ocupado deve ser recusado; remover seu vínculo anterior exige ação explícita. Não usar transferência antiga para mover todos.
3. Conferir aviso esperado de cada loja no destinatário combinado: identificação correta da loja, mesma conexão física e histórico separado. Conferir que login pessoal continua no número da plataforma.
4. Pausar apenas uma loja e conferir que a outra permanece habilitada. Alterar seus modelos, lembretes e antecedência sem alterar a outra. Remover um vínculo cancela suas pendências; recriá-lo não reaproveita a fila descartada.
5. Com número reserva previamente conectado e falha técnica combinada, escolher reserva explicitamente: ela atende os vínculos do principal. Sem troca automática/rodízio. Resultado incerto bloqueia mudança, sem reenvio automático.
6. Duas telas abertas: gravação com versão antiga recusada, rascunho preservado em erro. Dono/cliente não enumeram vínculos/histórico de outras lojas nem distribuem números.
7. Conferir celular, tablet em pé/deitado e computador físicos: toque, teclado, rolagem, seleção do número e ações por vínculo. A bancada local simulada não substitui esta homologação.

## Reversão

`supabase/rollback/20261110190000_whatsapp_numero_compartilhado.sql`, em transação. Recusa números com mais de um vínculo ativo e qualquer envio em andamento/incerto. Retirar vínculos extras deve ser uma decisão explícita do dono; não remover associações automaticamente para conseguir reverter.

Depois dos pré-requisitos, restaura as nove funções nº 103, remove RPCs/view/triggers novos e preserva tabelas/referências como histórico. Frontend reconhece ausência de `number_sharing` e volta à distribuição antiga; Edge recente recua ao contrato nº 103 quando a RPC não existe. Restaurar cópias Edge se necessário. Não apagar histórico nem reaplicar nº 104 cegamente: preparar avanço compatível com as tabelas preservadas.

## Evidências e relatório de retorno

Bancada PostgreSQL: regressão de 1.383 PASS, incluindo 46 testes de isolamento, fila, reservas, permissões e exclusão. Reversão ensaiada. Handlers reais com dependências simuladas: sete cenários novos; testes gerais, tipos, lint, formatação e montagem aprovados. Central real React no Chromium isolado: compartilhamento, preferência individual, busca por outro destino, remoção confirmada, falha mantendo edição e compatibilidade nº 103. Cartão da loja conferido com vínculo/versão, atualização após conflito e controles de conexão centralizados. Rota `/platform?aba=whatsapp` e acionamento por teclado conferidos. Trinta combinações 320/390/834/1024/1280, claro/escuro e três cantos; sem overflow horizontal. Nenhum número conectado ou mensagem real enviada pelo agente de código.

Devolver relatório com **Responde a: 2026-11-10-ti-whatsapp-compartilhado-p119.md**, commit/hashes, backup, ensaio, horário da instalação, privilégios, saúde e contagens antes/depois. Separar instalação de homologação e relacionar testes reais feitos/pendentes. Não incluir credenciais, códigos ou telefones completos.
