import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Bell,
  Calendar,
  ChevronRight,
  Home,
  ImagePlus,
  LogIn,
  Maximize2,
  Palette,
  Pipette,
  RotateCcw,
  Scissors,
  Shapes,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Type,
  Upload,
  type LucideIcon,
} from "lucide-react";
import {
  ChoiceChips,
  Field,
  MoreDetails,
  Notice,
  STATE,
  StatusBadge,
  UnsavedBar,
  focusFirstInvalid,
} from "@/components/visual";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  BRAND_FONT_OPTIONS,
  BRAND_FONT_SCOPE_OPTIONS,
  BRAND_CORNER_OPTIONS,
  BRAND_LOGIN_LAYOUT_OPTIONS,
  CUSTOM_FONT_ACCEPT,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_CORNER_STYLE,
  DEFAULT_LOGIN_IMAGE,
  DEFAULT_PRIMARY_COLOR,
  HEX_COLOR_PATTERN,
  LOGO_ACCEPT,
  brandCornerClass,
  brandDraftFromSettings,
  brandFontScopeClass,
  brandVariables,
  contrastingForeground,
  isBrandDraftDirty,
  normalizeBrandFont,
  validateBrandDraft,
  validateBrandLogo,
  type BrandDraft,
} from "@/lib/shop/branding";
import { applyShopFavicon } from "@/lib/shop/favicon";
import { persistBrandIdentity } from "@/lib/shop/branding-persist";
import {
  analyzeFontFiles,
  inferFontFile,
  normalizeFontFaces,
  type PendingBrandFontFace,
} from "@/lib/shop/font-files";
import { BrandColorPicker } from "./BrandColorPicker";
import { BrandFontFace } from "./BrandFontFace";
import { CompactChoiceTiles } from "./settings/CompactChoiceTiles";
import type { EditorGuard } from "./settings/GuardedEditorDialog";
import { ServiceImageCropDialog } from "./ServiceImageCropDialog";
import { LoginLayoutPreview } from "./LoginLayoutPreview";
import { LoginScreenPreview } from "./LoginScreenPreview";
import { LoginPreviewDialog } from "./LoginPreviewDialog";
import { DesktopFitFrame, PhoneFitFrame } from "./PhoneFitFrame";
import { friendlyAuthError } from "@/lib/auth/friendly-error";

type BrandIdentityEditorProps = {
  /** Nome cadastrado da barbearia, usado quando o nome do cabeçalho fica vazio. */
  shopName: string;
  settings: Tables<"barbershop_settings">;
  mode: "supabase" | "demo";
  onSaved: (settings: Tables<"barbershop_settings">) => void;
  /** Quem está editando muda apenas os textos de apoio. */
  audience?: "shop" | "platform";
  /** Proteção da janela contra fechar com mudanças não salvas. */
  guard?: EditorGuard;
  /** Etapa aberta primeiro (ex.: "entrada" ao trocar a foto da capa da página). */
  initialStep?: BrandStep;
};

/**
 * Editor completo da identidade visual: logo, nome, frase, fonte e cores.
 * Mantém o próprio rascunho e só o substitui quando os dados salvos mudam,
 * para que recargas do painel (como o relógio da demo) não apaguem a edição.
 */
// Ordem de impacto: marca, cores, fonte, formato e, por fim, a tela de entrada.
const BRAND_STEPS = ["logo", "cores", "fonte", "formato", "entrada"] as const;
export type BrandStep = (typeof BRAND_STEPS)[number];

const STEP_ICONS: Record<BrandStep, LucideIcon> = {
  logo: ImagePlus,
  cores: Palette,
  fonte: Type,
  formato: Shapes,
  entrada: LogIn,
};

/** Combinações prontas de cor principal + destaque (valores da paleta curada). */
const COLOR_COMBOS = [
  { id: "classic", primary: "#292925", accent: "#8A602F", label: "brand.combo.classic" },
  { id: "night", primary: "#111827", accent: "#C58B36", label: "brand.combo.night" },
  { id: "petrol", primary: "#1F4E5F", accent: "#C2410C", label: "brand.combo.petrol" },
  { id: "navy", primary: "#234E70", accent: "#B45309", label: "brand.combo.navy" },
  { id: "moss", primary: "#3D5A40", accent: "#C58B36", label: "brand.combo.moss" },
  { id: "wine", primary: "#9F1239", accent: "#8A602F", label: "brand.combo.wine" },
] as const satisfies ReadonlyArray<{
  id: string;
  primary: string;
  accent: string;
  label: MessageKey;
}>;

/** Pesos da fonte com nomes simples (do mais fino ao mais grosso). */
function weightLabel(face: { weight: number; style: string }, t: ReturnType<typeof useI18n>["t"]) {
  const key = `brand.weight.${face.weight}` as MessageKey;
  const base = [100, 200, 300, 400, 500, 600, 700, 800, 900].includes(face.weight)
    ? t(key)
    : String(face.weight);
  return face.style === "italic" ? `${base} ${t("brand.font.italic")}` : base;
}

/** Bolinha de cor (ou xadrez para "sem fundo") dentro das pílulas. */
function Swatch({ color, empty }: { color?: string; empty?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`size-5 shrink-0 rounded-full border border-black/20 ${empty ? "checkerboard" : ""}`}
      style={empty ? undefined : { backgroundColor: color }}
    />
  );
}

