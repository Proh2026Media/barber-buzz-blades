import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, MessageCircle, QrCode, RefreshCw, Unplug } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useDemo } from "@/features/demo/context";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";
import {
  friendlyChannelLastError,
  friendlyIntegrationError,
} from "@/lib/integrations/friendly-error";
import {
  DEFAULT_WHATSAPP_BODIES,
  SAMPLE_WHATSAPP_VARS,
  WHATSAPP_TEMPLATE_VARS,
  WHATSAPP_TEMPLATE_VAR_HELP,
  normalizeWhatsAppTemplate,
  renderWhatsAppTemplate,
  validateWhatsAppTemplate,
  whatsappCodePointLength,
  type WhatsAppTemplateKey,
  type WhatsAppTemplateVar,
} from "@/lib/whatsapp/templates";
import { WhatsAppFormattedPreview } from "@/features/shop/WhatsAppFormattedPreview";
import {
  WhatsAppChipEditor,
  type WhatsAppChipEditorHandle,
} from "@/features/shop/WhatsAppChipEditor";

type Channel = Tables<"whatsapp_channels">;

type WhatsAppSettingsCardProps = {
  shopId: string;
};

const TEMPLATE_META: Array<{
  key: WhatsAppTemplateKey;
  titleKey: MessageKey;
  hintKey: MessageKey;
}> = [
  {
    key: "booking.confirmed",
    titleKey: "integr.wa.tplConfirmed",
    hintKey: "integr.wa.tplConfirmedHint",
  },
  {
    key: "booking.rescheduled",
    titleKey: "integr.wa.tplRescheduled",
    hintKey: "integr.wa.tplRescheduledHint",
  },
  {
    key: "booking.cancelled",
    titleKey: "integr.wa.tplCancelled",
    hintKey: "integr.wa.tplCancelledHint",
  },
  {
    key: "booking.reminder",
    titleKey: "integr.wa.tplReminder",
    hintKey: "integr.wa.tplReminderHint",
  },
];

