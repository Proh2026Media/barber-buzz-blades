import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_FONT_FAMILY,
  DEFAULT_PRIMARY_COLOR,
  LEGACY_DEFAULT_ACCENT_COLOR,
  LEGACY_DEFAULT_PRIMARY_COLOR,
  isMotherFloor,
  BRAND_PALETTE,
  brandDraftFromSettings,
  brandDraftToSettings,
  brandCornerClass,
  brandFontStack,
  brandFontScopeClass,
  brandTheme,
  brandVariables,
  customBrandFontFamily,
  customBrandLeque,
  isUnchosenBrandColors,
  reservedBrandColor,
  resolveBrandColors,
  contrastRatio,
  isBrandDraftDirty,
  normalizeCornerStyle,
  normalizeLoginLayout,
  readableBrandColor,
  SHOP_DARK_READING_SURFACE,
  SHOP_LIGHT_READING_SURFACE,
  validateBrandDraft,
  contrastingForeground,
  normalizeBrandColor,
  normalizeBrandFont,
  normalizeBrandFontScope,
  validateBrandFont,
  validateBrandLogo,
} from "./branding.ts";
import {
  analyzeFontFiles,
  primaryFontFace,
  fontStyleOptions,
  fontFaceLabel,
  inferFontFile,
  normalizeFontFaces,
} from "./font-files.ts";
import { MOTHER_EXCLUSIVE_COLORS, SHOP_THEMES, isMotherColor } from "./themes.ts";
// Os testes dos temas rodam junto com os da marca (a lista de `npm test` cita só este arquivo).
import "./themes.test.ts";

test("brand colors normalize valid hex values and reject invalid input", () => {
  assert.equal(normalizeBrandColor("#1a2b3c", DEFAULT_PRIMARY_COLOR), "#1A2B3C");
  assert.equal(normalizeBrandColor("red", DEFAULT_PRIMARY_COLOR), DEFAULT_PRIMARY_COLOR);
  assert.equal(normalizeBrandColor(null, DEFAULT_ACCENT_COLOR), DEFAULT_ACCENT_COLOR);
});

test("logo validation accepts supported images and keeps the 2 MB limit", () => {
  assert.equal(validateBrandLogo({ type: "image/svg+xml", size: 1024 }), null);
  assert.equal(validateBrandLogo({ type: "image/png", size: 2 * 1024 * 1024 }), null);
  assert.equal(
    validateBrandLogo({ type: "application/pdf", size: 1024 }),
    "Use uma imagem PNG, JPEG, WebP ou SVG.",
  );
  assert.equal(
    validateBrandLogo({ type: "image/webp", size: 2 * 1024 * 1024 + 1 }),
    "O logo deve ter no máximo 2 MB.",
  );
});

test("brand fonts use the curated stack and invalid values fall back to Inter", () => {
  assert.equal(normalizeBrandFont("manrope"), "manrope");
  assert.equal(normalizeBrandFont("comic-sans"), DEFAULT_FONT_FAMILY);
  assert.match(brandFontStack("montserrat"), /Montserrat Variable/);
  assert.match(brandFontStack(null), /Inter Variable/);
});

test("custom font validation accepts web formats and keeps the 5 MB limit", () => {
  assert.equal(validateBrandFont({ type: "font/woff2", size: 1024, name: "brand.woff2" }), null);
  assert.equal(validateBrandFont({ type: "", size: 1024, name: "brand.otf" }), null);
  assert.match(
    validateBrandFont({ type: "application/pdf", size: 1024, name: "brand.pdf" }) ?? "",
    /WOFF2/i,
  );
  assert.match(
    validateBrandFont({ type: "font/ttf", size: 5 * 1024 * 1024 + 1, name: "brand.ttf" }) ?? "",
    /5 MB/i,
  );
});

