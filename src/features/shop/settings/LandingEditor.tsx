import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Copy, ExternalLink, Eye, Loader2, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";
import { useDemo } from "@/features/demo/context";
import { ShopLandingView } from "@/features/marketing/ShopLanding";
import {
  LANDING_LIMITS,
  cleanLandingConfig,
  parseLandingConfig,
  parseLandingData,
  validateLandingConfig,
  type LandingConfig,
  type LandingData,
  type LandingProblem,
} from "@/features/marketing/shop-landing";

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal";

const PROBLEM_KEY: Record<LandingProblem, MessageKey> = {
  length: "landingEditor.problem.length",
  instagram: "landingEditor.problem.instagram",
  whatsapp: "landingEditor.problem.whatsapp",
};

const TOGGLES = [
  { key: "show_today", label: "landingEditor.showToday", hint: "landingEditor.showTodayHint" },
  { key: "show_staff", label: "landingEditor.showStaff", hint: "landingEditor.showStaffHint" },
  {
    key: "show_services",
    label: "landingEditor.showServices",
    hint: "landingEditor.showServicesHint",
  },
  { key: "show_hours", label: "landingEditor.showHours", hint: "landingEditor.showHoursHint" },
] as const satisfies ReadonlyArray<{
  key: keyof LandingConfig;
  label: MessageKey;
  hint: MessageKey;
}>;

