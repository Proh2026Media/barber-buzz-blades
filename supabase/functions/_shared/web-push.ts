export type WebSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
const providers = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);
export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      (providers.has(u.hostname) ||
        /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:notify|wns)\.windows\.com$/.test(u.hostname)) &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      (u.pathname.length > 1 || u.search.length > 1) &&
      !/\s/.test(value)
    );
  } catch {
    return false;
  }
}
export function validSubscription(value: unknown): value is WebSubscription {
  if (!value || typeof value !== "object") return false;
  const s = value as WebSubscription;
  return (
    validPushEndpoint(s.endpoint) &&
    typeof s.keys?.p256dh === "string" &&
    /^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh) &&
    typeof s.keys?.auth === "string" &&
    /^[A-Za-z0-9_-]{22}$/.test(s.keys.auth)
  );
}
export function allowedPushOrigin(origin: string, rules: string[]): boolean {
  try {
    const u = new URL(origin);
    if (u.origin !== origin || u.username || u.password) return false;
    return rules.some((rule) => {
      if (!rule.includes("*")) return rule === origin;
      if (!rule.startsWith("https://*.") || u.protocol !== "https:" || u.port) return false;
      const host = rule.slice(10);
      return /^[a-z0-9.-]+$/.test(host) && u.hostname.endsWith("." + host) && u.hostname !== host;
    });
  } catch {
    return false;
  }
}
export function pushMessage(
  locale: string,
  kind: string,
  target: string,
  id: string,
  shopName?: unknown,
) {
  const language = locale.startsWith("en") ? "en" : locale === "es" ? "es" : "pt";
  const copy = {
    pt: {
      test: "As notificações deste aparelho estão funcionando.",
      created: "Há um novo agendamento. Abra o aplicativo para conferir.",
      changed: "Um agendamento foi atualizado. Abra o aplicativo para conferir.",
      cancelled: "Um agendamento foi cancelado. Abra o aplicativo para conferir.",
    },
    en: {
      test: "Notifications are working on this device.",
      created: "There is a new appointment. Open the app to check.",
      changed: "An appointment was updated. Open the app to check.",
      cancelled: "An appointment was cancelled. Open the app to check.",
    },
    es: {
      test: "Las notificaciones funcionan en este dispositivo.",
      created: "Hay una nueva cita. Abre la aplicación para verla.",
      changed: "Una cita se actualizó. Abre la aplicación para verla.",
      cancelled: "Una cita se canceló. Abre la aplicación para verla.",
    },
  };
  if (!["test", "created", "changed", "cancelled"].includes(kind)) throw new Error("PUSH_KIND");
  // Identidade comercial da barbearia; sem nome do cliente, telefone ou código na tela bloqueada.
  const title =
    typeof shopName === "string"
      ? shopName
          .replace(/[\p{Cc}\p{Cf}]/gu, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 100)
      : "";
  return {
    title:
      title || (language === "en" ? "Appointments" : language === "es" ? "Citas" : "Agendamentos"),
    body: copy[language][kind as keyof typeof copy.pt],
    url: target === "/shop" ? "/shop" : "/app",
    tag: "bc-" + id,
  };
}
export async function deliverWebPush(
  subscription: WebSubscription,
  prepare: () => { endpoint: string; headers: Record<string, string | number>; body: Uint8Array },
  transport: typeof fetch = fetch,
): Promise<"accepted" | "gone" | "failed" | "unknown"> {
  if (!validSubscription(subscription)) return "failed";
  let request: ReturnType<typeof prepare>;
  try {
    request = prepare();
  } catch {
    return "failed";
  }
  if (request.endpoint !== subscription.endpoint) return "failed";
  try {
    const response = await transport(request.endpoint, {
      method: "POST",
      headers: Object.fromEntries(Object.entries(request.headers).map(([k, v]) => [k, String(v)])),
      body: request.body as BodyInit,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    await response.body?.cancel();
    if ([200, 201, 202].includes(response.status)) return "accepted";
    if (response.status === 404 || response.status === 410) return "gone";
    // Falha/timeout não prova que o provedor rejeitou: não reenviar automaticamente.
    return response.status >= 500 ? "unknown" : "failed";
  } catch {
    return "unknown";
  }
}
