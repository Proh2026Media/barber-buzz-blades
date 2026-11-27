import { usePreviewDocument } from "@/components/visual/preview-document";
import { useEffect } from "react";
import { customBrandFontFamily } from "@/lib/shop/branding";
import { inferFontFile, normalizeFontFaces } from "@/lib/shop/font-files";

/** Carrega a fonte própria sem injetar CSS ou alterar a tipografia geral do sistema. */
export function BrandFontFace({
  url,
  faces,
}: {
  url: string | null | undefined;
  faces?: unknown;
}) {
  const previewDocument = usePreviewDocument();
  const normalized = normalizeFontFaces(faces);
  const key = JSON.stringify(normalized);
  useEffect(() => {
    if (!url || typeof document === "undefined" || !("fonts" in document)) return;
    const targetDocument = previewDocument ?? document;
    const family = customBrandFontFamily(url);
    if (!family) return;

    const sources = normalized.length
      ? normalized
      : [{ url, file_name: "Fonte personalizada", weight: 400, style: "normal" as const }];
    const loadedFaces = sources.map(
      (source) =>
        new FontFace(family, `url(${JSON.stringify(source.url)})`, {
          display: "swap",
          weight: inferFontFile({ name: source.file_name }).variable
            ? "100 900"
            : String(source.weight),
          style: source.style,
        }),
    );
    // Cadastre toda a família antes da seleção. O navegador busca o arquivo usado pelo texto.
    for (const face of loadedFaces) targetDocument.fonts.add(face);

    return () => {
      for (const face of loadedFaces) targetDocument.fonts.delete(face);
    };
    // `key` torna o array estável para o efeito sem depender da referência recebida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key, previewDocument]);

  return null;
}
