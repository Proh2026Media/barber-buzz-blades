import { useState } from "react";
import { Plus, Trash2, Store } from "lucide-react";
import { Notice } from "@/components/visual";
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
  links: WhatsAppNumberLink[];
  shops: { id: string; name: string }[];
  staff: { id: string; shop_id: string; name: string }[];
  busy: boolean;
  destination: (shop: string, staff: string | null) => string;
  add: (shop: string, staff: string | null) => void;
  update: (link: WhatsAppNumberLink, enabled: boolean, returns: boolean, remove: boolean) => void;
};
const field = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm";
export function WhatsAppNumberDestinations({
  links,
  shops,
  staff,
  busy,
  destination,
  add,
  update,
}: Props) {
  const { t } = useI18n();
  const [shop, setShop] = useState("");
  const [professional, setProfessional] = useState("");
  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-bold">
        <Store className="size-5 shrink-0" aria-hidden />
        {t("waShared.destinations")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("waShared.intro")}</p>
      <div className="space-y-3">
        {links.map((link) => (
          <Destination
            key={`${link.id}:${link.version}`}
            link={link}
            name={destination(link.barbershop_id, link.staff_id)}
            busy={busy}
            update={update}
          />
        ))}
      </div>
      <form
        className="space-y-3 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (shop && !busy) add(shop, professional || null);
        }}
      >
        <h4 className="font-semibold">{t("waShared.add")}</h4>
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
        <p className="text-sm text-muted-foreground">{t("waShared.addHint")}</p>
        <button className="action-button action-confirm" disabled={busy || !shop}>
          <Plus className="size-4" aria-hidden />
          {t("waShared.link")}
        </button>
      </form>
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
    <article className="min-w-0 space-y-2 rounded-xl border border-border p-3">
      <h4 className="break-words font-semibold">{name}</h4>
      <p className="text-xs font-semibold">
        {t(link.enabled ? "waCentral.enabled" : "waCentral.disabled")}
      </p>
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
