import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Foto do profissional: preenche o quadro (proporção fixa) e corta só o excesso, com o rosto
 * um pouco acima do meio. Sem foto, ou se o endereço não abrir, mostra o `fallback`.
 */
export function StaffPhoto({
  src,
  alt = "",
  className,
  fallback,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  if (!src || broken === src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(src)}
      className={cn("block aspect-square shrink-0", className, "object-cover object-[center_20%]")}
    />
  );
}
