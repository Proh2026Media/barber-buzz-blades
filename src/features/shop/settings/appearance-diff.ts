import type { MessageKey } from "@/lib/i18n";
import { parseLandingConfig, type LandingConfig } from "../../marketing/shop-landing.ts";
import type { DiffContext, DiffRow } from "./governance-diff.ts";

const labels = {
  display_name: "brand.name.label",
  tagline: "brand.tagline.label",
  logo_url: "brand.logoBg.sample",
  logo_background_color: "brand.logoBg.title",
  login_image_url: "landingEditor.coverPhoto",
  login_layout: "brand.login.modelAria",
  font_family: "brand.font.libraryAria",
  custom_font_url: "brand.font.single",
  custom_font_name: "brand.font.customFallback",
  custom_font_faces: "brand.font.chooseFiles",
  font_scope: "brand.font.whereLabel",
  header_font_weight: "brand.font.weightTitle",
  header_font_style: "plat.appearance.fontStyle",
  corner_style: "brand.corners.title",
  floating_chrome: "brand.chrome.title",
  primary_color: "brand.colors.primary",
  accent_color: "brand.colors.accent",
} satisfies Record<string, MessageKey>;

const landingLabels = {
  enabled: "landingEditor.modeTitle",
  headline: "landingEditor.headline",
  about: "landingEditor.aboutLabel",
  address: "landingEditor.streetAddress",
  instagram: "landingEditor.instagramLabel",
  whatsapp: "landingEditor.whatsappLabel",
  show_staff: "landingEditor.showStaff",
  show_services: "landingEditor.showServices",
  show_today: "landingEditor.showToday",
  show_hours: "landingEditor.showHours",
} satisfies Record<keyof LandingConfig, MessageKey>;

const options: Partial<Record<keyof typeof labels, Record<string, MessageKey>>> = {
  login_layout: {
    cover: "brand.layout.cover",
    split: "brand.layout.split",
    card: "brand.layout.card",
  },
  corner_style: {
    square: "brand.corner.square",
    soft: "brand.corner.soft",
    round: "brand.corner.round",
  },
  font_scope: { header: "brand.fontScope.header", titles: "brand.fontScope.titles" },
  header_font_style: { normal: "brand.weight.400", italic: "brand.font.italic" },
};

export function appearanceDiff(
  changes: Record<string, unknown>,
  previous: Record<string, unknown>,
  ctx: DiffContext,
) {
  const rows: DiffRow[] = [];
  const { t, logoBucketUrl } = ctx;
  const empty = t("eq.diff.empty");
  const fileLabel = (current: boolean) =>
    t(current ? "plat.appearance.previousFile" : "plat.appearance.nextFile");

  function format(field: keyof typeof labels, value: unknown, current: boolean): string {
    if (value == null || value === "")
      return field === "logo_background_color" ? t("brand.color.noBackground") : empty;
    if (field === "custom_font_faces") {
      if (!Array.isArray(value) || !value.length) return empty;
      return value
        .map((face) => {
          const filename =
            typeof face?.file_name === "string"
              ? face.file_name.split(/[\\/]/).pop()?.split(/[?#]/)[0]
              : "";
          return filename ? filename.slice(0, 100) : fileLabel(current);
        })
        .join(", ");
    }
    if (field === "logo_url" || field === "login_image_url" || field === "custom_font_url")
      return fileLabel(current);
    if (field === "floating_chrome")
      return t(value === true ? "brand.chrome.floatingTile" : "brand.chrome.attached");
    if (typeof value !== "string" && typeof value !== "number") return empty;
    const option = options[field]?.[value];
    if (option) return t(option);
    return String(value);
  }

  // A prévia só carrega imagens do armazenamento da própria loja.
  function preview(value: unknown) {
    if (!logoBucketUrl || typeof value !== "string") return undefined;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.href.startsWith(logoBucketUrl) ? url.href : undefined;
    } catch {
      return undefined;
    }
  }

  for (const field of Object.keys(labels) as (keyof typeof labels)[]) {
    if (!(field in changes)) continue;
    const before = previous[field];
    const after = changes[field];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const row: DiffRow = {
      key: field,
      label: t(labels[field]),
      value: format(field, after, false),
      previous: format(field, before, true),
    };
    if (field === "logo_url" || field === "login_image_url") {
      row.image = preview(after);
      row.previousImage = preview(before);
    }
    rows.push(row);
  }
  if ("landing" in changes) {
    const before = parseLandingConfig(previous.landing);
    const after = parseLandingConfig(changes.landing);
    for (const field of Object.keys(landingLabels) as (keyof LandingConfig)[]) {
      if (before[field] === after[field]) continue;
      const display = (value: string | boolean) => {
        if (field === "enabled")
          return t(value ? "landingEditor.modeFull" : "landingEditor.modeBrand");
        return typeof value === "boolean"
          ? t(value ? "eq.diff.on" : "eq.diff.off")
          : value || empty;
      };
      rows.push({
        key: `landing.${field}`,
        label: t(landingLabels[field]),
        value: display(after[field]),
        previous: display(before[field]),
      });
    }
  }
  return rows;
}
