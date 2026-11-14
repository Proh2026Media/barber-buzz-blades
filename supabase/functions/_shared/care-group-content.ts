/// <reference lib="es2022.intl" />
/** Modelos controlados. A identidade apresentada ao cliente é sempre a barbearia. */
const clean = (value: unknown, limit: number, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const text = value
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  let out = "";
  for (const { segment } of new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(
    text,
  )) {
    if (out.length + segment.length > limit) break;
    out += segment;
  }
  return out || fallback;
};
export function groupPreferencesUrl(slug: string, origin = "https://beauty.contheiner.digital") {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) throw new Error("GROUP_SLUG_INVALID");
  const base = new URL(origin);
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.port ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error("GROUP_ORIGIN_INVALID");
  return `https://${slug}.${base.hostname}/app?tab=conta&focus=grupo`;
}
export function annualGroupExpiry(creation: number) {
  if (!Number.isSafeInteger(creation) || creation <= 0) throw new Error("GROUP_CREATION_UNPROVEN");
  const date = new Date(creation * 1000);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  if (!Number.isFinite(date.getTime())) throw new Error("GROUP_CREATION_UNPROVEN");
  return date.toISOString();
}
export type GroupBrand = {
  shop_name: unknown;
  customer_name: unknown;
  slug: string;
  timezone: string;
  origin?: string;
};
export type GroupContent = GroupBrand & { expires_at: string };
/** A mesma forma canônica entra no hash, no diário e na mensagem; nunca guarda e-mail. */
export function careGroupBrand(input: GroupBrand): GroupBrand {
  if (
    typeof input.shop_name !== "string" ||
    !input.shop_name.trim() ||
    input.shop_name.length > 120 ||
    typeof input.customer_name !== "string" ||
    input.customer_name.length > 200 ||
    typeof input.timezone !== "string"
  )
    throw new Error("GROUP_BRAND_INVALID");
  groupPreferencesUrl(input.slug, input.origin);
  new Intl.DateTimeFormat("pt-BR", { timeZone: input.timezone }).format(0);
  return {
    shop_name: clean(input.shop_name, 80, "Barbearia"),
    customer_name: clean(
      input.customer_name.includes("@") ? null : input.customer_name,
      40,
      "cliente",
    ).split(" ")[0],
    slug: input.slug,
    timezone: input.timezone,
    ...(input.origin ? { origin: input.origin } : {}),
  };
}
export function careGroupContent(input: GroupContent) {
  const shop = clean(input.shop_name, 80, "Barbearia");
  const customer = clean(
    typeof input.customer_name === "string" && input.customer_name.includes("@")
      ? null
      : input.customer_name,
    40,
    "cliente",
  ).split(" ")[0];
  const expiry = new Date(input.expires_at);
  if (!Number.isFinite(expiry.getTime())) throw new Error("GROUP_CYCLE_INVALID");
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: input.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(expiry);
  const link = groupPreferencesUrl(input.slug, input.origin);
  const welcome = `👋 Olá, ${customer}! Este é seu grupo de notificações da ${shop}.\n\n📅 Confirmações, alterações e lembretes de agendamentos.\n🔐 Códigos de acesso e de confirmação do telefone, somente quando você solicitar.\n🎁 Promoções somente com sua autorização, até o limite escolhido no aplicativo (máximo de 3 por mês).\n\n⚙️ Ative ou desative os avisos e as promoções em Perfil → Grupo de notificações.\n${link}\n\nEste grupo é automático: as preferências são alteradas somente no aplicativo. Sair do grupo interrompe os envios. Você pode solicitar o retorno até ${date}, quando este ciclo termina.`;
  const description = `Grupo automático da ${shop}. Agendamentos e códigos solicitados. Promoções só com autorização (até 3/mês). Preferências somente no aplicativo: ${link}\nVocê e números autorizados da plataforma. Profissionais não acessam as conversas. Válido até ${date}.`;
  return { welcome, description, preferences_url: link, version: "grupos-2026-11-14" };
}
export function careGroupCode(shop: unknown, purpose: "login" | "verify_phone", code: string) {
  if (!/^\d{6}$/.test(code) || !["login", "verify_phone"].includes(purpose))
    throw new Error("GROUP_CODE_INVALID");
  return `${clean(shop, 80, "Barbearia")}\n${purpose === "login" ? "Seu código de acesso" : "Código para confirmar seu WhatsApp"}: ${code}\nVálido por até 10 minutos. Não compartilhe este código.`;
}
