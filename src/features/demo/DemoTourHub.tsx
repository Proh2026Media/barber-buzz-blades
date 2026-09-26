import { Link } from "@tanstack/react-router";
import {
  Building2,
  Eye,
  FlaskConical,
  Handshake,
  LogIn,
  Scissors,
  Shield,
  Smartphone,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import type { DemoRole } from "@/features/demo/chrome";
import { useI18n, type MessageKey } from "@/lib/i18n";

export type DemoSceneId = DemoRole | "login";

const scenes: {
  id: DemoSceneId;
  labelKey: MessageKey;
  hintKey: MessageKey;
  icon: LucideIcon;
}[] = [
  {
    id: "customer",
    labelKey: "demo.scene.customer",
    hintKey: "demo.scene.customerHint",
    icon: Smartphone,
  },
  {
    id: "owner",
    labelKey: "demo.scene.owner",
    hintKey: "demo.scene.ownerHint",
    icon: Building2,
  },
  {
    id: "partner",
    labelKey: "demo.scene.partner",
    hintKey: "demo.scene.partnerHint",
    icon: Handshake,
  },
  {
    id: "associate",
    labelKey: "demo.scene.associate",
    hintKey: "demo.scene.associateHint",
    icon: Briefcase,
  },
  {
    id: "employee",
    labelKey: "demo.scene.employee",
    hintKey: "demo.scene.employeeHint",
    icon: Scissors,
  },
  {
    id: "platform",
    labelKey: "demo.scene.platform",
    hintKey: "demo.scene.platformHint",
    icon: Shield,
  },
  {
    id: "login",
    labelKey: "demo.scene.login",
    hintKey: "demo.scene.loginHint",
    icon: LogIn,
  },
];

type DemoTourHubProps = {
  shopId: string;
  shopName?: string;
  disabled?: boolean;
  onPreviewLogin?: () => void;
};

/**
 * Hub do admin: transforma qualquer ambiente (cliente, loja, papéis, login, plataforma)
 * num tour visual isolado, sem alterar a operação real.
 */
export function DemoTourHub({ shopId, shopName, disabled, onPreviewLogin }: DemoTourHubProps) {
  const { t } = useI18n();
  return (
    <section className="space-y-4 rounded-3xl border border-primary/25 bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FlaskConical className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold">{t("demo.hub.title")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {shopName ? t("demo.hub.bodyShop", { shop: shopName }) : t("demo.hub.body")}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {scenes.map((scene) => {
          const Icon = scene.icon;
          if (scene.id === "login") {
            return (
              <button
                key={scene.id}
                type="button"
                disabled={disabled || !shopId}
                onClick={onPreviewLogin}
                className="flex min-h-[4.5rem] items-start gap-3 rounded-2xl border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    {t(scene.labelKey)}
                    <Eye className="size-3.5 text-muted-foreground" aria-hidden />
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {t(scene.hintKey)}
                  </span>
                </span>
              </button>
            );
          }
          return (
            <Link
              key={scene.id}
              to="/demo"
              search={{ shop: shopId || undefined, view: scene.id }}
              aria-disabled={disabled || !shopId}
              onClick={(event) => {
                if (disabled || !shopId) event.preventDefault();
              }}
              className="flex min-h-[4.5rem] items-start gap-3 rounded-2xl border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 aria-disabled:pointer-events-none aria-disabled:opacity-50"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{t(scene.labelKey)}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {t(scene.hintKey)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
