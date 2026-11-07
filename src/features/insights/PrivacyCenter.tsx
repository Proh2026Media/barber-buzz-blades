import { SurveyCatalog } from "./SurveyCatalog";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CalendarDays,
  ChartLine,
  Lock,
  MessageCircleQuestion,
  MessageSquareText,
  Megaphone,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  ActionResult,
  ConfirmDialog,
  EmptyState,
  LoadingState,
  MoreDetails,
  Notice,
  SectionHeader,
  SettingRow,
  STATE,
  StatusBadge,
  Tag,
  UnsavedBar,
  type ActionState,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { defaultPrivacy, questions, type PrivacyPreferences, type Survey } from "./model";

type OptionalKey = "analytics" | "surveys" | "marketing";
const OPTIONAL: { key: OptionalKey; icon: LucideIcon; title: MessageKey; hint: MessageKey }[] = [
  {
    key: "analytics",
    icon: ChartLine,
    title: "privacy.analytics",
    hint: "conta.privacy.analyticsShort",
  },
  {
    key: "surveys",
    icon: MessageCircleQuestion,
    title: "privacy.surveys",
    hint: "conta.privacy.surveysShort",
  },
  {
    key: "marketing",
    icon: Megaphone,
    title: "privacy.marketing",
    hint: "conta.privacy.marketingShort",
  },
];

