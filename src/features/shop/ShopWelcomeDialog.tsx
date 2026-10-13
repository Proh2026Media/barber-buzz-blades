import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { ShopCapabilities } from "@/lib/auth/capabilities";
import { mustChangePassword } from "@/lib/auth/password-change";
import { callOptionalRpc } from "@/lib/auth/optional-rpc";
import { useI18n } from "@/lib/i18n";
import { RoleBadge } from "./roles";
import { MyAccessList } from "./settings/MyAccessCard";

/**
 * "Você agora é Parceiro na Barbearia X": aparece uma vez por vínculo novo (convite, volta à
 * equipe ou papel novo), depois da troca obrigatória da senha. Fechar grava que a pessoa viu.
 * `pending` vem de `shop_members.welcome_seen_at` nulo; sem a coluna no banco, nunca abre.
 */
export function ShopWelcomeDialog({
  pending,
  shopId,
  shopName,
  role,
  percent,
  capabilities,
}: {
  pending: boolean;
  shopId: string;
  shopName: string;
  role: string;
  percent?: number | null;
  capabilities: ShopCapabilities | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [seenShop, setSeenShop] = useState<string | null>(null);

  useEffect(() => {
    if (!pending || seenShop === shopId) return;
    let cancelled = false;
    // Com a senha temporária, a janela "Crie sua senha" vem antes; as boas-vindas esperam.
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && !mustChangePassword(data.session?.user)) setOpen(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "USER_UPDATED" && !mustChangePassword(session?.user) && !cancelled) {
        setOpen(true);
      }
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [pending, shopId, seenShop]);

  function close() {
    setOpen(false);
    setSeenShop(shopId);
    void callOptionalRpc("mark_shop_welcome_seen", { p_shop_id: shopId });
  }

  if (!pending || seenShop === shopId) return null;
  const roleLabel =
    role === "owner" || role === "associate" || role === "employee"
      ? t(`eq.role.${role}` as const)
      : role;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-md space-y-3 overflow-y-auto rounded-[var(--panel-radius)] border-border bg-card p-5">
        <div className="flex items-start gap-3 pe-8">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--control-radius)] bg-gold/15 text-gold">
            <PartyPopper className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <DialogTitle className="text-lg font-extrabold leading-snug break-words">
              {t("shop.welcome.title", { role: roleLabel, shop: shopName })}
            </DialogTitle>
            <RoleBadge role={role} percent={percent} size="md" />
          </div>
        </div>
        <DialogDescription className="text-sm text-muted-foreground">
          {t("shop.welcome.lead")}
        </DialogDescription>
        {capabilities && <MyAccessList role={role} capabilities={capabilities} hideApply />}
        <button
          type="button"
          onClick={close}
          className="action-button action-confirm min-h-11 w-full justify-center"
        >
          {t("shop.welcome.start")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
