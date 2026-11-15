# TI — P-122: primeiro acesso e correção protegida do telefone

**15/11/2026 — pacote para revisão e planejamento da janela. Não autoriza instalar, publicar, reiniciar, liberar piloto, criar grupo ou enviar mensagem.** Substitui o roteiro suspenso de renovação/entrada; não substitui os relatórios originais nem os ZIPs já instalados. O titular não precisa tentar de novo antes da implantação autorizada e da combinação do piloto.

## 1. O que está pronto e quem executa

O Codex entregou a lógica nas duas aplicações, migrations, interface, funções completas, fonte/patches da Evolution, operador com verificações/backup/retorno e testes locais. A TI não precisa desenvolver a correção, decidir equivalência de telefone nem editar SQL/funções na VPS.

À TI/Guardião ficam: conferir a base real, cofre/registry, backup privado, publicação/pin da imagem na janela autorizada, operação dos containers existentes, instalação dos arquivos e publicação do frontend autorizado. Depois, homologação real com o titular e seu WhatsApp. Não ler/exportar segredos nem pedir códigos, QR, convite ou OTP em relatório.

A correção mantém **mesma conta, grupo/JID e ano**. O titular declara o número correto; consulta privada do WhatsApp prova o PN físico. Somente pedido de entrada autenticado permite conciliar o mesmo grupo. Perfil só muda após consumir o código no grupo. Não inferir equivalência removendo/adicionando o nono dígito.

## 2. Base exata e incrementais

Último estado remoto conhecido: relatório TI 2, **15/11 às 15:00:34 BRT**, pausa global ligada v17, ciclos desligados v12, distribuição desligada v3, timers novos desligados. Esses números de versão são históricos; não reaproveitar CAS antigo. Nenhuma leitura VPS posterior foi feita pelo Codex.

- Evolution instalada: `2.3.7-bc.groups.6-brand.1`, protocolo `bc-groups-v4`, fonte conciliada `ad88eae`.
- Referência instalada relatada: `ghcr.io/proh2026media/bc-evolution-groups@sha256:bb66b337063aa3fb82500642d0e332ff32f94a6a04692d1652b016ca735c9f3e`. Conferir índice OCI, filho AMD64 e config separadamente, sem chamar diferenças entre esses objetos de divergência.
- Funções B&C: base `ad66022950b0e747fa36dcc6cbf0492efbe9c470`, **mais** os dois hotfixes brutos já instalados. `care-cycles.ts`: `d815b844befe027af64965865410d8fd901b13dd123d687195d1c4121e0d9b82`; `care-group-content.ts`: `189d2f721db7c72bd9d23777e371cbeefdc7a2c3aab7893551270348a38b2e74`.
- Frontend publicado: `e5f3ec0a67d2302d0029c61c2eef6fa0a147f996`.
- Já instalados: 14 incrementais de 13–14/11, acolhimento pós-entrada e safeupdate. **Não reaplicar 105–117, os 14 SQLs, acolhimento ou safeupdate.** Os dois arquivos `20261115001000_*` anteriores são distintos e já instalados.
- **Somente novas SQLs B&C:** `20261115002000_whatsapp_primeiro_acesso_assistido.sql` e `20261115003000_whatsapp_revisao_telefone_protegida.sql`, **na mesma transação** preparada em `operacao/bc-atomico.sql`.
- **Evolution nova:** `2.3.7-bc.groups.7`, mesmo protocolo v4, capacidade adicional `protectedPhoneRevision`. **Zero migrations Evolution novas, zero dependências novas.** As três migrations históricas na fonte servem à bancada vazia; não reaplicar na VPS.
- Funções: nova `whatsapp-group-access`, dependências novas e contratos compartilhados atualizados. O manifesto lista todos os arquivos e a base exata; arquivos novos exigem ausência prévia. Não copiar só o `index.ts`.
- Frontend novo: etapas Preparar → Entrar → Confirmar, revisão explícita do telefone e diagnóstico sanitizado. O pacote inclui fonte reproduzível e patch sobre o frontend publicado. Nenhum push realizado pelo Codex.

