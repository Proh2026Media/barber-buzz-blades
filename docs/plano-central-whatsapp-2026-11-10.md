# Central de WhatsApp — plano e execução (10/11/2026)

## Objetivo

Permitir que a administração reconheça quais telefones existem, quem utiliza cada um e quais barbearias/profissionais ainda precisam de número. O pedido inclui executar a reorganização preservando identidade, permissões, vínculos e funcionamento mobile.

## Plano executado

1. **Barbearias como entrada principal:** cada estabelecimento aparece uma vez, com número geral e equipe expansível. O profissional mostra número próprio, uso do geral ou ausência de número. Busca por loja/profissional e filtros por cobertura.
2. **Inventário em Números:** somente telefones identificados, com telefone em destaque e nome descritivo secundário. Uso, conexão e reserva são estados separados. Filtros Todos, Em uso, Sem uso e Reservas.
3. **Cadastros incompletos:** tentativas sem telefone ficam em uma seção secundária de Números, fora da lista principal. Mostram destino previsto e ações para continuar o cadastro ou aproveitar um número existente.
4. **Códigos de acesso:** área própria para o número exclusivo que envia códigos de cadastro/login, separado dos avisos de agendamento e dos telefones pessoais dos usuários.
5. **Ações consistentes:** a escolha pela barbearia ou profissional abre a mesma janela de vinculação, preenchendo o destino. Reaproveitar um número mantém seus vínculos atuais; a nova associação começa com avisos pausados. A conexão de um telefone novo continua pelo fluxo existente.
6. **Verificação:** regras de cobertura, estados reais de uso, erros, navegação, responsividade, temas e cantos.

## Regras preservadas

- Um número pode servir a várias barbearias/profissionais. Reserva dedicada não entra como candidata a principal.
- O número geral atende profissionais sem vínculo próprio. Um vínculo próprio prevalece mesmo se estiver pausado, desconectado ou incompleto; a interface não inventa um retorno automático ao geral. A lógica visual acompanha `whatsapp_route_link`.
- Conectado não significa avisos habilitados. A tela distingue conexão, preferência de avisos, pausa global e reserva em uso.
- Preparações sem telefone não contam como números cadastrados. Sua existência não significa que uma barbearia esteja atendida.
- Substituir uma preparação continua exigindo desvinculação explícita do destino e conclusão da nova escolha. Falha/cancelamento na segunda ação não é apresentado como vínculo concluído.
- Nenhum vínculo, preferência de envio ou pareamento de produção é alterado apenas pela reorganização.

## Organização por dispositivo

- **Computador:** barbearias em duas colunas desde 1280 px; inventário e detalhes do número lado a lado desde 1024 px.
- **Tablet:** distribuição intermediária; as três áreas permanecem identificadas e a lista de barbearias usa uma coluna legível.
- **Celular:** áreas com ícone/rótulo, barbearias em uma coluna, equipe expansível e navegação lista → detalhe dos números. Janelas usam os componentes existentes.
- Cores, fontes, superfícies, modos de canto e identidade Barba & Cabelo preservados.

## Evidências

- Sete testes novos da cobertura: geral, próprio, preparação própria que bloqueia herança, preparação geral, profissional independente, isolamento por loja e cadastro ausente/telefone vazio.
- Tipos, **499/499 testes**, lint, formatação e montagem aprovados.
- Bancada Chromium na rota administrativa com dados fictícios: escolha pela preparação/barbearia, compartilhamento, número próprio sem alterar o geral, busca/filtros, avisos pausados e reserva ativa.
- **90 combinações:** três áreas × cinco larguras (320, 390, 834, 1024 e 1440) × três cantos × dois temas. Capturas de celular/computador inspecionadas, nomes longos, texto ampliado e manutenção do foco na troca de área.
- Integrações de envio e pareamento foram simuladas; não houve mensagens ou conexões reais nos testes. Validação em aparelhos físicos continua separada.

## Pedido de cadastro pessoal executado

Além da interface, o dono autorizou retirar o telefone da conta de cliente identificada na consulta anterior. A operação foi concluída em transação: telefone, confirmação e autorização de avisos ficaram nulos; códigos pendentes desse telefone e dessa conta foram consumidos. A conta permanece disponível para cadastrar e confirmar outro WhatsApp. Nenhum telefone pessoal foi atribuído a outra conta.

## Implantação

Somente frontend. Sem migration, função Edge ou nova instalação TI. Publicar pelo origin e espelho após a verificação, conforme as regras do projeto.
