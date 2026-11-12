/** O link atual da barbearia prevalece sobre a loja lembrada após o login. */
export function customerAuthReturn(path: string, shopRef?: string | null): string {
  if (!shopRef || !/^\/app(?:[/?#]|$)/.test(path)) return path;
  const url = new URL(path, "https://bc.example.invalid");
  const previous = url.searchParams.get("shop");
  if (previous && previous !== shopRef) {
    // Horário/profissional da loja anterior não podem acompanhar a troca.
    for (const key of ["barber", "at", "service", "staff"]) url.searchParams.delete(key);
  }
  url.searchParams.set("shop", shopRef);
  url.searchParams.set("join", "1");
  return url.pathname + url.search + url.hash;
}