test("o arquivo principal privilegia a letra normal independentemente da ordem do envio", () => {
  const bookItalic = { weight: 400, style: "italic" } as const;
  const medium = { weight: 500, style: "normal" } as const;
  const bold = { weight: 700, style: "normal" } as const;
  const book = { weight: 400, style: "normal" } as const;
  assert.equal(primaryFontFace([bookItalic, bold, medium]), medium);
  assert.equal(primaryFontFace([medium, bookItalic, bold]), medium);
  assert.equal(primaryFontFace([bookItalic, medium, book]), book);
  assert.equal(primaryFontFace([bookItalic]), bookItalic);
  assert.equal(primaryFontFace([]), undefined);
});

test("fontes variáveis oferecem os pesos do próprio estilo, inclusive com o itálico enviado primeiro", () => {
  const options = fontStyleOptions([
    { file_name: "Marca-Italic-VF.woff2", weight: 400, style: "italic" },
    { file_name: "Marca-Regular-VF.woff2", weight: 400, style: "normal" },
  ]);
  assert.equal(options.length, 18);
  assert.deepEqual(options.filter((face) => face.weight === 500), [
    { weight: 500, style: "normal" },
    { weight: 500, style: "italic" },
  ]);
});

test("font files are recognized as weights and styles of a family", () => {
  assert.deepEqual(inferFontFile({ name: "Montserrat-SemiBoldItalic.woff2" }), {
    family: "Montserrat",
    weight: 600,
    style: "italic",
    variable: false,
  });
  assert.equal(inferFontFile({ name: "Barber_Display-Regular.otf" }).family, "Barber Display");
  assert.deepEqual(
    inferFontFile({
      name: "BenguiatProITC-Bold.ba7977b0ecb46f5a878d.1401f2e7167484b1cc948df2b4dba3b.woff2",
    }),
    { family: "BenguiatProITC", weight: 700, style: "normal", variable: false },
  );
  assert.deepEqual(inferFontFile({ name: "BenguiatProITC-500Italic.abcdef123456.woff" }), {
    family: "BenguiatProITC",
    weight: 500,
    style: "italic",
    variable: false,
  });
  assert.deepEqual(inferFontFile({ name: "BarberSans[wght].ttf" }), {
    family: "BarberSans",
    weight: 400,
    style: "normal",
    variable: true,
  });
  assert.equal(fontFaceLabel({ weight: 700, style: "normal" }), "Bold");
  assert.deepEqual(
    normalizeFontFaces([
      { url: "https://example.com/a.woff2", file_name: "A.woff2", weight: 400, style: "normal" },
      { url: "invalid", file_name: "B.woff2", weight: 950, style: "normal" },
    ]),
    [{ url: "https://example.com/a.woff2", file_name: "A.woff2", weight: 400, style: "normal" }],
  );
});

test("hashed WOFF2 files are grouped as one family", () => {
  const names = [
    "BenguiatProITC-Bold.ba7977b0ecb46f5a878d.1401f2e7167484b1cc948df2b4dba3b.woff2",
    "BenguiatProITC-BoldItalic.e07fc197049e65.411b43bc0a3746dfb65bf0d33144b65.woff2",
    "BenguiatProITC-BookItalic.b9c5200bbd9e24.4f244e946befb244b5fb275ebad350a.woff2",
    "BenguiatProITC-Medium.633bcb5ea35c7420f4.16da5fc15dec692e30246a67e671e4a.woff2",
    "BenguiatProITC-MediumItalic.c16da55ff485.ebffbb0ea5b1f2398a8e437314cdcc9.woff2",
  ];
  const result = analyzeFontFiles(names.map((name) => new File(["font"], name)));
  assert.equal(result.error, null);
  if (result.error === null) {
    assert.equal(result.family, "BenguiatProITC");
    assert.equal(result.kind, "family");
    assert.equal(result.faces.length, 5);
  }
  if (result.error === null) {
    result.faces.forEach((face) => URL.revokeObjectURL(face.preview_url));
  }
});

test("brand font scope is limited to header or selected titles", () => {
  assert.equal(normalizeBrandFontScope("titles"), "titles");
  assert.equal(normalizeBrandFontScope("all"), "header");
  assert.equal(brandFontScopeClass("titles"), "brand-font-titles");
  assert.equal(brandFontScopeClass(null), "brand-font-header");
});

