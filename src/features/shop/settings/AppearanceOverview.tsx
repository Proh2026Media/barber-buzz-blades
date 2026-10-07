import { Palette, PencilLine, Type } from "lucide-react";
import type { ReactNode } from "react";
import { SectionHeader, Tag } from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import {
  BRAND_CORNER_OPTIONS,
  BRAND_FONT_OPTIONS,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  brandFontStack,
  contrastingForeground,
  normalizeBrandColor,
  normalizeBrandFont,
  normalizeCornerStyle,
} from "@/lib/shop/branding";
import { ColorDots, LogoChip } from "./brand-bits";

/**
 * Cartão "Sua marca" de Aparência: mostra como a marca está hoje (logo, nome, frase, cores,
 * fonte e cantos) num mini cabeçalho do app e leva direto ao editor.
 */
export function BrandSummaryCard({
  settings,
  shopName,
  onEdit,
}: {
  settings: Tables<"barbershop_settings">;
  shopName: string;
  onEdit: () => void;
}) {
  const { t } = useI18n();
  const primary = normalizeBrandColor(settings.primary_color, DEFAULT_PRIMARY_COLOR);
  const accent = normalizeBrandColor(settings.accent_color, DEFAULT_ACCENT_COLOR);
  const corner = BRAND_CORNER_OPTIONS.find(
    (option) => option.value === normalizeCornerStyle(settings.corner_style),
  );
  const font = settings.custom_font_url
    ? (settings.custom_font_name ?? t("brand.font.customFallback"))
    : BRAND_FONT_OPTIONS.find((option) => option.value === normalizeBrandFont(settings.font_family))
        ?.label;
  const name = settings.display_name?.trim() || shopName;
  return (
    <section className="app-action-card flex flex-col gap-4 p-4 sm:p-5">
      <SectionHeader icon={Palette} title={t("shop.settings.brand")} />
      {/* Mini cabeçalho do app do cliente, com a marca salva. */}
      <div
        aria-hidden
        className="flex items-center gap-3 rounded-2xl border border-black/10 bg-[#f7f5f0] p-3 text-[#242421] shadow-sm"
      >
        <LogoChip
          logoUrl={settings.logo_url}
          background={settings.logo_background_color}
          className="size-11 rounded-xl"
        />
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-base font-extrabold leading-tight"
            style={{ fontFamily: brandFontStack(settings.font_family) }}
          >
            {name}
          </span>
          <span className="block truncate text-xs font-semibold" style={{ color: accent }}>
            {settings.tagline}
          </span>
        </span>
        <span
          className="flex min-h-9 shrink-0 items-center rounded-xl px-3 text-xs font-bold"
          style={{ backgroundColor: primary, color: contrastingForeground(primary) }}
        >
          {t("brand.preview.book")}
        </span>
      </div>
      <p className="sr-only">{name}</p>
      <div className="flex flex-wrap items-center gap-2">
        <ColorDots primary={primary} accent={accent} size="md" />
        {font && <Tag icon={Type}>{font}</Tag>}
        {corner && <Tag>{t(corner.labelKey)}</Tag>}
      </div>
      <button type="button" onClick={onEdit} className="action-button action-edit mt-auto w-full">
        <PencilLine aria-hidden />
        {t("appearance.editBrand")}
      </button>
    </section>
  );
}

/** Aparência: marca e página lado a lado no computador, empilhadas no celular. */
export function AppearanceOverview({ brand, page }: { brand: ReactNode; page: ReactNode }) {
  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-2">
      {brand}
      {page}
    </div>
  );
}
