import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  AlarmClock,
  Bold,
  CalendarCheck,
  CalendarClock,
  CalendarX2,
  CheckCheck,
  CheckCircle2,
  Hourglass,
  Italic,
  Laptop,
  Loader2,
  MessageCircle,
  MoreVertical,
  PauseCircle,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  ScanLine,
  Smartphone,
  Store,
  Strikethrough,
  Unplug,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  ActionResult,
  ConfirmDialog,
  Hint,
  InlineStatus,
  MoreActions,
  MoreDetails,
  Notice,
  SectionHeader,
  StatusBadge,
  Steps,
  type ActionState,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { guardedFetch } from "@/lib/demo-guard";
import type { Tables } from "@/integrations/supabase/types";
import { useDemo } from "@/features/demo/context";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  friendlyChannelLastError,
  friendlyIntegrationError,
  integrationErrorKind,
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
  whatsappTemplateWarnings,
  type WhatsAppTemplateKey,
  type WhatsAppTemplateVar,
} from "@/lib/whatsapp/templates";
import { WhatsAppFormattedPreview } from "@/features/shop/WhatsAppFormattedPreview";
import {
  WhatsAppChipEditor,
  type WhatsAppChipEditorHandle,
} from "@/features/shop/WhatsAppChipEditor";
import { CONNECTION_META, connectionOf } from "./whatsapp-connection";

type Channel = Tables<"whatsapp_channels">;

const MAX_LENGTH = 1000;

const TEMPLATE_META: Array<{
  key: WhatsAppTemplateKey;
  titleKey: MessageKey;
  whenKey: MessageKey;
  icon: LucideIcon;
}> = [
  {
    key: "booking.confirmed",
    titleKey: "integr.wa.tplConfirmed",
    whenKey: "integr.wa.tplConfirmedHint",
    icon: CalendarCheck,
  },
  {
    key: "booking.rescheduled",
    titleKey: "integr.wa.tplRescheduled",
    whenKey: "integr.wa.tplRescheduledHint",
    icon: CalendarClock,
  },
  {
    key: "booking.cancelled",
    titleKey: "integr.wa.tplCancelled",
    whenKey: "integr.wa.tplCancelledHint",
    icon: CalendarX2,
  },
  {
    key: "booking.reminder",
    titleKey: "integr.wa.tplReminder",
    whenKey: "integr.wa.tplReminderHint",
    icon: AlarmClock,
  },
];

/**
 * A frase comum da queda cita o botão "Conectar" (o nome no cartão da plataforma). Aqui o botão
 * vira "Reconectar WhatsApp" quando a conexão cai, então a frase cita esse nome. `dropped` marca a
 * queda para o rótulo do botão (sem comparar textos, que mudam com o idioma).
 */
function channelError(err: unknown, fallback: string) {
  const dropped = integrationErrorKind(err) === "errors.integration.whatsappDisconnected";
  return {
    state: "error" as const,
    text: dropped
      ? tNow("errors.integration.whatsappDisconnectedShop")
      : friendlyIntegrationError(err, fallback),
    dropped,
  };
}

