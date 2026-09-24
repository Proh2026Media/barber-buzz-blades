import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import {
  Bell,
  Calendar,
  Camera,
  Check,
  Eye,
  Home,
  ImagePlus,
  Palette,
  Scissors,
  Sparkles,
  Star,
  Trash2,
  Type,
  Undo2,
  Upload,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import {
  BRAND_FONT_OPTIONS,
  BRAND_FONT_SCOPE_OPTIONS,
  BRAND_CORNER_OPTIONS,
  BRAND_LOGIN_LAYOUT_OPTIONS,
  CUSTOM_FONT_ACCEPT,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_LOGIN_IMAGE,
  DEFAULT_PRIMARY_COLOR,
  LOGO_ACCEPT,
  brandCornerClass,
  brandDraftFromSettings,
  brandFontScopeClass,
  brandVariables,
  isBrandDraftDirty,
  normalizeBrandFont,
  validateBrandDraft,
  validateBrandLogo,
  type BrandDraft,
} from "@/lib/shop/branding";
import { useShopFavicon } from "@/lib/shop/favicon";
import { persistBrandIdentity } from "@/lib/shop/branding-persist";
import {
  analyzeFontFiles,
  fontFaceLabel,
  inferFontFile,
  normalizeFontFaces,
  type PendingBrandFontFace,
} from "@/lib/shop/font-files";
import { BrandColorPicker } from "./BrandColorPicker";
import { BrandFontFace } from "./BrandFontFace";
import { Switch } from "@/components/ui/switch";
import { ServiceImageCropDialog } from "./ServiceImageCropDialog";
import { LoginLayoutPreview } from "./LoginLayoutPreview";
import { LoginScreenPreview } from "./LoginScreenPreview";
import { LoginPreviewDialog } from "./LoginPreviewDialog";

type BrandIdentityEditorProps = {
  /** Nome cadastrado da barbearia, usado quando o nome do cabeçalho fica vazio. */
  shopName: string;
  settings: Tables<"barbershop_settings">;
  mode: "supabase" | "demo";
  onSaved: (settings: Tables<"barbershop_settings">) => void;
  /** Quem está editando muda apenas os textos de apoio. */
  audience?: "shop" | "platform";
};

/**
 * Editor completo da identidade visual: logo, nome, frase, fonte e cores.
 * Mantém o próprio rascunho e só o substitui quando os dados salvos mudam,
 * para que recargas do painel (como o relógio da demo) não apaguem a edição.
 */
export function BrandIdentityEditor({
  shopName,
  settings,
  mode,
  onSaved,
  audience = "shop",
}: BrandIdentityEditorProps) {
  const nameId = useId();
  const taglineId = useId();
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
  const [saved, setSaved] = useState(false);
  const [loginPreviewOpen, setLoginPreviewOpen] = useState(false);

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
  const previewLogo = logoPreviewUrl ?? draft.logo_url;
  useShopFavicon(previewLogo);
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
      setError(problem);
      return;
    }
    setError(null);
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
    const problem = validateBrandLogo(file);
    if (problem) {
      setError(problem.replace("logo", "imagem"));
      return;
    }
    setError(null);
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
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
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
    setSaved(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (validationError) {
      setError(validationError);
      return;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar a identidade visual.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="brand-editor space-y-6" aria-busy={busy}>
      <BrandFontFace url={previewFontUrl} faces={previewFontFaces} />
      <div className="app-section-title">
        <Palette />
        <div>
          <h3>Identidade visual</h3>
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {audience === "platform"
              ? "Logo, nome, fonte e cores que os clientes e a equipe desta barbearia veem."
              : "Personalize a marca sem comprometer a leitura do restante do app."}
          </p>
        </div>
      </div>

      {/* Prévia ao vivo */}
      <section aria-label="Prévia da identidade" className="space-y-2">
        <div
          className={`brand-preview overflow-hidden rounded-3xl border border-border bg-card shadow-md ${brandFontScopeClass(draft.font_scope)} ${brandCornerClass(draft.corner_style)} ${draft.floating_chrome ? "brand-chrome-floating" : ""}`}
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
                {draft.tagline.trim() || "Sua frase aparece aqui"}
              </p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bell className="size-4" />
            </span>
          </div>
          <div className="space-y-3 px-4 py-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs font-bold text-gold">
                <Star className="size-4" />
                Cliente VIP · 250 pontos
              </span>
              <Sparkles className="size-4 text-gold" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="brand-content-title text-sm font-bold">Próximo horário livre</p>
                <p className="text-xs text-muted-foreground">Hoje às 15h com Bruno</p>
              </div>
              <span className="flex min-h-10 shrink-0 items-center rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground">
                Agendar
              </span>
            </div>
          </div>
          <div className="brand-preview-footer grid grid-cols-3 border-t border-border/60 bg-background/60 px-2 py-1.5 text-[10px] font-semibold">
            {[
              { label: "Início", icon: Home, active: true },
              { label: "Agenda", icon: Calendar, active: false },
              { label: "Pontos", icon: Star, active: false },
            ].map(({ label, icon: Icon, active }) => (
              <span
                key={label}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                <Icon className="size-4" />
                {label}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          A prévia muda na hora. O app só é atualizado quando você salvar.
        </p>
      </section>

      {/* Página de acesso */}
      <section className="space-y-4" aria-labelledby={`${nameId}-login`}>
        <div>
          <h4 id={`${nameId}-login`} className="text-sm font-bold">
            Página de acesso
          </h4>
          <p className="text-xs text-muted-foreground">
            Escolha como a foto e o formulário aparecem para clientes e equipe antes de entrar.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Modelo da página de acesso"
          className="grid gap-2 sm:grid-cols-3"
        >
          {BRAND_LOGIN_LAYOUT_OPTIONS.map((option) => {
            const selected = draft.login_layout === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ login_layout: option.value })}
                className={`login-model-option min-w-0 border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-background hover:border-primary/40"
                }`}
              >
                <LoginLayoutPreview
                  compact
                  layout={option.value}
                  imageUrl={previewLoginImage}
                  logoUrl={previewLogo}
                  logoBackgroundColor={draft.logo_background_color}
                  shopName={previewName}
                />
                <span className="mt-2 flex items-center justify-between gap-2 text-xs font-bold">
                  {option.label}
                  {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Prévia realista</p>
              <p className="text-[11px] text-muted-foreground">
                Mostra a página de acesso com a foto, cores e cantos atuais do rascunho.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLoginPreviewOpen(true)}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold hover:bg-muted"
            >
              <Eye className="size-4" aria-hidden="true" />
              Ver como fica
            </button>
          </div>
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
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Camera className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">Foto do login</span>
              <span className="block text-xs leading-relaxed text-muted-foreground">
                PNG, JPEG ou WebP até 2 MB. Você escolhe o enquadramento antes de salvar.
              </span>
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
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
              className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold hover:bg-muted"
            >
              <ImagePlus className="size-4" />
              {draft.login_image_url || loginImageFile ? "Trocar foto" : "Enviar foto"}
            </button>
            {(draft.login_image_url || loginImageFile) && (
              <button
                type="button"
                onClick={removeLoginImage}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" /> Padrão
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Logo e nome */}
      <section className="space-y-4" aria-labelledby={`${nameId}-section`}>
        <h4 id={`${nameId}-section`} className="text-sm font-bold">
          Logo e nome
        </h4>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
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
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label={previewLogo ? "Trocar logo" : "Escolher logo"}
              className="group relative flex size-28 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {previewLogo ? (
                <img src={previewLogo} alt="Logo atual" className="size-full object-contain p-2" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-muted-foreground">
                  <ImagePlus className="size-7" />
                  <span className="text-[11px] font-semibold">Sem logo</span>
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-[11px] font-bold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                {previewLogo ? "Trocar" : "Escolher"}
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
            <div className="flex flex-wrap justify-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-bold hover:bg-muted"
              >
                <ImagePlus className="size-3.5" />
                {previewLogo ? "Trocar" : "Escolher"}
              </button>
              {previewLogo && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-bold text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                  Remover
                </button>
              )}
            </div>
            <p className="max-w-[11rem] text-[11px] leading-snug text-muted-foreground">
              PNG, JPEG, WebP ou SVG até 2 MB. Quadrado fica melhor.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor={nameId} className="text-xs font-semibold text-muted-foreground">
                Nome no cabeçalho
              </label>
              <input
                id={nameId}
                maxLength={80}
                value={draft.display_name}
                onChange={(event) => update({ display_name: event.target.value })}
                placeholder={shopName}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Vazio usa o nome cadastrado: {shopName}.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={taglineId} className="text-xs font-semibold text-muted-foreground">
                Frase abaixo do nome
              </label>
              <input
                id={taglineId}
                required
                maxLength={60}
                value={draft.tagline}
                onChange={(event) => update({ tagline: event.target.value })}
                placeholder="Club & Lounge"
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {draft.tagline.length}/60
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Fonte */}
      <section className="space-y-4" aria-labelledby={`${nameId}-font`}>
        <div className="flex items-start gap-2">
          <Type className="mt-0.5 size-4 text-primary" aria-hidden="true" />
          <div>
            <h4 id={`${nameId}-font`} className="text-sm font-bold">
              Fonte da marca
            </h4>
            <p className="text-xs text-muted-foreground">
              O texto geral, campos e botões continuam em Inter para preservar a leitura.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Onde usar</p>
          <div
            role="radiogroup"
            aria-label="Onde aplicar a fonte da marca"
            className="grid gap-2 sm:grid-cols-2"
          >
            {BRAND_FONT_SCOPE_OPTIONS.map((scope) => {
              const selected = draft.font_scope === scope.value;
              return (
                <button
                  key={scope.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => update({ font_scope: scope.value })}
                  className={`min-h-16 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-bold">
                    {scope.label}
                    {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                    {scope.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/70 p-3" style={previewStyle}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Enviar fonte própria</p>
              <p className="text-[11px] text-muted-foreground">
                Uma fonte avulsa ou até 12 arquivos WOFF2, WOFF, TTF ou OTF da mesma família. O
                nome, peso e estilo são reconhecidos mesmo quando o arquivo contém hash.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fontInput.current?.click()}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-bold hover:bg-muted"
            >
              <Upload className="size-4" />
              {previewFontUrl ? "Trocar fonte/família" : "Escolher arquivos"}
            </button>
          </div>
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
          {previewFontUrl && (
            <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-xs font-bold">
                      {draft.custom_font_name || "Fonte personalizada"}
                    </p>
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {recognizedFontKind === "family" ? "Família reconhecida" : "Fonte avulsa"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {previewFontFaces.length > 1
                      ? `${previewFontFaces.length} variações prontas para títulos com peso correto.`
                      : recognizedFontKind === "family"
                        ? "Arquivo variável reconhecido como uma família de pesos."
                        : "Fonte avulsa: um único arquivo será usado nos títulos escolhidos."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeCustomFont}
                  className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                  Remover
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {previewFontFaces.map((face) => (
                  <span
                    key={`${face.file_name}-${face.weight}-${face.style}`}
                    title={face.file_name}
                    className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground"
                  >
                    {fontFaceLabel(face)}
                  </span>
                ))}
              </div>
              <div className="mt-2 min-w-0">
                <p
                  className="mt-1 truncate text-base font-bold"
                  style={{ fontFamily: "var(--brand-font)" }}
                >
                  {previewName}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              Peso e estilo no cabeçalho
            </p>
            <p className="text-[11px] text-muted-foreground">
              Escolha uma variação da família. A prévia mostra exatamente como o nome ficará.
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label="Peso e estilo da fonte no cabeçalho"
            className="flex flex-wrap gap-2"
            style={previewStyle}
          >
            {headerFaceOptions.map((face) => {
              const selected =
                draft.header_font_weight === face.weight && draft.header_font_style === face.style;
              return (
                <button
                  key={`${face.weight}-${face.style}`}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() =>
                    update({
                      header_font_weight: face.weight,
                      header_font_style: face.style,
                    })
                  }
                  className={`min-h-10 rounded-xl border px-3 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                  style={{
                    fontFamily: "var(--brand-font)",
                    fontWeight: face.weight,
                    fontStyle: face.style,
                  }}
                >
                  {fontFaceLabel(face)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Ou escolha da biblioteca
          </p>
          <div role="radiogroup" aria-label="Fonte do app" className="grid gap-2 sm:grid-cols-2">
            {BRAND_FONT_OPTIONS.map((font) => {
              const selected =
                !previewFontUrl && normalizeBrandFont(draft.font_family) === font.value;
              return (
                <button
                  key={font.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectLibraryFont(font.value)}
                  className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                  style={{ fontFamily: font.stack }}
                >
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xl font-extrabold ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                    aria-hidden="true"
                  >
                    Aa
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{font.label}</span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">
                      {font.hint}
                    </span>
                  </span>
                  {selected && (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Cantos */}
      <section className="space-y-3" aria-labelledby={`${nameId}-corners`}>
        <div>
          <h4 id={`${nameId}-corners`} className="text-sm font-bold">
            Formato dos cantos
          </h4>
          <p className="text-xs text-muted-foreground">
            Aplica o mesmo estilo a botões, campos, cartões e janelas para manter a interface
            consistente.
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Formato dos cantos do sistema"
          className="grid gap-2 sm:grid-cols-3"
        >
          {BRAND_CORNER_OPTIONS.map((option) => {
            const selected = draft.corner_style === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ corner_style: option.value })}
                className={`min-h-28 border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-background hover:border-primary/40"
                }`}
                style={{ borderRadius: option.panelRadius }}
              >
                <span className="mb-3 flex items-center gap-1.5" aria-hidden="true">
                  <span
                    className="h-7 flex-1 border border-primary/50 bg-primary/10"
                    style={{ borderRadius: option.controlRadius }}
                  />
                  <span
                    className="h-7 w-12 bg-primary"
                    style={{ borderRadius: option.buttonRadius }}
                  />
                </span>
                <span className="flex items-center justify-between gap-2 text-xs font-bold">
                  {option.label}
                  {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Estrutura do app */}
      <section className="space-y-3" aria-labelledby={`${nameId}-chrome`}>
        <div>
          <h4 id={`${nameId}-chrome`} className="text-sm font-bold">
            Cabeçalho e rodapé
          </h4>
          <p className="text-xs text-muted-foreground">
            Escolha se as barras ficam alinhadas às bordas ou afastadas igualmente da janela.
          </p>
        </div>
        <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3">
          <span className="min-w-0">
            <span className="block text-sm font-bold">Modo flutuante</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              Usa 1 rem de espaço nas laterais, no topo e na base — o mesmo recuo atual do menu.
            </span>
          </span>
          <Switch
            checked={draft.floating_chrome}
            onCheckedChange={(checked) => update({ floating_chrome: checked })}
            aria-label="Usar cabeçalho e rodapé flutuantes"
          />
        </label>
      </section>

      {/* Cores */}
      <section className="space-y-3" aria-labelledby={`${nameId}-colors`}>
        <div>
          <h4 id={`${nameId}-colors`} className="text-sm font-bold">
            Cores do sistema
          </h4>
          <p className="text-xs text-muted-foreground">
            Valem para o painel e para o app do cliente. Avisos de sucesso, erro e cancelamento
            mantêm cores próprias.
          </p>
          <p className="mt-2 rounded-xl border border-emerald-600/20 bg-emerald-600/10 px-3 py-2 text-[11px] font-semibold leading-relaxed text-emerald-800 dark:text-emerald-300">
            Contraste automático ativo: o sistema escolhe texto e ícones claros ou escuros e reforça
            a cor quando ela ficaria camuflada, sem alterar a cor de fundo da marca.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorPicker
            label="Cor principal"
            description="Botões, seleções, foco e navegação ativa."
            value={draft.primary_color}
            defaultValue={DEFAULT_PRIMARY_COLOR}
            onChange={(value) => update({ primary_color: value })}
          />
          <BrandColorPicker
            label="Cor de destaque"
            description="Detalhes, indicadores e fidelidade."
            value={draft.accent_color}
            defaultValue={DEFAULT_ACCENT_COLOR}
            sampleText="Cliente VIP"
            onChange={(value) => update({ accent_color: value })}
          />
        </div>
      </section>

      {/* Fundo da logo */}
      <section className="space-y-3" aria-labelledby={`${nameId}-logo-bg`}>
        <div>
          <h4 id={`${nameId}-logo-bg`} className="text-sm font-bold">
            Fundo da logo
          </h4>
          <p className="text-xs text-muted-foreground">
            Cor que preenche o quadrado da logo no cabeçalho. Use quando a logo não tem fundo
            próprio (transparente); deixe vazio para manter transparente.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorPicker
            label="Fundo da logo"
            description="Atrás da logo no cabeçalho do cliente."
            value={draft.logo_background_color ?? ""}
            defaultValue=""
            allowEmpty
            sampleText="Logo"
            onChange={(value) => update({ logo_background_color: value || null })}
          />
        </div>
      </section>

      {/* Ações */}
      <div className="brand-editor-actions sticky bottom-2 z-10 space-y-2 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        {error && (
          <p role="alert" className="text-xs font-semibold text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
            {busy
              ? "Salvando…"
              : dirty
                ? "Alterações ainda não salvas"
                : saved
                  ? "Identidade salva. Já aparece no app."
                  : "Tudo salvo"}
          </p>
          <div className="flex shrink-0 gap-2">
            {dirty && !busy && (
              <button
                type="button"
                onClick={discard}
                className="flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-bold hover:bg-muted"
              >
                <Undo2 className="size-4" />
                Descartar
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !dirty}
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <Check className="size-4" />
              {busy ? "Salvando…" : "Salvar identidade"}
            </button>
          </div>
        </div>
      </div>
      <ServiceImageCropDialog
        file={loginCropSource}
        title="Enquadrar foto do login"
        description="Arraste para escolher o ponto principal. O recorte quadrado se adapta aos três modelos sem perder qualidade."
        imageAlt="Prévia da foto da página de acesso"
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
