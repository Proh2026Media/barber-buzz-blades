import { useState } from "react";
import { Plus, Trash2, Store, Scissors, Settings2 } from "lucide-react";
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
  busy: boolean;
  destination: (shop: string, staff: string | null) => string;
  add: () => void;
  update: (link: WhatsAppNumberLink, enabled: boolean, returns: boolean, remove: boolean) => void;
};
export function WhatsAppNumberDestinations({ links, busy, destination, add, update }: Props) {
  const { t } = useI18n();
  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{t("waShared.destinations")}</h3>
        <span className="text-sm text-muted-foreground">
          {t("waHub.destinationsCount", { count: links.length })}
        </span>
      </div>
      <div className="divide-y divide-border">
        {links.map((link) => (
          <Destination
            key={link.id}
            link={link}
            name={destination(link.barbershop_id, link.staff_id)}
            busy={busy}
            update={update}
          />
        ))}
      </div>
      <button className="action-button action-confirm w-full" disabled={busy} onClick={add}>
        <Plus className="size-5 shrink-0" aria-hidden />
        {t("waHub.useElsewhere")}
      </button>
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
  const [draft, setDraft] = useState({
    version: link.version,
    enabled: link.enabled,
    returns: link.return_notice_enabled,
  });
  const enabled = draft.version === link.version ? draft.enabled : link.enabled;
  const returns = draft.version === link.version ? draft.returns : link.return_notice_enabled;
  const dirty = enabled !== link.enabled || returns !== link.return_notice_enabled;
  const [removing, setRemoving] = useState(false);
  return (
    <article className="min-w-0 space-y-2 py-4 first:pt-1 last:pb-1">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
          {link.staff_id ? (
            <Scissors className="size-6" aria-hidden />
          ) : (
            <Store className="size-6" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1 basis-32">
          <h4 className="break-words font-semibold">{name}</h4>
          <p className="text-sm text-muted-foreground">
            {t(link.staff_id ? "waCentral.staff" : "waCentral.wholeShop")}
          </p>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            className="size-5 shrink-0"
            type="checkbox"
            aria-label={t("waCentral.enable")}
            checked={enabled}
            disabled={busy}
            onChange={(e) => {
              setDraft({ version: link.version, enabled: e.target.checked, returns });
              setRemoving(false);
            }}
          />
          {t(enabled ? "waCentral.enabled" : "waCentral.disabled")}
        </label>
      </div>
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
          <Settings2 className="size-4" aria-hidden />
          {t("waHub.editNotices")}
        </summary>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            className="size-5 shrink-0"
            type="checkbox"
            checked={returns}
            disabled={busy}
            onChange={(e) =>
              setDraft({ version: link.version, enabled, returns: e.target.checked })
            }
          />
          {t("waDelivery.returns")}
        </label>
        <button className="action-button" disabled={busy} onClick={() => setRemoving(!removing)}>
          <Trash2 className="size-4" aria-hidden />
          {t("waShared.remove")}
        </button>
      </details>
      {dirty && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent p-3">
          <span className="text-sm">{t("waOperation.unsaved")}</span>
          <button
            className="action-button action-confirm"
            disabled={busy}
            onClick={() => update(link, enabled, returns, false)}
          >
            {t("waShared.save")}
          </button>
        </div>
      )}
      {removing && (
        <div className="space-y-2">
          <Notice tone="warning" title={t("waShared.removeHint")} />
          <div className="flex flex-wrap gap-2">
            <button className="action-button" disabled={busy} onClick={() => setRemoving(false)}>
              {t("common.cancel")}
            </button>
            <button
              className="action-button"
              disabled={busy}
              onClick={() => update(link, false, false, true)}
            >
              {t("waShared.confirmRemove")}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
