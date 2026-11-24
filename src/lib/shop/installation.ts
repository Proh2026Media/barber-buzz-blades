/** Identidade pública da instalação. A loja é resolvida exclusivamente pelo domínio. */
export async function shopIdentity(url: URL): Promise<Response> {
  const icon = url.pathname === "/identidade/icone";
  const platform = import.meta.env.VITE_PLATFORM_BASE_HOST || "beauty.contheiner.digital";
  const domain = (url.searchParams.get("dominio") || url.hostname).toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(domain)) return new Response(null, {status: 400});
  if ([platform, "localhost", "127.0.0.1"].includes(domain)) {
    return new Response(null, {status: 302, headers: {Location: icon ? "/icons/icon-180.png" : "/manifest.webmanifest"}});
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
  if (icon) {
    if (logo) return new Response(null, { status: 302, headers: { Location: logo } });
    const { iconeDeIniciais } = await import("./selo-png.server");
    return new Response(await iconeDeIniciais(name, shop.shop_id), {headers: {
      "Content-Type": "image/png", "Cache-Control": "private, max-age=300",
    }});
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
      theme_color: "#20211f",
      background_color: "#e9e5de",
      icons: [{ src: logo || "/identidade/icone?dominio=" + encodeURIComponent(domain), purpose: "any" }],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}