/** Mini cabeçalho com as duas cores e o botão "Agendar" pintado. */
function ComboSketch({ primary, accent, book }: { primary: string; accent: string; book: string }) {
  return (
    <span className="flex flex-col gap-1.5 rounded-lg border border-black/10 bg-[#f7f5f0] p-2">
      <span className="flex items-center">
        <span
          className="size-4 rounded-full border border-black/15"
          style={{ backgroundColor: primary }}
        />
        <span
          className="-ms-1.5 size-4 rounded-full border border-black/15"
          style={{ backgroundColor: accent }}
        />
        <span className="ms-auto h-1.5 w-6 rounded-full" style={{ backgroundColor: accent }} />
      </span>
      <span
        className="truncate rounded-md px-1 py-1 text-center text-xs font-bold"
        style={{ backgroundColor: primary, color: contrastingForeground(primary) }}
      >
        {book}
      </span>
    </span>
  );
}

/** Onde a fonte da marca aparece: só o nome no topo × nome e títulos (em dourado). */
function FontScopeSketch({ scope }: { scope: "header" | "titles" }) {
  const titles = scope === "titles";
  return (
    <span className="flex flex-col gap-1.5 rounded-lg border border-black/10 bg-[#f7f5f0] p-2">
      <span className="h-2.5 w-3/4 rounded-full bg-[#8a602f]" />
      <span className={`h-2 w-1/2 rounded-full ${titles ? "bg-[#8a602f]" : "bg-black/20"}`} />
      <span className="h-1.5 w-full rounded-full bg-black/10" />
      <span className={`h-2 w-2/5 rounded-full ${titles ? "bg-[#8a602f]" : "bg-black/20"}`} />
      <span className="h-1.5 w-5/6 rounded-full bg-black/10" />
    </span>
  );
}

/** Barras do app coladas nas bordas × flutuantes, com espaço em volta. */
function ChromeSketch({ floating }: { floating: boolean }) {
  return (
    <span className="relative block aspect-[4/3] overflow-hidden rounded-lg border border-black/10 bg-[#eeebe4]">
      <span
        className={`absolute bg-[#292925] ${
          floating ? "inset-x-1.5 top-1.5 h-3 rounded-md" : "inset-x-0 top-0 h-3.5"
        }`}
      />
      <span className="absolute inset-x-3 top-7 h-1.5 rounded-full bg-black/15" />
      <span className="absolute inset-x-3 top-10 h-1.5 w-1/2 rounded-full bg-black/10" />
      <span
        className={`absolute bg-[#292925] ${
          floating ? "inset-x-1.5 bottom-1.5 h-3.5 rounded-md" : "inset-x-0 bottom-0 h-4"
        }`}
      />
    </span>
  );
}

