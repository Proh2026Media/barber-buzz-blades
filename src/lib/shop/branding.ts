import type { Tables } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";
import { normalizeFontFaces, type BrandFontFaceRecord } from "./font-files.ts";

export const DEFAULT_PRIMARY_COLOR = "#292925";
export const DEFAULT_ACCENT_COLOR = "#8A602F";
export const DEFAULT_FONT_FAMILY = "inter";
export const DEFAULT_FONT_SCOPE = "header";
export const DEFAULT_HEADER_FONT_WEIGHT = 700;
export const DEFAULT_HEADER_FONT_STYLE = "normal";
export const DEFAULT_CORNER_STYLE = "soft";
export const DEFAULT_LOGIN_LAYOUT = "split";
export const DEFAULT_LOGIN_IMAGE = "/images/login-barbershop-default.png";
/** Fundo padrão do quadrado da logo (null = transparente). */
export const DEFAULT_LOGO_BACKGROUND_COLOR: string | null = null;

export const BRAND_FONT_OPTIONS = [
  {
    value: "inter",
    label: "Inter",
    hint: "Neutra e limpa. Padrão do sistema.",
    stack: '"Inter Variable", "Inter", system-ui, sans-serif',
  },
  {
    value: "manrope",
    label: "Manrope",
    hint: "Geométrica e moderna, com traço leve.",
    stack: '"Manrope Variable", "Manrope", system-ui, sans-serif',
  },
  {
    value: "montserrat",
    label: "Montserrat",
    hint: "Marcante e ampla, boa para títulos fortes.",
    stack: '"Montserrat Variable", "Montserrat", system-ui, sans-serif',
  },
  {
    value: "nunito-sans",
    label: "Nunito Sans",
    hint: "Amigável e arredondada, fácil de ler.",
    stack: '"Nunito Sans Variable", "Nunito Sans", system-ui, sans-serif',
  },
  {
    value: "source-sans-3",
    label: "Source Sans 3",
    hint: "Compacta e discreta, foco em textos.",
    stack: '"Source Sans 3 Variable", "Source Sans 3", system-ui, sans-serif',
  },
  {
    value: "roboto",
    label: "Roboto",
    hint: "Familiar no Android, sólida e direta.",
    stack: '"Roboto Variable", "Roboto", system-ui, sans-serif',
  },
] as const;

export type BrandFontFamily = (typeof BRAND_FONT_OPTIONS)[number]["value"];
export type BrandFontScope = "header" | "titles";
export type BrandFontStyle = "normal" | "italic";
export type BrandCornerStyle = "square" | "soft" | "round";
export type BrandLoginLayout = "cover" | "split" | "card";

export const BRAND_LOGIN_LAYOUT_OPTIONS: {
  value: BrandLoginLayout;
  label: string;
  hint: string;
}[] = [
  {
    value: "cover",
    label: "Foto imersiva",
    hint: "A imagem ocupa toda a tela e envolve o acesso.",
  },
  {
    value: "split",
    label: "Foto e formulário",
    hint: "Divide a tela para deixar marca e acesso lado a lado.",
  },
  {
    value: "card",
    label: "Cartão sobre foto",
    hint: "Destaca o formulário em um cartão central sobre a imagem.",
  },
];

export const BRAND_CORNER_OPTIONS: {
  value: BrandCornerStyle;
  label: string;
  hint: string;
  controlRadius: string;
  panelRadius: string;
  buttonRadius: string;
}[] = [
  {
    value: "square",
    label: "Retos",
    hint: "Visual preciso, sem arredondamento nos componentes.",
    controlRadius: "0rem",
    panelRadius: "0rem",
    buttonRadius: "0rem",
  },
  {
    value: "soft",
    label: "Semi arredondados",
    hint: "Equilíbrio atual entre moderno e discreto.",
    controlRadius: "0.9rem",
    panelRadius: "1.35rem",
    buttonRadius: "0.9rem",
  },
  {
    value: "round",
    label: "Arredondados",
    hint: "Botões em formato cápsula e painéis mais suaves.",
    controlRadius: "1.2rem",
    panelRadius: "2rem",
    buttonRadius: "999px",
  },
];

