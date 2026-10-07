import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Largura de um celular comum: a prévia é montada nela e depois reduzida. */
const PHONE_WIDTH = 390;

/**
 * Moldura de celular que mostra a tela inteira, sem rolagem própria: monta o conteúdo na
 * largura real de um celular e reduz tudo na mesma proporção para caber na largura
 * disponível. A altura acompanha o conteúdo, então o formulário aparece completo.
 * Use com a classe `login-preview-phone` (layout de celular da tela de entrada).
 */
export function PhoneFitFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ScaledFrame
      width={PHONE_WIDTH}
      className={cn("login-preview-phone-fit relative overflow-hidden", className)}
    >
      {children}
    </ScaledFrame>
  );
}

/** Largura de uma tela de computador comum: a prévia de computador é montada nela. */
const DESKTOP_WIDTH = 1280;

/**
 * Prévia de computador fiel: monta a tela de entrada numa janela de 1280 px (o mesmo desenho
 * que o cliente vê no computador) e reduz tudo para caber no quadro, sem o título passar da foto.
 */
export function DesktopFitFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ScaledFrame width={DESKTOP_WIDTH} className={cn("relative overflow-hidden", className)}>
      {children}
    </ScaledFrame>
  );
}

/** Monta o conteúdo numa largura fixa e o reduz na mesma proporção para caber no espaço. */
function ScaledFrame({
  children,
  className,
  width,
}: {
  children: ReactNode;
  className?: string;
  width: number;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; height: number } | null>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const scale = Math.min(1, outer.clientWidth / width);
      const height = Math.ceil(inner.offsetHeight * scale);
      setFit((current) =>
        current && current.scale === scale && current.height === height
          ? current
          : { scale, height },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={outerRef} className={className} style={fit ? { height: fit.height } : undefined}>
      <div
        ref={innerRef}
        style={{
          width,
          transform: fit && fit.scale !== 1 ? `scale(${fit.scale})` : undefined,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
