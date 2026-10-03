import { useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  describeTimeZone,
  intlTimeZoneName,
  timeZoneChoices,
} from "@/features/register-owner/timezones";

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

/**
 * Seletor nativo (bom no celular e para leitores de tela) com Brasil, Portugal e "Outro".
 * `keep` lista fusos fora da lista que precisam continuar como opção (o atual, o detectado).
 */
export function TimeZoneSelect({
  id,
  value,
  onChange,
  keep = [],
  disabled,
  className,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  keep?: (string | null | undefined)[];
  disabled?: boolean;
  className?: string;
  describedBy?: string;
}) {
  const { t } = useI18n();
  const nameOf = useTimeZoneName();
  const choices = timeZoneChoices(value, ...keep);
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    >
      <optgroup label={t("dec.tz.group.br")}>
        {choices.br.map((option) => (
          <option key={option.id} value={option.id}>
            {nameOf(option.id)}
          </option>
        ))}
      </optgroup>
      <optgroup label={t("dec.tz.group.pt")}>
        {choices.pt.map((option) => (
          <option key={option.id} value={option.id}>
            {nameOf(option.id)}
          </option>
        ))}
      </optgroup>
      {choices.other.length > 0 && (
        <optgroup label={t("dec.tz.group.other")}>
          {choices.other.map((zone) => (
            <option key={zone} value={zone}>
              {nameOf(zone)}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
