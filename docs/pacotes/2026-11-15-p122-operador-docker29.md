# P-122 — compatibilidade do operador com Docker29

**15/11/2026. Diagnóstico durante a conferência autorizada pelo usuário via Hostinger/SSH.** A conferência anterior bloqueou antes de qualquer SQL, reinício de serviço ou alteração de dados. Somente pasta privada de preparação e transferência de artefatos foram iniciadas. O ZIP v1 fica preservado; esta correção entra no pacote v2 completo.

## Evidência e correção

VPS Docker29.7.2, Linux/AMD64: container.Image e image.Id são o manifesto `sha256:bb66b337063aa3fb82500642d0e332ff32f94a6a04692d1652b016ca735c9f3e`, também presente no descritor OCI e RepoDigests. O rótulo continua `2.3.7-bc.groups.6-brand.1`. Não houve troca da imagem relatada pela TI. As 29 fontes do backend coincidem com o manifesto de base. Global pausada v17, ciclos false v12, distribuição false, zero leases/transmissões/tentativas iniciadas ou incertas; assistência/revisão novas ainda ausentes. Oito instâncias existentes, todas registradas no catálogo B&C; cinco estavam abertas no corte. Não foram lidas mensagens ou exportados segredos.

O operador v1 confundia o Image ID com o digest da configuração `642f12b6…`. O operador revisto reconhece as três identidades **já registradas** da mesma imagem: configuração642f, manifesto AMD64 bb66 e índice OCI e8ce. Continua exigindo RepoDigest conhecido e agora também exige explicitamente Linux/AMD64 e o rótulo6-brand.1. ID desconhecido, arquitetura/versão divergente ou RepoDigest estranho continuam recusados. Não alterar hashes manualmente na VPS para passar.

Não muda SQL, função, frontend, imagem7, telefone, grupo, consentimento ou política. A única correção de execução é no verificador do pacote; fixtures/testes acompanham a representação de imagem correta. A cópia e o retorno continuam conferindo todos os arquivos antes da primeira alteração e recusando retorno após revisão iniciada.

16 testes do operador cobrem Docker clássico, IDs por manifesto/índice do Docker29, rejeição de identidade/arquitetura/versão divergentes, integridade, falha de cópia e retorno. Repetir o ensaio completo da instalação/cópia/retorno antes do ZIPv2. Autorizações do usuário para esta implantação não liberam piloto/envios: permanecem desligados até homologação combinada com o titular.