export const BRAND_FONT_SCOPE_OPTIONS: {
  value: BrandFontScope;
  label: string;
  hint: string;
}[] = [
  {
    value: "header",
    label: "Somente cabeçalho",
    hint: "Nome da barbearia no topo do app.",
  },
  {
    value: "titles",
    label: "Cabeçalho e títulos",
    hint: "Também usa em títulos de seções e nomes de serviços.",
  },
];

/** Paleta curada para barbearias: tons escuros para a cor principal e quentes para destaque. */
export const BRAND_PALETTE = [
  { value: "#292925", name: "Carvão" },
  { value: "#111827", name: "Grafite" },
  { value: "#1F4E5F", name: "Petróleo" },
  { value: "#234E70", name: "Marinho" },
  { value: "#3D5A40", name: "Verde musgo" },
  { value: "#4A3728", name: "Café" },
  { value: "#553C9A", name: "Ametista" },
  { value: "#7C2D12", name: "Ferrugem" },
  { value: "#9F1239", name: "Vinho" },
  { value: "#0F766E", name: "Esmeralda" },
  { value: "#8A602F", name: "Bronze" },
  { value: "#C58B36", name: "Ouro" },
  { value: "#B45309", name: "Âmbar" },
  { value: "#C2410C", name: "Cobre" },
  { value: "#4F46E5", name: "Índigo" },
  { value: "#0284C7", name: "Azul céu" },
] as const;

export const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
export const LOGO_ACCEPT = LOGO_MIME_TYPES.join(",");
export const CUSTOM_FONT_MAX_BYTES = 5 * 1024 * 1024;
export const CUSTOM_FONT_MIME_TYPES = [
  "font/woff2",
  "font/woff",
  "font/ttf",
  "font/otf",
  "application/font-woff",
  "application/x-font-ttf",
  "application/x-font-opentype",
  "application/vnd.ms-opentype",
] as const;
export const CUSTOM_FONT_ACCEPT = ".woff2,.woff,.ttf,.otf";

export function normalizeBrandColor(value: string | null | undefined, fallback: string) {
  return value && HEX_COLOR_PATTERN.test(value) ? value.toUpperCase() : fallback;
}

export function validateBrandLogo(file: { type: string; size: number }) {
  if (!(LOGO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "Use uma imagem PNG, JPEG, WebP ou SVG.";
  }
  if (file.size > LOGO_MAX_BYTES) return "O logo deve ter no máximo 2 MB.";
  return null;
}

export function validateBrandFont(file: { type: string; size: number; name?: string }) {
  const extension = file.name?.split(".").pop()?.toLowerCase();
  const supportedExtension = ["woff2", "woff", "ttf", "otf"].includes(extension ?? "");
  if (!(CUSTOM_FONT_MIME_TYPES as readonly string[]).includes(file.type) && !supportedExtension) {
    return "Use uma fonte WOFF2, WOFF, TTF ou OTF.";
  }
  if (file.size > CUSTOM_FONT_MAX_BYTES) return "A fonte deve ter no máximo 5 MB.";
  return null;
}

export function normalizeBrandFont(value: string | null | undefined): BrandFontFamily {
  return BRAND_FONT_OPTIONS.some((option) => option.value === value)
    ? (value as BrandFontFamily)
    : DEFAULT_FONT_FAMILY;
}

export function brandFontStack(value: string | null | undefined) {
  const normalized = normalizeBrandFont(value);
  return BRAND_FONT_OPTIONS.find((option) => option.value === normalized)!.stack;
}

export function normalizeBrandFontScope(value: string | null | undefined): BrandFontScope {
  return value === "titles" ? "titles" : DEFAULT_FONT_SCOPE;
}

export function normalizeHeaderFontWeight(value: number | null | undefined) {
  return Number.isInteger(value) && Number(value) >= 100 && Number(value) <= 900
    ? Number(value)
    : DEFAULT_HEADER_FONT_WEIGHT;
}

export function normalizeHeaderFontStyle(value: string | null | undefined): BrandFontStyle {
  return value === "italic" ? "italic" : DEFAULT_HEADER_FONT_STYLE;
}

export function normalizeCornerStyle(value: string | null | undefined): BrandCornerStyle {
  return value === "square" || value === "round" ? value : DEFAULT_CORNER_STYLE;
}

export function normalizeLoginLayout(value: string | null | undefined): BrandLoginLayout {
  return value === "cover" || value === "card" ? value : DEFAULT_LOGIN_LAYOUT;
}

export function brandCornerClass(value: string | null | undefined) {
  return `brand-corners-${normalizeCornerStyle(value)}`;
}

/** Nome estável e seguro usado pela FontFace API para cada arquivo publicado. */
export function customBrandFontFamily(url: string | null | undefined) {
  if (!url) return null;
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(url.length / 256));
  for (let index = 0; index < url.length; index += step) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= url.length;
  return `BarbaBrand_${(hash >>> 0).toString(36)}`;
}

