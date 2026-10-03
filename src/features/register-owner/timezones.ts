/**
 * Fuso horário da barbearia: lista curta (Brasil e Portugal), detecção pelo aparelho
 * e nome amigável. Regras puras, sem React nem i18n, para poder testar com `node --test`.
 * Os nomes das regiões vêm das chaves `dec.tz.zone.<chave>` (quem chama traduz).
 */

export const DEFAULT_SHOP_TIME_ZONE = "America/Sao_Paulo";

export type ShopTimeZoneCountry = "br" | "pt";

export type ShopTimeZoneKey =
  | "brasilia"
  | "manaus"
  | "cuiaba"
  | "campoGrande"
  | "portoVelho"
  | "boaVista"
  | "rioBranco"
  | "noronha"
  | "lisbon"
  | "madeira"
  | "azores";

export type ShopTimeZoneOption = {
  /** Identificador IANA gravado em `barbershops.timezone`. */
  id: string;
  /** Sufixo da chave de tradução `dec.tz.zone.<key>`. */
  key: ShopTimeZoneKey;
  country: ShopTimeZoneCountry;
};

/** Fusos oferecidos no seletor, na ordem em que aparecem. */
export const SHOP_TIME_ZONES: readonly ShopTimeZoneOption[] = [
  { id: "America/Sao_Paulo", key: "brasilia", country: "br" },
  { id: "America/Manaus", key: "manaus", country: "br" },
  { id: "America/Cuiaba", key: "cuiaba", country: "br" },
  { id: "America/Campo_Grande", key: "campoGrande", country: "br" },
  { id: "America/Porto_Velho", key: "portoVelho", country: "br" },
  { id: "America/Boa_Vista", key: "boaVista", country: "br" },
  { id: "America/Rio_Branco", key: "rioBranco", country: "br" },
  { id: "America/Noronha", key: "noronha", country: "br" },
  { id: "Europe/Lisbon", key: "lisbon", country: "pt" },
  { id: "Atlantic/Madeira", key: "madeira", country: "pt" },
  { id: "Atlantic/Azores", key: "azores", country: "pt" },
];

/**
 * Fusos do Brasil que seguem o horário de Brasília com outro nome no aparelho
 * (ex.: celular em Fortaleza informa "America/Fortaleza"). Ficam gravados como vieram —
 * se um dia o horário de verão voltar só em parte do país, cada um segue a sua regra —,
 * mas aparecem como "Horário de Brasília (Fortaleza)".
 */
const BRASILIA_EQUIVALENTS = new Set([
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Maceio",
  "America/Belem",
  "America/Araguaina",
  "America/Santarem",
  "Brazil/East",
]);

/** Nomes antigos que alguns aparelhos ainda informam. */
const LEGACY_ALIASES: Record<string, string> = {
  "Brazil/West": "America/Manaus",
  "Brazil/Acre": "America/Rio_Branco",
  "Brazil/DeNoronha": "America/Noronha",
  "America/Porto_Acre": "America/Rio_Branco",
  Portugal: "Europe/Lisbon",
};

/** O identificador existe para o navegador (Intl). */
export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trim() }).format(0);
    return true;
  } catch {
    return false;
  }
}

/** Troca nomes antigos pelo atual; devolve null se o fuso não for válido. */
export function normalizeTimeZone(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  const mapped = LEGACY_ALIASES[trimmed] ?? trimmed;
  return isValidTimeZone(mapped) ? mapped : null;
}

/**
 * Mesmo formato aceito pelo servidor (register-shop e is_valid_shop_timezone, migration
 * 20261003230000): "UTC" ou "Região/Cidade", sem os prefixos técnicos posix/, right/,
 * Etc/ e SystemV/. Fora disso o servidor ignora o fuso, então a tela nem o propõe.
 */
export function isShopTimeZoneShape(value: string): boolean {
  if (value === "UTC") return true;
  if (!/^[A-Za-z]+(\/[A-Za-z0-9_+-]+)+$/.test(value)) return false;
  return !/^(posix|right|Etc|SystemV)\//.test(value);
}

/**
 * Fuso do aparelho de quem abre a tela, ou o padrão (Brasília) se o navegador não informar
 * (ou informar um nome técnico como "Etc/GMT+3", que o servidor não aceita).
 * `resolve` existe para os testes simularem outros aparelhos.
 */
export function detectDeviceTimeZone(
  resolve: () => string | undefined = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  try {
    const zone = normalizeTimeZone(resolve());
    return zone && isShopTimeZoneShape(zone) ? zone : DEFAULT_SHOP_TIME_ZONE;
  } catch {
    return DEFAULT_SHOP_TIME_ZONE;
  }
}

/** Opção da lista com esse identificador, se houver. */
export function findShopTimeZone(id: string | null | undefined): ShopTimeZoneOption | null {
  return SHOP_TIME_ZONES.find((option) => option.id === id) ?? null;
}

/** "America/Porto_Velho" → "Porto Velho"; "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export function timeZoneCity(id: string): string {
  const last = id.split("/").pop() ?? id;
  return last.replace(/_/g, " ");
}

/**
 * Como descrever o fuso:
 * - `list`: está na lista → `dec.tz.zone.<key>`;
 * - `brasilia`: outro nome do horário de Brasília → `dec.tz.zone.brasiliaCity` com a cidade;
 * - `other`: fora da lista → nome do navegador (`intlTimeZoneName`) com a cidade.
 */
export type TimeZoneDescription =
  | { kind: "list"; key: ShopTimeZoneKey }
  | { kind: "brasilia"; city: string }
  | { kind: "other"; city: string };

export function describeTimeZone(id: string): TimeZoneDescription {
  const option = findShopTimeZone(id);
  if (option) return { kind: "list", key: option.key };
  if (BRASILIA_EQUIVALENTS.has(id)) return { kind: "brasilia", city: timeZoneCity(id) };
  return { kind: "other", city: timeZoneCity(id) };
}

/** Nome longo do fuso no idioma da tela ("Horário da Europa Central"); o código se falhar. */
export function intlTimeZoneName(id: string, locale: string): string {
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone: id, timeZoneName: "longGeneric" })
      .formatToParts(new Date(0))
      .find((item) => item.type === "timeZoneName");
    return part?.value ?? id;
  } catch {
    return id;
  }
}

/** Hora atual naquele fuso, "14:05", para a pessoa conferir se bate com o relógio da loja. */
export function clockInTimeZone(id: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: id,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
    const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
    return `${hour}:${minute}`;
  } catch {
    return "";
  }
}

/**
 * Opções do seletor: Brasil, Portugal e, se o fuso atual (ou o detectado) não estiver
 * na lista, um item "Outro" com ele — assim nunca se perde o que já estava escolhido.
 */
export function timeZoneChoices(...extra: (string | null | undefined)[]): {
  br: ShopTimeZoneOption[];
  pt: ShopTimeZoneOption[];
  other: string[];
} {
  const other: string[] = [];
  for (const id of extra) {
    const normalized = normalizeTimeZone(id);
    if (normalized && !findShopTimeZone(normalized) && !other.includes(normalized)) {
      other.push(normalized);
    }
  }
  return {
    br: SHOP_TIME_ZONES.filter((option) => option.country === "br"),
    pt: SHOP_TIME_ZONES.filter((option) => option.country === "pt"),
    other,
  };
}
