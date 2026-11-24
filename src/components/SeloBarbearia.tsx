import { useMemo } from "react";
import { dataUri, gerarSelo } from "@/lib/marca/selo.mjs";

export function SeloBarbearia({ nome, tamanho, parceria = false, className }: {
  nome: string;
  tamanho: number;
  parceria?: boolean;
  className?: string;
}) {
  const src = useMemo(() => dataUri(gerarSelo({
    nome, tamanho, simples: tamanho < 56, tipo: parceria ? "parceria" : "iniciais",
  })), [nome, tamanho, parceria]);
  return <img src={src} width={tamanho} height={tamanho} className={className} alt="" />;
}
