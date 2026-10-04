import { useEffect, useId, useState } from "react";
import { Clock, Info, RefreshCw, Save } from "lucide-react";
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

/**
 * Fuso horário da barbearia em Ajustes → Agendamento.
 * Dono/sócio troca pela RPC `set_shop_timezone`; enquanto ela não existir no banco
 * (o site é publicado antes), o fuso aparece só para leitura com "disponível em breve".
 */
export function ShopTimezoneCard({
  shopId,
  timeZone,
  canEdit,
}: {
  shopId?: string | null;
  timeZone?: string | null;
  canEdit: boolean;
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
  }

  return (
    <section className="app-action-card space-y-4 p-5" aria-labelledby={titleId}>
      <div>
        <p className="text-xs text-muted-foreground">{t("dec.tz.settings.section")}</p>
        <h3 id={titleId} className="flex items-center gap-2 font-bold">
          <Clock className="size-4" aria-hidden />
          {t("dec.tz.settings.title")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("dec.tz.settings.intro")}</p>
      </div>

      {canChange ? (
        <div className="space-y-2">
          <label htmlFor={selectId} className="text-xs font-semibold text-muted-foreground">
            {t("dec.tz.label")}
          </label>
          <TimeZoneSelect
            id={selectId}
            value={draft}
            keep={[saved, deviceTimeZone]}
            disabled={busy}
            describedBy={`${selectId}-clock`}
            onChange={(next) => {
              setDraft(next);
              setStatus(null);
            }}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs font-semibold text-muted-foreground">{t("dec.tz.label")}</p>
          <p className="mt-1 text-sm font-bold">{nameOf(saved)}</p>
        </div>
      )}

      <p id={`${selectId}-clock`} className="text-sm" aria-live="polite">
        {t("dec.tz.settings.clock", { time: clockInTimeZone(draft, now) })}
      </p>

      {deviceTimeZone !== draft && (
        <p className="text-xs text-muted-foreground">
          {t("dec.tz.settings.deviceDiffers", { zone: nameOf(deviceTimeZone) })}
        </p>
      )}

      {canChange && changed && (
        <aside className="flex gap-3 rounded-2xl border border-border bg-card p-4">
          <Info className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
          <p className="text-xs">{t("dec.tz.settings.effect", { zone: nameOf(draft) })}</p>
        </aside>
      )}

      {editable && availability === "missing" && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("dec.tz.settings.soon")}
        </p>
      )}
      {!canEdit && !demo && (
        <p className="text-xs text-muted-foreground">{t("dec.tz.settings.readOnly")}</p>
      )}

      {canChange && (
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !changed}
          className="action-button action-confirm w-full"
        >
          <Save className="size-4" aria-hidden />
          {busy ? t("common.saving") : t("dec.tz.settings.save")}
        </button>
      )}

      {status === "error" && (
        <p role="alert" className="text-center text-xs font-semibold text-destructive">
          {t("dec.tz.settings.error")}
        </p>
      )}
      {status === "pending" && (
        <p role="status" className="text-center text-xs font-semibold text-muted-foreground">
          {t("shop.governance.pending")}
        </p>
      )}
      {status === "saved" && (
        <div role="status" className="space-y-2 text-center">
          <p className="text-xs font-semibold text-primary">
            {t("dec.tz.settings.saved", { zone: nameOf(saved) })}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold transition hover:border-primary/40"
          >
            <RefreshCw className="size-4" aria-hidden />
            {t("dec.tz.settings.reload")}
          </button>
        </div>
      )}
    </section>
  );
}
