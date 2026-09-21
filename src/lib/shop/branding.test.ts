import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_FONT_FAMILY,
  DEFAULT_PRIMARY_COLOR,
  brandDraftFromSettings,
  brandDraftToSettings,
  brandCornerClass,
  brandFontStack,
  brandFontScopeClass,
  brandVariables,
  customBrandFontFamily,
  contrastRatio,
  isBrandDraftDirty,
  normalizeCornerStyle,
  normalizeLoginLayout,
  readableBrandColor,
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
  fontFaceLabel,
  inferFontFile,
  normalizeFontFaces,
} from "./font-files.ts";

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
  assert.equal(readableBrandColor("#292925"), "#292925");
  const adjusted = readableBrandColor("#F5EFD9");
  assert.notEqual(adjusted, "#F5EFD9");
  assert.ok(contrastRatio(adjusted, "#F7F5F0") >= 4.5);
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
    "--brand-accent-readable": readableBrandColor("#CC8800"),
    "--primary": "#0055AA",
    "--primary-foreground": "#FFFFFF",
    "--gold": "#CC8800",
    "--gold-foreground": "#111111",
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
  primary_color: "#292925",
  accent_color: "#8A602F",
};

test("brand draft starts from saved settings and only reports real changes", () => {
  const draft = brandDraftFromSettings(savedSettings);
  assert.equal(draft.display_name, "");
  assert.equal(isBrandDraftDirty(draft, savedSettings), false);
  assert.equal(isBrandDraftDirty({ ...draft, display_name: "   " }, savedSettings), false);
  assert.equal(isBrandDraftDirty({ ...draft, primary_color: "#292925" }, savedSettings), false);
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
      accent_color: "#8A602F",
    },
  );
});

test("contrast ratio follows WCAG and flags weak combinations", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#FFFFFF")), 21);
  assert.ok(contrastRatio("#FFFFFF", "#292925") > 12);
  assert.ok(contrastRatio("#FFFFFF", "#C58B36") < 4.5);
});
