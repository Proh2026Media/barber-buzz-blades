import { useQuery } from "@tanstack/react-query";
import { useDemo } from "@/features/demo/context";
import { supabase } from "@/integrations/supabase/client";
import { BrandFontFace } from "./BrandFontFace";

export function PublicBrandFontFace({
  shopId,
  url,
}: {
  shopId: string | null;
  url: string | null;
}) {
  const demo = useDemo();
  if (demo)
    return (
      <BrandFontFace url={demo.settings.custom_font_url} faces={demo.settings.custom_font_faces} />
    );
  if (!shopId || !url) return null;
  return <PublishedFamily shopId={shopId} url={url} />;
}

function PublishedFamily({ shopId, url }: { shopId: string; url: string }) {
  // Cada envio de família gera URLs novas. A vitrine e o login podem reutilizar a consulta.
  const { data } = useQuery({
    queryKey: ["fontes-publicadas", shopId, url],
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const result = await supabase
        .rpc("get_public_shop_font_faces", {
          p_shop_id: shopId,
          p_font_url: url,
        })
        .abortSignal(signal);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  // Um cadastro antigo pode ter apenas a URL. A lista vazia confirmada habilita esse caso.
  return Array.isArray(data) ? <BrandFontFace url={url} faces={data} /> : null;
}
