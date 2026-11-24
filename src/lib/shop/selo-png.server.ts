import { tipoDeSelo } from "../marca/parceria";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import modulo from "@resvg/resvg-wasm/index_bg.wasm?url&inline";
import { gerarSelo } from "../marca/selo.mjs";

let pronto: Promise<void> | undefined;

export async function iconeDeIniciais(nome: string, lojaId: string) {
  return renderizar(gerarSelo({nome, tamanho: 512, formato: "quadrado", tipo: tipoDeSelo(lojaId), simples: false}));
}

export function iconeDeLogo(bytes: ArrayBuffer, tipo: string, fundo?: string) {
  const cor = fundo && /^#[0-9a-f]{6}$/i.test(fundo) ? fundo : "#252522";
  const dado = Buffer.from(bytes).toString("base64");
  return renderizar(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="180" height="180"><rect width="180" height="180" fill="${cor}"/><image x="18" y="18" width="144" height="144" preserveAspectRatio="xMidYMid meet" xlink:href="data:${tipo};base64,${dado}"/></svg>`);
}

async function renderizar(svg: string) {
  pronto ??= initWasm(Buffer.from(modulo.slice(modulo.indexOf(",") + 1), "base64"));
  await pronto;
  const desenho = new Resvg(svg);
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
