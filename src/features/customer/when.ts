import { formatShopDate, shopDateKey } from "@/lib/shop/appointments";

/**
 * Datas "humanas" do app do cliente, sempre no fuso da barbearia: "Hoje", "Amanhã", o dia da
 * semana e "em 1 hora". O texto vem do próprio navegador (Intl), no idioma escolhido, então não
 * precisa de frases novas no dicionário.
 */

function dayNumber(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** Dias de calendário entre agora e a data, no fuso da loja (0 = hoje, 1 = amanhã). */
export function daysFromToday(date: Date | string, now: Date, timeZone: string) {
  return dayNumber(shopDateKey(new Date(date), timeZone)) - dayNumber(shopDateKey(now, timeZone));
}

function capitalize(text: string) {
  return text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text;
}

/** "Hoje", "Amanhã", "Ontem" ou o dia da semana abreviado ("Qua"). */
export function relativeDayLabel(date: Date | string, now: Date, timeZone: string, locale: string) {
  const days = daysFromToday(date, now, timeZone);
  if (days >= -1 && days <= 1) {
    return capitalize(new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day"));
  }
  return capitalize(formatShopDate(date, timeZone, { weekday: "short" }, locale).replace(".", ""));
}

/**
 * Quanto falta até a data: "em 45 minutos", "em 1 hora", "em 3 dias". `null` quando já passou.
 * Até 2 horas mostra minutos/horas; no mesmo dia, horas; depois, dias de calendário.
 */
export function timeUntil(date: Date | string, now: Date, timeZone: string, locale: string) {
  const diff = new Date(date).getTime() - now.getTime();
  if (diff <= 0) return null;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return format.format(Math.max(1, minutes), "minute");
  const days = daysFromToday(date, now, timeZone);
  if (days <= 0) return format.format(Math.floor(minutes / 60), "hour");
  return format.format(days, "day");
}

/** Há quanto tempo algo aconteceu: "agora", "há 5 minutos", "há 2 horas", "ontem". */
export function timeAgo(date: Date | string, now: Date, nowLabel: string, locale: string) {
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return nowLabel;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (minutes < 60) return format.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return format.format(-hours, "hour");
  return format.format(-Math.floor(hours / 24), "day");
}

/** "Hoje · 10:00" — rótulo curto de um horário, com o dia relativo. */
export function shortWhen(date: Date | string, now: Date, timeZone: string, locale: string) {
  const day = relativeDayLabel(date, now, timeZone, locale);
  const days = daysFromToday(date, now, timeZone);
  const time = formatShopDate(date, timeZone, { hour: "2-digit", minute: "2-digit" }, locale);
  if (days >= -1 && days <= 1) return `${day} · ${time}`;
  const dayMonth = formatShopDate(date, timeZone, { day: "2-digit", month: "2-digit" }, locale);
  return `${day} ${dayMonth} · ${time}`;
}
