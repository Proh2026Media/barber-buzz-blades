import { tipoDeSelo } from "../marca/parceria";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import modulo from "@resvg/resvg-wasm/index_bg.wasm?url&inline";
import { gerarSelo } from "../marca/selo.mjs";

let pronto: Promise<void> | undefined;

export async function iconeDeIniciais(nome: string, lojaId: string) {
  pronto ??= initWasm(Buffer.from(modulo.slice(modulo.indexOf(",") + 1), "base64"));
  await pronto;
  const desenho = new Resvg(gerarSelo({nome, tamanho: 512, formato: "quadrado", tipo: tipoDeSelo(lojaId), simples: false}));
  try {
    const imagem = desenho.render();
    try {
      return Uint8Array.from(imagem.asPng());
    } finally {
      imagem.free();
    }
  } finally {
    desenho.free();
  }
}