## 3. Conteúdo e integridade

O ZIP tem `LEIA-PRIMEIRO.md`, `MANIFESTO.json`, `SHA256SUMS`, `COMMIT.txt`, `BASE.txt`, `base/`, `banco-bc/`, `funcoes/`, `evolution/`, `frontend/`, `bancada/`, `operacao/` e `evidencias/`. Não contém `.env`, cofre, sessões, banco de clientes, `node_modules`, `.git`, QR, convite ou código real. O frontend não depende de um build com `.env` do Codex.

Confirme o SHA-256 externo informado na entrega. Extraia em pasta nova, sem misturar pacotes anteriores, e use **caminho absoluto**. Exemplo com variáveis próprias da tarefa, preenchidas com os nomes reais da instalação:

```sh
BC_PACOTE=/caminho/absoluto/BC-Primeiro-Acesso-Telefone-P122-2026-11-15
BC_FUNCOES=/caminho/real/das/functions
BC_DB=container-real-do-banco
BC_EDGE=container-real-das-funcoes
BC_EVO=container-real-da-evolution
python3 "$BC_PACOTE/operacao/primeiro_acesso_telefone_operacao.py" conferir --pacote "$BC_PACOTE"
(cd "$BC_PACOTE" && sha256sum -c SHA256SUMS)
python3 "$BC_PACOTE/operacao/primeiro_acesso_telefone_operacao.py" base --pacote "$BC_PACOTE" --funcoes "$BC_FUNCOES" --db "$BC_DB" --evolution "$BC_EVO"
```

`conferir` e `base` só leem. O operador nunca consulta o conteúdo do ambiente dos containers. Qualquer divergência exige parar e devolver código controlado, arquivo e hash; **não atualizar a base/hashes do pacote para fazer passar**. Se outra entrega já foi instalada, devolver o novo corte antes de seguir.

## 4. Janela de instalação — somente após aprovação específica

1. **Preservar pausa/escopo:** global pausada, ciclos/distribuição/assistência desligados, timers novos off. Aguardar zero leases, transmissões e operações incertas em execução; não apagar diários ou filas para liberar a instalação. Guardião faz backup privado do banco, arquivos e configuração de containers/volumes. Não anexar dump ou segredos ao relatório.
2. **SQL B&C, atomicamente, ainda na imagem antiga e tudo pausado:**

   ```sh
   python3 "$BC_PACOTE/operacao/primeiro_acesso_telefone_operacao.py" sql-bc --pacote "$BC_PACOTE" --funcoes "$BC_FUNCOES" --db "$BC_DB" --evolution "$BC_EVO" --autorizado
   ```

   O operador confere novamente **todas** as fontes/base antes da transação. Hashes de funções, políticas, leases, privilégios e dependências são verificados. Reaplicação é recusada; falha desfaz os dois incrementais. Não instalar um SQL isoladamente nem executar os SQLs da bancada na VPS.

3. **Imagem:** Guardião autentica o registry pelo procedimento existente. Publicação e pin/recriação exigem autorizações separadas. O publicador usa fonte completa já conferida; não precisa reconstruir o patch manualmente:

   ```sh
   python3 "$BC_PACOTE/operacao/evolution/publicar-imagem.py" publicar --pacote "$BC_PACOTE" --destino ghcr.io/proh2026media/bc-evolution-groups:2.3.7-bc.groups.7 --saida /pasta/privada/existente/publicacao-v7.json --autorizado
   ```

   A publicação não instala. Registrar o JSON, índice, filho AMD64 e config. Fixar a referência `pinned` gerada, preservando volumes, sessões, chaves e flags existentes. Medir indisponibilidade real e estado das instâncias antes/depois. A bancada mediu apenas API vazia: **não é previsão de reconexão WhatsApp**. Não recriar banco/Auth/proxy, não mudar webhook ou segredos por causa deste pacote.

