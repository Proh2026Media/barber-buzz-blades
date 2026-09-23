import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, Globe2, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_BASE_HOST } from "@/lib/shop/host";

type DomainSettings = {
  shop_id: string;
  shop_slug: string;
  platform_base_host: string;
  platform_subdomain: string;
  platform_url: string;
  custom_domain: string | null;
  custom_domain_status: "none" | "pending_dns" | "active" | "error";
  domain_verify_token: string | null;
  domain_verified_at: string | null;
  domain_last_error: string | null;
  dns_instructions: {
    cname_host: string;
    cname_target: string;
    txt_host: string;
    txt_value: string;
  } | null;
};

const statusLabel: Record<DomainSettings["custom_domain_status"], string> = {
  none: "Sem domínio próprio",
  pending_dns: "Aguardando DNS",
  active: "Ativo",
  error: "Erro na verificação",
};

type ShopDomainCardProps = {
  shopId: string;
};

export function ShopDomainCard({ shopId }: ShopDomainCardProps) {
  const [settings, setSettings] = useState<DomainSettings | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_shop_domain_settings", {
      p_shop_id: shopId,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const row = data as DomainSettings;
    setSettings(row);
    setDomainInput(row.custom_domain ?? "");
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      setError("Não foi possível copiar.");
    }
  }

  async function callShopDomain(body: Record<string, string>) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Sessão expirada.");
    const base = import.meta.env.VITE_SUPABASE_URL || "";
    const response = await fetch(`${base}/functions/v1/shop-domain`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      warning?: string | null;
      settings?: DomainSettings;
    };
    if (!response.ok) throw new Error(payload.error || "Falha na operação de domínio.");
    return payload;
  }

  async function saveDomain(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callShopDomain({
        action: "set",
        barbershop_id: shopId,
        domain: domainInput.trim(),
      });
      if (payload.settings) setSettings(payload.settings);
      else await load();
      setMessage(
        payload.warning
          ? `Domínio salvo. Configure o DNS e Verifique. Aviso: ${payload.warning}`
          : "Domínio salvo. Configure o DNS e clique em Verificar.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar domínio.");
    } finally {
      setBusy(false);
    }
  }

  async function clearDomain() {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callShopDomain({
        action: "clear",
        barbershop_id: shopId,
      });
      if (payload.settings) setSettings(payload.settings);
      else await load();
      setDomainInput("");
      setMessage(
        payload.warning
          ? `Domínio removido. Aviso: ${payload.warning}`
          : "Domínio próprio removido.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyDomain() {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callShopDomain({
        action: "verify",
        barbershop_id: shopId,
      });
      if (payload.settings) setSettings(payload.settings);
      else await load();
      setMessage(
        payload.ok
          ? payload.warning
            ? `Domínio verificado. Aviso: ${payload.warning}`
            : "Domínio verificado e ativo."
          : payload.error || "Verifique o DNS.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na verificação.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  const platformUrl = settings?.platform_url ?? `https://….${PLATFORM_BASE_HOST}`;
  const instructions = settings?.dns_instructions;

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-primary/10 p-2 text-primary">
          <Globe2 size={18} />
        </span>
        <div>
          <h3 className="text-sm font-bold">Domínio da barbearia</h3>
          <p className="text-xs text-muted-foreground">
            Todo mundo ganha um endereço automático. Opcionalmente, use o domínio próprio da loja.
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-background p-3">
        <p className="text-xs font-semibold">Endereço automático (já disponível após DNS wildcard)</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl bg-muted/50 px-3 py-2 text-xs">
            {platformUrl}
          </code>
          <button
            type="button"
            className="action-button"
            onClick={() => void copyText("platform", platformUrl)}
          >
            <Copy size={14} />
            {copied === "platform" ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      <form onSubmit={saveDomain} className="space-y-3 rounded-2xl border border-border bg-background p-3">
        <p className="text-xs font-semibold">Domínio próprio (opcional)</p>
        <label htmlFor="custom-domain" className="block text-xs text-muted-foreground">
          Ex.: agenda.minhabarbearia.com.br
        </label>
        <input
          id="custom-domain"
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          placeholder="agenda.minhaloja.com.br"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
        {settings && settings.custom_domain_status !== "none" && (
          <p className="text-xs text-muted-foreground">
            Status: <span className="font-semibold text-foreground">{statusLabel[settings.custom_domain_status]}</span>
            {settings.domain_last_error ? ` — ${settings.domain_last_error}` : null}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="action-button">
            Salvar domínio
          </button>
          {settings?.custom_domain && (
            <>
              <button
                type="button"
                disabled={busy}
                className="action-button"
                onClick={() => void verifyDomain()}
              >
                <RefreshCw size={14} />
                Verificar DNS
              </button>
              <button
                type="button"
                disabled={busy}
                className="action-button action-danger"
                onClick={() => void clearDomain()}
              >
                <Trash2 size={14} />
                Remover
              </button>
            </>
          )}
        </div>
      </form>

      {instructions && (
        <div className="space-y-2 rounded-2xl border border-dashed border-border p-3 text-xs">
          <p className="font-semibold">No DNS do seu domínio, crie:</p>
          <ol className="list-decimal space-y-2 pl-4 text-muted-foreground">
            <li>
              <span className="text-foreground">CNAME</span>{" "}
              <code className="text-foreground">{instructions.cname_host}</code> →{" "}
              <code className="text-foreground">{instructions.cname_target}</code>
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => void copyText("cname", instructions.cname_target)}
              >
                copiar alvo
              </button>
            </li>
            <li>
              <span className="text-foreground">TXT</span>{" "}
              <code className="text-foreground">{instructions.txt_host}</code> ={" "}
              <code className="text-foreground">{instructions.txt_value}</code>
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => void copyText("txt", instructions.txt_value)}
              >
                copiar valor
              </button>
            </li>
          </ol>
          <p className="text-muted-foreground">
            Propagação pode levar alguns minutos. Depois clique em Verificar DNS.
          </p>
          {settings?.custom_domain_status === "active" && (
            <p className="flex items-center gap-1 font-semibold text-foreground">
              <CheckCircle2 size={14} /> Domínio verificado
            </p>
          )}
        </div>
      )}

      {message && <p className="text-sm text-foreground">{message}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
