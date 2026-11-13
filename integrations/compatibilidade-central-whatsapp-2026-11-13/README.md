# Referência das fontes instaladas — D0 Central WhatsApp

Estado: evidência de compatibilidade, **não é pacote de instalação**. A TI informou os hashes em `relatorio-ti-d0-central-whatsapp-compatibilidade-2026-11-13.md`, SHA-256 `f23bb3379d4a806760d1e896e76a6b863ab78585eb5c0ea1e7270f4caf7c9681`. Nove arquivos foram localizados nesta máquina e conferidos byte a byte pelo SHA-256. Nenhuma consulta ou alteração da VPS foi feita pelo Codex nesta revisão.

Os arquivos ficam deliberadamente fora de `supabase/migrations` e `supabase/functions`. **Não aplicar, publicar nem copiar por cima do runtime**. As nº 111, 112, 115, 116 e 117 já estão instaladas segundo a D0; nº 113/114 não integram esta referência. As funções deste ramo ainda não foram substituídas pelos arquivos arquivados. O manifesto registra as origens encontradas; as cópias preservam os bytes, mesmo após desaparecerem pastas temporárias.

Conferência local, nesta pasta: `shasum -a 256 -c SHA256SUMS`. Não passar estes SQLs ao banco para “conferir”. Não formatar as cópias: os hashes precisam continuar iguais aos da TI. Testes e execução devem usar um ambiente descartável separado e uma composição de fonte revisada.

Limite: não é backup completo da VPS. Definições instaladas descritas apenas por MD5/resumo no relatório não foram recuperadas por isso; dez arquivos de runtime coincidentes e a extensão atual continuam na fonte ativa. Esta referência permite integrar as correções já conhecidas antes de desenvolver D1–D5, preservando eventos próprios, números pessoais, reservas sem loja e filtro de lojas completas.

A pasta principal do projeto contém versões posteriores de `whatsapp-groups/handler.ts` e `platform-whatsapp/index.ts` com hashes diferentes da produção. Não foram escolhidas como base instalada. Para o receptor foi usado o pacote nº 112 exato, não o arquivo mais novo encontrado no disco.

As cópias usam sufixo `.referencia` para não entrarem na compilação, lint ou instalação automática. Isso não altera seus bytes. `MANIFESTO.json` relaciona o caminho original e compara os 14 arquivos Edge da D0: dez coincidem, três divergem e um não existe neste ramo. Todas as nove referências arquivadas coincidem com os hashes informados pela TI.
