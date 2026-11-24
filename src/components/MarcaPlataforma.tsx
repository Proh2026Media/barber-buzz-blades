import { useLayoutEffect, useRef, useState } from "react";
import { contrastRatio } from "@/lib/shop/branding";

type Variante = "cor" | "inversa" | "preta" | "branca";

/** Compõe os fundos translúcidos até a primeira superfície opaca. */
function varianteNoFundo(elemento: Element, pixel: CanvasRenderingContext2D): Variante {
  const rgb = [0, 0, 0];
  let restante = 1;
  for (let pai = elemento.parentElement; pai; pai = pai.parentElement) {
    const estilo = getComputedStyle(pai);
    if (estilo.backgroundImage !== "none") return "inversa";
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = estilo.backgroundColor;
    pixel.fillRect(0, 0, 1, 1);
    const cor = pixel.getImageData(0, 0, 1, 1).data;
    const cobertura = restante * cor[3] / 255;
    for (let i = 0; i < 3; i++) rgb[i] += cobertura * cor[i];
    restante -= cobertura;
    if (restante < 0.001) break;
  }
  if (restante > 0.05) return "inversa";
  const fundo = "#" + rgb.map(c => Math.round(c + restante * 255).toString(16).padStart(2, "0")).join("");
  const escura = contrastRatio("#20231F", fundo);
  const clara = contrastRatio("#F7F5EF", fundo);
  if (Math.max(escura, clara) < 4.5) {
    return contrastRatio("#000000", fundo) >= contrastRatio("#FFFFFF", fundo) ? "preta" : "branca";
  }
  return clara > escura ? "inversa" : "cor";
}

/** Em capas fotográficas com camada escura aprovada, a versão inversa é fixa. */
export function MarcaPlataforma({ composicao, fotoEscura = false, className = "", alt = "" }: {
  composicao: "simbolo" | "horizontal" | "principal";
  fotoEscura?: boolean;
  className?: string;
  alt?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [variante, definir] = useState<Variante>("cor");
  useLayoutEffect(() => {
    const img = ref.current;
    if (!img || fotoEscura) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const pixel = canvas.getContext("2d", {willReadFrequently: true});
    if (!pixel) return;
    const atualizar = () => definir(varianteNoFundo(img, pixel));
    atualizar();
    const observador = new MutationObserver(atualizar);
    for (let pai = img.parentElement; pai; pai = pai.parentElement) {
      observador.observe(pai, {attributes: true, attributeFilter: ["style", "class", "data-theme"]});
    }
    window.addEventListener("resize", atualizar);
    img.parentElement?.addEventListener("transitionend", atualizar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", atualizar);
      img.parentElement?.removeEventListener("transitionend", atualizar);
    };
  }, [fotoEscura]);
  const uso = fotoEscura ? "inversa" : variante;
  return <img ref={ref} alt={alt}
    className={`marca-plataforma marca-plataforma-${composicao} ${className}`}
    src={`/marca/bc-${composicao}-${uso}-sem-parafuso.svg`} />;
}
