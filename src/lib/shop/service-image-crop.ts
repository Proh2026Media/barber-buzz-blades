export type SquareCropRect = { x: number; y: number; size: number };

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
