import { Eye, Pencil, UserRound } from "lucide-react";
import { useState } from "react";
import {
  ActionResult,
  CopyField,
  PersonAvatar,
  PreviewPanel,
  SectionHeader,
  type ActionState,
} from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { StaffForm } from "../catalog/StaffForm";
import type { SaveOutcome, StaffDraft } from "../catalog/types";

/**
 * "Meu perfil e link" (todo profissional): como o cliente vê a pessoa (foto, nome e "sobre") e o
 * link de agendamento pronto para copiar ou enviar. "Editar meu perfil" abre a mesma janela do
 * cadastro de profissional, mas só com o que a própria pessoa pode mudar.
 */
export function MyProfileCard({
  staff,
  linkOrigin,
  slugLocked,
  photoLocked,
  onSave,
  onUploadPhoto,
}: {
  staff: Tables<"staff">;
  /** Endereço público da loja (sem barra no fim). */
  linkOrigin: string | null;
  /** O endereço do link só muda pelo dono (aba Equipe). */
  slugLocked: boolean;
  /** A foto só muda pelo dono (o banco ainda não aceita do Contratado). */
  photoLocked: boolean;
  onSave: (draft: StaffDraft) => Promise<SaveOutcome>;
  onUploadPhoto: (file: File) => Promise<string>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ state: ActionState; text: string } | null>(null);
  const link = staff.booking_slug && linkOrigin ? `${linkOrigin}/${staff.booking_slug}` : null;

  return (
    <section className="app-action-card space-y-4 p-4" aria-labelledby="my-profile-title">
      <SectionHeader
        icon={UserRound}
        id="my-profile-title"
        title={t("myProfile.title")}
        description={t("myProfile.hint")}
      />
      <PreviewPanel
        title={t("catalog.preview.title")}
        icon={Eye}
        badge={t("catalog.preview.badge")}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <PersonAvatar
            name={staff.display_name}
            src={staff.avatar_url}
            seed={staff.id}
            size="lg"
            className="shrink-0"
          />
          <span className="min-w-0 flex-1 space-y-0.5">
            <span className="block break-words text-sm font-bold">{staff.display_name}</span>
            <span className="line-clamp-2 block text-xs text-muted-foreground">
              {staff.bio?.trim() || t("myProfile.noBio")}
            </span>
          </span>
        </div>
      </PreviewPanel>
      {link ? (
        <CopyField label={t("myProfile.link")} value={link} shareTitle={staff.display_name} />
      ) : null}
      <button
        type="button"
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
        className="action-button action-edit min-h-11 w-full justify-center sm:w-auto"
      >
        <Pencil className="size-4" aria-hidden />
        {t("myProfile.edit")}
      </button>
      {result && (
        <ActionResult
          state={result.state}
          text={result.text}
          autoHideMs={result.state === "saved" ? 4000 : undefined}
          onDismiss={() => setResult(null)}
        />
      )}
      <StaffForm
        open={open}
        onOpenChange={setOpen}
        editing={staff}
        linkOrigin={linkOrigin}
        title={t("myProfile.edit")}
        saveLabel={t("myProfile.save")}
        slugLocked={slugLocked}
        photoLocked={photoLocked}
        onSave={onSave}
        onUploadPhoto={onUploadPhoto}
        onSaved={(outcome) => {
          setOpen(false);
          setResult(
            outcome === "pending"
              ? { state: "pending", text: t("myProfile.pending") }
              : { state: "saved", text: t("myProfile.saved") },
          );
        }}
      />
    </section>
  );
}
