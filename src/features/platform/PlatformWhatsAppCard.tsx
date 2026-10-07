import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  CheckCircle2,
  Info,
  Link2,
  Loader2,
  MessageCircle,
  Phone,
  QrCode,
  RefreshCw,
  Repeat,
  ScanLine,
  Server,
  Settings2,
  Smartphone,
  Unplug,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  ActionResult,
  ConfirmDialog,
  Hint,
  IconList,
  IconTile,
  MoreActions,
  MoreDetails,
  Notice,
  SectionHeader,
  STATE,
  StatusBadge,
  Tag,
  type ActionState,
  type StatusMeta,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";
import { friendlyIntegrationError } from "@/lib/integrations/friendly-error";

export type PlatformWaStatus = "disconnected" | "qr" | "connecting" | "open";
/** O que o cartão conta à tela: o estado ou "error" quando a conferência falhou. */
export type PlatformWaReport = PlatformWaStatus | "error";

/** O que a tela de fora (lista de atenção) pode pedir ao cartão. */
export type PlatformWhatsAppHandle = { connect: () => void; recheck: () => void };

type PlatformWaPayload = {
  error?: string;
  instance_name?: string;
  status?: PlatformWaStatus;
  display_phone?: string | null;
  qrcode?: string | null;
  last_error?: string | null;
};

/** Mesmo selo de "conectado / desconectado / esperando" de todo o sistema. */
const STATUS_META: Record<PlatformWaStatus, StatusMeta & { labelKey: MessageKey }> = {
  open: { ...STATE.active, labelKey: "integr.wa.status.open" },
  disconnected: { ...STATE.failed, labelKey: "integr.wa.status.disconnected" },
  qr: { ...STATE.waiting, labelKey: "plat.wa.waitingScan" },
  connecting: { ...STATE.working, labelKey: "integr.wa.status.connecting" },
};

/** Como ler o código, na ordem em que a pessoa faz. */
const QR_STEPS: { key: string; icon: LucideIcon; labelKey: MessageKey }[] = [
  { key: "open", icon: Smartphone, labelKey: "plat.wa.step1" },
  { key: "menu", icon: Settings2, labelKey: "plat.wa.step2" },
  { key: "scan", icon: ScanLine, labelKey: "plat.wa.step3" },
];

