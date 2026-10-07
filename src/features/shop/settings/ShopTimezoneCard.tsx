import { useEffect, useId, useState } from "react";
import {
  CalendarCheck,
  Clock,
  Globe2,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  Save,
  Smartphone,
  Store,
  type LucideIcon,
} from "lucide-react";
import {
  ActionResult,
  DetailList,
  IconList,
  SectionHeader,
  StatusBadge,
  Tag,
} from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { callOptionalRpc, isMissingRpcError } from "@/lib/auth/optional-rpc";
import { useDemo } from "@/features/demo/context";
import {
  DEFAULT_SHOP_TIME_ZONE,
  clockInTimeZone,
  detectDeviceTimeZone,
  normalizeTimeZone,
} from "@/features/register-owner/timezones";
import { TimeZoneSelect, useTimeZoneName } from "@/features/register-owner/TimeZonePicker";

type Availability = "checking" | "ready" | "missing";

/** Diferença em minutos entre os relógios de dois fusos agora (entre −12 h e +12 h). */
function clockDiff(from: string, to: string, now: Date) {
  const minutes = (clock: string) => {
    const [h, m] = clock.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  let diff = minutes(clockInTimeZone(to, now)) - minutes(clockInTimeZone(from, now));
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

function shiftClock(clock: string, diff: number) {
  const [h, m] = clock.split(":").map(Number);
  const total = (((h * 60 + m + diff) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Relógio grande com o nome do lugar (barbearia ou aparelho). */
function ClockTile({
  icon: Icon,
  label,
  time,
  zone,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  time: string;
  zone: string;
  badge?: string;
}) {
  return (
    <div className="min-w-0 flex-1 basis-36 rounded-2xl border border-border bg-background/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Icon className="size-3.5 shrink-0 text-gold" aria-hidden />
        <span className="min-w-0 flex-1">{label}</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-2xl font-extrabold tabular-nums tracking-tight">{time}</span>
        {badge && <Tag className="shrink-0">{badge}</Tag>}
      </p>
      <p className="truncate text-xs text-muted-foreground">{zone}</p>
    </div>
  );
}

/**
 * Fuso horário da barbearia em Ajustes → Agendamento.
 * Dono/sócio troca pela RPC `set_shop_timezone`; enquanto ela não existir no banco
 * (o site é publicado antes), o fuso aparece só para leitura com "disponível em breve".
 */
export function ShopTimezoneCard({
  shopId,
  timeZone,
  canEdit,
  id,
}: {
  shopId?: string | null;
  timeZone?: string | null;
  canEdit: boolean;
  /** id do cartão, para o resumo do topo levar até aqui. */
  id?: string;
}) {
  const { t } = useI18n();
  const demo = useDemo();
  const nameOf = useTimeZoneName();
  const titleId = useId();
  const selectId = useId();
  const [saved, setSaved] = useState(() => normalizeTimeZone(timeZone) ?? DEFAULT_SHOP_TIME_ZONE);
  const [draft, setDraft] = useState(saved);
  const [availability, setAvailability] = useState<Availability>("checking");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"saved" | "pending" | "error" | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [deviceTimeZone] = useState(() => detectDeviceTimeZone());
  const [editing, setEditing] = useState(false);
  const editable = canEdit && !!shopId;

  useEffect(() => {
    const next = normalizeTimeZone(timeZone) ?? DEFAULT_SHOP_TIME_ZONE;
    setSaved(next);
    setDraft(next);
  }, [timeZone]);

  // Relógio da loja atualizado a cada 30 s, para conferir com o relógio da parede.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // A função existe no banco? Sondagem sem efeito (argumentos nulos são recusados pelo banco).
  useEffect(() => {
    if (!editable) return;
    let alive = true;
    void callOptionalRpc("set_shop_timezone", { p_shop_id: null, p_timezone: null }).then(
      (result) => {
        if (alive) setAvailability(result.missing ? "missing" : "ready");
      },
    );
    return () => {
      alive = false;
    };
  }, [editable]);

  const changed = draft !== saved;
  const canChange = editable && availability === "ready";

  async function save() {
    if (!shopId || busy || !changed) return;
    setBusy(true);
    setStatus(null);
    // Chamada direta (não callOptionalRpc) para ler o `status` devolvido: em sociedade
    // igualitária ou com sócio minoritário a troca vira pedido pendente, não salva na hora.
    let outcome: "applied" | "pending" | "missing" | "error" = "error";
    try {
      const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => PromiseLike<{
        data: unknown;
        error: { code?: string; message?: string; status?: number } | null;
        status?: number;
      }>;
      const {
        data,
        error,
        status: httpStatus,
      } = await rpc("set_shop_timezone", {
        p_shop_id: shopId,
        p_timezone: draft,
      });
      if (error) {
        outcome = isMissingRpcError(error, httpStatus) ? "missing" : "error";
      } else {
        const reply =
          data && typeof data === "object" ? (data as Record<string, unknown>).status : null;
        outcome = reply === "pending" ? "pending" : "applied";
      }
    } catch {
      outcome = "error";
    }
    setBusy(false);
    if (outcome === "missing") {
      setAvailability("missing");
      setDraft(saved);
      return;
    }
    if (outcome === "error") {
      setStatus("error");
      return;
    }
    if (outcome === "pending") {
      // Nada muda até o outro sócio aprovar: volta a mostrar o fuso atual.
      setDraft(saved);
      setStatus("pending");
      return;
    }
    setSaved(draft);
    setStatus("saved");
    setEditing(false);
  }

  const shopClock = clockInTimeZone(saved, now);
  const deviceClock = clockInTimeZone(deviceTimeZone, now);
  const deviceDiff = clockDiff(saved, deviceTimeZone, now);
  const draftDiff = clockDiff(saved, draft, now);
  const hoursLabel = (diff: number) =>
    t("dec.tz.settings.diff", {
      sign: diff > 0 ? "+" : "−",
      value: Math.abs(diff) % 60 === 0 ? `${Math.abs(diff) / 60} h` : `${Math.abs(diff)} min`,
    });

  return (
    <section
      id={id}
      tabIndex={-1}
      className="app-action-card scroll-mt-24 space-y-4 p-5 outline-none"
      aria-labelledby={titleId}
    >
      <SectionHeader
        icon={Globe2}
        id={titleId}
        title={t("dec.tz.settings.title")}
        description={t("dec.tz.settings.introShort")}
        aside={
          canChange && !editing ? (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setStatus(null);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40"
            >
              <Pencil className="size-4" aria-hidden />
              {t("dec.tz.settings.change")}
            </button>
          ) : !canEdit && !demo ? (
            <StatusBadge
              tone="neutral"
              icon={Lock}
              label={t("dec.tz.settings.readOnlyBadge")}
              size="sm"
            />
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2" aria-live="polite">
        <ClockTile
          icon={Store}
          label={t("dec.tz.settings.shopClock")}
          time={shopClock}
          zone={nameOf(saved)}
        />
        {deviceTimeZone !== saved && (
          <ClockTile
            icon={Smartphone}
            label={t("dec.tz.settings.deviceClock")}
            time={deviceClock}
            zone={nameOf(deviceTimeZone)}
            badge={deviceDiff !== 0 ? hoursLabel(deviceDiff) : undefined}
          />
        )}
      </div>

      {canChange && editing && (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <label htmlFor={selectId} className="text-sm font-semibold">
            {t("dec.tz.label")}
          </label>
          <TimeZoneSelect
            id={selectId}
            value={draft}
            keep={[saved, deviceTimeZone]}
            disabled={busy}
            onChange={(next) => {
              setDraft(next);
              setStatus(null);
            }}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-3 text-base sm:text-sm"
          />
          {changed && (
            <>
              <DetailList
                items={[
                  {
                    label: t("dec.tz.settings.exampleLabel"),
                    icon: Clock,
                    previous: "15:00",
                    value: shiftClock("15:00", draftDiff),
                    delta: draftDiff !== 0 ? { label: hoursLabel(draftDiff) } : undefined,
                  },
                ]}
              />
              <IconList
                items={[
                  { icon: Clock, text: t("dec.tz.settings.keepsHours") },
                  { icon: CalendarCheck, text: t("dec.tz.settings.keepsBookings") },
                ]}
              />
            </>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setDraft(saved);
              }}
              className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold"
            >
              {t("dec.tz.settings.keep")}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !changed}
              aria-busy={busy || undefined}
              className="action-button action-confirm sm:px-5"
            >
              {busy ? (
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              {busy ? t("common.saving") : t("dec.tz.settings.save")}
            </button>
          </div>
        </div>
      )}

      {editable && availability === "missing" && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("dec.tz.settings.soon")}
        </p>
      )}

      <ActionResult
        state={status}
        text={
          status === "saved"
            ? t("dec.tz.settings.saved", { zone: nameOf(saved) })
            : status === "pending"
              ? t("visual.result.pending")
              : status === "error"
                ? t("dec.tz.settings.error")
                : undefined
        }
        onRetry={() => void save()}
        detail={
          status === "saved" ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40"
            >
              <RefreshCw className="size-4" aria-hidden />
              {t("dec.tz.settings.reload")}
            </button>
          ) : undefined
        }
      />
    </section>
  );
}
