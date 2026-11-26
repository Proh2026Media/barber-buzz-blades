import type { MessageKey } from "../i18n/index.ts";

/**
 * Temas de cor que um estabelecimento pode escolher: as dez famílias do kit e dois neutros.
 *
 * Os valores vêm de `brand/build/cores_leque.json` (kit da holding) e foram copiados por script,
 * nunca à mão. Um tema não muda o que é salvo: o editor grava `primary` em `primary_color` e
 * `accent` em `accent_color`, e `brandVariables()` reconhece o par e expõe o leque inteiro.
 *
 * As cores da marca-mãe (Céu, Areia, Água, Bruma, Tinta, Asa e Sombra) são exclusivas da plataforma e da
 * holding: não entram em tema nenhum e não podem ser gravadas como cor de loja.
 */
export type ShopThemeId =
  | "pitanga"
  | "pessego"
  | "tangerina"
  | "sol"
  | "limao"
  | "menta"
  | "oceano"
  | "lavanda"
  | "ameixa"
  | "rosa"
  | "neutro-claro"
  | "neutro-escuro";

export type ShopThemeLeque = {
  /** Chão: o tom mais presente da família (60% da tela). */
  claro: string;
  /** Chão, um passo mais leve. */
  meio: string;
  /** Chão, o passo mais leve. */
  base: string;
  /** Forma: blocos e figuras grandes (25%). */
  forma: string;
  /** Detalhe: pontos, ícones e traços (10%). */
  detalhe: string;
  medio: string;
  /** Tom de botão e de elemento de interface. */
  medioUi: string;
  profundo: string;
  /** Cor de apoio, do lado oposto da roda. */
  par: string;
  borda: string;
  sombra: string;
  /** Texto sobre o chão (claro, meio e base). */
  texto: string;
};

export type ShopTheme = {
  id: ShopThemeId;
  kind: "familia" | "neutro";
  /** Chão claro ou chão escuro. */
  scheme: "claro" | "escuro";
  nameKey: MessageKey;
  /** Vai para `primary_color`: botões e menu ativo. */
  primary: string;
  /** Vai para `accent_color`: detalhes e pontos. */
  accent: string;
  leque: ShopThemeLeque;
};

/** Os oito neutros do kit (nomes provisórios). */
export const KIT_NEUTRALS = {
  sal: "#FFFFFF",
  gelo: "#E6E6E6",
  seixo: "#CACACA",
  pedra: "#838383",
  chumbo: "#666666",
  ardosia: "#4A4A4A",
  grafite: "#262626",
  breu: "#000000",
} as const;