async function callChannel(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error(tNow("integr.err.session"));

  const base = import.meta.env.VITE_SUPABASE_URL || "";
  const response = await guardedFetch(`${base}/functions/v1/whatsapp-channel`, {
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

/** "+5511987654321" → "+55 11 98765-4321" (Brasil); outros números ficam como vieram. */
function formatWhatsAppPhone(raw: string | null | undefined) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const br = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  if (br) return `+55 ${br[1]} ${br[2]}-${br[3]}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

/** Balão no estilo do WhatsApp: nome da barbearia, texto formatado, hora e ✓✓. */
function WhatsAppBubble({ text, shopName }: { text: string; shopName: string }) {
  return (
    <div className="rounded-2xl bg-[color:color-mix(in_srgb,#25d366_10%,var(--background))] p-3">
      <div className="max-w-[300px] rounded-xl rounded-tl-sm border border-border bg-card px-3 pb-1.5 pt-2 text-card-foreground shadow-sm">
        <p className="text-xs font-bold text-[color:var(--tone-ink)] tone-success">{shopName}</p>
        <WhatsAppFormattedPreview text={text} className="mt-1 text-sm" />
        <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
          14:30
          <CheckCheck className="size-3.5 text-[color:var(--tone-ink)] tone-info" aria-hidden />
        </p>
      </div>
    </div>
  );
}

/**
 * WhatsApp da barbearia: estado da conexão no topo (selo + uma frase com o resultado), as
 * mensagens automáticas com "quando sai" e o interruptor de cada uma, e o editor de textos com
 * a prévia em balão. Ações raras (desconectar, novo código) ficam em "⋯" e pedem confirmação.
 */
export function WhatsAppChannelCard({ shopId }: { shopId: string }) {
  const demo = useDemo();
  const { t } = useI18n();
  const editorRef = useRef<WhatsAppChipEditorHandle>(null);
  const editorBlockRef = useRef<HTMLElement>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [checked, setChecked] = useState(false);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connectResult, setConnectResult] = useState<{
    state: ActionState;
    text: string;
    /** Erro de queda da conexão (o botão vira "Reconectar WhatsApp"). */
    dropped?: boolean;
  } | null>(null);
  const [prefStatus, setPrefStatus] = useState<{
    field: "enabled" | "notify_booking" | "notify_reminder";
    state: ActionState;
  } | null>(null);
  const [templates, setTemplates] = useState<Record<WhatsAppTemplateKey, string>>({
    ...DEFAULT_WHATSAPP_BODIES,
  });
  const [savedTemplates, setSavedTemplates] = useState<Record<WhatsAppTemplateKey, string>>({
    ...DEFAULT_WHATSAPP_BODIES,
  });
  const [activeTemplate, setActiveTemplate] = useState<WhatsAppTemplateKey>("booking.confirmed");
  // Os textos só podem ser salvos depois de lidos do banco: sem isso, o upsert
  // dos 4 modelos gravaria os padrões por cima dos textos personalizados.
  const [templatesReady, setTemplatesReady] = useState(false);
  const [templatesLoadFailed, setTemplatesLoadFailed] = useState(false);
  const [templateResult, setTemplateResult] = useState<{
    state: ActionState;
    text?: string;
  } | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const dirtyKeys = TEMPLATE_META.filter(
    ({ key }) =>
      normalizeWhatsAppTemplate(templates[key]) !== normalizeWhatsAppTemplate(savedTemplates[key]),
  ).map(({ key }) => key);
  const templatesDirty = dirtyKeys.length > 0;
  const templatesDirtyRef = useRef(false);
  const templatesReadyRef = useRef(false);
  templatesDirtyRef.current = templatesDirty;
  templatesReadyRef.current = templatesReady;

  const loadTemplates = useCallback(async () => {
    // Não descarta edições ainda não salvas (ex.: "Verificar de novo" ou "Já li o código").
    if (templatesReadyRef.current && templatesDirtyRef.current) return;
    if (demo) {
      setTemplates({ ...DEFAULT_WHATSAPP_BODIES });
      setSavedTemplates({ ...DEFAULT_WHATSAPP_BODIES });
      setTemplatesReady(true);
      setTemplatesLoadFailed(false);
      return;
    }
    const { data, error: loadError } = await supabase
      .from("whatsapp_message_templates")
      .select("template_key, body")
      .eq("barbershop_id", shopId);
    if (loadError) {
      // Mantém o editor bloqueado para salvar em vez de cair nos textos padrão.
      setTemplatesLoadFailed(true);
      return;
    }
    const next = { ...DEFAULT_WHATSAPP_BODIES };
    for (const row of data ?? []) {
      if (row.template_key in next) {
        next[row.template_key as WhatsAppTemplateKey] = row.body;
      }
    }
    setTemplates(next);
    setSavedTemplates(next);
    setTemplatesReady(true);
    setTemplatesLoadFailed(false);
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
      setChecked(true);
      await loadTemplates();
      return;
    }
    setBusy(true);
    // Os textos são lidos do banco independentemente do status do canal.
    const templatesLoad = loadTemplates().catch(() => setTemplatesLoadFailed(true));
    try {
      const payload = await callChannel({ action: "status", barbershop_id: shopId });
      setChannel(payload.channel ?? null);
      setQrcode(payload.qrcode ?? null);
      await templatesLoad;
    } catch (err) {
      await templatesLoad;
      setConnectResult(channelError(err, tNow("integr.wa.errStatus")));
    } finally {
      setChecked(true);
      setBusy(false);
    }
  }, [demo, loadTemplates, shopId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Com o QR aberto, confere a cada 4 s se o celular já leu o código.
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
            setConnectResult({ state: "saved", text: tNow("integr.wa.connected") });
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
      setConnectResult({ state: "saved", text: t("integr.wa.demoConnected") });
      return;
    }
    setBusy(true);
    setConnectResult({ state: "saving", text: t("integr.wa.connecting") });
    try {
      const payload = await callChannel({ action: "connect", barbershop_id: shopId });
      setChannel(payload.channel ?? null);
      setQrcode(payload.qrcode ?? null);
      if (payload.qrcode) setQrOpen(true);
      setConnectResult(
        payload.channel?.status === "open"
          ? { state: "saved", text: t("integr.wa.connected") }
          : { state: "pending", text: t("integr.wa.scanQr") },
      );
    } catch (err) {
      setConnectResult(channelError(err, t("integr.wa.errConnect")));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (demo) {
      setConnectResult({ state: "saved", text: t("integr.wa.demoDisconnect") });
      return;
    }
    setBusy(true);
    try {
      const payload = await callChannel({ action: "logout", barbershop_id: shopId });
      setChannel(payload.channel ?? null);
      setQrcode(null);
      setConnectResult({ state: "saved", text: t("integr.wa.disconnected") });
    } catch (err) {
      throw new Error(friendlyIntegrationError(err, t("integr.wa.errDisconnect")));
    } finally {
      setBusy(false);
    }
  }

  async function savePref(field: "enabled" | "notify_booking" | "notify_reminder", value: boolean) {
    if (!channel) return;
    const previous = channel;
    // Mostra a nova posição na hora e volta atrás se não gravar.
    setChannel({ ...channel, [field]: value });
    setPrefStatus({ field, state: "saving" });
    if (demo) {
      setPrefStatus({ field, state: "saved" });
      return;
    }
    try {
      const payload = await callChannel({
        action: "settings",
        barbershop_id: shopId,
        notify_booking: field === "notify_booking" ? value : channel.notify_booking,
        notify_reminder: field === "notify_reminder" ? value : channel.notify_reminder,
        reminder_hours_before: channel.reminder_hours_before,
        enabled: field === "enabled" ? value : channel.enabled,
      });
      setChannel(payload.channel ?? null);
      setPrefStatus({ field, state: "saved" });
    } catch {
      setChannel(previous);
      setPrefStatus({ field, state: "error" });
    }
  }

  async function saveTemplates() {
    if (demo) {
      setSavedTemplates(templates);
      setTemplateResult({ state: "saved", text: t("integr.wa.demoTemplates") });
      return;
    }
    setBusy(true);
    setTemplateResult({ state: "saving" });
    try {
      const rows = TEMPLATE_META.map(({ key, titleKey }) => {
        const body = normalizeWhatsAppTemplate(templates[key]);
        const issues = validateWhatsAppTemplate(body);
        if (issues.length) throw new Error(`${t(titleKey)}: ${issues[0]}`);
        return { barbershop_id: shopId, template_key: key, body };
      });
      const { error: upsertError } = await supabase
        .from("whatsapp_message_templates")
        .upsert(rows, { onConflict: "barbershop_id,template_key" });
      if (upsertError) throw upsertError;
      setSavedTemplates(templates);
      setTemplateResult({ state: "saved", text: t("integr.wa.templatesSaved") });
    } catch (err) {
      setTemplateResult({
        state: "error",
        text: friendlyIntegrationError(err, t("integr.wa.errSaveTemplates")),
      });
    } finally {
      setBusy(false);
    }
  }

  function updateActiveBody(next: string) {
    setTemplates((current) => ({ ...current, [activeTemplate]: next }));
    setTemplateResult(null);
  }

  function insertVariable(key: WhatsAppTemplateVar) {
    editorRef.current?.insertVariable(key);
    editorRef.current?.focus();
  }

  function applyWrap(wrapper: "*" | "_" | "~") {
    editorRef.current?.applyWrap(wrapper);
    editorRef.current?.focus();
  }

  function editTemplate(key: WhatsAppTemplateKey) {
    setActiveTemplate(key);
    const block = editorBlockRef.current;
    if (!block) return;
    if (block instanceof HTMLDetailsElement) block.open = true;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    block.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function confirmRestore() {
    setTemplates((current) => ({
      ...current,
      [activeTemplate]: DEFAULT_WHATSAPP_BODIES[activeTemplate],
    }));
    setRestoreOpen(false);
    setTemplateResult({ state: "pending", text: t("integr.wa.restored") });
  }

  const connection = connectionOf(channel, checked);
  const meta = CONNECTION_META[connection];
  const live = connection === "open";
  const activeMeta = TEMPLATE_META.find((m) => m.key === activeTemplate) ?? TEMPLATE_META[0];
  const activeBody = templates[activeTemplate];
  const activeLength = whatsappCodePointLength(activeBody);
  const activeErrors = validateWhatsAppTemplate(activeBody);
  // Aviso sem bloqueio: o servidor corta o final se a mensagem preenchida passar de 1000.
  const activeWarnings = activeErrors.length ? [] : whatsappTemplateWarnings(activeBody);
  const previewFilled = renderWhatsAppTemplate(activeBody, SAMPLE_WHATSAPP_VARS);
  const canSave =
    templatesReady &&
    templatesDirty &&
    TEMPLATE_META.every(({ key }) => validateWhatsAppTemplate(templates[key]).length === 0);
  const lengthTone =
    activeLength > MAX_LENGTH ? "danger" : activeLength > MAX_LENGTH * 0.85 ? "warning" : null;
  // O texto comum ("Toque em Conectar…") cita um botão que aqui se chama "Reconectar WhatsApp":
  // no cartão da loja, a queda ganha um motivo curto próprio, sem nome de botão.
  const problem = channel?.last_error
    ? integrationErrorKind(channel.last_error) === "errors.integration.whatsappDisconnected"
      ? t("integr.wa.problem.dropped")
      : friendlyChannelLastError(channel.last_error)
    : null;
  // O motivo e o conserto ficam na mesma faixa do resultado, com um único botão logo abaixo.
  const showProblem = Boolean(problem) && connection !== "open" && connection !== "paused";
  // A frase da queda manda tocar em "Reconectar WhatsApp": o botão usa esse nome também.
  const dropped = showProblem || (connectResult?.state === "error" && !!connectResult.dropped);

  const moreActions = [
    ...(channel && channel.status === "open"
      ? [
          {
            id: "reconnect",
            label: t("integr.wa.newCode"),
            description: t("integr.wa.newCodeHint"),
            icon: QrCode,
            onSelect: () => void connect(),
          },
          {
            id: "disconnect",
            label: t("integr.wa.disconnectAction"),
            icon: Unplug,
            tone: "danger" as const,
            onSelect: () => setDisconnectOpen(true),
          },
        ]
      : []),
  ];

  /** Linha de uma mensagem automática: ícone, quando sai e "Editar texto". */
  function messageRow(key: WhatsAppTemplateKey, when: ReactNode, trailing?: ReactNode) {
    const item = TEMPLATE_META.find((m) => m.key === key) ?? TEMPLATE_META[0];
    const Icon = item.icon;
    const unsaved = dirtyKeys.includes(key);
    // Com interruptor ao lado (Lembrete), em tela estreita "Editar" e o interruptor descem
    // juntos para a direita em vez de espremer o "quando" em uma palavra por linha.
    return (
      <li
        key={key}
        className={cn("flex items-center gap-3 py-2", trailing ? "flex-wrap gap-y-1" : null)}
      >
        <Icon className="size-4 shrink-0 text-gold" aria-hidden />
        <span className={cn("min-w-0 flex-1", trailing && "basis-28")}>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            {t(item.titleKey)}
            {unsaved && (
              <StatusBadge tone="pending" variant="dot" label={t("visual.unsaved.badge")} />
            )}
          </span>
          <span className="block text-xs text-muted-foreground">{when}</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => editTemplate(key)}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition hover:border-primary/40"
            aria-label={t("integr.wa.editTextOf", { name: t(item.titleKey) })}
            title={t("integr.wa.editTextOf", { name: t(item.titleKey) })}
          >
            <Pencil className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">{t("integr.wa.editText")}</span>
          </button>
          {trailing}
        </span>
      </li>
    );
  }

  function prefSwitch(
    field: "enabled" | "notify_booking" | "notify_reminder",
    checkedValue: boolean,
    label: string,
  ) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        {prefStatus?.field === field && (
          <InlineStatus
            state={prefStatus.state}
            text={prefStatus.state === "error" ? t("integr.wa.prefError") : undefined}
            onRetry={() => void savePref(field, !checkedValue)}
          />
        )}
        <Switch
          checked={checkedValue}
          disabled={busy || prefStatus?.state === "saving"}
          onCheckedChange={(value) => void savePref(field, value)}
          aria-label={label}
        />
      </span>
    );
  }

  const editor = (
    <div className="space-y-3">
      <div
        className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-background/60 p-1 sm:grid-cols-4"
        role="tablist"
        aria-label={t("integr.wa.typeAria")}
      >
        {TEMPLATE_META.map((item) => {
          const Icon = item.icon;
          const selected = activeTemplate === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTemplate(item.key)}
              className={cn(
                "relative flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {t(item.titleKey)}
              {dirtyKeys.includes(item.key) && (
                <span className="tone-pending absolute right-1.5 top-1.5 size-2 rounded-full bg-[color:var(--tone-line)]">
                  <span className="sr-only">{t("visual.unsaved.badge")}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <activeMeta.icon className="size-3.5 shrink-0 text-gold" aria-hidden />
        {activeMeta.key === "booking.reminder" && channel
          ? t("integr.wa.when.reminder", { hours: channel.reminder_hours_before })
          : t(activeMeta.whenKey)}
      </p>

      {templatesLoadFailed && !templatesReady && (
        <Notice
          tone="danger"
          title={t("fix.ajustes-marca.waTemplatesLoadError")}
          action={{
            label: t("visual.retry"),
            icon: RefreshCw,
            onClick: () => void loadTemplates().catch(() => setTemplatesLoadFailed(true)),
          }}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5" aria-label={t("integr.wa.insertAria")}>
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
                  className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/15"
                >
                  <Plus className="size-3.5" aria-hidden />
                  {chip}
                </button>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <div
              className="flex gap-1 border-b border-border p-1"
              role="toolbar"
              aria-label={t("integr.wa.formatAria")}
            >
              {(
                [
                  ["*", "integr.wa.bold", Bold],
                  ["_", "integr.wa.italic", Italic],
                  ["~", "integr.wa.strike", Strikethrough],
                ] as const
              ).map(([mark, labelKey, Icon]) => (
                <button
                  key={mark}
                  type="button"
                  aria-label={t(labelKey)}
                  title={t(labelKey)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyWrap(mark)}
                  className="grid size-11 place-items-center rounded-lg transition hover:bg-muted"
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              ))}
            </div>
            <WhatsAppChipEditor
              key={activeTemplate}
              ref={editorRef}
              value={activeBody}
              onChange={updateActiveBody}
              aria-label={t("integr.wa.editorAria", { name: t(activeMeta.titleKey) })}
              className="rounded-none border-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  lengthTone ? `tone-${lengthTone} bg-[color:var(--tone-line)]` : "bg-primary/60",
                )}
                style={{ width: `${Math.min(100, (activeLength / MAX_LENGTH) * 100)}%` }}
              />
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {t("integr.wa.charCount", { count: activeLength })}
            </span>
          </div>
          <Hint>{t("integr.wa.chipHint")}</Hint>

          {activeErrors.length > 0 && (
            <Notice tone="danger" title={activeErrors[0]}>
              {activeErrors.length > 1 && (
                <ul className="space-y-1">
                  {activeErrors.slice(1).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </Notice>
          )}
          {activeWarnings.length > 0 && (
            <Notice tone="warning" title={activeWarnings[0]} role="status" />
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t("integr.wa.previewSample")}
          </p>
          <WhatsAppBubble text={previewFilled} shopName={SAMPLE_WHATSAPP_VARS.loja} />
          <MoreDetails summary={t("integr.wa.sourceToggle")}>
            <p className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
              {activeBody || "—"}
            </p>
          </MoreDetails>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={busy || !canSave}
          onClick={() => void saveTemplates()}
          aria-busy={templateResult?.state === "saving" || undefined}
          className="action-button action-confirm sm:px-5"
        >
          {templateResult?.state === "saving" ? (
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {dirtyKeys.length > 1
            ? t("integr.wa.saveTextsMany", { count: dirtyKeys.length })
            : t("integr.wa.saveTexts")}
        </button>
        <button
          type="button"
          disabled={busy || !templatesReady}
          onClick={() => setRestoreOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50"
        >
          <RotateCcw className="size-4" aria-hidden />
          {t("integr.wa.restoreDefault")}
        </button>
      </div>
      <ActionResult
        state={templateResult?.state === "saving" ? null : templateResult?.state}
        text={templateResult?.text}
        onRetry={() => void saveTemplates()}
      />
    </div>
  );

  return (
    <section
      className="app-action-card space-y-4 p-5"
      aria-labelledby="whatsapp-card-title"
      aria-busy={connection === "checking" || undefined}
    >
      <SectionHeader
        icon={MessageCircle}
        id="whatsapp-card-title"
        title={t("integr.wa.title")}
        description={t("integr.wa.introShort")}
        aside={<StatusBadge tone={meta.tone} icon={meta.icon} label={t(meta.label)} live />}
      />

      {/* Resultado da conexão em uma frase grande, com o número e as ações raras ao lado. */}
      <div
        className={cn(
          // Em tela estreita (320) os botões descem para a direita, abaixo da frase.
          "flex flex-wrap items-center gap-3 rounded-2xl border p-3",
          `tone-${meta.tone === "progress" ? "neutral" : meta.tone}`,
          "border-[color:var(--tone-border)] bg-[color:var(--tone-soft)]",
        )}
      >
        <meta.icon
          className={cn(
            "size-6 shrink-0 text-[color:var(--tone-ink)]",
            connection === "checking" && "motion-safe:animate-spin",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 basis-36">
          <p className="text-sm font-bold text-[color:var(--tone-ink)]">{t(meta.result)}</p>
          {showProblem && <p className="mt-0.5 text-xs text-foreground">{problem}</p>}
          {channel?.display_phone && (
            // Número e "Da barbearia" em blocos inteiros: quebram juntos, sem separador solto.
            <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                <Smartphone className="size-3.5" aria-hidden />
                {formatWhatsAppPhone(channel.display_phone)}
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Store className="size-3.5" aria-hidden />
                {t("integr.wa.scopeShop")}
              </span>
            </p>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            aria-label={t("integr.checkAgain")}
            title={t("integr.checkAgain")}
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition hover:border-primary/40 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", busy && "motion-safe:animate-spin")} aria-hidden />
          </button>
          {moreActions.length > 0 && (
            <MoreActions
              actions={moreActions}
              label={t("integr.wa.moreActions")}
              title={t("integr.wa.title")}
            />
          )}
        </div>
      </div>

      {connection !== "checking" && connection !== "open" && connection !== "paused" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {qrcode && connection === "waitingQr" ? (
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="action-button action-confirm sm:px-5"
            >
              <QrCode className="size-4" aria-hidden />
              {t("integr.wa.showCode")}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void connect()}
              className="action-button action-confirm sm:px-5"
            >
              <QrCode className="size-4" aria-hidden />
              {t(dropped ? "integr.wa.reconnectWa" : "integr.wa.connect")}
            </button>
          )}
        </div>
      )}
      <ActionResult
        state={connectResult?.state}
        text={connectResult?.text}
        onRetry={() => void refresh()}
        onDismiss={() => setConnectResult(null)}
        autoHideMs={6000}
      />

      {channel && (
        <section
          aria-labelledby="whatsapp-auto-title"
          className="space-y-3 border-t border-border/60 pt-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 basis-48">
              <h4 id="whatsapp-auto-title" className="text-sm font-bold">
                {t("integr.wa.autoTitle")}
              </h4>
              <p className="text-xs text-muted-foreground">{t("integr.wa.sendAllHint")}</p>
            </div>
            {prefSwitch("enabled", channel.enabled, t("integr.wa.sendAll"))}
          </div>

          <div
            className={cn(
              "space-y-3 rounded-2xl border border-border p-3 transition-opacity",
              (!channel.enabled || !live) && "opacity-60",
            )}
          >
            {(!channel.enabled || !live) && (
              <StatusBadge
                tone="neutral"
                icon={PauseCircle}
                label={t(channel.enabled ? "integr.wa.notSending" : "integr.wa.state.paused")}
                size="sm"
              />
            )}
            {/* As três primeiras dividem o mesmo interruptor no banco: ficam agrupadas. */}
            <div className="rounded-xl border-l-4 border-gold/60 bg-background/60 pl-3 pr-2">
              {/* Interruptor sempre à direita, como em SettingRow: o texto quebra, ele não desce. */}
              <div className="flex items-center gap-3 pt-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{t("integr.wa.bookingAlerts")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("integr.wa.bookingAlertsHint")}
                  </span>
                </span>
                {prefSwitch("notify_booking", channel.notify_booking, t("integr.wa.bookingAlerts"))}
              </div>
              <ul
                className={cn("divide-y divide-border/60", !channel.notify_booking && "opacity-60")}
              >
                {messageRow("booking.confirmed", t("integr.wa.tplConfirmedHint"))}
                {messageRow("booking.rescheduled", t("integr.wa.tplRescheduledHint"))}
                {messageRow("booking.cancelled", t("integr.wa.tplCancelledHint"))}
              </ul>
            </div>
            <ul
              className={cn(
                "rounded-xl bg-background/60 px-3",
                !channel.notify_reminder && "[&_.text-xs]:opacity-60",
              )}
            >
              {messageRow(
                "booking.reminder",
                t("integr.wa.when.reminder", { hours: channel.reminder_hours_before }),
                prefSwitch("notify_reminder", channel.notify_reminder, t("integr.wa.reminderAria")),
              )}
            </ul>
          </div>
        </section>
      )}

      {live || channel?.status === "open" ? (
        <div
          ref={editorBlockRef as RefObject<HTMLDivElement>}
          className="scroll-mt-24 space-y-3 border-t border-border/60 pt-4"
        >
          <div>
            <h4 className="text-sm font-bold">{t("integr.wa.textsTitle")}</h4>
            <p className="text-xs text-muted-foreground">{t("integr.wa.textsHint")}</p>
          </div>
          {editor}
        </div>
      ) : (
        connection !== "checking" && (
          <details
            ref={editorBlockRef as RefObject<HTMLDetailsElement>}
            className="group scroll-mt-24 rounded-2xl border border-border"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <Pencil className="size-4 text-gold" aria-hidden />
              <span className="flex-1">{t("integr.wa.textsTitle")}</span>
              <MoreVertical
                className="size-4 text-muted-foreground transition group-open:rotate-90"
                aria-hidden
              />
            </summary>
            <div className="space-y-3 border-t border-border/60 p-3">{editor}</div>
          </details>
        )
      )}

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-border bg-card p-5">
          <DialogTitle className="text-base font-extrabold">{t("integr.wa.qrTitle")}</DialogTitle>
          <DialogDescription className="sr-only">{t("integr.wa.qrSteps")}</DialogDescription>
          <Steps
            orientation="vertical"
            label={t("integr.wa.qrSteps")}
            steps={[
              { label: t("integr.wa.qrStep1"), icon: Smartphone, status: "done" },
              { label: t("integr.wa.qrStep2"), icon: Laptop, status: "done" },
              { label: t("integr.wa.qrStep3"), icon: ScanLine, status: "current" },
            ]}
          />
          {qrcode ? (
            <img
              src={qrcode}
              alt={t("integr.wa.qrAlt")}
              className="mx-auto mt-1 size-56 rounded-2xl bg-white p-2"
            />
          ) : (
            <Notice tone="warning" title={t("integr.wa.qrUnavailable")} role="status" />
          )}
          <div className="flex justify-center">
            {channel?.status === "open" ? (
              <StatusBadge
                tone="success"
                icon={CheckCircle2}
                label={t("integr.wa.status.open")}
                live
              />
            ) : (
              <StatusBadge tone="pending" icon={Hourglass} label={t("integr.wa.qrWaiting")} live />
            )}
          </div>
          <Hint tone="warning" icon={Laptop}>
            {t("integr.wa.qrOtherDevice")}
          </Hint>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              className="min-h-11 w-full rounded-xl border border-border text-sm font-semibold"
            >
              {t("integr.wa.scannedButton")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void connect()}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-4" aria-hidden />
              {t("integr.wa.newCode")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        tone="warning"
        icon={RotateCcw}
        title={t("integr.wa.restoreTitle")}
        description={t("integr.wa.restoreBody", { name: t(activeMeta.titleKey) })}
        confirmLabel={t("integr.wa.restore")}
        confirmIcon={RotateCcw}
        cancelLabel={t("integr.cancel")}
        onConfirm={confirmRestore}
      />

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        tone="danger"
        icon={Unplug}
        title={t("integr.wa.disconnectTitle")}
        description={
          channel?.display_phone ? formatWhatsAppPhone(channel.display_phone) : undefined
        }
        consequences={[
          { icon: XCircle, tone: "danger", text: t("integr.wa.disconnectStops") },
          { icon: RotateCcw, tone: "muted", text: t("integr.wa.disconnectBack") },
        ]}
        confirmLabel={t("integr.wa.disconnectConfirm")}
        confirmIcon={Unplug}
        busyLabel={t("integr.wa.disconnecting")}
        cancelLabel={t("integr.wa.keepConnected")}
        onConfirm={disconnect}
      />
    </section>
  );
}
