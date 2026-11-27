import { useState } from "react";
import { ServiceIcon } from "@/components/ui/service-icon";
import { isServiceImageSource } from "@/lib/shop/service-image";
import { modeloDaFoto, modeloDoServico, fotoDoModelo } from "@/lib/shop/modelos-servico";
import { cn } from "@/lib/utils";

export function FotoServico({
  nome,
  icone,
  className,
}: {
  nome: string;
  icone?: string | null;
  className?: string;
}) {
  const [falhas, setFalhas] = useState<string[]>([]);
  const modelo = modeloDaFoto(icone) ?? modeloDoServico(nome);
  const propria = isServiceImageSource(icone);
  const foto = [propria ? icone : null, modelo && fotoDoModelo(modelo)].find(
    (url) => url && !falhas.includes(url),
  );
  const simbolo = (!propria && icone) || modelo?.emoji || "💈";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "foto-servico relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden bg-muted text-foreground",
        className,
      )}
    >
      {foto ? (
        <img
          src={foto}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFalhas((atual) => [...atual, foto])}
          className="size-full object-cover"
        />
      ) : null}
      <span className={foto ? "foto-servico-simbolo" : "grid place-items-center"}>
        <ServiceIcon icon={simbolo} className="size-5" />
      </span>
    </span>
  );
}
