import { useEffect, useId, useRef, useState } from "react";
import {
  CheckCircle2,
  FlaskConical,
  Link2,
  ListChecks,
  Loader2,
  Palette,
  Plus,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Field, Hint, IconTile, Notice, StatusBadge, readableLink } from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { shopPublicOrigin } from "@/lib/shop/host";

/** Mesmo cálculo do endereço automático que o banco faz a partir do nome. */
function slugFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Nova barbearia numa janela curta: nome + prévia do link (marcada como prévia, não como campo).
 * No fim, confirma com ✓ e oferece "Personalizar agora" ou "Ver na lista".
 */
export function NewShopDialog({
  open,
  onOpenChange,
  onCreate,
  onCustomize,
  onShow,
  demoMode = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cria e devolve a barbearia nova (ou rejeita com a mensagem de erro). */
  onCreate: (name: string) => Promise<Tables<"barbershops"> | null>;
  onCustomize: (shop: Tables<"barbershops">) => void;
  onShow: (shop: Tables<"barbershops"> | null) => void;
  /** Na demonstração nada vai ao servidor: o envio só mostra o que aconteceria. */
  demoMode?: boolean;
}) {
  const { t } = useI18n();
  const nameId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoName, setDemoName] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    shop: Tables<"barbershops"> | null;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setError(null);
    setCreated(null);
    setDemoName(null);
  }, [open]);

  const slug = slugFromName(name);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Duplo toque ou dois Enter no mesmo tick criariam duas barbearias.
    if (busy || !name.trim()) return;
    if (demoMode) {
      setDemoName(name.trim());
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const shop = await onCreate(name.trim());
      setCreated({ shop, name: name.trim() });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("plat.shell.createError"));
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[92dvh] max-w-md rounded-3xl border-border bg-card p-5"
      >
        <DialogTitle className="flex min-h-11 items-center gap-2 pr-12 text-lg font-bold">
          <Plus className="size-5 text-gold" aria-hidden />
          {t("plat.newShop.title")}
        </DialogTitle>

        {created ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-2 text-center" role="status">
              <IconTile icon={CheckCircle2} tone="success" size="lg" />
              <p className="text-base font-bold">
                {t("plat.newShop.created", { name: created.name })}
              </p>
            </div>
            <div className="grid gap-2">
              {created.shop && (
                <button
                  type="button"
                  onClick={() => created.shop && onCustomize(created.shop)}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  <Palette className="size-4" aria-hidden />
                  {t("plat.newShop.customizeNow")}
                </button>
              )}
              <button
                type="button"
                onClick={() => onShow(created.shop)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold"
              >
                <ListChecks className="size-4 text-gold" aria-hidden />
                {t("plat.newShop.showInList")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label={t("plat.newShop.name")} id={nameId} error={error ?? undefined}>
              {(props) => (
                <input
                  {...props}
                  ref={inputRef}
                  required
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("plat.newShop.namePlaceholder")}
                  className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                />
              )}
            </Field>
            <div className="space-y-2 rounded-2xl border border-dashed border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t("plat.shop.link")}
                </span>
                <StatusBadge tone="neutral" icon={null} label={t("demo.hub.preview")} size="sm" />
              </div>
              <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <Link2 className="size-4 shrink-0 text-gold" aria-hidden />
                <span className="min-w-0 break-all">
                  {slug ? readableLink(shopPublicOrigin({ slug })) : t("plat.newShop.slugEmpty")}
                </span>
              </p>
              <Hint icon={Link2}>{t("plat.newShop.linkHint")}</Hint>
            </div>
            {demoName && (
              <Notice
                tone="info"
                icon={FlaskConical}
                title={t("plat.demo.notSaved")}
                onDismiss={() => setDemoName(null)}
              >
                {t("plat.demo.newShopWould", { name: demoName })}
              </Notice>
            )}
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              {busy ? t("plat.newShop.busy") : t("plat.newShop.submit")}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