export const SHOP_THEMES: readonly ShopTheme[] = [
  {
    id: "pitanga",
    kind: "familia",
    scheme: "claro",
    nameKey: "brand.theme.name.pitanga",
    primary: "#C04C49",
    accent: "#8C4751",
    leque: {
      claro: "#FFC4BA",
      meio: "#FFD0C9",
      base: "#FFD8D7",
      forma: "#FAA883",
      detalhe: "#8C4751",
      medio: "#ED6863",
      medioUi: "#C04C49",
      profundo: "#401514",
      par: "#CEE5FF",
      borda: "#D5C2BA",
      sombra: "#B0958B",
      texto: "#401514",
    },
  },
  {
    id: "pessego",
    kind: "familia",
    scheme: "claro",
    nameKey: "brand.theme.name.pessego",
    primary: "#AC5D3A",
    accent: "#A34230",
    leque: {
      claro: "#F7CDB4",
      meio: "#FCD7C3",
      base: "#FEDED2",
      forma: "#E1A959",
      detalhe: "#A34230",
      medio: "#E08A64",
      medioUi: "#AC5D3A",
      profundo: "#3D2016",
      par: "#CEE5FF",
      borda: "#D2C8BE",
      sombra: "#A99888",
      texto: "#3D2016",
    },
  },
  {
    id: "tangerina",
    kind: "familia",
    scheme: "claro",
    nameKey: "brand.theme.name.tangerina",
    primary: "#9F6214",
    accent: "#8C4A23",
    leque: {
      claro: "#F3C08B",
      meio: "#FDC8A3",
      base: "#FFD1C1",
      forma: "#DCC260",
      detalhe: "#8C4A23",
      medio: "#D88A2D",
      medioUi: "#9F6214",
      profundo: "#3A230A",
      par: "#CEE5FF",
      borda: "#C6B9A4",
      sombra: "#A79577",
      texto: "#3A230A",
    },
  },
  {
    id: "sol",
    kind: "familia",
    scheme: "claro",
    nameKey: "brand.theme.name.sol",
    primary: "#8E6E05",
    accent: "#805609",
    leque: {
      claro: "#EBE6A0",
      meio: "#F0F0B5",
      base: "#F2F5CE",
      forma: "#A4C061",
      detalhe: "#805609",
      medio: "#CFA52E",
      medioUi: "#8E6E05",
      profundo: "#33280A",
      par: "#BFE9FF",
      borda: "#D4DAC2",
      sombra: "#979E7C",
      texto: "#33280A",
    },
  },
  {
    id: "limao",
    kind: "familia",
    scheme: "claro",
    nameKey: "brand.theme.name.limao",
    primary: "#547D25",
    accent: "#367246",
    leque: {
      claro: "#CAE3A7",
      meio: "#D9EAB8",
      base: "#E2EFCE",
      forma: "#BBBB58",
      detalhe: "#367246",
      medio: "#7FA84E",
      medioUi: "#547D25",
      profundo: "#252E11",
      par: "#FFDBD1",
      borda: "#C9D2BC",
      sombra: "#8CA288",
      texto: "#252E11",
    },
  },
  {
    id: "menta",
    kind: "familia",
    scheme: "claro",
    nameKey: "brand.theme.name.menta",
    primary: "#1C8062",
    accent: "#0B707B",
    leque: {
      claro: "#9CDFBE",
      meio: "#B6E5BF",
      base: "#CFE7C4",
      forma: "#96C980",
      detalhe: "#0B707B",
      medio: "#3E9C7C",
      medioUi: "#1C8062",
      profundo: "#093425",
      par: "#FFDFD0",
      borda: "#9AB9A9",
      sombra: "#6FA797",
      texto: "#093425",
    },
  },
  {
    id: "oceano",
    kind: "familia",
    scheme: "claro",
    nameKey: "brand.theme.name.oceano",
    primary: "#3870BA",
    accent: "#4859A8",
    leque: {
      claro: "#AFCBEE",
      meio: "#BBD4F0",
      base: "#C3DBF1",
      forma: "#2BBFE7",
      detalhe: "#4859A8",
      medio: "#4479C4",
      medioUi: "#3870BA",
      profundo: "#0F2340",
      par: "#FFDBD1",
      borda: "#B9BCCA",
      sombra: "#9096A9",
      texto: "#0F2340",
    },
  },
  {
    id: "lavanda",
    kind: "familia",
    scheme: "claro",
    nameKey: "brand.theme.name.lavanda",
    primary: "#7367BC",
    accent: "#7A4E97",
    leque: {
      claro: "#CEC9EE",
      meio: "#D5D3F2",
      base: "#D7DBF5",
      forma: "#8CAEF2",
      detalhe: "#7A4E97",
      medio: "#7F72C9",
      medioUi: "#7367BC",
      profundo: "#211C3D",
      par: "#FEDBD0",
      borda: "#C6BFCB",
      sombra: "#A098A9",
      texto: "#211C3D",
    },
  },
  {
    id: "ameixa",
    kind: "familia",
    scheme: "claro",
    nameKey: "brand.theme.name.ameixa",
    primary: "#9E58A1",
    accent: "#884764",
    leque: {
      claro: "#E6C5E7",
      meio: "#E9D0ED",
      base: "#E9D9F3",
      forma: "#BEA4F1",
      detalhe: "#884764",
      medio: "#AC65AE",
      medioUi: "#9E58A1",
      profundo: "#381936",
      par: "#FFDFD0",
      borda: "#CFBFC8",
      sombra: "#A994A2",
      texto: "#381936",
    },
  },
  {
    id: "rosa",
    kind: "familia",
    scheme: "claro",
    nameKey: "brand.theme.name.rosa",
    primary: "#B74F6B",
    accent: "#864A78",
    leque: {
      claro: "#F2C4CF",
      meio: "#F5CFD9",
      base: "#F5D7E3",
      forma: "#FB958B",
      detalhe: "#864A78",
      medio: "#C95F7A",
      medioUi: "#B74F6B",
      profundo: "#3B1520",
      par: "#CBE6FE",
      borda: "#D1C0C1",
      sombra: "#AC9596",
      texto: "#3B1520",
    },
  },
  {
    id: "neutro-claro",
    kind: "neutro",
    scheme: "claro",
    nameKey: "brand.theme.name.neutro-claro",
    primary: "#262626",
    accent: "#666666",
    leque: {
      claro: "#E6E6E6",
      meio: "#E6E6E6",
      base: "#FFFFFF",
      forma: "#CACACA",
      detalhe: "#262626",
      medio: "#838383",
      medioUi: "#4A4A4A",
      profundo: "#262626",
      par: "#FFFFFF",
      borda: "#CACACA",
      sombra: "#838383",
      texto: "#262626",
    },
  },
  {
    id: "neutro-escuro",
    kind: "neutro",
    scheme: "escuro",
    nameKey: "brand.theme.name.neutro-escuro",
    primary: "#000000",
    accent: "#4A4A4A",
    leque: {
      claro: "#262626",
      meio: "#262626",
      base: "#000000",
      forma: "#666666",
      detalhe: "#E6E6E6",
      medio: "#838383",
      medioUi: "#CACACA",
      profundo: "#000000",
      par: "#4A4A4A",
      borda: "#4A4A4A",
      sombra: "#000000",
      texto: "#FFFFFF",
    },
  },
];