export function PrivacyCenter({
  userId,
  accountSession,
  id,
  onSummary,
}: {
  userId: string | null;
  accountSession: RefObject<Session | null>;
  /** id da seção, para os atalhos do resumo da Conta. */
  id?: string;
  /** Quantas opções opcionais estão ligadas (gravadas), para o resumo da Conta. */
  onSummary?: (on: number, total: number) => void;
}) {
  const demo = useDemo();
  const { t, intlLocale } = useI18n();
  const [preferences, setPreferences] = useState<PrivacyPreferences>(defaultPrivacy);
  // O que está gravado: compara para saber se há mudança e para desfazer.
  const [saved, setSaved] = useState<PrivacyPreferences>(defaultPrivacy);
  const [responses, setResponses] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<ActionState | null>(null);
  const [saveText, setSaveText] = useState<string | undefined>(undefined);
  const [erased, setErased] = useState(false);
  const [version, setVersion] = useState(0);
  const [confirmErase, setConfirmErase] = useState(false);
  const active = useRef(true);
  const inFlight = useRef(false);
  const isCurrent = useCallback(
    () =>
      active.current &&
      (Boolean(demo) || Boolean(userId && accountSession.current?.user.id === userId)),
    [demo, userId, accountSession],
  );
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const sessionToken = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !userId || data.session?.user.id !== userId || !data.session.access_token) {
      throw new Error("Sessão da conta indisponível");
    }
    return data.session.access_token;
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    if (demo) {
      setPreferences(demo.privacy);
      setSaved(demo.privacy);
      setResponses(demo.surveys);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    void (async () => {
      try {
        const token = await sessionToken();
        if (cancelled || !isCurrent()) return;
        const { data, error: failure } = await supabase
          .rpc("get_my_privacy")
          .setHeader("Authorization", `Bearer ${token}`);
        if (cancelled || !isCurrent()) return;
        const value = data as unknown as {
          preferences: PrivacyPreferences;
          responses: Survey[];
        } | null;
        if (
          failure ||
          !value?.preferences ||
          !Array.isArray(value.responses) ||
          !OPTIONAL.every(({ key }) => typeof value.preferences[key] === "boolean")
        ) {
          throw new Error("Escolhas indisponíveis");
        }
        setPreferences(value.preferences);
        setSaved(value.preferences);
        setResponses(value.responses);
      } catch {
        if (!cancelled && isCurrent()) setLoadError(true);
      } finally {
        if (!cancelled && isCurrent()) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, version, sessionToken, isCurrent]);

  const onCount = OPTIONAL.filter(({ key }) => saved[key]).length;
  useEffect(() => {
    if (!loading && !loadError) onSummary?.(onCount, OPTIONAL.length);
  }, [onSummary, onCount, loading, loadError]);

  const changes = OPTIONAL.filter(({ key }) => preferences[key] !== saved[key]).length;

  /** Grava as escolhas. Em falha, os interruptores ficam como a pessoa deixou. */
  async function save() {
    if (!isCurrent() || inFlight.current || loading || loadError || changes === 0) return;
    inFlight.current = true;
    setBusy(true);
    setSaveState("saving");
    setErased(false);
    try {
      if (demo) demo.dispatch({ type: "privacy.save", preferences });
      else {
        const token = await sessionToken();
        if (!isCurrent()) return;
        const result = await supabase
          .rpc("save_my_privacy", {
            p_analytics: preferences.analytics,
            p_surveys: preferences.surveys,
            p_marketing: preferences.marketing,
          })
          .setHeader("Authorization", `Bearer ${token}`);
        if (result.error) throw result.error;
      }
      if (!isCurrent()) return;
      setSaved(preferences);
      setSaveState("saved");
      setSaveText(t("conta.privacy.saved"));
    } catch {
      if (isCurrent()) {
        setSaveState("error");
        setSaveText(t("visual.result.failed"));
      }
    } finally {
      inFlight.current = false;
      if (isCurrent()) setBusy(false);
    }
  }

  /** Apaga respostas e registros opcionais (a janela mostra o erro, se houver). */
  async function erase() {
    if (!isCurrent() || inFlight.current || !confirmErase || loading || loadError) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (demo) demo.dispatch({ type: "privacy.erase" });
      else {
        const token = await sessionToken();
        if (!isCurrent()) return;
        const result = await supabase
          .rpc("erase_my_optional_data")
          .setHeader("Authorization", `Bearer ${token}`);
        if (result.error) throw result.error;
      }
      if (!isCurrent()) return;
      setPreferences(defaultPrivacy);
      setSaved(defaultPrivacy);
      setResponses([]);
      setSaveState(null);
      setErased(true);
    } finally {
      inFlight.current = false;
      if (isCurrent()) setBusy(false);
    }
  }

  const answered = responses.filter((row) => row.state === "answered");
  const titleId = `${id ?? "privacy"}-title`;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className="app-action-card scroll-mt-24 space-y-4 p-4 sm:p-5"
    >
      <SectionHeader
        icon={ShieldCheck}
        id={titleId}
        title={t("conta.privacy.title")}
        aside={
          !loading && !loadError ? (
            <StatusBadge
              {...(onCount > 0 ? STATE.active : STATE.paused)}
              size="sm"
              label={t("conta.privacy.count", { on: onCount, total: OPTIONAL.length })}
            />
          ) : null
        }
      />

      {loading ? (
        <LoadingState variant="list" count={4} label={t("privacy.loading")} />
      ) : loadError ? (
        <EmptyState
          variant="plain"
          status="danger"
          title={t("privacy.errorLoad")}
          action={
            <button
              type="button"
              onClick={() => setVersion((v) => v + 1)}
              className="action-button action-confirm"
            >
              {t("visual.retry")}
            </button>
          }
        />
      ) : (
        <>
          <div className="divide-y divide-border rounded-2xl border border-border bg-background/60 px-3">
            <SettingRow
              icon={Lock}
              tone="muted"
              title={t("conta.privacy.essential")}
              description={t("conta.privacy.essentialShort")}
              // O selo vai embaixo do texto: ao lado, em 320 px, espremia a descrição.
              summary={
                <StatusBadge {...STATE.active} size="sm" label={t("conta.privacy.always")} />
              }
            />
            {OPTIONAL.map(({ key, icon, title, hint }) => {
              const switchId = `${titleId}-${key}`;
              return (
                <div key={key}>
                  <SettingRow
                    icon={icon}
                    title={t(title)}
                    description={t(hint)}
                    controlId={switchId}
                    control={
                      <Switch
                        id={switchId}
                        checked={preferences[key]}
                        disabled={busy}
                        onCheckedChange={(checked) => {
                          if (inFlight.current || !isCurrent()) return;
                          setPreferences((current) => ({ ...current, [key]: checked }));
                          setSaveState(null);
                          setErased(false);
                        }}
                      />
                    }
                  />
                  {/* Consequência à vista antes de salvar: desligar apaga os registros de uso. */}
                  {key === "analytics" && saved.analytics && !preferences.analytics && (
                    <Notice
                      tone="warning"
                      role="none"
                      title={t("conta.privacy.analyticsOffWarning")}
                      className="mb-2.5"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <UnsavedBar
            dirty={changes > 0}
            count={changes}
            saving={busy}
            state={saveState}
            stateText={saveText}
            onSave={() => void save()}
            onDiscard={() => {
              if (inFlight.current || !isCurrent()) return;
              setPreferences(saved);
              setSaveState(null);
            }}
            saveLabel={t("privacy.save")}
          />

          <MoreDetails summary={t("conta.privacy.howWeUse")}>
            <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p>
                <strong>{t("privacy.essentialLabel")}</strong> {t("privacy.essentialText")}
              </p>
              <p>
                <strong>{t("privacy.usageLabel")}</strong> {t("privacy.usageText")}
              </p>
              <p>
                <strong>{t("privacy.surveysLabel")}</strong> {t("privacy.surveysText")}
              </p>
              <p>
                <strong>{t("privacy.analytics")}:</strong> {t("privacy.analyticsHint")}
              </p>
              <p>
                <strong>{t("privacy.surveys")}:</strong> {t("privacy.surveysHint")}
              </p>
              <p>
                <strong>{t("privacy.marketing")}:</strong> {t("privacy.marketingHint")}
              </p>
            </div>
          </MoreDetails>

          <SurveyCatalog compact />

          {/* Minhas respostas: a resposta (o dado da pessoa) em destaque; a pergunta em legenda. */}
          <section aria-labelledby={`${titleId}-answers`} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <MessageSquareText className="size-4 text-gold" aria-hidden />
              <h4 id={`${titleId}-answers`} className="text-sm font-bold">
                {t("privacy.myAnswers")}
              </h4>
              {demo && (
                <StatusBadge
                  tone="highlight"
                  size="sm"
                  label={t("common.demo")}
                  className="ms-auto"
                />
              )}
            </div>
            {answered.length === 0 ? (
              <EmptyState
                variant="plain"
                tone="bell"
                title={t("conta.privacy.noAnswers")}
                description={
                  preferences.surveys
                    ? t("conta.privacy.noAnswersOn")
                    : t("conta.privacy.noAnswersOff")
                }
                action={
                  !preferences.surveys ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (inFlight.current || !isCurrent()) return;
                        setPreferences((current) => ({ ...current, surveys: true }));
                        setSaveState(null);
                      }}
                      className="action-button action-confirm"
                    >
                      <MessageCircleQuestion aria-hidden />
                      {t("conta.privacy.enableSurveys")}
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="space-y-2">
                {answered.map((row) => {
                  const answer =
                    (questions[row.question]?.options as Record<string, string>)?.[
                      row.answer ?? ""
                    ] ?? t("privacy.notInformed");
                  const fromStaff = row.source === "shop_staff";
                  return (
                    <li
                      key={row.id}
                      className="space-y-2 rounded-2xl border border-border bg-background/60 p-3"
                    >
                      <p className="text-xs text-muted-foreground">
                        {questions[row.question]?.title}
                      </p>
                      <p className="inline-flex rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-bold text-foreground">
                        {answer}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge
                          tone={fromStaff ? "info" : "neutral"}
                          icon={fromStaff ? Users : Smartphone}
                          size="sm"
                          label={fromStaff ? t("privacy.toldStaff") : t("conta.privacy.byApp")}
                        />
                        {row.appointment_starts_at && (
                          <Tag icon={CalendarDays}>
                            {t("privacy.appointmentOf", {
                              date: new Date(row.appointment_starts_at).toLocaleString(intlLocale, {
                                dateStyle: "short",
                                timeStyle: "short",
                              }),
                            })}
                          </Tag>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {demo && answered.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("privacy.demoAnswers").trim()}</p>
            )}
            <button
              type="button"
              onClick={() => {
                if (!inFlight.current && isCurrent()) setConfirmErase(true);
              }}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-50"
            >
              <Trash2 className="size-4 text-destructive" aria-hidden />
              {t("privacy.erase")}
            </button>
            <ActionResult
              state={erased ? "saved" : null}
              text={t("privacy.erased")}
              onDismiss={() => setErased(false)}
            />
          </section>

          <ConfirmDialog
            open={confirmErase}
            onOpenChange={setConfirmErase}
            tone="danger"
            icon={Trash2}
            title={t("conta.privacy.eraseTitle")}
            consequences={[
              { tone: "danger", text: t("conta.privacy.eraseWhat"), key: "what" },
              { tone: "neutral", text: t("conta.privacy.eraseOff"), key: "off" },
              { tone: "success", text: t("conta.privacy.eraseKeeps"), key: "keeps" },
            ]}
            confirmLabel={t("conta.privacy.eraseConfirm")}
            confirmIcon={Trash2}
            cancelLabel={t("conta.privacy.eraseCancel")}
            onConfirm={erase}
          />
        </>
      )}
    </section>
  );
}