export function brandFontScopeClass(value: string | null | undefined) {
  return normalizeBrandFontScope(value) === "titles" ? "brand-font-titles" : "brand-font-header";
}

function channelToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: string) {
  const red = channelToLinear(Number.parseInt(color.slice(1, 3), 16));
  const green = channelToLinear(Number.parseInt(color.slice(3, 5), 16));
  const blue = channelToLinear(Number.parseInt(color.slice(5, 7), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastingForeground(background: string) {
  const color = normalizeBrandColor(background, DEFAULT_PRIMARY_COLOR);
  const luminance = relativeLuminance(color);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? "#FFFFFF" : "#111111";
}

/** Razão de contraste WCAG entre duas cores hexadecimais (1 a 21). */
export function contrastRatio(foreground: string, background: string) {
  const first = relativeLuminance(normalizeBrandColor(foreground, "#000000"));
  const second = relativeLuminance(normalizeBrandColor(background, "#FFFFFF"));
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function hexChannels(color: string) {
  const normalized = normalizeBrandColor(color, "#000000");
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ] as const;
}

function mixHex(color: string, target: "#000000" | "#FFFFFF", amount: number) {
  const source = hexChannels(color);
  const destination = hexChannels(target);
  const channels = source.map((channel, index) =>
    Math.round(channel + (destination[index] - channel) * amount),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * Mantém a cor escolhida quando ela já é legível. Caso contrário, preserva o matiz
 * tanto quanto possível e aproxima a cor de preto ou branco até atingir WCAG AA.
 */
export function readableBrandColor(color: string, background = "#F7F5F0", minimumRatio = 4.5) {
  const normalized = normalizeBrandColor(color, DEFAULT_ACCENT_COLOR);
  if (contrastRatio(normalized, background) >= minimumRatio) return normalized;

  for (let step = 1; step <= 20; step += 1) {
    const amount = step / 20;
    const darker = mixHex(normalized, "#000000", amount);
    const lighter = mixHex(normalized, "#FFFFFF", amount);
    const candidates = [darker, lighter].filter(
      (candidate) => contrastRatio(candidate, background) >= minimumRatio,
    );
    if (candidates.length) {
      return candidates.sort(
        (first, second) => contrastRatio(first, normalized) - contrastRatio(second, normalized),
      )[0]!;
    }
  }
  return contrastingForeground(background);
}

export function brandVariables(
  primary?: string | null,
  accent?: string | null,
  fontFamily?: string | null,
  customFontUrl?: string | null,
  headerFontWeight?: number | null,
  headerFontStyle?: string | null,
  cornerStyle?: string | null,
) {
  const normalizedPrimary = normalizeBrandColor(primary, DEFAULT_PRIMARY_COLOR);
  const normalizedAccent = normalizeBrandColor(accent, DEFAULT_ACCENT_COLOR);
  const foreground = contrastingForeground(normalizedPrimary);
  const accentForeground = contrastingForeground(normalizedAccent);
  const primaryReadable = readableBrandColor(normalizedPrimary);
  const accentReadable = readableBrandColor(normalizedAccent);
  const corners = BRAND_CORNER_OPTIONS.find(
    (option) => option.value === normalizeCornerStyle(cornerStyle),
  )!;
  const customFamily = customBrandFontFamily(customFontUrl);
  const fontStack = customFamily
    ? `"${customFamily}", ${brandFontStack(fontFamily)}`
    : brandFontStack(fontFamily);

  return {
    "--brand-primary": normalizedPrimary,
    "--brand-primary-foreground": foreground,
    "--brand-accent": normalizedAccent,
    "--brand-accent-foreground": accentForeground,
    "--brand-primary-readable": primaryReadable,
    "--brand-accent-readable": accentReadable,
    "--primary": normalizedPrimary,
    "--primary-foreground": foreground,
    "--gold": normalizedAccent,
    "--gold-foreground": accentForeground,
    "--brand-font": fontStack,
    "--brand-header-font-weight": String(normalizeHeaderFontWeight(headerFontWeight)),
    "--brand-header-font-style": normalizeHeaderFontStyle(headerFontStyle),
    "--radius": corners.controlRadius,
    "--control-radius": corners.controlRadius,
    "--panel-radius": corners.panelRadius,
    "--button-radius": corners.buttonRadius,
  };
}

/** Campos da identidade visual editáveis pela barbearia ou pelo admin global. */
export type BrandDraft = {
  display_name: string;
  tagline: string;
  logo_url: string | null;
  logo_background_color: string | null;
  login_image_url: string | null;
  login_layout: BrandLoginLayout;
  font_family: string;
  custom_font_url: string | null;
  custom_font_name: string | null;
  custom_font_faces: BrandFontFaceRecord[];
  font_scope: BrandFontScope;
  header_font_weight: number;
  header_font_style: BrandFontStyle;
  corner_style: BrandCornerStyle;
  floating_chrome: boolean;
  primary_color: string;
  accent_color: string;
};

type BrandSource = Pick<
  Tables<"barbershop_settings">,
  | "display_name"
  | "tagline"
  | "logo_url"
  | "logo_background_color"
  | "font_family"
  | "custom_font_url"
  | "custom_font_name"
  | "custom_font_faces"
  | "font_scope"
  | "primary_color"
  | "accent_color"
> &
  Partial<
    Pick<
      Tables<"barbershop_settings">,
      | "header_font_weight"
      | "header_font_style"
      | "corner_style"
      | "floating_chrome"
      | "login_image_url"
      | "login_layout"
    >
  >;

export function brandDraftFromSettings(settings: BrandSource): BrandDraft {
  return {
    display_name: settings.display_name ?? "",
    tagline: settings.tagline,
    logo_url: settings.logo_url,
    logo_background_color: settings.logo_background_color ?? null,
    login_image_url: settings.login_image_url ?? null,
    login_layout: normalizeLoginLayout(settings.login_layout),
    font_family: normalizeBrandFont(settings.font_family),
    custom_font_url: settings.custom_font_url,
    custom_font_name: settings.custom_font_name,
    custom_font_faces: normalizeFontFaces(settings.custom_font_faces),
    font_scope: normalizeBrandFontScope(settings.font_scope),
    header_font_weight: normalizeHeaderFontWeight(settings.header_font_weight),
    header_font_style: normalizeHeaderFontStyle(settings.header_font_style),
    corner_style: normalizeCornerStyle(settings.corner_style),
    floating_chrome: settings.floating_chrome === true,
    primary_color: normalizeBrandColor(settings.primary_color, DEFAULT_PRIMARY_COLOR),
    accent_color: normalizeBrandColor(settings.accent_color, DEFAULT_ACCENT_COLOR),
  };
}

export function isBrandDraftDirty(draft: BrandDraft, settings: BrandSource) {
  const base = brandDraftFromSettings(settings);
  return (
    draft.display_name.trim() !== base.display_name.trim() ||
    draft.tagline.trim() !== base.tagline.trim() ||
    draft.logo_url !== base.logo_url ||
    draft.login_image_url !== base.login_image_url ||
    normalizeLoginLayout(draft.login_layout) !== base.login_layout ||
    (draft.logo_background_color ? draft.logo_background_color.toUpperCase() : null) !==
      (base.logo_background_color ? base.logo_background_color.toUpperCase() : null) ||
    normalizeBrandFont(draft.font_family) !== base.font_family ||
    draft.custom_font_url !== base.custom_font_url ||
    draft.custom_font_name !== base.custom_font_name ||
    JSON.stringify(draft.custom_font_faces) !== JSON.stringify(base.custom_font_faces) ||
    normalizeBrandFontScope(draft.font_scope) !== base.font_scope ||
    normalizeHeaderFontWeight(draft.header_font_weight) !== base.header_font_weight ||
    normalizeHeaderFontStyle(draft.header_font_style) !== base.header_font_style ||
    normalizeCornerStyle(draft.corner_style) !== base.corner_style ||
    draft.floating_chrome !== base.floating_chrome ||
    draft.primary_color.toUpperCase() !== base.primary_color ||
    draft.accent_color.toUpperCase() !== base.accent_color
  );
}

/** Retorna a mensagem de erro do rascunho ou null quando está pronto para salvar. */
export function validateBrandDraft(draft: BrandDraft) {
  if (!HEX_COLOR_PATTERN.test(draft.primary_color) || !HEX_COLOR_PATTERN.test(draft.accent_color)) {
    return "Revise as cores. Use o formato hexadecimal #RRGGBB.";
  }
  if (
    draft.logo_background_color !== null &&
    !HEX_COLOR_PATTERN.test(draft.logo_background_color)
  ) {
    return "Revise o fundo da logo. Use o formato hexadecimal #RRGGBB.";
  }
  if (draft.display_name.trim().length > 80) return "O nome do cabeçalho tem no máximo 80 letras.";
  const tagline = draft.tagline.trim();
  if (tagline.length === 0 || tagline.length > 60) {
    return "A frase abaixo do nome precisa ter entre 1 e 60 letras.";
  }
  return null;
}

/** Normaliza o rascunho para os valores que serão gravados. */
export function brandDraftToSettings(draft: BrandDraft) {
  return {
    display_name: draft.display_name.trim() || null,
    tagline: draft.tagline.trim(),
    logo_url: draft.logo_url,
    login_image_url: draft.login_image_url,
    login_layout: normalizeLoginLayout(draft.login_layout),
    logo_background_color: draft.logo_background_color
      ? draft.logo_background_color.toUpperCase()
      : null,
    font_family: normalizeBrandFont(draft.font_family),
    custom_font_url: draft.custom_font_url,
    custom_font_name: draft.custom_font_name?.trim() || null,
    custom_font_faces: draft.custom_font_faces as unknown as Json,
    font_scope: normalizeBrandFontScope(draft.font_scope),
    header_font_weight: normalizeHeaderFontWeight(draft.header_font_weight),
    header_font_style: normalizeHeaderFontStyle(draft.header_font_style),
    corner_style: normalizeCornerStyle(draft.corner_style),
    floating_chrome: draft.floating_chrome,
    primary_color: draft.primary_color.toUpperCase(),
    accent_color: draft.accent_color.toUpperCase(),
  };
}
