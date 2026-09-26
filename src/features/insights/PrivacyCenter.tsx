import { DataRights } from "./DataRights";
import { SurveyCatalog } from "./SurveyCatalog";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { t as tNow, useI18n } from "@/lib/i18n";
import { defaultPrivacy, questions, type PrivacyPreferences, type Survey } from "./model";

export function PrivacyCenter() {
  const demo = useDemo();
  const { t, intlLocale } = useI18n();
  const [preferences, setPreferences] = useState<PrivacyPreferences>(defaultPrivacy);
  const [responses, setResponses] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  const [confirmErase, setConfirmErase] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (demo) {
      setPreferences(demo.privacy);
      setResponses(demo.surveys);
      setLoading(false);
      return;
    }
    setLoading(true);
    void supabase.rpc("get_my_privacy").then(({ data, error: failure }) => {
      if (cancelled) return;
      if (failure) setError(tNow("privacy.errorLoad"));
      else {
        const value = data as unknown as { preferences: PrivacyPreferences; responses: Survey[] };
        setPreferences(value.preferences);
        setResponses(value.responses);
        setError("");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [demo, version]);

  async function save(erase = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (demo)
        demo.dispatch(erase ? { type: "privacy.erase" } : { type: "privacy.save", preferences });
      else {
        const result = erase
          ? await supabase.rpc("erase_my_optional_data")
          : await supabase.rpc("save_my_privacy", {
              p_analytics: preferences.analytics,
              p_surveys: preferences.surveys,
              p_marketing: preferences.marketing,
            });
        if (result.error) throw result.error;
      }
      if (erase) {
        setPreferences(defaultPrivacy);
        setResponses([]);
        setConfirmErase(false);
      }
      setMessage(erase ? t("privacy.erased") : t("privacy.saved"));
    } catch {
      setError(t("privacy.errorSave"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label={t("privacy.title")}
      className="space-y-4 rounded-2xl border border-primary/20 bg-card p-4"
    >
      <h3 className="flex items-center gap-2 font-bold">
        <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
        {t("privacy.title")}
      </h3>
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
      </div>
      {loading ? (
        <p role="status" className="text-sm">
          {t("privacy.loading")}
        </p>
      ) : (
        <>
          {(
            [
              ["analytics", t("privacy.analytics"), t("privacy.analyticsHint")],
              ["surveys", t("privacy.surveys"), t("privacy.surveysHint")],
              ["marketing", t("privacy.marketing"), t("privacy.marketingHint")],
            ] as const
          ).map(([key, label, description]) => (
            <label
              key={key}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background/60 p-3"
            >
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
              </span>
              <Switch
                aria-label={label}
                checked={preferences[key]}
                disabled={busy || !!error}
                onCheckedChange={(checked) => {
                  setPreferences((current) => ({ ...current, [key]: checked }));
                  setMessage("");
                }}
              />
            </label>
          ))}
          <button
            type="button"
            disabled={busy || !!error}
            onClick={() => void save()}
            className="min-h-11 w-full rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? t("common.saving") : t("privacy.save")}
          </button>
          <SurveyCatalog compact />
          <section
            aria-label={t("privacy.myAnswers")}
            className="rounded-xl border border-border bg-background/60 p-4 text-sm"
          >
            <h4 className="font-semibold">{t("privacy.myAnswers")}</h4>
            {!responses.some((row) => row.state === "answered") && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {t("privacy.noAnswers")}
                {demo && t("privacy.demoAnswers")}
              </p>
            )}
            <div className="mt-3 space-y-3">
              {responses
                .filter((row) => row.state === "answered")
                .map((row) => (
                  <div key={row.id}>
                    <p>{questions[row.question]?.title}</p>
                    {row.source === "shop_staff" && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {t("privacy.toldStaff")}
                      </p>
                    )}
                    {row.appointment_starts_at && (
                      <p className="text-xs text-muted-foreground">
                        {t("privacy.appointmentOf", {
                          date: new Date(row.appointment_starts_at).toLocaleString(intlLocale, {
                            dateStyle: "short",
                            timeStyle: "short",
                          }),
                        })}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {(questions[row.question]?.options as Record<string, string>)?.[
                        row.answer ?? ""
                      ] ?? t("privacy.notInformed")}
                    </p>
                  </div>
                ))}
            </div>
          </section>
          <DataRights />
          <button
            type="button"
            onClick={() => setConfirmErase(true)}
            disabled={busy}
            className="min-h-11 text-xs text-destructive underline"
          >
            {t("privacy.erase")}
          </button>
          {confirmErase && (
            <div className="space-y-3 rounded-xl border border-destructive/30 p-3 text-xs">
              <p>{t("privacy.eraseConfirmText")}</p>
              <div className="flex gap-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save(true)}
                  className="min-h-11 font-bold text-destructive"
                >
                  {t("privacy.eraseConfirm")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmErase(false)}
                  className="min-h-11"
                >
                  {t("common.back")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {error && (
        <div role="alert" className="text-xs text-destructive">
          {error}{" "}
          <button
            type="button"
            onClick={() => {
              setError("");
              setVersion((v) => v + 1);
            }}
            className="min-h-11 underline"
          >
            {t("common.retry")}
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </section>
  );
}
