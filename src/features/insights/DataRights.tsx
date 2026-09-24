import { useEffect, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";

export type PrivacyRequest = {
  id: string;
  user_id: string;
  status: "requested" | "reviewing" | "cancelled";
  created_at: string;
  updated_at: string;
};

export function DataRights({ admin = false }: { admin?: boolean }) {
  const demo = useDemo();
  const [rows, setRows] = useState<PrivacyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!admin) {
      setRows([]);
      setLoading(false);
      return;
    }
    if (demo) {
      setRows(demo.privacyRequests.filter((row) => row.status !== "cancelled"));
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const { data, error: failure } = await supabase.rpc("list_privacy_requests", {
          p_admin: true,
        });
        if (cancelled) return;
        if (failure) {
          setError("Não foi possível consultar os pedidos.");
        } else {
          setRows(Array.isArray(data) ? (data as unknown as PrivacyRequest[]) : []);
          setError("");
        }
      } catch {
        if (cancelled) return;
        setError("Não foi possível consultar os pedidos.");
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, admin, version]);

  async function downloadData() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let data: unknown;
      if (demo) {
        const appointments = demo.appointments.filter((row) => row.customer_id === demo.customerId);
        data = {
          format_version: 1,
          environment: "demo",
          exported_at: new Date().toISOString(),
          profile: { id: demo.customerId, name: demo.customerName },
          appointments,
          privacy: demo.privacy,
          responses: demo.surveys,
          requests: demo.privacyRequests,
          points: demo.points,
          prices: Object.fromEntries(appointments.map((row) => [row.id, demo.prices[row.id]])),
        };
      } else {
        const result = await supabase.rpc("export_my_data");
        if (result.error) throw result.error;
        data = result.data;
      }
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Arquivo preparado. Confira os downloads do navegador.");
    } catch {
      setError("Não foi possível concluir a operação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccountForever() {
    if (busy || confirmText.trim().toUpperCase() !== "EXCLUIR") return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (demo) {
        demo.dispatch({ type: "privacy.erase" });
        setConfirm(false);
        setConfirmText("");
        setMessage("Na demonstração, dados opcionais foram limpos. Em produção a conta seria apagada.");
        return;
      }
      const result = await supabase.rpc("delete_my_account");
      if (result.error) throw result.error;
      await supabase.auth.signOut();
      window.location.assign("/");
    } catch (err) {
      const detail =
        err && typeof err === "object" && "message" in err && typeof err.message === "string"
          ? err.message
          : "Não foi possível excluir a conta. Tente novamente.";
      setError(detail);
    } finally {
      setBusy(false);
    }
  }

  async function adminUpdate(action: "reviewing" | "cancelled", id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (demo) {
        demo.dispatch({ type: "privacy.request", status: action, id });
      } else {
        const result = await supabase.rpc("update_privacy_request", {
          p_id: id,
          p_status: action,
        });
        if (result.error) throw result.error;
      }
      setVersion((v) => v + 1);
      setMessage("Pedido atualizado.");
    } catch {
      setError("Não foi possível concluir a operação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={admin ? "Pedidos de privacidade" : "Acesso e exclusão dos meus dados"}
      className="space-y-4 rounded-2xl border border-border bg-card p-4"
    >
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="size-5 text-primary" />
        {admin ? "Pedidos de privacidade" : "Seus dados, suas escolhas"}
      </h3>

      {!admin && (
        <>
          <p className="text-xs text-muted-foreground">
            Baixe uma cópia dos dados da sua conta, reservas, pontos e escolhas de privacidade.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void downloadData()}
            className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-3 text-sm font-semibold text-primary disabled:opacity-50"
          >
            <Download size={16} />
            Baixar meus dados
          </button>

          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">
              Excluir a conta remove nome, e-mail, WhatsApp e dados pessoais. A barbearia pode
              manter horários e frequência já registrados de forma anônima (sem vínculo com você).
              Ação irreversível — sem suporte.
            </p>
            {!confirm ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirm(true)}
                className="text-xs font-semibold text-destructive underline"
              >
                Excluir minha conta permanentemente
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <p>
                  Digite <span className="font-bold">EXCLUIR</span> para confirmar. Se você for dono
                  ou sócio de uma loja, transfira a sociedade antes.
                </p>
                <label className="block space-y-1">
                  <span className="font-semibold text-foreground">Confirmação</span>
                  <input
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    autoComplete="off"
                    placeholder="EXCLUIR"
                    className="flex min-h-11 w-full rounded-[var(--control-radius)] border border-border bg-background px-3 text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    disabled={busy || confirmText.trim().toUpperCase() !== "EXCLUIR"}
                    onClick={() => void deleteAccountForever()}
                    className="font-bold text-destructive disabled:opacity-40"
                  >
                    Apagar conta agora
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setConfirm(false);
                      setConfirmText("");
                    }}
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {admin &&
        (loading ? (
          <p role="status" className="text-xs">
            Consultando pedidos…
          </p>
        ) : (
          <>
            {rows.map((row) => (
              <div key={row.id} className="space-y-2 rounded-xl border border-border p-3 text-xs">
                <p className="font-semibold">
                  Exclusão de conta · {row.status === "reviewing" ? "Em análise" : "Solicitada"}
                </p>
                <p>
                  Protocolo: <span className="break-all">{row.id}</span>
                </p>
                <p>{new Date(row.created_at).toLocaleString("pt-BR")}</p>
                <p className="break-all text-muted-foreground">Conta: {row.user_id}</p>
                {row.status === "requested" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void adminUpdate("reviewing", row.id)}
                    className="font-semibold underline"
                  >
                    Iniciar análise
                  </button>
                )}
              </div>
            ))}
            {rows.length === 0 && !error && (
              <p className="text-xs text-muted-foreground">
                Nenhum pedido legado em aberto. Clientes agora excluem a conta diretamente no
                perfil.
              </p>
            )}
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => setVersion((v) => v + 1)}
              className="text-xs text-muted-foreground underline"
            >
              Atualizar pedidos
            </button>
          </>
        ))}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </section>
  );
}
