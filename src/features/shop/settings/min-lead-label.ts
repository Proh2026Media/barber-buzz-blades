import { useI18n } from "@/lib/i18n";
import { minLeadParts } from "@/lib/shop/appointments";

/** "Sem mínimo", "30 min" ou "2 h". */
export function useMinLeadLabel() {
  const { t } = useI18n();
  return (minutes: number) => {
    if (minutes === 0) return t("lead.none");
    const parts = minLeadParts(minutes);
    return "hours" in parts
      ? t("lead.chip.hours", { hours: parts.hours })
      : t("lead.chip.minutes", { minutes: parts.minutes });
  };
}