async function callPlatformWhatsApp(action: "status" | "connect" | "logout") {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error(tNow("integr.err.session"));

  const base = import.meta.env.VITE_SUPABASE_URL || "";
  const response = await fetch(`${base}/functions/v1/platform-whatsapp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });
  const payload = (await response.json()) as PlatformWaPayload;
  if (!response.ok) throw new Error(payload.error || tNow("integr.platformWa.errGeneric"));
  return payload;
}

/**
 * Admin: conecta o WhatsApp que envia o código do cadastro de clientes novos
 * (instância PLATFORM_EVOLUTION_INSTANCE). Selo de estado na cor certa, botão principal só
 * quando há algo a fazer e os nomes técnicos recolhidos em "Detalhes técnicos".
 */
export const PlatformWhatsAppCard = forwardRef<
  PlatformWhatsAppHandle,
  {
    /** Avisa a tela quando o estado muda (null = ainda conferindo; "error" = não deu). */
    onStatusChange?: (status: PlatformWaReport | null) => void;
    className?: string;
  }
>(function PlatformWhatsAppCard({ onStatusChange, className }, ref) {
  const { t } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<PlatformWaStatus>("disconnected");
  const [known, setKnown] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [displayPhone, setDisplayPhone] = useState<string | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  /** "Já li o código" conferiu e ainda não conectou. */
  const [scanNote, setScanNote] = useState(false);
  const [busy, setBusy] = useState<"status" | "connect" | "logout" | null>(null);
  const [error, setError] = useState<{ text: string; retry: () => void } | null>(null);
  const [result, setResult] = useState<{ state: ActionState; text: string } | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);

  const apply = useCallback((payload: PlatformWaPayload) => {
    if (payload.instance_name) setInstanceName(payload.instance_name);
    if (payload.status) setStatus(payload.status);
    setKnown(true);
    setCheckFailed(false);
    setDisplayPhone(payload.display_phone ?? null);
    // A conferência de "conectando" volta sem código: o último continua na tela enquanto a
    // pessoa lê. Só some quando conecta ou desconecta.
    const waiting = payload.status === "qr" || payload.status === "connecting";
    setQrcode((current) => payload.qrcode ?? (waiting ? current : null));
    setLastError(payload.last_error ?? null);
  }, []);

  useEffect(() => {
    onStatusChange?.(checkFailed ? "error" : known ? status : null);
  }, [checkFailed, known, status, onStatusChange]);

  /** Confere o estado e devolve o que veio (null quando a conferência falhou). */
  const refresh = useCallback(async (): Promise<PlatformWaStatus | null> => {
    setBusy("status");
    setError(null);
    try {
      const payload = await callPlatformWhatsApp("status");
      apply(payload);
      return payload.status ?? null;
    } catch (err) {
      setCheckFailed(true);
      setError({
        text: friendlyIntegrationError(err, tNow("integr.wa.errStatus")),
        retry: () => void refresh(),
      });
      return null;
    } finally {
      setBusy(null);
    }
  }, [apply]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Enquanto a janela do código está aberta, confere sozinho a cada 4 s.
  useEffect(() => {
    if (!qrOpen || status === "open") return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          apply(await callPlatformWhatsApp("status"));
        } catch {
          /* ignore polling errors */
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [qrOpen, status, apply]);

  // Conectou com a janela aberta (pela consulta automática ou por "Já li o código"):
  // mostra "✓ WhatsApp conectado" e fecha sozinha.
  useEffect(() => {
    if (!qrOpen || status !== "open") return;
    setJustConnected(true);
    setScanNote(false);
    setResult({ state: "saved", text: tNow("integr.platformWa.connected") });
    const timer = window.setTimeout(() => {
      setQrOpen(false);
      setJustConnected(false);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [qrOpen, status]);

  /** "Já li o código": confere na hora; se ainda não conectou, diz isso ali mesmo. */
  async function checkScanned() {
    setScanNote(false);
    const next = await refresh();
    if (next && next !== "open") setScanNote(true);
  }

  const connect = useCallback(async () => {
    setBusy("connect");
    setError(null);
    setResult(null);
    try {
      const payload = await callPlatformWhatsApp("connect");
      apply(payload);
      if (payload.qrcode) setQrOpen(true);
      if (payload.status === "open") {
        setResult({ state: "saved", text: tNow("integr.platformWa.connected") });
      }
    } catch (err) {
      setError({
        text: friendlyIntegrationError(err, tNow("integr.wa.errConnect")),
        retry: () => void connect(),
      });
    } finally {
      setBusy(null);
    }
  }, [apply]);

  useImperativeHandle(
    ref,
    () => ({
      connect: () => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        sectionRef.current?.scrollIntoView({
          block: "center",
          behavior: reduce ? "auto" : "smooth",
        });
        if (qrcode && (status === "qr" || status === "connecting")) setQrOpen(true);
        else void connect();
      },
      recheck: () => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        sectionRef.current?.scrollIntoView({
          block: "center",
          behavior: reduce ? "auto" : "smooth",
        });
        void refresh();
      },
    }),
    [connect, refresh, qrcode, status],
  );

  async function disconnect() {
    setBusy("logout");
    setError(null);
    setResult(null);
    try {
      const payload = await callPlatformWhatsApp("logout");
      apply(payload);
      setQrcode(null);
      setResult({ state: "saved", text: t("integr.platformWa.disconnected") });
    } catch (err) {
      // A janela de decisão mostra o erro e deixa tentar de novo.
      throw new Error(friendlyIntegrationError(err, t("integr.wa.errDisconnect")));
    } finally {
      setBusy(null);
    }
  }

  const meta = STATUS_META[status];
  const canShowQr = Boolean(qrcode) && (status === "qr" || status === "connecting");

  return (
    <section
      ref={sectionRef}
      className={`space-y-4 rounded-3xl border border-border bg-card p-4 sm:p-5 ${className ?? ""}`}
    >
      <SectionHeader
        icon={MessageCircle}
        title={t("integr.platformWa.title")}
        description={t("plat.wa.purpose")}
        aside={
          known ? (
            <StatusBadge tone={meta.tone} icon={meta.icon} label={t(meta.labelKey)} live />
          ) : checkFailed && busy !== "status" ? (
            <StatusBadge {...STATE.failed} label={t("plat.wa.unknown")} live />
          ) : (
            <StatusBadge {...STATE.working} label={t("plat.wa.checking")} live />
          )
        }
      />

      {known && status === "open" && displayPhone && <Tag icon={Phone}>{displayPhone}</Tag>}
      {known && status !== "open" && (
        <Hint icon={XCircle} tone="danger">
          {t("plat.wa.consequence")}
        </Hint>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status !== "open" && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => (canShowQr ? setQrOpen(true) : void connect())}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy === "connect" ? (
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
            ) : (
              <QrCode className="size-4" aria-hidden />
            )}
            {busy === "connect"
              ? t("integr.wa.status.connecting")
              : canShowQr
                ? t("plat.wa.showCode")
                : t("integr.wa.connect")}
          </button>
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void refresh()}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold disabled:opacity-60"
        >
          <RefreshCw
            className={`size-4 ${busy === "status" ? "motion-safe:animate-spin" : ""}`}
            aria-hidden
          />
          {t("plat.wa.check")}
        </button>
        {status === "open" && (
          <MoreActions
            className="ms-auto"
            label={t("plat.wa.more")}
            title={t("integr.platformWa.title")}
            actions={[
              {
                id: "swap",
                label: t("plat.wa.swap"),
                description: t("plat.wa.swapHint"),
                icon: Repeat,
                onSelect: () => void connect(),
                disabled: busy !== null,
              },
              {
                id: "disconnect",
                label: t("integr.disconnect"),
                icon: Unplug,
                tone: "danger",
                onSelect: () => setConfirmOff(true),
                disabled: busy !== null,
              },
            ]}
          />
        )}
      </div>

      {error && (
        <Notice
          tone="danger"
          title={error.text}
          action={{ label: t("visual.retry"), onClick: error.retry, icon: RefreshCw }}
        />
      )}
      <ActionResult
        state={result?.state}
        text={result?.text}
        autoHideMs={5000}
        onDismiss={() => setResult(null)}
      />
      {lastError && status !== "open" && (
        <Notice tone="warning" role="none" title={t("plat.wa.lastErrorTitle")} />
      )}

      {(instanceName || lastError) && (
        <MoreDetails summary={t("plat.wa.techTitle")} icon={Settings2}>
          <IconList
            size="sm"
            items={[
              ...(instanceName
                ? [
                    {
                      key: "instance",
                      icon: Server,
                      tone: "muted" as const,
                      text: t("plat.wa.techInstance", { instance: instanceName }),
                    },
                  ]
                : []),
              {
                key: "path",
                icon: Link2,
                tone: "muted" as const,
                text: t("plat.wa.techPath", { path: "/cadastrar" }),
              },
              ...(lastError
                ? [
                    {
                      key: "error",
                      icon: XCircle,
                      tone: "muted" as const,
                      text: t("integr.platformWa.lastError", { error: lastError }),
                    },
                  ]
                : []),
            ]}
          />
        </MoreDetails>
      )}

      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        tone="danger"
        icon={Unplug}
        title={t("plat.wa.offTitle")}
        consequences={[
          { key: "codes", icon: XCircle, tone: "danger", text: t("plat.wa.consequence") },
          { key: "back", icon: QrCode, tone: "muted", text: t("plat.wa.offBack") },
        ]}
        confirmLabel={t("integr.disconnect")}
        confirmIcon={Unplug}
        cancelLabel={t("plat.wa.keep")}
        onConfirm={disconnect}
      />

      <Dialog
        open={qrOpen}
        onOpenChange={(open) => {
          setQrOpen(open);
          if (!open) {
            setJustConnected(false);
            setScanNote(false);
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] max-w-sm rounded-3xl border-border bg-card p-5">
          <DialogTitle className="min-h-11 pr-12 pt-2 text-lg font-bold leading-snug">
            {t("plat.wa.qrTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("plat.wa.qrDescription")}</DialogDescription>
          {justConnected ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
              <IconTile icon={CheckCircle2} tone="success" size="lg" />
              <p className="text-base font-bold">{t("integr.platformWa.connected")}</p>
            </div>
          ) : (
            <>
              {/* Instruções, não progresso: os três passos com o mesmo peso, na ordem. */}
              <ol className="space-y-2" aria-label={t("plat.wa.qrTitle")}>
                {QR_STEPS.map(({ key, icon: Icon, labelKey }, index) => (
                  <li key={key} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold tabular-nums text-primary-foreground"
                    >
                      {index + 1}
                    </span>
                    <Icon className="size-4 shrink-0 text-gold" aria-hidden />
                    <span className="min-w-0 text-sm font-semibold leading-snug">
                      {t(labelKey)}
                    </span>
                  </li>
                ))}
              </ol>
              {qrcode ? (
                <>
                  <img
                    src={qrcode}
                    alt={t("integr.platformWa.qrAlt")}
                    className="mx-auto size-56 rounded-2xl border border-border bg-white p-2"
                  />
                  {/* "Esperando a leitura…" só quando há um código para ler. */}
                  <div className="flex justify-center">
                    <StatusBadge {...STATE.waiting} label={t("plat.wa.waiting")} live />
                  </div>
                </>
              ) : (
                <Notice
                  tone="warning"
                  role="none"
                  title={t("plat.wa.noCode")}
                  action={{
                    label:
                      busy === "connect" ? t("integr.wa.status.connecting") : t("plat.wa.newCode"),
                    onClick: () => {
                      if (busy === null) void connect();
                    },
                    icon: RefreshCw,
                  }}
                />
              )}
              {scanNote && status !== "open" && (
                <Notice
                  tone="pending"
                  icon={STATE.waiting.icon}
                  title={t("plat.wa.notYet")}
                  onDismiss={() => setScanNote(false)}
                />
              )}
              {error && (
                <Notice
                  tone="danger"
                  title={error.text}
                  action={{ label: t("visual.retry"), onClick: error.retry, icon: RefreshCw }}
                />
              )}
              <Hint icon={Info}>{t("plat.wa.whichNumber")}</Hint>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void checkScanned()}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold disabled:opacity-60"
              >
                {busy === "status" ? (
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden />
                )}
                {t("plat.wa.scanned")}
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
});
