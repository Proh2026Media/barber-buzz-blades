import { useEffect, useState } from "react";
import { Eye, Monitor, Smartphone, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { LoginScreenPreview, type LoginScreenPreviewProps } from "./LoginScreenPreview";

type LoginPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: Omit<LoginScreenPreviewProps, "framed" | "className">;
};

/** Prévia em tela cheia: desktop ou celular, como o cliente verá no /auth. */
export function LoginPreviewDialog({ open, onOpenChange, preview }: LoginPreviewDialogProps) {
  const { t } = useI18n();
  // A tela de entrada muda com a largura real do aparelho: no celular só a versão de
  // celular é fiel, então a prévia começa (e fica) em "Celular" em telas pequenas.
  const [wide, setWide] = useState(true);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      setWide(media.matches);
      if (!media.matches) setDevice("mobile");
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [open]);

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
            <div
              role="group"
              aria-label={t("brand.loginPreview.sizeAria")}
              className={wide ? "flex rounded-xl border border-border bg-muted/60 p-1" : "hidden"}
            >
              <button
                type="button"
                aria-pressed={device === "desktop"}
                onClick={() => setDevice("desktop")}
                className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${
                  device === "desktop"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Monitor className="size-4" aria-hidden="true" />
                {t("brand.loginPreview.computer")}
              </button>
              <button
                type="button"
                aria-pressed={device === "mobile"}
                onClick={() => setDevice("mobile")}
                className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${
                  device === "mobile"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Smartphone className="size-4" aria-hidden="true" />
                {t("brand.loginPreview.mobile")}
              </button>
            </div>
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
          className={`min-h-0 flex-1 overflow-auto bg-[#141412] ${
            device === "mobile" ? "flex justify-center p-4 sm:p-6" : ""
          }`}
        >
          <div
            className={
              device === "mobile"
                ? "login-preview-phone w-full max-w-[390px] overflow-hidden rounded-[1.75rem] border border-border/40 shadow-2xl"
                : "h-full min-h-[calc(100dvh-4.5rem)] w-full"
            }
          >
            <LoginScreenPreview {...preview} framed={device === "mobile"} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
