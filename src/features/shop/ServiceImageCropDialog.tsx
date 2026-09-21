import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Crop, Move, RotateCcw, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { SERVICE_IMAGE_CROP_SIZE } from "@/lib/shop/service-image";
import { getSquareCropRect } from "@/lib/shop/service-image-crop";

type Offset = { x: number; y: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function ServiceImageCropDialog({
  file,
  onCancel,
  onConfirm,
  title = "Enquadrar foto",
  description = "A foto será salva em formato quadrado. Arraste para escolher a posição e use o zoom para aproximar.",
  imageAlt = "Prévia da foto do serviço",
  outputName = "servico-1x1.webp",
}: {
  file: File | null;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void> | void;
  title?: string;
  description?: string;
  imageAlt?: string;
  outputName?: string;
}) {
  const imageUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; offset: Offset } | null>(null);
  const zoomLabelId = useId();
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [viewportSize, setViewportSize] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl]);

  useEffect(() => {
    if (!file) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError(null);
  }, [file]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setViewportSize(viewport.clientWidth || 300);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [file]);

  const geometry = useMemo(() => {
    const baseScale = Math.max(viewportSize / naturalSize.width, viewportSize / naturalSize.height);
    const width = naturalSize.width * baseScale * zoom;
    const height = naturalSize.height * baseScale * zoom;
    return {
      width,
      height,
      maxX: Math.max(0, (width - viewportSize) / 2),
      maxY: Math.max(0, (height - viewportSize) / 2),
    };
  }, [naturalSize, viewportSize, zoom]);

  const moveTo = (next: Offset) =>
    setOffset({
      x: clamp(next.x, -geometry.maxX, geometry.maxX),
      y: clamp(next.y, -geometry.maxY, geometry.maxY),
    });

  useEffect(() => {
    setOffset((current) => ({
      x: clamp(current.x, -geometry.maxX, geometry.maxX),
      y: clamp(current.y, -geometry.maxY, geometry.maxY),
    }));
  }, [geometry.maxX, geometry.maxY]);

  async function confirmCrop() {
    const image = imageRef.current;
    if (!image || !file) return;
    setSaving(true);
    setError(null);
    try {
      const crop = getSquareCropRect({
        naturalWidth: naturalSize.width,
        naturalHeight: naturalSize.height,
        viewportSize,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
      });
      const canvas = document.createElement("canvas");
      canvas.width = SERVICE_IMAGE_CROP_SIZE;
      canvas.height = SERVICE_IMAGE_CROP_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Seu navegador não conseguiu preparar o recorte.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        crop.x,
        crop.y,
        crop.size,
        crop.size,
        0,
        0,
        SERVICE_IMAGE_CROP_SIZE,
        SERVICE_IMAGE_CROP_SIZE,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error("Não foi possível concluir o recorte.")),
          "image/webp",
          0.9,
        ),
      );
      await onConfirm(new File([blob], outputName, { type: blob.type }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível recortar a imagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
        <div className="space-y-4 p-5 sm:p-6">
          <div className="pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Crop className="size-5 text-gold" /> {title}
            </DialogTitle>
            <DialogDescription className="mt-1">{description}</DialogDescription>
          </div>

          <div
            ref={viewportRef}
            className="service-crop-viewport"
            tabIndex={0}
            role="application"
            aria-label="Área de recorte quadrada. Arraste a foto ou use as setas do teclado para reposicionar."
            onKeyDown={(event) => {
              const distance = event.shiftKey ? 16 : 4;
              const movements: Record<string, Offset> = {
                ArrowLeft: { x: offset.x - distance, y: offset.y },
                ArrowRight: { x: offset.x + distance, y: offset.y },
                ArrowUp: { x: offset.x, y: offset.y - distance },
                ArrowDown: { x: offset.x, y: offset.y + distance },
              };
              if (movements[event.key]) {
                event.preventDefault();
                moveTo(movements[event.key]);
              }
            }}
            onPointerDown={(event) => {
              if (saving) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                offset,
              };
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              moveTo({
                x: drag.offset.x + event.clientX - drag.x,
                y: drag.offset.y + event.clientY - drag.y,
              });
            }}
            onPointerUp={(event) => {
              if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          >
            {imageUrl && (
              <img
                ref={imageRef}
                src={imageUrl}
                alt={imageAlt}
                draggable={false}
                onLoad={(event) =>
                  setNaturalSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                }
                style={{
                  width: geometry.width,
                  height: geometry.height,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            )}
            <div className="service-crop-grid" aria-hidden />
            <span className="service-crop-hint" aria-hidden>
              <Move className="size-4" /> Arraste para enquadrar
            </span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-3">
              <label id={zoomLabelId} className="flex items-center gap-2 text-sm font-semibold">
                <ZoomIn className="size-4 text-gold" /> Zoom
              </label>
              <output className="text-xs font-bold tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </output>
            </div>
            <Slider
              className="mt-1"
              min={1}
              max={3}
              step={0.01}
              value={[zoom]}
              aria-labelledby={zoomLabelId}
              aria-valuetext={`${Math.round(zoom * 100)} por cento`}
              onValueChange={([value]) => setZoom(value ?? 1)}
            />
            <button
              type="button"
              className="mt-1 flex min-h-11 items-center gap-2 text-xs font-semibold text-muted-foreground"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
            >
              <RotateCcw className="size-4" /> Centralizar novamente
            </button>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-semibold"
              disabled={saving}
              onClick={onCancel}
            >
              Voltar
            </button>
            <button
              type="button"
              className="action-button action-success"
              disabled={saving}
              onClick={() => void confirmCrop()}
            >
              <Check className="size-4" /> {saving ? "Salvando…" : "Usar foto"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
