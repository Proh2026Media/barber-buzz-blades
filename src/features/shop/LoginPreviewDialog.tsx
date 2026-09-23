import { useState } from "react";
import { Monitor, Smartphone, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoginScreenPreview, type LoginScreenPreviewProps } from "./LoginScreenPreview";

type LoginPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: Omit<LoginScreenPreviewProps, "framed" | "className">;
};

/** Prévia em tela cheia: desktop ou celular, como o cliente verá no /auth. */
export function LoginPreviewDialog({ open, onOpenChange, preview }: LoginPreviewDialogProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 sm:rounded-none [&>button]:hidden"
        aria-describedby={undefined}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm font-bold">Prévia do login</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Como a página de acesso aparece de verdade. Nada é enviado nesta tela.
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div
              role="group"
              aria-label="Tamanho da prévia"
              className="flex rounded-xl border border-border bg-muted/60 p-1"
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
                Desktop
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
                Celular
              </button>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="app-icon-button"
              aria-label="Fechar prévia"
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
