import { useEffect, useState } from "react";
import { ArrowUpRight, Eye } from "lucide-react";
import { useAreaSwitch } from "@/features/account/useAreas";
import { areaAccessOf, getSessionProfile } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n";

type Target = { href: "/shop" | "/platform" | "/app"; seeingAsCustomer: boolean };

/**
 * Barra fina da página pública para quem já entrou: "Você está vendo como cliente · Abrir
 * painel" (ou o app, para quem só é cliente). A página continua igual à que o cliente vê.
 */
export function SignedInBar() {
  const { t } = useI18n();
  const [target, setTarget] = useState<Target | null>(null);
  const areaSwitch = useAreaSwitch();

  useEffect(() => {
    let active = true;
    void getSessionProfile()
      .then((profile) => {
        if (!active || !profile) return;
        const access = areaAccessOf(profile);
        // Quem trabalha numa barbearia volta ao painel (que abre a loja deste endereço).
        if (access.shop) setTarget({ href: "/shop", seeingAsCustomer: true });
        else if (access.platform) setTarget({ href: "/platform", seeingAsCustomer: true });
        else setTarget({ href: "/app", seeingAsCustomer: false });
      })
      .catch(() => {
        /* sem sessão legível: só a página pública */
      });
    return () => {
      active = false;
    };
  }, []);

  if (!target) return null;
  const label = t(
    target.href === "/shop"
      ? "area.bar.openPanel"
      : target.href === "/platform"
        ? "area.bar.openPlatform"
        : "area.bar.openApp",
  );
  const openingName = t(
    target.href === "/shop"
      ? "area.panelName"
      : target.href === "/platform"
        ? "area.platform"
        : "area.customerOpening",
  );
  return (
    <div className="public-card border-b border-border bg-card px-4 py-2">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2">
        <p className="flex min-w-0 flex-1 basis-44 items-center gap-2 text-sm font-semibold">
          <Eye className="size-4 shrink-0 text-gold" aria-hidden />
          <span className="min-w-0">
            {target.seeingAsCustomer ? t("area.bar.asCustomer") : t("area.bar.signedIn")}
          </span>
        </p>
        <button
          type="button"
          onClick={() => areaSwitch.go(target.href, openingName)}
          className="action-button action-confirm min-h-11 shrink-0"
        >
          <ArrowUpRight className="size-4" aria-hidden />
          {label}
        </button>
      </div>
      {areaSwitch.overlay}
    </div>
  );
}