test("foreground chooses the higher-contrast black or white option", () => {
  assert.equal(contrastingForeground("#000000"), "#FFFFFF");
  assert.equal(contrastingForeground("#FFFFFF"), "#111111");
  assert.equal(contrastingForeground("#FFD400"), "#111111");
});

test("brand colors are automatically reinforced when they camouflage on reading surfaces", () => {
  assert.equal(readableBrandColor("#262626"), "#262626");
  const adjusted = readableBrandColor("#F5EFD9");
  assert.notEqual(adjusted, "#F5EFD9");
  assert.ok(contrastRatio(adjusted, SHOP_LIGHT_READING_SURFACE) >= 4.5);
});

test("corner styles normalize to the three supported visual languages", () => {
  assert.equal(normalizeCornerStyle("square"), "square");
  assert.equal(normalizeCornerStyle("round"), "round");
  assert.equal(normalizeCornerStyle("unknown"), "soft");
  assert.equal(brandCornerClass("round"), "brand-corners-round");
});

test("login layouts normalize to the three photographic models", () => {
  assert.equal(normalizeLoginLayout("cover"), "cover");
  assert.equal(normalizeLoginLayout("card"), "card");
  assert.equal(normalizeLoginLayout("unknown"), "split");
  assert.equal(normalizeLoginLayout(null), "split");
});

test("workspace variables keep brand typography separate from the system font", () => {
  assert.deepEqual(brandVariables("#0055aa", "#cc8800", "manrope"), {
    "--brand-primary": "#0055AA",
    "--brand-primary-foreground": "#FFFFFF",
    "--brand-accent": "#CC8800",
    "--brand-accent-foreground": "#111111",
    "--brand-primary-readable": "#0055AA",
    "--brand-primary-readable-dark": readableBrandColor("#0055AA", SHOP_DARK_READING_SURFACE),
    "--brand-accent-readable": readableBrandColor("#CC8800"),
    "--brand-accent-readable-dark": readableBrandColor("#CC8800", SHOP_DARK_READING_SURFACE),
    "--brand-accent-readable-page": readableBrandColor("#CC8800", "#B8CFE7"),
    // Cor livre: o leque é calculado da cor principal e da cor de destaque.
    "--brand-accent-readable-page-foreground": "#FFFFFF",
    "--brand-acao-escuro": "#73A2D0",
    "--brand-sobre-acao-escuro": "#001A33",
    "--brand-tema": "personalizado",
    "--brand-esquema": "claro",
    "--brand-chao-claro": "#B8CFE7",
    "--brand-chao-meio": "#CCDDEE",
    "--brand-chao-base": "#E0EBF5",
    "--brand-sobre-chao": "#001A33",
    "--brand-forma": "#E3BE73",
    "--brand-detalhe": readableBrandColor("#CC8800", "#B8CFE7", 3),
    "--brand-medio": "#0055AA",
    "--brand-medio-ui": "#0055AA",
    "--brand-profundo": "#001A33",
    "--brand-par": "#F5E7CC",
    "--brand-borda": "#99BBDD",
    "--brand-sombra": "#6699CC",
    "--brand-font": '"Manrope Variable", "Manrope", system-ui, sans-serif',
    "--brand-header-font-weight": "700",
    "--brand-header-font-style": "normal",
    "--radius": "0.9rem",
    "--control-radius": "0.9rem",
    "--panel-radius": "1.35rem",
    "--button-radius": "0.9rem",
  });
  const url = "https://example.com/font.woff2";
  assert.match(String(brandVariables(null, null, "inter", url)["--brand-font"]), /BarbaBrand_/);
  assert.equal(customBrandFontFamily(url), customBrandFontFamily(url));
});

const savedSettings = {
  display_name: null,
  tagline: "Club & Lounge",
  logo_url: null,
  logo_background_color: null,
  login_image_url: null,
  login_layout: "split",
  font_family: "inter",
  custom_font_url: null,
  custom_font_name: null,
  custom_font_faces: [],
  font_scope: "header",
  corner_style: "soft",
  floating_chrome: false,
  primary_color: "#262626",
  accent_color: "#666666",
};

