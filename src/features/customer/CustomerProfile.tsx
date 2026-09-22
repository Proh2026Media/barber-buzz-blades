import { PrivacyCenter } from "@/features/insights/PrivacyCenter";
import { ChangePasswordCard } from "@/features/auth/ChangePasswordCard";
import { useEffect, useState } from "react";
import { LogOut, MessageCircle, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";

export function CustomerProfile({ onSaved }: { onSaved?: (name: string) => void }) {
  const demo = useDemo();
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
        if (authError || !data.user) throw new Error("Não foi possível consultar sua conta.");
        const result = await supabase
          .from("profiles")
          .select("full_name, whatsapp_e164, whatsapp_opt_in_at")
          .eq("id", data.user.id)
          .single();
        if (result.error) throw new Error("Não foi possível carregar seu perfil.");
        if (!cancelled) {
          setUserId(data.user.id);
          setName(result.data.full_name ?? "");
          setEmail(data.user.email ?? "");
          setWhatsapp(result.data.whatsapp_e164 ?? "");
          setWhatsappOptIn(Boolean(result.data.whatsapp_opt_in_at));
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

  async function saveWhatsApp(event: React.FormEvent) {
    event.preventDefault();
    if (demo) {
      setMessage("Na demonstração o WhatsApp fica só nesta sessão.");
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
      setMessage(
        whatsappOptIn
          ? "WhatsApp salvo. Você receberá avisos de horário neste número."
          : "Preferência de WhatsApp atualizada.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o WhatsApp.");
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

          <form
            onSubmit={(event) => void saveWhatsApp(event)}
            className="space-y-4 rounded-2xl border border-border bg-card p-4"
            aria-label="WhatsApp"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-gold" />
              <h3 className="text-sm font-semibold">WhatsApp</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Usamos este número só para avisos de horário e códigos de acesso da barbearia, quando
              você autorizar.
            </p>
            <label className="block space-y-2 text-sm font-semibold">
              <span>Número com DDD</span>
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
                <p className="text-sm font-semibold">Receber avisos por WhatsApp</p>
                <p className="text-xs text-muted-foreground">Confirmação, lembrete e remarcação.</p>
              </div>
              <Switch
                checked={whatsappOptIn}
                disabled={busy || (!demo && !userId)}
                onCheckedChange={setWhatsappOptIn}
                aria-label="Receber avisos por WhatsApp"
              />
            </div>
            <button
              type="submit"
              disabled={busy || (!demo && !userId)}
              className="w-full rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Salvando…" : "Salvar WhatsApp"}
            </button>
          </form>

          {!demo && <ChangePasswordCard />}

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
