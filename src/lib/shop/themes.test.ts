import assert from "node:assert/strict";
import test from "node:test";
import {
  brandVariables,
  contrastRatio,
  coresDoSelo,
  contrastingForeground,
  readableBrandColor,
  SHOP_DARK_READING_SURFACE,
  SHOP_LIGHT_READING_SURFACE,
} from "./branding.ts";
import {
  DEFAULT_SHOP_THEME_ID,
  KIT_NEUTRALS,
  MOTHER_EXCLUSIVE_COLORS,
  MOTHER_TOLERANCE,
  colorDistance,
  SHOP_THEMES,
  findShopTheme,
  isMotherColor,
  nearestShopTheme,
  shopThemeById,
} from "./themes.ts";
import { MESSAGES } from "../i18n/translate.ts";

const FAMILIES = [
  "pitanga",
  "pessego",
  "tangerina",
  "sol",
  "limao",
  "menta",
  "oceano",
  "lavanda",
  "ameixa",
  "rosa",
];
/** Superfícies de leitura no claro: área suave, Papel e Sal. */
const CARD_SURFACES = [SHOP_LIGHT_READING_SURFACE, "#FDFBF6", "#FFFFFF"];

test("são 12 temas: as dez famílias do kit e dois neutros, cada um com nome", () => {
  assert.equal(SHOP_THEMES.length, 12);
  assert.deepEqual(
    SHOP_THEMES.map((theme) => theme.id),
    [...FAMILIES, "neutro-claro", "neutro-escuro"],
  );
  assert.equal(SHOP_THEMES.filter((theme) => theme.kind === "familia").length, 10);
  assert.deepEqual(
    SHOP_THEMES.filter((theme) => theme.kind === "neutro").map((theme) => theme.scheme),
    ["claro", "escuro"],
  );
  for (const theme of SHOP_THEMES) {
    assert.ok(MESSAGES["pt-BR"]![theme.nameKey]?.trim(), `${theme.id} sem nome`);
  }
  assert.equal(shopThemeById(DEFAULT_SHOP_THEME_ID)?.kind, "neutro");
});