test("brand draft starts from saved settings and only reports real changes", () => {
  const draft = brandDraftFromSettings(savedSettings);
  assert.equal(draft.display_name, "");
  assert.equal(isBrandDraftDirty(draft, savedSettings), false);
  assert.equal(isBrandDraftDirty({ ...draft, display_name: "   " }, savedSettings), false);
  assert.equal(isBrandDraftDirty({ ...draft, primary_color: "#262626" }, savedSettings), false);
  assert.equal(
    isBrandDraftDirty({ ...draft, logo_url: "data:image/png;base64,AA" }, savedSettings),
    true,
  );
  assert.equal(isBrandDraftDirty({ ...draft, font_family: "roboto" }, savedSettings), true);
  assert.equal(isBrandDraftDirty({ ...draft, font_scope: "titles" }, savedSettings), true);
  assert.equal(isBrandDraftDirty({ ...draft, floating_chrome: true }, savedSettings), true);
  assert.equal(
    isBrandDraftDirty({ ...draft, custom_font_url: "https://example.com/a.woff2" }, savedSettings),
    true,
  );
});

test("brand draft validation and normalization guard what gets saved", () => {
  const draft = brandDraftFromSettings(savedSettings);
  assert.equal(validateBrandDraft(draft), null);
  assert.match(validateBrandDraft({ ...draft, tagline: " " }) ?? "", /frase/i);
  assert.match(validateBrandDraft({ ...draft, accent_color: "#12" }) ?? "", /hexadecimal/i);
  assert.deepEqual(
    brandDraftToSettings({ ...draft, display_name: " Arena ", primary_color: "#abcdef" }),
    {
      display_name: "Arena",
      tagline: "Club & Lounge",
      logo_url: null,
      logo_background_color: null,
      login_image_url: null,
      login_layout: "split",
      font_family: "inter",
      custom_font_url: null,
      custom_font_name: null,
      custom_font_faces: [],
      font_scope: "header",
      header_font_weight: 700,
      header_font_style: "normal",
      corner_style: "soft",
      floating_chrome: false,
      primary_color: "#ABCDEF",
      accent_color: "#666666",
    },
  );
});

test("contrast ratio follows WCAG and flags weak combinations", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#FFFFFF")), 21);
  assert.ok(contrastRatio("#FFFFFF", "#262626") > 12);
  assert.ok(contrastRatio("#FFFFFF", "#C58B36") < 4.5);
});

test("loja sem tema escolhido usa o neutro claro, nunca a marca-mãe", () => {
  assert.equal(DEFAULT_PRIMARY_COLOR, "#262626");
  assert.equal(DEFAULT_ACCENT_COLOR, "#666666");
  assert.equal(isMotherColor(DEFAULT_PRIMARY_COLOR), false);
  assert.equal(isMotherColor(DEFAULT_ACCENT_COLOR), false);
  assert.equal(brandTheme(null, null)?.id, "neutro-claro");
  assert.equal(brandTheme("vermelho", "")?.id, "neutro-claro");
  assert.equal(brandVariables()["--brand-tema"], "neutro-claro");
  assert.equal(brandVariables()["--brand-primary"], "#262626");
  // `--primary` e `--gold` não saem mais em linha: quem escolhe por modo é o CSS do tema.
  assert.equal("--primary" in brandVariables(), false);
  assert.equal("--gold" in brandVariables(), false);
  assert.equal(brandVariables()["--brand-chao-claro"], "#E6E6E6");
});

