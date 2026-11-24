/** Cadastros autorizados a usar a assinatura de parceria quando estão sem logo. */
const parceiras = new Set([
  "d44c850f-efc7-4fa0-9c12-9bd5623965c1", // Arena — Testes
  "16d6da2e-cd2e-4283-9936-2cb6d5e0e834", // Loja Teste
  "bc8595cb-72a7-4428-8a9c-97fe12c18222", // Loja Teste B
]);

export function tipoDeSelo(lojaId?: string | null) {
  return lojaId && parceiras.has(lojaId) ? "parceria" : "iniciais";
}