4. **Funções:** parar somente o container Edge, instalar o conjunto e reiniciar somente Edge. Não apagar a pasta inteira; outras funções permanecem. Escolher pasta privada de backup **nova**:

   ```sh
   python3 "$BC_PACOTE/operacao/primeiro_acesso_telefone_operacao.py" funcoes --pacote "$BC_PACOTE" --funcoes "$BC_FUNCOES" --db "$BC_DB" --edge "$BC_EDGE" --evolution "$BC_EVO" --evidencia-imagem /pasta/privada/existente/publicacao-v7.json --backup /pasta/privada/existente/backup-edge-v7 --autorizado
   ```

   Confere versão e digest da Evolution, pós-condições SQL e todas as fontes antes da primeira cópia. Copia por substituição e volta ao conteúdo anterior se houver erro durante a troca. Não ativa nada. Verificar carregamento da Edge e que pedido sem JWT é recusado; ausência de chave/capacidade deve falhar fechada, sem tentar WhatsApp.

5. **Frontend:** revisar `frontend/e5f3ec0-para-entrega.patch`, aplicar sobre a versão publicada em ramo separado e compilar usando o procedimento/variáveis públicas existentes. Fonte completa está em `bancada/`. Se a base publicada mudou, parar para conciliação; não sobrescrever entregas novas. **Push/main publica o site** e depende de autorização expressa da etapa. Não usar autossave. Conferir autenticação normal e exibição de indisponibilidade antes do piloto.
6. **Conferência ainda pausada:** conferir versão/capacidade real da extensão via rota privada existente, contrato SQL, funções e frontend; verificar que `assisted_access_enabled=false`, ciclos/distribuição continuam false e pausa global continua true. Timers novos continuam off. Sem clique de cliente, código, criação ou reenvio nessa etapa.

**Não clicar em Redeploy no Coolify.** O relatório anterior informa segredos gravados nos arquivos do servidor; preservá-los e usar o procedimento de recriação já conferido pelo Guardião, depois da autorização específica. Nenhuma chave/variável nova é exigida pelo incremento.

## 5. Piloto real — separado da instalação

Precisamos de autorização da janela e do titular presente, com **conta comum e telefone pessoal final4593**, separado dos remetentes da plataforma (principal8585, reserva5627, conforme o último cadastro confirmado pela TI). Não expor números completos, e-mail, UUID, JID ou convite no retorno público. Confirmar em privado a conta e a Loja Teste; não escolher o dono/admin por suposição.

O escopo já instalado deve continuar restrito ao cliente e loja combinados. Se precisar configurá-lo de novo, `operacao/configurar-piloto.sql` valida o vínculo real e mantém a política desligada; exige `-v shop=UUID_REAL -v customer=UUID_REAL`. Não substituir esses UUIDs por fixtures da bancada.

Com global ainda pausada, administrador global autenticado habilita a assistência pelo contrato **`care_access_admin(true, versão atual)`**; habilitar ciclos usa **`care_group_admin('enrollment', {enabled:true, confirmed:true, version:versão atual})`**, que exige o registry pronto. Cada chamada muda a versão: reler antes da próxima. Não fazer UPDATE direto ou usar versões históricas. A TI já tem os contratos e a operação autenticada; se não houver sessão administrativa legítima disponível, isso bloqueia apenas a liberação, não autoriza fabricar usuário/token.

**Despausar global é uma autorização adicional**, após conferir escopo, composição, instâncias e ausência de filas que poderiam sair junto. Usar o controle administrativo versionado existente. Não ligar distribuição/timers ou liberar todas as lojas para testar um cliente. Havendo histórico pendente, manter pausa e devolver o corte; não drenar às cegas.

Jornada a homologar:

