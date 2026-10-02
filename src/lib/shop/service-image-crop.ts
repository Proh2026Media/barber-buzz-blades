export type SquareCropRect = { x: number; y: number; size: number };

/** Foto de pessoa: o rosto costuma ficar acima do meio, então o corte inicial sobe um pouco. */
export const PORTRAIT_FOCUS_Y = 0.4;

/**
 * Posição inicial do enquadramento com zoom 1: a imagem cobre o quadro inteiro e o centro do
 * corte fica em `focusY` (0 = topo, 0,5 = meio) da altura original, sem sair da foto.
 */
export function initialCropOffset({
  naturalWidth,
  naturalHeight,
  viewportSize,
  focusY = 0.5,
}: {
  naturalWidth: number;
  naturalHeight: number;
  viewportSize: number;
  focusY?: number;
}) {
  const safeViewport = Math.max(1, viewportSize);
  const scale = Math.max(safeViewport / naturalWidth, safeViewport / naturalHeight);
  const height = naturalHeight * scale;
  const maxY = Math.max(0, (height - safeViewport) / 2);
  const y = Math.min(maxY, Math.max(-maxY, (0.5 - focusY) * height));
  return { x: 0, y: Object.is(y, -0) ? 0 : y };
}

/** Converte o enquadramento visto no editor para o recorte na imagem original. */
export function getSquareCropRect({
  naturalWidth,
  naturalHeight,
  viewportSize,
  zoom,
  offsetX,
  offsetY,
}: {
  naturalWidth: number;
  naturalHeight: number;
  viewportSize: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
}): SquareCropRect {
  const safeViewport = Math.max(1, viewportSize);
  const safeZoom = Math.max(1, zoom);
  const baseScale = Math.max(safeViewport / naturalWidth, safeViewport / naturalHeight);
  const scale = baseScale * safeZoom;
  const size = Math.min(naturalWidth, naturalHeight, safeViewport / scale);
  const x = Math.min(
    naturalWidth - size,
    Math.max(0, naturalWidth / 2 - offsetX / scale - size / 2),
  );
  const y = Math.min(
    naturalHeight - size,
    Math.max(0, naturalHeight / 2 - offsetY / scale - size / 2),
  );
  return { x, y, size };
}
