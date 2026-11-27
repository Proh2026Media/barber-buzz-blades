import { dominioDaPlataforma } from "./platform-domain";

import {
  brandTheme,
  customBrandLeque,
  LOGO_MAX_BYTES,
  LOGO_MIME_TYPES,
  resolveBrandColors,
} from "./branding";

/** Identidade pública da instalação. A loja é resolvida exclusivamente pelo domínio. */
export async function shopIdentity(url: URL): Promise<Response> {
  const apple = url.pathname === "/apple-touch-icon.png";
  const marca = url.pathname === "/identidade/marca";
  const icon = marca || apple || url.pathname === "/identidade/icone";
  const pedido = Number(url.searchParams.get("tamanho"));
  const tamanho = apple ? 180 : [32, 192, 512].includes(pedido) ? pedido : 192;
  const mascaravel = !apple && url.searchParams.get("mascara") === "1";
  const platform = dominioDaPlataforma;
  const domain = (url.searchParams.get("dominio") || url.hostname).toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(domain)) return new Response(null, { status: 400 });
  if ([platform, "localhost", "127.0.0.1"].includes(domain)) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: !icon
          ? "/manifest.webmanifest"
          : marca || tamanho === 32
            ? "/favicon.svg"
            : `/icons/icon-${tamanho}${mascaravel ? "-maskable" : ""}.png`,
      },
    });
  }
  const api = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(new URL("/rest/v1/rpc/get_public_shop_branding_by_host", api), {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_host: domain }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return new Response(null, { status: 503 });
  const shop = await res.json();
  if (!shop?.shop_id) return new Response(null, { status: 404 });
  const name = shop.display_name?.trim() || shop.shop_name;
  const logo =
    typeof shop.logo_url === "string" && shop.logo_url.startsWith("https://")
      ? shop.logo_url
      : null;
  const origemPermitida = new Set([
    new URL(api).origin,
    "https://supabase-barbearia.proh.media",
    "https://supabasebeauty.contheiner.digital",
  ]);
  if (icon) {
    const origemLogo = logo ? new URL(logo) : null;
    if (
      origemLogo &&
      origemPermitida.has(origemLogo.origin) &&
      origemLogo.pathname.startsWith("/storage/v1/object/public/barbershop-logos/")
    ) {
      if (marca)
        return new Response(null, {
          status: 302,
          headers: { Location: origemLogo.href, "Cache-Control": "private, max-age=60" },
        });
      const arquivo = await fetch(origemLogo, {
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      const tipo = arquivo.headers.get("content-type")?.split(";")[0];
      if (
        arquivo.ok &&
        tipo &&
        LOGO_MIME_TYPES.some((mime) => mime === tipo) &&
        Number(arquivo.headers.get("content-length")) <= LOGO_MAX_BYTES
      ) {
        const bytes = await arquivo.arrayBuffer();
        if (bytes.byteLength <= LOGO_MAX_BYTES) {
          const { iconeDeLogo } = await import("./selo-png.server");
          try {
            const png = await iconeDeLogo(
              bytes,
              tipo,
              shop.logo_background_color,
              tamanho,
              mascaravel,
            );
            return new Response(png, {
              headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
            });
          } catch {
            // Um formato legado ou inválido conserva a exibição direta já usada para essas URLs.
          }
        }
      }
    }
    if (logo) return new Response(null, { status: 302, headers: { Location: logo } });
    const { iconeDeIniciais } = await import("./selo-png.server");
    return new Response(
      await iconeDeIniciais(
        name,
        shop.shop_id,
        shop.primary_color,
        shop.accent_color,
        tamanho,
        mascaravel,
      ),
      {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  }
  const cores = resolveBrandColors(shop.primary_color, shop.accent_color);
  const leque =
    brandTheme(cores.primary, cores.accent)?.leque ?? customBrandLeque(cores.primary, cores.accent);
  // O servidor aproveita a mesma consulta pública para antecipar a fonte no HTML.
  let fonte: URL | null = null;
  try {
    const url = new URL(shop.custom_font_url);
    if (
      url.protocol === "https:" &&
      origemPermitida.has(url.origin) &&
      url.pathname.startsWith("/storage/v1/object/public/barbershop-fonts/")
    )
      fonte = url;
  } catch {
    // Uma loja pode usar somente as famílias incluídas no aplicativo.
  }
  return Response.json(
    {
      id: "/",
      scope: "/",
      start_url: "/app",
      display: "standalone",
      lang: "pt-BR",
      name,
      short_name: name,
      theme_color: leque.meio,
      background_color: leque.meio,
      icons: [192, 512].flatMap((lado) =>
        ["any", "maskable"].map((purpose) => ({
          src: `/identidade/icone?dominio=${encodeURIComponent(domain)}&tamanho=${lado}${purpose === "maskable" ? "&mascara=1" : ""}`,
          sizes: `${lado}x${lado}`,
          type: "image/png",
          purpose,
        })),
      ),
    },
    {
      headers: {
        ...(fonte && { Link: "<" + fonte.href + ">; rel=preload; as=font; crossorigin=anonymous" }),
        "Content-Type": "application/manifest+json",
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}
