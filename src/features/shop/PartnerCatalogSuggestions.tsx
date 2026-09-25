import { useCallback, useEffect, useState } from "react";
import { Check, Lightbulb, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
};

export function PartnerCatalogSuggestions({
  shopId,
  staffId,
}: {
  shopId: string;
  staffId: string;
}) {
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const client = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              eq: (column: string, value: string) => {
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
      setMessage(error.message);
      setRows([]);
      return;
    }
    const base = data ?? [];
    const enriched = await Promise.all(
      base.map(async (row) => {
        const [serviceRes, staffRes] = await Promise.all([
          supabase.from("services").select("name").eq("id", row.service_id).maybeSingle(),
          supabase.from("staff").select("display_name").eq("id", row.from_staff_id).maybeSingle(),
        ]);
        return {
          ...row,
          serviceName: serviceRes.data?.name,
          fromName: staffRes.data?.display_name,
        };
      }),
    );
    setRows(enriched);
  }, [shopId, staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, accept: boolean) {
    setBusyId(id);
    setMessage(null);
    const { error } = await supabase.rpc("decide_partner_catalog_suggestion", {
      p_suggestion_id: id,
      p_accept: accept,
    });
    if (error) setMessage(error.message);
    else {
      setMessage(accept ? "Sugestão aplicada aos seus serviços." : "Sugestão mantida de lado.");
      await load();
    }
    setBusyId(null);
  }

  if (rows.length === 0 && !message) return null;

  return (
    <section className="app-action-card space-y-3 p-4" aria-labelledby="partner-suggestions-title">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <Lightbulb className="size-5" />
        </span>
        <div>
          <h3 id="partner-suggestions-title" className="font-bold">
            Sugestões de outros parceiros
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Aceite para espelhar preço/duração no seu catálogo, ou mantenha a personalização própria.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-border bg-background/60 p-3">
            <p className="text-sm font-bold">{row.proposed_display_name || row.serviceName || "Serviço"}</p>
            <p className="text-xs text-muted-foreground">
              De {row.fromName ?? "parceiro"} · {row.proposed_duration_minutes} min ·{" "}
              {(row.proposed_price_cents / 100).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void decide(row.id, false)}
                className="action-button action-danger"
              >
                <X className="size-4" /> Manter o meu
              </button>
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void decide(row.id, true)}
                className="action-button action-confirm"
              >
                <Check className="size-4" /> Aceitar
              </button>
            </div>
          </article>
        ))}
      </div>
      {message && (
        <p role="status" className="text-xs font-semibold text-primary">
          {message}
        </p>
      )}
    </section>
  );
}
