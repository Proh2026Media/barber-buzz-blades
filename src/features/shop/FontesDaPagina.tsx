import { useQuery } from "@tanstack/react-query";
import { Abertura } from "@/components/Abertura";
import { useDemo } from "@/features/demo/context";
import { supabase } from "@/integrations/supabase/client";
import { brandFontStack, customBrandFontFamily } from "@/lib/shop/branding";
import { inferFontFile, normalizeFontFaces, primaryFontFace } from "@/lib/shop/font-files";

type Fontes = {
  shopId?: string | null;
  familia?: string | null;
  url?: string | null;
  faces?: unknown;
  peso?: number | null;
  estilo?: string | null;
};

async function prepararFontes({ shopId, familia, url, faces, peso, estilo }: Fontes) {
  if (!document.fonts) return "local";
  const controlador = new AbortController();
  let prazo: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<"local">((resolve) => {
    prazo = setTimeout(() => {
      controlador.abort();
      resolve("local");
    }, 5000);
  });

  async function carregarFamilia() {
    const nome = customBrandFontFamily(url);
    if (!url || !nome) return;
    let lista = normalizeFontFaces(faces);
    if (faces === undefined && shopId) {
      const { data, error } = await supabase
        .rpc("get_public_shop_font_faces", {
          p_shop_id: shopId,
          p_font_url: url,
        })
        .abortSignal(controlador.signal);
      if (error) return;
      lista = normalizeFontFaces(data);
    }
    if (controlador.signal.aborted) return;
    if (!lista.length)
      lista = [{ url, weight: 400, style: "normal", file_name: "Fonte personalizada" }];
    const preferidas = lista.filter((f) => f.style === (estilo === "italic" ? "italic" : "normal"));
    const escolhida = (preferidas.length ? preferidas : lista)
      .slice()
      .sort((a, b) => Math.abs(a.weight - (peso ?? 700)) - Math.abs(b.weight - (peso ?? 700)))[0];
    const principal = primaryFontFace(lista);
    const fontes = lista.map(
      (f) =>
        new FontFace(nome, "url(" + JSON.stringify(f.url) + ")", {
          display: "optional",
          weight: inferFontFile({ name: f.file_name }).variable ? "100 900" : String(f.weight),
          style: f.style,
        }),
    );
    // Prepara os pesos usados na abertura. As variantes restantes só são pedidas quando usadas.
    await Promise.all(
      fontes
        .filter((_, i) => lista[i] === escolhida || lista[i] === principal)
        .map((f) => f.load()),
    );
    if (controlador.signal.aborted) return;
    for (const face of fontes) document.fonts.add(face);
  }
  try {
    const familias = new Set([
      '"Inter Variable"',
      '"Instrument Sans Variable"',
      brandFontStack(familia).split(",")[0],
    ]);
    const base = Array.from(familias, (f) =>
      document.fonts.load("400 16px " + f, "Agendar horário"),
    );
    // Se a fonte enviada estiver indisponível, o próprio catálogo já tem uma alternativa pronta.
    return await Promise.race([
      Promise.all([...base, carregarFamilia().catch(() => undefined)]).then(
        () => "pronta" as const,
      ),
      limite,
    ]);
  } catch {
    return "local";
  } finally {
    clearTimeout(prazo);
    controlador.abort();
  }
}

/** Conserva a geometria dos controles enquanto a marca carrega, inclusive para o menu que mede as abas. */
export function FontesDaPagina(props: Fontes) {
  const demo = useDemo();
  const fontes = demo
    ? { ...props, url: demo.settings.custom_font_url, faces: demo.settings.custom_font_faces }
    : props;
  const { data } = useQuery({
    queryKey: ["tipografia-da-pagina", fontes],
    queryFn: () => prepararFontes(fontes),
    enabled: typeof document !== "undefined",
    staleTime: Infinity,
    gcTime: Infinity,
    networkMode: "always",
    retry: false,
  });
  if (data === "pronta") return null;
  if (data === "local") return <span hidden className="tipografia-do-aparelho" />;
  return (
    <div className="tipografia-em-preparo">
      <Abertura />
    </div>
  );
}
