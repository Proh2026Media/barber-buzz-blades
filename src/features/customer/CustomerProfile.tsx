import { PrivacyCenter } from "@/features/insights/PrivacyCenter";
import { useEffect, useState } from "react";
import { KeyRound, LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";

export function CustomerProfile({ onSaved }: { onSaved?: (name: string) => void }) {
  const demo = useDemo();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (demo) {
          setName(demo.customerName);
          setEmail("cliente@demo.example");
          return;
        }
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError || !data.user) throw new Error("Não foi possível consultar sua conta.");
        const result = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.user.id)
          .single();
        if (result.error) throw new Error("Não foi possível carregar seu perfil.");
        if (!cancelled) {
          setUserId(data.user.id);
          setName(result.data.full_name ?? "");
          setEmail(data.user.email ?? "");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar perfil.");
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
      setError("Informe um nome de até 100 caracteres.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      if (demo) demo.dispatch({ type: "profile.save", name: normalized });
      else {
        if (!userId) throw new Error("Sua conta não foi carregada. Abra o perfil novamente.");
        const result = await supabase
          .from("profiles")
          .update({ full_name: normalized })
          .eq("id", userId)
          .select("id")
          .single();
        if (result.error) throw new Error("Não foi possível salvar. Tente novamente.");
      }
      setName(normalized);
      onSaved?.(normalized);
      setMessage("Perfil atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
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
      setError("Não foi possível sair. Tente novamente.");
      setBusy(false);
      return;
    }
    window.location.href = "/auth";
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (demo) return;
    setPasswordError(null);
    setPasswordMessage("");
    if (newPassword.length < 6) {
      setPasswordError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    setPasswordBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Senha atualizada.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Não foi possível atualizar a senha.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold">Meu perfil</h2>
      {loading ? (
        <p role="status">Carregando perfil…</p>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <User className="size-8 text-gold" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Conta de acesso</p>
              <p className="break-all text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <form onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <label className="block space-y-2 text-sm font-semibold">
              <span>Nome completo</span>
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
              {busy ? "Aguarde…" : "Salvar perfil"}
            </button>
          </form>

          {!demo && (
            <form
              onSubmit={(event) => void changePassword(event)}
              className="space-y-4 rounded-2xl border border-border bg-card p-4"
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
                  disabled={passwordBusy}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setPasswordMessage("");
                    setPasswordError(null);
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
                  disabled={passwordBusy}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setPasswordMessage("");
                    setPasswordError(null);
                  }}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
              {passwordError && (
                <p role="alert" className="text-sm text-destructive">
                  {passwordError}
                </p>
              )}
              {passwordMessage && (
                <p role="status" className="text-sm">
                  {passwordMessage}
                </p>
              )}
              <button
                type="submit"
                disabled={passwordBusy}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <KeyRound className="size-4" />
                {passwordBusy ? "Salvando…" : "Salvar nova senha"}
              </button>
            </form>
          )}

          <PrivacyCenter />
          <button
            type="button"
            disabled={busy}
            onClick={() => void signOut()}
            className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm"
          >
            <LogOut className="size-4" />
            {demo ? "Sair da demonstração" : "Sair da conta"}
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
