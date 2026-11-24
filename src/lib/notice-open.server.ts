// O recibo identifica um único aviso. A resposta pública é igual para todos os tokens válidos.
export async function noticeOpen(request: Request, url: URL) {
  const email = url.pathname === "/avisos/abertura/email";
  if (request.method !== (email ? "GET" : "POST")) return new Response(null, { status: 405 });
  const token = url.searchParams.get("t") ?? "";
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(token))
    return new Response(null, { status: 400 });
  const api = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const result = await fetch(new URL("/rest/v1/rpc/record_notice_open", api), {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_channel: email ? "email" : "push" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!result.ok) return new Response(null, { status: 503 });
  const headers = { "Cache-Control": "no-store", "Content-Type": "image/gif" };
  return email
    ? new Response(
        Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) =>
          c.charCodeAt(0),
        ),
        { headers },
      )
    : new Response(null, { status: 204, headers });
}
