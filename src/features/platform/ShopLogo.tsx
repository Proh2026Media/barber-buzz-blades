import { SeloBarbearia } from "@/components/SeloBarbearia";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type ShopLogoInfo = { url: string | null; nome?: string | null; background: string | null; primary_color?: string | null; accent_color?: string | null };

const SIZE = { sm: "size-8", md: "size-12" } as const;

/** Para desenhos transparentes e claros, usa um fundo grafite se a loja não escolheu um. */
function fundoDaMiniatura(img: HTMLImageElement): string | undefined {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 24;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  try {
    ctx.drawImage(img, 0, 0, 24, 24);
    const { data } = ctx.getImageData(0, 0, 24, 24);
    let claros = 0;
    let visiveis = 0;
    let transparentes = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 32) transparentes++;
      if (data[i + 3] < 128) continue;
      visiveis++;
      if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] > 170) claros++;
    }
    if (transparentes && visiveis && claros > visiveis / 2) return "#20231f";
  } catch {
    // Um servidor externo pode permitir a exibição, mas restringir a leitura dos pixels.
  }
}

export function ShopLogo({
  lojaId,
  name,
  logo,
  size = "sm",
}: {
  lojaId: string;
  name: string;
  logo?: ShopLogoInfo | null;
  size?: keyof typeof SIZE;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const url = logo?.url?.trim() || null;
  const [amostra, setAmostra] = useState<{ url: string; fundo?: string } | null>(null);
  const [semCors, setSemCors] = useState<string | null>(null);
  const analisar = Boolean(url && !logo?.background && url.includes("/storage/v1/object/public/") && semCors !== url);
  if (!url || broken === url) return <SeloBarbearia lojaId={lojaId} tema={logo} nome={logo?.nome?.trim() || name} tamanho={size === "md" ? 48 : 32} className="shrink-0" />;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        SIZE[size],
      )}
      style={{ backgroundColor: logo?.background || (amostra?.url === url ? amostra.fundo : undefined) || "#ffffff", borderRadius: "var(--control-radius)" }}
    >
      <img
        key={url + (analisar ? ":cors" : ":direto")}
        crossOrigin={analisar ? "anonymous" : undefined}
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={(event) => {
          if (analisar) setAmostra({ url, fundo: fundoDaMiniatura(event.currentTarget) });
        }}
        onError={() => analisar ? setSemCors(url) : setBroken(url)}
        className="block size-4/5 min-h-0 min-w-0 object-contain object-center"
      />
    </span>
  );
}
