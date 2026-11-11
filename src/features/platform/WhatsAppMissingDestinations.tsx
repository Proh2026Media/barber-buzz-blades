import { useState } from "react";
import { Link2, Scissors, Search, Store } from "lucide-react";
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

type Target = { shop: string; staff: string | null; name: string };
type Props = {
  shops: { id: string; name: string }[];
  staff: { id: string; shop_id: string; name: string }[];
  links: Pick<WhatsAppNumberLink, "barbershop_id" | "staff_id">[];
  numbers: { id: string; label: string | null; display_phone: string | null }[];
  busy: boolean;
  error: string | null;
  link: (number: string, shop: string, staff: string | null) => Promise<boolean>;
};

/** O número geral cobre os profissionais sem vínculo próprio. Avisos pausados ainda têm vínculo. */
function missingWhatsAppTargets(
  shops: Props["shops"],
  staff: Props["staff"],
  links: Props["links"],
): Target[] {
  return shops.flatMap((shop) => {
    if (links.some((link) => link.barbershop_id === shop.id && link.staff_id === null)) return [];
    return [
      { shop: shop.id, staff: null, name: shop.name },
      ...staff
        .filter(
          (person) =>
            person.shop_id === shop.id &&
            !links.some((link) => link.barbershop_id === shop.id && link.staff_id === person.id),
        )
        .map((person) => ({
          shop: shop.id,
          staff: person.id,
          name: `${shop.name} · ${person.name}`,
        })),
    ];
  });
}

export function WhatsAppMissingDestinations({
  shops,
  staff,
  links,
  numbers,
  busy,
  error,
  link,
}: Props) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [number, setNumber] = useState("");
  const missing = missingWhatsAppTargets(shops, staff, links);
  if (!missing.length && !target) return null;
  const visible = missing.filter((item) =>
    item.name.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)),
  );
  return (
    <section
      className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-4 tablet:p-5"
      aria-label={t("waMissing.title")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{t("waMissing.title")}</h3>
        <span className="text-sm text-muted-foreground">{missing.length}</span>
      </div>
      <p className="text-sm text-muted-foreground">{t("waMissing.hint")}</p>
      <label className="relative block max-w-lg">
        <span className="sr-only">{t("waMissing.search")}</span>
        <Search
          className="pointer-events-none absolute left-3 top-3 size-5 text-muted-foreground"
          aria-hidden
        />
        <input
          className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background pl-10 pr-3 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("waMissing.search")}
        />
      </label>
      <div
        className="max-h-80 overflow-y-auto overscroll-contain"
        tabIndex={0}
        role="region"
        aria-label={t("waMissing.title")}
      >
        <ul className="divide-y divide-border">
          {visible.map((item) => (
            <li
              key={`${item.shop}:${item.staff ?? "shop"}`}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                {item.staff ? (
                  <Scissors className="size-5" aria-hidden />
                ) : (
                  <Store className="size-5" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <h4 className="break-words text-sm font-semibold">{item.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {t(item.staff ? "waMissing.professional" : "waMissing.shop")}
                </p>
              </div>
              <button
                className="action-button"
                disabled={busy}
                onClick={() => {
                  setTarget(item);
                  setNumber("");
                }}
              >
                <Link2 className="size-4" aria-hidden />
                {t("waMissing.link")}
              </button>
            </li>
          ))}
        </ul>
        {!visible.length && (
          <p className="py-3 text-sm text-muted-foreground">{t("waCentral.empty")}</p>
        )}
      </div>
      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open && !busy) setTarget(null);
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
            <DialogTitle>{t("waMissing.link")}</DialogTitle>
            <DialogDescription>{target?.name}</DialogDescription>
          </DialogHeader>
          <form
            className="contents"
            onSubmit={async (e) => {
              e.preventDefault();
              if (target && number && !busy && (await link(number, target.shop, target.staff))) {
                setTarget(null);
                setNumber("");
              }
            }}
          >
            <DialogBody className="space-y-4">
              {error && <Notice tone="danger" title={error} />}
              {numbers.length ? (
                <label className="grid gap-2 text-sm font-semibold">
                  {t("waMissing.number")}
                  <select
                    aria-label={t("waMissing.number")}
                    required
                    className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3"
                    value={number}
                    disabled={busy}
                    onChange={(e) => setNumber(e.target.value)}
                  >
                    <option value="">{t("waMissing.choose")}</option>
                    {numbers.map((n) => (
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
              <Notice tone="info" title={t("waShared.addHint")} />
            </DialogBody>
            <DialogActions>
              <button
                type="button"
                className="action-button"
                disabled={busy}
                onClick={() => setTarget(null)}
              >
                {t("common.cancel")}
              </button>
              <button className="action-button action-confirm" disabled={busy || !number}>
                {t("waShared.link")}
              </button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
