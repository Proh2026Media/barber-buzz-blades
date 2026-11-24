import { recoverableGroupTransport } from "./recoverable-group-transport.ts";
import { sendGroupLogin } from "./whatsapp-group-login.ts";
import { sendWhatsapp } from "./whatsapp-send.ts";

/** Transporte da Evolution; envios somente pela autorização comum. */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// O contato direto usa wa.me no navegador. Clientes antigos não podem recriar sessões no servidor.
async function evolutionRequest(_path: string, _init: RequestInit = {}): Promise<unknown> {
  throw Object.assign(new Error("WhatsApp automatizado descontinuado"), { status: 410 });
}

export async function evolutionFetch(path: string, init: RequestInit = {}) {
  // O cliente de administração só administra instâncias. Não aceita outros caminhos.
  if (
    (!/^\/instance\/(create|connect|connectionState|fetchInstances|logout|delete)(?:\/|\?|$)/.test(
      path,
    ) &&
      !(path.startsWith("/group/findGroupInfos/") && (!init.method || init.method === "GET"))) ||
    path.includes("..") ||
    /%2e|%2f/i.test(path)
  )
    throw new Error("WA_OUTBOUND_REQUIRED");
  return evolutionRequest(path, init);
}

export function sendAuthorizedWhatsapp(
  ...args: [Parameters<typeof sendWhatsapp>[0], Parameters<typeof sendWhatsapp>[1]]
) {
  return sendWhatsapp(...args, evolutionGroupTransport, groupCycleEnabled());
}

export function instanceNameForShop(shopId: string, slug?: string | null) {
  const base = (slug ?? shopId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = shopId.replace(/-/g, "").slice(0, 8);
  return `shop-${base || "barber"}-${suffix}`.slice(0, 63);
}

export function digitsOnlyPhone(e164: string) {
  return e164.replace(/\D/g, "");
}

/** Administração de grupos separada do transporte de mensagens; somente endpoints protegidos de envio. */
export function evolutionGroupTransport(path: string, init: RequestInit = {}) {
  const match = /^\/group\/([A-Za-z]+)\/[A-Za-z0-9_-]{1,100}(?:\?[^#]*)?$/.exec(path);
  const get = [
    "bcCapabilities",
    "bcInspect",
    "bcCreateStatus",
    "joinRequests",
    "bcInvite",
    "bcCycle",
    "bcOperation",
    "bcCreationStatus",
  ];
  const post = [
    "bcSendNotice",
    "bcSendCode",
    "bcCreate",
    "bcRecoverCycle",
    "bcPrepare",
    "bcPhoneRevision",
    "bcWelcome",
    "bcDescription",
    "bcBrand",
    "bcPinNotice",
    "bcClose",
    "bcAdoptClosing",
    "bcAuthorizePlatform",
    "bcSubject",
    "bcSetting",
    "updateMemberAddMode",
    "updateJoinApprovalMode",
    "joinRequests",
    "bcMember",
    "bcRevoke",
  ];
  if (
    !match ||
    !(init.method === "POST" ? post : !init.method || init.method === "GET" ? get : []).includes(
      match[1],
    )
  ) {
    throw new Error("GROUP_ROUTE_FORBIDDEN");
  }
  return evolutionRequest(path, {
    ...init,
    headers: { ...init.headers, "x-bc-group-key": Deno.env.get("WHATSAPP_GROUP_API_SECRET") ?? "" },
  });
}

/** Não liberar por variável de ambiente antes do piloto de composição/isolamento. */
export function sendAuthorizedGroupLogin(
  db: Parameters<typeof sendGroupLogin>[0],
  input: Parameters<typeof sendGroupLogin>[1],
  recovery = false,
) {
  return sendGroupLogin(
    db,
    input,
    recovery ? recoverableGroupTransport(evolutionGroupTransport) : evolutionGroupTransport,
    groupCycleEnabled(),
    evolutionFetch,
  );
}

export function groupPilotEnabled() {
  return false;
}

/** Contrato novo não herda habilitação de um piloto antigo. */
export function groupCycleEnabled() {
  return groupPilotEnabled() && Deno.env.get("WHATSAPP_GROUP_CYCLE_ENABLED") === "true";
}
