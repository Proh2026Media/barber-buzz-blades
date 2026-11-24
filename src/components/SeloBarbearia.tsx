import { tipoDeSelo } from "@/lib/marca/parceria";
import { useMemo } from "react";
import { dataUri, gerarSelo } from "@/lib/marca/selo.mjs";

export function SeloBarbearia({ nome, tamanho, lojaId, className }: {
  nome: string;
  tamanho: number;
  lojaId?: string | null;
  className?: string;
}) {
  const src = useMemo(() => dataUri(gerarSelo({
    nome, tamanho, simples: tamanho < 56, tipo: tipoDeSelo(lojaId),
  })), [nome, tamanho, lojaId]);
  return <img src={src} width={tamanho} height={tamanho} className={className} alt="" />;
}
