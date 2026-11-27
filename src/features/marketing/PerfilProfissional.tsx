import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, ChevronRight, Clock3, Scissors } from "lucide-react";
import { PersonAvatar } from "@/components/visual";
import { BrandRootVariables } from "@/features/shop/BrandRootVariables";
import { PublicBrandFontFace } from "@/features/shop/PublicBrandFontFace";
import { useI18n } from "@/lib/i18n";
import { brandCornerClass, brandVariables } from "@/lib/shop/branding";
import { useShopFavicon } from "@/lib/shop/favicon";

type Pessoa = { slug: string; nome: string; foto: string | null };
export type PerfilPublico = {
  loja: {
    id: string;
    slug: string;
    nome: string;
    logo: string | null;
    capa: string | null;
    cantos: string | null;
    primaria: string | null;
    destaque: string | null;
    fonte: string | null;
    arquivoFonte: string | null;
    peso: number | null;
    estilo: string | null;
  };
  profissional: Pessoa & { bio: string | null; capa: string | null };
  equipe: Pessoa[];
  servicos: { id: string; nome: string; minutos: number; centavos: number }[];
};

export function PerfilProfissional({ perfil }: { perfil: PerfilPublico }) {
  const { loja, profissional, equipe, servicos } = perfil;
  const { t, intlLocale } = useI18n();
  const [imagensIndisponiveis, setImagensIndisponiveis] = useState<string[]>([]);
  const capa = [profissional.capa, loja.capa].find((url): url is string =>
    Boolean(url && !imagensIndisponiveis.includes(url)),
  );
  const cores = brandVariables(
    loja.primaria,
    loja.destaque,
    loja.fonte,
    loja.arquivoFonte,
    loja.peso,
    loja.estilo,
    loja.cantos,
  );
  const busca = {
    shop: loja.slug,
    barber: profissional.slug,
    tab: "agendar",
    join: undefined,
    reserva: undefined,
  };
  const moeda = new Intl.NumberFormat(intlLocale, { style: "currency", currency: "BRL" });
  useShopFavicon(loja.logo);
  return (
    <main
      className={`shop-landing public-page brand-page perfil-publico min-h-dvh bg-background text-foreground ${brandCornerClass(loja.cantos)}`}
      style={cores as CSSProperties}
      data-tema-loja={cores["--brand-esquema"]}
    >
      <BrandRootVariables vars={cores} />
      <PublicBrandFontFace shopId={loja.id} url={loja.arquivoFonte} />
      <div className="perfil-conteudo mx-auto w-full max-w-5xl space-y-4">
        <Link to="/" className="inline-flex min-h-11 max-w-full items-center gap-2 font-semibold">
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          {loja.logo && <img className="size-7 object-contain" src={loja.logo} alt="" />}
          <span className="break-words">{loja.nome}</span>
        </Link>
        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,.85fr)]">
          <section
            aria-labelledby="nome-profissional"
            className="public-card perfil-cartao min-w-0 overflow-hidden rounded-[var(--panel-radius)] border border-border bg-card"
          >
            <div className={capa ? "perfil-capa" : "perfil-capa perfil-capa-sem-foto"}>
              {capa && (
                <img
                  src={capa}
                  alt=""
                  fetchPriority="high"
                  onError={() => setImagensIndisponiveis((anteriores) => [...anteriores, capa])}
                />
              )}
            </div>
            <div className="px-5 pb-6 sm:px-7">
              <PersonAvatar
                className="perfil-retrato"
                size="xl"
                name={profissional.nome}
                src={profissional.foto}
                seed={profissional.slug}
              />
              <h1
                id="nome-profissional"
                className="mt-3 break-words text-3xl font-bold tracking-tight sm:text-4xl"
                style={{ fontFamily: "var(--brand-font)" }}
              >
                {profissional.nome}
              </h1>
              {profissional.bio && (
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                  {profissional.bio}
                </p>
              )}
              <Link
                to="/app"
                search={busca}
                className="shop-cta mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2"
              >
                <CalendarDays aria-hidden className="size-5" />
                {t("shopLanding.bookWith", { name: profissional.nome })}
              </Link>
            </div>
          </section>
          <div className="min-w-0 space-y-5">
            {equipe.length > 1 && (
              <nav
                aria-labelledby="equipe-profissional"
                className="public-card rounded-[var(--panel-radius)] border border-border bg-card p-4"
              >
                <h2 id="equipe-profissional" className="shop-section-title">
                  {t("shopLanding.staffTitle")}
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {equipe.map((p) => (
                    <li key={p.slug}>
                      <Link
                        to="/$barberSlug"
                        params={{ barberSlug: p.slug }}
                        aria-current={p.slug === profissional.slug ? "page" : undefined}
                        className="perfil-miniatura inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] border border-border px-2.5 py-1 text-sm font-semibold"
                      >
                        <PersonAvatar size="sm" name={p.nome} src={p.foto} seed={p.slug} />
                        {p.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            {servicos.length > 0 && (
              <section
                aria-labelledby="servicos-profissional"
                className="public-card rounded-[var(--panel-radius)] border border-border bg-card p-4"
              >
                <h2 id="servicos-profissional" className="shop-section-title">
                  <Scissors className="size-5" aria-hidden />
                  {t("shopLanding.servicesTitle")}
                </h2>
                <ul className="mt-2 divide-y divide-border">
                  {servicos.map((s) => (
                    <li key={s.id}>
                      <Link
                        to="/app"
                        search={{ ...busca, service: s.id }}
                        className="flex min-h-14 items-center gap-3 py-3"
                      >
                        <span className="min-w-0 flex-1">
                          <strong className="block break-words">{s.nome}</strong>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="size-3.5" aria-hidden />
                            {t("team.notice.minutes", { count: s.minutos })}
                          </span>
                        </span>
                        <span className="text-sm font-semibold">
                          {moeda.format(s.centavos / 100)}
                        </span>
                        <ChevronRight className="size-4 shrink-0" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
