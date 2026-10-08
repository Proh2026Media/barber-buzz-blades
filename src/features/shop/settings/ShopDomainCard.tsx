import { useCallback, useEffect, useId, useState } from "react";
import {
  CheckCircle2,
  Globe2,
  Hourglass,
  Loader2,
  RefreshCw,
  Save,
  SearchCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  ActionResult,
  ConfirmDialog,
  CopyField,
  Field,
  Hint,
  LoadingState,
  MoreDetails,
  Notice,
  STATE,
  SectionHeader,
  StatusBadge,
  Steps,
  Tag,
  readableLink,
  type ActionState,
  type StepItem,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { friendlyAuthError, readErrorCode } from "@/lib/auth/friendly-error";
import { DOMAIN_BADGE } from "./domain-status";

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

/**
 * O que a última conferência gravada (`domain_last_error`) diz dos registros. A função confere
 * o TXT antes do CNAME: "TXT não encontrado" = registro 2 faltando (o 1 ainda não foi visto);
 * "Aponte … (CNAME)" = TXT certo e registro 1 faltando. Outras frases ficam `null`.
 */
function lastCheckRecords(raw: string | null | undefined): RecordCheck | null {
  const text = raw?.trim();
  if (!text) return null;
  if (/^TXT não encontrado em |^Registre o TXT em /i.test(text)) return { txt: false };
  if (/^Aponte \S+ \(CNAME\)|^CNAME \S+ → \S+ ainda não propagou/i.test(text)) {
    return { txt: true, cname: false };
  }
  return null;
}

/** Erro já traduzido para o usuário: não passa de novo pelo filtro de mensagens. */
class DomainMessageError extends Error {
  payload?: DomainErrorPayload & { txt_ok?: boolean; cname_ok?: boolean };
  constructor(message: string, payload?: DomainMessageError["payload"]) {
    super(message);
    this.payload = payload;
  }
}

function domainErrorText(err: unknown, fallback: string) {
  return err instanceof DomainMessageError ? err.message : friendlyAuthError(err, fallback);
}

type ShopDomainCardProps = {
  shopId: string;
};

type Result = { state: ActionState; text: string };
/** `missing`: registro ainda não encontrado — usa a mesma cor e ícone do selo do cabeçalho. */
type VerifyResult = { tone: "success" | "pending" | "danger"; text: string; missing?: boolean };
type RecordCheck = { cname?: boolean; txt?: boolean };

export function ShopDomainCard({ shopId }: ShopDomainCardProps) {
  const { t } = useI18n();
  const inputId = useId();
  const [settings, setSettings] = useState<DomainSettings | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [domainInput, setDomainInput] = useState("");
  const [action, setAction] = useState<"save" | "verify" | "clear" | null>(null);
  const busy = action !== null;
  const [saveResult, setSaveResult] = useState<Result | null>(null);
  // Resultado da última conferência: fica na tela mesmo depois de recarregar os dados.
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [checks, setChecks] = useState<RecordCheck>({});
  const [removeOpen, setRemoveOpen] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoadState("loading");
      const { data, error: rpcError } = await supabase.rpc("get_shop_domain_settings", {
        p_shop_id: shopId,
      });
      if (rpcError || !data) {
        if (!quiet) setLoadState("error");
        return;
      }
      const row = data as DomainSettings;
      setSettings(row);
      setDomainInput(row.custom_domain ?? "");
      setLoadState("ready");
    },
    [shopId],
  );

  useEffect(() => {
    void load();
  }, [load]);

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
        payload,
      );
    }
    return payload;
  }

  async function saveDomain(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setAction("save");
    setSaveResult(null);
    setVerifyResult(null);
    setChecks({});
    try {
      const payload = await callShopDomain({
        action: "set",
        barbershop_id: shopId,
        domain: domainInput.trim(),
      });
      if (payload.settings) setSettings(payload.settings);
      else await load(true);
      setSaveResult({
        state: payload.warning ? "pending" : "saved",
        text: payload.warning
          ? t("integr.domain.savedWarning", {
              warning: t("fix.ajustes-marca.domainProxyPending"),
            })
          : t("domainCard.saved"),
      });
    } catch (err) {
      setSaveResult({ state: "error", text: domainErrorText(err, t("integr.domain.errSave")) });
    } finally {
      setAction(null);
    }
  }

  /** Remove o domínio próprio; erro sobe para a janela de confirmação mostrar. */
  async function clearDomain() {
    setAction("clear");
    try {
      const payload = await callShopDomain({
        action: "clear",
        barbershop_id: shopId,
      });
      if (payload.settings) setSettings(payload.settings);
      else await load(true);
      setDomainInput("");
      setVerifyResult(null);
      setChecks({});
      setSaveResult({
        state: payload.warning ? "pending" : "saved",
        text: payload.warning
          ? t("integr.domain.removedWarning", {
              warning: t("fix.ajustes-marca.domainProxyPending"),
            })
          : t("integr.domain.removed"),
      });
    } finally {
      setAction(null);
    }
  }

  async function verifyDomain() {
    if (busy) return;
    setAction("verify");
    setVerifyResult(null);
    try {
      const payload = await callShopDomain({
        action: "verify",
        barbershop_id: shopId,
      });
      if (payload.settings) setSettings(payload.settings);
      else await load(true);
      setChecks({ cname: true, txt: true });
      setVerifyResult(
        payload.ok
          ? {
              tone: payload.warning ? "pending" : "success",
              text: payload.warning
                ? t("integr.domain.verifiedWarning", {
                    warning: t("fix.ajustes-marca.domainProxyPending"),
                  })
                : t("domainCard.verify.ok"),
            }
          : {
              tone: "pending",
              text: payload.error
                ? translateDomainServerMessage(payload.error, t, t("domainCard.verify.wait"))
                : t("domainCard.verify.wait"),
            },
      );
    } catch (err) {
      const payload = err instanceof DomainMessageError ? err.payload : undefined;
      const code = readErrorCode(payload);
      const dnsPending = code === "domain_txt_missing" || code === "domain_dns_pending";
      if (dnsPending) {
        const next = { cname: payload?.cname_ok, txt: payload?.txt_ok };
        setChecks(next);
        const missing = [next.cname === false ? 1 : null, next.txt === false ? 2 : null].filter(
          (value): value is number => value !== null,
        );
        setVerifyResult({
          tone: "pending",
          missing: true,
          text:
            missing.length === 1
              ? t("domainCard.verify.missingOne", { n: missing[0] })
              : t("domainCard.verify.missingBoth"),
        });
      } else {
        setVerifyResult({
          tone: "danger",
          text: domainErrorText(err, t("integr.domain.errVerify")),
        });
      }
      // Recarrega o estado sem apagar o resultado da conferência.
      await load(true);
    } finally {
      setAction(null);
    }
  }

  const status = settings?.custom_domain ? settings.custom_domain_status : "none";
  const badge = DOMAIN_BADGE[status];
  const instructions = settings?.custom_domain ? settings.dns_instructions : null;
  const active = status === "active";
  // Sem conferência nesta visita, a última gravada marca o cartão do registro que faltou.
  const storedChecks = verifyResult ? null : lastCheckRecords(settings?.domain_last_error);
  const knownChecks: RecordCheck =
    storedChecks && checks.cname === undefined && checks.txt === undefined ? storedChecks : checks;
  const storedMissing = storedChecks ? (storedChecks.txt === false ? 2 : 1) : null;
  const recordOk = (key: keyof RecordCheck) => (active ? true : knownChecks[key]);
  const autoLink = settings ? readableLink(settings.platform_url) : "";
  // Só erro desconhecido mostra o texto da função, e recolhido em "Última conferência".
  const lastError =
    !verifyResult && !storedChecks && settings?.domain_last_error
      ? translateDomainServerMessage(settings.domain_last_error, t, t("domainCard.verify.wait"))
      : null;

  const recordsDone = active || (knownChecks.cname === true && knownChecks.txt === true);
  const steps: StepItem[] = [
    { key: "domain", label: t("domainCard.step.domain"), status: "done" },
    {
      key: "records",
      label: t("domainCard.step.records"),
      status: recordsDone ? "done" : status === "error" ? "error" : "current",
    },
    {
      key: "check",
      label: t("domainCard.step.check"),
      status: active ? "done" : recordsDone ? "current" : "upcoming",
    },
    { key: "live", label: t("domainCard.step.live"), status: active ? "done" : "upcoming" },
  ];

  function renderRecord(index: number, type: string, host: string, value: string, ok?: boolean) {
    return (
      <div
        key={type}
        className="min-w-0 space-y-2 rounded-2xl border border-border bg-background/60 p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold">
            {t("domainCard.record", { n: index })}
            <Tag>{type}</Tag>
          </p>
          {ok === true && (
            <StatusBadge {...STATE.active} size="sm" label={t("domainCard.record.found")} />
          )}
          {/* Ainda não visto: espera (âmbar), como o selo do domínio; vermelho só no erro. */}
          {ok === false &&
            (status === "error" ? (
              <StatusBadge {...STATE.failed} size="sm" label={t("domainCard.record.missing")} />
            ) : (
              <StatusBadge
                tone="pending"
                icon={Hourglass}
                size="sm"
                label={t("domainCard.record.notYet")}
              />
            ))}
        </div>
        {/* Valores técnicos: só copiar e colar no provedor (sem "Enviar"). */}
        <CopyField label={t("domainCard.record.name")} value={host} mono share={false} />
        <CopyField label={t("domainCard.record.value")} value={value} mono share={false} />
      </div>
    );
  }

  if (loadState !== "ready" || !settings) {
    return (
      <section className="app-action-card space-y-4 p-4 sm:p-5">
        <SectionHeader icon={Globe2} title={t("domainCard.title")} />
        {loadState === "error" ? (
          <Notice
            tone="danger"
            title={t("domainCard.loadError")}
            action={{ label: t("visual.retry"), icon: RefreshCw, onClick: () => void load() }}
          />
        ) : (
          <LoadingState variant="lines" count={3} label={t("domainCard.loading")} />
        )}
      </section>
    );
  }

  return (
    <section className="app-action-card space-y-4 p-4 sm:p-5">
      <SectionHeader
        icon={Globe2}
        title={t("domainCard.title")}
        description={settings.custom_domain ?? t("domainCard.intro")}
        aside={<StatusBadge tone={badge.tone} icon={badge.icon} label={t(badge.label)} />}
      />

      {settings.custom_domain && <Steps steps={steps} label={t("domainCard.stepsLabel")} />}

      {/* 1 · Seu domínio */}
      <form onSubmit={saveDomain} className="space-y-2">
        <Field
          id={inputId}
          label={
            settings.custom_domain
              ? `1 · ${t("domainCard.step.domain")}`
              : t("domainCard.field.label")
          }
          hint={t("integr.domain.example")}
        >
          {(props) => (
            <div className="flex flex-wrap gap-2">
              <input
                {...props}
                value={domainInput}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder={t("integr.domain.placeholder")}
                className="min-h-11 min-w-0 flex-1 basis-48 rounded-xl border border-border bg-background px-3 text-sm"
              />
              <button
                type="submit"
                disabled={busy || !domainInput.trim()}
                aria-busy={action === "save" || undefined}
                className="action-button action-confirm flex-1 sm:flex-none"
              >
                {action === "save" ? (
                  <Loader2 className="motion-safe:animate-spin" aria-hidden />
                ) : (
                  <Save aria-hidden />
                )}
                {action === "save" ? t("visual.result.saving") : t("integr.domain.save")}
              </button>
            </div>
          )}
        </Field>
        <ActionResult
          state={saveResult?.state ?? null}
          text={saveResult?.text}
          onDismiss={() => setSaveResult(null)}
        />
      </form>

      {instructions && !active && (
        <>
          {/* 2 · Os dois registros, um cartão para cada, com Copiar em cada linha. */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">2 · {t("domainCard.records.title")}</p>
            <Hint>{t("domainCard.records.hint")}</Hint>
            <div className="grid gap-2 lg:grid-cols-2">
              {renderRecord(
                1,
                "CNAME",
                instructions.cname_host,
                instructions.cname_target,
                recordOk("cname"),
              )}
              {renderRecord(
                2,
                "TXT",
                instructions.txt_host,
                instructions.txt_value,
                recordOk("txt"),
              )}
            </div>
          </div>

          {/* 3 · Conferir */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">3 · {t("domainCard.step.check")}</p>
            <button
              type="button"
              disabled={busy}
              aria-busy={action === "verify" || undefined}
              onClick={() => void verifyDomain()}
              className="action-button action-confirm w-full sm:w-auto"
            >
              {action === "verify" ? (
                <Loader2 className="motion-safe:animate-spin" aria-hidden />
              ) : (
                <SearchCheck aria-hidden />
              )}
              {action === "verify" ? t("domainCard.verifying") : t("domainCard.verify")}
            </button>
            {verifyResult && (
              <Notice
                tone={verifyResult.missing ? badge.tone : verifyResult.tone}
                icon={
                  verifyResult.missing
                    ? badge.icon
                    : verifyResult.tone === "pending"
                      ? Hourglass
                      : undefined
                }
                title={verifyResult.text}
                role={verifyResult.tone === "danger" ? "alert" : "status"}
              >
                {verifyResult.tone === "pending" ? t("domainCard.verify.wait") : undefined}
              </Notice>
            )}
            {/* Registro que faltou na última conferência: uma linha, na cor do selo acima. */}
            {storedMissing !== null && (
              <Notice
                tone={badge.tone}
                icon={badge.icon}
                title={t("domainCard.verify.missingOne", { n: storedMissing })}
                role="none"
              >
                {t("domainCard.verify.wait")}
              </Notice>
            )}
            {lastError && (
              <MoreDetails summary={t("domainCard.lastCheck")}>
                <p className="text-sm text-muted-foreground">{lastError}</p>
              </MoreDetails>
            )}
          </div>
        </>
      )}

      {active && settings.custom_domain && (
        <Notice tone="success" title={t("domainCard.live", { domain: settings.custom_domain })}>
          {t("domainCard.liveAuto", { link: autoLink })}
        </Notice>
      )}
      {active && verifyResult && verifyResult.tone !== "success" && (
        <Notice tone={verifyResult.tone} title={verifyResult.text} />
      )}

      {settings.custom_domain && (
        <MoreDetails>
          <p className="text-sm text-muted-foreground">{t("integr.domain.propagation")}</p>
        </MoreDetails>
      )}

      {/* Ação destrutiva separada, no rodapé, com confirmação. */}
      {settings.custom_domain && (
        <div className="flex justify-end border-t border-border/60 pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => setRemoveOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
          >
            <Trash2 className="size-4" aria-hidden />
            {t("domainCard.remove")}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        tone="danger"
        icon={Trash2}
        title={t("domainCard.removeConfirm.title", { domain: settings.custom_domain ?? "" })}
        consequences={[
          { icon: XCircle, tone: "danger", text: t("domainCard.removeConfirm.stops") },
          {
            icon: CheckCircle2,
            tone: "success",
            text: t("domainCard.removeConfirm.keeps", { link: autoLink }),
          },
        ]}
        confirmLabel={t("domainCard.remove")}
        confirmIcon={Trash2}
        cancelLabel={t("domainCard.removeConfirm.keep")}
        onConfirm={clearDomain}
        errorText={t("integr.domain.errRemove")}
      />
    </section>
  );
}
