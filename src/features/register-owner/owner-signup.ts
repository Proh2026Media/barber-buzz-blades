/**
 * Regras puras do cadastro do dono (/cadastrar): prévia do link da loja e
 * máscara/conferência do WhatsApp. Sem dependências de tela para poder testar.
 */

/**
 * Mesmo resultado de `public.slugify_pt` (20261003210000_slugify_acentos.sql),
 * que o gatilho `trg_barbershop_auto_slug` usa para criar o endereço da loja.
 * Se o endereço já existir, o banco acrescenta "-2", "-3"… no fim.
 */
const SLUG_FROM =
  "áàâãäåāăąéèêëēĕėęěíìîïĩīĭįıóòôõöōŏőúùûüũūŭůűýÿçñÁÀÂÃÄÅĀĂĄÉÈÊËĒĔĖĘĚÍÌÎÏĨĪĬĮİÓÒÔÕÖŌŎŐÚÙÛÜŨŪŬŮŰÝŸÇÑ";
const SLUG_TO =
  "aaaaaaaaaeeeeeeeeeiiiiiiiiioooooooouuuuuuuuuyycnaaaaaaaaaeeeeeeeeeiiiiiiiiioooooooouuuuuuuuuyycn";

export function slugifyShopName(input: string): string {
  const raw = (input.trim() || "item").toLowerCase();
  // translate() do banco: troca pela posição (listas alinhadas, 96 × 96).
  const from = [...SLUG_FROM];
  const to = [...SLUG_TO];
  const translated = [...raw]
    .map((ch) => {
      const index = from.indexOf(ch);
      return index >= 0 ? (to[index] ?? "") : ch;
    })
    .join("");
  let result = translated.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!result) result = "item";
  return result.slice(0, 60);
}

/** DDDs válidos no Brasil (Anatel). */
const BR_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Número estrangeiro: começa com "+" e não é +55. */
function isForeign(raw: string): boolean {
  const compact = raw.replace(/[^\d+]/g, "");
  return compact.startsWith("+") && compact.length > 1 && !"+55".startsWith(compact.slice(0, 3));
}

/** Dígitos nacionais (DDD + número), sem o 55 do país quando informado. */
function nationalDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const hasCountry = raw.trim().startsWith("+") || digits.length > 11;
  return (hasCountry && digits.startsWith("55") ? digits.slice(2) : digits).slice(0, 11);
}

/** Formata enquanto a pessoa digita: (11) 99999-0000. Número estrangeiro fica como digitado. */
export function maskBrPhone(raw: string): string {
  if (isForeign(raw)) return `+${raw.replace(/\D/g, "").slice(0, 15)}`;
  // "+5" ainda é o começo do +55: não vira "+55 (5" (o 5 seria lido como DDD).
  if (raw.trim().startsWith("+") && raw.replace(/\D/g, "").length < 2) {
    return `+${raw.replace(/\D/g, "")}`;
  }
  const d = nationalDigits(raw);
  const prefix = raw.trim().startsWith("+") ? "+55 " : "";
  if (!d) return raw.trim().startsWith("+") ? raw.replace(/[^\d+]/g, "") : "";
  if (d.length <= 2) return `${prefix}(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  const split = rest.length > 8 ? 5 : 4;
  if (rest.length <= split) return `${prefix}(${ddd}) ${rest}`;
  return `${prefix}(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/**
 * Número no formato que o servidor grava (+5511999990000), ou null se não passar
 * na conferência. Mais rígido que `normalize_br_whatsapp`: confere o DDD e o 9 do celular.
 */
export function brPhoneE164(raw: string): string | null {
  if (isForeign(raw)) {
    const digits = raw.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 && digits[0] !== "0" ? `+${digits}` : null;
  }
  const all = raw.replace(/\D/g, "");
  const d = all.length > 11 && all.startsWith("55") ? all.slice(2) : all;
  if (d.length !== 10 && d.length !== 11) return null;
  if (!BR_DDDS.has(Number(d.slice(0, 2)))) return null;
  if (d.length === 11 && d[2] !== "9") return null;
  return `+55${d}`;
}

/** Conferência simples de e-mail (o servidor só exige "@"). */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