test("o par antigo que o banco grava sozinho é lido como o tema neutro claro", () => {
  assert.equal(LEGACY_DEFAULT_PRIMARY_COLOR, "#292925");
  assert.equal(LEGACY_DEFAULT_ACCENT_COLOR, "#8A602F");
  assert.deepEqual(resolveBrandColors("#292925", "#8a602f"), {
    primary: "#262626",
    accent: "#666666",
  });
  assert.equal(isUnchosenBrandColors("#292925", "#8A602F"), true);
  assert.equal(isUnchosenBrandColors("#262626", "#666666"), true);
  assert.equal(isUnchosenBrandColors(null, null), true);
  assert.equal(isUnchosenBrandColors("#1C8062", "#0B707B"), false);
  // Só o par inteiro conta: quem mudou uma das duas cores escolheu.
  assert.deepEqual(resolveBrandColors("#292925", "#C58B36"), {
    primary: "#292925",
    accent: "#C58B36",
  });
  assert.equal(isUnchosenBrandColors("#292925", "#C58B36"), false);
  const legacy = { ...savedSettings, primary_color: "#292925", accent_color: "#8A602F" };
  const draft = brandDraftFromSettings(legacy);
  assert.equal(draft.primary_color, "#262626");
  assert.equal(draft.accent_color, "#666666");
  assert.equal(isBrandDraftDirty(draft, legacy), false);
  assert.equal(brandVariables("#292925", "#8A602F")["--brand-tema"], "neutro-claro");
});

test("cor livre que a loja já tem continua valendo, com o contraste corrigido", () => {
  const vars = brandVariables("#1F4E5F", "#C58B36") as Record<string, string>;
  assert.equal(vars["--brand-tema"], "personalizado");
  assert.equal(vars["--brand-primary"], "#1F4E5F");
  assert.equal(vars["--brand-accent"], "#C58B36");
  assert.ok(contrastRatio(vars["--brand-accent-readable"]!, SHOP_LIGHT_READING_SURFACE) >= 4.5);
  assert.ok(contrastRatio(vars["--brand-sobre-chao"]!, vars["--brand-chao-claro"]!) >= 4.5);
  assert.ok(contrastRatio(vars["--brand-detalhe"]!, vars["--brand-chao-claro"]!) >= 3);
  assert.equal(brandTheme("#1F4E5F", "#C58B36"), null);
  assert.equal(
    validateBrandDraft({
      ...brandDraftFromSettings(savedSettings),
      primary_color: "#1F4E5F",
      accent_color: "#C58B36",
    }),
    null,
  );
});

test("chão calculado de cor livre nunca fica com cara de marca-mãe", () => {
  // Um verde-água forte clareado cairia em cima do Céu: o chão passa ao neutro.
  const teal = customBrandLeque("#27B5AB", "#8A602F");
  assert.deepEqual([teal.claro, teal.meio, teal.base], ["#E6E6E6", "#E6E6E6", "#FFFFFF"]);
  for (let hue = 0; hue < 360; hue += 5) {
    for (const [saturation, lightness] of [
      [0.8, 0.4],
      [0.5, 0.5],
      [0.9, 0.3],
      [0.35, 0.6],
    ]) {
      const color = hslToHex(hue, saturation!, lightness!);
      const leque = customBrandLeque(color, color);
      for (const tone of [leque.claro, leque.meio, leque.base, leque.forma]) {
        assert.equal(isMotherFloor(tone), false, `${color} gera ${tone}`);
      }
    }
  }
});

