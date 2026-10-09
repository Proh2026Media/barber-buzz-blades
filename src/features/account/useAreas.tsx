import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/visual";
import { areaHref, listAreas, showsAreas, type AreaItem } from "@/lib/auth/areas";
import { saveLastArea, type AreaKind } from "@/lib/auth/destination";
import type { SessionProfile } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n";

/* Ganchos das áreas da conta; o menu "Minhas áreas" fica em MyAreas.tsx. */

/** Áreas da conta (vazio quando só há uma: conta só de cliente não vê nada novo). */
export function useMyAreas(
  profile: Pick<SessionProfile, "memberships" | "shopActors"> | null | undefined,
): AreaItem[] {
  const { t } = useI18n();
  const fallback = t("shop.header.shopName");
  return useMemo(() => {
    if (!profile) return [];
    const areas = listAreas({
      memberships: profile.memberships,
      shopActors: profile.shopActors,
      shopFallback: fallback,
    });
    return showsAreas(areas) ? areas : [];
  }, [profile, fallback]);
}

/** Guarda a área aberta neste aparelho: "/" e o app instalado voltam para ela. */
export function useRememberArea(userId: string | null | undefined, area: AreaKind | null) {
  useEffect(() => {
    if (userId && area) saveLastArea(userId, area);
  }, [userId, area]);
}

/** Nome da área na tela "Abrindo …". */
export function useAreaName() {
  const { t } = useI18n();
  return (area: AreaItem) =>
    area.kind === "shop"
      ? area.name
      : area.kind === "platform"
        ? t("area.platform")
        : t("area.customerOpening");
}

/**
 * Troca de ambiente sempre explícita: cobre a tela com "Abrindo Barbearia X…" e abre a área
 * pelo endereço (a área nova carrega do zero, sem nada da anterior).
 */
export function useAreaSwitch(): {
  open: (area: AreaItem) => void;
  /** Mesmo "Abrindo …" para um endereço de área já montado (ex.: barra da página pública). */
  go: (href: string, name: string) => void;
  overlay: ReactNode;
} {
  const { t } = useI18n();
  const nameOf = useAreaName();
  const [opening, setOpening] = useState<string | null>(null);
  const go = (href: string, name: string) => {
    setOpening(name);
    window.location.assign(href);
  };
  const open = (area: AreaItem) => go(areaHref(area), nameOf(area));
  const overlay = opening ? (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-background/95 p-4 pt-24 backdrop-blur-sm">
      <LoadingState
        variant="list"
        count={2}
        label={t("shop.switch.opening", { name: opening })}
        className="w-full max-w-sm"
      />
    </div>
  ) : null;
  return { open, go, overlay };
}
