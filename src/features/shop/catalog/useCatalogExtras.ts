import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AwaitingApproval, ServiceTerm, TeamAccess } from "./types";

/**
 * Leituras que ligam Serviços e Equipe ao resto do painel, todas já existentes no sistema:
 * - quem faz cada serviço (`get_booking_terms`, a mesma do app do cliente);
 * - quem entra no painel (`list_shop_team_members`, a mesma do cartão de acessos);
 * - mudanças à espera dos sócios (`list_pending_shop_changes`, a mesma de Ajustes → Equipe).
 * Falhas não atrapalham as abas: a informação extra só não aparece.
 */
export function useCatalogExtras({
  shopId,
  demo,
  active,
  withAccess,
  withApprovals,
  revision,
}: {
  shopId: string | null | undefined;
  demo: boolean;
  /** Só lê quando Serviços ou Equipe estão abertos. */
  active: boolean;
  withAccess: boolean;
  withApprovals: boolean;
  revision: number;
}) {
  const [terms, setTerms] = useState<ServiceTerm[] | null>(null);
  const [access, setAccess] = useState<TeamAccess[] | null>(null);
  const [awaiting, setAwaiting] = useState<AwaitingApproval>({});

  useEffect(() => {
    if (!active || !shopId || demo) {
      setTerms(null);
      setAccess(null);
      setAwaiting({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const [termsResult, accessResult, pendingResult] = await Promise.all([
        supabase.rpc("get_booking_terms", { p_shop_id: shopId }),
        withAccess
          ? supabase.rpc("list_shop_team_members", { p_shop_id: shopId })
          : Promise.resolve(null),
        withApprovals
          ? supabase.rpc("list_pending_shop_changes", { p_shop_id: shopId })
          : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setTerms(termsResult.error ? null : ((termsResult.data ?? []) as ServiceTerm[]));
      if (accessResult && !accessResult.error && Array.isArray(accessResult.data)) {
        setAccess(
          (accessResult.data as Array<Record<string, unknown>>).map((row) => ({
            staff_id: String(row.staff_id ?? ""),
            role: (row.role as TeamAccess["role"]) ?? "employee",
            ownership_percent:
              typeof row.ownership_percent === "number" ? row.ownership_percent : null,
            active: row.active !== false,
          })),
        );
      } else setAccess(null);
      const next: AwaitingApproval = {};
      if (pendingResult && !pendingResult.error && Array.isArray(pendingResult.data)) {
        for (const value of pendingResult.data as Array<Record<string, unknown>>) {
          const kind = String(value.kind ?? "");
          if (value.status && value.status !== "pending") continue;
          if (!kind.startsWith("service.") && !kind.startsWith("staff.")) continue;
          const payload = value.payload as Record<string, unknown> | null;
          const id = payload && typeof payload.id === "string" ? payload.id : null;
          if (id) next[id] = kind;
        }
      }
      setAwaiting(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, shopId, demo, withAccess, withApprovals, revision]);

  return { terms, access, awaiting };
}
