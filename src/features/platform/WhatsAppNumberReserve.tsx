import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ChoiceChips, Hint, Notice } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import type { Tables } from "@/integrations/supabase/types";

export type WhatsAppNumber = Tables<"whatsapp_channels">;
export type NumberMode = "primary" | "backup" | "paused";
export type NumberConfiguration = {
  backupId: string | null;
  mode: NumberMode;
  technical: boolean;
  returns: boolean;
  keepLegacy: boolean;
};
export const numberName = (number: WhatsAppNumber, fallback: string) =>
  [number.label || fallback, number.display_phone].filter(Boolean).join(" · ");
export function availableReserves(numbers: WhatsAppNumber[], primary: WhatsAppNumber) {
  return numbers.filter(
    (n) =>
      n.id !== primary.id &&
      !n.barbershop_id &&
      !n.staff_id &&
      !n.enabled &&
      !n.backup_instance_name &&
      n.delivery_mode === "primary" &&
      !numbers.some(
        (owner) => owner.id !== primary.id && owner.backup_instance_name === n.instance_name,
      ),
  );
}
const field = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm";

/** Configuração explícita de um principal; abrir não conecta nem envia. */
export function WhatsAppNumberReserve({
  number,
  numbers,
  supported,
  busy,
  save,
  selectNumber,
}: {
  number: WhatsAppNumber;
  numbers: WhatsAppNumber[];
  supported: boolean;
  busy: boolean;
  save: (configuration: NumberConfiguration) => void;
  selectNumber: (id: string) => void;
}) {
  const { t } = useI18n();
  const currentBackup = numbers.find((n) => n.instance_name === number.backup_instance_name);
  const legacy = Boolean(number.backup_instance_name && !currentBackup);
  const [backup, setBackup] = useState(currentBackup?.id ?? (legacy ? "legacy" : ""));
  const [mode, setMode] = useState<NumberMode>(number.delivery_mode as NumberMode);
  const [technical, setTechnical] = useState(false);
  const [returns, setReturns] = useState(number.return_notice_enabled);
  const chosen = numbers.find((n) => n.id === backup);
  const needsConfirmation =
    mode === "backup" &&
    (number.delivery_mode !== "backup" || backup !== (currentBackup?.id ?? "legacy"));
  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-bold">
        <ShieldCheck className="size-5 shrink-0" aria-hidden />
        {t("waNumbers.settings")}
      </h3>
      <p className="break-words text-sm">
        <strong>{t("waNumbers.primary")}:</strong> {numberName(number, t("waCentral.channel"))}
      </p>
      {!supported ? (
        <Notice tone="info" title={t("waNumbers.install")} />
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy || (mode === "backup" && (!backup || (needsConfirmation && !technical))))
              return;
            save({
              backupId: backup && backup !== "legacy" ? backup : null,
              mode,
              technical: mode === "backup" && (!needsConfirmation || technical),
              returns,
              keepLegacy: backup === "legacy",
            });
          }}
        >
          <label className="grid min-w-0 gap-1 text-sm font-semibold">
            {t("waNumbers.backup")}
            <select
              className={field}
              aria-label={t("waNumbers.backup")}
              value={backup}
              disabled={busy}
              onChange={(e) => {
                setBackup(e.target.value);
                setMode("primary");
                setTechnical(false);
              }}
            >
              <option value="">{t("waNumbers.noBackup")}</option>
              {legacy && <option value="legacy">{t("waNumbers.legacy")}</option>}
              {availableReserves(numbers, number).map((n) => (
                <option key={n.id} value={n.id}>
                  {numberName(n, t("waCentral.channel"))}
                </option>
              ))}
            </select>
          </label>
          <Hint>{t("waNumbers.backupHint")}</Hint>
          {chosen && chosen.id === currentBackup?.id && (
            <button
              type="button"
              className="action-button"
              disabled={busy}
              onClick={() => selectNumber(chosen.id)}
            >
              {t("waNumbers.viewBackup")}
            </button>
          )}
          <ChoiceChips<NumberMode>
            label={t("waDelivery.mode")}
            value={mode}
            disabled={busy}
            onChange={(value) => {
              setMode(value);
              setTechnical(false);
            }}
            options={[
              { value: "primary", label: t("waNumbers.primary") },
              { value: "backup", label: t("waNumbers.backup"), disabled: !backup },
              { value: "paused", label: t("waDelivery.paused") },
            ]}
          />
          <Hint>{t("waNumbers.manual")}</Hint>
          {needsConfirmation && (
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0"
                checked={technical}
                disabled={busy}
                onChange={(e) => setTechnical(e.target.checked)}
              />
              {t("waDelivery.technical")}
            </label>
          )}
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0"
              checked={returns}
              disabled={busy}
              onChange={(e) => setReturns(e.target.checked)}
            />
            {t("waDelivery.returns")}
          </label>
          <Hint>{t("waDelivery.limits")}</Hint>
          <button
            className="action-button action-confirm"
            disabled={busy || (mode === "backup" && (!backup || (needsConfirmation && !technical)))}
          >
            {t("waNumbers.save")}
          </button>
        </form>
      )}
    </section>
  );
}
