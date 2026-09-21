import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ReceiptText, Sparkles, Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useDemo } from "@/features/demo/context";
import { DEMO_CUSTOMER_ID } from "@/features/demo/model";
import { NextLevelCard, type NextLevelSummary } from "./NextLevelCard";

export function PointsHistory({
  userId,
  points,
  currentLevel,
  nextLevel,
}: {
  userId: string | null;
  points: number;
  currentLevel: string;
  nextLevel: NextLevelSummary | null;
}) {
  const demo = useDemo();
  const [rows, setRows] = useState<Tables<"loyalty_ledger">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [limit, setLimit] = useState(20);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    if (demo) {
      setRows([
        ...demo.awarded
          .filter((id) =>
            demo.appointments.some((row) => row.id === id && row.customer_id === DEMO_CUSTOMER_ID),
          )
          .map((id) => ({
            id,
            user_id: DEMO_CUSTOMER_ID,
            delta: 50,
            reason: "appointment_completed",
            appointment_id: id,
            created_at:
              demo.appointments.find((row) => row.id === id)?.ends_at ?? demo.now.toISOString(),
          })),
        {
          id: "demo-opening",
          user_id: DEMO_CUSTOMER_ID,
          delta: 250,
          reason: "demo_opening",
          appointment_id: null,
          created_at: demo.now.toISOString(),
        },
      ]);
      setLoading(false);
    } else if (userId) {
      void supabase
        .from("loyalty_ledger")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1)
        .then((result) => {
          if (cancelled) return;
          setError(!!result.error);
          if (!result.error) setRows(result.data ?? []);
          setLoading(false);
        });
    } else {
      setError(true);
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [demo, userId, limit, version]);
  const visibleRows = rows.slice(0, limit);

  return (
    <section className="mb-stagger space-y-5" aria-labelledby="points-history-title">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-gold/10 text-gold">
            <ReceiptText className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="points-history-title" className="text-2xl font-extrabold tracking-tight">
              Extrato de pontos
            </h2>
            <p className="text-xs text-muted-foreground">
              Acompanhe seu saldo, sua evolução e cada movimentação.
            </p>
          </div>
        </div>
      </header>

      <div className="app-action-card mb-loyalty-contrast-card relative overflow-hidden p-5 sm:p-6">
        <div className="mb-loyalty-sheen" aria-hidden />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Saldo disponível
            </p>
            <p className="mt-1 text-4xl font-black tabular-nums tracking-tight sm:text-5xl">
              {points} <span className="text-sm font-bold tracking-normal">pontos</span>
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold">
              <Trophy className="size-3.5" aria-hidden="true" />
              Nível {currentLevel}
            </span>
          </div>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold shadow-sm">
            <Sparkles className="size-6" aria-hidden="true" />
          </span>
        </div>
      </div>

      <NextLevelCard nextLevel={nextLevel} showMaxState />

      {error ? (
        <div role="alert" className="app-action-card space-y-3 p-4">
          <p className="text-sm font-semibold">Não foi possível carregar o extrato.</p>
          <button
            type="button"
            onClick={() => setVersion((v) => v + 1)}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {!loading && rows.length === 0 && (
            <EmptyState
              tone="waiting"
              title="Nenhuma movimentação registrada"
              description="Quando você concluir atendimentos, os pontos entram neste extrato."
            />
          )}
          {(loading || rows.length > 0) && (
            <section className="space-y-3" aria-labelledby="points-movements-title">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 id="points-movements-title" className="text-base font-extrabold">
                    Movimentações
                  </h3>
                  <p className="text-xs text-muted-foreground">Mais recentes primeiro</p>
                </div>
                {!loading && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                    {visibleRows.length} {visibleRows.length === 1 ? "registro" : "registros"}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {visibleRows.map((row) => {
                  const credit = row.delta >= 0;
                  const MovementIcon = credit ? ArrowUpRight : ArrowDownRight;
                  return (
                    <article
                      key={row.id}
                      className="app-action-card grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3.5 sm:p-4"
                    >
                      <span
                        className={`flex size-10 items-center justify-center rounded-xl ${
                          credit
                            ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        <MovementIcon className="size-4.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {row.reason === "appointment_completed"
                            ? "Atendimento concluído"
                            : row.reason === "demo_opening"
                              ? "Saldo inicial da demonstração"
                              : "Ajuste de pontos"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString("pt-BR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <span
                        className={`text-right text-base font-black tabular-nums ${
                          credit ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"
                        }`}
                      >
                        {row.delta > 0 ? "+" : ""}
                        {row.delta}
                        <span className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:inline">
                          pts
                        </span>
                      </span>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {loading && (
            <p role="status" className="app-action-card p-4 text-sm text-muted-foreground">
              Carregando extrato…
            </p>
          )}
          {rows.length > limit && (
            <button
              type="button"
              disabled={loading}
              onClick={() => setLimit((n) => n + 20)}
              className="min-h-12 w-full rounded-xl border border-border bg-card px-4 text-sm font-bold hover:bg-muted disabled:opacity-60"
            >
              Carregar mais
            </button>
          )}
        </>
      )}
    </section>
  );
}
