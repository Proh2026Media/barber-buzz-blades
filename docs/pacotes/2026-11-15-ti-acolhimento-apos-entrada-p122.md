# P-122 — descrição e acolhimento somente após o cliente entrar

**Entrega incremental para revisão e próxima janela coordenada. Não executar no meio do piloto atual.** O usuário informou que a TI está testando a v5 e já criou grupo; não recebemos nesta rodada relatório completo das versões instaladas. A sequência anterior preparava o acolhimento antes do convite. O dono mudou a regra e confirmou expressamente que a descrição também deve esperar a entrada. Não é falha de execução da TI.

Não repetir D0, não pedir desenvolvimento à TI e não substituir silenciosamente o ZIP v5. Este pacote só se aplica depois de conferir a v5 completa e seus hashes; divergência exige parar antes de alterar e devolver os nomes/hashes diferentes. Não publicar `main`, editar marca/Flow, trocar telefones pessoais, regenerar segredos, usar Redeploy no Coolify ou criar outro grupo para experimentar a ordem.

## Regra e resultado esperado

| Momento                  | Ações permitidas                                                                                                                              | Bloqueios                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Antes do cliente         | Criar uma vez, nome, logo da loja, dois ou mais números da plataforma administradores, proteções e convite                                    | Sem nova descrição, boas-vindas ou fixação; sem confirmação/login/avisos         |
| Cliente presente e comum | Outro administrador, diferente do criador, envia boas-vindas; depois aplica descrição/regras e fixa                                           | Não confirmar telefone automaticamente nem liberar só por aceite do provedor     |
| Provas completas         | Acolhimento da admissão atual recebido por outra conta autorizada; primeira mensagem recebida pelo criador; composição/proteções/pin vigentes | Só então confirmação de telefone, login e avisos; nunca PV de contingência       |
| Saída/reentrada          | Mesmo JID e fim do ano; nova admissão acolhida uma vez e com prova própria                                                                    | Recibo/pin antigo não prova a nova entrada; marketing/preferências não reiniciam |

Grupo existente com acolhimento/descrição anteriores é preservado. Não apagar mensagens ou descrição automaticamente. Ao conferir presença e nova regra, o worker usa a admissão durável para evitar repetição. Grupo vazio continuará sem mensagem nova. Falha incerta continua em revisão, sem outra tentativa por outro número.

## O que já está entregue

- Evolution `2.3.7-bc.groups.6`, commit `ca986dd`, contrato privado `bc-groups-v4`, capacidade `postAdmissionWelcome=true`. `admissionId` obrigatório na rota de boas-vindas. Convite/aprovação não dependem de mensagem anterior; transmissão revalida presença real.
- Uma migration B&C: `20261115001000_whatsapp_acolhimento_apos_entrada.sql`. Duas colunas privadas para a prova da admissão atual; contratos antigos tornados privados. Revalidação preserva JID, datas, consentimento e preferências.
- Worker e guardas comuns de confirmação/login/avisos alinhados à mesma admissão e mensagem. Cópia completa de dependências, hashes anteriores v5, operador de conferência/instalação/retorno e testes.
- **Nenhuma nova migration Evolution. Nenhuma nova variável de ambiente, webhook, timer ou frontend.** As três SQLs Evolution e os 14 incrementais B&C da v5 não devem ser reaplicados. A leitura usada pela interface continua `cycle_contract=bc-groups-v3`; é distinta do protocolo privado v4 da Evolution. A `origin/main` em `e5f3ec0` foi conferida localmente e seu frontend preservado; não há novo frontend a publicar.

## Preparação da janela — só leitura

1. Receber este ZIP novo, extraí-lo em pasta nova e conferir `SHA256SUMS` e o operador:

```bash
python3 operacao/acolhimento_whatsapp_operacao.py conferir --pacote "$PACOTE_BC"
```

`PACOTE_BC` é o caminho absoluto da pasta extraída. Não usar a variável HOME. Os demais parâmetros abaixo devem receber os caminhos/nomes já conhecidos pela TI, sem exportar segredos no relatório.

2. Registrar versions/hashes instalados, imagem pelo digest, nomes dos serviços, estado dos timers/flags/políticas e piloto atual. Conferir no arquivo de operação anterior que ambiente e Compose continuam coerentes, preservando Web Push e credenciais. Não colar ambiente ou inspect completo.
3. Confirmar que a fonte Edge corresponde integralmente à `base_funcoes` v5 do manifesto; base de banco corresponde às definições/hash e três tabelas Evolution existentes. O operador `base` faz a comparação de funções e SQL. Não exige cópia do `.env` nem deve recebê-la.
4. Guardar backup íntegro dos bancos, fonte de funções e referência de imagem anterior pelo digest, com procedimento de retorno. Imagem nova ainda precisa ser publicada no registry; ID/digest local de bancada não é um destino para o servidor.
5. Combinar a janela com o teste em curso e pedir autorização concreta das operações externas antes de executar. Não pedir ao usuário para mandar código/convite/QR. O pacote não concede nova autorização de produção.

## Imagem preparada — sem migration Evolution

Fonte completa em `evolution/fonte`; patch completo sobre a revisão oficial e patch v5→v6 disponíveis. Escolher um método, nunca aplicar os dois patches. Conferência sem efeito: `git apply --check`. Para publicar a imagem dedicada AMD64, após autorização e login do Guardião no registry:

```bash
python3 evolution/publicar-imagem.py "$CHECKOUT_OFICIAL_EVOLUTION" ghcr.io/ORGANIZACAO/bc-evolution-groups:2.3.7-bc.groups.6 "$EVIDENCIA_IMAGEM_JSON"
```

