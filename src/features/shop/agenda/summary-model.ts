import { useI18n } from "@/lib/i18n";
import { formatShopDate } from "@/lib/shop/appointments";

/** Hora local da loja ("09:00"). */
export function useShopTime(timeZone: string) {
  const { intlLocale } = useI18n();
  return (value: string | number | Date) =>
    formatShopDate(
      typeof value === "number" ? new Date(value) : value,
      timeZone,
      { hour: "2-digit", minute: "2-digit" },
      intlLocale,
    );
}
