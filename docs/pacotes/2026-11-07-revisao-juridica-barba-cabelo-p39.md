# P-39 — Pacote para revisão jurídica do Barba & Cabelo

**Preparado em:** 07/11/2026. **Destinatário:** profissional jurídico responsável pela revisão dos documentos do aplicativo. A TI participa apenas da confirmação de fatos operacionais.

**Situação:** encaminhamento preparado; revisão profissional ainda pendente. Este arquivo organiza a solicitação e suas fontes. Não é parecer jurídico e não altera os documentos publicados ou suas versões de aceite.

## 1. Solicitação para encaminhar

> Solicito a revisão do Acordo de Tratamento de Dados do Barba & Cabelo e de sua coerência com os Termos de Uso e a Política de Privacidade. O sistema atende barbearias e salões com agendamento, equipe, fidelidade e integrações opcionais. Precisamos de texto revisado ou aprovação por seção, indicação dos fatos que faltam confirmar e orientação sobre quais alterações exigem comunicação ou novo aceite. A revisão deve considerar os países efetivamente atendidos e as versões traduzidas publicadas. A TI fornecerá os fatos técnicos solicitados neste pacote. Não estamos pedindo a ativação de pagamentos, cobranças ou novas integrações.

## 2. Documentos e versão de referência

Os três documentos usam a versão **03/10/2026** no código conferido em 07/11/2026. Ao começar a revisão, registrar a data e a versão efetivamente recebidas; uma versão posterior deve ser identificada, sem misturar os textos.

