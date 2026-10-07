import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { shiftDateKey } from "@/lib/shop/appointments";

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** Nomes curtos dos dias e datas com o dia da semana, no idioma escolhido. */
export function useDayLabels() {
  const { t, intlLocale } = useI18n();
  return useMemo(() => {
    const short = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" });
    const dated = new Intl.DateTimeFormat(intlLocale, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    });
    const dayNumber = new Intl.DateTimeFormat(intlLocale, { day: "2-digit", timeZone: "UTC" });
    const keyDate = (dateKey: string) => {
      const [year, month, day] = dateKey.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day, 12));
    };
    /** "Seg" (1 de janeiro de 2023 foi domingo). */
    const weekdayShort = (weekday: number) =>
      capitalize(short.format(new Date(Date.UTC(2023, 0, 1 + weekday, 12))).replace(/\.$/, ""));
    return {
      weekdayShort,
      /** "ter., 06/10". */
      date: (dateKey: string) => dated.format(keyDate(dateKey)),
      /** "06". */
      dayNumber: (dateKey: string) => dayNumber.format(keyDate(dateKey)),
      /** "Hoje", "Amanhã" ou o dia curto ("Qua"). */
      relative: (dateKey: string, todayKey: string) =>
        dateKey === todayKey
          ? t("hours.today")
          : dateKey === shiftDateKey(todayKey, 1)
            ? t("hours.tomorrow")
            : capitalize(short.format(keyDate(dateKey)).replace(/\.$/, "")),
    };
  }, [intlLocale, t]);
}
