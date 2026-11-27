/** Identidade homologada do piloto. A interface só oferece o fluxo nesta origem. */
export const lojaPiloto = {
  id: "bc8595cb-72a7-4428-8a9c-97fe12c18222",
  slug: "loja-teste-b",
  origem: "https://loja-teste-b.aurset.app",
} as const;

export function noPiloto() {
  return typeof window !== "undefined" && window.location.origin === lojaPiloto.origem;
}

export function suportaChave() {
  return noPiloto() && typeof window.PublicKeyCredential === "function" && !!navigator.credentials;
}
