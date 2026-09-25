import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { SessionProfile } from "@/lib/auth/session";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type ChangeRequest = Tables<"shop_change_requests"> & {
  expires_at?: string | null;
  source?: string | null;
  checklist?: Json;
};

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
  "member.add": "Convidar membro da equipe",
  "member.update": "Alterar papel ou participação societária",
};

function payloadSummary(payload: Json) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const values = payload as Record<string, Json | undefined>;
  const name = values.name ?? values.display_name;
  return typeof name === "string" && name.trim() ? name : "Revise os detalhes antes de decidir.";
}

function checklistItems(request: ChangeRequest): { kind: string; summary: string }[] {
  const raw = request.checklist;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const row = item as Record<string, unknown>;
        return {
          kind: String(row.kind ?? request.kind),
          summary: String(row.summary ?? payloadSummary(request.payload)),
        };
      })
      .filter((row): row is { kind: string; summary: string } => !!row);
  }
  return [{ kind: request.kind, summary: payloadSummary(request.payload) }];
}

function remainingLabel(expiresAt: string | null | undefined) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expirado";
  const mins = Math.ceil(ms / 60000);
  return mins <= 1 ? "Fecha em 1 min" : `Fecha em ${mins} min`;
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
  const [popupOpen, setPopupOpen] = useState(false);
  const actor = profile.activeShopActor;
  const canReview = actor?.role === "owner" || actor?.role === "partner";

  const load = useCallback(async () => {
    if (!canReview) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("list_pending_shop_changes", {
      p_shop_id: shopId,
    });
    if (error) {
      // Fallback se a RPC ainda não existir.
      const fallback = await supabase
        .from("shop_change_requests")
        .select("*")
        .eq("barbershop_id", shopId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(30);
      if (fallback.error) setMessage(fallback.error.message);
      else setRequests((fallback.data as ChangeRequest[]) ?? []);
    } else {
      setRequests(Array.isArray(data) ? (data as ChangeRequest[]) : []);
    }
    setLoading(false);
  }, [canReview, shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(
    () => requests.filter((request) => request.status === "pending"),
    [requests],
  );

  useEffect(() => {
    if (pending.some((row) => row.source === "account_manager" || row.source === "majority_log")) {
      setPopupOpen(true);
    }
  }, [pending]);

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
        result?.status === "expired"
          ? "Esta janela de 30 minutos já fechou. Nada foi aplicado."
          : result?.status === "pending"
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
              ? "Mudanças operacionais só entram após aprovação dos demais co-donos. A identidade visual segue a mesma regra."
              : profile.governanceMode === "majority"
                ? profile.capabilities?.canApplyOperations
                  ? "Você é majoritário e aplica mudanças operacionais diretamente."
                  : "Como minoritário, suas mudanças abrem pedido para o majoritário aprovar."
                : "A gestão operacional pode ser aplicada diretamente pelo responsável."}
          </p>
        </div>
        {pending.length > 0 && (
          <button
            type="button"
            onClick={() => setPopupOpen(true)}
            className="ml-auto rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300"
          >
            {pending.length} pendente{pending.length === 1 ? "" : "s"}
          </button>
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
            const timer = remainingLabel(request.expires_at);
            const items = checklistItems(request);
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
                      {request.source === "account_manager" ? " · Gerente de conta" : ""}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {items.map((item, index) => (
                        <li key={`${request.id}-${index}`}>
                          ☐ {kindLabels[item.kind] ?? item.kind}: {item.summary}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {own ? "Solicitada por você" : "Solicitada por outro"} ·{" "}
                      {new Date(request.created_at).toLocaleString("pt-BR")}
                      {timer ? ` · ${timer}` : ""}
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

      <Dialog open={popupOpen && pending.length > 0} onOpenChange={setPopupOpen}>
        <DialogContent className="max-w-md rounded-3xl border-border bg-card p-5">
          <DialogTitle className="text-base font-extrabold">Checklist de alterações</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Revise o que foi proposto. Pedidos do gerente de conta fecham sozinhos em até 30 minutos.
          </DialogDescription>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {pending.map((request) => (
              <div key={`popup-${request.id}`} className="rounded-xl border border-border p-3">
                <p className="text-sm font-semibold">
                  {kindLabels[request.kind] ?? request.kind}
                  {remainingLabel(request.expires_at)
                    ? ` · ${remainingLabel(request.expires_at)}`
                    : ""}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {checklistItems(request).map((item, index) => (
                    <li key={`popup-item-${request.id}-${index}`}>
                      ☐ {item.summary}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
