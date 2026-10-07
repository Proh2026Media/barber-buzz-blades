import { useEffect, useState, type ReactNode } from "react";
import {
  Gift,
  Loader2,
  ReceiptText,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { EmptyState, IconTile, LoadingState } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useDemo } from "@/features/demo/context";
import { DEMO_CUSTOMER_ID } from "@/features/demo/model";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { shopDateKey } from "@/lib/shop/appointments";
import { CustomerPageHeader } from "./CustomerPageHeader";

/** "2026-10-05" no fuso do aparelho, quando a loja não informou o dela. */
function localKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Ícone de cada motivo de movimentação: a pessoa reconhece a origem sem ler. */
function ledgerReasonIcon(reason: string): LucideIcon {
  switch (reason) {
    case "appointment_completed":
      return Scissors;
    case "welcome_bonus":
    case "demo_opening":
      return Sparkles;
    case "reward_redeemed":
      return Gift;
    case "reward_refunded":
      return RotateCcw;
    default:
      return SlidersHorizontal;
  }
}

/** Serviço e profissional de cada atendimento, para dar contexto às linhas do extrato. */
export type AppointmentContext = Record<string, { service: string; staff: string }>;

function ledgerReasonKey(reason: string): MessageKey {
  switch (reason) {
    case "appointment_completed":
      return "points.reason.completed";
    case "welcome_bonus":
      return "points.reason.welcome";
    case "reward_redeemed":
      return "points.reason.redeemed";
    case "reward_refunded":
      return "points.reason.refunded";
    case "demo_opening":
      return "points.reason.demo";
    default:
      return "points.reason.adjust";
  }
}

