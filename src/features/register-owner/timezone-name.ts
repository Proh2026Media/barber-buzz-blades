import { useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { describeTimeZone, intlTimeZoneName } from "@/features/register-owner/timezones";

/** Nome amigável do fuso no idioma da tela: "Horário de Brasília", "Açores (Ponta Delgada)"… */
export function useTimeZoneName() {
  const { t, intlLocale } = useI18n();
  return useCallback(
    (id: string) => {
      const description = describeTimeZone(id);
      if (description.kind === "list") return t(`dec.tz.zone.${description.key}`);
      if (description.kind === "brasilia") {
        return t("dec.tz.zone.brasiliaCity", { city: description.city });
      }
      const name = intlTimeZoneName(id, intlLocale);
      return name === id ? description.city : `${name} (${description.city})`;
    },
    [t, intlLocale],
  );
}
