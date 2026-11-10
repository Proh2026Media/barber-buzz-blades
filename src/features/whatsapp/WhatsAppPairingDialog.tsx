import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { CheckCircle2, Copy, Loader2, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Hint, Notice } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useDemo } from "@/features/demo/context";
import { guardedFetch } from "@/lib/demo-guard";
import { useAuthSession } from "@/lib/auth/use-auth-session";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  initialPairingCountry,
  rememberPairingCountry,
  pairingCountries,
  normalizePairingPhone,
  type CountryCode,
} from "./pairing-phone";

export type WhatsAppPairingPayload = {
  pairing_supported?: boolean;
  restart_required?: boolean;
  pairing_code?: string | null;
  status?: "open" | "connecting" | "disconnected";
  channel?: Tables<"whatsapp_channels"> | null;
  error?: string;
};
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoint: "whatsapp-channel" | "platform-whatsapp";
  shopId?: string;
  channelId?: string;
  shopTimeZone?: string;
  demo?: boolean;
  onUpdate: (payload: WhatsAppPairingPayload) => void;
};

function PairingFrame({
  open,
  onOpenChange,
  children,
}: Pick<Props, "open" | "onOpenChange"> & { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="bg-card">
        <DialogHeader>
          <DialogTitle>{t("waPair.title")}</DialogTitle>
          <DialogDescription>{t("waPair.description")}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function WhatsAppPairingDialog(props: Props) {
  const demo = useDemo();
  const demoMode = props.demo || Boolean(demo);
  const { session, currentSession } = useAuthSession(demoMode);
  const { t } = useI18n();
  if (!demoMode && session?.user)
    return (
      <PairingForm
        key={`${session.user.id}:${props.endpoint}:${props.channelId ?? props.shopId ?? "platform"}`}
        {...props}
        userId={session.user.id}
        currentSession={currentSession}
      />
    );
  return (
    <PairingFrame {...props}>
      <DialogBody>
        <Notice tone="info" title={t(demoMode ? "waPair.demo" : "integr.err.session")} />
      </DialogBody>
    </PairingFrame>
  );
}

function PairingForm({
  open,
  endpoint,
  shopId,
  channelId,
  shopTimeZone,
  userId,
  currentSession,
  onUpdate,
  onOpenChange,
}: Props & {
  userId: string;
  currentSession: RefObject<Session | null>;
}) {
  const { t, locale } = useI18n();
  const [country, setCountry] = useState<CountryCode>(() =>
    initialPairingCountry(shopTimeZone, locale),
  );
  const countries = useMemo(() => pairingCountries(locale), [locale]);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [copied, setCopied] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const visible = useRef(open);
  visible.current = open;
  const update = useRef(onUpdate);
  update.current = onUpdate;

  useEffect(() => {
    const version = ++generation.current;
    setCode(null);
    setDone(false);
    setCopied(false);
    setBusy(false);
    return () => {
      generation.current = version + 1;
    };
  }, [open]);

  const request = useCallback(
    async (action: "connect" | "pairing-status" | "restart-pairing") => {
      if (pending.current || !visible.current || currentSession.current?.user.id !== userId) return;
      const normalized = normalizePairingPhone(phone, country);
      if (!normalized) {
        setError("waPair.invalidPhone");
        return;
      }
      const number = normalized.digits;
      pending.current = true;
      setBusy(true);
      setError(null);
      setCopied(false);
      const version = generation.current;
      const current = () =>
        visible.current &&
        version === generation.current &&
        currentSession.current?.user.id === userId;
      try {
        const { data } = await supabase.auth.getSession();
        if (!current() || data.session?.user.id !== userId) return;
        if (action !== "pairing-status") setStarted(true);
        if (channelId) {
          const check = await guardedFetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-whatsapp`,
            {
              method: "POST",
              signal: AbortSignal.timeout(10000),
              headers: {
                Authorization: `Bearer ${data.session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ action: "status", channel_id: channelId }),
            },
          );
          const scope = await check.json();
          if (!current()) return;
          if (!check.ok || scope.managed_channel_id !== channelId) {
            setError("waPair.needsUpdate");
            return;
          }
        }
        const response = await guardedFetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
          {
            method: "POST",
            signal: AbortSignal.timeout(20000),
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action,
              method: "code",
              phone: number,
              ...(shopId ? { barbershop_id: shopId } : {}),
              ...(channelId ? { channel_id: channelId } : {}),
            }),
          },
        );
        const payload = (await response.json()) as WhatsAppPairingPayload;
        if (!current()) return;
        if (!response.ok) {
          if (action === "restart-pairing") {
            setStarted(false);
            setRestartRequired(true);
          }
          if (
            payload.error === "PAIRING_IN_PROGRESS" ||
            payload.error === "PAIRING_PHONE_INVALID"
          ) {
            setStarted(false);
            setError(
              payload.error === "PAIRING_IN_PROGRESS"
                ? "waPair.needsUpdate"
                : "waPair.invalidPhone",
            );
          } else
            setError(
              payload.error === "PAIRING_RESTART_UNAVAILABLE"
                ? "waPair.restartFailed"
                : "waPair.failed",
            );
          setCode(null);
          return;
        }
        if (!payload.pairing_supported) {
          setStarted(false);
          setCode(null);
          setError("waPair.needsUpdate");
          return;
        }
        setRestartRequired(Boolean(payload.restart_required));
        if (payload.restart_required) {
          setStarted(false);
          setCode(null);
          update.current(payload);
          return;
        }
        update.current(payload);
        const status = payload.channel?.status ?? payload.status ?? "disconnected";
        if (status === "open") {
          setDone(true);
          setStarted(false);
          setCode(null);
        } else if (status === "disconnected") {
          setStarted(false);
          setCode(null);
          setError("waPair.ended");
        } else {
          setCode(
            payload.pairing_code && /^[A-Z0-9]{8}$/.test(payload.pairing_code)
              ? payload.pairing_code
              : null,
          );
        }
      } catch {
        if (current()) {
          if (action === "restart-pairing") {
            setStarted(false);
            setRestartRequired(true);
          }
          setCode(null);
          setError("waPair.failed");
        }
      } finally {
        pending.current = false;
        if (version === generation.current) setBusy(false);
      }
    },
    [phone, country, userId, endpoint, shopId, channelId, currentSession],
  );

  // Uma consulta por vez; resultado antigo nunca chega a outra conta/loja/abertura.
  useEffect(() => {
    if (!open || !started || restartRequired || done || error) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await request("pairing-status");
      if (!cancelled) timer = setTimeout(poll, 4000);
    };
    timer = setTimeout(poll, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, started, restartRequired, done, error, request]);

  return (
    <PairingFrame open={open} onOpenChange={onOpenChange}>
      <DialogBody className="space-y-4">
        {done ? (
          <Notice tone="success" icon={CheckCircle2} title={t("integr.wa.connected")} />
        ) : (
          <>
            <label className="block space-y-2 text-sm font-semibold">
              <span>{t("waPair.country")}</span>
              <select
                value={country}
                disabled={started || busy}
                onChange={(event) => {
                  const selected = event.target.value as CountryCode;
                  const previous = normalizePairingPhone(phone, country);
                  if (previous && (phone.trim().startsWith("+") || phone.trim().startsWith("00")))
                    setPhone(previous.national);
                  setCountry(selected);
                  rememberPairingCountry(selected);
                }}
                className="min-h-11 w-full min-w-0 rounded-[var(--control-radius)] border border-input bg-background px-3 py-2 text-base disabled:opacity-60"
              >
                {countries.map((option) => (
                  <option key={option.country} value={option.country}>
                    {option.name} (+{option.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-semibold">
              <span>{t("waPair.phone")}</span>
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => {
                  const value = event.target.value;
                  setPhone(value);
                  if (value.trim().startsWith("+") || value.trim().startsWith("00")) {
                    const detected = normalizePairingPhone(value, country)?.country;
                    if (detected) {
                      setCountry(detected);
                      rememberPairingCountry(detected);
                    }
                  }
                }}
                disabled={started || busy}
                maxLength={24}
                placeholder={
                  country === "BR"
                    ? "(11) 99999-9999"
                    : country === "PT"
                      ? "912 345 678"
                      : undefined
                }
                className="min-h-11 w-full rounded-[var(--control-radius)] border border-input bg-background px-3 py-2 text-base disabled:opacity-60"
              />
            </label>
            {code ? (
              <div className="space-y-3 rounded-[var(--panel-radius)] border border-border bg-background p-4 text-center">
                <p className="text-sm font-semibold">{t("waPair.enterCode")}</p>
                <output
                  aria-label={t("waPair.codeLabel")}
                  className="block break-all font-mono text-3xl font-bold tracking-wider"
                  aria-live="polite"
                >
                  {code.slice(0, 4)}-{code.slice(4)}
                </output>
                <button
                  type="button"
                  className="action-button action-confirm mx-auto"
                  onClick={() => {
                    const version = generation.current;
                    void navigator.clipboard
                      .writeText(code)
                      .then(() => {
                        if (
                          visible.current &&
                          generation.current === version &&
                          currentSession.current?.user.id === userId
                        )
                          setCopied(true);
                      })
                      .catch(() => {
                        if (visible.current && generation.current === version)
                          setError("waPair.copyFailed");
                      });
                  }}
                >
                  <Copy aria-hidden="true" />
                  {t(copied ? "waPair.copied" : "waPair.copy")}
                </button>
              </div>
            ) : started && !error ? (
              <Notice tone="pending" title={t("waPair.waiting")} />
            ) : null}
            <ol className="list-decimal space-y-2 pl-5 text-sm [overflow-wrap:anywhere]">
              <li>{t("waPair.step1")}</li>
              <li>{t("waPair.step2")}</li>
              <li>{t("waPair.step3")}</li>
            </ol>
            <Hint icon={Smartphone}>{t("waPair.notSms")}</Hint>
            {restartRequired && <Notice tone="info" title={t("waPair.restartNotice")} />}
            {error && <Notice tone="warning" title={t(error)} />}
          </>
        )}
      </DialogBody>
      {!done && (
        <DialogActions>
          <button
            type="button"
            disabled={busy}
            className="action-button action-confirm w-full sm:w-auto"
            onClick={() =>
              void request(
                restartRequired ? "restart-pairing" : started ? "pairing-status" : "connect",
              )
            }
          >
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Smartphone aria-hidden="true" />
            )}
            {t(
              busy
                ? "waPair.loading"
                : restartRequired
                  ? "waPair.restart"
                  : started
                    ? "waPair.check"
                    : "waPair.generate",
            )}
          </button>
        </DialogActions>
      )}
    </PairingFrame>
  );
}
