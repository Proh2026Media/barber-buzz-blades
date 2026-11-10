import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Save } from "lucide-react";
import { ActionResult, Hint, Notice } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { useI18n } from "@/lib/i18n";

type Mode = "primary" | "backup" | "paused";
type Delivery = { backup: string; mode: Mode; returns: boolean };

/** Configuração da rota fixa; nunca cria números nem inicia envios ao abrir. */
export function ShopWhatsAppDelivery({ shopId }: { shopId: string }) {
  const { t } = useI18n();
  const demo = useDemo();
  const [form, setForm] = useState<Delivery>({ backup: "", mode: "primary", returns: false });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [technical, setTechnical] = useState(false);
  const [result, setResult] = useState<"error" | "saved" | null>(null);
  const active = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => {
    const generation = ++active.current;
    setLoading(true);
    setReady(false);
    setResult(null);
    if (demo) {
      setLoading(false);
      return;
    }
    void supabase
      .from("whatsapp_channels")
      .select("*")
      .eq("barbershop_id", shopId)
      .is("staff_id", null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active.current !== generation) return;
        setLoading(false);
        if (error) {
          setResult("error");
          return;
        }
        if (!data || !("delivery_mode" in data)) return;
        setForm({
          backup: data.backup_instance_name ?? "",
          mode: data.delivery_mode as Mode,
          returns: data.return_notice_enabled,
        });
        setTechnical(data.delivery_mode === "backup");
        setReady(true);
      });
    return () => {
      active.current += 1;
    };
  }, [shopId, demo]);

  async function save() {
    if (
      demo ||
      !ready ||
      inFlight.current ||
      (form.mode === "backup" && (!technical || !form.backup.trim()))
    )
      return;
    const generation = active.current;
    inFlight.current = true;
    setSaving(true);
    setResult(null);
    try {
      const { error } = await supabase.rpc("configure_shop_whatsapp_delivery", {
        p_shop_id: shopId,
        p_backup_instance: form.backup.trim() || null,
        p_mode: form.mode,
        p_reason: form.mode === "backup" ? "technical_failure" : "review",
        p_return_enabled: form.returns,
      });
      if (active.current === generation) setResult(error ? "error" : "saved");
    } catch {
      if (active.current === generation) setResult("error");
    } finally {
      inFlight.current = false;
      if (active.current === generation) setSaving(false);
    }
  }
  if (loading)
    return (
      <p role="status" className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("shop.loading")}
      </p>
    );
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h4 className="flex items-center gap-2 font-bold">
        <MessageCircle className="size-4" aria-hidden />
        {t("waDelivery.title")}
      </h4>
      {!ready ? (
        <Notice tone="info" title={t("waDelivery.unavailable")} />
      ) : (
        <>
          <label className="grid gap-1 text-sm font-semibold">
            {t("waDelivery.backup")}
            <input
              value={form.backup}
              disabled={saving}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => {
                setForm({ ...form, backup: e.target.value });
                setResult(null);
              }}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3"
            />
          </label>
          <Hint>{t("waDelivery.backupHint")}</Hint>
          <label className="grid gap-1 text-sm font-semibold">
            {t("waDelivery.mode")}
            <select
              value={form.mode}
              disabled={saving}
              onChange={(e) => {
                setForm({ ...form, mode: e.target.value as Mode });
                setTechnical(false);
                setResult(null);
              }}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3"
            >
              <option value="primary">{t("waDelivery.primary")}</option>
              <option value="backup">{t("waDelivery.reserve")}</option>
              <option value="paused">{t("waDelivery.paused")}</option>
            </select>
          </label>
          {form.mode === "backup" && (
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={technical}
                disabled={saving}
                onChange={(e) => setTechnical(e.target.checked)}
                className="mt-1 size-5 shrink-0"
              />
              {t("waDelivery.technical")}
            </label>
          )}
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.returns}
              disabled={saving}
              onChange={(e) => {
                setForm({ ...form, returns: e.target.checked });
                setResult(null);
              }}
              className="mt-1 size-5 shrink-0"
            />
            {t("waDelivery.returns")}
          </label>
          <Hint>{t("waDelivery.limits")}</Hint>
          <button
            type="button"
            className="action-button action-confirm"
            onClick={() => void save()}
            disabled={saving || (form.mode === "backup" && (!technical || !form.backup.trim()))}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {t("visual.unsaved.save")}
          </button>
        </>
      )}
      <ActionResult
        state={result}
        text={result === "saved" ? t("waDelivery.saved") : t("waDelivery.error")}
      />
    </section>
  );
}
