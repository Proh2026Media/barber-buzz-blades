import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { SessionProfile } from "@/lib/auth/session";

type ChangeRequest = Tables<"shop_change_requests">;

const kindLabels: Record<string, string> = {
  "service.create": "Criar serviço",
  "service.update": "Alterar serviço",
  "service.toggle": "Alterar disponibilidade do serviço",
  "service.delete": "Excluir serviço",
  "staff.create": "Adicionar profissional",
  "staff.update": "Alterar profissional",
  "staff.toggle": "Alterar disponibilidade do profissional",
  "staff.delete": "Excluir profissional",
  "hours.replace": "Alterar horários da barbearia",
  "availability.create": "Criar bloqueio de agenda",
  "availability.delete": "Excluir bloqueio de agenda",
  "settings.operational": "Alterar configurações operacionais",
  "member.update": "Alterar papel ou participação societária",
};

function payloadSummary(payload: Json) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const values = payload as Record<string, Json | undefined>;
  const name = values.name ?? values.display_name;
  return typeof name === "string" && name.trim() ? name : "Revise os detalhes antes de decidir.";
}

export function TeamGovernance({
  shopId,
  profile,
  onChanged,
}: {
  shopId: string;
  profile: SessionProfile;
  onChanged?: () => void;
}) {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const actor = profile.activeShopActor;
  const canReview = actor?.role === "owner" || actor?.role === "partner";

  const load = useCallback(async () => {
    if (!canReview) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("shop_change_requests")
      .select("*")
      .eq("barbershop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) setMessage(error.message);
    else setRequests(data ?? []);
    setLoading(false);
  }, [canReview, shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(request: ChangeRequest, approve: boolean) {
    setBusyId(request.id);
    setMessage(null);
    const { data, error } = await supabase.rpc("decide_shop_change", {
      p_request_id: request.id,
      p_approve: approve,
      p_note: null,
    });
    if (error) setMessage(error.message);
    else {
      const result = data as { status?: string; remaining_approvals?: number } | null;
      setMessage(
        result?.status === "pending"
          ? `Sua aprovação foi registrada. Ainda faltam ${result.remaining_approvals ?? 1} aprovação(ões).`
          : approve
            ? "Mudança aprovada e aplicada."
            : "Mudança recusada. Nada foi aplicado.",
      );
      await load();
      onChanged?.();
    }
    setBusyId(null);
  }

  async function cancel(request: ChangeRequest) {
    setBusyId(request.id);
    const { error } = await supabase.rpc("cancel_shop_change", { p_request_id: request.id });
    setMessage(error ? error.message : "Solicitação cancelada. Nada foi aplicado.");
    if (!error) await load();
    setBusyId(null);
  }

  if (!canReview) return null;
  const pending = requests.filter((request) => request.status === "pending");
  return (
    <section className="app-action-card space-y-4 p-4" aria-labelledby="governance-title">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h3 id="governance-title" className="font-bold">
            Decisões da sociedade
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {profile.governanceMode === "equal"
              ? "Mudanças operacionais só entram em vigor após a aprovação dos demais sócios. A identidade visual continua livre."
              : profile.governanceMode === "majority"
                ? profile.capabilities?.canApplyOperations
                  ? "Você possui a participação majoritária e pode aplicar mudanças operacionais diretamente."
                  : "Somente o sócio majoritário pode aplicar mudanças operacionais."
                : "A gestão operacional pode ser aplicada diretamente pelo responsável."}
          </p>
        </div>
        {pending.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
            {pending.length} pendente{pending.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {loading ? (
        <p role="status" className="text-xs text-muted-foreground">
          Carregando decisões…
        </p>
      ) : pending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          Nenhuma mudança aguarda aprovação.
        </p>
      ) : (
        <div className="space-y-2">
          {pending.map((request) => {
            const own = request.requested_by === profile.user.id;
            return (
              <article
                key={request.id}
                className="rounded-2xl border border-border bg-background/60 p-3"
              >
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {kindLabels[request.kind] ?? "Mudança operacional"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payloadSummary(request.payload)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {own ? "Solicitada por você" : "Solicitada por outro sócio"} ·{" "}
                      {new Date(request.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {own ? (
                    <button
                      type="button"
                      disabled={busyId === request.id}
                      onClick={() => void cancel(request)}
                      className="action-button action-danger"
                    >
                      <X className="size-4" /> Cancelar pedido
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busyId === request.id}
                        onClick={() => void decide(request, false)}
                        className="action-button action-danger"
                      >
                        <X className="size-4" /> Recusar
                      </button>
                      <button
                        type="button"
                        disabled={busyId === request.id}
                        onClick={() => void decide(request, true)}
                        className="action-button action-confirm"
                      >
                        <Check className="size-4" /> Aprovar
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {message && (
        <p role="status" className="text-xs font-semibold text-primary">
          {message}
        </p>
      )}
    </section>
  );
}
