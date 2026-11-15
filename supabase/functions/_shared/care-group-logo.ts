type Download = (url: string, init: RequestInit) => Promise<Response>;
/** Reutiliza apenas o caminho da logo escolhida; o host remoto nunca determina o destino. */
export async function loadCareGroupLogo(
  shopId: string,
  chosenUrl: string,
  storageOrigin: string,
  download: Download = fetch,
) {
  if (!/^[a-f0-9-]{36}$/i.test(shopId)) throw new Error("GROUP_LOGO_INVALID");
  const selected = new URL(chosenUrl);
  const base = new URL(storageOrigin);
  const path = `/storage/v1/object/public/barbershop-logos/${shopId}/`;
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    selected.username ||
    selected.password ||
    !selected.pathname.startsWith(path) ||
    !/^logo-[a-zA-Z0-9_-]{1,100}$/.test(selected.pathname.slice(path.length))
  )
    throw new Error("GROUP_LOGO_INVALID");
  const response = await download(new URL(selected.pathname, base.origin).toString(), {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (
    !response.ok ||
    response.redirected ||
    Number(response.headers.get("content-length")) > 2 * 1024 * 1024
  )
    throw new Error("GROUP_LOGO_UNAVAILABLE");
  if (
    !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(
      response.headers.get("content-type")?.split(";")[0]?.trim() ?? "",
    )
  )
    throw new Error("GROUP_LOGO_FORMAT");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("GROUP_LOGO_UNAVAILABLE");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("GROUP_LOGO_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new Error("GROUP_LOGO_FORMAT");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  const svg =
    response.headers.get("content-type")?.split(";")[0]?.trim() === "image/svg+xml" &&
    new TextDecoder().decode(bytes.subarray(0, 512)).trimStart().startsWith("<");
  if (!png && !jpeg && !webp && !svg) throw new Error("GROUP_LOGO_FORMAT");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  let binary = "";
  for (let start = 0; start < bytes.length; start += 8192)
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return { base64: btoa(binary), sha256: hash };
}
