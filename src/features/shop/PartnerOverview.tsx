import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Link2, Receipt, RefreshCw, Repeat, Wallet } from "lucide-react";
import {
  CopyField,
  LoadingState,
  Notice,
  PersonAvatar,
  SectionHeader,
  StatTile,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { RhythmDashboard, type RhythmPayload } from "@/features/insights/RhythmDashboard";
import { ClientDirectory } from "./ClientDirectory";
import { shopPublicOrigin } from "@/lib/shop/host";
import { t as tNow, useI18n } from "@/lib/i18n";

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

function formatBRL(cents: number, intlLocale: string) {
  return (cents / 100).toLocaleString(intlLocale, {
    style: "currency",
    currency: "BRL",
    currencyDisplay: "narrowSymbol",
  });
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
  customDomain,
  customDomainStatus,
}: {
  shopId: string;
  staffId: string;
  shopSlug: string | null | undefined;
  bookingSlug: string | null | undefined;
  customDomain?: string | null;
  customDomainStatus?: string | null;
}) {
  const { t, intlLocale } = useI18n();
  const demo = useDemo();
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
  const [rhythm, setRhythm] = useState<RhythmPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [resolvedDomain, setResolvedDomain] = useState<{
    domain: string | null;
    status: string | null;
  }>({ domain: customDomain ?? null, status: customDomainStatus ?? null });

  useEffect(() => {
    if (demo || customDomain != null || customDomainStatus != null) {
      setResolvedDomain({ domain: customDomain ?? null, status: customDomainStatus ?? null });
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.rpc("get_shop_domain_settings", { p_shop_id: shopId });
      if (cancelled || !data || typeof data !== "object") return;
      const row = data as { custom_domain?: string | null; custom_domain_status?: string | null };
      setResolvedDomain({
        domain: row.custom_domain ?? null,
        status: row.custom_domain_status ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, shopId, customDomain, customDomainStatus]);

  const bookingLink = useMemo(() => {
    if (!shopSlug || !bookingSlug) return null;
    const origin = shopPublicOrigin({
      slug: shopSlug,
      customDomain: resolvedDomain.domain,
      customDomainStatus: resolvedDomain.status,
    });
    // Endereço curto e legível: o domínio da loja + /nome (a rota leva ao agendamento dele).
    return `${origin}/${encodeURIComponent(bookingSlug)}`;
  }, [shopSlug, bookingSlug, resolvedDomain.domain, resolvedDomain.status]);

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
        const name =
          demo.services.find((s) => s.id === row.service_id)?.name ??
          tNow("team.partner.serviceFallback");
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
  }, [demo, shopId, staffId, retry]);

  if (loading) {
    return <LoadingState label={t("team.partner.loading")} variant="stats" count={2} />;
  }

  const lastEntries = wallet?.entries.slice(0, 5) ?? [];

  return (
    // No computador, duas colunas lado a lado (link e carteira | clientes e ritmo), na
    // largura da Agenda, em vez de uma coluna longa com um vazio ao lado.
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      <div className="min-w-0 space-y-4">
        {/* Link próprio: legível, com Copiar e Enviar. */}
        {bookingLink && (
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <SectionHeader
              icon={Link2}
              title={t("team.partner.linkTitle")}
              description={t("team.partner.linkHint")}
            />
            <CopyField value={bookingLink} shareTitle={t("team.partner.linkTitle")} />
          </section>
        )}

        {/* Carteira: números com o período escrito e os últimos atendimentos. */}
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <SectionHeader
            icon={Wallet}
            title={t("team.partner.wallet")}
            description={t("team.partner.walletPeriod")}
          />
          {error || !wallet ? (
            <Notice
              tone="danger"
              title={t("team.partner.loadError")}
              action={{
                label: t("common.retry"),
                onClick: () => setRetry((n) => n + 1),
                icon: RefreshCw,
              }}
            />
          ) : (
            <>
              {/* O total ganha a linha inteira (cabe sem quebrar no celular); embaixo, quantidade e média. */}
              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  className="col-span-2"
                  icon={Wallet}
                  label={t("team.partner.produced")}
                  value={formatBRL(wallet.total_completed_cents ?? 0, intlLocale)}
                />
                <StatTile
                  icon={CheckCircle2}
                  label={t("team.partner.appointments")}
                  value={wallet.completed_count ?? 0}
                />
                <StatTile
                  icon={Receipt}
                  label={t("team.partner.average")}
                  value={
                    wallet.completed_count
                      ? formatBRL(
                          Math.round((wallet.total_completed_cents ?? 0) / wallet.completed_count),
                          intlLocale,
                        )
                      : null
                  }
                />
              </div>
              {lastEntries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground">
                    {t("team.partner.latest")}
                  </p>
                  <ul className="space-y-1.5">
                    {lastEntries.map((entry) => {
                      const name = entry.customer_name ?? t("team.partner.clientFallback");
                      return (
                        <li
                          key={entry.appointment_id}
                          className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-2.5 text-sm"
                        >
                          <PersonAvatar
                            name={name.replace(/\([^)]*\)/g, "").trim() || name}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{name}</p>
                            {/* Serviço e data em linhas próprias: nada some cortado no celular. */}
                            <p className="truncate text-xs text-muted-foreground">
                              {entry.service_name ?? t("team.partner.serviceFallback")}
                            </p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {new Date(entry.starts_at).toLocaleString(intlLocale, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </p>
                          </div>
                          <span className="shrink-0 font-bold tabular-nums">
                            {formatBRL(entry.amount_cents, intlLocale)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <div className="min-w-0 space-y-4">
        {/* Clientes do parceiro. */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <ClientDirectory
            shopId={shopId}
            staffId={staffId}
            scope="own"
            title={t("team.partner.yourClients")}
          />
        </section>

        {/* Ritmo: cartão com cabeçalho, como "Seu ritmo" do cliente. O gasto médio já está
          na carteira ("Média por atendimento"), então não se repete aqui. */}
        {!error && (
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <SectionHeader icon={Repeat} title={t("team.partner.rhythmTitle")} />
            <RhythmDashboard
              rhythm={rhythm}
              title={t("team.partner.rhythmTitle")}
              dayLabel={t("team.partner.rhythmDay")}
              subject="clients"
              hideTitle
              hideAvgSpend
            />
          </section>
        )}
      </div>
    </div>
  );
}
