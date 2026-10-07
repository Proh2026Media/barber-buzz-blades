import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, Lightbulb, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ActionResult,
  CountBadge,
  DetailList,
  PersonAvatar,
  SectionHeader,
} from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useCatalogLabels } from "./catalog/labels";

type Suggestion = {
  id: string;
  service_id: string;
  from_staff_id: string;
  proposed_price_cents: number;
  proposed_duration_minutes: number;
  proposed_display_name: string | null;
  status: string;
  created_at: string;
  serviceName?: string;
  fromName?: string;
  fromAvatar?: string | null;
  /** O que vale hoje para quem recebe (o próprio catálogo ou, sem ele, o da loja). */
  currentPrice?: number;
  currentDuration?: number;
};

/**
 * Sugestões de preço/duração vindas de outros parceiros: cada uma mostra quem sugeriu e quando,
 * "hoje → sugerido" com a diferença e duas saídas claras (usar ou manter o meu).
 */
export function PartnerCatalogSuggestions({
  shopId,
  staffId,
  onCount,
}: {
  shopId: string;
  staffId: string;
  /** Quantas esperam decisão (o atalho do topo da Agenda só aparece quando há alguma). */
  onCount?: (count: number | null) => void;
}) {
  const { t, intlLocale } = useI18n();
  const { duration, money } = useCatalogLabels();
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Falha ao carregar a lista (o "Tentar de novo" recarrega). */
  const [errorText, setErrorText] = useState<string | null>(null);
  /** Falha ao decidir uma sugestão: fica no cartão dela e o "Tentar de novo" repete a escolha. */
  const [failed, setFailed] = useState<{ rowId: string; accept: boolean; text: string } | null>(
    null,
  );

  // Sem carregar (erro), a contagem é desconhecida: o atalho aparece sem bolha e leva ao aviso.
  useEffect(() => {
    onCount?.(errorText ? null : rows.length);
  }, [rows.length, errorText, onCount]);

  const load = useCallback(async () => {
    const client = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            eq: (
              column: string,
              value: string,
            ) => {
              eq: (
                column: string,
                value: string,
              ) => {
                order: (
                  column: string,
                  opts: { ascending: boolean },
                ) => Promise<{ data: Suggestion[] | null; error: { message: string } | null }>;
              };
            };
          };
        };
      };
    };
    const { data, error } = await client
      .from("partner_catalog_suggestions")
      .select(
        "id, service_id, from_staff_id, proposed_price_cents, proposed_duration_minutes, proposed_display_name, status, created_at",
      )
      .eq("barbershop_id", shopId)
      .eq("to_staff_id", staffId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) {
      setErrorText(friendlyAuthError(error));
      setRows([]);
      return;
    }
    setErrorText(null);
    const base = data ?? [];
    const enriched = await Promise.all(
      base.map(async (row) => {
        const [serviceRes, staffRes, ownRes] = await Promise.all([
          supabase
            .from("services")
            .select("name, price_cents, duration_minutes")
            .eq("id", row.service_id)
            .maybeSingle(),
          supabase
            .from("staff")
            .select("display_name, avatar_url")
            .eq("id", row.from_staff_id)
            .maybeSingle(),
          supabase
            .from("staff_services")
            .select("price_cents, duration_minutes")
            .eq("staff_id", staffId)
            .eq("service_id", row.service_id)
            .maybeSingle(),
        ]);
        return {
          ...row,
          serviceName: serviceRes.data?.name,
          fromName: staffRes.data?.display_name,
          fromAvatar: staffRes.data?.avatar_url ?? null,
          currentPrice: ownRes.data?.price_cents ?? serviceRes.data?.price_cents,
          currentDuration: ownRes.data?.duration_minutes ?? serviceRes.data?.duration_minutes,
        };
      }),
    );
    setRows(enriched);
  }, [shopId, staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  const relative = useMemo(
    () => new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" }),
    [intlLocale],
  );
  function ago(iso: string) {
    const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
    return relative.format(-Math.max(0, days), "day");
  }

  function signed(value: number, format: (abs: number) => string) {
    if (value === 0) return null;
    return `${value > 0 ? "+" : "−"}${format(Math.abs(value))}`;
  }

  async function decide(row: Suggestion, accept: boolean) {
    setBusyId(row.id);
    setFailed(null);
    const { error } = await supabase.rpc("decide_partner_catalog_suggestion", {
      p_suggestion_id: row.id,
      p_accept: accept,
    });
    if (error)
      setFailed({ rowId: row.id, accept, text: friendlyAuthError(error, t("team.suggest.error")) });
    else {
      const name =
        row.proposed_display_name || row.serviceName || t("team.partner.serviceFallback");
      if (accept) toast.success(t("team.suggest.applied"), { description: name });
      else toast.success(t("team.suggest.kept"), { description: name });
      await load();
    }
    setBusyId(null);
  }

  if (rows.length === 0 && !errorText) return null;

  return (
    <section
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      aria-labelledby="partner-suggestions-title"
    >
      <SectionHeader
        icon={Lightbulb}
        id="partner-suggestions-title"
        title={t("team.suggest.title")}
        tone="warning"
        aside={
          rows.length > 0 ? (
            <CountBadge
              count={rows.length}
              label={t("team.suggest.countAria", { count: rows.length })}
            />
          ) : undefined
        }
      />
      <ul className="space-y-3">
        {rows.map((row) => {
          const fromName = row.fromName ?? t("team.suggest.partnerFallback");
          const priceDelta =
            row.currentPrice != null ? row.proposed_price_cents - row.currentPrice : 0;
          const durationDelta =
            row.currentDuration != null ? row.proposed_duration_minutes - row.currentDuration : 0;
          return (
            <li
              key={row.id}
              className="space-y-3 rounded-2xl border border-border bg-background/60 p-3"
            >
              <div className="flex items-center gap-3">
                <PersonAvatar
                  name={fromName}
                  src={row.fromAvatar}
                  seed={row.from_staff_id}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {row.proposed_display_name ||
                      row.serviceName ||
                      t("team.partner.serviceFallback")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("team.suggest.from", { name: fromName })} · {ago(row.created_at)}
                  </p>
                </div>
              </div>
              <DetailList
                items={[
                  {
                    key: "price",
                    icon: Wallet,
                    label: t("team.suggest.price"),
                    previous:
                      row.currentPrice != null && priceDelta !== 0
                        ? money(row.currentPrice)
                        : undefined,
                    value: money(row.proposed_price_cents),
                    delta: signed(priceDelta, money)
                      ? { label: signed(priceDelta, money)!, tone: "neutral" }
                      : undefined,
                  },
                  {
                    key: "duration",
                    icon: Clock3,
                    label: t("team.suggest.duration"),
                    previous:
                      row.currentDuration != null && durationDelta !== 0
                        ? duration(row.currentDuration)
                        : undefined,
                    value: duration(row.proposed_duration_minutes),
                    delta: signed(durationDelta, (abs) => duration(abs))
                      ? {
                          label: signed(durationDelta, (abs) => duration(abs))!,
                          tone: "neutral",
                        }
                      : undefined,
                  },
                ]}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void decide(row, false)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-60"
                >
                  {t("team.suggest.keepMine")}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void decide(row, true)}
                  className="action-button action-confirm"
                >
                  <Check className="size-4" aria-hidden /> {t("team.suggest.accept")}
                </button>
              </div>
              {failed?.rowId === row.id && (
                <ActionResult
                  state="error"
                  text={failed.text}
                  onRetry={() => void decide(row, failed.accept)}
                />
              )}
            </li>
          );
        })}
      </ul>
      {errorText && <ActionResult state="error" text={errorText} onRetry={() => void load()} />}
    </section>
  );
}