export function BrandIdentityEditor({
  shopName,
  settings,
  mode,
  onSaved,
  audience = "shop",
  guard,
  initialStep = "logo",
}: BrandIdentityEditorProps) {
  const { t } = useI18n();
  const nameId = useId();
  const taglineId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const isMobile = useIsMobile();
  const fileInput = useRef<HTMLInputElement>(null);
  const loginPhotoInput = useRef<HTMLInputElement>(null);
  const fontInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<BrandDraft>(() => brandDraftFromSettings(settings));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [loginImageFile, setLoginImageFile] = useState<File | null>(null);
  const [loginImagePreviewUrl, setLoginImagePreviewUrl] = useState<string | null>(null);
  const [loginCropSource, setLoginCropSource] = useState<File | null>(null);
  const [pendingFontFaces, setPendingFontFaces] = useState<PendingBrandFontFace[] | null>(null);
  const [fontKind, setFontKind] = useState<"single" | "family" | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Arquivo recusado (tipo ou tamanho): aparece junto do quadro que o recebeu, não na barra de salvar.
  const [fileError, setFileError] = useState<{
    field: "logo" | "login" | "font";
    text: string;
  } | null>(null);
  const [saved, setSaved] = useState(false);
  const [loginPreviewOpen, setLoginPreviewOpen] = useState(false);
  const [step, setStep] = useState<BrandStep>(initialStep);
  // Erros de campo só aparecem depois da primeira tentativa de salvar.
  const [showErrors, setShowErrors] = useState(false);
  const [logoBgCustom, setLogoBgCustom] = useState(false);
  const bigPreviewRef = useRef<HTMLElement | null>(null);
  const [bigPreviewVisible, setBigPreviewVisible] = useState(true);
  useEffect(() => {
    const node = bigPreviewRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    // A mini prévia fixa entra quando sobra menos de um terço da prévia grande à vista.
    const observer = new IntersectionObserver(
      ([entry]) => setBigPreviewVisible(entry.isIntersecting && entry.intersectionRatio > 0.33),
      { threshold: [0, 0.33, 0.66, 1] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const stepIndex = BRAND_STEPS.indexOf(step);

  const savedKey = `${settings.barbershop_id}:${settings.updated_at}`;
  useEffect(() => {
    setDraft(brandDraftFromSettings(settings));
    setLogoFile(null);
    setLogoPreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
    setLoginImageFile(null);
    setLoginCropSource(null);
    setLoginImagePreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
    setPendingFontFaces((current) => {
      current?.forEach((face) => URL.revokeObjectURL(face.preview_url));
      return null;
    });
    setFontKind(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync only when the saved row changes
  }, [savedKey]);

  useEffect(
    () => () => {
      if (logoPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(logoPreviewUrl);
    },
    [logoPreviewUrl],
  );

  useEffect(
    () => () => {
      if (loginImagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(loginImagePreviewUrl);
    },
    [loginImagePreviewUrl],
  );

  useEffect(
    () => () => pendingFontFaces?.forEach((face) => URL.revokeObjectURL(face.preview_url)),
    [pendingFontFaces],
  );

  const dirty =
    logoFile !== null ||
    loginImageFile !== null ||
    pendingFontFaces !== null ||
    isBrandDraftDirty(draft, settings);
  const validationError = validateBrandDraft(draft);
  const taglineInvalid = draft.tagline.trim().length < 1 || draft.tagline.trim().length > 60;
  // O que mudou em cada etapa: vira um ponto âmbar no trilho de etapas.
  const savedDraft = useMemo(
    () => brandDraftFromSettings(settings),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcula só quando o salvo muda
    [savedKey],
  );
  const changed = (keys: (keyof BrandDraft)[]) =>
    keys.some((key) => JSON.stringify(draft[key]) !== JSON.stringify(savedDraft[key]));
  const stepChanged: Record<BrandStep, boolean> = {
    logo:
      logoFile !== null ||
      changed(["logo_url", "display_name", "tagline", "logo_background_color"]),
    cores: changed(["primary_color", "accent_color"]),
    fonte:
      pendingFontFaces !== null ||
      changed([
        "font_family",
        "font_scope",
        "header_font_weight",
        "header_font_style",
        "custom_font_url",
        "custom_font_name",
        "custom_font_faces",
      ]),
    formato: changed(["corner_style", "floating_chrome"]),
    entrada: loginImageFile !== null || changed(["login_layout", "login_image_url"]),
  };
  const previewLogo = logoPreviewUrl ?? draft.logo_url;
  // Mostra a logo em edição no favicon, mas ao fechar o editor devolve o
  // favicon salvo da loja (e não o ícone padrão), já que o efeito do painel
  // não roda de novo quando a logo salva continua a mesma.
  const savedLogoRef = useRef(settings.logo_url);
  useEffect(() => {
    savedLogoRef.current = settings.logo_url;
  }, [settings.logo_url]);
  useEffect(() => {
    applyShopFavicon(previewLogo);
  }, [previewLogo]);
  useEffect(
    () => () => applyShopFavicon(audience === "shop" ? savedLogoRef.current : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restaura só ao desmontar
    [],
  );
  const previewLoginImage = loginImagePreviewUrl ?? draft.login_image_url ?? DEFAULT_LOGIN_IMAGE;
  const previewName = draft.display_name.trim() || shopName;
  const previewFontFaces = pendingFontFaces
    ? pendingFontFaces.map((face) => ({
        url: face.preview_url,
        file_name: face.file_name,
        weight: face.weight,
        style: face.style,
      }))
    : normalizeFontFaces(draft.custom_font_faces);
  const previewFontUrl =
    previewFontFaces.find((face) => face.weight === 400)?.url ??
    previewFontFaces[0]?.url ??
    draft.custom_font_url;
  // Prévia da tela de entrada (passo "Tela de entrada"): computador em 16:10, celular reduzido.
  const loginScreen = (
    <LoginScreenPreview
      framed
      layout={draft.login_layout}
      shopName={previewName}
      logoUrl={previewLogo}
      logoBackgroundColor={draft.logo_background_color}
      loginImageUrl={previewLoginImage}
      primaryColor={draft.primary_color}
      accentColor={draft.accent_color}
      fontFamily={draft.font_family}
      customFontUrl={previewFontUrl}
      headerFontWeight={draft.header_font_weight}
      headerFontStyle={draft.header_font_style}
      cornerStyle={draft.corner_style}
    />
  );
  const recognizedFontKind =
    fontKind ??
    (previewFontFaces.length > 1 ||
    previewFontFaces.some((face) => inferFontFile({ name: face.file_name }).variable)
      ? "family"
      : "single");
  const hasVariableFont = previewFontFaces.some(
    (face) => inferFontFile({ name: face.file_name }).variable,
  );
  const headerFaceOptions = hasVariableFont
    ? Array.from({ length: 9 }, (_, index) => ({
        weight: (index + 1) * 100,
        style: previewFontFaces[0]?.style ?? ("normal" as const),
      }))
    : previewFontFaces.length
      ? previewFontFaces.map(({ weight, style }) => ({ weight, style }))
      : [400, 500, 600, 700, 800, 900].map((weight) => ({
          weight,
          style: "normal" as const,
        }));
  const previewStyle = brandVariables(
    draft.primary_color,
    draft.accent_color,
    draft.font_family,
    previewFontUrl,
    draft.header_font_weight,
    draft.header_font_style,
    draft.corner_style,
  ) as React.CSSProperties;

  function update(patch: Partial<BrandDraft>) {
    setSaved(false);
    setError(null);
    setDraft((current) => ({ ...current, ...patch }));
  }

  function acceptFile(file: File | null | undefined) {
    if (!file) return;
    const problem = validateBrandLogo(file);
    if (problem) {
      setFileError({ field: "logo", text: problem });
      return;
    }
    setFileError(null);
    setSaved(false);
    setLogoFile(file);
    setLogoPreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
    update({ logo_url: null });
  }

  function chooseLoginImage(file: File | null | undefined) {
    if (!file) return;
    const problem = validateBrandLogo(file, "image");
    if (problem) {
      setFileError({ field: "login", text: problem });
      return;
    }
    setFileError(null);
    setLoginCropSource(file);
  }

  function useCroppedLoginImage(file: File) {
    setSaved(false);
    setLoginImageFile(file);
    setLoginImagePreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setLoginCropSource(null);
  }

  function removeLoginImage() {
    setLoginImageFile(null);
    setLoginCropSource(null);
    setLoginImagePreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
    update({ login_image_url: null });
  }

  function acceptFonts(files: File[]) {
    if (!files.length) return;
    const result = analyzeFontFiles(files);
    if (result.error !== null) {
      setFileError({ field: "font", text: result.error });
      return;
    }
    setFileError(null);
    setSaved(false);
    setPendingFontFaces((current) => {
      current?.forEach((face) => URL.revokeObjectURL(face.preview_url));
      return [...result.faces];
    });
    setFontKind(result.kind);
    const preferredFace =
      result.faces.find((face) => face.weight === 400 && face.style === "normal") ??
      result.faces.find((face) => face.style === "normal") ??
      result.faces[0]!;
    update({
      custom_font_name: result.family,
      header_font_weight: preferredFace.weight,
      header_font_style: preferredFace.style,
    });
  }

  function removeCustomFont() {
    setPendingFontFaces((current) => {
      current?.forEach((face) => URL.revokeObjectURL(face.preview_url));
      return null;
    });
    setFontKind(null);
    update({ custom_font_url: null, custom_font_name: null, custom_font_faces: [] });
  }

  function selectLibraryFont(fontFamily: string) {
    removeCustomFont();
    update({ font_family: fontFamily });
  }

  function discard() {
    setDraft(brandDraftFromSettings(settings));
    setLogoFile(null);
    setLogoPreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
    setLoginImageFile(null);
    setLoginCropSource(null);
    setLoginImagePreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
    setPendingFontFaces((current) => {
      current?.forEach((face) => URL.revokeObjectURL(face.preview_url));
      return null;
    });
    setFontKind(null);
    setError(null);
    setFileError(null);
    setSaved(false);
  }

  /** Grava a identidade; devolve `true` quando salvou (usado também por "Salvar e sair"). */
  async function persist(): Promise<boolean> {
    if (busy) return false;
    if (validationError) {
      setShowErrors(true);
      // Leva à etapa do campo com problema: cores na etapa "Cores"; nome, frase e fundo
      // da logo na etapa "Logo e nome". Lá, o campo é marcado e recebe o foco.
      const colorsInvalid =
        !HEX_COLOR_PATTERN.test(draft.primary_color) || !HEX_COLOR_PATTERN.test(draft.accent_color);
      const logoBgInvalid =
        draft.logo_background_color !== null &&
        !HEX_COLOR_PATTERN.test(draft.logo_background_color);
      if (logoBgInvalid) setLogoBgCustom(true);
      setStep(colorsInvalid ? "cores" : "logo");
      setError(colorsInvalid || logoBgInvalid ? validationError : null);
      window.requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return false;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await persistBrandIdentity(
        settings,
        draft,
        logoFile,
        pendingFontFaces,
        mode,
        loginImageFile,
      );
      onSaved(next);
      setSaved(true);
      setShowErrors(false);
      return true;
    } catch (err) {
      setError(friendlyAuthError(err, t("brand.save.error")));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    void persist();
  }

  const persistRef = useRef(persist);
  persistRef.current = persist;
  useEffect(() => {
    guard?.setDirty(dirty);
  }, [guard, dirty]);
  useEffect(() => {
    if (!guard) return;
    guard.registerSave(() => persistRef.current());
    return () => guard.registerSave(null);
  }, [guard]);

  const nextStep = BRAND_STEPS[stepIndex + 1];
  const logoBgValue = draft.logo_background_color?.toUpperCase() ?? null;
  const logoBgChoice: string = logoBgCustom
    ? "custom"
    : logoBgValue === null
      ? "none"
      : logoBgValue === "#FFFFFF"
        ? "white"
        : logoBgValue === "#000000"
          ? "black"
          : logoBgValue === draft.primary_color.toUpperCase()
            ? "primary"
            : "custom";
  const comboValue =
    COLOR_COMBOS.find(
      (combo) =>
        combo.primary === draft.primary_color.toUpperCase() &&
        combo.accent === draft.accent_color.toUpperCase(),
    )?.id ?? null;
  const fontLibraryValue = previewFontUrl ? null : normalizeBrandFont(draft.font_family);
  /** Arquivo recusado: aviso vermelho junto do quadro, com o botão que abre a escolha de novo. */
  const fileNotice = (field: "logo" | "login" | "font") =>
    fileError?.field === field ? (
      <Notice
        tone="danger"
        title={fileError.text}
        action={{
          label: t(field === "font" ? "brand.file.chooseOtherFont" : "brand.file.chooseOtherImage"),
          icon: field === "font" ? Upload : ImagePlus,
          onClick: () =>
            (field === "logo"
              ? fileInput
              : field === "login"
                ? loginPhotoInput
                : fontInput
            ).current?.click(),
        }}
        onDismiss={() => setFileError(null)}
      />
    ) : null;

  return (
    <form
      ref={formRef}
      onSubmit={save}
      noValidate
      className="brand-editor min-w-0 space-y-5"
      aria-busy={busy}
    >
      <BrandFontFace url={previewFontUrl} faces={previewFontFaces} />
      {/* Prévia ao vivo, com o selo de não salva / igual ao app. */}
      <section ref={bigPreviewRef} aria-label={t("brand.preview.aria")} className="space-y-2">
        {/* Com mudança, o ponto na etapa e a barra de salvar já avisam: aqui só o "igual ao app". */}
        <div className="flex min-h-7 justify-end">
          {!dirty && <StatusBadge {...STATE.active} size="sm" label={t("brand.preview.same")} />}
        </div>
        <div
          className={`brand-preview overflow-hidden rounded-[var(--panel-radius)] border border-border bg-card shadow-md ${brandFontScopeClass(draft.font_scope)} ${brandCornerClass(draft.corner_style)} ${draft.floating_chrome ? "brand-chrome-floating" : ""}`}
          style={previewStyle}
        >
          <div className="brand-preview-header flex items-center gap-3 border-b border-border/60 py-3 pr-4">
            <span
              className="brand-preview-logo flex size-12 shrink-0 items-center justify-center overflow-hidden"
              style={{
                backgroundColor: draft.logo_background_color || "#ffffff",
              }}
            >
              {previewLogo ? (
                <img src={previewLogo} alt="" className="size-full object-contain p-[12.5%]" />
              ) : (
                <Scissors className="size-5 text-primary" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="brand-header-title truncate text-sm font-extrabold leading-tight">
                {previewName}
              </p>
              <p className="truncate text-[11px] font-medium text-primary">
                {draft.tagline.trim() || t("brand.preview.taglinePlaceholder")}
              </p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bell className="size-4" />
            </span>
          </div>
          <div className="space-y-3 px-4 py-4">
            <div className="flex items-center justify-between gap-3 rounded-[var(--panel-radius)] border border-gold/40 bg-gold/10 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs font-bold text-gold">
                <Star className="size-4" />
                {t("brand.preview.vip")}
              </span>
              <Sparkles className="size-4 text-gold" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="brand-content-title text-sm font-bold">
                  {t("brand.preview.nextSlot")}
                </p>
                <p className="text-xs text-muted-foreground">{t("brand.preview.nextSlotDetail")}</p>
              </div>
              <span className="flex min-h-10 shrink-0 items-center rounded-[var(--control-radius)] bg-primary px-4 text-xs font-bold text-primary-foreground">
                {t("brand.preview.book")}
              </span>
            </div>
          </div>
          <div className="brand-preview-footer grid grid-cols-3 border-t border-border/60 bg-background/60 px-2 py-1.5 text-[10px] font-semibold">
            {[
              { label: t("brand.preview.navHome"), icon: Home, active: true },
              { label: t("brand.preview.navSchedule"), icon: Calendar, active: false },
              { label: t("brand.preview.navPoints"), icon: Star, active: false },
            ].map(({ label, icon: Icon, active }) => (
              <span
                key={label}
                className={`flex flex-col items-center gap-0.5 rounded-[var(--control-radius)] py-1.5 ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                <Icon className="size-4" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="sticky -top-5 z-10 -mx-1 space-y-2 bg-card/95 px-1 pb-2 pt-3 backdrop-blur sm:-top-6">
        <div
          aria-hidden="true"
          hidden={bigPreviewVisible}
          className={`brand-preview me-10 flex items-center gap-3 overflow-hidden rounded-[var(--panel-radius)] border border-border bg-card px-3 py-2 ${brandFontScopeClass(draft.font_scope)} ${brandCornerClass(draft.corner_style)}`}
          style={previewStyle}
        >
          <span
            className="brand-preview-logo flex size-9 shrink-0 items-center justify-center overflow-hidden"
            style={{ backgroundColor: draft.logo_background_color || "#ffffff" }}
          >
            {previewLogo ? (
              <img src={previewLogo} alt="" className="size-full object-contain p-[12.5%]" />
            ) : (
              <Scissors className="size-4 text-primary" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="brand-header-title block truncate text-sm font-extrabold leading-tight">
              {previewName}
            </span>
            <span className="block truncate text-[11px] font-medium text-primary">
              {draft.tagline.trim() || t("brand.preview.taglinePlaceholder")}
            </span>
          </span>
        </div>
        {/* Trilho de etapas: rola para o lado no celular; ponto âmbar = etapa alterada. */}
        <div
          role="tablist"
          aria-label={t("brand.step.aria")}
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
        >
          {BRAND_STEPS.map((id) => {
            const selected = step === id;
            const Icon = STEP_ICONS[id];
            return (
              <button
                key={id}
                id={`${nameId}-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${nameId}-panel-${id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setStep(id)}
                onKeyDown={(event) => {
                  // Padrão de abas: setas, Home e End trocam de etapa; Tab sai do trilho.
                  const last = BRAND_STEPS.length - 1;
                  const index = BRAND_STEPS.indexOf(id);
                  const target =
                    event.key === "ArrowRight"
                      ? (index + 1) % BRAND_STEPS.length
                      : event.key === "ArrowLeft"
                        ? (index - 1 + BRAND_STEPS.length) % BRAND_STEPS.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? last
                            : null;
                  if (target === null) return;
                  event.preventDefault();
                  const nextId = BRAND_STEPS[target]!;
                  setStep(nextId);
                  document.getElementById(`${nameId}-tab-${nextId}`)?.focus();
                }}
                className={`relative flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/40"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(`brand.stepName.${id}` as const)}
                {stepChanged[id] && (
                  <>
                    <span
                      aria-hidden
                      className="tone-pending size-2 rounded-full bg-[color:var(--tone-line)] ring-2 ring-card"
                    />
                    <span className="sr-only">{t("visual.unsaved.badge")}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tela de entrada */}
      <section
        id={`${nameId}-panel-entrada`}
        role="tabpanel"
        aria-labelledby={`${nameId}-tab-entrada`}
        className="space-y-4"
        hidden={step !== "entrada"}
      >
        <CompactChoiceTiles
          legend={t("brand.login.modelAria")}
          value={draft.login_layout}
          onChange={(value) => update({ login_layout: value })}
          options={BRAND_LOGIN_LAYOUT_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
            description: t(option.hintKey),
            media: (
              <LoginLayoutPreview
                compact
                layout={option.value}
                imageUrl={previewLoginImage}
                logoUrl={previewLogo}
                logoBackgroundColor={draft.logo_background_color}
                shopName={previewName}
              />
            ),
          }))}
        />

        <div className="space-y-2">
          {/* No celular, a prévia é a tela de celular (igual ao "Celular" da tela cheia),
              reduzida para caber inteira: sem rolagem dentro da janela que já rola. */}
          {isMobile ? (
            <PhoneFitFrame className="login-preview-phone mx-auto w-full max-w-[17.5rem] rounded-[1.5rem] border border-border/40 shadow-lg">
              {loginScreen}
            </PhoneFitFrame>
          ) : (
            <DesktopFitFrame className="rounded-[var(--panel-radius)]">
              {loginScreen}
            </DesktopFitFrame>
          )}
          <button
            type="button"
            onClick={() => setLoginPreviewOpen(true)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40"
          >
            <Maximize2 className="size-4" aria-hidden="true" />
            {t("brand.login.fullscreen")}
          </button>
        </div>

        {/* Foto: a atual em miniatura, Trocar e Voltar à padrão (neutro, não apaga nada). */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/60 p-3">
          <img
            src={previewLoginImage}
            alt={t("brand.login.photoName")}
            className="h-16 w-16 shrink-0 rounded-xl object-cover"
          />
          <span className="min-w-0 flex-1 basis-32">
            <span className="block text-sm font-bold">{t("brand.login.photoName")}</span>
            {(draft.login_image_url || loginImageFile) && (
              <span className="block text-sm text-muted-foreground">
                {t("brand.login.photoCustom")}
              </span>
            )}
          </span>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <input
              ref={loginPhotoInput}
              type="file"
              accept={LOGO_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                chooseLoginImage(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => loginPhotoInput.current?.click()}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40 sm:flex-none"
            >
              <ImagePlus className="size-4" aria-hidden="true" />
              {draft.login_image_url || loginImageFile
                ? t("brand.login.changePhoto")
                : t("brand.login.uploadPhoto")}
            </button>
            {(draft.login_image_url || loginImageFile) && (
              <button
                type="button"
                onClick={removeLoginImage}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40 sm:flex-none"
              >
                <RotateCcw className="size-4" aria-hidden="true" /> {t("brand.login.backToDefault")}
              </button>
            )}
          </div>
        </div>
        {fileNotice("login")}
      </section>

      {/* Logo e nome */}
      <section
        id={`${nameId}-panel-logo`}
        role="tabpanel"
        aria-labelledby={`${nameId}-tab-logo`}
        className="space-y-5"
        hidden={step !== "logo"}
      >
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-3 text-center transition ${
              dragging ? "border-primary bg-primary/5" : "border-border bg-background/60"
            }`}
          >
            {/* O quadro inteiro é o botão; o rótulo fica sempre à vista (também no toque). */}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label={previewLogo ? t("brand.logo.changeAria") : t("brand.logo.chooseAria")}
              className="flex flex-col items-center gap-2 rounded-2xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className="flex size-28 items-center justify-center overflow-hidden rounded-2xl border border-border shadow-sm"
                style={{ backgroundColor: draft.logo_background_color || "#ffffff" }}
              >
                {previewLogo ? (
                  <img
                    src={previewLogo}
                    alt={t("brand.logo.currentAlt")}
                    className="size-full object-contain p-2"
                  />
                ) : (
                  <ImagePlus className="size-8 text-muted-foreground" aria-hidden="true" />
                )}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <ImagePlus className="size-4 text-gold" aria-hidden="true" />
                {previewLogo ? t("brand.logo.tapChange") : t("brand.logo.tapChoose")}
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={LOGO_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                acceptFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {previewLogo && (
              <button
                type="button"
                onClick={removeLogo}
                className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {t("brand.common.remove")}
              </button>
            )}
            <p className="max-w-[12rem] text-sm text-muted-foreground">
              {t("brand.logo.hintShort")}
            </p>
          </div>
          {fileError?.field === "logo" && (
            <div className="sm:col-span-2 sm:row-start-2">{fileNotice("logo")}</div>
          )}

          <div className="min-w-0 space-y-4">
            <Field id={nameId} label={t("brand.name.label")}>
              {(props) => (
                <input
                  {...props}
                  maxLength={80}
                  value={draft.display_name}
                  onChange={(event) => update({ display_name: event.target.value })}
                  placeholder={shopName}
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              )}
            </Field>
            <Field
              id={taglineId}
              required
              label={
                <>
                  {t("brand.tagline.label")}
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t("brand.tagline.required")}
                  </span>
                </>
              }
              hint={draft.tagline.length >= 48 ? `${draft.tagline.length}/60` : undefined}
              error={showErrors && taglineInvalid ? t("brand.validate.tagline") : undefined}
            >
              {(props) => (
                <input
                  {...props}
                  maxLength={60}
                  value={draft.tagline}
                  onChange={(event) => update({ tagline: event.target.value })}
                  placeholder={t("brand.tagline.placeholder")}
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              )}
            </Field>
          </div>
        </div>

        {/* Fundo da logo: escolhas rápidas com amostra; "Outra cor" abre o seletor completo. */}
        <div className="space-y-3">
          <ChoiceChips
            label={t("brand.logoBg.title")}
            value={logoBgChoice}
            onChange={(choice) => {
              if (choice === "custom") {
                setLogoBgCustom(true);
                return;
              }
              setLogoBgCustom(false);
              update({
                logo_background_color:
                  choice === "none"
                    ? null
                    : choice === "white"
                      ? "#FFFFFF"
                      : choice === "black"
                        ? "#000000"
                        : draft.primary_color.toUpperCase(),
              });
            }}
            options={[
              { value: "none", label: t("brand.color.noBackground"), media: <Swatch empty /> },
              { value: "white", label: t("brand.logoBg.white"), media: <Swatch color="#FFFFFF" /> },
              {
                value: "primary",
                label: t("brand.colors.primary"),
                media: <Swatch color={draft.primary_color} />,
              },
              { value: "black", label: t("brand.logoBg.black"), media: <Swatch color="#000000" /> },
              { value: "custom", label: t("brand.color.other"), icon: Pipette },
            ]}
          />
          {logoBgChoice === "custom" && (
            <BrandColorPicker
              label={t("brand.logoBg.title")}
              value={draft.logo_background_color ?? ""}
              defaultValue=""
              allowEmpty
              sampleText={t("brand.logoBg.sample")}
              onChange={(value) => update({ logo_background_color: value || null })}
            />
          )}
        </div>
      </section>

      {/* Fonte: biblioteca primeiro (a escolha mais comum), cada uma com o nome da barbearia. */}
      <section
        id={`${nameId}-panel-fonte`}
        role="tabpanel"
        aria-labelledby={`${nameId}-tab-fonte`}
        className="space-y-5"
        hidden={step !== "fonte"}
      >
        <CompactChoiceTiles
          legend={t("brand.font.libraryAria")}
          showLegend
          columns={2}
          value={fontLibraryValue}
          onChange={(value) => selectLibraryFont(value)}
          options={BRAND_FONT_OPTIONS.map((font) => ({
            value: font.value,
            label: font.label,
            description: t(font.hintKey),
            media: (
              <span
                className="block truncate rounded-lg bg-background px-2 py-2 text-lg font-extrabold leading-tight text-foreground"
                style={{ fontFamily: font.stack }}
              >
                {previewName}
              </span>
            ),
          }))}
        />

        <CompactChoiceTiles
          legend={t("brand.font.whereLabel")}
          showLegend
          columns={2}
          value={draft.font_scope}
          onChange={(value) => update({ font_scope: value })}
          options={BRAND_FONT_SCOPE_OPTIONS.map((scope) => ({
            value: scope.value,
            label: t(scope.labelKey),
            description: t(scope.hintKey),
            media: <FontScopeSketch scope={scope.value} />,
          }))}
        />

        <div style={previewStyle}>
          <ChoiceChips
            label={t("brand.font.weightTitle")}
            value={`${draft.header_font_weight}-${draft.header_font_style}`}
            onChange={(value) => {
              const [weight, style] = value.split("-");
              update({
                header_font_weight: Number(weight),
                header_font_style: style === "italic" ? "italic" : "normal",
              });
            }}
            options={headerFaceOptions.map((face) => ({
              value: `${face.weight}-${face.style}`,
              label: weightLabel(face, t),
              media: (
                <span
                  aria-hidden="true"
                  className="text-base leading-none"
                  style={{
                    fontFamily: "var(--brand-font)",
                    fontWeight: face.weight,
                    fontStyle: face.style,
                  }}
                >
                  Aa
                </span>
              ),
            }))}
          />
        </div>

        {/* Fonte própria: opção avançada, recolhida. */}
        <MoreDetails
          summary={t("brand.font.own")}
          icon={Upload}
          defaultOpen={Boolean(previewFontUrl)}
        >
          <div className="space-y-3" style={previewStyle}>
            <button
              type="button"
              onClick={() => fontInput.current?.click()}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:border-primary/40 sm:w-auto"
            >
              <Upload className="size-4" aria-hidden="true" />
              {previewFontUrl ? t("brand.font.changeFiles") : t("brand.font.chooseFiles")}
            </button>
            <input
              ref={fontInput}
              type="file"
              accept={CUSTOM_FONT_ACCEPT}
              multiple
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                acceptFonts(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            {fileNotice("font")}
            {previewFontUrl && (
              <div className="space-y-2 rounded-xl border border-border bg-background/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge
                    {...STATE.active}
                    label={
                      !hasVariableFont && previewFontFaces.length <= 1
                        ? t("brand.font.loadedOne")
                        : t("brand.font.loadedMany", {
                            count: hasVariableFont ? 9 : previewFontFaces.length,
                          })
                    }
                  />
                  <button
                    type="button"
                    onClick={removeCustomFont}
                    className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t("brand.common.remove")}
                  </button>
                </div>
                <p
                  className="truncate text-lg font-bold"
                  style={{ fontFamily: "var(--brand-font)" }}
                  title={draft.custom_font_name || t("brand.font.customFallback")}
                >
                  {previewName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {draft.custom_font_name || t("brand.font.customFallback")}
                  {recognizedFontKind === "family" ? "" : ` · ${t("brand.font.single")}`}
                </p>
              </div>
            )}
          </div>
        </MoreDetails>
      </section>

      {/* Cores: combinações prontas primeiro; depois, cada cor. */}
      <section
        id={`${nameId}-panel-cores`}
        role="tabpanel"
        aria-labelledby={`${nameId}-tab-cores`}
        className="space-y-5"
        hidden={step !== "cores"}
      >
        <CompactChoiceTiles
          legend={t("brand.combo.title")}
          showLegend
          value={comboValue}
          onChange={(id) => {
            const combo = COLOR_COMBOS.find((item) => item.id === id);
            if (combo) update({ primary_color: combo.primary, accent_color: combo.accent });
          }}
          options={COLOR_COMBOS.map((combo) => ({
            value: combo.id,
            label: t(combo.label),
            media: (
              <ComboSketch
                primary={combo.primary}
                accent={combo.accent}
                book={t("brand.preview.book")}
              />
            ),
          }))}
        />

        <div className="space-y-3">
          <p className="text-sm font-bold">{t("brand.colors.custom")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <BrandColorPicker
              label={t("brand.colors.primary")}
              description={t("brand.colors.primaryShort")}
              value={draft.primary_color}
              defaultValue={DEFAULT_PRIMARY_COLOR}
              onChange={(value) => update({ primary_color: value })}
            />
            <BrandColorPicker
              label={t("brand.colors.accent")}
              description={t("brand.colors.accentShort")}
              value={draft.accent_color}
              defaultValue={DEFAULT_ACCENT_COLOR}
              sampleText={t("brand.colors.vipSample")}
              onChange={(value) => update({ accent_color: value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <StatusBadge tone="success" icon={ShieldCheck} label={t("brand.colors.readingSafe")} />
          <MoreDetails>
            <p className="text-sm text-muted-foreground">{t("brand.colors.contrast")}</p>
          </MoreDetails>
        </div>
      </section>

      {/* Formato: cantos e barras, em cartões ilustrados. */}
      <section
        id={`${nameId}-panel-formato`}
        role="tabpanel"
        aria-labelledby={`${nameId}-tab-formato`}
        className="space-y-5"
        hidden={step !== "formato"}
      >
        <CompactChoiceTiles
          legend={t("brand.corners.title")}
          showLegend
          value={draft.corner_style}
          onChange={(value) => update({ corner_style: value })}
          options={BRAND_CORNER_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
            note: option.value === DEFAULT_CORNER_STYLE ? t("brand.corner.defaultNote") : undefined,
            description: t(option.hintKey),
            media: (
              <span
                className="flex flex-col gap-1.5 border border-border bg-background p-2"
                style={{ borderRadius: option.panelRadius }}
              >
                <span
                  className="h-5 border border-primary/50 bg-primary/10"
                  style={{ borderRadius: option.controlRadius }}
                />
                <span
                  className="h-5 w-2/3 bg-primary"
                  style={{ borderRadius: option.buttonRadius }}
                />
              </span>
            ),
          }))}
        />
        <CompactChoiceTiles
          legend={t("brand.chrome.title")}
          showLegend
          columns={2}
          value={draft.floating_chrome ? "floating" : "attached"}
          onChange={(value) => update({ floating_chrome: value === "floating" })}
          options={[
            {
              value: "attached",
              label: t("brand.chrome.attached"),
              note: t("brand.corner.defaultNote"),
              media: <ChromeSketch floating={false} />,
            },
            {
              value: "floating",
              label: t("brand.chrome.floatingTile"),
              description: t("brand.chrome.floatingAria"),
              media: <ChromeSketch floating />,
            },
          ]}
        />
      </section>

      {error && validationError && <Notice tone="danger" title={error} />}

      {nextStep && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setStep(nextStep)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          >
            {t("brand.step.next", { step: t(`brand.stepName.${nextStep}` as const) })}
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Salvar: barra fixa só quando há mudança, com o resultado embutido. */}
      <UnsavedBar
        dirty={dirty}
        saving={busy}
        state={busy ? "saving" : saved ? "saved" : error && !validationError ? "error" : null}
        stateText={saved ? t("brand.save.saved") : (error ?? undefined)}
        onSave={() => void persist()}
        onDiscard={discard}
        saveLabel={t("brand.save.submit")}
      />
      <ServiceImageCropDialog
        file={loginCropSource}
        title={t("brand.loginCrop.titleEntry")}
        description={t("brand.loginCrop.description")}
        imageAlt={t("brand.loginCrop.alt")}
        outputName="login-1x1.webp"
        onCancel={() => setLoginCropSource(null)}
        onConfirm={useCroppedLoginImage}
      />
      <LoginPreviewDialog
        open={loginPreviewOpen}
        onOpenChange={setLoginPreviewOpen}
        preview={{
          layout: draft.login_layout,
          shopName: previewName,
          logoUrl: previewLogo,
          logoBackgroundColor: draft.logo_background_color,
          loginImageUrl: previewLoginImage,
          primaryColor: draft.primary_color,
          accentColor: draft.accent_color,
          fontFamily: draft.font_family,
          customFontUrl: previewFontUrl,
          headerFontWeight: draft.header_font_weight,
          headerFontStyle: draft.header_font_style,
          cornerStyle: draft.corner_style,
        }}
      />
    </form>
  );
}
