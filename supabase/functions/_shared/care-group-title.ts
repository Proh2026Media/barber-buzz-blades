/** Título cosmético; identidade e autorização continuam exclusivamente no JID. */
export type CareGroupTitle = {
  shop_name: string | null;
  customer_name: string | null;
  timezone: string;
  starts_at: string | null;
};
const clean = (value: string | null, fallback: string) =>
  (value ?? "")
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim() || fallback;
const shorten = (value: string, limit: number) => {
  if (value.length <= limit) return value;
  let out = "";
  for (const { segment } of new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(
    value,
  )) {
    if (out.length + segment.length > limit - 1) break;
    out += segment;
  }
  return out.trimEnd() + "…";
};
export function careGroupTitle(value: CareGroupTitle): string {
  let prefix = "";
  if (value.starts_at) {
    const date = new Date(value.starts_at);
    if (!Number.isFinite(date.getTime())) throw new Error("GROUP_TITLE_DATE_INVALID");
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: value.timezone,
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === name)!.value;
    const weekday = part("weekday").replace(/\.$/, "");
    prefix = `${weekday[0].toUpperCase()}${weekday.slice(1)}. ${part("day")}/${part("month")} às ${part("hour")}h${part("minute")} • `;
  }
  // Limite de 100 unidades UTF-16, conservador também para caracteres/emoji.
  const fixed = `${prefix}Notificações `;
  const budget = 100 - fixed.length - " • ".length;
  const shop = clean(value.shop_name, "Barbearia");
  const customer = clean(
    value.customer_name?.includes("@") ? null : value.customer_name,
    "Cliente",
  );
  let shopBudget = Math.floor(budget * 0.6),
    customerBudget = budget - shopBudget;
  if (customer.length < customerBudget) shopBudget += customerBudget - customer.length;
  if (shop.length < shopBudget) customerBudget += shopBudget - shop.length;
  return `${fixed}${shorten(shop, shopBudget)} • ${shorten(customer, customerBudget)}`;
}
