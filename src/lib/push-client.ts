import { supabase } from "@/integrations/supabase/client";
import { guardedFetch } from "@/lib/demo-guard";
export const PUSH_OWNER = "bc-push-owner-v1";
export function pushSupport(): "supported" | "install" | "unsupported" {
  if (typeof window === "undefined" || !window.isSecureContext) return "unsupported";
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  if (ios && !installed) return "install";
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window
    ? "supported"
    : "unsupported";
}
export function pushIdentity(session: { user: { id: string }; access_token: string }): string {
  try {
    return (
      session.user.id +
      ":" +
      JSON.parse(atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
        .session_id
    );
  } catch {
    return session.user.id;
  }
}
export async function pushApi(action: string, values: Record<string, unknown> = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("PUSH_SESSION");
  const r = await guardedFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...values }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();
  const {
    data: { session: current },
  } = await supabase.auth.getSession();
  if (!current || pushIdentity(current) !== pushIdentity(session)) throw new Error("PUSH_SESSION");
  if (!r.ok || data.ok !== true) throw new Error("PUSH_UNAVAILABLE");
  return data;
}
export async function currentPush() {
  if (!("serviceWorker" in navigator)) return { registration: undefined, subscription: null };
  const registration = await navigator.serviceWorker.getRegistration("/");
  return {
    registration,
    subscription: (await registration?.pushManager?.getSubscription()) ?? null,
  };
}
export function publicKeyBytes(key: string): Uint8Array<ArrayBuffer> {
  const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error("PUSH_KEY");
  return bytes;
}
