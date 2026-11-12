import { useState } from "react";
import { ArrowRight, ChevronDown, Link2, Scissors, Search, Store } from "lucide-react";
import { StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import {
  whatsappCoverage,
  type DirectoryNumber,
  type DirectoryLink,
} from "@/lib/whatsapp/directory-model";

type Props = {
  shops: { id: string; name: string }[];
  staff: { id: string; shop_id: string; name: string }[];
  numbers: DirectoryNumber[];
  links: DirectoryLink[];
  busy: boolean;
  link: (target: { shop: string; staff: string | null }) => void;
  viewNumber: (id: string) => void;
};

/** Uma barbearia aparece uma vez. A equipe mostra se usa número próprio ou o geral. */
export function WhatsAppShopDirectory(props: Props) {
  const { shops, staff, numbers, links, busy, link, viewNumber } = props;
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const rows = shops.map((shop) => {
    const general = whatsappCoverage(shop.id, null, numbers, links);
    const people = staff
      .filter((person) => person.shop_id === shop.id)
      .map((person) => ({
        ...person,
        coverage: whatsappCoverage(shop.id, person.id, numbers, links),
      }));
    return {
      shop,
      general,
      people,
      missing: people.filter((p) => p.coverage.kind === "none").length,
    };
  });
  const visible = rows.filter(
    (row) =>
      `${row.shop.name} ${row.people.map((p) => p.name).join(" ")}`
        .toLocaleLowerCase(locale)
        .includes(query.toLocaleLowerCase(locale)) &&
      (filter === "all" ||
        (filter === "missing"
          ? row.general.kind === "none"
          : filter === "team"
            ? row.missing > 0
            : row.general.kind !== "none")),
  );
  function coverageRow(
    shop: string,
    person: string | null,
    name: string,
    coverage: ReturnType<typeof whatsappCoverage>,
  ) {
    const own = coverage.kind === "own";
    const usingBackup = coverage.number?.delivery_mode === "backup";
    const sender = usingBackup
      ? numbers.find((n) => n.instance_name === coverage.number?.backup_instance_name)
      : coverage.number;
    const state = sender?.status;
    const connectionLabel =
      state === "open"
        ? "integr.wa.status.open"
        : state === "connecting" || state === "qr"
          ? "integr.wa.status.connecting"
          : state === "disconnected"
            ? "waOrg.notConnected"
            : "waOrg.unknownConnection";
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-3 py-3">
        <div className="min-w-0 flex-1 basis-44">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {person && <Scissors className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
            <span className="min-w-0 break-words">{name}</span>
          </p>
          <p className="mt-1 break-words text-sm font-bold tabular-nums">
            {coverage.number?.display_phone || t("waOrg.noNumber")}
          </p>
          {coverage.number ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {person && <span>{t(own ? "waOrg.ownNumber" : "waOrg.usesShop")}</span>}
              {usingBackup && (
                <span>
                  {t("waOrg.reserveActive", {
                    number: sender?.display_phone || t("waNumbers.legacy"),
                  })}
                </span>
              )}
              <StatusBadge
                size="sm"
                tone={state === "open" ? "success" : "warning"}
                label={t(connectionLabel)}
              />
              <span>
                {t(
                  coverage.link?.enabled && coverage.number.delivery_mode !== "paused"
                    ? "waOrg.noticesOn"
                    : "waOrg.noticesOff",
                )}
              </span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{t("waOrg.chooseHint")}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {coverage.number ? (
            <>
              <button
                type="button"
                className="action-button"
                disabled={busy}
                onClick={() => viewNumber(coverage.number!.id)}
              >
                {t("waOrg.viewNumber")}
                <ArrowRight className="size-4" aria-hidden />
              </button>
              {!own && (
                <button
                  type="button"
                  className="action-button"
                  disabled={busy}
                  onClick={() => link({ shop, staff: person })}
                >
                  {t("waOrg.chooseOwn")}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="action-button action-confirm"
                disabled={busy}
                onClick={() => link({ shop, staff: person })}
              >
                <Link2 className="size-4" aria-hidden />
                {t("waOrg.chooseNumber")}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
  return (
    <section aria-label={t("waOrg.shops")} className="space-y-4">
      <div className="grid gap-3 tablet:grid-cols-[minmax(0,1fr)_minmax(14rem,20rem)]">
        <label className="relative block">
          <span className="sr-only">{t("waMissing.search")}</span>
          <Search
            className="pointer-events-none absolute left-3 top-3 size-5 text-muted-foreground"
            aria-hidden
          />
          <input
            className="min-h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm"
            placeholder={t("waMissing.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">{t("waOrg.filter")}</span>
          <select
            aria-label={t("waOrg.filter")}
            className="min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{t("waOrg.allShops")}</option>
            <option value="with">{t("waOrg.withGeneral")}</option>
            <option value="missing">{t("waOrg.withoutGeneral")}</option>
            <option value="team">{t("waOrg.missingTeam")}</option>
          </select>
        </label>
      </div>
      <div className="grid items-start gap-4 min-[1280px]:grid-cols-2">
        {visible.map(({ shop, general, people, missing }) => (
          <article
            key={shop.id}
            className="min-w-0 rounded-2xl border border-border bg-card p-4 tablet:p-5"
            aria-label={shop.name}
          >
            <header className="flex items-start gap-3 border-b border-border pb-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                <Store className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="break-words font-bold">{shop.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(general.number ? "waOrg.withGeneral" : "waOrg.withoutGeneral")}
                </p>
              </div>
            </header>
            {coverageRow(shop.id, null, t("waOrg.general"), general)}
            {people.length > 0 && (
              <details className="group border-t border-border pt-2">
                <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 text-sm font-semibold">
                  <Scissors className="size-4" aria-hidden />
                  <span>{t("waOrg.teamCount", { count: people.length })}</span>
                  {missing > 0 && (
                    <StatusBadge
                      size="sm"
                      tone="warning"
                      label={t("waOrg.missingCount", { count: missing })}
                    />
                  )}
                  <ChevronDown
                    className="ml-auto size-4 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="divide-y divide-border">
                  {people.map((person) => (
                    <div key={person.id}>
                      {coverageRow(shop.id, person.id, person.name, person.coverage)}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </article>
        ))}
      </div>
      {!visible.length && (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {t(shops.length ? "waCentral.empty" : "waOrg.noShops")}
        </p>
      )}
    </section>
  );
}
