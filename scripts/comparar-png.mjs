// Compara dois PNG pixel a pixel (sem dependências): imprime tamanho, pixels diferentes e as
// faixas de linhas em que há diferença. Uso: node comparar-png.mjs a.png b.png
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

function decode(path) {
  const buf = readFileSync(path);
  let off = 8;
  let width = 0,
    height = 0,
    bitDepth = 0,
    colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`bitDepth ${bitDepth} não suportado`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const v = raw[p++];
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let r;
      switch (filter) {
        case 0:
          r = v;
          break;
        case 1:
          r = v + a;
          break;
        case 2:
          r = v + b;
          break;
        case 3:
          r = v + ((a + b) >> 1);
          break;
        case 4: {
          const pp = a + b - c;
          const pa = Math.abs(pp - a),
            pb = Math.abs(pp - b),
            pc = Math.abs(pp - c);
          r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`filtro ${filter}`);
      }
      line[x] = r & 255;
    }
  }
  return { width, height, channels, data: out };
}

const [a, b] = process.argv.slice(2).map(decode);
const w = Math.min(a.width, b.width),
  h = Math.min(a.height, b.height);
let diff = 0;
const linhas = [];
for (let y = 0; y < h; y++) {
  let d = 0;
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      const va = a.data[(y * a.width + x) * a.channels + c];
      const vb = b.data[(y * b.width + x) * b.channels + c];
      if (Math.abs(va - vb) > 8) {
        d++;
        break;
      }
    }
  }
  if (d) {
    diff += d;
    linhas.push(y);
  }
}
const faixas = [];
for (const y of linhas) {
  const last = faixas[faixas.length - 1];
  if (last && y - last[1] <= 2) last[1] = y;
  else faixas.push([y, y]);
}
console.log(
  JSON.stringify({
    a: `${a.width}x${a.height}`,
    b: `${b.width}x${b.height}`,
    pixelsDiferentes: diff,
    linhasDiferentes: linhas.length,
    faixas: faixas.slice(0, 20).map(([i, f]) => `${i}-${f}`),
  }),
);