export function LandingEditor({
  shopId,
  shopSlug,
  publicUrl,
  settings,
  onSaved,
}: {
  shopId: string;
  shopSlug: string;
  publicUrl: string;
  settings: Tables<"barbershop_settings">;
  onSaved: (settings: Tables<"barbershop_settings">) => void;
}) {
  const { t } = useI18n();
  const demo = useDemo();
  const saved = useMemo(() => parseLandingConfig(settings.landing), [settings.landing]);
  const [draft, setDraft] = useState<LandingConfig>(saved);
  const [base, setBase] = useState<LandingData | null>(null);
  const [view, setView] = useState<"editar" | "previa">("editar");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (demo) {
      setBase({
        shop: {
          id: demo.shop.id,
          name: demo.shop.name,
          slug: demo.shop.slug,
          timezone: demo.shop.timezone,
          display_name: settings.display_name,
          tagline: settings.tagline,
          logo_url: settings.logo_url,
          logo_background_color: settings.logo_background_color,
          font_family: settings.font_family,
          custom_font_url: settings.custom_font_url,
          header_font_weight: settings.header_font_weight,
          header_font_style: settings.header_font_style,
          corner_style: settings.corner_style,
          primary_color: settings.primary_color,
          accent_color: settings.accent_color,
          hero_image_url: settings.login_image_url,
        },
        landing: saved,
        hours: demo.businessHours.map((row) => ({
          weekday: row.weekday,
          is_open: row.is_open,
          opens_at: row.opens_at.slice(0, 5),
          closes_at: row.closes_at.slice(0, 5),
        })),
        today: {
          date: "",
          weekday: demo.now.getDay(),
          is_open: true,
          opens_at: "09:00",
          closes_at: "19:00",
        },
        staff: demo.staff
          .filter((row) => row.active)
          .map((row) => ({
            name: row.display_name,
            bio: row.bio ?? "",
            avatar_url: row.avatar_url ?? null,
            booking_slug: row.booking_slug,
            free_today: ["10:00", "11:30", "15:00"],
          })),
        services: demo.services
          .filter((row) => row.active)
          .map((row) => ({
            name: row.name,
            description: row.description ?? "",
            duration_minutes: row.duration_minutes,
            price_cents: row.price_cents,
          })),
      });
      return;
    }
    let active = true;
    void supabase.rpc("get_public_shop_landing", { p_shop_ref: shopId }).then(({ data }) => {
      if (active) setBase(parseLandingData(data));
    });
    return () => {
      active = false;
    };
    // A prévia usa a marca salva; só recarrega quando a loja muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo ? null : shopId]);

  const problem = validateLandingConfig(draft);
  const dirty = JSON.stringify(cleanLandingConfig(draft)) !== JSON.stringify(saved);
  const previewData = useMemo(() => {
    if (!base) return null;
    const showToday = draft.enabled && draft.show_today;
    return {
      ...base,
      landing: draft,
      staff: base.staff.map((member) => ({
        ...member,
        free_today: showToday ? member.free_today : [],
      })),
    };
  }, [base, draft]);

  function update<K extends keyof LandingConfig>(key: K, value: LandingConfig[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setError(null);
    const landing = cleanLandingConfig(draft);
    if (demo) {
      const next = { ...settings, landing, updated_at: new Date().toISOString() };
      demo.dispatch({ type: "settings.save", settings: next });
      onSaved(next);
    } else {
      const { data, error: updateError } = await supabase
        .from("barbershop_settings")
        .update({ landing })
        .eq("barbershop_id", shopId)
        .select("*")
        .single();
      if (updateError || !data) {
        setError(friendlyAuthError(updateError, t("landingEditor.saveError")));
        setBusy(false);
        return;
      }
      onSaved(data);
    }
    setDraft(landing);
    setBusy(false);
    toast.success(t("landingEditor.saved"));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("landingEditor.copyError"));
    }
  }

  const counter = (value: string, max: number) => (
    <span className="block text-right text-[11px] font-normal text-muted-foreground">
      {value.length}/{max}
    </span>
  );

  return (
    <div className="space-y-4">
      {demo ? (
        <p className="rounded-2xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t("landingEditor.demoOpen")}
        </p>
      ) : (
        <div className="space-y-2 rounded-2xl border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">{t("landingEditor.linkHint")}</p>
          <p className="break-all text-sm font-semibold">{publicUrl}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-xs font-bold"
            >
              {copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {t(copied ? "landingEditor.copied" : "landingEditor.copy")}
            </button>
            <a
              href={`/b/${shopSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-xs font-bold"
            >
              <ExternalLink className="size-4" aria-hidden />
              {t("landingEditor.open")}
            </a>
          </div>
        </div>
      )}

      <div
        className="grid grid-cols-2 gap-2 lg:hidden"
        role="tablist"
        aria-label={t("landingEditor.viewLabel")}
      >
        {(["editar", "previa"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={view === option}
            onClick={() => setView(option)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold ${
              view === option
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card"
            }`}
          >
            {option === "editar" ? (
              <PencilLine className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
            {t(option === "editar" ? "landingEditor.tabEdit" : "landingEditor.tabPreview")}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={save} className={`space-y-4 ${view === "editar" ? "" : "hidden lg:block"}`}>
          <label className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <span>
              <span className="block text-sm font-bold">{t("landingEditor.enabled")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("landingEditor.enabledHint")}
              </span>
            </span>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(value) => update("enabled", value)}
              aria-label={t("landingEditor.enabled")}
            />
          </label>

          <fieldset
            disabled={!draft.enabled}
            className="space-y-3 rounded-2xl border border-border bg-card p-4 disabled:opacity-60"
          >
            <legend className="px-1 text-sm font-bold">{t("landingEditor.textsTitle")}</legend>
            <label className="block space-y-1 text-xs font-semibold">
              {t("landingEditor.headline")}
              <input
                value={draft.headline}
                maxLength={LANDING_LIMITS.headline}
                placeholder={settings.tagline || t("shopLanding.defaultHeadline")}
                onChange={(e) => update("headline", e.target.value)}
                className={fieldClass}
              />
              {counter(draft.headline, LANDING_LIMITS.headline)}
            </label>
            <label className="block space-y-1 text-xs font-semibold">
              {t("landingEditor.about")}
              <textarea
                value={draft.about}
                maxLength={LANDING_LIMITS.about}
                rows={4}
                placeholder={t("landingEditor.aboutPlaceholder")}
                onChange={(e) => update("about", e.target.value)}
                className={`${fieldClass} resize-y`}
              />
              {counter(draft.about, LANDING_LIMITS.about)}
            </label>
            <label className="block space-y-1 text-xs font-semibold">
              {t("landingEditor.address")}
              <input
                value={draft.address}
                maxLength={LANDING_LIMITS.address}
                placeholder={t("landingEditor.addressPlaceholder")}
                onChange={(e) => update("address", e.target.value)}
                className={fieldClass}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs font-semibold">
                {t("landingEditor.whatsapp")}
                <input
                  type="tel"
                  inputMode="tel"
                  value={draft.whatsapp}
                  maxLength={20}
                  placeholder="(11) 99999-0000"
                  onChange={(e) => update("whatsapp", e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold">
                {t("landingEditor.instagram")}
                <input
                  value={draft.instagram}
                  maxLength={31}
                  placeholder="@suabarbearia"
                  autoCapitalize="none"
                  onChange={(e) => update("instagram", e.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("landingEditor.photoHint")}</p>
          </fieldset>

          <fieldset
            disabled={!draft.enabled}
            className="space-y-2 rounded-2xl border border-border bg-card p-4 disabled:opacity-60"
          >
            <legend className="px-1 text-sm font-bold">{t("landingEditor.blocksTitle")}</legend>
            {TOGGLES.map((toggle) => (
              <label
                key={toggle.key}
                className="flex items-start justify-between gap-3 rounded-xl p-2"
              >
                <span>
                  <span className="block text-sm font-semibold">{t(toggle.label)}</span>
                  <span className="block text-xs text-muted-foreground">{t(toggle.hint)}</span>
                </span>
                <Switch
                  checked={draft[toggle.key]}
                  disabled={!draft.enabled}
                  onCheckedChange={(value) => update(toggle.key, value)}
                  aria-label={t(toggle.label)}
                />
              </label>
            ))}
          </fieldset>

          {problem && (
            <p className="text-sm font-semibold text-destructive" role="alert">
              {t(PROBLEM_KEY[problem])}
            </p>
          )}
          {error && (
            <p className="text-sm font-semibold text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={!dirty || busy}
              onClick={() => {
                setDraft(saved);
                setError(null);
              }}
              className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold disabled:opacity-50"
            >
              {t("landingEditor.discard")}
            </button>
            <button
              type="submit"
              disabled={!dirty || busy || Boolean(problem)}
              className="action-button action-confirm"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("landingEditor.save")}
            </button>
          </div>
        </form>

        <section
          aria-label={t("landingEditor.previewLabel")}
          className={view === "previa" ? "" : "hidden lg:block"}
        >
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            {t(demo ? "landingEditor.previewHintDemo" : "landingEditor.previewHint")}
          </p>
          <div className="relative max-h-[70dvh] overflow-y-auto rounded-2xl border border-border shadow-sm">
            {previewData ? (
              <ShopLandingView data={previewData} preview />
            ) : (
              <p
                className="flex items-center gap-2 p-4 text-sm text-muted-foreground"
                role="status"
              >
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("landingEditor.previewLoading")}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
