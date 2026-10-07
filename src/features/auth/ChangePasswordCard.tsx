import { useId, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react";
import { ActionResult, IconTile, SectionHeader, type ActionState } from "@/components/visual";
import { PASSWORD_MIN, PasswordRules } from "@/features/auth/entry";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ChangePasswordCardProps = {
  className?: string;
  /** Começa recolhido numa linha "Senha ••••••" com o botão "Trocar senha" (ação rara). */
  collapsible?: boolean;
};

/** Campo de senha com o botão de olho (Mostrar/Ocultar) dentro. */
function PasswordField({
  id,
  label,
  value,
  onChange,
  disabled,
  describedBy,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={PASSWORD_MIN}
          autoComplete="new-password"
          autoFocus={autoFocus}
          value={value}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-border bg-background py-2 pe-12 ps-3"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 end-0 grid w-11 place-items-center rounded-xl text-muted-foreground transition hover:text-foreground"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordCard({ className, collapsible = false }: ChangePasswordCardProps) {
  const { t } = useI18n();
  const uid = useId();
  const rulesId = `${uid}-rules`;
  const [open, setOpen] = useState(!collapsible);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ state: ActionState; text: string } | null>(null);
  const valid = newPassword.length >= PASSWORD_MIN && newPassword === confirmPassword;

  async function changePassword(event?: React.FormEvent) {
    event?.preventDefault();
    if (!valid || busy) return;
    setResult(null);
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword("");
      setConfirmPassword("");
      setResult({ state: "saved", text: t("password.saved") });
      if (collapsible) setOpen(false);
    } catch (err) {
      setResult({ state: "error", text: friendlyAuthError(err, t("password.error")) });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex flex-wrap items-center gap-3">
          <IconTile icon={KeyRound} size="sm" />
          <p className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t("conta.password.label")}</span>
            <span aria-hidden className="block text-sm tracking-[0.2em] text-muted-foreground">
              ••••••
            </span>
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setResult(null);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40"
          >
            <KeyRound className="size-4" aria-hidden />
            {t("password.title")}
          </button>
        </div>
        <ActionResult
          state={result?.state}
          text={result?.text}
          onDismiss={() => setResult(null)}
          autoHideMs={6000}
        />
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void changePassword(event)}
      className={cn(collapsible ? "space-y-4" : "app-action-card space-y-4 p-4 sm:p-5", className)}
      aria-label={t("password.title")}
    >
      <SectionHeader icon={KeyRound} title={t("password.title")} as="h3" />
      <PasswordField
        id={`${uid}-new`}
        label={t("password.new")}
        value={newPassword}
        disabled={busy}
        describedBy={rulesId}
        autoFocus={collapsible}
        onChange={(value) => {
          setNewPassword(value);
          setResult(null);
        }}
      />
      <PasswordField
        id={`${uid}-confirm`}
        label={t("password.confirm")}
        value={confirmPassword}
        disabled={busy}
        describedBy={rulesId}
        onChange={(value) => {
          setConfirmPassword(value);
          setResult(null);
        }}
      />
      {/* Regras à vista enquanto digita: viram ✓ verde quando cumpridas. */}
      <PasswordRules id={rulesId} password={newPassword} confirm={confirmPassword} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || !valid}
          aria-busy={busy || undefined}
          className="action-button action-confirm flex-1 basis-48"
        >
          {busy ? (
            <Loader2 className="motion-safe:animate-spin" aria-hidden />
          ) : (
            <KeyRound aria-hidden />
          )}
          {busy ? t("common.saving") : t("password.save")}
        </button>
        {collapsible && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setNewPassword("");
              setConfirmPassword("");
              setResult(null);
            }}
            className="inline-flex min-h-11 flex-1 basis-32 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-50"
          >
            <X className="size-4" aria-hidden />
            {t("conta.password.keep")}
          </button>
        )}
      </div>
      <ActionResult
        state={result?.state}
        text={result?.text}
        onRetry={result?.state === "error" ? () => void changePassword() : undefined}
        onDismiss={() => setResult(null)}
        autoHideMs={6000}
      />
    </form>
  );
}
