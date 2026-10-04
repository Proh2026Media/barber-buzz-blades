import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, Globe2, RefreshCw, Trash2 } from "lucide-react";
import { SettingsCardHeader } from "@/features/shop/settings/SettingsCardHeader";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { PLATFORM_BASE_HOST, shopPublicOrigin } from "@/lib/shop/host";
import { friendlyAuthError, readErrorCode } from "@/lib/auth/friendly-error";

type DomainSettings = {
  shop_id: string;
  shop_slug: string;
  platform_base_host: string;
  platform_subdomain: string;
  platform_url: string;
  custom_domain: string | null;
  custom_domain_status: "none" | "pending_dns" | "active" | "error";
  domain_verify_token: string | null;
  domain_verified_at: string | null;
  domain_last_error: string | null;
  dns_instructions: {
    cname_host: string;
    cname_target: string;
    txt_host: string;
    txt_value: string;
  } | null;
};

const statusKey = {
  none: "integr.domain.status.none",
  pending_dns: "integr.domain.status.pending_dns",
  active: "integr.domain.status.active",
  error: "integr.domain.status.error",
} as const satisfies Record<DomainSettings["custom_domain_status"], MessageKey>;

/** Resposta de erro da função shop-domain (campos usados na tradução). */
type DomainErrorPayload = {
  error?: string;
  error_code?: string;
  txt_host?: string;
  expected_txt?: string;
  domain?: string;
  cname_target?: string;
  kept_active?: boolean;
};

/**
 * A função shop-domain devolve `error_code` estável (preferido) e frases fixas
 * em pt-BR. Pelo código, traduz com os dados do DNS que vêm na resposta; sem
 * código (ou erro gravado em `domain_last_error`), reconhece as frases
 * conhecidas e traduz pelo dicionário; o resto passa pelo filtro de erros.
 */
function translateDomainServerMessage(
  raw: string,
  t: ReturnType<typeof useI18n>["t"],
  fallback?: string,
  payload?: DomainErrorPayload,
): string {
  const translated = translateDomainByCode(payload, t, fallback);
  if (translated) {
    return payload?.kept_active ? `${translated} ${t("fix2.edge.domainKeptActive")}` : translated;
  }
  const text = raw.trim();
  const txt =
    // Hosts têm pontos: o ponto final da frase é o que vem antes de espaço/fim.
    /^TXT não encontrado em (\S+?)\.\s+Esperado (\S+?)\.(?:\s|$)/i.exec(text) ??
    /^Registre o TXT em (\S+) = (\S+)/i.exec(text);
  if (txt) return t("fix.ajustes-marca.domainTxtMissing", { host: txt[1], value: txt[2] });
  const cname =
    /^Aponte (\S+) \(CNAME\) para (\S+?)\.(?:\s|$)/i.exec(text) ??
    /^CNAME (\S+) → (\S+) ainda não propagou/i.exec(text);
  if (cname) {
    return t("fix.ajustes-marca.domainCnamePending", { domain: cname[1], target: cname[2] });
  }
  if (/nenhum domínio pendente/i.test(text)) return t("fix.ajustes-marca.domainNothingPending");
  return friendlyAuthError(text, fallback);
}

function translateDomainByCode(
  payload: DomainErrorPayload | undefined,
  t: ReturnType<typeof useI18n>["t"],
  fallback?: string,
): string | null {
  const code = readErrorCode(payload);
  if (!payload || !code) return null;
  if (code === "domain_txt_missing" && payload.txt_host && payload.expected_txt) {
    return t("fix.ajustes-marca.domainTxtMissing", {
      host: payload.txt_host,
      value: payload.expected_txt,
    });
  }
  if (code === "domain_dns_pending" && payload.domain && payload.cname_target) {
    return t("fix.ajustes-marca.domainCnamePending", {
      domain: payload.domain,
      target: payload.cname_target,
    });
  }
  if (code === "domain_nothing_pending") return t("fix.ajustes-marca.domainNothingPending");
  // Recusa do banco ao salvar (domínio inválido, já em uso…): o texto é o que explica.
  if (code === "domain_rejected") return null;
  if (code === "domain_txt_missing" || code === "domain_dns_pending") {
    return t("fix2.edge.domainDnsPending");
  }
  return friendlyAuthError({ error_code: code, message: payload.error ?? "" }, fallback);
}

