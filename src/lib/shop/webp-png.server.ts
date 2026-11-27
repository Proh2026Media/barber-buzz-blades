import decodificar, { init } from "@jsquash/webp/decode.js";
import modulo from "@jsquash/webp/codec/dec/webp_dec.wasm?url&inline";
import { encode } from "fast-png";

let pronto: Promise<void> | undefined;

// O tamanho descompactado pode ser muito maior que o arquivo no Storage.
function pixelsWebp(bytes: Buffer) {
  if (bytes.length < 30 || bytes.toString("ascii", 8, 12) !== "WEBP") return Infinity;
  switch (bytes.toString("ascii", 12, 16)) {
    case "VP8X":
      return (1 + bytes.readUIntLE(24, 3)) * (1 + bytes.readUIntLE(27, 3));
    case "VP8 ":
      return (bytes.readUInt16LE(26) & 0x3fff) * (bytes.readUInt16LE(28) & 0x3fff);
    case "VP8L": {
      const dimensoes = bytes.readUInt32LE(21);
      return (1 + (dimensoes & 0x3fff)) * (1 + ((dimensoes >>> 14) & 0x3fff));
    }
    default:
      return Infinity;
  }
}

/** O rasterizador de SVG aceita PNG e JPEG como imagem incorporada. */
export async function converterWebp(arquivo: Buffer) {
  if (pixelsWebp(arquivo) > 24_000_000) throw new Error("Área da imagem WebP excedida.");
  pronto ??= init({ wasmBinary: Buffer.from(modulo.slice(modulo.indexOf(",") + 1), "base64") });
  await pronto;
  const { data, width, height } = await decodificar(Uint8Array.from(arquivo).buffer);
  return encode({ width, height, channels: 4, data });
}
