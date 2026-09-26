import { useState } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n } from "@/lib/i18n";

type ChangePasswordCardProps = {
  className?: string;
};

export function ChangePasswordCard({ className }: ChangePasswordCardProps) {
  const { t } = useI18n();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage("");
    if (newPassword.length < 6) {
      setError(t("errors.passwordShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("auth.error.passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword("");
      setConfirmPassword("");
      setMessage(t("password.saved"));
    } catch (err) {
      setError(friendlyAuthError(err, t("password.error")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void changePassword(event)}
      className={`space-y-4 rounded-2xl border border-border bg-card p-4 ${className ?? ""}`}
      aria-label={t("password.title")}
    >
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-gold" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{t("password.title")}</h3>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("password.hint")}</p>
      <label className="block space-y-2 text-sm font-semibold">
        <span>{t("password.new")}</span>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={newPassword}
          disabled={busy}
          onChange={(event) => {
            setNewPassword(event.target.value);
            setMessage("");
            setError(null);
          }}
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="block space-y-2 text-sm font-semibold">
        <span>{t("password.confirm")}</span>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirmPassword}
          disabled={busy}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setMessage("");
            setError(null);
          }}
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
        />
      </label>
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
      <button
        type="submit"
        disabled={busy}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        <KeyRound className="size-4" aria-hidden="true" />
        {busy ? t("common.saving") : t("password.save")}
      </button>
    </form>
  );
}
