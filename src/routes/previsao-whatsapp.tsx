import { DistributionSuggestion } from "@/features/platform/DistributionSuggestion";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FlaskConical, MessageCircle, RotateCcw, Smartphone } from "lucide-react";
import { NotFoundPage } from "@/components/NotFoundPage";
import { Notice, StatusBadge } from "@/components/visual";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  WhatsAppDistribution,
  type DistributionNumber,
  type DistributionRoute,
} from "@/features/platform/WhatsAppDistribution";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/previsao-whatsapp")({
  ssr: false,
  component: PreviewRoute,
});

const numbers: DistributionNumber[] = [
  { id: "numero-a", label: "Número A", display_phone: "5511900000101", status: "open" },
  { id: "numero-b", label: "Número B", display_phone: "5511900000202", status: "open" },
  { id: "numero-c", label: "Número C", display_phone: "5511900000303", status: "disconnected" },
];
const shops = [
  { id: "arena", name: "Arena · teste" },
  { id: "centro", name: "Barbearia do Centro · teste" },
  { id: "nova", name: "Barbearia Nova · teste" },
];
const staff = [
  { id: "rafael", shop_id: "arena", name: "Rafael" },
  { id: "bruno", shop_id: "arena", name: "Bruno" },
  { id: "carlos", shop_id: "centro", name: "Carlos" },
];
const initialRoutes: DistributionRoute[] = [
  {
    id: "rota-arena",
    barbershop_id: "arena",
    staff_id: null,
    channel_id: "numero-a",
    backup_channel_id: "numero-b",
    delivery_mode: "primary",
    enabled: true,
    version: 1,
    return_notice_enabled: false,
  },
  {
    id: "rota-centro",
    barbershop_id: "centro",
    staff_id: null,
    channel_id: "numero-b",
    backup_channel_id: "numero-a",
    delivery_mode: "primary",
    enabled: false,
    version: 1,
    return_notice_enabled: false,
  },
];

/** Prévia descartável: não importa Supabase e não conecta nem envia mensagens. */
function PreviewRoute() {
  return import.meta.env.DEV ? <Preview /> : <NotFoundPage />;
}

function Preview() {
  const { t } = useI18n();
  const [routes, setRoutes] = useState(initialRoutes);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const selected = numbers.find((number) => number.id === selectedNumber);
  return (
    <div className="brand-page min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-[#20211f] text-[#f1ede6]">
        <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-3 px-4 py-4 tablet:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-[#c6a16a]">
              <MessageCircle className="size-6" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-bold">{t("waPreview.title")}</h1>
              <p className="text-xs text-[#c6a16a]">{t("waPreview.notice")}</p>
            </div>
          </div>
          <button
            type="button"
            className="action-button"
            onClick={() => {
              setRoutes(initialRoutes);
              setSaved(false);
              setPreviewVersion((v) => v + 1);
            }}
          >
            <RotateCcw className="size-4" aria-hidden />
            {t("waPreview.reset")}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[100rem] space-y-5 px-4 py-5 tablet:px-6 tablet:py-6">
        <section className="wa-future-stats" aria-label={t("waRefine.stats")}>
          <header>
            <h2>
              <Smartphone className="size-5" aria-hidden />
              {t("waRefine.stats")}
            </h2>
            <StatusBadge tone="warning" label={t("waRefine.future")} />
          </header>
          <p>{t("waRefine.futureHint")}</p>
          <div>
            {["volume", "days", "usage", "suggestions"].map((key) => (
              <article key={key}>
                <span>
                  {key === "usage"
                    ? t("waAuto.bindings")
                    : t(("waRefine." + key) as "waRefine.volume")}
                </span>
                <strong>{key === "usage" ? routes.length : "—"}</strong>
                <small>{t(key === "usage" ? "waAuto.sample" : "waRefine.noData")}</small>
              </article>
            ))}
          </div>
          <DistributionSuggestion
            key={previewVersion}
            numbers={numbers}
            shops={shops}
            routes={routes}
            apply={(shop, ids) => {
              setRoutes((all) => {
                const current = all.find((r) => r.barbershop_id === shop && r.staff_id === null);
                return [
                  ...all.filter((r) => r.barbershop_id !== shop || r.staff_id !== null),
                  {
                    id: current?.id ?? `rota-${shop}-geral`,
                    barbershop_id: shop,
                    staff_id: null,
                    channel_id: ids.primary,
                    backup_channel_id: ids.backup,
                    backup2_channel_id: ids.backup2,
                    delivery_mode: "primary",
                    enabled: false,
                    return_notice_enabled: current?.return_notice_enabled ?? false,
                    version: (current?.version ?? 0) + 1,
                  },
                ];
              });
              setSaved(true);
            }}
          />
        </section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <StatusBadge tone="info" icon={FlaskConical} label={t("waPreview.noRemote")} />
        </div>

        {saved && <Notice tone="success" title={t("waPreview.saved")} />}
        <WhatsAppDistribution
          key={previewVersion}
          numbers={numbers}
          shops={shops}
          staff={staff}
          routes={routes}
          supported
          secondReserve
          busy={false}
          save={async (target) => {
            const current = routes.find(
              (route) => route.barbershop_id === target.shop && route.staff_id === target.staff,
            );
            if (
              (current?.version ?? null) !== target.expectedVersion ||
              (!target.primary && target.backup !== null) ||
              (target.primary !== null && target.primary === target.backup) ||
              Boolean(
                target.backup2 &&
                (target.backup2 === target.primary || target.backup2 === target.backup),
              ) ||
              (target.primary !== null && !numbers.some((n) => n.id === target.primary)) ||
              (target.backup !== null && !numbers.some((n) => n.id === target.backup)) ||
              (target.mode === "backup" &&
                (!target.backup ||
                  ((current?.delivery_mode !== "backup" ||
                    current.backup_channel_id !== target.backup) &&
                    !target.technical)))
            )
              return false;
            setRoutes((all) => {
              const others = all.filter(
                (route) =>
                  !(route.barbershop_id === target.shop && route.staff_id === target.staff),
              );
              if (!target.primary) return others;
              return [
                ...others,
                {
                  id: current?.id ?? `rota-${target.shop}-${target.staff ?? "geral"}`,
                  barbershop_id: target.shop,
                  staff_id: target.staff,
                  channel_id: target.primary,
                  backup_channel_id: target.backup,
                  backup2_channel_id: target.backup2 ?? null,
                  delivery_mode: target.mode,
                  enabled: target.enabled,
                  return_notice_enabled: target.returns,
                  version: (current?.version ?? 0) + 1,
                },
              ];
            });
            setSaved(true);
            return true;
          }}
          viewNumber={setSelectedNumber}
        />
      </main>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedNumber(null)}>
        <DialogContent size="sm" className="bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="size-5" aria-hidden />
              {selected?.label}
            </DialogTitle>
            <DialogDescription>{t("waPreview.number")}</DialogDescription>
          </DialogHeader>
          <p className="text-lg font-semibold tabular-nums">{selected?.display_phone}</p>
          <StatusBadge
            tone={selected?.status === "open" ? "success" : "neutral"}
            label={t(selected?.status === "open" ? "waHealth.connected" : "waOrg.notConnected")}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
