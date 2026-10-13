import { useState } from "react";
import { PersonAvatar } from "@/components/visual";
import { cn } from "@/lib/utils";

export type ShopLogoInfo = { url: string | null; background: string | null };

const SIZE = { sm: "size-8", md: "size-12" } as const;

/**
 * Logo da barbearia na lista e na ficha da plataforma: a imagem inteira (sem cortar) sobre a cor
 * de fundo escolhida na marca. Sem logo, ou se o endereço não abrir, as iniciais como antes.
 */
export function ShopLogo({
  name,
  seed,
  logo,
  size = "sm",
}: {
  name: string;
  seed: string;
  logo?: ShopLogoInfo | null;
  size?: keyof typeof SIZE;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const url = logo?.url?.trim() || null;
  if (!url || broken === url) return <PersonAvatar name={name} size={size} seed={seed} />;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border border-border",
        SIZE[size],
      )}
      style={{ backgroundColor: logo?.background || "#ffffff" }}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(url)}
        className="size-full object-contain p-0.5"
      />
    </span>
  );
}