1. Titular entra por Google ou e-mail/senha, abre seu grupo no perfil da Loja Teste. Não testar o WhatsApp como primeira entrada de conta ainda não confirmada.
2. Na revisão, escolhe **Corrigir meu número**, informa o pessoal correto e confirma os números de atendimento apresentados. Também é possível confirmar explicitamente o número mostrado quando ele já for o correto; nenhuma variante é inferida pela interface.
3. O sistema confere somente as conexões consentidas e o candidato. Ausência de prova, cliente/terceiro já presente, composição diferente, número de outra conta verificada ou prazo vencido interrompem o fluxo. Não ajustar `customerJid`, profile, alias ou matrícula manualmente.
4. O titular abre o **mesmo grupo** pelo convite privado recente, solicita entrada com o candidato e volta ao app. A página visível/foco acompanha; não depende de combinar atualização de 30 segundos com uma execução manual da TI. Não fechar o navegador esperando processamento offline garantido.
5. O pedido real PN/LID permite conciliação durável entre B&C/Evolution, mesma criação/expiração e nova admissão. O motor só depois admite como cliente comum. Até aí não deve haver código nem novo acolhimento/descrição/pin.
6. Depois da entrada real: segundo administrador envia boas-vindas, descrição e pin. Conservar o acolhimento antigo no histórico; ele não substitui o recibo da admissão atual. Aguardar as provas exigidas, sem tratá-las como mera aceitação HTTP.
7. Quando a interface liberar, titular toca **Receber código no grupo**, lê e confirma. Sem OTP automático, PV, rotação ou novo grupo. Ao confirmar, perfil passa ao telefone declarado e a página confere novamente o grupo; mudança de identidade não libera envio por conta própria.
8. Sair e testar login por WhatsApp com o telefone declarado; testar agendamento e a mesma conta em outra barbearia consentida em etapa separada. Não cadastrar outra pessoa com o mesmo número nem fundir contas. Sem piloto de marketing automático.

A intenção tem prazo fixo de **20 minutos**. Consulta não estende o prazo; matrícula não equivale a envio. O acompanhamento respeita intervalo mínimo de dez segundos entre tentativas e políticas do servidor. Código tem seu próprio prazo e tentativa. Não há SLA de produção: tempo de ação do titular, WhatsApp e prova de recebimento variam.

## 6. Interrupção e retorno

- Primeira ação: pausar global pelo controle administrativo legítimo e desligar assistência/ciclos por seus contratos versionados. Conservar distribuição/timers desligados. Registrar fase e código controlado, sem payload/convite/OTP. Não apagar provas, intent, alias ou grupo.
- `requested/waiting`: titular pode cancelar no aplicativo; o cancelamento só se conclui com prova remota/lápide. `binding/bound` ou resposta perdida exigem leitura/recuperação da **mesma** operação. Não trocar identidade de volta ou anunciar cancelamento sem saber se o vínculo aconteceu.
- **Com qualquer revisão iniciada, manter imagem7, SQLs e funções novas, pausados.** A imagem6 não conhece o congelamento da revisão: voltar cegamente pode liberar o destinatário errado. Não executar downgrade de schema nem restaurar dump que descarte efeito remoto. Devolver evidência para o Codex.
- Se nenhuma revisão foi iniciada e não há efeitos/leases, o operador permite restaurar arquivos Edge exatos do backup, com container parado e CAS de todos os hashes:

  ```sh
  python3 "$BC_PACOTE/operacao/primeiro_acesso_telefone_operacao.py" restaurar-funcoes --funcoes "$BC_FUNCOES" --db "$BC_DB" --edge "$BC_EDGE" --backup /pasta/privada/existente/backup-edge-v7 --autorizado
  ```

  Não remove os dois SQLs: permanecem inertes com flag false e não reescrevem dados. Eventual retorno da imagem/frontend exige verificar ausência de revisão/efeito e autorização própria. Usar referência anterior exata e preservar volumes. Nunca apagar entrega posterior para restaurar o backup.

## 7. Relatório de devolução

Informar: “Responde a” este arquivo e SHA do ZIP; janela/autorizações; base/hash conferidos; commits e índice/AMD64/config; quais passos foram executados; resultado/rollback dos dois SQLs; backup Edge privado criado; disponibilidade real medida; frontend publicado ou não; flags/versões/escopo/timers finais; etapa do piloto atingida; código controlado e horário de eventual falha.

Identidades e links completos só ficam no registro privado do Guardião. Sem credenciais, `.env`, dump, QR, convite, OTP, corpo de mensagens ou logs brutos. “API aceitou” não comprova entrega, leitura, pin ou login. Sem produção/piloto real, registrar claramente **não homologado**.
