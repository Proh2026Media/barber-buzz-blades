import { Camera, Eye, ImageOff, Link2, Loader2, Plus, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ActionResult,
  CopyField,
  Field,
  FieldMessage,
  PersonAvatar,
  PreviewPanel,
  focusFirstInvalid,
  readableLink,
  type ActionState,
} from "@/components/visual";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogScrollArea,
  DialogTitle,
} from "@/components/ui/dialog";
import { SERVICE_IMAGE_ACCEPT, validateServiceImage } from "@/lib/shop/service-image";
import { PORTRAIT_FOCUS_Y } from "@/lib/shop/service-image-crop";
import { isValidBookingSlug, slugifyPt } from "@/lib/shop/slugify";
import { useI18n } from "@/lib/i18n";
import { ServiceImageCropDialog } from "../ServiceImageCropDialog";
import { DangerZone } from "./DangerZone";
import { showCounter } from "./format";
import type { SaveOutcome, StaffDraft, StaffRow } from "./types";

const BIO_MAX = 280;

type Errors = Partial<Record<"name" | "slug", string>>;

/**
 * Versão "durante a digitação" do link: minúsculas, sem acento e com espaço/símbolo virando
 * hífen, mas sem tirar o hífen do fim (senão "joao silva" vira "joaosilva" a cada tecla).
 * O `slugifyPt` completo entra ao sair do campo e no envio (`finalSlug`).
 */
function draftSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60);
}

/**
 * Janela de criar/editar profissional: prévia "Assim o cliente vê", foto, nome, link de
 * agendamento (com o endereço da loja fixo na frente e o nome preenchido sozinho) e o "sobre".
 */
