import { useState } from "react";
import { ServiceIcon } from "@/components/ui/service-icon";
import { isServiceImageSource } from "@/lib/shop/service-image";
import { modeloDaFoto, modeloDoServico, ilustracaoDoServico } from "@/lib/shop/modelos-servico";
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
  const [falha, setFalha] = useState<string | null>(null);
  const valor = ilustracaoDoServico(nome, icone);
  const foto = isServiceImageSource(valor) ? valor : null;
  const modelo = modeloDaFoto(valor) ?? modeloDoServico(nome);
  const simbolo = foto ? (modelo?.icone ?? "Scissors") : valor;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "foto-servico relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden bg-muted text-foreground",
        className,
      )}
    >
      {foto && foto !== falha ? (
        <img
          src={foto}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFalha(foto)}
          className="size-full object-cover"
        />
      ) : (
        <ServiceIcon icon={simbolo} className="size-5" />
      )}
    </span>
  );
}
