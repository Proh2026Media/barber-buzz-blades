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
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (demo) {
      setRows(demo.privacyRequests.filter((row) => row.status !== "cancelled"));
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const { data, error: failure } = await supabase.rpc("list_privacy_requests", {
          p_admin: admin,
        });
        if (cancelled) return;
        if (failure) {
          setError("Não foi possível consultar os pedidos.");
        } else {
          // Uma resposta vazia sem erro não pode virar null: a lista é renderizada com map.
          setRows(Array.isArray(data) ? (data as unknown as PrivacyRequest[]) : []);
          setError("");
        }
      } catch {
        // Sem este tratamento um erro de rede deixaria a tela carregando para sempre.
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

  async function perform(action: "download" | "request" | "cancelled" | "reviewing", id?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (action === "download") {
        let data: unknown;
        if (demo) {
          const appointments = demo.appointments.filter(
            (row) => row.customer_id === demo.customerId,
          );
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
      } else {
        if (demo)
          demo.dispatch({
            type: "privacy.request",
            status: action === "request" ? "requested" : action,
            id,
          });
        else {
          const result =
            action === "request"
              ? await supabase.rpc("request_account_deletion")
              : await supabase.rpc("update_privacy_request", { p_id: id!, p_status: action });
          if (result.error) throw result.error;
        }
        setConfirm(false);
        setVersion((v) => v + 1);
        setMessage(
          action === "request"
            ? "Pedido registrado. Sua conta continua ativa enquanto ele é analisado."
            : "Pedido atualizado.",
        );
      }
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
            disabled={busy}
            onClick={() => void perform("download")}
            className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-3 text-sm font-semibold text-primary disabled:opacity-50"
          >
            <Download size={16} />
            Baixar meus dados
          </button>
        </>
      )}
      {loading ? (
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
              {admin && <p className="break-all text-muted-foreground">Conta: {row.user_id}</p>}
              {!admin && (
                <p className="text-muted-foreground">
                  O pedido ainda não excluiu sua conta ou seus agendamentos.
                </p>
              )}
              {(!admin || row.status === "requested") && (
                <button
                  disabled={busy}
                  onClick={() => void perform(admin ? "reviewing" : "cancelled", row.id)}
                  className="font-semibold underline"
                >
                  {admin ? "Iniciar análise" : "Cancelar pedido"}
                </button>
              )}
            </div>
          ))}
          {admin && rows.length === 0 && !error && (
            <p className="text-xs text-muted-foreground">Nenhum pedido em aberto.</p>
          )}
          {!admin && rows.length === 0 && !error && (
            <button
              disabled={busy}
              onClick={() => setConfirm(true)}
              className="text-xs text-destructive underline"
            >
              Solicitar exclusão da conta
            </button>
          )}
          {confirm && (
            <div className="space-y-3 rounded-xl border border-destructive/30 p-3 text-xs">
              <p>
                Enviar um pedido de exclusão ao responsável pelo app? Sua conta e suas reservas
                continuam ativas até a análise. Você poderá cancelar o pedido aqui.
              </p>
              <div className="flex gap-4">
                <button
                  disabled={busy}
                  onClick={() => void perform("request")}
                  className="font-bold text-destructive"
                >
                  Enviar pedido
                </button>
                <button disabled={busy} onClick={() => setConfirm(false)}>
                  Voltar
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <button
        disabled={busy || loading}
        onClick={() => setVersion((v) => v + 1)}
        className="text-xs text-muted-foreground underline"
      >
        Atualizar pedidos
      </button>
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
