import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, Link2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { RhythmDashboard, type RhythmPayload } from "@/features/insights/RhythmDashboard";
import { ClientDirectory } from "./ClientDirectory";

type WalletEntry = {
  appointment_id: string;
  starts_at: string;
  customer_name: string | null;
  service_name: string | null;
  amount_cents: number;
};

type WalletPayload = {
  total_completed_cents: number;
  completed_count: number;
  entries: WalletEntry[];
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Visão do parceiro: carteira, clientes e ritmo, todos restritos ao próprio
 * trabalho. O app une apenas a marca; cada parceiro enxerga somente o seu.
 */
export function PartnerOverview({
  shopId,
  staffId,
  shopSlug,
  bookingSlug,
}: {
  shopId: string;
  staffId: string;
  shopSlug: string | null | undefined;
  bookingSlug: string | null | undefined;
}) {
  const demo = useDemo();
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
  const [rhythm, setRhythm] = useState<RhythmPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const bookingLink = useMemo(() => {
    if (!shopSlug || !bookingSlug) return null;
    return `${window.location.origin}/app?shop=${encodeURIComponent(shopSlug)}&barber=${encodeURIComponent(bookingSlug)}`;
  }, [shopSlug, bookingSlug]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    if (demo) {
      // A demonstração é derivada localmente dos atendimentos do profissional fictício.
      const mine = demo.appointments
        .filter((row) => row.staff_id === staffId && row.status === "completed")
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      setWallet({
        total_completed_cents: mine.reduce((sum, row) => sum + (demo.prices[row.id] ?? 0), 0),
        completed_count: mine.length,
        entries: mine
          .map((row) => ({
            appointment_id: row.id,
            starts_at: row.starts_at,
            customer_name: demo.customers.find((c) => c.id === row.customer_id)?.name ?? null,
            service_name: demo.services.find((s) => s.id === row.service_id)?.name ?? null,
            amount_cents: demo.prices[row.id] ?? 0,
          }))
          .sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
      });
      // Ritmo: mediana dos dias entre visitas consecutivas do mesmo cliente,
      // dia da semana e hora preferidos, espelhando a RPC real.
      const byCustomer = new Map<string, string[]>();
      for (const row of mine) {
        const dates = byCustomer.get(row.customer_id) ?? [];
        dates.push(row.starts_at);
        byCustomer.set(row.customer_id, dates);
      }
      const intervals: number[] = [];
      const weekdays = new Map<number, number>();
      const hours = new Map<number, number>();
      const services = new Map<string, number>();
      for (const dates of byCustomer.values()) {
        for (let i = 1; i < dates.length; i += 1) {
          intervals.push(
            (new Date(dates[i]!).getTime() - new Date(dates[i - 1]!).getTime()) / 86400000,
          );
        }
      }
      for (const row of mine) {
        const date = new Date(row.starts_at);
        weekdays.set(date.getDay(), (weekdays.get(date.getDay()) ?? 0) + 1);
        hours.set(date.getHours(), (hours.get(date.getHours()) ?? 0) + 1);
        const name = demo.services.find((s) => s.id === row.service_id)?.name ?? "Serviço";
        services.set(name, (services.get(name) ?? 0) + 1);
      }
      const top = (map: Map<number, number>) =>
        [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const topService = [...services.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const totalCents = mine.reduce((sum, row) => sum + (demo.prices[row.id] ?? 0), 0);
      setRhythm({
        sample: intervals.length,
        avg_return_days: intervals.length
          ? intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)]
          : null,
        preferred_weekday: top(weekdays) ?? null,
        preferred_hour: top(hours) ?? null,
        top_service: topService ?? null,
        avg_spend_cents: mine.length ? Math.round(totalCents / mine.length) : null,
      });
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const [walletResult, rhythmResult] = await Promise.all([
          supabase.rpc("get_partner_wallet", { p_shop_id: shopId }),
          supabase.rpc("get_partner_rhythm", { p_shop_id: shopId }),
        ]);
        if (cancelled) return;
        if (walletResult.error || rhythmResult.error) {
          setError(true);
        } else {
          setWallet(walletResult.data as unknown as WalletPayload);
          setRhythm(rhythmResult.data as unknown as RhythmPayload);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [demo, shopId, staffId]);

  function copyLink() {
    if (!bookingLink) return;
    void navigator.clipboard?.writeText(bookingLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Carregando sua carteira…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Link próprio */}
      {bookingLink && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Link2 className="size-4 text-gold" />
            Seu link de agendamento
          </p>
          <p className="text-xs text-muted-foreground">
            Envie para sua cartela de clientes reservar direto com você.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">
              {bookingLink}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <Copy className="size-3.5" />
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {/* Carteira (expansível, fechada por padrão) */}
      <details className="group rounded-2xl border border-border bg-card p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
          <Wallet className="size-4 text-gold" />
          <span className="flex-1">Sua carteira</span>
          <span className="text-xs font-semibold text-muted-foreground">
            {formatBRL(wallet?.total_completed_cents ?? 0)}
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Atendimentos</p>
            <p className="text-2xl font-bold tabular-nums">{wallet?.completed_count ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Produzido</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatBRL(wallet?.total_completed_cents ?? 0)}
            </p>
          </div>
        </div>
        {wallet && wallet.entries.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            {wallet.entries.slice(0, 5).map((entry) => (
              <div
                key={entry.appointment_id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{entry.customer_name ?? "Cliente"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.service_name} ·{" "}
                    {new Date(entry.starts_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <span className="shrink-0 font-bold tabular-nums">
                  {formatBRL(entry.amount_cents)}
                </span>
              </div>
            ))}
          </div>
        )}
      </details>

      {/* Clientes (expansível) */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <ClientDirectory shopId={shopId} staffId={staffId} scope="own" title="Seus clientes" />
      </div>

      {/* Ritmo */}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar sua carteira. Tente novamente.
        </p>
      ) : (
        <RhythmDashboard
          rhythm={rhythm}
          title="Ritmo dos seus clientes"
          dayLabel="Dia em que seus clientes mais vêm"
        />
      )}
    </div>
  );
}
