/**
 * WhatsApp digitado no cadastro: máscara enquanto digita e conferência antes de criar a conta.
 *
 * Brasil é o padrão: (11) 99999-0000, DDD válido, 10 ou 11 dígitos. Número com "+" (ou o
 * idioma pt-PT com 9 dígitos) vale como internacional; Portugal é +351 com 9 dígitos.
 * O servidor (normalize_br_whatsapp) continua sendo quem normaliza de verdade.
 */

/** DDDs em uso no Brasil (Anatel). */
const BR_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type SignupPhoneCheck =
  | {
      ok: true;
      /** Só dígitos, com DDI (ex.: 5511999990000). É o que vai nos metadados do cadastro. */
      digits: string;
      /** Com "+" (ex.: +5511999990000). É o que vai para save_my_whatsapp e auth-otp. */
      e164: string;
    }
  | { ok: false; reason: "empty" | "ddd" | "length" };

function isInternational(raw: string) {
  const value = raw.trim();
  return value.startsWith("+") || value.startsWith("00");
}

function digitsOf(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return raw.trim().startsWith("00") ? digits.replace(/^00/, "") : digits;
}

function checkBrNational(national: string): SignupPhoneCheck {
  if (national.length !== 10 && national.length !== 11) return { ok: false, reason: "length" };
  if (!BR_DDD.has(Number(national.slice(0, 2)))) return { ok: false, reason: "ddd" };
  // Celular com 11 dígitos sempre começa com 9 depois do DDD.
  if (national.length === 11 && national[2] !== "9") return { ok: false, reason: "length" };
  const digits = `55${national}`;
  return { ok: true, digits, e164: `+${digits}` };
}

function checkPortugal(national: string): SignupPhoneCheck {
  if (national.length !== 9 || !/^[29]/.test(national)) return { ok: false, reason: "length" };
  const digits = `351${national}`;
  return { ok: true, digits, e164: `+${digits}` };
}

/** Confere o número antes de criar a conta. `locale` decide o padrão sem "+". */
export function checkSignupPhone(raw: string, locale?: string): SignupPhoneCheck {
  const digits = digitsOf(raw);
  if (!digits) return { ok: false, reason: "empty" };

  if (isInternational(raw)) {
    if (digits.startsWith("55")) return checkBrNational(digits.slice(2));
    if (digits.startsWith("351")) return checkPortugal(digits.slice(3));
    if (digits.length < 8 || digits.length > 15) return { ok: false, reason: "length" };
    return { ok: true, digits, e164: `+${digits}` };
  }

  if (locale === "pt-PT" && digits.length === 9) return checkPortugal(digits);
  if (digits.startsWith("351") && digits.length === 12) return checkPortugal(digits.slice(3));
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return checkBrNational(digits.slice(2));
  }
  return checkBrNational(digits);
}

function brMask(national: string) {
  const d = national.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function groupsOf3(value: string) {
  return value.replace(/(\d{3})(?=\d)/g, "$1 ");
}

/** Máscara enquanto digita: (11) 99999-0000, +55 (11) 99999-0000 ou +351 912 345 678. */
export function formatSignupPhone(raw: string, locale?: string): string {
  const digits = digitsOf(raw);
  if (!digits) return isInternational(raw) ? "+" : "";
  if (isInternational(raw)) {
    if (digits.startsWith("55")) {
      const rest = digits.slice(2);
      return rest ? `+55 ${brMask(rest)}` : "+55";
    }
    if (digits.startsWith("351")) {
      const rest = digits.slice(3, 12);
      return rest ? `+351 ${groupsOf3(rest)}` : "+351";
    }
    return `+${digits.slice(0, 15)}`;
  }
  if (locale === "pt-PT" && !digits.startsWith("55") && digits.length <= 9) {
    return groupsOf3(digits);
  }
  // Mais de 11 dígitos não cabe no número nacional: veio com o código do país sem "+"
  // (ex.: preenchimento automático 5511999990000). Mostra como internacional, sem cortar.
  if (digits.length > 11 && (digits.startsWith("55") || digits.startsWith("351"))) {
    return formatSignupPhone(`+${digits}`, locale);
  }
  return brMask(digits);
}

/**
 * Valor novo do campo com máscara. Apagar um símbolo da máscara (parêntese, traço, espaço)
 * não muda os dígitos; nesse caso apaga também o último dígito para o campo não "travar".
 */
export function nextMaskedPhone(previous: string, typed: string, locale?: string): string {
  const typedDigits = digitsOf(typed);
  const erasedSymbolOnly =
    typed.length < previous.length && typedDigits === digitsOf(previous) && typedDigits.length > 0;
  const source = erasedSymbolOnly
    ? `${isInternational(typed) ? "+" : ""}${typedDigits.slice(0, -1)}`
    : typed;
  return formatSignupPhone(source, locale);
}
