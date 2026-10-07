import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { Toaster as Sonner } from "sonner";

import { useTheme } from "@/lib/use-theme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Avisos no alto da tela: não disputam espaço com a barra inferior nem com o banner do PWA.
const TOAST_TOP_OFFSET = { top: "max(1rem, env(safe-area-inset-top))" };

// Mesmos ícones dos tons do sistema (src/components/visual/tones.ts); a cor e a faixa lateral
// de cada tipo vêm do bloco "Avisos rápidos" em styles.css.
const TOAST_ICONS = {
  success: <CheckCircle2 aria-hidden />,
  error: <XCircle aria-hidden />,
  warning: <AlertTriangle aria-hidden />,
  info: <Info aria-hidden />,
  loading: <Loader2 aria-hidden className="motion-safe:animate-spin" />,
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      position="top-center"
      offset={TOAST_TOP_OFFSET}
      mobileOffset={TOAST_TOP_OFFSET}
      icons={TOAST_ICONS}
      className="toaster group"
      // O CSS do sonner fica fora das camadas do Tailwind e venceria as classes: as cores
      // e o canto entram pelas variáveis dele, ligadas aos tokens do sistema.
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-border": "var(--border)",
          "--normal-text": "var(--card-foreground)",
          "--border-radius": "var(--panel-radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        // Segue o modo de canto escolhido (retos, semi arredondados, arredondados).
        style: { borderRadius: "var(--panel-radius)" },
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
