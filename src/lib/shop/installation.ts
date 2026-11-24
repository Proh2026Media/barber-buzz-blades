/** Identidade pública da instalação. A loja é resolvida exclusivamente pelo domínio. */
export async function shopIdentity(url: URL): Promise<Response> {
  const icon = url.pathname === "/identidade/icone";
  const platform = import.meta.env.VITE_PLATFORM_BASE_HOST || "beauty.contheiner.digital";
  if ([platform, "localhost", "127.0.0.1"].includes(url.hostname)) {
    return Response.redirect(
      new URL(icon ? "/icons/icon-180.png" : "/manifest.webmanifest", url),
      302,
    );
  }
  const api = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(new URL("/rest/v1/rpc/get_public_shop_branding_by_host", api), {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_host: url.hostname }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return new Response(null, { status: 503 });
  const shop = await res.json();
  if (!shop?.shop_id) return new Response(null, { status: 404 });
  const name = shop.display_name?.trim() || shop.shop_name;
  const logo =
    typeof shop.logo_url === "string" && shop.logo_url.startsWith("https://")
      ? shop.logo_url
      : new URL("/icons/loja.png", url).href;
  if (icon) return Response.redirect(logo, 302);
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
      icons: [{ src: logo, purpose: "any" }],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}
