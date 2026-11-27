import { toast } from "sonner";
import type { ShopAppearanceSettings, RequestAppearanceChanges } from "@/lib/shop/branding";
import { useEffect, useState } from "react";
import { LayoutTemplate, Palette, RefreshCw } from "lucide-react";
import { LoadingState, Notice } from "@/components/visual";
import { useDemo } from "@/features/demo/context";
import { BrandIdentityEditor, type BrandStep } from "@/features/shop/BrandIdentityEditor";
import { GuardedEditorDialog } from "@/features/shop/settings/GuardedEditorDialog";
import { LandingEditor } from "@/features/shop/settings/LandingEditor";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { shopPublicOrigin } from "@/lib/shop/host";

type Settings = Tables<"barbershop_settings">;
export type ShopAppearanceTarget = {
  shop: Pick<
    Tables<"barbershops">,
    "id" | "name" | "slug" | "timezone" | "custom_domain" | "custom_domain_status"
  >;
  editor: "identity" | "landing";
  step?: BrandStep;
};

type AppearanceAccess =
  | {
      requestChanges: RequestAppearanceChanges;
      loadSettings: (shopId: string) => Promise<ShopAppearanceSettings>;
      demoSettings?: never;
    }
  | { requestChanges?: never; loadSettings?: never; demoSettings?: Settings };

export function ShopAppearanceDialog({
  target,
  onOpen,
  onClose,
  demoSettings,
  onSaved,
  requestChanges,
  loadSettings,
}: AppearanceAccess & {
  target: ShopAppearanceTarget;
  onOpen: (target: ShopAppearanceTarget) => void;
  onClose: () => void;
  onSaved?: (settings: ShopAppearanceSettings) => void;
}) {
  const { t } = useI18n();
  const { shop, editor, step } = target;
  const demo = useDemo();
  const simulated = demoSettings ?? demo?.settings;
  const [saved, setSaved] = useState<ShopAppearanceSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (simulated) return;
    let current = true;
    setSaved(null);
    setFailed(false);
    async function read() {
      if (loadSettings) return loadSettings(shop.id);
      const { data, error } = await supabase
        .from("barbershop_settings")
        .select("*")
        .eq("barbershop_id", shop.id)
        .single();
      if (error) throw error;
      return data;
    }
    void read()
      .then((data) => {
        if (!current) return;
        if (data?.barbershop_id !== shop.id) setFailed(true);
        else setSaved(data);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [shop.id, editor, attempt, simulated, loadSettings]);

  const settings = simulated ?? (saved?.barbershop_id === shop.id ? saved : null);
  const identity = editor === "identity";
  function savedSettings(next: ShopAppearanceSettings) {
    if (!simulated && next.barbershop_id !== shop.id) return;
    setSaved(next);
    onSaved?.(next);
  }

  const submit: RequestAppearanceChanges | undefined =
    requestChanges &&
    (async (shopId, changes) => {
      if (shopId !== shop.id) throw new Error(t("plat.shell.brandOpenError"));
      await requestChanges(shopId, changes);
      toast.success(t("plat.appearance.submitted"));
      onClose();
    });

  return (
    <GuardedEditorDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("plat.brand.title", { name: shop.name })}
      description={t(identity ? "shop.brand.description" : "landingEditor.description")}
      descriptionHidden
      saveExitLabel={requestChanges ? t("plat.appearance.submit") : undefined}
    >
      {(guard) => {
        const change = (editor: ShopAppearanceTarget["editor"], step?: BrandStep) =>
          guard.requestClose(() => onOpen({ shop, editor, step }));
        return (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={identity}
                className={identity ? "action-button action-confirm" : "action-button"}
                onClick={() => {
                  if (!identity) change("identity");
                }}
              >
                <Palette aria-hidden className="size-4" />
                {t("shop.settings.brand")}
              </button>
              <button
                type="button"
                aria-pressed={!identity}
                className={identity ? "action-button" : "action-button action-confirm"}
                onClick={() => {
                  if (identity) change("landing");
                }}
              >
                <LayoutTemplate aria-hidden className="size-4" />
                {t("landingEditor.title")}
              </button>
            </div>
            {failed ? (
              <Notice
                tone="danger"
                title={t("plat.shell.brandOpenError")}
                action={{
                  label: t("visual.retry"),
                  icon: RefreshCw,
                  onClick: () => setAttempt((value) => value + 1),
                }}
              />
            ) : !settings ? (
              <LoadingState variant="cards" count={2} label={t("plat.brand.loading")} />
            ) : identity ? (
              <BrandIdentityEditor
                audience="platform"
                shopName={shop.name}
                settings={settings}
                mode={simulated ? "demo" : "supabase"}
                initialStep={step}
                requestChanges={submit}
                guard={guard}
                onSaved={savedSettings}
              />
            ) : (
              <LandingEditor
                shopId={shop.id}
                shopSlug={shop.slug}
                timeZone={shop.timezone}
                publicUrl={shopPublicOrigin({
                  slug: shop.slug,
                  customDomain: shop.custom_domain,
                  customDomainStatus: shop.custom_domain_status,
                })}
                settings={settings}
                requestChanges={submit}
                onSaved={savedSettings}
                guard={guard}
                onChangePhoto={() => change("identity", "entrada")}
              />
            )}
          </>
        );
      }}
    </GuardedEditorDialog>
  );
}