/** Tema de uma loja que ainda não escolheu nenhum. */
export const DEFAULT_SHOP_THEME_ID: ShopThemeId = "neutro-claro";

/**
 * Cores exclusivas da marca-mãe: nenhuma loja pode usar. Papel (#FDFBF6) fica de fora de
 * propósito: está a ΔE 3 do Sal, que é tom dos temas neutros, e barrar um quase branco não
 * protege a marca.
 */
export const MOTHER_EXCLUSIVE_COLORS = {
  ceu: "#9CD8D4",
  areia: "#F5E0BC",
  agua: "#AFDFDA",
  bruma: "#BEE4DC",
  tinta: "#14221F",
  asa: "#B1C5C7",
  sombra: "#83A0A2",
} as const;

/**
 * Folga, em ΔE (CIE Lab, 1976), para tratar como "a mesma cor" um valor parecido com o da mãe.
 * O kit pede 10,5 para tom novo de família; aqui o teto é 7 porque os neutros do próprio kit
 * ficam a 7,6 da Tinta (Grafite) e a 7,9 da Asa (Seixo) e precisam continuar valendo.
 */
export const MOTHER_TOLERANCE = 7;

const HEX = /^#[0-9a-f]{6}$/i;

function channels(color: string) {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ] as const;
}

function toLinear(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function labStep(value: number) {
  return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
}

/** Cor hexadecimal em CIE Lab (iluminante D65). */
function toLab(color: string) {
  const [red, green, blue] = channels(color).map(toLinear) as [number, number, number];
  const x = labStep((0.4124 * red + 0.3576 * green + 0.1805 * blue) / 0.95047);
  const y = labStep(0.2126 * red + 0.7152 * green + 0.0722 * blue);
  const z = labStep((0.0193 * red + 0.1192 * green + 0.9505 * blue) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)] as const;
}

/** Distância percebida entre duas cores hexadecimais (ΔE em CIE Lab; 0 é igual, ~100 é oposto). */
export function colorDistance(first: string, second: string) {
  const a = toLab(first);
  const b = toLab(second);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** A cor é uma das exclusivas da marca-mãe (o valor exato ou um parecido a olho)? */
export function isMotherColor(color: string | null | undefined, tolerance = MOTHER_TOLERANCE) {
  if (!color || !HEX.test(color)) return false;
  return Object.values(MOTHER_EXCLUSIVE_COLORS).some(
    (mother) => colorDistance(color, mother) <= tolerance,
  );
}

export function shopThemeById(id: string | null | undefined) {
  return SHOP_THEMES.find((theme) => theme.id === id) ?? null;
}

export function defaultShopTheme() {
  return shopThemeById(DEFAULT_SHOP_THEME_ID)!;
}

/** Reconhece o tema pelo par gravado (cor principal + cor de destaque). */
export function findShopTheme(
  primary: string | null | undefined,
  accent: string | null | undefined,
) {
  if (!primary || !accent) return null;
  const p = primary.toUpperCase();
  const a = accent.toUpperCase();
  return SHOP_THEMES.find((theme) => theme.primary === p && theme.accent === a) ?? null;
}

/** Tema com alguma cor mais parecida com a cor dada (para sugerir quando uma cor é recusada). */
export function nearestShopTheme(color: string | null | undefined): ShopTheme {
  if (!color || !HEX.test(color)) return defaultShopTheme();
  let best = defaultShopTheme();
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const theme of SHOP_THEMES) {
    const { claro, meio, base, forma, detalhe, medio, medioUi, profundo } = theme.leque;
    for (const tone of [claro, meio, base, forma, detalhe, medio, medioUi, profundo]) {
      const distance = colorDistance(color, tone);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = theme;
      }
    }
  }
  return best;
}