test("o par gravado (principal + destaque) identifica um único tema", () => {
  const pairs = new Set(SHOP_THEMES.map((theme) => `${theme.primary}/${theme.accent}`));
  assert.equal(pairs.size, SHOP_THEMES.length);
  for (const theme of SHOP_THEMES) {
    assert.equal(findShopTheme(theme.primary, theme.accent)?.id, theme.id);
    assert.equal(
      findShopTheme(theme.primary.toLowerCase(), theme.accent.toLowerCase())?.id,
      theme.id,
    );
    assert.match(theme.primary, /^#[0-9A-F]{6}$/);
    assert.match(theme.accent, /^#[0-9A-F]{6}$/);
  }
  assert.equal(findShopTheme("#123456", "#654321"), null);
});

test("nenhum tema usa cor da marca-mãe", () => {
  const mother = Object.values(MOTHER_EXCLUSIVE_COLORS) as string[];
  assert.deepEqual(mother, [
    "#9CD8D4",
    "#F5E0BC",
    "#AFDFDA",
    "#BEE4DC",
    "#14221F",
    "#B1C5C7",
    "#83A0A2",
  ]);
  for (const theme of SHOP_THEMES) {
    for (const [tone, value] of Object.entries({
      primary: theme.primary,
      accent: theme.accent,
      ...theme.leque,
    })) {
      assert.match(value, /^#[0-9A-F]{6}$/, `${theme.id}.${tone}`);
      assert.ok(!mother.includes(value), `${theme.id}.${tone} é cor da mãe`);
      assert.equal(isMotherColor(value), false, `${theme.id}.${tone} quase igual à mãe`);
    }
  }
});

test("os neutros só usam os oito neutros do kit", () => {
  const kit = Object.values(KIT_NEUTRALS) as string[];
  for (const theme of SHOP_THEMES.filter((item) => item.kind === "neutro")) {
    for (const value of [theme.primary, theme.accent, ...Object.values(theme.leque)]) {
      assert.ok(kit.includes(value), `${theme.id} usa ${value}, fora dos neutros`);
    }
  }
});

test("cada tema passa no contraste AA: texto, botão e detalhe", () => {
  for (const theme of SHOP_THEMES) {
    const { leque } = theme;
    // Texto sobre o chão e sobre a forma: 4,5:1.
    for (const floor of [leque.claro, leque.meio, leque.base, leque.forma]) {
      assert.ok(
        contrastRatio(leque.texto, floor) >= 4.5,
        `${theme.id}: texto ${leque.texto} sobre ${floor}`,
      );
    }
    // Botão: o texto que o app põe sobre a cor principal.
    assert.ok(
      contrastRatio(contrastingForeground(theme.primary), theme.primary) >= 4.5,
      `${theme.id}: texto do botão`,
    );
    assert.ok(
      contrastRatio(contrastingForeground(theme.accent), theme.accent) >= 4.5,
      `${theme.id}: texto sobre o destaque`,
    );
    // Botão e destaque como elemento de interface sobre os cartões: 3:1.
    // Destaque como texto sobre os cartões: 4,5:1 sem correção.
    for (const card of CARD_SURFACES) {
      assert.ok(contrastRatio(theme.primary, card) >= 3, `${theme.id}: botão sobre ${card}`);
      assert.ok(contrastRatio(theme.accent, card) >= 4.5, `${theme.id}: destaque sobre ${card}`);
    }
    // Detalhe (ícone, ponto, traço) sobre o chão: 3:1.
    for (const floor of [leque.claro, leque.meio, leque.base]) {
      assert.ok(
        contrastRatio(leque.detalhe, floor) >= 3,
        `${theme.id}: detalhe ${leque.detalhe} sobre ${floor}`,
      );
    }
  }
});

test("as variáveis da loja expõem o leque inteiro do tema e a tinta legível", () => {
  for (const theme of SHOP_THEMES) {
    const vars = brandVariables(theme.primary, theme.accent) as Record<string, string>;
    assert.equal(vars["--brand-tema"], theme.id);
    assert.equal(vars["--brand-esquema"], theme.scheme);
    assert.equal(vars["--brand-primary"], theme.primary);
    assert.equal(vars["--brand-accent"], theme.accent);
    assert.equal(vars["--brand-chao-claro"], theme.leque.claro);
    assert.equal(vars["--brand-chao-meio"], theme.leque.meio);
    assert.equal(vars["--brand-chao-base"], theme.leque.base);
    assert.equal(vars["--brand-sobre-chao"], theme.leque.texto);
    assert.equal(vars["--brand-forma"], theme.leque.forma);
    assert.equal(vars["--brand-detalhe"], theme.leque.detalhe);
    assert.equal(vars["--brand-medio"], theme.leque.medio);
    assert.equal(vars["--brand-medio-ui"], theme.leque.medioUi);
    assert.equal(vars["--brand-profundo"], theme.leque.profundo);
    assert.equal(vars["--brand-par"], theme.leque.par);
    assert.equal(vars["--brand-borda"], theme.leque.borda);
    assert.equal(vars["--brand-sombra"], theme.leque.sombra);
    // A cor principal como texto é reforçada até 4,5:1 na superfície de leitura do tema (o tom
    // de botão sozinho fica entre 4,4 e 4,6 em algumas famílias). Num tema de chão escuro a
    // superfície de leitura é a escura, em qualquer modo.
    const reading =
      theme.scheme === "escuro" ? SHOP_DARK_READING_SURFACE : SHOP_LIGHT_READING_SURFACE;
    assert.ok(contrastRatio(vars["--brand-primary-readable"]!, reading) >= 4.5, theme.id);
    assert.ok(contrastRatio(vars["--brand-accent-readable"]!, reading) >= 4.5, theme.id);
    assert.ok(
      contrastRatio(vars["--brand-accent-readable-dark"]!, SHOP_DARK_READING_SURFACE) >= 4.5,
      theme.id,
    );
    assert.ok(
      contrastRatio(vars["--brand-primary-readable-dark"]!, SHOP_DARK_READING_SURFACE) >= 4.5,
      theme.id,
    );
    assert.equal(vars["--brand-primary-readable"], readableBrandColor(theme.primary, reading));
    // Destaque como texto direto sobre o chão da página (tom mais forte do chão).
    assert.ok(
      contrastRatio(vars["--brand-accent-readable-page"]!, theme.leque.claro) >= 4.5,
      theme.id,
    );
  }
});

test("cores da mãe são reconhecidas e ganham a sugestão do tema mais próximo", () => {
  for (const color of Object.values(MOTHER_EXCLUSIVE_COLORS)) {
    assert.equal(isMotherColor(color), true);
    assert.equal(isMotherColor(color.toLowerCase()), true);
    assert.ok(SHOP_THEMES.includes(nearestShopTheme(color)));
  }
  // Um passo ao lado do Céu continua sendo o Céu.
  assert.equal(isMotherColor("#9DD9D5"), true);
  // A distância é a percebida (ΔE em Lab): Céu e Tinta deslocados continuam sendo da mãe.
  for (const near of ["#94D2CE", "#8FD0CC", "#1A2A26", "#16241F"]) {
    assert.equal(isMotherColor(near), true, near);
  }
  assert.ok(colorDistance("#9CD8D4", "#94D2CE") < MOTHER_TOLERANCE);
  assert.ok(colorDistance("#14221F", "#262626") > MOTHER_TOLERANCE);
  assert.ok(colorDistance("#B1C5C7", "#CACACA") > MOTHER_TOLERANCE);
  // Os neutros do kit continuam livres.
  for (const neutral of Object.values(KIT_NEUTRALS)) {
    assert.equal(isMotherColor(neutral), false, neutral);
  }
  assert.equal(isMotherColor("#FFFFFF"), false);
  assert.equal(isMotherColor("#3E9C7C"), false);
  assert.equal(isMotherColor(null), false);
  assert.equal(isMotherColor("ceu"), false);
  assert.equal(nearestShopTheme("#9CD8D4").id, "menta");
  assert.equal(nearestShopTheme("#F5E0BC").id, "pessego");
  assert.equal(nearestShopTheme(null).id, DEFAULT_SHOP_THEME_ID);
});

test("selos acompanham as cores da loja e mantêm as duas iniciais legíveis", () => {
  for (const tema of SHOP_THEMES) {
    const selo = coresDoSelo("loja", tema.primary, tema.accent);
    assert.ok(contrastRatio(selo.fundo, selo.letra1) >= 4.5);
    assert.ok(contrastRatio(selo.fundo, selo.letra2) >= 4.5);
    assert.ok(contrastRatio(selo.fundo, selo.anel) >= 3);
    assert.equal(selo.fundo, tema.leque.claro);
  }
  assert.deepEqual(coresDoSelo("loja-a"), coresDoSelo("loja-a", "#292925", "#8A602F"));
  assert.notDeepEqual(coresDoSelo("loja-a"), coresDoSelo("loja-b"));
});
