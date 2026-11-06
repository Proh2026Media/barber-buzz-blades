import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { PartyPopper } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { ShopCapabilities } from "@/lib/auth/capabilities";
import { mustChangePassword } from "@/lib/auth/password-change";
import { callOptionalRpc } from "@/lib/auth/optional-rpc";
import { useI18n } from "@/lib/i18n";
import { RoleBadge } from "./roles";
import { roleMeta } from "./roles-model";
import { MyAccessList } from "./settings/MyAccessCard";

/**
 * "Você agora é Parceiro na Barbearia X": aparece uma vez por vínculo novo (convite, volta à
 * equipe ou papel novo), depois da troca obrigatória da senha. Fechar grava que a pessoa viu.
 * `pending` vem de `shop_members.welcome_seen_at` nulo; sem a coluna no banco, nunca abre.
 */
export function ShopWelcomeDialog({
  pending,
  userId,
  memberId,
  memberUpdatedAt,
  shopId,
  shopName,
  role,
  percent,
  capabilities,
}: {
  pending: boolean;
  userId: string;
  memberId: string;
  memberUpdatedAt: string;
  shopId: string;
  shopName: string;
  role: string;
  percent?: number | null;
  capabilities: ShopCapabilities | null;
}) {
  const { t } = useI18n();
  // A leitura pertence à conta e à chegada ao vínculo, não só à última loja aberta.
  // O updated_at distingue a volta à equipe, inclusive quando o papel continua igual.
  const welcomeKey = JSON.stringify([userId, memberId, memberUpdatedAt, role]);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [seenKeys, setSeenKeys] = useState<ReadonlySet<string>>(() => new Set());
  const seen = seenKeys.has(welcomeKey);
  const open = pending && !seen && readyFor === welcomeKey;

  useEffect(() => {
    if (!pending || seen) {
      setReadyFor(null);
      return;
    }
    let cancelled = false;
    let authVersion = 0;
    const synchronize = (session: Session | null) => {
      if (cancelled) return;
      setReadyFor(
        session?.user.id === userId && !mustChangePassword(session.user) ? welcomeKey : null,
      );
    };
    // Com a senha temporária, a janela "Crie sua senha" vem antes; as boas-vindas esperam.
    // Sair, trocar de conta ou voltar à senha temporária também fecha a janela, sem marcar leitura.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      authVersion++;
      synchronize(session);
    });
    const versionAtRead = authVersion;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        // Um evento mais recente prevalece sobre a resposta atrasada desta leitura.
        if (authVersion === versionAtRead) synchronize(error ? null : data.session);
      })
      .catch(() => {
        if (authVersion === versionAtRead) synchronize(null);
      });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [pending, seen, userId, welcomeKey]);

  function close() {
    if (!open) return;
    setReadyFor(null);
    setSeenKeys((previous) => new Set(previous).add(welcomeKey));
    void callOptionalRpc("mark_shop_welcome_seen", { p_shop_id: shopId });
  }

  // Sem sessão/vínculo liberado, retira também o conteúdo durante a animação de fechamento.
  if (!open) return null;
  const roleLabel = t(roleMeta(role).label);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
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
