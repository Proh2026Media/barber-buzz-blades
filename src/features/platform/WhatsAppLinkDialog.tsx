import { useState } from "react";
import { Link2, Smartphone } from "lucide-react";
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
import type { WhatsAppNumberLink } from "./WhatsAppNumberDestinations";

export type WhatsAppLinkRequest = { number?: string; shop?: string; staff?: string | null };
type NumberOption = {
  id: string;
  label: string | null;
  display_phone: string | null;
  instance_name: string;
  backup_instance_name: string | null;
};
const field = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm";

/** Uma entrada para compartilhar números, inclusive os já usados em outros destinos. */
export function WhatsAppLinkDialog({
  request,
  numbers,
  shops,
  staff,
  links,
  busy,
  error,
  close,
  add,
  release,
  viewNumber,
}: {
  request: WhatsAppLinkRequest;
  numbers: NumberOption[];
  shops: { id: string; name: string }[];
  staff: { id: string; shop_id: string; name: string }[];
  links: WhatsAppNumberLink[];
  busy: boolean;
  error: string | null;
  close: () => void;
  add: (number: string, shop: string, staff: string | null) => Promise<boolean>;
  release: (link: WhatsAppNumberLink) => Promise<boolean>;
  viewNumber: (id: string) => void;
}) {
  const { t } = useI18n();
  const [number, setNumber] = useState(request.number ?? "");
  const [shop, setShop] = useState(request.shop ?? "");
  const [professional, setProfessional] = useState(request.staff ?? "");
  const [released, setReleased] = useState(false);
  const candidates = numbers.filter(
    (n) =>
      n.display_phone?.trim() &&
      !numbers.some((owner) => owner.backup_instance_name === n.instance_name),
  );
  const occupied = links.find(
    (link) => link.barbershop_id === shop && link.staff_id === (professional || null),
  );
  const owner = numbers.find((n) => n.id === occupied?.channel_id);
  const pending = Boolean(owner && !owner.display_phone?.trim());
  const validNumber = candidates.some((n) => n.id === number);
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
            <Link2 className="size-5 shrink-0 text-primary" aria-hidden />
            {t("waMissing.link")}
          </DialogTitle>
          <DialogDescription>{t("waLink.hint")}</DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              !busy &&
              validNumber &&
              shop &&
              !occupied &&
              (await add(number, shop, professional || null))
            )
              close();
          }}
        >
          <DialogBody className="space-y-4">
            {error && <Notice tone="danger" title={error} />}
            {candidates.length ? (
              <label className="grid min-w-0 gap-2 text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <Smartphone className="size-4" aria-hidden />
                  {t("waMissing.number")}
                </span>
                <select
                  aria-label={t("waMissing.number")}
                  className={field}
                  value={number}
                  required
                  disabled={busy}
                  onChange={(e) => setNumber(e.target.value)}
                >
                  <option value="">{t("waMissing.choose")}</option>
                  {candidates.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.display_phone}
                      {n.label ? ` · ${n.label}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <Notice tone="info" title={t("waMissing.noNumbers")} />
            )}
            <div className="grid gap-3 tablet:grid-cols-2">
              <label className="grid min-w-0 gap-1 text-sm font-semibold">
                {t("waCentral.shop")}
                <select
                  aria-label={t("waCentral.shop")}
                  className={field}
                  value={shop}
                  required
                  disabled={busy}
                  onChange={(e) => {
                    setShop(e.target.value);
                    setProfessional("");
                    setReleased(false);
                  }}
                >
                  <option value="">{t("waShared.choose")}</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-semibold">
                {t("waCentral.staff")}
                <select
                  aria-label={t("waCentral.staff")}
                  className={field}
                  value={professional}
                  disabled={busy || !shop}
                  onChange={(e) => {
                    setProfessional(e.target.value);
                    setReleased(false);
                  }}
                >
                  <option value="">{t("waCentral.wholeShop")}</option>
                  {staff
                    .filter((s) => s.shop_id === shop)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {occupied ? (
              pending ? (
                <Notice
                  tone="warning"
                  title={t("waLink.pending")}
                  children={t("waLink.pendingHint")}
                  action={{
                    label: t("waLink.release"),
                    disabled: busy || !validNumber,
                    onClick: () => {
                      void release(occupied).then((ok) => {
                        if (ok) setReleased(true);
                      });
                    },
                  }}
                />
              ) : (
                <Notice
                  tone="info"
                  title={t(owner?.id === number ? "waLink.already" : "waLink.occupied")}
                  action={
                    owner
                      ? {
                          label: t("waLink.viewCurrent"),
                          disabled: busy,
                          onClick: () => {
                            viewNumber(owner.id);
                            close();
                          },
                        }
                      : undefined
                  }
                />
              )
            ) : (
              <>
                {released && <Notice tone="success" title={t("waLink.released")} />}
                <Notice tone="info" title={t("waShared.addHint")} />
              </>
            )}
          </DialogBody>
          <DialogActions>
            <button type="button" className="action-button" disabled={busy} onClick={close}>
              {t("common.cancel")}
            </button>
            <button
              className="action-button action-confirm"
              disabled={busy || !validNumber || !shop || Boolean(occupied)}
            >
              {t("waShared.link")}
            </button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
