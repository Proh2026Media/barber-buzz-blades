import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * Logo aurset: símbolo de cantos levemente arredondados + nome em minúsculas. Fonte única do
 * desenho na plataforma (mestre em Aurset/logo/aurset-logo.svg); os demais componentes de
 * marca (página inicial, acesso, selo das telas de loja) só embrulham este.
 *
 * Tudo em `currentColor`: a cor vem do texto ao redor (Tinta no claro, Papel no escuro).
 * A logo nunca recebe a cor de um estabelecimento: não aplique `text-primary` nem `text-gold`.
 */
const SYMBOL_PATHS = [
  "M4 6A2 2 0 0 1 6 4H45.172A2 2 0 0 1 46.586 7.414L41.172 12.828A2 2 0 0 1 39.053 13.285A20 20 0 0 0 13.285 39.053A2 2 0 0 1 12.828 41.172L7.414 46.586A2 2 0 0 1 4 45.172Z",
  "M60 58A2 2 0 0 1 58 60H18.828A2 2 0 0 1 17.414 56.586L22.828 51.172A2 2 0 0 1 24.947 50.715A20 20 0 0 0 50.715 24.947A2 2 0 0 1 51.172 22.828L56.586 17.414A2 2 0 0 1 60 18.828Z",
] as const;

/** Nome "aurset" em curvas (uma letra por caminho). */
const WORDMARK_PATHS = [
  "M141.17 82.17Q140.87 81.04 140.75 79.7Q140.63 78.37 140.63 76.52H140.39V63.07Q140.39 60.85 139.14 59.69Q137.89 58.54 135.31 58.54Q132.83 58.54 131.36 59.45Q129.89 60.37 129.56 62.09H122.83Q123.3 58.17 126.61 55.72Q129.93 53.28 135.56 53.28Q141.39 53.28 144.39 55.93Q147.39 58.57 147.39 63.65V76.52Q147.39 77.85 147.57 79.23Q147.76 80.61 148.15 82.17ZM131.33 82.72Q127.06 82.72 124.53 80.58Q122 78.44 122 74.83Q122 70.96 124.83 68.67Q127.67 66.37 132.85 65.61L141.67 64.28V68.72L134 69.91Q131.48 70.3 130.24 71.28Q129 72.26 129 74.04Q129 75.69 130.16 76.54Q131.31 77.39 133.39 77.39Q136.37 77.39 138.38 75.88Q140.39 74.37 140.39 72.2L141.15 76.48Q140.04 79.54 137.51 81.13Q134.98 82.72 131.33 82.72Z",
  "M161.33 82.72Q158.41 82.72 156.26 81.47Q154.11 80.22 152.96 78.06Q151.81 75.91 151.81 73.19V53.83H158.85V71.72Q158.85 74.35 160.16 75.67Q161.46 76.98 163.85 76.98Q166 76.98 167.65 75.98Q169.3 74.98 170.27 73.19Q171.24 71.41 171.24 69.09L171.96 75.89Q170.57 78.98 167.81 80.85Q165.06 82.72 161.33 82.72ZM171.44 82.17V75.5H171.24V53.83H178.28V82.17Z",
  "M184.31 82.17V53.83H191.15V60.69H191.35V82.17ZM191.35 67.39 190.63 60.67Q191.63 57.06 194 55.17Q196.37 53.28 199.74 53.28Q200.91 53.28 201.41 53.5V60.11Q201.13 60 200.63 59.97Q200.13 59.94 199.41 59.94Q195.33 59.94 193.34 61.73Q191.35 63.52 191.35 67.39Z",
  "M214.37 82.72Q208.48 82.72 205 80.25Q201.52 77.78 201.15 73.37H207.54Q207.85 75.54 209.61 76.67Q211.37 77.8 214.41 77.8Q217.13 77.8 218.48 76.93Q219.83 76.06 219.83 74.44Q219.83 73.26 219.06 72.51Q218.28 71.76 216.11 71.26L211.56 70.24Q206.89 69.2 204.65 67.08Q202.41 64.96 202.41 61.74Q202.41 57.78 205.43 55.53Q208.44 53.28 213.78 53.28Q219.06 53.28 222.24 55.52Q225.43 57.76 225.78 61.74H219.39Q219.11 60.02 217.65 59.11Q216.19 58.2 213.61 58.2Q211.22 58.2 210 58.97Q208.78 59.74 208.78 61.15Q208.78 62.3 209.73 63.04Q210.69 63.78 212.91 64.31L217.8 65.43Q221.96 66.37 224.09 68.7Q226.22 71.04 226.22 74.24Q226.22 78.26 223.11 80.49Q220 82.72 214.37 82.72Z",
  "M243.07 82.72Q238.57 82.72 235.2 80.84Q231.83 78.96 229.96 75.63Q228.09 72.3 228.09 67.96Q228.09 63.59 229.95 60.29Q231.81 56.98 235.17 55.13Q238.52 53.28 242.93 53.28Q247.17 53.28 250.29 55.04Q253.41 56.8 255.12 59.94Q256.83 63.09 256.83 67.35Q256.83 68.13 256.79 68.8Q256.74 69.46 256.63 70.11H232.46V65.2H251.24L249.8 66.56Q249.8 62.56 247.95 60.55Q246.11 58.54 242.85 58.54Q239.26 58.54 237.19 60.99Q235.13 63.44 235.13 68.06Q235.13 72.63 237.19 75.05Q239.26 77.46 243.11 77.46Q245.35 77.46 247 76.62Q248.65 75.78 249.44 74.04H256.07Q254.69 78.07 251.36 80.4Q248.04 82.72 243.07 82.72Z",
  "M272.11 82.74Q266.91 82.74 264.44 80.27Q261.96 77.8 261.96 72.85V47.41L269 44.78V73.02Q269 75.07 270.11 76.07Q271.22 77.07 273.63 77.07Q274.56 77.07 275.31 76.92Q276.06 76.76 276.7 76.54V82.02Q276.04 82.35 274.82 82.55Q273.61 82.74 272.11 82.74ZM256.5 59.31V53.83H276.7V59.31Z",
] as const;

export type AursetLogoVariant = "completa" | "simbolo";

type AursetLogoProps = {
  /** "completa" = símbolo + nome; "simbolo" = só o símbolo. */
  variant?: AursetLogoVariant;
  /** Com título, vira imagem com nome acessível; sem ele, é decorativa. */
  title?: string;
  /** Inclui no desenho a área de respiro do arquivo mestre (4 unidades em volta). */
  respiro?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function AursetLogo({
  variant = "completa",
  title,
  respiro = false,
  className,
  style,
}: AursetLogoProps) {
  const a11y = title
    ? ({ role: "img", "aria-label": title } as const)
    : ({ "aria-hidden": true } as const);
  const viewBox =
    variant === "simbolo" ? "40 40 56 56" : respiro ? "36 36 244.7 64" : "40 40 236.7 56";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="currentColor"
      focusable="false"
      className={cn("aurset-logo shrink-0", className)}
      style={style}
      {...a11y}
    >
      <g transform="translate(36 36)">
        {SYMBOL_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
        <circle cx="32" cy="32" r="10" />
      </g>
      {variant === "completa" && WORDMARK_PATHS.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
