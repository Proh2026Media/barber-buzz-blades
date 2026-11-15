# Codex → TI — complemento de frontend após nº 117: somente números confirmados

Data: 12/11/2026. Projeto Barba & Cabelo. **Correção local verificada; não publicada pelo Codex. Não há migration, função Edge, reinício ou alteração de dados neste pacote.**

## Problema e correção

O dono reforçou que a aba Números não deve apresentar cartões de cadastros sem telefone identificado. A nº 117 já filtra a lista principal, porém a janela de conexão ainda representava tentativas como botões/cartões e usava um cartão de número antes do pareamento.

- Tentativas incompletas passam a um seletor simples na janela “Conectar novo número”, sem cartões na lista nem dentro da janela.
- O conteúdo de pareamento é incorporado diretamente à janela, sem outra superfície de cartão de número.
- Cobertura de barbearia e seleção para vincular usam o mesmo critério de telefone válido do catálogo. Texto como “Sem telefone”, espaços ou estado `open` sem identificação não representa número utilizável.
- Números já identificados permanecem visíveis após desconectar. Não é uma regra de esconder números atualmente desconectados.
- Tentativas, instâncias, histórico e vínculos não são apagados. Retomada reutiliza a tentativa existente; identificação após conexão permite entrada na lista.
- Idiomas e modos de canto preservados. Sem envio, QR real, logout, convite ou alteração de grupos.

## Base e conteúdo

Base publicada: `61cca00e2e5c74bd4a642b22d5cba271fa5b37fa`, da nº 117. Ramo isolado local: `codex/numeros-confirmados-2026-11-12`.

Pacote `BC-Central-Somente-Numeros-Confirmados-2026-11-12.zip`: este roteiro, `frontend.patch`, `BASE.txt`, `COMMIT.txt`, `SHA256SUMS` e imagens de testes fictícios. O patch tem somente dez arquivos de frontend/modelo/testes/dicionários; não inclui `.env`, código local de grupos, banco ou brand kit.

## Como tratar este pacote

Este é um complemento à conferência solicitada em `2026-11-12-codex-para-ti-conferencia-117-e-prontidao-login-p120.md`. Aquele pedido continua sendo somente leitura. **Receber este complemento não autoriza publicar automaticamente.** Conferir o patch e informar a prontidão para publicação; aplicar/publicar quando o Alyson autorizar esta mudança de frontend. Não precisa repetir instalação ou diagnóstico do banco nº 117.

Na publicação autorizada:

1. Conferir os hashes. Partir de checkout limpo da main atualizada e comparar a base. Se houver alteração posterior nos mesmos arquivos, revisar o conflito sem sobrescrever.
2. Executar `git apply --check frontend.patch`; depois aplicar o patch. Não copiar o ramo local inteiro nem o diretório do desenvolvimento de grupos.
3. Rodar checagem de tipos, testes, lint dos arquivos e build. Publicar somente essa mudança pelo `origin`, no fluxo habitual, sem force-push ou envio exclusivo ao espelho.
4. Conferir a entrega em produção como administrador: lista sem cartões vazios; número desconectado identificado preservado; novo número abre janela; tentativas disponíveis somente no seletor; fechar e recarregar sem duplicação.
5. Não iniciar QR, código ou pareamento, não enviar mensagem, não mudar principal/reserva, não ativar cron ou piloto. Não executar migrations, nem nº 113/114/117, nem Redeploy no Coolify.

Reversão, se necessária: reverter somente o commit deste complemento e republicar o frontend, preservando mudanças posteriores. Não executar `reversao-117.sql`, pois o banco não foi alterado por este pacote.

## Verificação do Codex

- Tipos e build aprovados; lint dos componentes/modelo sem erros.
- 572 testes de código, zero falhas. Inclui estado aberto sem telefone válido e número identificado após desconexão.
- Interface simulada em 320/390/768/834/1024/1440 px, três modos de canto e dois temas: 36 combinações.
- Conferidos lista sem cartões vazios, identificação posterior, Escape, recarga, seletor de retomada, ausência de cartão dentro do pareamento e criação/retomada sem duplicação.
- Chamadas da bancada interceptadas com dados fictícios; nenhuma mensagem ou operação de pareamento real.

A sessão localhost anterior estava servindo a cópia de desenvolvimento anterior à nº 117. Foi substituída pela base isolada atualizada na mesma porta 8090. Isso não publicou o site nem sincronizou o ramo local de grupos.

## Devolutiva

Responder com nome deste roteiro, estado (revisado / aguardando autorização / publicado), hash/base, commit publicado se houver, horário, resultado dos testes e conferência visual. Se houver impedimento, informar o arquivo e a divergência concreta. Não enviar segredos, QR, convites ou dados pessoais completos.
