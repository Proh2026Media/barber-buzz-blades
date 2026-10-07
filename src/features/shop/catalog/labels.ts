import { useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { splitDuration } from "./format";

/** Duração e preço escritos do jeito que a pessoa fala ("30 min", "1h30", "R$ 45,00"). */
export function useCatalogLabels() {
  const { t, intlLocale } = useI18n();
  const duration = useCallback(
    (minutes: number) => {
      const { hours, minutes: rest } = splitDuration(minutes);
      if (hours === 0) return t("catalog.duration.min", { minutes: rest });
      if (rest === 0) return t("catalog.duration.hours", { hours });
      return t("catalog.duration.hoursMinutes", {
        hours,
        minutes: String(rest).padStart(2, "0"),
      });
    },
    [t],
  );
  const money = useCallback(
    (cents: number) =>
      (cents / 100).toLocaleString(intlLocale, {
        style: "currency",
        currency: "BRL",
        currencyDisplay: "narrowSymbol",
      }),
    [intlLocale],
  );
  /** Símbolo da moeda no idioma atual ("R$"), para o prefixo do campo e o preço ainda vazio. */
  const currency = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale, {
        style: "currency",
        currency: "BRL",
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? "R$",
    [intlLocale],
  );
  /** Exemplo de preço no formato do idioma ("45,00" / "45.00"). */
  const priceExample = useMemo(
    () => (45).toLocaleString(intlLocale, { minimumFractionDigits: 2 }),
    [intlLocale],
  );
  return { duration, money, currency, priceExample };
}
