import type { Tables } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";
import { t, type MessageKey } from "../i18n/index.ts";
import { normalizeFontFaces, type BrandFontFaceRecord } from "./font-files.ts";
import {
  KIT_NEUTRALS,
  MOTHER_EXCLUSIVE_COLORS,
  SHOP_THEMES,
  colorDistance,
  defaultShopTheme,
  findShopTheme,
  isMotherColor,
  nearestShopTheme,
  type ShopTheme,
  type ShopThemeLeque,
} from "./themes.ts";

/** Loja sem tema escolhido usa o tema neutro claro (nunca as cores da marca-mãe). */
export const DEFAULT_PRIMARY_COLOR = defaultShopTheme().primary;
export const DEFAULT_ACCENT_COLOR = defaultShopTheme().accent;
/**
 * Par que o banco grava sozinho em toda loja nova (padrão da coluna, de antes dos temas).
 * Quem tem exatamente este par nunca escolheu cor: é lido como o tema neutro claro.
 */
export const LEGACY_DEFAULT_PRIMARY_COLOR = "#292925";
export const LEGACY_DEFAULT_ACCENT_COLOR = "#8A602F";
export const DEFAULT_FONT_FAMILY = "inter";
export const DEFAULT_FONT_SCOPE = "header";
export const DEFAULT_HEADER_FONT_WEIGHT = 700;
export const DEFAULT_HEADER_FONT_STYLE = "normal";
export const DEFAULT_CORNER_STYLE = "soft";
export const DEFAULT_LOGIN_LAYOUT = "split";
export const DEFAULT_LOGIN_IMAGE = "/images/aurset/espaco.webp";
/** Fundo padrão do quadrado da logo (null = transparente). */
export const DEFAULT_LOGO_BACKGROUND_COLOR: string | null = null;

