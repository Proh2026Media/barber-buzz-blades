import { useState } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ChangePasswordCardProps = {
  className?: string;
};

export function ChangePasswordCard({ className }: ChangePasswordCardProps) {
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
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Senha atualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void changePassword(event)}
      className={`space-y-4 rounded-2xl border border-border bg-card p-4 ${className ?? ""}`}
      aria-label="Redefinir senha"
    >
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-gold" />
        <h3 className="text-sm font-semibold">Redefinir senha</h3>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Defina uma nova senha para esta conta. Mínimo de 6 caracteres.
      </p>
      <label className="block space-y-2 text-sm font-semibold">
        <span>Nova senha</span>
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
        <span>Confirmar nova senha</span>
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
        <KeyRound className="size-4" />
        {busy ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
