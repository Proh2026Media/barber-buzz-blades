import { useState } from "react";
import { Plus, Trash2, Store, Scissors, Smartphone, ArrowDown, Settings2 } from "lucide-react";
import { Notice, StatusBadge } from "@/components/visual";
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

export type WhatsAppNumberLink = {
  id: string;
  channel_id: string;
  barbershop_id: string;
  staff_id: string | null;
  enabled: boolean;
  return_notice_enabled: boolean;
  version: number;
};
type Props = {
  numberLabel: string;
  error: string | null;
  links: WhatsAppNumberLink[];
  shops: { id: string; name: string }[];
  staff: { id: string; shop_id: string; name: string }[];
  busy: boolean;
  destination: (shop: string, staff: string | null) => string;
  add: (shop: string, staff: string | null) => Promise<boolean>;
  update: (link: WhatsAppNumberLink, enabled: boolean, returns: boolean, remove: boolean) => void;
};
const field = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm";
export function WhatsAppNumberDestinations({
  numberLabel,
  error,
  links,
  shops,
  staff,
  busy,
  destination,
  add,
  update,
}: Props) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [shop, setShop] = useState("");
  const [professional, setProfessional] = useState("");
  return (
    <section className="min-w-0 space-y-4">
      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 tablet:grid-cols-[minmax(0,1fr)_auto] tablet:items-center">
        <div>
          <h3 className="text-lg font-bold">{t("waShared.destinations")}</h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t("waHub.linksHint")}</p>
        </div>
        <button
          className="action-button action-confirm"
          disabled={busy}
          onClick={() => setAdding(true)}
        >
          <Plus className="size-5 shrink-0" aria-hidden />
          {t("waHub.useElsewhere")}
        </button>
      </div>
      <div className="flex justify-center" aria-hidden="true">
        <ArrowDown className="size-6 text-muted-foreground" />
      </div>
      <div className="grid min-w-0 gap-4 tablet:grid-cols-2 pc:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
        {links.map((link) => (
          <Destination
            key={`${link.id}:${link.version}`}
            link={link}
            name={destination(link.barbershop_id, link.staff_id)}
            busy={busy}
            update={update}
          />
        ))}
        <button
          className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-5 text-center hover:border-primary"
          disabled={busy}
          onClick={() => setAdding(true)}
        >
          <span className="grid size-12 place-items-center rounded-xl bg-accent text-primary">
            <Store className="size-6" aria-hidden />
          </span>
          <span className="text-sm font-bold">{t("waHub.addShop")}</span>
          <Plus className="size-5 text-primary" aria-hidden />
        </button>
      </div>
      <Dialog
        open={adding}
        onOpenChange={(open) => {
          if (!busy) setAdding(open);
        }}
      >
        <DialogContent
          size="lg"
          className="bg-card"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("waHub.useElsewhere")}</DialogTitle>
            <DialogDescription>{t("waHub.linkDialogHint")}</DialogDescription>
          </DialogHeader>
          <form
            className="contents"
            onSubmit={async (event) => {
              event.preventDefault();
              if (shop && !busy && (await add(shop, professional || null))) {
                setAdding(false);
                setShop("");
                setProfessional("");
              }
            }}
          >
            <DialogBody className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-accent p-3">
                <Smartphone className="size-6 shrink-0 text-primary" aria-hidden />
                <strong className="min-w-0 break-words text-sm">{numberLabel}</strong>
              </div>
              {error && <Notice tone="danger" title={error} />}
              <div className="grid gap-3 tablet:grid-cols-2">
                <label className="grid min-w-0 gap-1 text-sm font-semibold">
                  {t("waCentral.shop")}
                  <select
                    required
                    aria-label={t("waCentral.shop")}
                    className={field}
                    value={shop}
                    disabled={busy}
                    onChange={(e) => {
                      setShop(e.target.value);
                      setProfessional("");
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
                    className={field}
                    aria-label={t("waCentral.staff")}
                    value={professional}
                    disabled={busy || !shop}
                    onChange={(e) => setProfessional(e.target.value)}
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

              <Notice tone="info" title={t("waShared.addHint")} />
            </DialogBody>
            <DialogActions>
              <button
                type="button"
                className="action-button"
                disabled={busy}
                onClick={() => setAdding(false)}
              >
                {t("common.cancel")}
              </button>
              <button className="action-button action-confirm" disabled={busy || !shop}>
                {t("waShared.link")}
              </button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Destination({
  link,
  name,
  busy,
  update,
}: {
  link: WhatsAppNumberLink;
  name: string;
  busy: boolean;
  update: Props["update"];
}) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(link.enabled);
  const [returns, setReturns] = useState(link.return_notice_enabled);
  const [removing, setRemoving] = useState(false);
  return (
    <article className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-4">
      <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary">
        {link.staff_id ? (
          <Scissors className="size-6" aria-hidden />
        ) : (
          <Store className="size-6" aria-hidden />
        )}
      </span>
      <h4 className="break-words font-semibold">{name}</h4>
      <StatusBadge
        tone={link.enabled ? "success" : "neutral"}
        label={t(link.enabled ? "waCentral.enabled" : "waCentral.disabled")}
      />
      <details className="border-t border-border pt-2">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
          <Settings2 className="size-4" aria-hidden />
          {t("waHub.editNotices")}
        </summary>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            className="size-5 shrink-0"
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {t("waCentral.enable")}
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            className="size-5 shrink-0"
            type="checkbox"
            checked={returns}
            disabled={busy}
            onChange={(e) => setReturns(e.target.checked)}
          />
          {t("waDelivery.returns")}
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            className="action-button action-confirm"
            disabled={busy || (enabled === link.enabled && returns === link.return_notice_enabled)}
            onClick={() => update(link, enabled, returns, false)}
          >
            {t("waShared.save")}
          </button>
          <button className="action-button" disabled={busy} onClick={() => setRemoving(!removing)}>
            <Trash2 className="size-4" aria-hidden />
            {t("waShared.remove")}
          </button>
        </div>
      </details>
      {removing && (
        <div className="space-y-2">
          <Notice tone="warning" title={t("waShared.removeHint")} />
          <button
            className="action-button"
            disabled={busy}
            onClick={() => update(link, false, false, true)}
          >
            {t("waShared.confirmRemove")}
          </button>
        </div>
      )}
    </article>
  );
}