export const BRAND_FONT_OPTIONS = [
  {
    value: "inter",
    label: "Inter",
    hintKey: "brand.fontOption.inter",
    stack: '"Inter Variable", "Inter", system-ui, sans-serif',
  },
  {
    value: "manrope",
    label: "Manrope",
    hintKey: "brand.fontOption.manrope",
    stack: '"Manrope Variable", "Manrope", system-ui, sans-serif',
  },
  {
    value: "montserrat",
    label: "Montserrat",
    hintKey: "brand.fontOption.montserrat",
    stack: '"Montserrat Variable", "Montserrat", system-ui, sans-serif',
  },
  {
    value: "nunito-sans",
    label: "Nunito Sans",
    hintKey: "brand.fontOption.nunitoSans",
    stack: '"Nunito Sans Variable", "Nunito Sans", system-ui, sans-serif',
  },
  {
    value: "source-sans-3",
    label: "Source Sans 3",
    hintKey: "brand.fontOption.sourceSans3",
    stack: '"Source Sans 3 Variable", "Source Sans 3", system-ui, sans-serif',
  },
  {
    value: "roboto",
    label: "Roboto",
    hintKey: "brand.fontOption.roboto",
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
  labelKey: MessageKey;
  hintKey: MessageKey;
}[] = [
  {
    value: "cover",
    labelKey: "brand.layout.cover",
    hintKey: "brand.layout.coverHint",
  },
  {
    value: "split",
    labelKey: "brand.layout.split",
    hintKey: "brand.layout.splitHint",
  },
  {
    value: "card",
    labelKey: "brand.layout.card",
    hintKey: "brand.layout.cardHint",
  },
];

/**
 * As três opções de cantos. Os raios aqui só desenham a miniatura de cada opção no editor de
 * marca: quem pinta a tela são os blocos `.brand-corners-*` de src/styles.css (fonte única, com
 * os sete papéis de canto). Ao mudar um número, mude nos dois lugares; o teste confere.
 * Escala da holding: 0, 6, 10, 14, 22 px e cápsula. Manual: Aurset/brandkit/cantos.html.
 */
export const BRAND_CORNER_OPTIONS: {
  value: BrandCornerStyle;
  labelKey: MessageKey;
  hintKey: MessageKey;
  controlRadius: string;
  panelRadius: string;
  buttonRadius: string;
}[] = [
  {
    value: "square",
    labelKey: "brand.corner.square",
    hintKey: "brand.corner.squareHint",
    controlRadius: "0rem",
    panelRadius: "0rem",
    buttonRadius: "0rem",
  },
  {
    value: "soft",
    labelKey: "brand.corner.soft",
    hintKey: "brand.corner.softHint",
    controlRadius: "0.875rem",
    panelRadius: "1.375rem",
    buttonRadius: "0.875rem",
  },
  {
    value: "round",
    labelKey: "brand.corner.round",
    hintKey: "brand.corner.roundHint",
    controlRadius: "1.375rem",
    panelRadius: "1.375rem",
    buttonRadius: "999px",
  },
];

export const BRAND_FONT_SCOPE_OPTIONS: {
  value: BrandFontScope;
  labelKey: MessageKey;
  hintKey: MessageKey;
}[] = [
  {
    value: "header",
    labelKey: "brand.fontScope.header",
    hintKey: "brand.fontScope.headerHint",
  },
  {
    value: "titles",
    labelKey: "brand.fontScope.titles",
    hintKey: "brand.fontScope.titlesHint",
  },
];

/**
 * Amostras do seletor de cor livre: o tom de botão de cada família do kit e quatro neutros.
 * Nenhuma é cor da marca-mãe.
 */
export const BRAND_PALETTE: readonly { value: string; nameKey: MessageKey }[] = [
  ...SHOP_THEMES.filter((theme) => theme.kind === "familia").map((theme) => ({
    value: theme.primary,
    nameKey: theme.nameKey,
  })),
  { value: KIT_NEUTRALS.chumbo, nameKey: "brand.palette.lead" },
  { value: KIT_NEUTRALS.ardosia, nameKey: "brand.palette.slate" },
  { value: KIT_NEUTRALS.grafite, nameKey: "brand.palette.graphite" },
  { value: KIT_NEUTRALS.breu, nameKey: "brand.palette.pitch" },
];

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

/** Valida o logo ou outra imagem da marca (`kind` muda só a mensagem de tamanho). */
export function validateBrandLogo(
  file: { type: string; size: number },
  kind: "logo" | "image" = "logo",
) {
  if (!(LOGO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return t("brand.validate.imageType");
  }
  if (file.size > LOGO_MAX_BYTES) {
    return kind === "logo" ? t("brand.validate.logoSize") : t("brand.validate.imageSize");
  }
  return null;
}

export function validateBrandFont(file: { type: string; size: number; name?: string }) {
  const extension = file.name?.split(".").pop()?.toLowerCase();
  const supportedExtension = ["woff2", "woff", "ttf", "otf"].includes(extension ?? "");
  if (!(CUSTOM_FONT_MIME_TYPES as readonly string[]).includes(file.type) && !supportedExtension) {
    return t("brand.validate.fontType");
  }
  if (file.size > CUSTOM_FONT_MAX_BYTES) return t("brand.validate.fontSize");
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
/**
 * Superfícies de leitura das telas de um estabelecimento (src/styles.css, bloco
 * `[data-tema-loja]`): no claro, cartões em Sal e áreas suaves até #F2F2F2; no escuro, cartões
 * #161616, chão Grafite e áreas suaves #333333. O contraste é calculado contra a mais exigente.
 */
export const SHOP_LIGHT_READING_SURFACE = "#F2F2F2";
export const SHOP_DARK_READING_SURFACE = "#333333";

export function readableBrandColor(
  color: string,
  background: string = SHOP_LIGHT_READING_SURFACE,
  minimumRatio = 4.5,
) {
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

/**
 * Cores que valem para a loja. Valor inválido cai no tema neutro claro, e o par antigo que o
 * banco grava sozinho (loja que nunca escolheu cor) também.
 */
export function resolveBrandColors(primary?: string | null, accent?: string | null) {
  const resolvedPrimary = normalizeBrandColor(primary, DEFAULT_PRIMARY_COLOR);
  const resolvedAccent = normalizeBrandColor(accent, DEFAULT_ACCENT_COLOR);
  if (
    resolvedPrimary === LEGACY_DEFAULT_PRIMARY_COLOR &&
    resolvedAccent === LEGACY_DEFAULT_ACCENT_COLOR
  ) {
    return { primary: DEFAULT_PRIMARY_COLOR, accent: DEFAULT_ACCENT_COLOR };
  }
  // Cor da marca-mãe gravada por outro caminho (o banco não tem a regra) conta como não
  // escolhida: a loja aparece no neutro claro, nunca com as cores da Aurset.
  if (isMotherColor(resolvedPrimary) || isMotherColor(resolvedAccent)) {
    return { primary: DEFAULT_PRIMARY_COLOR, accent: DEFAULT_ACCENT_COLOR };
  }
  return { primary: resolvedPrimary, accent: resolvedAccent };
}

/** A loja ainda não escolheu cor (padrão novo, padrão antigo do banco ou valor vazio)? */
export function isUnchosenBrandColors(primary?: string | null, accent?: string | null) {
  const colors = resolveBrandColors(primary, accent);
  return colors.primary === DEFAULT_PRIMARY_COLOR && colors.accent === DEFAULT_ACCENT_COLOR;
}

/** Tema que a loja usa, ou null quando as cores são personalizadas. */
export function brandTheme(primary?: string | null, accent?: string | null): ShopTheme | null {
  const colors = resolveBrandColors(primary, accent);
  return findShopTheme(colors.primary, colors.accent);
}

/**
 * Um chão derivado de cor livre não pode cair perto do Céu, da Água, da Bruma ou da Areia.
 * Folga em ΔE (CIE Lab), mais larga que a da cor gravada porque o chão ocupa a tela toda.
 */
export const MOTHER_FLOOR_TOLERANCE = 10;

/** O tom parece um dos chãos ou a forma da marca-mãe (Céu, Água, Bruma ou Areia)? */
export function isMotherFloor(tone: string) {
  const { ceu, agua, bruma, areia } = MOTHER_EXCLUSIVE_COLORS;
  return [ceu, agua, bruma, areia].some(
    (mother) => colorDistance(tone, mother) <= MOTHER_FLOOR_TOLERANCE,
  );
}

/**
 * Leque de uma cor personalizada (fora dos temas): tons calculados da cor principal e da cor de
 * destaque, no mesmo formato do leque de um tema. Se o chão calculado ficar parecido com o da
 * marca-mãe, usa o chão neutro.
 */
export function customBrandLeque(primary: string, accent: string): ShopThemeLeque {
  const neutral = defaultShopTheme().leque;
  let claro = mixHex(primary, "#FFFFFF", 0.72);
  let meio = mixHex(primary, "#FFFFFF", 0.8);
  let base = mixHex(primary, "#FFFFFF", 0.88);
  if ([claro, meio, base].some(isMotherFloor)) {
    ({ claro, meio, base } = neutral);
  }
  let forma = mixHex(accent, "#FFFFFF", 0.45);
  if (isMotherFloor(forma)) forma = neutral.forma;
  const profundo = mixHex(primary, "#000000", 0.7);
  return {
    claro,
    meio,
    base,
    forma,
    detalhe: readableBrandColor(accent, claro, 3),
    medio: primary,
    medioUi: readableBrandColor(primary, base, 3),
    profundo,
    par: mixHex(accent, "#FFFFFF", 0.8),
    borda: mixHex(primary, "#FFFFFF", 0.6),
    sombra: mixHex(primary, "#FFFFFF", 0.4),
    texto: readableBrandColor(profundo, claro, 4.5),
  };
}

/** Sem tema salvo, distribui os selos pelas famílias do menu de cores, com escolha estável por loja. */
const familiasDoSelo = SHOP_THEMES.filter((tema) => tema.kind === "familia");

export function coresDoSelo(chave: string, primaria?: string | null, destaque?: string | null) {
  const { primary, accent } = resolveBrandColors(primaria, destaque);
  let leque: ShopThemeLeque;
  const semEscolha =
    (!primaria && !destaque) ||
    (primaria?.toUpperCase() === LEGACY_DEFAULT_PRIMARY_COLOR &&
      destaque?.toUpperCase() === LEGACY_DEFAULT_ACCENT_COLOR);
  if (semEscolha) {
    let indice = 0;
    for (const letra of chave) indice = (Math.imul(indice, 31) + letra.charCodeAt(0)) >>> 0;
    leque = familiasDoSelo[indice % familiasDoSelo.length].leque;
  } else {
    leque = findShopTheme(primary, accent)?.leque ?? customBrandLeque(primary, accent);
  }
  const fundo = leque.claro;
  return {
    fundo,
    anel: readableBrandColor(leque.detalhe, fundo, 3),
    letra1: readableBrandColor(leque.profundo, fundo),
    letra2: readableBrandColor(leque.detalhe, fundo),
  };
}

/** Variáveis do leque (chão, forma, detalhe, par, borda e sombra) para os shells usarem. */
function lequeVariables(theme: ShopTheme | null, leque: ShopThemeLeque) {
  return {
    "--brand-tema": theme?.id ?? "personalizado",
    "--brand-esquema": theme?.scheme ?? "claro",
    "--brand-chao-claro": leque.claro,
    "--brand-chao-meio": leque.meio,
    "--brand-chao-base": leque.base,
    "--brand-sobre-chao": leque.texto,
    "--brand-forma": leque.forma,
    "--brand-detalhe": leque.detalhe,
    "--brand-medio": leque.medio,
    "--brand-medio-ui": leque.medioUi,
    "--brand-profundo": leque.profundo,
    "--brand-par": leque.par,
    "--brand-borda": leque.borda,
    "--brand-sombra": leque.sombra,
  };
}

/** Texto sobre um fundo colorido: o tom profundo da família se ler bem, senão preto ou branco. */
function readableOn(background: string, preferred: string) {
  return contrastRatio(preferred, background) >= 4.5 ? preferred : contrastingForeground(background);
}

export function brandVariables(
  primary?: string | null,
  accent?: string | null,
  fontFamily?: string | null,
  customFontUrl?: string | null,
  headerFontWeight?: number | null,
  headerFontStyle?: string | null,
  // Mantido para não mudar quem chama; os cantos vêm da classe `brandCornerClass()`.
  _cornerStyle?: string | null,
) {
  const { primary: normalizedPrimary, accent: normalizedAccent } = resolveBrandColors(
    primary,
    accent,
  );
  const theme = findShopTheme(normalizedPrimary, normalizedAccent);
  const leque = theme?.leque ?? customBrandLeque(normalizedPrimary, normalizedAccent);
  const foreground = contrastingForeground(normalizedPrimary);
  const accentForeground = contrastingForeground(normalizedAccent);
  const darkScheme = theme?.scheme === "escuro";
  // Texto na cor da loja sobre as superfícies escuras (modo escuro e tema Neutro escuro).
  const primaryReadableDark = readableBrandColor(normalizedPrimary, SHOP_DARK_READING_SURFACE);
  const accentReadableDark = readableBrandColor(normalizedAccent, SHOP_DARK_READING_SURFACE);
  // Num tema de chão escuro, a versão "legível" é sempre a calculada contra o escuro.
  const primaryReadable = darkScheme ? primaryReadableDark : readableBrandColor(normalizedPrimary);
  const accentReadable = darkScheme ? accentReadableDark : readableBrandColor(normalizedAccent);
  // Destaque como texto direto sobre o chão da página: contra o tom mais forte do chão.
  const accentReadablePage = darkScheme
    ? accentReadableDark
    : readableBrandColor(normalizedAccent, leque.claro);
  const customFamily = customBrandFontFamily(customFontUrl);
  const fontStack = customFamily
    ? `"${customFamily}", ${brandFontStack(fontFamily)}`
    : brandFontStack(fontFamily);
  // Ação principal sobre superfície escura: o tom médio da família, clareado até ler como texto
  // (4,5:1 contra a superfície escura mais clara). Neutros e cores sem matiz usam Sal, porque
  // um cinza intermediário parece botão desabilitado.
  const actionSeed = theme ? theme.leque.medio : normalizedPrimary;
  const colourless =
    theme?.kind === "neutro" ||
    Math.max(...hexChannels(actionSeed)) - Math.min(...hexChannels(actionSeed)) < 24;
  const actionDark = colourless
    ? "#FFFFFF"
    : readableBrandColor(actionSeed, SHOP_DARK_READING_SURFACE);
  const actionDarkForeground = colourless ? "#262626" : readableOn(actionDark, leque.profundo);
  // Destaque usado como fundo (selo, ponto): o mesmo tom legível da página, com o texto certo.
  const accentPageForeground = contrastingForeground(accentReadablePage);

  return {
    "--brand-primary": normalizedPrimary,
    "--brand-primary-foreground": foreground,
    "--brand-accent": normalizedAccent,
    "--brand-accent-foreground": accentForeground,
    "--brand-primary-readable": primaryReadable,
    "--brand-primary-readable-dark": primaryReadableDark,
    "--brand-accent-readable": accentReadable,
    "--brand-accent-readable-dark": accentReadableDark,
    "--brand-accent-readable-page": accentReadablePage,
    "--brand-accent-readable-page-foreground": accentPageForeground,
    "--brand-acao-escuro": actionDark,
    "--brand-sobre-acao-escuro": actionDarkForeground,
    ...lequeVariables(theme, leque),
    // `--primary` e `--gold` não saem mais daqui: o estilo em linha vencia o CSS e deixava o
    // botão escuro sobre fundo escuro. Quem escolhe o valor por modo é src/styles.css
    // (blocos `[data-tema-loja]`), a partir das variáveis `--brand-*`.
    "--brand-font": fontStack,
    "--brand-header-font-weight": String(normalizeHeaderFontWeight(headerFontWeight)),
    "--brand-header-font-style": normalizeHeaderFontStyle(headerFontStyle),
    // Os raios não saem mais daqui: o estilo em linha vencia a classe `brand-corners-*` e a
    // página ficava com um raio e as janelas com outro. A classe é a fonte única.
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

export type ShopAppearanceSettings = Pick<
  Tables<"barbershop_settings">, keyof BrandDraft | "barbershop_id" | "updated_at" | "landing"
>;
export type RequestAppearanceChanges = (shopId: string, patch: Record<string, unknown>) => Promise<void>;

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
  const colors = resolveBrandColors(settings.primary_color, settings.accent_color);
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
    primary_color: colors.primary,
    accent_color: colors.accent,
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

/**
 * Recusa as cores exclusivas da marca-mãe (Céu, Areia, Água, Bruma, Tinta, Asa e Sombra) e as
 * parecidas a olho como cor de loja.
 * Devolve o tema mais próximo para sugerir, ou null quando a cor pode ser usada.
 * Vale só no aplicativo: o banco não tem essa regra.
 */
export function reservedBrandColor(color: string | null | undefined) {
  if (!isMotherColor(color)) return null;
  const theme = nearestShopTheme(color);
  return { theme, message: t("brand.validate.reservedColor", { theme: t(theme.nameKey) }) };
}

function reservedBrandColorMessage(...colors: (string | null | undefined)[]) {
  for (const color of colors) {
    const reserved = reservedBrandColor(color);
    if (reserved) return reserved.message;
  }
  return null;
}

/** Retorna a mensagem de erro do rascunho ou null quando está pronto para salvar. */
export function validateBrandDraft(draft: BrandDraft) {
  if (!HEX_COLOR_PATTERN.test(draft.primary_color) || !HEX_COLOR_PATTERN.test(draft.accent_color)) {
    return t("brand.validate.colors");
  }
  const reserved = reservedBrandColorMessage(
    draft.primary_color,
    draft.accent_color,
    draft.logo_background_color,
  );
  if (reserved) return reserved;
  if (
    draft.logo_background_color !== null &&
    !HEX_COLOR_PATTERN.test(draft.logo_background_color)
  ) {
    return t("brand.validate.logoBg");
  }
  if (draft.display_name.trim().length > 80) return t("brand.validate.nameLength");
  const tagline = draft.tagline.trim();
  if (tagline.length === 0 || tagline.length > 60) {
    return t("brand.validate.tagline");
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
