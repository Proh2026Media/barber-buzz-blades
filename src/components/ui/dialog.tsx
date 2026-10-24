"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useDialogFocus } from "@/lib/use-return-focus";

function CloseLabel() {
  const { t } = useI18n();
  return <span className="sr-only">{t("common.close")}</span>;
}

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Tamanho da janela (docs/dispositivos-2026-10-21.md, seção 4). O padrão `md` é exatamente o
 * comportamento anterior, para as telas que já passam `className` continuarem iguais.
 * A partir de 768 px: sm 28rem, md 32rem, lg 44rem, xl 60rem e page (quase tela cheia).
 * Abaixo de 768 px, lg/xl/page têm a largura de md. Em lg/xl/page a caixa não rola: é uma grade
 * cabeçalho | corpo | rodapé e quem rola é o `DialogBody`.
 */
type DialogSize = "sm" | "md" | "lg" | "xl" | "booking" | "page";

const DIALOG_BOX_BASE =
  "fixed left-[50%] top-[50%] z-50 grid w-[calc(100vw-1.5rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg";

/* Caixa que rola por dentro (tamanhos curtos) × grade com corpo rolável (tamanhos largos). */
const DIALOG_BOX_SCROLL = "max-h-[calc(100dvh-2rem)] overflow-y-auto";
const DIALOG_BOX_GRID =
  "max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden";

const DIALOG_SIZE_CLASS: Record<DialogSize, string> = {
  sm: `${DIALOG_BOX_SCROLL} tablet:max-w-[28rem]`,
  md: DIALOG_BOX_SCROLL,
  lg: `${DIALOG_BOX_GRID} tablet:max-w-[44rem]`,
  xl: `${DIALOG_BOX_GRID} tablet:max-w-[60rem]`,
  booking: `${DIALOG_BOX_GRID} w-[calc(100vw-1rem)] tablet:max-w-[44rem] lg:max-w-[60rem]`,
  page: `${DIALOG_BOX_GRID} tablet:h-[calc(100dvh-3rem)] tablet:w-[calc(100vw-3rem)] tablet:max-w-[96rem]`,
};

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  size?: DialogSize;
  desktopSide?: boolean;
};

/**
 * Janela centrada. Exemplo de uma janela larga com campos à esquerda e resumo fixo à direita:
 *
 * ```tsx
 * <DialogContent size="lg">
 *   <DialogHeader>
 *     <DialogTitle>Novo serviço</DialogTitle>
 *   </DialogHeader>
 *   <DialogBody layout="split">
 *     <div className="space-y-4">…campos…</div>
 *     <DialogAside>…prévia…</DialogAside>
 *   </DialogBody>
 *   <DialogActions>
 *     <button className="action-button">Cancelar</button>
 *     <button className="action-button action-confirm">Salvar</button>
 *   </DialogActions>
 * </DialogContent>
 * ```
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      size = "md",
      desktopSide = false,
      onOpenAutoFocus,
      onCloseAutoFocus,
      ...props
    },
    ref,
  ) => {
    const focus = useDialogFocus({ onOpenAutoFocus, onCloseAutoFocus });
    return (
      <DialogPortal>
        <DialogOverlay className={desktopSide ? "desktop-side-overlay" : undefined} />
        <DialogPrimitive.Content
          ref={ref}
          data-size={size}
          data-desktop-side={desktopSide || undefined}
          className={cn(DIALOG_BOX_BASE, DIALOG_SIZE_CLASS[size], className)}
          {...props}
          {...focus}
        >
          {children}
          <DialogPrimitive.Close className="absolute right-1.5 top-1.5 z-20 inline-flex size-11 items-center justify-center rounded-[var(--button-radius)] bg-card/90 text-muted-foreground backdrop-blur-sm ring-offset-background cursor-pointer transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <CloseLabel />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("dialog-scroll-area", className)} {...props} />
  ),
);
DialogScrollArea.displayName = "DialogScrollArea";

/**
 * Corpo rolável das janelas lg/xl/page (ocupa a linha do meio da grade). `stack` empilha;
 * `split` põe, a partir de 768 px, o conteúdo à esquerda e o `DialogAside` fixo à direita.
 * Os recuos negativos levam a barra de rolagem até a borda da janela.
 */
const DialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { layout?: "stack" | "split" }
>(({ className, layout = "stack", ...props }, ref) => (
  <div
    ref={ref}
    data-layout={layout}
    className={cn(
      "dialog-scroll-area -mx-6 min-h-0 overflow-y-auto px-6",
      layout === "split"
        ? "flex flex-col gap-6 tablet:grid tablet:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] tablet:items-start"
        : "flex flex-col gap-4",
      className,
    )}
    {...props}
  />
));
DialogBody.displayName = "DialogBody";

/** Coluna da direita do `DialogBody layout="split"`: acompanha a rolagem a partir de 768 px. */
const DialogAside = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("tablet:sticky tablet:top-0 tablet:self-start", className)} {...props} />
);
DialogAside.displayName = "DialogAside";

/** Rodapé das janelas lg/xl/page: linha em cima, botões em coluna no celular e à direita a partir de 768 px. */
const DialogActions = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "-mx-6 -mb-6 flex flex-col gap-2 border-t border-border px-6 py-4 tablet:flex-row tablet:justify-end",
      className,
    )}
    {...props}
  />
);
DialogActions.displayName = "DialogActions";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogScrollArea,
  DialogBody,
  DialogAside,
  DialogActions,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  type DialogSize,
};
