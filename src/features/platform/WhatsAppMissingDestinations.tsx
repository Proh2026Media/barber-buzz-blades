import { useState } from "react";
import { Link2, Scissors, Search, Store } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { WhatsAppNumberLink } from "./WhatsAppNumberDestinations";

export type WhatsAppTarget = { shop: string; staff: string | null; name: string };
type Props = {
  shops: { id: string; name: string }[];
  staff: { id: string; shop_id: string; name: string }[];
  links: Pick<WhatsAppNumberLink, "barbershop_id" | "staff_id">[];
  busy: boolean;
  link: (target: WhatsAppTarget) => void;
};

/** O número geral cobre os profissionais sem vínculo próprio. Avisos pausados ainda têm vínculo. */
function missingWhatsAppTargets(
  shops: Props["shops"],
  staff: Props["staff"],
  links: Props["links"],
): WhatsAppTarget[] {
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

export function WhatsAppMissingDestinations({ shops, staff, links, busy, link }: Props) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const missing = missingWhatsAppTargets(shops, staff, links);
  if (!missing.length) return null;
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
              <button className="action-button" disabled={busy} onClick={() => link(item)}>
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
    </section>
  );
}
