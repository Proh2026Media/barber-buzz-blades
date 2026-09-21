import { useEffect } from "react";
import { customBrandFontFamily } from "@/lib/shop/branding";
import { normalizeFontFaces, type BrandFontFaceRecord } from "@/lib/shop/font-files";
import { inferFontFile } from "@/lib/shop/font-files";

/** Carrega a fonte própria sem injetar CSS ou alterar a tipografia geral do sistema. */
export function BrandFontFace({
  url,
  faces,
}: {
  url: string | null | undefined;
  faces?: BrandFontFaceRecord[] | unknown;
}) {
  const normalized = normalizeFontFaces(faces);
  const key = JSON.stringify(normalized);
  useEffect(() => {
    if (!url || typeof document === "undefined" || !("fonts" in document)) return;
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
    let active = true;
    for (const face of loadedFaces) {
      void face
        .load()
        .then((loaded) => {
          if (active) document.fonts.add(loaded);
        })
        .catch(() => {
          // A interface mantém a fonte curada como fallback se um peso falhar.
        });
    }

    return () => {
      active = false;
      for (const face of loadedFaces) document.fonts.delete(face);
    };
    // `key` torna o array estável para o efeito sem depender da referência recebida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key]);

  return null;
}
