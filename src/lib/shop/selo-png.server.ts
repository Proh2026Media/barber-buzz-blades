import { coresDoSelo } from "./branding";
import { tipoDeSelo } from "../marca/parceria";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import modulo from "@resvg/resvg-wasm/index_bg.wasm?url&inline";
import { gerarSelo } from "../marca/selo.mjs";

let pronto: Promise<void> | undefined;

export async function iconeDeIniciais(
  nome: string,
  lojaId: string,
  primaria: string | null,
  destaque: string | null,
  tamanho: number,
  mascaravel: boolean,
) {
  const cores = coresDoSelo(lojaId, primaria, destaque);
  const selo = gerarSelo({
    nome,
    tamanho,
    formato: "quadrado",
    tipo: tipoDeSelo(lojaId),
    simples: tamanho < 56,
    cores,
  });
  return mascaravel
    ? iconeDeLogo(Buffer.from(selo), "image/svg+xml", cores.fundo, tamanho, true)
    : renderizar(selo);
}

export async function iconeDeLogo(
  bytes: ArrayBuffer | Uint8Array,
  tipo: string,
  fundo: string | null,
  tamanho: number,
  mascaravel: boolean,
) {
  const cor = fundo && /^#[0-9a-f]{6}$/i.test(fundo) ? fundo : "#252522";
  let imagem = Buffer.from(new Uint8Array(bytes));
  if (tipo === "image/webp") {
    const { converterWebp } = await import("./webp-png.server");
    imagem = Buffer.from(await converterWebp(imagem));
    tipo = "image/png";
  }
  // Na máscara do sistema, a área garantida é o círculo central de diâmetro 80%.
  // A diagonal da arte quadrada deve caber nele mesmo quando há tinta nos quatro cantos.
  const lado = Math.floor(tamanho * (mascaravel ? 0.56 : 0.7));
  const margem = (tamanho - lado) / 2;
  const dado = imagem.toString("base64");
  return renderizar(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${tamanho}" height="${tamanho}"><rect width="100%" height="100%" fill="${cor}"/><image x="${margem}" y="${margem}" width="${lado}" height="${lado}" preserveAspectRatio="xMidYMid meet" xlink:href="data:${tipo};base64,${dado}"/></svg>`,
  );
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
