import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Loader2,
  Scissors,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import { ChoiceCards, CopyField, Hint, Notice, Steps } from "@/components/visual";
import { LegalDocLinks, LinkPill, ResultHero, SharePie } from "@/features/auth/entry";
import { guardedFetch } from "@/lib/demo-guard";
import { useAuthSession } from "@/lib/auth/use-auth-session";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { DEFAULT_LOGIN_IMAGE } from "@/lib/shop/branding";
import { shopPublicOrigin } from "@/lib/shop/host";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { DPA_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/features/legal/versions";
import { slugifyShopName } from "@/features/register-owner/owner-signup";
import { clockInTimeZone, detectDeviceTimeZone } from "@/features/register-owner/timezones";
import { TimeZoneSelect } from "@/features/register-owner/TimeZonePicker";
import { useTimeZoneName } from "@/features/register-owner/timezone-name";
import { readShopDraft, saveShopDraft, clearShopDraft } from "@/features/register-owner/shop-draft";

export const Route = createFileRoute("/cadastrar")({ ssr: false, component: CadastrarPage });

function CadastrarPage() {
  const { t } = useI18n();
  const { session, currentSession, loading } = useAuthSession();
  const [draft] = useState(() => readShopDraft());
  const [shopName, setShopName] = useState(draft?.name ?? "");
  const [detectedTimeZone] = useState(() => detectDeviceTimeZone());
  const [timeZone, setTimeZone] = useState(draft?.timezone ?? detectedTimeZone);
  const [timeZoneOpen, setTimeZoneOpen] = useState(false);
  const [hasSociety, setHasSociety] = useState(draft ? draft.society !== "single" : false);
  const [societyType, setSocietyType] = useState<"majority" | "equal" | "minority">(
    draft?.society && draft.society !== "single" ? draft.society : "majority",
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ slug: string; member: string; name: string } | null>(
    null,
  );
  const pending = useRef(false);
  const alive = useRef(true);
  const request = useRef(draft?.request ?? null);
  const timeZoneName = useTimeZoneName();
  const zoneName = timeZoneName(timeZone);
  const previewSlug = shopName.trim() ? slugifyShopName(shopName) : "";
  const userId = session?.user.id;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setTermsAccepted(false);
    setCreated(null);
    setError(null);
  }, [userId]);

  useEffect(() => {
    if (created) document.getElementById("cad-result-title")?.focus();
  }, [created]);

  function remember() {
    saveShopDraft({
      name: shopName,
      timezone: timeZone,
      society: hasSociety ? societyType : "single",
      request: request.current,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending.current || loading) return;
    if (!shopName.trim()) {
      setError(t("cad.dono.errShopName"));
      document.getElementById("cad-shopName")?.focus();
      return;
    }
    const active = currentSession.current;
    if (!active) {
      remember();
      window.location.assign("/auth?next=%2Fcadastrar");
      return;
    }
    if (!termsAccepted) {
      setError(t("cad.dono.errTerms"));
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    // Mesmo pedido em nova tentativa/recarga: a RPC nunca duplica a barbearia.
    if (!request.current || request.current.userId !== active.user.id)
      request.current = { userId: active.user.id, id: crypto.randomUUID() };
    remember();
    try {
      const response = await guardedFetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/register_my_barbershop`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
            Authorization: `Bearer ${active.access_token}`,
          },
          body: JSON.stringify({
            p_request_id: request.current.id,
            p_name: shopName.trim(),
            p_timezone: timeZone,
            p_society_intent: hasSociety ? societyType : "single",
            p_terms_accepted: termsAccepted,
            p_terms_version: TERMS_VERSION,
            p_privacy_version: PRIVACY_VERSION,
            p_dpa_version: DPA_VERSION,
          }),
        },
      );
      const result = await response.json();
      if (!alive.current || currentSession.current?.user.id !== active.user.id) return;
      if (!response.ok) {
        if (result.code === "PGRST202" || response.status === 404)
          throw new Error(t("register.account.unavailable"));
        throw result;
      }
      if (!result.shop_slug || !result.member_id) throw new Error(t("register.errorIncomplete"));
      clearShopDraft();
      request.current = null;
      setCreated({ slug: result.shop_slug, member: result.member_id, name: result.shop_name });
    } catch (err) {
      if (alive.current && currentSession.current?.user.id === active.user.id)
        setError(friendlyAuthError(err, t("register.errorCreate")));
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function switchAccount() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    remember();
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      if (alive.current) setError(friendlyAuthError(err));
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return (
    <main className="platform-register mb-page min-h-dvh text-foreground">
      <div className="platform-register-photo" aria-hidden="true">
        <img src={DEFAULT_LOGIN_IMAGE} alt="" />
        <span />
      </div>
      <div className="platform-register-stage">
        <div className="platform-register-top">
          <Link to="/" className="platform-register-back">
            <ArrowLeft className="size-4" />
            {t("entry.back.home")}
          </Link>
          <LanguageSwitcher buttonClassName="app-icon-button hero-icon-button" />
        </div>
        <div className="entry-cad-layout">
          <aside className="entry-cad-aside" aria-label={t("entry.cad.summaryTitle")}>
            <p className="text-3xl font-extrabold leading-tight tracking-tight text-[#faf8f4]">
              {t("register.subtitle")}
            </p>
            <div className="entry-result-card grid gap-3 p-4">
              <Store className="size-7 text-gold" aria-hidden="true" />
              <p className="text-lg font-bold">{shopName.trim() || t("entry.cad.summaryEmpty")}</p>
              <p className="text-sm text-muted-foreground">{t("register.account.after")}</p>
            </div>
          </aside>
          <div className="platform-register-panel">
            <div className="platform-register-brand">
              <span className="platform-landing-mark" aria-hidden="true">
                <Scissors className="size-5" />
              </span>
              <p className="platform-register-brand-name">Barba &amp; Cabelo</p>
            </div>
            <Steps
              label={t("entry.cad.stepsLabel")}
              steps={[
                {
                  key: "account",
                  label: t("entry.cad.step.access"),
                  status: session ? "done" : "current",
                },
                {
                  key: "shop",
                  label: t("entry.cad.step.shop"),
                  status: created ? "done" : session ? "current" : "upcoming",
                },
                {
                  key: "done",
                  label: t("register.step.done"),
                  status: created ? "done" : "upcoming",
                },
              ]}
            />
            {!created ? (
              <>
                <h1 className="platform-register-title">{t("entry.cad.shopTitle")}</h1>
                <p className="text-sm text-muted-foreground">{t("register.account.lead")}</p>
                <form onSubmit={submit} className="platform-register-form">
                  <fieldset
                    disabled={busy || loading}
                    className="m-0 grid min-w-0 gap-5 border-0 p-0"
                  >
                    <div className="grid gap-1.5">
                      <label className="platform-register-label" htmlFor="cad-shopName">
                        {t("register.shopName")}
                      </label>
                      <input
                        id="cad-shopName"
                        maxLength={120}
                        aria-describedby={previewSlug ? "cad-shopName-link" : undefined}
                        required
                        value={shopName}
                        onChange={(e) => {
                          setShopName(e.target.value);
                          setError(null);
                        }}
                        className="platform-register-input"
                        placeholder={t("register.shopNamePlaceholder")}
                      />

                      {previewSlug && (
                        <LinkPill
                          id="cad-shopName-link"
                          url={shopPublicOrigin({ slug: previewSlug })}
                          label={t("entry.cad.linkLabel")}
                          note={t("entry.cad.linkNote", { slug: `${previewSlug}-2` })}
                        />
                      )}
                    </div>

                    <div className="grid gap-1.5">
                      <p className="platform-register-label">{t("entry.cad.clockLabel")}</p>
                      <div
                        id="cad-timezone-summary"
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white px-3 py-1.5 text-sm"
                        aria-live="polite"
                      >
                        <Clock className="size-4 shrink-0 text-gold" aria-hidden="true" />
                        <span className="font-bold tabular-nums">{clockInTimeZone(timeZone)}</span>
                        <span className="min-w-0 flex-1 text-muted-foreground">{zoneName}</span>
                        {!timeZoneOpen && (
                          <button
                            type="button"
                            aria-expanded={false}
                            aria-controls="cad-timezone"
                            aria-label={`${t("entry.cad.change")}: ${t("dec.tz.label")}`}
                            onClick={() => {
                              setTimeZoneOpen(true);
                              // O botão some ao abrir: leva o foco para o seletor, sem perdê-lo.
                              window.requestAnimationFrame(() =>
                                document.getElementById("cad-timezone")?.focus(),
                              );
                            }}
                            className="entry-link-button -me-1"
                          >
                            {t("entry.cad.change")}
                          </button>
                        )}
                      </div>
                      {timeZoneOpen && (
                        <div className="grid gap-1.5">
                          <label className="platform-register-label" htmlFor="cad-timezone">
                            {t("dec.tz.label")}
                          </label>
                          <TimeZoneSelect
                            id="cad-timezone"
                            value={timeZone}
                            onChange={setTimeZone}
                            keep={[detectedTimeZone]}
                            describedBy="cad-timezone-hint"
                            className="platform-register-input"
                          />
                          <p id="cad-timezone-hint" className="m-0 text-xs text-muted-foreground">
                            {t("dec.tz.signupHint", { time: clockInTimeZone(timeZone) })}
                          </p>
                        </div>
                      )}
                    </div>

                    <ChoiceCards
                      legend={t("entry.cad.ownersLegend")}
                      showLegend
                      columns={2}
                      value={hasSociety ? "partners" : "solo"}
                      onChange={(value) => setHasSociety(value === "partners")}
                      options={[
                        {
                          value: "solo",
                          title: t("entry.cad.solo"),
                          description: t("entry.cad.soloText"),
                          icon: UserRound,
                        },
                        {
                          value: "partners",
                          title: t("entry.cad.partners"),
                          description: t("entry.cad.partnersText"),
                          icon: Users,
                        },
                      ]}
                    />
                    {hasSociety && (
                      <div id="cad-society-options" className="grid gap-2">
                        <ChoiceCards
                          legend={t("entry.cad.splitLegend")}
                          showLegend
                          columns={1}
                          value={societyType}
                          onChange={setSocietyType}
                          options={(
                            [
                              ["majority", 0.7, "entry.cad.majority", "entry.cad.majorityText"],
                              ["equal", 0.5, "entry.cad.equal", "entry.cad.equalText"],
                              ["minority", 0.3, "entry.cad.minority", "entry.cad.minorityText"],
                            ] as const
                          ).map(([value, share, title, text]) => ({
                            value,
                            title: t(title),
                            description: t(text),
                            media: <SharePie share={share} />,
                          }))}
                        />
                        <Hint icon={Users}>{t("entry.cad.inviteLater")}</Hint>
                      </div>
                    )}

                    {session ? (
                      <>
                        <Notice
                          tone="info"
                          icon={UserRound}
                          title={t("entry.cad.signedInAs", { email: session.user.email ?? "" })}
                          action={{
                            label: t("entry.cad.useOther"),
                            onClick: () => void switchAccount(),
                            disabled: busy,
                          }}
                        />
                        <label className="flex items-start gap-3 text-sm" htmlFor="cad-terms">
                          <input
                            id="cad-terms"
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            className="mt-1 size-5 shrink-0"
                          />
                          <span>{t("register.account.terms")}</span>
                        </label>
                        <LegalDocLinks withDpa />
                      </>
                    ) : (
                      <Notice tone="info" title={t("register.account.signin")}>
                        {t("register.account.signinHint")}
                      </Notice>
                    )}
                    {error && <Notice tone="danger" title={error} />}
                    <button
                      type="submit"
                      disabled={busy || loading}
                      className="action-button action-confirm entry-submit"
                    >
                      {busy || loading ? (
                        <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
                      ) : (
                        <ArrowRight aria-hidden="true" />
                      )}
                      {busy
                        ? t("register.creating")
                        : session
                          ? t("entry.cad.openWithAccount")
                          : t("register.account.signin")}
                    </button>
                  </fieldset>
                </form>
              </>
            ) : (
              <section className="grid gap-5">
                <ResultHero id="cad-result-title" tone="success" title={t("cad.dono.doneTitle")}>
                  {created.name}
                </ResultHero>
                <CopyField
                  value={shopPublicOrigin({ slug: created.slug })}
                  label={t("cad.dono.yourLink")}
                  shareTitle={shopName}
                />
                <Notice tone="info" title={t("register.account.after")} />
                <Link
                  to="/shop"
                  search={{ unidade: created.member }}
                  className="action-button action-confirm entry-submit"
                >
                  {t("cad.dono.openPanel")}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