Substituir ORGANIZACAO pelo namespace real em minúsculas. O checkout precisa conter a revisão oficial `cd800f2976e1e5b682fbf86a01ee4d85ae61f370`. O script reconstrói a fonte exata, confere o patch e devolve o digest do registry, sem instalar. Não publicar a tag v5 por cima. Se a publicação já existir, registrar/conferir o digest e a origem, sem presumir que a tag corresponde.

## Execução autorizada e curta

1. Pausar timers de grupos e distribuição sob a trava operacional já instalada. Pausar egresso WhatsApp global e política de grupos, conservando os valores anteriores para eventual restauração. Web Push continua independente. Aguardar leases e envios em andamento terminarem; não apagar registros, reclassificar resultados incertos ou limpar filas para passar na checagem.
2. Com a base v5 conferida e pausada:

```bash
python3 operacao/acolhimento_whatsapp_operacao.py base --pacote "$PACOTE_BC" --funcoes "$FUNCOES_BC" --db "$CONTAINER_BANCO_BC"
```

Esperado: base v5 íntegra e política desligada. Recusa em qualquer diferença, operação/lease ativo ou SQL incremental já existente. Se o SQL já tiver sido instalado, verificar o relatório e não reaplicar.

3. Autorizar/aplicar **somente** a SQL nova, em transação com precondições e pós-condições:

```bash
python3 operacao/acolhimento_whatsapp_operacao.py sql-bc --pacote "$PACOTE_BC" --db "$CONTAINER_BANCO_BC" --autorizado
```

Nenhuma flag ligada; JIDs/ano/preferências preservados. A operação falha antes do primeiro ALTER com grupos ligados ou efeitos em andamento. Em erro, a transação volta integralmente; não dividir a SQL em trechos.

4. Após autorização da troca, parar somente o container de funções. Copiar dependências com backup novo, sem mexer nos arquivos de segredos:

```bash
python3 operacao/acolhimento_whatsapp_operacao.py funcoes --pacote "$PACOTE_BC" --funcoes "$FUNCOES_BC" --backup "$BACKUP_FUNCOES_NOVO" --db "$CONTAINER_BANCO_BC" --edge "$CONTAINER_FUNCOES_BC" --autorizado
```

Todas as fontes anteriores são conferidas antes da primeira cópia. Interrupção devolve os arquivos anteriores; backup não sobrescrito. Reiniciar somente funções, medir indisponibilidade real e conferir saúde. Não reiniciar Auth/banco/proxy.

5. Com a autorização da imagem/recriação, fixar Evolution no digest publicado v6 e recriar preservando rede/volumes/sessões/segredos conforme a configuração persistente já conferida. Nenhuma SQL Evolution a executar. Medir o retorno HTTP e, separadamente, as sessões WhatsApp; não prometer tempo da bancada.
6. Ler `bcCapabilities` pela conexão interna existente, sem exportar credenciais: deve indicar v4 e `postAdmissionWelcome=true`. Conferir ambas as contas e controles reais. Versão mista deve continuar bloqueada; não adaptar respostas nem afrouxar guardas.
7. Manter piloto restrito à loja/cliente consentidos já configurados; não alargar. Somente após autorização para retomar o piloto, restaurar egresso/flags necessários e fazer uma conferência do ciclo existente, preservando seu identificador. Retomar timers apenas após homologação e autorização do estado anterior, sem duplicar agendadores.

## Aceitação real, sem enviar segredos

1. Cliente ainda fora: nome/logo/proteções e todos os números da plataforma admins, convite disponível; **zero mensagens novas, zero descrição nova e zero pin novo**. A descrição legada eventualmente já presente não é apagada por este incremental.
2. Cliente consentido entra e é observado como membro comum: outro administrador acolhe; depois descrição e pin, com a marca da loja. O cliente precisa ver a mensagem para comprovar a experiência; aceite/observação por outra conta da plataforma não equivale a recibo de leitura do cliente.
3. Enquanto falta prova técnica da admissão, interface não libera confirmar/login. Depois dela, pedir uma confirmação e consumir o código no grupo. Não registrar código/convite nos relatórios.
4. Testar login após telefone confirmado: um código no mesmo grupo, consumo único. Clique repetido/reentrega não duplica acolhimento nem faz fallback em PV. Uso de reserva não contorna restrição.
5. Se for autorizado testar saída/reentrada: mesmo grupo/prazo, novo acolhimento uma vez, recibo antigo insuficiente, preferências/marketing preservados. Não forçar saída só para testar se o titular não autorizou.

Não declarar o login real homologado até esses resultados e a observação do titular. Piloto anterior não comprova automaticamente a nova ordem.

## Falha e retorno

Em falha, pausar política/egresso e timers, preservar diários, JID e filas. Com as funções paradas e mesmos hashes novos, o operador `restaurar-funcoes` aceita o backup exato; não sobrescreve entrega posterior. Se necessário e autorizado, retornar a imagem anterior pelo digest registrado, preservando volume. **Não reativar v5 com a regra antiga**: SQL novo e guardas pós-entrada permanecem bloqueando até alinhar versões; manter pausado e reportar. Não fazer downgrade destrutivo das colunas/tabelas, reaplicar 14 SQLs nem recriar grupo. Retorno integral do banco, se indispensável, exige janela/backup coordenado que não perca dados posteriores.

## Relatório de volta

Responder a `2026-11-15-ti-acolhimento-apos-entrada-p122.md`: hash do ZIP, commits/hashes anteriores e novos, digest registry/AMD64 instalado, horários/indisponibilidades medidos, SQL nova aplicada ou não, fonte/saúde Edge, flags/políticas/timers antes/depois sem valores sensíveis, grupo preservado e resultado de cada etapa antes/depois da entrada. Informar mensagens pré-existentes separadas das mensagens novas. Sem QR, convite, código, telefone completo, ambiente ou token.
