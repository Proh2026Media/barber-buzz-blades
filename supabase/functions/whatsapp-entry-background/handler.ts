import { advanceCareEntryBackground } from "../_shared/care-entry-background.ts";

type Dependencies = Parameters<typeof advanceCareEntryBackground>;
export async function entryWorkerAuthorized(received: string | null, key: string) {
  if (!received || key.length < 32 || received.length > 8192) return false;
  const digest = async (v: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(received), digest(`Bearer ${key}`)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
/** Endpoint privado sem parâmetros de cliente. Quatro passagens limitam trabalho e recuperam etapas CAS. */
export async function handleEntryBackground(req: Request, authorized: boolean, deps: Dependencies) {
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  if (!authorized) return reply({ code: "42501" }, 401);
  if (req.method !== "POST") return reply({ code: "METHOD_NOT_ALLOWED" }, 405);
  try {
    if (Number(req.headers.get("content-length")) > 1024)
      return reply({ code: "INVALID_REQUEST" }, 413);
    const bytes = await req.arrayBuffer();
    if (bytes.byteLength > 1024) return reply({ code: "INVALID_REQUEST" }, 413);
    const text = new TextDecoder().decode(bytes);
    const body = text ? JSON.parse(text) : {};
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length)
      return reply({ code: "INVALID_REQUEST" }, 400);
    const started = Date.now();
    const states: string[] = [];
    for (let n = 0; n < 4 && Date.now() - started < 45000; n++) {
      const result = await advanceCareEntryBackground(...deps);
      states.push(...result.states);
      if (
        !result.processed ||
        !result.states.some((s) => s === "phone_binding" || s === "phone_revised")
      )
        break;
    }
    return reply({ states });
  } catch {
    return reply({ code: "ENTRY_BACKGROUND_UNAVAILABLE" }, 503);
  }
}