| Documento                     | Página pública                                                       | Fontes no repositório                                                                              |
| ----------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Acordo de Tratamento de Dados | [Acordo de dados](https://beauty.contheiner.digital/acordo-de-dados) | [acordo-de-dados.tsx](../../src/routes/acordo-de-dados.tsx); textos `legal.dpa.*` nos dicionários. |
| Termos de Uso                 | [Termos](https://beauty.contheiner.digital/termos)                   | [termos.tsx](../../src/routes/termos.tsx); textos `legal.terms.*`.                                 |
| Política de Privacidade       | [Privacidade](https://beauty.contheiner.digital/privacidade)         | [privacidade.tsx](../../src/routes/privacidade.tsx); textos `legal.privacy.*`.                     |

Idiomas publicados: pt-BR, pt-PT, en-US, en-GB e es. O parâmetro `?lang=pt-PT`, por exemplo, seleciona a versão correspondente da página. As fontes ficam em [src/lib/i18n/messages](../../src/lib/i18n/messages/); en-GB herda os textos aplicáveis de en-US. A referência de versões está em [versions.ts](../../src/features/legal/versions.ts).

Identificação pública atualmente usada: **PROH MEDIA AGENCIA DE MARKETING LTDA - ME**, CNPJ **65.789.160/0001-07**, contato **contato@contheiner.digital**, conforme [operator.ts](../../src/features/legal/operator.ts). São os dados informados no aplicativo; a conferência cadastral e da representação deve fazer parte do retorno, se necessária à revisão.

## 3. O que o aplicativo faz hoje

- Gerencia contas, lojas, equipe, permissões, agendamentos e histórico de atendimento.
- Mantém programa de fidelidade por loja. Preços cadastrados e pontos não comprovam pagamentos financeiros.
- Usa infraestrutura Supabase em VPS para autenticação, banco e funções; o site é publicado pela Hostinger.
- Possui envio de avisos de atendimento por WhatsApp via Evolution API e e-mails do sistema. Preferências e confirmação do número participam dos fluxos existentes.
- Oferece conexão opcional com Google Agenda/Contatos, conforme o acesso utilizado.
- Permite ao usuário corrigir o perfil, alterar escolhas de privacidade, baixar seus próprios dados e excluir a conta, respeitando as condições do sistema.
- O acordo descreve a exportação dos dados **da loja inteira** como atendimento manual pela operadora. Isso é diferente da exportação individual automática; a TI precisa confirmar o procedimento operacional e os limites da cópia da loja.
- Registra versões de documentos no aceite. Alterar a versão do acordo pode afetar a apresentação da janela de atualização: [TermsUpdateGate.tsx](../../src/features/legal/TermsUpdateGate.tsx).

Este resumo descreve o código e a documentação consultados. Não é certificação da operação de produção.

## 4. Pontos que pedimos ao profissional para revisar

1. Identificação das partes, representação da barbearia e distinção entre dados de conta e dados tratados para cada loja.
2. Objeto, finalidades, categorias de dados e instruções dadas pela barbearia, incluindo o tratamento de instruções incompatíveis com as obrigações aplicáveis.
3. Confidencialidade, acesso de suporte e coerência entre as medidas descritas e o que a TI consegue comprovar.
4. Relação de fornecedores/suboperadores, regiões de armazenamento e processamento, transferências e procedimento de comunicação de alterações.
5. Responsabilidades e comunicação de incidentes. O texto em pt-PT menciona os artigos 33 e 34 do RGPD; conferir a redação e sua aplicação ao serviço efetivamente prestado.
6. Atendimento aos direitos dos titulares, exportação individual, cópia da loja, exclusão, backups, registros mantidos e efetiva anonimização quando mencionada.
7. Regras de término do serviço, devolução e eliminação de dados, prazos e exceções descritas.
8. Legislação, foro e adequação aos países em que há operação. O acordo menciona LGPD e RGPD, inclusive o artigo 28; esses trechos precisam de revisão profissional.
9. Consistência entre acordo, termos, privacidade e traduções, incluindo as opções reais de comunicação e consentimento do sistema.
10. Registro do aceite, comunicação de mudanças e critério para solicitar novo aceite após a revisão.

Não foi adotada uma interpretação jurídica nova nesta preparação. Os pontos acima delimitam o trabalho solicitado.

## 5. Informações que a TI deve fornecer

Entregar fatos verificáveis, com data da conferência e indicação do que não puder confirmar:

| Informação              | Retorno esperado                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Infraestrutura          | Fornecedor contratado da VPS e regiões efetivas de banco, arquivos e backups. Não basta informar o nome de um domínio. |
| Fornecedores ativos     | Serviços usados para hospedagem, e-mail, WhatsApp e Google; função de cada um e dados efetivamente enviados.           |
| Acesso de suporte       | Quem pode acessar produção, como o acesso é concedido/retirado e que registro existe das operações.                    |
| Retenção                | Prazos efetivos de logs, arquivos e backups; mecanismos de limpeza e limites de exclusão.                              |
| Exportação da loja      | Quem atende o pedido, como confirma o solicitante, o que a cópia inclui e como entrega o arquivo.                      |
| Exclusão e anonimização | O que a operação remove, o que permanece e por qual procedimento; comportamento dos backups e das integrações.         |
| Incidentes              | Canal de recebimento, responsável operacional e procedimento de apuração/comunicação adotado.                          |

O relatório deve usar descrições e evidências técnicas sem credenciais, tokens, cópias de bases ou registros pessoais de clientes. Para a revisão documental, não é necessário enviar dados reais de atendimento. Se o profissional precisar de uma amostra, preparar dados fictícios com o mesmo formato.

## 6. Modelo de retorno do profissional

```text
Responde a: 2026-11-07-revisao-juridica-barba-cabelo-p39.md
Data da revisão:
Responsável pela revisão:
Documentos, idiomas e versões examinados:
Países/operações considerados:

1. Resultado por documento e seção:
   - Aprovado / requer ajuste / depende de informação.
2. Texto final sugerido ou alterações claramente identificadas:
3. Fatos operacionais ainda pendentes e quem deve confirmá-los:
4. Necessidade de comunicação e/ou novo aceite:
5. Traduções que precisam de conferência após os ajustes:
6. Condições restantes para concluir a revisão:
```

## 7. Tratamento do retorno no projeto

1. Incorporar as correções recebidas, mantendo rastreável qual texto foi revisado e qual fato operacional sustenta cada afirmação.
2. Ajustar os idiomas correspondentes e conferir links, apresentação, datas e consistência entre documentos.
3. Atualizar a versão pertinente somente quando houver mudança efetiva; validar o comportamento de aceite e seus registros antes da publicação.
4. Registrar a revisão recebida e os testes em `CONTINUIDADE.md`. Encerrar P-39 apenas quando as condições profissionais e factuais restantes estiverem atendidas.

O envio deste pacote ao profissional é a próxima ação externa. Nenhum documento foi enviado automaticamente e nenhuma configuração foi alterada pela preparação.
