import { useState } from "react";
import { Smartphone } from "lucide-react";
import { Notice } from "@/components/visual";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { hasIdentifiedNumber } from "@/lib/whatsapp/directory-model";
import { PlatformWhatsAppCard, type PlatformWaReport } from "./PlatformWhatsAppCard";

type Attempt = { id: string; label: string; display_phone: string | null };
/** O pareamento só vira número no catálogo depois da identificação pela integração. */
export function WhatsAppConnectDialog({
  attempts,
  number,
  busy,
  error,
  close,
  resume,
  create,
  report,
  complete,
}: {
  attempts: Attempt[];
  number?: Attempt;
  busy: boolean;
  error: string | null;
  close: () => void;
  resume: (id: string | null) => void;
  create: (label: string) => Promise<void>;
  report: (status: PlatformWaReport | null, phone?: string | null) => void;
  complete: (id: string) => void;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent
        size="lg"
        className="bg-card"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="size-5 shrink-0 text-primary" aria-hidden />
            {t("waNumbers.addAnother")}
          </DialogTitle>
          <DialogDescription>{t("waConnect.hint")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && <Notice tone="danger" title={error} />}
          {number ? (
            <>
              <PlatformWhatsAppCard
                embedded
                key={number.id}
                channelId={number.id}
                title={number.label}
                onStatusChange={report}
              />
              {!hasIdentifiedNumber(number) && (
                <button type="button" className="action-button" onClick={() => resume(null)}>
                  {t("waConnect.change")}
                </button>
              )}
            </>
          ) : (
            <>
              {attempts.length > 0 && (
                <label className="grid min-w-0 gap-1 text-sm font-semibold">
                  {t("waConnect.resume")}
                  <select
                    aria-label={t("waConnect.resume")}
                    className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm"
                    value=""
                    disabled={busy}
                    onChange={(event) => {
                      if (event.target.value) resume(event.target.value);
                    }}
                  >
                    <option value="">{t("waConnect.selectAttempt")}</option>
                    {attempts.map((attempt) => (
                      <option key={attempt.id} value={attempt.id}>
                        {attempt.label || t("waNumbers.addAnother")}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy && label.trim().length >= 2) void create(label.trim());
                }}
              >
                <label className="grid min-w-0 gap-1 text-sm font-semibold">
                  {t("waCentral.label")}
                  <input
                    className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm"
                    value={label}
                    minLength={2}
                    maxLength={80}
                    required
                    disabled={busy}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </label>
                <button
                  className="action-button action-confirm w-full"
                  disabled={busy || label.trim().length < 2}
                >
                  {t("waCentral.add")}
                </button>
              </form>
            </>
          )}
        </DialogBody>
        <DialogActions>
          {number && hasIdentifiedNumber(number) ? (
            <button
              type="button"
              className="action-button action-confirm"
              onClick={() => complete(number.id)}
            >
              {t("waOrg.viewNumber")}
            </button>
          ) : (
            <button type="button" className="action-button" disabled={busy} onClick={close}>
              {t("waConnect.close")}
            </button>
          )}
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