export function StaffForm({
  open,
  onOpenChange,
  editing,
  linkOrigin,
  onSave,
  onUploadPhoto,
  onSaved,
  onDelete,
  onPause,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: StaffRow | null;
  /** Endereço público da loja (subdomínio ou domínio próprio), sem barra no fim. */
  linkOrigin: string | null;
  onSave: (draft: StaffDraft) => Promise<SaveOutcome>;
  onUploadPhoto: (file: File) => Promise<string>;
  onSaved: (outcome: SaveOutcome, draft: StaffDraft) => void;
  onDelete?: () => void;
  /** "Pausar" na zona de perigo (só para quem está ativo). Lança erro se não gravar. */
  onPause?: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [photoToCrop, setPhotoToCrop] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<ActionState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const saving = state === "saving";

  useEffect(() => {
    if (!open) return;
    setName(editing?.display_name ?? "");
    setSlug(editing?.booking_slug ?? (editing ? slugifyPt(editing.display_name) : ""));
    setSlugTouched(Boolean(editing));
    setBio(editing?.bio ?? "");
    setAvatar(editing?.avatar_url ?? null);
    setPhotoError(null);
    setErrors({});
    setState(null);
    setSubmitError(null);
  }, [open, editing]);

  const finalSlug = slugifyPt(slug || name);
  const host = linkOrigin ? readableLink(linkOrigin) : null;
  const slugChanged = Boolean(editing?.booking_slug) && finalSlug !== editing?.booking_slug;

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = t("catalog.staff.error.name");
    if (!finalSlug || !isValidBookingSlug(finalSlug)) next.slug = t("catalog.staff.error.slug");
    return next;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      setState(null);
      setSubmitError(null);
      window.setTimeout(() => focusFirstInvalid(formRef.current), 0);
      return;
    }
    const draft: StaffDraft = {
      display_name: name.trim(),
      booking_slug: finalSlug,
      bio: bio.trim() || null,
      avatar_url: avatar,
    };
    setState("saving");
    setSubmitError(null);
    try {
      const outcome = await onSave(draft);
      setState(null);
      onSaved(outcome, draft);
    } catch (cause) {
      setSubmitError(cause instanceof Error && cause.message ? cause.message : null);
      setState("error");
    }
  }

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = validateServiceImage(file);
    if (problem) {
      setPhotoError(problem);
      return;
    }
    setPhotoError(null);
    setPhotoToCrop(file);
  }

  async function applyCropped(file: File) {
    setUploading(true);
    try {
      setAvatar(await onUploadPhoto(file));
      setPhotoToCrop(null);
    } finally {
      setUploading(false);
    }
  }

  const errorCount = Object.values(errors).filter(Boolean).length;
  const shownName = name.trim() || t("catalog.staff.previewName");

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (saving || uploading) return;
          onOpenChange(next);
        }}
      >
        <DialogContent
          className="flex max-h-[88dvh] w-[calc(100%-2rem)] flex-col overflow-hidden rounded-3xl p-0 sm:max-w-lg sm:rounded-3xl"
          onEscapeKeyDown={(event) => {
            if (saving) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (saving) event.preventDefault();
          }}
        >
          {/* Título fixo: o "×" da janela não cobre o conteúdo que rola. */}
          <div className="border-b border-border px-5 pb-3 pr-14 pt-5 sm:px-6">
            <DialogTitle>
              {editing ? t("shop.staffForm.editTitle") : t("shop.staffForm.newTitle")}
            </DialogTitle>
            <DialogDescription className="sr-only">{t("catalog.staff.formAria")}</DialogDescription>
          </div>
          <DialogScrollArea className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
            <form id="staff-form" ref={formRef} noValidate onSubmit={submit} className="space-y-5">
              <PreviewPanel
                title={t("catalog.preview.title")}
                icon={Eye}
                badge={t("catalog.preview.badge")}
              >
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    aria-label={
                      avatar ? t("catalog.image.changePhoto") : t("catalog.staff.addPhoto")
                    }
                    className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    <PersonAvatar
                      name={shownName}
                      src={avatar}
                      size="lg"
                      seed={editing?.id}
                      badge={
                        uploading ? (
                          <Loader2 className="motion-safe:animate-spin" aria-hidden />
                        ) : (
                          <Camera aria-hidden />
                        )
                      }
                    />
                  </button>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span
                      className={`block break-words text-sm font-bold hyphens-auto ${name.trim() ? "" : "text-muted-foreground"}`}
                    >
                      {shownName}
                    </span>
                    {bio.trim() ? (
                      <span className="line-clamp-2 block text-xs text-muted-foreground">
                        {bio.trim()}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-60"
                  >
                    <Camera className="size-4 text-gold" aria-hidden />
                    {avatar ? t("catalog.image.changePhoto") : t("catalog.staff.addPhoto")}
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      onClick={() => setAvatar(null)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40"
                    >
                      <ImageOff className="size-4 text-gold" aria-hidden />
                      {t("catalog.image.removePhoto")}
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={SERVICE_IMAGE_ACCEPT}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={pickFile}
                  />
                </div>
                {photoError ? (
                  <FieldMessage tone="error">{photoError}</FieldMessage>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("catalog.image.photoHint")}</p>
                )}
              </PreviewPanel>

              <Field label={t("catalog.staff.name")} required error={errors.name}>
                {(props) => (
                  <input
                    {...props}
                    value={name}
                    maxLength={80}
                    onChange={(event) => {
                      const next = event.target.value;
                      setName(next);
                      if (!slugTouched) setSlug(slugifyPt(next));
                      if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
                    }}
                    placeholder={t("catalog.staff.namePlaceholder")}
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                )}
              </Field>

              <Field
                label={
                  <span className="inline-flex items-center gap-2">
                    <Link2 className="size-4 text-gold" aria-hidden />
                    {t("catalog.staff.link")}
                  </span>
                }
                error={errors.slug}
                success={slugChanged && !errors.slug ? t("catalog.staff.oldLinkWorks") : undefined}
                hint={!editing ? t("catalog.staff.linkHint") : undefined}
              >
                {(props) => (
                  <div className="flex min-h-11 w-full items-stretch overflow-hidden rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
                    {host && (
                      <span
                        className="flex min-w-0 max-w-[45%] items-center border-r border-border bg-muted/50 px-2.5 text-xs text-muted-foreground"
                        title={`${host}/`}
                      >
                        <span className="truncate">{host}/</span>
                      </span>
                    )}
                    <input
                      {...props}
                      value={slug}
                      onChange={(event) => {
                        setSlugTouched(true);
                        setSlug(draftSlug(event.target.value));
                        if (errors.slug) setErrors((current) => ({ ...current, slug: undefined }));
                      }}
                      onBlur={() => setSlug((current) => slugifyPt(current))}
                      placeholder={slugifyPt(name) || t("catalog.staff.slugPlaceholder")}
                      className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm font-semibold outline-none"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                )}
              </Field>

              {editing?.booking_slug && linkOrigin && !slugChanged && (
                <CopyField
                  label={t("catalog.staff.linkReady")}
                  value={`${linkOrigin}/${editing.booking_slug}`}
                  shareTitle={editing.display_name}
                />
              )}

              <Field label={t("catalog.staff.bio")} optional>
                {(props) => (
                  <>
                    <textarea
                      {...props}
                      value={bio}
                      onChange={(event) => setBio(event.target.value.slice(0, BIO_MAX))}
                      placeholder={t("shop.staffForm.bioPlaceholder")}
                      rows={3}
                      maxLength={BIO_MAX}
                      className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                    {showCounter(bio.length, BIO_MAX) && (
                      <span className="block text-right text-xs text-muted-foreground tabular-nums">
                        {bio.length}/{BIO_MAX}
                      </span>
                    )}
                  </>
                )}
              </Field>

              {editing && onDelete && (
                <DangerZone
                  hint={t("catalog.staff.deleteHint")}
                  pauseLabel={t("catalog.staff.pause")}
                  onPause={editing.active ? onPause : undefined}
                  deleteLabel={t("shop.deleteStaff.confirm")}
                  onDelete={onDelete}
                  disabled={saving}
                />
              )}
            </form>
          </DialogScrollArea>

          <div className="space-y-2 border-t border-border bg-card p-4">
            {errorCount > 0 && (
              <FieldMessage tone="error">
                {errorCount === 1
                  ? t("catalog.form.fixOne")
                  : t("catalog.form.fixMany", { count: errorCount })}
              </FieldMessage>
            )}
            <ActionResult
              state={state === "error" ? "error" : null}
              text={submitError ?? t("catalog.staff.saveError")}
              onRetry={() => formRef.current?.requestSubmit()}
              reveal={false}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => onOpenChange(false)}
                className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-semibold"
              >
                {t("common.back")}
              </button>
              <button
                type="submit"
                form="staff-form"
                disabled={saving || uploading}
                className="action-button action-confirm flex-1"
              >
                {saving ? (
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                ) : editing ? (
                  <Save className="size-4" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                {saving
                  ? t("common.saving")
                  : editing
                    ? t("shop.staffForm.save")
                    : t("shop.staffForm.create")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ServiceImageCropDialog
        file={photoToCrop}
        onCancel={() => setPhotoToCrop(null)}
        onConfirm={applyCropped}
        title={t("shop.staffCrop.title")}
        description={t("shop.staffCrop.description")}
        imageAlt={t("shop.staffCrop.alt")}
        outputName="barbeiro-1x1.webp"
        focusY={PORTRAIT_FOCUS_Y}
        preview="round"
      />
    </>
  );
}
