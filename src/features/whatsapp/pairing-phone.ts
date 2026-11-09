import parsePhoneNumber, {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  type CountryCode,
} from "libphonenumber-js/min";
import {
  describeTimeZone,
  findShopTimeZone,
  normalizeTimeZone,
} from "../register-owner/timezones.ts";

export { getCountryCallingCode, type CountryCode };
const COUNTRY_KEY = "bc-whatsapp-pairing-country";

function supported(value?: string | null): CountryCode | null {
  const code = value?.toUpperCase();
  return code && isSupportedCountry(code) ? (code as CountryCode) : null;
}
function timeZoneCountry(zone?: string | null): CountryCode | null {
  const normalized = normalizeTimeZone(zone);
  if (!normalized) return null;
  const known = findShopTimeZone(normalized);
  if (known) return known.country.toUpperCase() as CountryCode;
  if (describeTimeZone(normalized).kind === "brasilia") return "BR";
  const zones: Record<string, CountryCode> = {
    "Europe/London": "GB",
    "Europe/Madrid": "ES",
    "Atlantic/Canary": "ES",
    "Africa/Ceuta": "ES",
    "America/New_York": "US",
    "America/Chicago": "US",
    "America/Denver": "US",
    "America/Los_Angeles": "US",
    "Pacific/Honolulu": "US",
    "America/Anchorage": "US",
    "Europe/Paris": "FR",
    "Europe/Berlin": "DE",
    "America/Toronto": "CA",
    "Asia/Tokyo": "JP",
  };
  return zones[normalized] ?? null;
}
/** Sugestão local, sem geolocalização, rede ou permissão de localização. */
export function detectPairingCountry(options: {
  saved?: string | null;
  shopTimeZone?: string | null;
  deviceTimeZone?: string | null;
  languages?: readonly string[];
  locale?: string;
}): CountryCode {
  const preferred =
    supported(options.saved) ??
    timeZoneCountry(options.shopTimeZone) ??
    timeZoneCountry(options.deviceTimeZone);
  if (preferred) return preferred;
  for (const language of [...(options.languages ?? []), options.locale ?? "pt-BR"]) {
    try {
      const country = supported(new Intl.Locale(language).region);
      if (country) return country;
    } catch {
      /* idioma inválido não impede o formulário */
    }
  }
  return "BR";
}
export function initialPairingCountry(shopTimeZone?: string, locale?: string): CountryCode {
  let saved: string | null = null,
    zone: string | undefined,
    languages: readonly string[] = [];
  try {
    saved = localStorage.getItem(COUNTRY_KEY);
  } catch {
    /* navegação privada */
  }
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* navegador sem fuso */
  }
  if (typeof navigator !== "undefined") languages = navigator.languages;
  return detectPairingCountry({ saved, shopTimeZone, deviceTimeZone: zone, languages, locale });
}
export function rememberPairingCountry(country: CountryCode) {
  try {
    localStorage.setItem(COUNTRY_KEY, country);
  } catch {
    /* preferência opcional */
  }
}
export function pairingCountries(locale: string) {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return getCountries()
    .map((country) => ({
      country,
      name: names.of(country) ?? country,
      code: getCountryCallingCode(country),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
export function normalizePairingPhone(
  raw: string,
  country: CountryCode,
): { digits: string; country?: CountryCode; national: string } | null {
  const value = raw.trim();
  if (!/^\+?[\d\s().-]+$/.test(value)) return null;
  const international = value.startsWith("00") ? `+${value.slice(2)}` : value;
  try {
    const phone = parsePhoneNumber(international, { defaultCountry: country, extract: false });
    if (!phone || !phone.isPossible() || phone.ext) return null;
    return {
      digits: phone.number.slice(1),
      country: phone.country,
      national: phone.nationalNumber,
    };
  } catch {
    return null;
  }
}