export function PointsHistory({
  userId,
  shopId,
  refreshKey = 0,
  summary,
  appointments = {},
  now,
  timeZone,
  onBack,
  children,
}: {
  userId: string | null;
  shopId?: string | null;
  refreshKey?: number;
  /** Resumo do topo (o mesmo cartão de membro do Início). */
  summary?: ReactNode;
  /** Serviço e profissional por atendimento (dados que o app já carregou). */
  appointments?: AppointmentContext;
  /** Relógio da loja (ou da demonstração): decide se a data mostra o ano. */
  now?: Date;
  /** Fuso da barbearia: agrupa por mês e mostra datas como no resto do app. */
  timeZone?: string;
  onBack: () => void;
  /** Conteúdo entre o resumo e as movimentações (ex.: prêmios para trocar). */
  children?: ReactNode;
}) {
  const demo = useDemo();
  const { t, intlLocale } = useI18n();
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
      const demoRows = [
        ...demo.awarded
          .filter((id) =>
            demo.appointments.some((row) => row.id === id && row.customer_id === DEMO_CUSTOMER_ID),
          )
          .map((id) => ({
            id,
            user_id: DEMO_CUSTOMER_ID,
            barbershop_id: demo.shop.id,
            delta: 50,
            reason: "appointment_completed",
            appointment_id: id,
            program_version: null,
            note: null,
            actor_id: null,
            redemption_id: null,
            created_at:
              demo.appointments.find((row) => row.id === id)?.ends_at ?? demo.now.toISOString(),
          })),
        {
          id: "demo-opening",
          user_id: DEMO_CUSTOMER_ID,
          barbershop_id: demo.shop.id,
          delta: 250,
          reason: "demo_opening",
          appointment_id: null,
          program_version: null,
          note: null,
          actor_id: null,
          redemption_id: null,
          created_at: demo.now.toISOString(),
        },
        // Trocas de pontos (−custo) e, se o cliente desistiu, a devolução (+custo).
        ...demo.redemptions.flatMap((row) => {
          const base = {
            user_id: DEMO_CUSTOMER_ID,
            barbershop_id: demo.shop.id,
            appointment_id: null,
            program_version: null,
            note: row.reward_name,
            actor_id: null,
            redemption_id: row.id,
          };
          const redeemed = {
            ...base,
            id: `${row.id}-redeemed`,
            delta: -row.cost_points,
            reason: "reward_redeemed",
            created_at: row.created_at,
          };
          if (row.status !== "cancelled") return [redeemed];
          return [
            redeemed,
            {
              ...base,
              id: `${row.id}-refunded`,
              delta: row.cost_points,
              reason: "reward_refunded",
              created_at: new Date(Date.parse(row.created_at) + 1000).toISOString(),
            },
          ];
        }),
      ];
      // Mesma ordem da consulta real: mais recentes primeiro (created_at desc, id desc).
      setRows(
        demoRows.sort(
          (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
        ),
      );
      setLoading(false);
    } else if (userId && shopId) {
      void supabase
        .from("loyalty_ledger")
        .select("*")
        .eq("user_id", userId)
        .eq("barbershop_id", shopId)
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
  }, [demo, userId, shopId, limit, version, refreshKey]);
  const visibleRows = rows.slice(0, limit);
  // Mês, ano e hora no fuso da barbearia, como o resto do app (e não no do aparelho).
  const zone = timeZone ? { timeZone } : {};
  const yearOf = (date: Date) =>
    (timeZone ? shopDateKey(date, timeZone) : localKey(date)).slice(0, 4);
  const year = yearOf(now ?? new Date());
  const monthFormat = new Intl.DateTimeFormat(intlLocale, {
    month: "long",
    year: "numeric",
    ...zone,
  });
  const monthOnly = new Intl.DateTimeFormat(intlLocale, { month: "long", ...zone });
  const dayFormat = new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...zone,
  });
  const dayYearFormat = new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...zone,
  });
  // Movimentações agrupadas por mês, mais recentes primeiro.
  const groups: { key: string; label: string; rows: typeof visibleRows }[] = [];
  for (const row of visibleRows) {
    const date = new Date(row.created_at);
    const key = (timeZone ? shopDateKey(date, timeZone) : localKey(date)).slice(0, 7);
    let group = groups.find((item) => item.key === key);
    if (!group) {
      const label = (yearOf(date) === year ? monthOnly : monthFormat).format(date);
      group = { key, label: label.charAt(0).toLocaleUpperCase() + label.slice(1), rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }

  return (
    <section className="mb-stagger space-y-5" aria-labelledby="points-history-title">
      <CustomerPageHeader
        icon={ReceiptText}
        title={t("points.title")}
        titleId="points-history-title"
        onBack={onBack}
      />

      {summary}

      {children}

      {error ? (
        <EmptyState
          status="danger"
          title={t("points.error")}
          action={
            <button
              type="button"
              onClick={() => setVersion((v) => v + 1)}
              className="action-button min-h-11 w-full"
            >
              <RotateCcw className="size-4" aria-hidden />
              {t("visual.retry")}
            </button>
          }
        />
      ) : loading && rows.length === 0 ? (
        <LoadingState variant="list" count={3} label={t("points.loading")} />
      ) : rows.length === 0 ? (
        <EmptyState
          tone="scissors"
          title={t("points.emptyTitle")}
          description={t("points.emptyText")}
        />
      ) : (
        <section className="space-y-3" aria-labelledby="points-movements-title">
          <h3 id="points-movements-title" className="text-base font-extrabold">
            {t("points.movements")}
          </h3>
          {groups.map((group) => (
            <div key={group.key} className="space-y-1.5">
              <h4 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h4>
              <ul className="app-action-card divide-y divide-border/70 p-1">
                {group.rows.map((row) => {
                  const credit = row.delta >= 0;
                  const date = new Date(row.created_at);
                  const context =
                    row.reason === "appointment_completed" && row.appointment_id
                      ? appointments[row.appointment_id]
                      : null;
                  const detail = context
                    ? `${context.service} · ${context.staff}`
                    : (row.reason === "reward_redeemed" || row.reason === "reward_refunded") &&
                        row.note
                      ? row.note
                      : null;
                  return (
                    <li key={row.id} className="flex items-center gap-3 px-2.5 py-3">
                      <IconTile
                        icon={ledgerReasonIcon(row.reason)}
                        tone={credit ? "success" : "neutral"}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {t(ledgerReasonKey(row.reason))}
                        </p>
                        {detail && (
                          <p className="truncate text-xs text-muted-foreground">{detail}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {(yearOf(date) === year ? dayFormat : dayYearFormat).format(date)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          // Gastar pontos num prêmio é escolha, não erro: cinza, não vermelho.
                          credit ? "tone-success" : "tone-neutral",
                          "shrink-0 text-right text-base font-black tabular-nums text-[color:var(--tone-ink)]",
                        )}
                      >
                        {credit ? "+" : "−"}
                        {Math.abs(row.delta)}
                        <span className="ms-1 text-[11px] font-bold text-muted-foreground">
                          {t("points.short")}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {rows.length > limit && (
            <button
              type="button"
              disabled={loading}
              aria-busy={loading || undefined}
              onClick={() => setLimit((n) => n + 20)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold hover:bg-muted disabled:opacity-70"
            >
              {loading && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
              {loading ? t("points.loading") : t("common.loadMore")}
            </button>
          )}
        </section>
      )}
    </section>
  );
}
