/**
 * Glifos de nicho para serviços de barbearia e salão.
 *
 * O Lucide não possui formas como secador de cabelo, navalha, espelho ou esmalte.
 * Para cobrir esses casos sem perder a leitura linear do sistema, os traços abaixo
 * foram portados de catálogos abertos, todos no mesmo padrão (linha, 24 px, traço 2):
 *
 * - MingCute (Apache-2.0) — espelho, cabelo, cabelo longo, barba, batom.
 * - Tabler Icons (MIT) — massagem, perfume, aparador elétrico.
 * - IconPark Outline (Apache-2.0) — pente, esmalte, escova de cabelo, máquina, pincel de barbear.
 *
 * Os ícones do IconPark usam viewBox 48 com traço 4, que equivale a 2 px na renderização.
 * Cada glifo mantém a declaração de traço do catálogo de origem.
 */

import type { ReactNode } from "react";

type ServiceGlyph = {
  viewBox: string;
  content: ReactNode;
};

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const SERVICE_GLYPHS: Record<string, ServiceGlyph> = {
  // MingCute — Apache-2.0
  mirror: {
    viewBox: "0 0 24 24",
    content: (
      <path
        fill="currentColor"
        d="M15 4a1 1 0 1 0 0 2zm1 2a1 1 0 1 0 0-2zm3-2a1 1 0 1 0 0 2zm0 2a1 1 0 1 0 2 0zm-4 12a1 1 0 1 0 0 2zm1 2a1 1 0 1 0 0-2zm3-2a1 1 0 1 0 0 2zm2 0a1 1 0 1 0-2 0zm0-9a1 1 0 1 0-2 0zm-2 1a1 1 0 1 0 2 0zm2 4a1 1 0 1 0-2 0zm-2 1a1 1 0 1 0 2 0zM13 3a1 1 0 1 0-2 0zm-2 18a1 1 0 1 0 2 0zm-7-3h1V6H3v12zM5 5v1h4V4H5zm4 14v-1H5v2h4zm6-14v1h1V4h-1zm0 14v1h1v-2h-1zm5-10h-1v1h2V9zm0 5h-1v1h2v-1zM12 3h-1v18h2V3zm7 16v1a2 2 0 0 0 2-2h-2zm0-14v1h2a2 2 0 0 0-2-2zM4 6h1V4a2 2 0 0 0-2 2zm0 12H3a2 2 0 0 0 2 2v-2z"
      />
    ),
  },
  hair: {
    viewBox: "0 0 24 24",
    content: (
      <path
        {...strokeProps}
        strokeWidth="2"
        d="m8.828 18.344l-.552 1.103a1 1 0 0 1-.894.553H6a2 2 0 0 1-2-2v-6a8 8 0 1 1 16 0v6a2 2 0 0 1-2 2h-1.382a1 1 0 0 1-.894-.553l-.552-1.103M12 9.664a5.5 5.5 0 0 1-4.676 2.333A6.5 6.5 0 0 0 7 14c0 3.818 3.125 6 5 6s5-2.182 5-6c0-.68-.115-1.358-.324-2.003L16.5 12A5.5 5.5 0 0 1 12 9.663Z"
      />
    ),
  },
  hairLong: {
    viewBox: "0 0 24 24",
    content: (
      <path
        {...strokeProps}
        strokeWidth="2"
        d="M9 18v1.494c0 .715-.736 1.196-1.372.87C-.139 16.383 3.155 10.792 6 7c3.5-4.667 8.5-4.667 12 0c2.854 3.806 6.614 9.422-1.64 13.403c-.637.308-1.36-.173-1.36-.88V18m-7.5-4c0-3.262 1.672-5.33 3.537-5.863A5.5 5.5 0 0 0 16.445 13q.055.48.055 1c0 3.818-3 6-4.5 6s-4.5-2.182-4.5-6Z"
      />
    ),
  },
  beard: {
    viewBox: "0 0 24 24",
    content: (
      <>
        <path
          {...strokeProps}
          strokeWidth="2"
          d="M2 10.472c2.678 1.301 5.08-.17 6.714-1.472c2.286-1.822 4.198 1.113 2.781 3.522C9.385 16.11 3.32 16.11 2 10.472Z"
        />
        <path
          {...strokeProps}
          strokeWidth="2"
          d="M21.961 10.472c-2.678 1.301-5.08-.17-6.714-1.472c-2.286-1.822-4.198 1.113-2.781 3.522c2.11 3.588 8.176 3.588 9.495-2.05Z"
        />
      </>
    ),
  },
  lipstick: {
    viewBox: "0 0 24 24",
    content: (
      <path
        {...strokeProps}
        strokeWidth="2"
        d="M10 11H6m4 0V3.444A.444.444 0 0 0 9.556 3A3.556 3.556 0 0 0 6 6.556V11m4 0H6m4 0a1 1 0 0 1 1 1v9H5v-9a1 1 0 0 1 1-1m-1 4h6m9 6v-7a3 3 0 1 0-6 0v7z"
      />
    ),
  },

  // Tabler Icons — MIT
  massage: {
    viewBox: "0 0 24 24",
    content: (
      <path
        {...strokeProps}
        strokeWidth="2"
        d="M3 17a1 1 0 1 0 2 0a1 1 0 1 0-2 0M8 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0M4 22l4-2v-3h12m-9 3h9M8 14l3-2l1-4c3 1 3 4 3 6"
      />
    ),
  },
  perfume: {
    viewBox: "0 0 24 24",
    content: (
      <>
        <path
          {...strokeProps}
          strokeWidth="2"
          d="M10 6v3m4-3v3m-9 2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"
        />
        <path {...strokeProps} strokeWidth="2" d="M10 15a2 2 0 1 0 4 0a2 2 0 1 0-4 0M9 3h6v3H9z" />
      </>
    ),
  },
  trimmer: {
    viewBox: "0 0 24 24",
    content: (
      <path
        {...strokeProps}
        strokeWidth="2"
        d="M8 3v2m4-2v2m4-2v2m-7 7v6a3 3 0 0 0 6 0v-6zM8 5h8l-1 4H9zm4 12v1"
      />
    ),
  },

  // IconPark Outline — Apache-2.0
  comb: {
    viewBox: "0 0 48 48",
    content: (
      <path
        {...strokeProps}
        strokeWidth="4"
        d="M4.201 31.071L16.93 43.8L43.8 16.93L31.071 4.201M9.151 26.122l7.071 7.071m-1.414-12.728l7.07 7.071m-1.413-12.728l7.07 7.071M26.121 9.151l7.071 7.071M12.687 39.557l26.87-26.87"
      />
    ),
  },
  nailPolish: {
    viewBox: "0 0 48 48",
    content: (
      <>
        <path
          {...strokeProps}
          strokeWidth="4"
          d="M18.895 5.89A2 2 0 0 1 20.892 4h6.216a2 2 0 0 1 1.997 1.89l.778 14A2 2 0 0 1 27.886 22h-7.772a2 2 0 0 1-1.997-2.11z"
        />
        <path
          {...strokeProps}
          strokeWidth="4"
          d="M11 28a6 6 0 0 1 6-6h14a6 6 0 0 1 6 6v13a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z"
        />
        <circle cx="24" cy="33" r="3" fill="currentColor" />
      </>
    ),
  },
  hairBrush: {
    viewBox: "0 0 48 48",
    content: (
      <>
        <path
          {...strokeProps}
          strokeWidth="4"
          d="M18.197 31.424c3.124 3.124 10.722.592 16.97-5.657c6.249-6.248 8.781-13.846 5.657-16.97M27.389 6.675l1.414 1.415m-6.363 3.535l1.414 1.414m-5.658 4.243l1.414 1.414m-2.828 5.657l1.414 1.414M35.167 4.554l1.414 1.414m-2.828 7.072l2.828 2.828m-7.777 2.122l2.828 2.828m-8.485 1.414l2.828 2.828"
        />
        <rect
          {...strokeProps}
          strokeWidth="4"
          width="6"
          height="14"
          x="16.075"
          y="29.303"
          rx="3"
          transform="rotate(45 16.075 29.303)"
        />
      </>
    ),
  },
  clippers: {
    viewBox: "0 0 48 48",
    content: (
      <>
        <path
          {...strokeProps}
          strokeWidth="4"
          d="M10 8h28v9l-5 7v12s0 8-9 8s-9-8-9-8V24l-5-7zm5-4v6m6-6v6m6-6v6"
        />
        <rect {...strokeProps} strokeWidth="4" width="6" height="10" x="21" y="28" rx="3" />
        <path {...strokeProps} strokeWidth="4" d="M10 17h28M33 4v6" />
      </>
    ),
  },
  shavingBrush: {
    viewBox: "0 0 48 48",
    content: (
      <path
        {...strokeProps}
        strokeWidth="4"
        d="M29.796 24H16.204s-3.986 7.708 2.548 10.833c4.183 2.5-2.548 9.167-2.548 9.167h13.592s-6.73-7.292-2.548-9.167C33.782 31.708 29.796 24 29.796 24M37 10l-7 14H16L9 10s3-6 14-6s14 6 14 6M25 24l2-12m-6 12l-2-12"
      />
    ),
  },
  straightRazor: {
    viewBox: "0 0 48 48",
    content: (
      <>
        <rect
          {...strokeProps}
          strokeWidth="4"
          width="38"
          height="6"
          x="3.609"
          y="36.534"
          rx="2"
          transform="rotate(-10 3.61 36.534)"
        />
        <path
          {...strokeProps}
          strokeWidth="4"
          d="m44 40l-4-4M8 4l18.385 18.385l-4.243 4.242L9.414 13.9c-2.828-2.83-2.828-4.243-2.828-5.657C6.586 6.828 8 4 8 4m0 0l18 18l9 9"
        />
      </>
    ),
  },
  hairClip: {
    viewBox: "0 0 48 48",
    content: (
      <>
        <path
          {...strokeProps}
          strokeWidth="4"
          d="M38.848 5.339c-6.964 1.228-14.584 6.88-17.534 14.58c-3.225 8.417-4.097 9.338-8.03 11.468C9.502 33.435 4.6 35.072 4.6 35.072"
        />
        <path
          {...strokeProps}
          strokeWidth="4"
          d="M9.638 33.107c4.22-2.54 9.708.083 12.165 1.804c2.457 1.72 4.956 1.64 6.39-.409s.656-4.424-1.801-6.144c-1.639-1.147-7.127-3.77-5.078-8.44"
        />
        <path
          {...strokeProps}
          strokeWidth="4"
          d="M43.189 9.6c-10.323 2.538-14.42 5.773-18.435 17.61m-3.77 7.127c-.778 1.693-2.295 5.718-2.131 8.274"
        />
      </>
    ),
  },
};

export type ServiceGlyphId = keyof typeof SERVICE_GLYPHS;

export function ServiceGlyph({
  glyph,
  className,
}: {
  glyph: ServiceGlyphId | string;
  className?: string;
}) {
  const entry = SERVICE_GLYPHS[glyph];
  if (!entry) return null;
  return (
    <svg
      viewBox={entry.viewBox}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {entry.content}
    </svg>
  );
}
