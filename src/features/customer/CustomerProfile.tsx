import { PrivacyCenter } from "@/features/insights/PrivacyCenter";
import { ChangePasswordCard } from "@/features/auth/ChangePasswordCard";
import { LanguageSettingsCard } from "@/components/LanguageSettingsCard";
import { useEffect, useState } from "react";
import { LogOut, MessageCircle, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { t as tNow, useI18n } from "@/lib/i18n";

export function CustomerProfile({ onSaved }: { onSaved?: (name: string) => void }) {
  const demo = useDemo();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (demo) {
          setName(demo.customerName);
          setEmail("cliente@demo.example");
          setWhatsapp("(11) 99999-0000");
          setWhatsappOptIn(true);
          return;
        }
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError || !data.user) throw new Error(tNow("profile.errorLoadAccount"));
        const result = await supabase
          .from("profiles")
          .select("full_name, whatsapp_e164, whatsapp_opt_in_at")
          .eq("id", data.user.id)
          .single();
        if (result.error) throw new Error(tNow("profile.errorLoad"));
        if (!cancelled) {
          setUserId(data.user.id);
          setName(result.data.full_name ?? "");
          setEmail(data.user.email ?? "");
          setWhatsapp(result.data.whatsapp_e164 ?? "");
          setWhatsappOptIn(Boolean(result.data.whatsapp_opt_in_at));
        }
      } catch (err) {
        if (!cancelled) setError(friendlyAuthError(err, tNow("profile.errorLoad")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [demo]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized || normalized.length > 100) {
      setError(t("profile.errorName"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      if (demo) demo.dispatch({ type: "profile.save", name: normalized });
      else {
        if (!userId) throw new Error(t("profile.errorNotLoaded"));
        const result = await supabase
          .from("profiles")
          .update({ full_name: normalized })
          .eq("id", userId)
          .select("id")
          .single();
        if (result.error) throw new Error(t("profile.errorSave"));
      }
      setName(normalized);
      onSaved?.(normalized);
      setMessage(t("profile.saved"));
    } catch (err) {
      setError(friendlyAuthError(err, t("profile.errorSave")));
    } finally {
      setBusy(false);
    }
  }

  async function saveWhatsApp(event: React.FormEvent) {
    event.preventDefault();
    if (demo) {
      setMessage(t("profile.whatsappDemo"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const { data, error: rpcError } = await supabase.rpc("save_my_whatsapp", {
        p_raw: whatsapp,
        p_opt_in: whatsappOptIn,
      });
      if (rpcError) throw rpcError;
      setWhatsapp(data?.whatsapp_e164 ?? whatsapp);
      setWhatsappOptIn(Boolean(data?.whatsapp_opt_in_at));
      setMessage(whatsappOptIn ? t("profile.whatsappSavedOptIn") : t("profile.whatsappSaved"));
    } catch (err) {
      setError(friendlyAuthError(err, t("profile.errorWhatsapp")));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (demo) {
      demo.exit();
      return;
    }
    setBusy(true);
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(t("profile.errorSignOut"));
      setBusy(false);
      return;
    }
    window.location.href = "/auth";
  }

  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold">{t("profile.title")}</h2>
      {loading ? (
        <p role="status">{t("profile.loading")}</p>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <User className="size-8 text-gold" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{t("profile.account")}</p>
              <p className="break-all text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <form onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <label className="block space-y-2 text-sm font-semibold">
              <span>{t("profile.fullName")}</span>
              <input
                required
                maxLength={100}
                autoComplete="name"
                value={name}
                disabled={busy || (!demo && !userId)}
                onChange={(event) => {
                  setName(event.target.value);
                  setMessage("");
                }}
                className="w-full rounded-xl border border-border bg-background px-3 py-2"
              />
            </label>
            <button
              disabled={busy || (!demo && !userId)}
              className="w-full rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? t("common.wait") : t("profile.save")}
            </button>
          </form>

          <form
            onSubmit={(event) => void saveWhatsApp(event)}
            className="space-y-4 rounded-2xl border border-border bg-card p-4"
            aria-label="WhatsApp"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-gold" aria-hidden="true" />
              <h3 className="text-sm font-semibold">WhatsApp</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("profile.whatsappHint")}
            </p>
            <label className="block space-y-2 text-sm font-semibold">
              <span>{t("profile.whatsappNumber")}</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-0000"
                value={whatsapp}
                disabled={busy || (!demo && !userId)}
                onChange={(event) => {
                  setWhatsapp(event.target.value);
                  setMessage("");
                }}
                className="w-full rounded-xl border border-border bg-background px-3 py-2"
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t("profile.whatsappOptIn")}</p>
                <p className="text-xs text-muted-foreground">{t("profile.whatsappOptInHint")}</p>
              </div>
              <Switch
                checked={whatsappOptIn}
                disabled={busy || (!demo && !userId)}
                onCheckedChange={setWhatsappOptIn}
                aria-label={t("profile.whatsappOptIn")}
              />
            </div>
            <button
              type="submit"
              disabled={busy || (!demo && !userId)}
              className="w-full rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? t("common.saving") : t("profile.saveWhatsapp")}
            </button>
          </form>

          <LanguageSettingsCard />

          {!demo && <ChangePasswordCard />}

          <PrivacyCenter />
          <button
            type="button"
            disabled={busy}
            onClick={() => void signOut()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border p-3 text-sm"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {demo ? t("profile.exitDemo") : t("profile.signOut")}
          </button>
        </>
      )}
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
    </section>
  );
}
