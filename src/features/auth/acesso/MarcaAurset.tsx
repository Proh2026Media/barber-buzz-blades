import type { CSSProperties } from "react";

import { AursetLogo } from "@/components/visual/AursetLogo";

/**
 * Marca da Aurset nas telas de acesso: embrulha o desenho único de src/components/visual.
 * - `horizontal`: símbolo + nome "aurset" em minúsculas, com a área de respiro.
 * - `simbolo`: só o símbolo.
 * Com `titulo`, vira imagem com nome acessível; sem ele, é decorativa.
 */
export function MarcaAurset({
  variante = "horizontal",
  titulo,
  className,
  style,
}: {
  variante?: "horizontal" | "simbolo";
  titulo?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <AursetLogo
      variant={variante === "simbolo" ? "simbolo" : "completa"}
      respiro={variante !== "simbolo"}
      title={titulo}
      className={className}
      style={style}
    />
  );
}