/** Erro já traduzido para o usuário: não passa de novo pelo filtro de mensagens. */
class DomainMessageError extends Error {}

function domainErrorText(err: unknown, fallback: string) {
  return err instanceof DomainMessageError ? err.message : friendlyAuthError(err, fallback);
}

type ShopDomainCardProps = {
  shopId: string;
};

export function ShopDomainCard({ shopId }: ShopDomainCardProps) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<DomainSettings | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_shop_domain_settings", {
      p_shop_id: shopId,
    });
    if (rpcError) {
      setError(friendlyAuthError(rpcError));
      return;
    }
    const row = data as DomainSettings;
    setSettings(row);
    setDomainInput(row.custom_domain ?? "");
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      setError(t("integr.domain.errCopy"));
    }
  }

  async function callShopDomain(body: Record<string, string>) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error(t("integr.err.session"));
    const base = import.meta.env.VITE_SUPABASE_URL || "";
    const response = await fetch(`${base}/functions/v1/shop-domain`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    // Gateway fora do ar costuma devolver HTML: não deixa o erro de parse
    // virar "código inválido" no filtro de mensagens.
    const raw = await response.text();
    let payload: DomainErrorPayload & {
      ok?: boolean;
      warning?: string | null;
      settings?: DomainSettings;
    };
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      throw new DomainMessageError(`${t("integr.domain.errGeneric")} (${response.status})`);
    }
    if (!response.ok) {
      throw new DomainMessageError(
        payload.error || payload.error_code
          ? translateDomainServerMessage(
              payload.error ?? "",
              t,
              t("integr.domain.errGeneric"),
              payload,
            )
          : t("integr.domain.errGeneric"),
      );
    }
    return payload;
  }

  async function saveDomain(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callShopDomain({
        action: "set",
        barbershop_id: shopId,
        domain: domainInput.trim(),
      });
      if (payload.settings) setSettings(payload.settings);
      else await load();
      setMessage(
        payload.warning
          ? t("integr.domain.savedWarning", {
              warning: t("fix.ajustes-marca.domainProxyPending"),
            })
          : t("integr.domain.saved"),
      );
    } catch (err) {
      setError(domainErrorText(err, t("integr.domain.errSave")));
    } finally {
      setBusy(false);
    }
  }

  async function clearDomain() {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callShopDomain({
        action: "clear",
        barbershop_id: shopId,
      });
      if (payload.settings) setSettings(payload.settings);
      else await load();
      setDomainInput("");
      setMessage(
        payload.warning
          ? t("integr.domain.removedWarning", {
              warning: t("fix.ajustes-marca.domainProxyPending"),
            })
          : t("integr.domain.removed"),
      );
    } catch (err) {
      setError(domainErrorText(err, t("integr.domain.errRemove")));
    } finally {
      setBusy(false);
    }
  }

  async function verifyDomain() {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callShopDomain({
        action: "verify",
        barbershop_id: shopId,
      });
      if (payload.settings) setSettings(payload.settings);
      else await load();
      setMessage(
        payload.ok
          ? payload.warning
            ? t("integr.domain.verifiedWarning", {
                warning: t("fix.ajustes-marca.domainProxyPending"),
              })
            : t("integr.domain.verifiedActive")
          : payload.error || payload.error_code
            ? translateDomainServerMessage(
                payload.error ?? "",
                t,
                t("integr.domain.checkDnsHint"),
                payload,
              )
            : t("integr.domain.checkDnsHint"),
      );
    } catch (err) {
      setError(domainErrorText(err, t("integr.domain.errVerify")));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const platformUrl = settings?.platform_url ?? `https://….${PLATFORM_BASE_HOST}`;
  const publicOrigin = settings
    ? shopPublicOrigin({
        slug: settings.shop_slug,
        customDomain: settings.custom_domain,
        customDomainStatus: settings.custom_domain_status,
      })
    : null;
  const publicUrl = publicOrigin ? `${publicOrigin}/app` : null;
  const customActive =
    settings?.custom_domain_status === "active" && Boolean(settings.custom_domain);
  const instructions = settings?.dns_instructions;

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
      <SettingsCardHeader
        icon={Globe2}
        title={t("integr.domain.title")}
        intro={t("integr.domain.intro")}
      />

      {publicUrl && (
        <div className="space-y-2 rounded-2xl border border-primary/25 bg-primary/5 p-3">
          <p className="text-xs font-semibold">
            {customActive ? t("integr.domain.publicCustom") : t("integr.domain.publicAuto")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-muted/50 px-3 py-2 text-xs">
              {publicUrl}
            </code>
            <button
              type="button"
              className="action-button"
              onClick={() => void copyText("public", publicUrl)}
            >
              <Copy size={14} />
              {copied === "public" ? t("integr.domain.copied") : t("integr.domain.copy")}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-border bg-background p-3">
        <p className="text-xs font-semibold">{t("integr.domain.autoAddress")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl bg-muted/50 px-3 py-2 text-xs">
            {platformUrl}
          </code>
          <button
            type="button"
            className="action-button"
            onClick={() => void copyText("platform", platformUrl)}
          >
            <Copy size={14} />
            {copied === "platform" ? t("integr.domain.copied") : t("integr.domain.copy")}
          </button>
        </div>
      </div>

      <form
        onSubmit={saveDomain}
        className="space-y-3 rounded-2xl border border-border bg-background p-3"
      >
        <p className="text-xs font-semibold">{t("integr.domain.custom")}</p>
        <label htmlFor="custom-domain" className="block text-xs text-muted-foreground">
          {t("integr.domain.example")}
        </label>
        <input
          id="custom-domain"
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          placeholder={t("integr.domain.placeholder")}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
        {settings && settings.custom_domain_status !== "none" && (
          <p className="text-xs text-muted-foreground">
            {t("integr.domain.statusLabel")}{" "}
            <span className="font-semibold text-foreground">
              {t(statusKey[settings.custom_domain_status])}
            </span>
            {settings.domain_last_error
              ? ` — ${translateDomainServerMessage(settings.domain_last_error, t, t("integr.domain.checkDnsHint"))}`
              : null}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="action-button action-confirm">
            {t("integr.domain.save")}
          </button>
          {settings?.custom_domain && (
            <>
              <button
                type="button"
                disabled={busy}
                className="action-button"
                onClick={() => void verifyDomain()}
              >
                <RefreshCw size={14} />
                {t("integr.domain.verify")}
              </button>
              <button
                type="button"
                disabled={busy}
                className="action-button action-danger"
                onClick={() => void clearDomain()}
              >
                <Trash2 size={14} />
                {t("integr.domain.remove")}
              </button>
            </>
          )}
        </div>
      </form>

      {instructions && (
        <div className="space-y-2 rounded-2xl border border-dashed border-border p-3 text-xs">
          <p className="font-semibold">{t("integr.domain.dnsCreate")}</p>
          <ol className="list-decimal space-y-2 pl-4 text-muted-foreground [overflow-wrap:anywhere]">
            <li>
              <span className="text-foreground">CNAME</span>{" "}
              <code className="break-all text-foreground">{instructions.cname_host}</code> →{" "}
              <code className="break-all text-foreground">{instructions.cname_target}</code>
              <button
                type="button"
                className="mt-1 flex min-h-11 items-center gap-1.5 text-xs font-semibold text-foreground underline underline-offset-2"
                onClick={() => void copyText("cname", instructions.cname_target)}
              >
                {t("integr.domain.copyTarget")}
              </button>
            </li>
            <li>
              <span className="text-foreground">TXT</span>{" "}
              <code className="break-all text-foreground">{instructions.txt_host}</code> ={" "}
              <code className="break-all text-foreground">{instructions.txt_value}</code>
              <button
                type="button"
                className="mt-1 flex min-h-11 items-center gap-1.5 text-xs font-semibold text-foreground underline underline-offset-2"
                onClick={() => void copyText("txt", instructions.txt_value)}
              >
                {t("integr.domain.copyValue")}
              </button>
            </li>
          </ol>
          <p className="text-muted-foreground">{t("integr.domain.propagation")}</p>
          {settings?.custom_domain_status === "active" && (
            <p className="flex items-center gap-1 font-semibold text-foreground">
              <CheckCircle2 size={14} /> {t("integr.domain.verified")}
            </p>
          )}
        </div>
      )}

      {message && <p className="text-sm text-foreground">{message}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
