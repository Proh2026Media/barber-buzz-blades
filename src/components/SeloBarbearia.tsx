import { tipoDeSelo } from "@/lib/marca/parceria";
import { coresDoSelo } from "@/lib/shop/branding";
import { useMemo } from "react";
import { dataUri, gerarSelo } from "@/lib/marca/selo.mjs";

export type TemaDoSelo = { primary_color?: string | null; accent_color?: string | null };

export function SeloBarbearia({ nome, tamanho, lojaId, tema, className }: {
  nome: string;
  tamanho: number;
  lojaId?: string | null;
  tema?: TemaDoSelo | null;
  className?: string;
}) {
  const primaria = tema?.primary_color;
  const destaque = tema?.accent_color;
  const src = useMemo(() => dataUri(gerarSelo({
    cores: coresDoSelo(lojaId || nome, primaria, destaque),
    nome, tamanho, simples: tamanho < 56, tipo: tipoDeSelo(lojaId),
  })), [nome, tamanho, lojaId, primaria, destaque]);
  return <img src={src} width={tamanho} height={tamanho} className={className} alt="" />;
}