async function callChannel(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error(tNow("integr.err.session"));

  const base = import.meta.env.VITE_SUPABASE_URL || "";
  const response = await fetch(`${base}/functions/v1/whatsapp-channel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    error?: string;
    channel?: Channel;
    qrcode?: string | null;
  };
  if (!response.ok) throw new Error(payload.error || tNow("integr.wa.errGeneric"));
  return payload;
}

const statusKey = {
  disconnected: "integr.wa.status.disconnected",
  qr: "integr.wa.status.qr",
  connecting: "integr.wa.status.connecting",
  open: "integr.wa.status.open",
} as const satisfies Record<Channel["status"], MessageKey>;

export function WhatsAppSettingsCard({ shopId }: WhatsAppSettingsCardProps) {
  const demo = useDemo();
  const { t } = useI18n();
  const editorRef = useRef<WhatsAppChipEditorHandle>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [templates, setTemplates] = useState<Record<WhatsAppTemplateKey, string>>({
    ...DEFAULT_WHATSAPP_BODIES,
  });
  const [activeTemplate, setActiveTemplate] = useState<WhatsAppTemplateKey>("booking.confirmed");
  const [templatesDirty, setTemplatesDirty] = useState(false);
  const [previewMode, setPreviewMode] = useState<"preview" | "source">("preview");
  const [restoreOpen, setRestoreOpen] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (demo) {
      setTemplates({ ...DEFAULT_WHATSAPP_BODIES });
      setTemplatesDirty(false);
      return;
    }
    const { data, error: loadError } = await supabase
      .from("whatsapp_message_templates")
      .select("template_key, body")
      .eq("barbershop_id", shopId);
    if (loadError) {
      setTemplates({ ...DEFAULT_WHATSAPP_BODIES });
      setTemplatesDirty(false);
      return;
    }
    const next = { ...DEFAULT_WHATSAPP_BODIES };
    for (const row of data ?? []) {
      if (row.template_key in next) {
        next[row.template_key as WhatsAppTemplateKey] = row.body;
      }
    }
    setTemplates(next);
    setTemplatesDirty(false);
  }, [demo, shopId]);

  const refresh = useCallback(async () => {
    if (demo) {
      setChannel({
        barbershop_id: shopId,
        instance_name: "demo-shop",
        status: "open",
        display_phone: "+5511999999999",
        enabled: true,
        notify_booking: true,
        notify_reminder: true,
        reminder_hours_before: 24,
        last_error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await loadTemplates();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await callChannel({ action: "status", barbershop_id: shopId });
      setChannel(payload.channel ?? null);
      setQrcode(payload.qrcode ?? null);
      await loadTemplates();
    } catch (err) {
      setError(friendlyIntegrationError(err, tNow("integr.wa.errStatus")));
    } finally {
      setBusy(false);
    }
  }, [demo, loadTemplates, shopId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!qrOpen || channel?.status === "open") return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const payload = await callChannel({ action: "status", barbershop_id: shopId });
          setChannel(payload.channel ?? null);
          setQrcode(payload.qrcode ?? null);
          if (payload.channel?.status === "open") {
            setQrOpen(false);
            setMessage(tNow("integr.wa.connected"));
          }
        } catch {
          /* ignore polling errors */
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [qrOpen, channel?.status, shopId]);

  async function connect() {
    if (demo) {
      setMessage(t("integr.wa.demoConnected"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callChannel({ action: "connect", barbershop_id: shopId });
      setChannel(payload.channel ?? null);
      setQrcode(payload.qrcode ?? null);
      if (payload.qrcode) setQrOpen(true);
      setMessage(
        payload.channel?.status === "open" ? t("integr.wa.connected") : t("integr.wa.scanQr"),
      );
    } catch (err) {
      setError(friendlyIntegrationError(err, t("integr.wa.errConnect")));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (demo) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await callChannel({ action: "logout", barbershop_id: shopId });
      setChannel(payload.channel ?? null);
      setQrcode(null);
      setMessage(t("integr.wa.disconnected"));
    } catch (err) {
      setError(friendlyIntegrationError(err, t("integr.wa.errDisconnect")));
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(patch: Partial<Channel>) {
    if (demo) {
      setChannel((current) => (current ? { ...current, ...patch } : current));
      return;
    }
    if (!channel) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await callChannel({
        action: "settings",
        barbershop_id: shopId,
        notify_booking: patch.notify_booking ?? channel.notify_booking,
        notify_reminder: patch.notify_reminder ?? channel.notify_reminder,
        reminder_hours_before: patch.reminder_hours_before ?? channel.reminder_hours_before,
        enabled: patch.enabled ?? channel.enabled,
      });
      setChannel(payload.channel ?? null);
      setMessage(t("integr.wa.prefsSaved"));
    } catch (err) {
      setError(friendlyIntegrationError(err, t("integr.wa.errSave")));
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplates() {
    if (demo) {
      setTemplatesDirty(false);
      setMessage(t("integr.wa.demoTemplates"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rows = TEMPLATE_META.map(({ key }) => {
        const body = normalizeWhatsAppTemplate(templates[key]);
        const issues = validateWhatsAppTemplate(body);
        if (issues.length) {
          const meta = TEMPLATE_META.find((m) => m.key === key);
          throw new Error(`${meta ? t(meta.titleKey) : key}: ${issues[0]}`);
        }
        return { barbershop_id: shopId, template_key: key, body };
      });
      const { error: upsertError } = await supabase
        .from("whatsapp_message_templates")
        .upsert(rows, { onConflict: "barbershop_id,template_key" });
      if (upsertError) throw upsertError;
      setTemplatesDirty(false);
      setMessage(t("integr.wa.templatesSaved"));
    } catch (err) {
      setError(friendlyIntegrationError(err, t("integr.wa.errSaveTemplates")));
    } finally {
      setBusy(false);
    }
  }

  function updateActiveBody(next: string) {
    setTemplates((current) => ({ ...current, [activeTemplate]: next }));
    setTemplatesDirty(true);
  }

  function insertVariable(key: WhatsAppTemplateVar) {
    editorRef.current?.insertVariable(key);
    editorRef.current?.focus();
  }

  function applyWrap(wrapper: "*" | "_" | "~") {
    editorRef.current?.applyWrap(wrapper);
    editorRef.current?.focus();
  }

  function confirmRestore() {
    setTemplates((current) => ({
      ...current,
      [activeTemplate]: DEFAULT_WHATSAPP_BODIES[activeTemplate],
    }));
    setTemplatesDirty(true);
    setRestoreOpen(false);
    setMessage(t("integr.wa.restored"));
  }

  const activeMeta = TEMPLATE_META.find((m) => m.key === activeTemplate) ?? TEMPLATE_META[0];
  const activeBody = templates[activeTemplate];
  const activeLength = whatsappCodePointLength(activeBody);
  const activeErrors = validateWhatsAppTemplate(activeBody);
  const previewFilled = renderWhatsAppTemplate(activeBody, SAMPLE_WHATSAPP_VARS);
  const canSave =
    templatesDirty &&
    TEMPLATE_META.every(({ key }) => validateWhatsAppTemplate(templates[key]).length === 0);

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 size-5 text-gold" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{t("integr.wa.title")}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("integr.wa.intro")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-border px-2.5 py-1 font-semibold">
          {channel ? t(statusKey[channel.status]) : t("integr.wa.notConfigured")}
        </span>
        {channel?.display_phone && (
          <span className="text-muted-foreground">{channel.display_phone}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void connect()}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <QrCode className="size-4" />
          {channel?.status === "open" ? t("integr.wa.reconnect") : t("integr.wa.connect")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {t("integr.refresh")}
        </button>
        {channel?.status === "open" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-destructive/40 px-3 text-sm font-semibold text-destructive disabled:opacity-50"
          >
            <Unplug className="size-4" />
            {t("integr.disconnect")}
          </button>
        )}
        {qrcode && (
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"
          >
            <Link2 className="size-4" />
            {t("integr.wa.showQr")}
          </button>
        )}
      </div>

      {channel && (
        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t("integr.wa.bookingAlerts")}</p>
              <p className="text-xs text-muted-foreground">{t("integr.wa.bookingAlertsHint")}</p>
            </div>
            <Switch
              checked={channel.notify_booking}
              disabled={busy}
              onCheckedChange={(checked) => void saveSettings({ notify_booking: checked })}
              aria-label={t("integr.wa.bookingAlerts")}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t("integr.wa.reminder")}</p>
              <p className="text-xs text-muted-foreground">
                {t("integr.wa.reminderHint", { hours: channel.reminder_hours_before })}
              </p>
            </div>
            <Switch
              checked={channel.notify_reminder}
              disabled={busy}
              onCheckedChange={(checked) => void saveSettings({ notify_reminder: checked })}
              aria-label={t("integr.wa.reminderAria")}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t("integr.wa.channelActive")}</p>
              <p className="text-xs text-muted-foreground">{t("integr.wa.channelActiveHint")}</p>
            </div>
            <Switch
              checked={channel.enabled}
              disabled={busy}
              onCheckedChange={(checked) => void saveSettings({ enabled: checked })}
              aria-label={t("integr.wa.channelActive")}
            />
          </div>
        </div>
      )}

      <div className="space-y-3 border-t border-border/60 pt-3">
        <div>
          <p className="text-sm font-semibold">{t("integr.wa.textsTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("integr.wa.textsHint")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("integr.wa.typeAria")}>
          {TEMPLATE_META.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={activeTemplate === item.key}
              onClick={() => setActiveTemplate(item.key)}
              className={`min-h-9 rounded-full border px-3.5 text-xs font-bold transition-colors ${
                activeTemplate === item.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50"
              }`}
            >
              {t(item.titleKey)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t(activeMeta.hintKey)}</p>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("integr.wa.insertTitle")}
          </p>
          <div className="flex flex-wrap gap-2" aria-label={t("integr.wa.insertAria")}>
            {WHATSAPP_TEMPLATE_VARS.map((key) => {
              const help = WHATSAPP_TEMPLATE_VAR_HELP[key];
              const chip = t(help.chipKey);
              const label = t(help.labelKey);
              return (
                <button
                  key={key}
                  type="button"
                  title={t("integr.wa.varTitle", { label, example: help.example })}
                  aria-label={t("integr.wa.varAria", { chip, label })}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertVariable(key)}
                  className="inline-flex min-h-9 items-center rounded-full border border-primary/25 bg-primary/10 px-3.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/15"
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["*", "integr.wa.bold"],
              ["_", "integr.wa.italic"],
              ["~", "integr.wa.strike"],
            ] as const
          ).map(([mark, labelKey]) => (
            <button
              key={mark}
              type="button"
              aria-label={t(labelKey)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyWrap(mark)}
              className="min-h-9 rounded-xl border border-border bg-background px-3 text-xs font-semibold"
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        <div className="block space-y-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {t("integr.tpl.textLabel")}
          </span>
          <WhatsAppChipEditor
            key={activeTemplate}
            ref={editorRef}
            value={activeBody}
            onChange={updateActiveBody}
            aria-label={t("integr.tpl.textLabel")}
          />
          <p className="text-[11px] text-muted-foreground">
            {t("integr.wa.editorHint")} {t("integr.wa.charCount", { count: activeLength })}
          </p>
        </div>

        {activeErrors.length > 0 && (
          <ul className="space-y-1 text-xs text-destructive" role="alert">
            {activeErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {previewMode === "preview" ? t("integr.wa.previewSample") : t("integr.wa.source")}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                aria-pressed={previewMode === "preview"}
                onClick={() => setPreviewMode("preview")}
                className={`min-h-11 rounded-lg px-3 text-xs font-semibold ${
                  previewMode === "preview"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border"
                }`}
              >
                {t("integr.wa.preview")}
              </button>
              <button
                type="button"
                aria-pressed={previewMode === "source"}
                onClick={() => setPreviewMode("source")}
                className={`min-h-11 rounded-lg px-3 text-xs font-semibold ${
                  previewMode === "source"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border"
                }`}
              >
                {t("integr.wa.source")}
              </button>
            </div>
          </div>
          <div className="mx-auto mt-3 max-w-[280px] rounded-2xl border border-border bg-background px-3 py-3 shadow-sm">
            {previewMode === "preview" ? (
              <WhatsAppFormattedPreview text={previewFilled} className="text-sm" />
            ) : (
              <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
                {activeBody || "—"}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !canSave}
            onClick={() => void saveTemplates()}
            className="min-h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("integr.wa.saveTexts")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setRestoreOpen(true)}
            className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50"
          >
            {t("integr.wa.restoreDefault")}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {channel?.last_error && (
        <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive" role="status">
            {friendlyChannelLastError(channel.last_error)}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void connect()}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold disabled:opacity-50"
          >
            {t("integr.wa.reconnectWa")}
          </button>
        </div>
      )}

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-border bg-card p-5">
          <DialogTitle className="text-base font-extrabold">{t("integr.wa.qrTitle")}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t("integr.wa.qrSteps")}
          </DialogDescription>
          {qrcode ? (
            <img
              src={qrcode}
              alt={t("integr.wa.qrAlt")}
              className="mx-auto mt-2 size-56 rounded-2xl"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("integr.wa.qrUnavailable")}</p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="mt-2 min-h-11 w-full rounded-xl border border-border text-sm font-semibold"
          >
            {t("integr.wa.scanned")}
          </button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("integr.wa.restoreTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("integr.wa.restoreBody", { name: t(activeMeta.titleKey) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("integr.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>{t("integr.wa.restore")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
