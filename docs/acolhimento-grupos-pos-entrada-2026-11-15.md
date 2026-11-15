# Grupos — acolhimento depois da entrada, 15/11/2026

O usuário relatou que a TI testava a v5, já havia criado grupo e observado mensagem/descrição antes da entrada. Confirmou a nova ordem: antes, nome/foto/administradores/proteções/convite; depois, boas-vindas, descrição, pin e prova, liberando confirmação/login. A v5 seguia a ordem anterior; esta entrega é mudança de regra, não falha do executor.

## Implementação local

Evolution v6 `ca986dd`, protocolo privado v4 e capacidade explícita. Boas-vindas exigem admissão UUID e cliente comum presente antes do comando e imediatamente antes da transmissão. Descrição e pin também exigem presença. Convite/aprovação só dependem do preparo estrutural, evitando que a remoção da mensagem prévia impeça o cliente de entrar. Criador continua impedido de enviar primeiro; nunca há promoção do cliente.

Worker B&C prepara antes e acolhe depois da presença real. Um mapa durável admissão→operação evita repetir a mensagem durante espera, reinício ou reentrega. Acolhimento incerto não permite nova tentativa nem uso de outra conta para reenviar. Reentrada precisa de prova da mensagem atual; recibo/pin antigos não liberam. Pin anterior é invalidado ao registrar nova intenção de acolhimento.

Nova SQL B&C `20261115001000_whatsapp_acolhimento_apos_entrada.sql`: prova privada da admissão/mensagem atuais, convite antes de mensagens, observação estrutural separada da liberação, contextos de login/avisos com a mesma prova. Migração só pausada e sem execução em andamento; nenhuma flag ligada. Contratos anteriores privados, sem possibilidade de contorno pelo navegador ou service role. As três migrations Evolution e os 14 incrementais v5 são preservados. Campos derivados da Evolution são reconciliados do diário/evidências existentes, sem nova tabela/migration.

Mesmo grupo, JID, ano, consentimentos e preferências preservados. Grupos v5 revalidados sem apagar mensagem ou descrição antiga e sem recriação. Ausência do cliente não causa nova mensagem/descrição/pin. Aprovação é observação de entrada, não confirmação de telefone ou prova de leitura do cliente.

## Estado e verificações

632 testes B&C, tipos de frontend e Edge estritos, lint, formatação e montagem; 54 testes Evolution e 16 PostgreSQL/duas conexões. Ensaio integrado com banco B&C real descartável + socket fictício cobre antes/depois da entrada, espera sem duplicação, confirmação, login, reserva com principal offline, aviso com nome da loja, saída/retorno, ano, fechamento e limpeza. Instalação com piloto ligado ou lease ativo é recusada e desfeita. As 25 verificações SQL testam convites estruturais, prova da admissão, reentrada e privilégios. O instalador foi executado na bancada v5 limpa: preservou grupo/ano/admissão/preferências, recusou reaplicação e copiou/restaurou as 26 dependências Edge pelos hashes exatos, mantendo a política desligada. Operador tem sete testes de integridade/cópia/retorno.

Imagem `bc-evolution-central-local:2.3.7-bc.groups.6` construída AMD64, iniciada/recriada em rede Docker interna sem sessões WhatsApp. Índice local `726c9158cac397592a2ad76aff3f78680e983cd73b47b24b019fbf96b11429b1`, configuração `c96afb58ee06053f86d8caaadc4fb4fd6a542e7d5a0741775bc4c6fe4e99215e`; 17,275 s entre parada/recriação e prontidão HTTP local, volume sentinela conservado. Não mede reconexão WhatsApp nem prevê indisponibilidade real. Nenhum registry publicado.

Frontend main `e5f3ec0` foi incorporado sem refazer sua entrega: é o mesmo frontend aprovado da entrega anterior, incluindo polling. Protocolo externo da interface continua v3; privado Evolution passa a v4. Nenhuma UI, marca, Flow, `.env`, Web Push ou VPS foi alterada. A prévia localhost anterior foi preservada.

## Entrega e próximo passo

[Roteiro incremental TI](pacotes/2026-11-15-ti-acolhimento-apos-entrada-p122.md). Pacote v6 novo com uma SQL B&C, dependências completas, hashes v5, fonte/patch Evolution, operador, testes e retorno. O ZIP v5 entregue em 14/11 permanece intacto. TI deve concluir/parar de forma coordenada o ensaio atual, conferir estado real e aprovar a janela; não instalar novo conjunto durante uma operação.

Trabalho salvo em ramos locais, sem autossave/push/main, mensagem real ou autorização de produção inferida. Login real e nova ordem ainda dependem da janela e homologação consentida pela TI/titular. Não pedir nova D0 nem atribuir desenvolvimento à TI.