function hslToHex(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const [r, g, b] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return `#${[r, g, b]
    .map((channel) =>
      Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();
}

test("cores exclusivas da marca-mãe são recusadas como cor de loja", () => {
  const draft = brandDraftFromSettings(savedSettings);
  for (const color of Object.values(MOTHER_EXCLUSIVE_COLORS)) {
    for (const field of ["primary_color", "accent_color", "logo_background_color"] as const) {
      const message = validateBrandDraft({ ...draft, [field]: color.toLowerCase() }) ?? "";
      assert.match(message, /reservada à Aurset/, `${field} ${color}`);
      assert.match(message, /Experimente o tema /, `${field} ${color}`);
    }
  }
  assert.equal(reservedBrandColor("#9CD8D4")?.theme.id, "menta");
  assert.equal(
    reservedBrandColor("#9CD8D4")?.message,
    "Essa cor é reservada à Aurset. Experimente o tema Menta.",
  );
  assert.equal(reservedBrandColor("#14221F")?.theme.id, "neutro-claro");
  assert.equal(reservedBrandColor("#1C8062"), null);
  assert.equal(reservedBrandColor(null), null);
  assert.equal(validateBrandDraft({ ...draft, logo_background_color: null }), null);
});

test("as amostras do seletor de cor livre vêm do kit e não têm cor da mãe", () => {
  assert.equal(BRAND_PALETTE.length, 14);
  assert.equal(new Set(BRAND_PALETTE.map((entry) => entry.value)).size, 14);
  for (const entry of BRAND_PALETTE) {
    assert.equal(isMotherColor(entry.value), false, entry.value);
    assert.ok(contrastRatio(contrastingForeground(entry.value), entry.value) >= 4.5, entry.value);
  }
});

test("cor da mãe gravada por outro caminho é lida como não escolhida", () => {
  // O banco não tem a regra: uma loja com Céu e Areia gravados aparece no neutro claro.
  assert.deepEqual(resolveBrandColors("#9CD8D4", "#F5E0BC"), {
    primary: "#262626",
    accent: "#666666",
  });
  assert.deepEqual(resolveBrandColors("#1C8062", "#14221f"), {
    primary: "#262626",
    accent: "#666666",
  });
  const vars = brandVariables("#9CD8D4", "#F5E0BC") as Record<string, string>;
  assert.equal(vars["--brand-tema"], "neutro-claro");
  assert.equal(vars["--brand-primary"], "#262626");
  assert.equal(vars["--brand-chao-claro"], "#E6E6E6");
  assert.equal(isUnchosenBrandColors("#9CD8D4", "#F5E0BC"), true);
  const draft = brandDraftFromSettings({
    ...savedSettings,
    primary_color: "#94D2CE",
    accent_color: "#C58B36",
  });
  assert.equal(draft.primary_color, "#262626");
});

test("cor parecida a olho com a da mãe também é recusada", () => {
  const draft = brandDraftFromSettings(savedSettings);
  // Céu e Tinta deslocados alguns passos, e as duas cores de apoio (Asa e Sombra).
  for (const color of ["#94D2CE", "#8FD0CC", "#1A2A26", "#16241F", "#B1C5C7", "#83A0A2"]) {
    assert.match(
      validateBrandDraft({ ...draft, primary_color: color }) ?? "",
      /reservada à Aurset/,
      color,
    );
    assert.match(
      validateBrandDraft({ ...draft, logo_background_color: color }) ?? "",
      /reservada à Aurset/,
      color,
    );
  }
  // Cores de verdade diferentes continuam livres.
  for (const color of ["#1F4E5F", "#2E7D6B", "#0B707B", "#262626", "#CACACA", "#FFFFFF"]) {
    assert.equal(validateBrandDraft({ ...draft, primary_color: color }), null, color);
  }
});

test("ação principal no escuro mantém a cor da família e lê bem", () => {
  for (const theme of SHOP_THEMES) {
    const vars = brandVariables(theme.primary, theme.accent) as Record<string, string>;
    const action = vars["--brand-acao-escuro"]!;
    const text = vars["--brand-sobre-acao-escuro"]!;
    // Botão sobre as superfícies escuras (cartão #161616, chão Grafite e área suave #333333).
    for (const surface of ["#161616", "#262626", SHOP_DARK_READING_SURFACE]) {
      assert.ok(contrastRatio(action, surface) >= 4.5, `${theme.id}: ${action} sobre ${surface}`);
    }
    assert.ok(contrastRatio(text, action) >= 4.5, `${theme.id}: ${text} sobre ${action}`);
    if (theme.kind === "neutro") assert.equal(action, "#FFFFFF");
    else assert.notEqual(action, "#FFFFFF", theme.id);
    // Destaque como fundo de selo: o texto sobre ele lê.
    assert.ok(
      contrastRatio(
        vars["--brand-accent-readable-page-foreground"]!,
        vars["--brand-accent-readable-page"]!,
      ) >= 4.5,
      theme.id,
    );
  }
});
