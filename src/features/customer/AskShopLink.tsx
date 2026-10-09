import { useEffect, useId, useState, type FormEvent } from "react";
import { ArrowRight, ClipboardPaste, Link2, Loader2 } from "lucide-react";
import { EmptyState, Field } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PLATFORM_BASE_HOST } from "@/lib/shop/host";
import { parseShopLink, shopLinkAppHref } from "@/lib/shop/shop-link";

/**
 * Cliente sem barbearia (cadastro sem link de loja): estado vazio neutro, sem erro vermelho.
 * "Peça o link à sua barbearia" com um campo para colar o link; o app abre a loja do link e
 * pergunta se a pessoa quer adicioná-la (decisão 13 do plano de ambientes: sem busca de lojas).
 */
export function AskShopLink({
  onOpen,
  initialError = null,
  className,
}: {
  /** Abre o endereço da loja (com a tela "Abrindo …"). */
  onOpen: (href: string, name: string) => void;
  /** Aviso inicial no campo (ex.: a loja do endereço não foi encontrada). */
  initialError?: string | null;
  className?: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);
  const canPaste = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;

  async function open(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const link = parseShopLink(value, PLATFORM_BASE_HOST);
    if (!link) {
      setError(t("cust.askLink.invalid"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if ("slug" in link) {
        // Confere a loja antes de abrir: nome errado ou loja fora do ar avisa aqui no campo.
        const { data, error: lookupError } = await supabase.rpc("get_shop_join_preview", {
          p_shop_ref: link.slug,
        });
        const info = data as { found?: boolean; shop_slug?: string; shop_name?: string } | null;
        if (lookupError || !info?.found) {
          setError(t("cust.askLink.notFound"));
          return;
        }
        const slug = info.shop_slug || link.slug;
        onOpen(shopLinkAppHref(slug, link.barber), info.shop_name || slug);
        return;
      }
      // Domínio próprio: a mesma consulta pública que a página da loja usa para saber qual é.
      const { data, error: lookupError } = await supabase.rpc("resolve_shop_by_host", {
        p_host: link.host,
      });
      const row = data as { shop_slug?: string; shop_name?: string } | null;
      if (lookupError || !row?.shop_slug) {
        setError(t("cust.askLink.notFound"));
        return;
      }
      onOpen(shopLinkAppHref(row.shop_slug, link.barber), row.shop_name || row.shop_slug);
    } catch {
      setError(t("cust.askLink.notFound"));
    } finally {
      setBusy(false);
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setValue(text.trim());
        setError(null);
      }
    } catch {
      // Sem permissão para ler a área de transferência: a pessoa cola no campo.
    }
  }

  return (
    <EmptyState
      tone="store"
      title={t("cust.askLink.title")}
      description={t("cust.askLink.body")}
      className={className}
    >
      <form
        noValidate
        onSubmit={(event) => void open(event)}
        className="w-full max-w-sm space-y-3 text-left"
      >
        <Field label={t("cust.askLink.field")} id={id} error={error ?? undefined}>
          {(props) => (
            <div className="flex gap-2">
              <span className="relative min-w-0 flex-1">
                <Link2
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gold"
                  aria-hidden
                />
                <input
                  {...props}
                  type="text"
                  inputMode="url"
                  enterKeyHint="go"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={t("cust.askLink.placeholder")}
                  className="min-h-11 w-full rounded-[var(--control-radius)] border border-input bg-background ps-9 pe-3 text-sm text-foreground"
                />
              </span>
              {canPaste && (
                <button
                  type="button"
                  onClick={() => void paste()}
                  aria-label={t("cust.askLink.paste")}
                  title={t("cust.askLink.paste")}
                  className="grid size-11 shrink-0 place-items-center rounded-[var(--control-radius)] border border-border bg-card transition hover:border-primary/40"
                >
                  <ClipboardPaste className="size-4 text-gold" aria-hidden />
                </button>
              )}
            </div>
          )}
        </Field>
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="action-button action-confirm min-h-11 w-full justify-center"
        >
          {busy ? (
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="size-4" aria-hidden />
          )}
          {t("cust.askLink.open")}
        </button>
      </form>
    </EmptyState>
  );
}
