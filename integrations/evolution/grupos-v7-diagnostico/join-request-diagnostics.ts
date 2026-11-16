/** Contagens privadas: não retorna telefones, LIDs, convites ou identidade do terceiro. */
export async function inspectJoinRequests(
  requests: unknown[],
  expected: string,
  resolve: (jid: string) => Promise<string | null>,
) {
  if (
    !Array.isArray(requests) ||
    requests.length > 100 ||
    !/^[1-9][0-9]{7,14}@s\.whatsapp\.net$/.test(expected)
  )
    throw Error("Pedidos sem prova");
  const matches: string[] = [];
  let unresolved = 0,
    other = 0;
  for (const item of requests) {
    const jid =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as { jid?: unknown }).jid
        : null;
    if (typeof jid !== "string" || !/^[0-9]+(?::[0-9]+)?@(s\.whatsapp\.net|lid)$/.test(jid)) {
      unresolved++;
      continue;
    }
    const phone = await resolve(jid);
    if (!phone) unresolved++;
    else if (phone === expected) matches.push(jid);
    else other++;
  }
  return {
    matches,
    diagnostic: { total: requests.length, matching: matches.length, unresolved, other },
  };
}
