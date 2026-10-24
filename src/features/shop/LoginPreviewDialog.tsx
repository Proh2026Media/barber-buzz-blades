import { Eye, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BrandFontFace } from "./BrandFontFace";
import { DevicePreview, StatusBadge } from "@/components/visual";
import { useDevice } from "@/lib/device";
import { useI18n } from "@/lib/i18n";
import { LoginScreenPreview, type LoginScreenPreviewProps } from "./LoginScreenPreview";

type LoginPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fontFaces?: unknown;
  preview: Omit<LoginScreenPreviewProps, "framed" | "className">;
};

/** Prévia em tela cheia: celular, tablet ou computador, como o cliente verá no /auth. */
export function LoginPreviewDialog({
  open,
  onOpenChange,
  preview,
  fontFaces,
}: LoginPreviewDialogProps) {
  const { t } = useI18n();
  // A tela de entrada muda com a largura real do aparelho: no celular só a versão de
  // celular é fiel, então a prévia começa (e fica) em "Celular" em telas pequenas.
  const wide = useDevice() !== "celular";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-surface-page flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden !rounded-none border-0 bg-background p-0 [&>button]:hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <DialogTitle className="truncate text-base font-bold">
              {t("brand.loginPreview.titleEntry")}
            </DialogTitle>
            <DialogDescription asChild>
              <span>
                <StatusBadge
                  tone="neutral"
                  icon={Eye}
                  size="sm"
                  label={t("brand.loginPreview.viewOnly")}
                />
              </span>
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="app-icon-button"
              aria-label={t("brand.loginPreview.close")}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div
          className={`min-h-0 flex-1 overflow-auto bg-[#141412] ${wide ? "p-4" : "flex justify-center p-4 sm:p-6"}`}
        >
          {wide ? (
            <DevicePreview>
              <BrandFontFace url={preview.customFontUrl} faces={fontFaces} />
              <LoginScreenPreview {...preview} framed={false} />
            </DevicePreview>
          ) : (
            <div className="login-preview-phone w-full max-w-[390px] overflow-hidden rounded-[1.75rem] border border-border/40 shadow-2xl">
              <LoginScreenPreview {...preview} framed />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
