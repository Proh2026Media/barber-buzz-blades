import { useEffect, useRef, useState, type ReactNode } from "react";
import { PreviewDocument } from "./preview-document";
import { createPortal } from "react-dom";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { useViewportAtLeast, deviceForWidth } from "@/lib/device";
import { useI18n } from "@/lib/i18n";

const DEVICES = {
  mobile: { width: 390, height: 844, icon: Smartphone, label: "brand.loginPreview.mobile" },
  tablet: { width: 768, height: 1024, icon: Tablet, label: "brand.loginPreview.tablet" },
  desktop: { width: 1280, height: 800, icon: Monitor, label: "brand.loginPreview.computer" },
} as const;
type PreviewDevice = keyof typeof DEVICES;
const FRAME_HTML =
  '<!doctype html><html><head></head><body><div id="preview-root"></div></body></html>';

/** Viewport independente: as media queries usam o aparelho escolhido, sem salvar preferências. */
export function DevicePreview({
  children,
  initialDevice = "desktop",
  height,
}: {
  children: ReactNode;
  initialDevice?: PreviewDevice;
  /** Altura reduzida para amostras de marca, que não representam uma página inteira. */
  height?: number;
}) {
  const { t, locale } = useI18n();
  const enabled = useViewportAtLeast(768);
  const [device, setDevice] = useState<PreviewDevice>(initialDevice);
  const [frameDocument, setFrameDocument] = useState<Document>();
  const [availableWidth, setAvailableWidth] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const dimensions = DEVICES[device];
  const frameHeight = height ?? dimensions.height;
  const scale = Math.min(1, availableWidth / dimensions.width);

  useEffect(() => {
    if (!enabled || !host.current) return;
    const element = host.current;
    const observer = new ResizeObserver(() => setAvailableWidth(element.clientWidth));
    setAvailableWidth(element.clientWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !frameDocument) return;
    const copies = new Map<Element, Element>();
    const base = frameDocument.createElement("style");
    base.textContent =
      "html,body,#preview-root{margin:0;min-height:100%;}html,body{height:100%;}#preview-root{height:100%;}";
    frameDocument.head.append(base);
    const syncStyles = () => {
      const sources = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'));
      for (const [source, copy] of copies) {
        if (!sources.includes(source)) {
          copy.remove();
          copies.delete(source);
        }
      }
      let previous: Element | null = null;
      for (const source of sources) {
        let copy = copies.get(source);
        if (!copy) {
          copy = source.cloneNode(true) as Element;
          copies.set(source, copy);
        } else if (!copy.isEqualNode(source)) {
          // Atualiza só a folha alterada; não recarrega links por mudanças no título/metadados.
          for (const attribute of Array.from(copy.attributes)) copy.removeAttribute(attribute.name);
          for (const attribute of Array.from(source.attributes))
            copy.setAttribute(attribute.name, attribute.value);
          copy.textContent = source.textContent;
        }
        const expectedNext: ChildNode | null = previous
          ? previous.nextSibling
          : frameDocument.head.firstChild;
        if (expectedNext !== copy) frameDocument.head.insertBefore(copy, expectedNext);
        previous = copy;
      }
    };
    syncStyles();
    const observer = new MutationObserver(syncStyles);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    return () => {
      observer.disconnect();
      for (const copy of copies.values()) copy.remove();
      base.remove();
    };
  }, [enabled, frameDocument]);

  useEffect(() => {
    if (!enabled || !frameDocument || !host.current) return;
    const element = host.current;
    const syncTheme = () => {
      frameDocument.documentElement.className = document.documentElement.className;
      frameDocument.documentElement.lang = locale;
      frameDocument.documentElement.dataset.dispositivo = deviceForWidth(dimensions.width);
      const computed = getComputedStyle(element);
      for (const property of Array.from(computed)) {
        if (property.startsWith("--"))
          frameDocument.documentElement.style.setProperty(
            property,
            computed.getPropertyValue(property),
          );
      }
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, [enabled, frameDocument, dimensions.width, locale, children]);

  // Esc dentro do documento da prévia segue a proteção de fechamento da janela editora.
  useEffect(() => {
    if (!enabled || !frameDocument) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    };
    frameDocument.addEventListener("keydown", onKeyDown);
    return () => frameDocument.removeEventListener("keydown", onKeyDown);
  }, [enabled, frameDocument]);

  // Mantém a árvore e a aparência anteriores no celular.
  if (!enabled) return children;
  const root = frameDocument?.getElementById("preview-root");
  return (
    <div className="device-preview min-w-0 space-y-3">
      <div
        role="group"
        aria-label={t("brand.loginPreview.sizeAria")}
        className="flex flex-wrap justify-center gap-1 rounded-[var(--control-radius)] border border-border bg-muted/60 p-1"
      >
        {(Object.keys(DEVICES) as PreviewDevice[]).map((key) => {
          const Icon = DEVICES[key].icon;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={device === key}
              onClick={() => setDevice(key)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--control-radius)] px-2.5 text-xs font-bold transition ${device === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(DEVICES[key].label)}
            </button>
          );
        })}
      </div>
      <div
        ref={host}
        className="min-w-0 overflow-hidden rounded-[var(--panel-radius)] border border-border bg-background shadow-sm"
      >
        <div
          className="relative mx-auto"
          style={{ width: dimensions.width * scale, height: frameHeight * scale }}
        >
          <iframe
            title={t("brand.loginPreview.frame", { device: t(dimensions.label) })}
            sandbox="allow-same-origin"
            srcDoc={FRAME_HTML}
            onLoad={(event) => setFrameDocument(event.currentTarget.contentDocument ?? undefined)}
            className="absolute left-0 top-0 block origin-top-left border-0"
            style={{ width: dimensions.width, height: frameHeight, transform: `scale(${scale})` }}
          />
          {root &&
            createPortal(
              <PreviewDocument.Provider value={frameDocument}>{children}</PreviewDocument.Provider>,
              root,
            )}
        </div>
      </div>
    </div>
  );
}
