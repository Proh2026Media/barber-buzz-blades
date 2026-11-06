# P-28 — Coordenação externa para concluir a separação Google do Flow

**06/11/2026 · Para TI/Guardião, com apoio do Claude que desenvolve o Flow.** Objetivo: consolidar a operação restante da separação, enquanto o desenvolvimento aqui volta ao **Barba & Cabelo**. Este arquivo prepara e organiza; **não autoriza instalação, manutenção, migração ou D**.

## Estado que não precisa ser refeito

[#45 conferido pelo Codex](2026-11-06-flow-revisao-pr45-p28.md): integrado em 06/11 às 13:33:35 Brasília, head `4b26a4a800fe9a620b0cd12aa0c197612edd1c03`, merge/main/espelho `4c728e695ac6ad5bbb5d3c2a6c4e8afb60b27684`, mesmo conteúdo. Próprios **181/0/0 ferramentas + 145/145 Vitest + 9/9 independentes**, tipos do app/lint limpos. F1a/F1b/F2a atendidas, F3/retorno/reconciliação preservados. **Sem novo pedido de correção do #45.**

Última leitura própria da VPS: **06/11 às 11:24:07 Brasília**, antes desse merge; index/proteção #36, barreira ausente e serviços saudáveis. É referência com horário, não conferência atual após o merge. O relatório Claude declara nenhuma instalação. P-69, A/B/T1, Picker dos 15, candidato/evidências v2 e custódia atendidos. O cliente de login do B&C deve continuar preservado.

## Responsabilidades e entregas restantes

| Responsável     | Entrega                                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TI/Guardião** | Coordenar preparo de instalação, runtime, corte dos workers antigos, legado, cópia/retorno, janela e relatório operacional consolidado.                                            |
| **Claude/Flow** | Apoiar o procedimento e a versão real dos comandos ainda ausente, no repositório Flow e sob seu AGENTS; testes fictícios/isolados e revisão independente antes de propor uso real. |
| **Alyson**      | Decidir operações reais a partir de procedimento concreto revisado, com escopo, janela, riscos, cópias e retorno apresentados.                                                     |
| **Codex/B&C**   | Manter desenvolvimento do B&C; conciliar o retorno consolidado necessário à P-28 e depois preparar marca/verificação Google do B&C. Não assumir novas funcionalidades do Flow.     |

## 1. Preparar instalação e validar o runtime

- Fixar a versão exata revisada e manifesto dos arquivos. Conferir diferenças da função instalada e preparar cópia protegida/retorno fora da API; sem segredos no relatório.
- Ensaiar o handler em runtime isolado equivalente ao de produção, com dependências e Google/banco fictícios: AsyncLocalStorage, isolamento entre ações, fetch customizado do supabase-js do handler, efeitos capturados pelo cron e escrita de banco com falha. Bun/Vitest não comprovam esse runtime real.
- Apresentar instalação/janela concretas. O AGENTS do Flow restringe instaladores à stack de teste; não contornar a restrição nem passar produção ao instalador fictício/de teste.
- O #45 não altera src. O hook com ticket é do #43; não solicitar outra publicação cega do site por causa do #45. Conferir versão do frontend só se necessário ao procedimento, sem usar a aba Drive/status como diagnóstico sem efeito.

## 2. Preparar transição do legado

- Demonstrar o corte efetivo dos inícios antigos: todos os workers na versão prevista, nenhuma instância antiga, marco de instalação válido. Tratar rollback/reinstalação de forma que um marco anterior não comprove um corte que deixou de existir.
- A proposta de código exige **≥168 h após o marco**, mais recibo de verificação de legado sem órfãos. Confirmar/documentar as premissas; não confundir tempo desde o merge com tempo desde a instalação comprovada.
- Não cancelar sessão, apagar arquivo ou ignorar incerta/órfão para zerar contagens. Apresentar política verificável e decisão necessária. Resposta inesperada/incompleta da listagem deve manter recusa; eventual `sem_files` não autoriza criar recibo manual.

## 3. Preparar a operação D separadamente

Os comandos atuais **continuam aceitando só alvo fictício**. A versão real precisa de especificação/implementação e revisão próprias, sem flag de bypass. Apresentar: alvos identificados, autorização vinculada à operação, cópia fresca após barreira, escrita atômica do par, comparação de referências, aceitação externa sem efeito, retorno pelo posterior conhecido e reconciliação de COMMIT desconhecido sem reaplicação automática.

Sequência proposta, a concretizar/testar antes de pedir decisão: fechar → verificar legado → reconciliar incertas → tratar uploads pendentes → drenar → capturar imagem fresca/promover → aceitar externamente → abrir ou retornar conforme resultado. Divergência ou perda da barreira interrompem a operação. O caminho do cron sugerido no relatório, com reabertura/varredura/reconciliação, também é operação real a incluir no procedimento, não execução autorizada por esta folha.

## 4. Retorno consolidado para o B&C

Concentrar o andamento em **um relatório operacional**, com versões, testes, o que foi preparado e o que foi efetivamente autorizado/executado. Antes de executar, apresentar o procedimento concreto ao dono. Depois da execução autorizada, relatar:

1. Instalação/validação e marco, com horários inequívocos; se ainda não ocorreu, dizer pendente.
2. Resultado do legado/incertas/uploads, só contagens/estados; impedimento deve vir com diagnóstico e decisão exata necessária.
3. D executada ou não, aceitação/retorno e preservação do acervo, serviços e login B&C.
4. Situação do projeto/cliente dedicado do Drive, propriedade/marca e o que falta exclusivamente à verificação Google do B&C.

Não enviar credenciais, URLs de sessão, candidato, cópia B, tokens, IDs privados do acervo ou hashes dessas evidências. Manter custódia atual. Não repetir A/B/T1/Picker dos 15, consentimento/renovação, criação do projeto ou inventários já atendidos; consultar somente metadados específicos que o preparo realmente exigir. DNS/IAM/Branding, revogação de cliente e cobranças não são autorizados por este documento.

**O desenvolvimento do B&C segue em paralelo.** A P-28 continua pendente externa; receber relatório final ou uma decisão necessária não reabre automaticamente uma frente geral de desenvolvimento do Flow.
