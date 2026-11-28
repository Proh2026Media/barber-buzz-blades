import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, ListChecks } from "lucide-react";
import { PersonAvatar } from "@/components/visual";
import { SeloBarbearia } from "@/components/SeloBarbearia";
import { BrandRootVariables } from "@/features/shop/BrandRootVariables";
import { FontesDaPagina } from "@/features/shop/FontesDaPagina";
import { useI18n } from "@/lib/i18n";
import { brandCornerClass, brandVariables } from "@/lib/shop/branding";
import { useShopFavicon } from "@/lib/shop/favicon";
import { CabecalhoVitrine } from "./CabecalhoVitrine";
import { ServiceRow } from "./ShopLandingParts";

export type PerfilPublico = {
  loja: {
    id: string;
    slug: string;
    nome: string;
    logo: string | null;
    fundoLogo?: string | null;
    capa: string | null;
    cantos: string | null;
    primaria: string | null;
    destaque: string | null;
    fonte: string | null;
    arquivoFonte: string | null;
    peso: number | null;
    estilo: string | null;
  };
  profissional: {
    slug: string;
    nome: string;
    foto: string | null;
    bio: string | null;
    capa: string | null;
  };
  servicos: {
    id: string;
    nome: string;
    minutos: number;
    centavos: number;
    icone?: string | null;
    descricao?: string | null;
  }[];
};

export function PerfilProfissional({ perfil }: { perfil: PerfilPublico }) {
  const { loja, profissional, servicos } = perfil;
  const { t, intlLocale } = useI18n();
  const [falhas, setFalhas] = useState<string[]>([]);
  const capa = [profissional.capa, loja.capa].find((foto): foto is string =>
    Boolean(foto && !falhas.includes(foto)),
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
  const reserva = { shop: loja.slug, barber: profissional.slug };
  const moeda = new Intl.NumberFormat(intlLocale, { style: "currency", currency: "BRL" });
  useShopFavicon(loja.logo);
  return (
    <div
      className={`shop-landing public-page brand-page perfil-publico min-h-dvh bg-background text-foreground ${brandCornerClass(loja.cantos)}`}
      style={cores as CSSProperties}
      data-tema-loja={cores["--brand-esquema"]}
    >
      <BrandRootVariables
        vars={{ ...cores, "--brand-capa-navegador": cores["--brand-chao-claro"] }}
      />
      <FontesDaPagina
        shopId={loja.id}
        url={loja.arquivoFonte}
        familia={loja.fonte}
        peso={loja.peso}
        estilo={loja.estilo}
      />
      <CabecalhoVitrine
        identidade={
          <Link
            to="/"
            className="shop-hero-focus inline-flex min-h-11 min-w-0 items-center gap-2 rounded-[var(--control-radius)] font-semibold"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            <span
              className="quadro-logo-loja shop-hero-logo size-9 shrink-0 rounded-[var(--control-radius)]"
              style={{ backgroundColor: loja.fundoLogo ?? undefined }}
            >
              {loja.logo ? (
                <img src={loja.logo} alt="" />
              ) : (
                <SeloBarbearia
                  nome={loja.nome}
                  lojaId={loja.id}
                  tamanho={36}
                  tema={{ primary_color: loja.primaria, accent_color: loja.destaque }}
                />
              )}
            </span>
            <span className="min-w-0 break-words">{loja.nome}</span>
          </Link>
        }
      >
        <div className="perfil-hero-conteudo mx-auto grid max-w-3xl items-center gap-4 px-4 pb-6 pt-4 lg:max-w-6xl">
          {capa && (
            <div className="perfil-capa">
              <img
                src={capa}
                alt=""
                fetchPriority="high"
                onError={() => setFalhas((anteriores) => [...anteriores, capa])}
              />
            </div>
          )}
          <div className="perfil-apresentacao min-w-0">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <PersonAvatar
                profissional
                className="perfil-retrato shrink-0"
                size="xl"
                name={profissional.nome}
                src={profissional.foto}
                seed={profissional.slug}
              />
              <h1
                id="nome-profissional"
                className="shop-hero-title"
                style={{
                  fontFamily: "var(--brand-font)",
                  fontWeight: "var(--brand-header-font-weight)" as CSSProperties["fontWeight"],
                  fontStyle: "var(--brand-header-font-style)",
                }}
              >
                {profissional.nome}
              </h1>
            </div>
            {profissional.bio && (
              <p className="mt-3 max-w-xl whitespace-pre-line break-words leading-relaxed">
                {profissional.bio}
              </p>
            )}
            <Link
              to="/app"
              search={{ ...reserva, tab: "agendar", join: undefined, reserva: undefined }}
              className="shop-cta mt-4 w-full sm:w-auto sm:min-w-56"
            >
              <CalendarDays aria-hidden />
              {t("shopLanding.bookWith", { name: profissional.nome })}
            </Link>
          </div>
        </div>
      </CabecalhoVitrine>
      <main className="mx-auto max-w-3xl px-4 py-6 lg:max-w-6xl lg:py-10">
        {servicos.length > 0 && (
          <section aria-labelledby="servicos-profissional" className="space-y-3">
            <h2 id="servicos-profissional" className="shop-section-title">
              <ListChecks className="size-5 text-[var(--brand-accent-readable)]" aria-hidden />
              {t("shopLanding.servicesTitle")}
            </h2>
            <ul className="grade-servicos grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {servicos.map((s) => (
                <ServiceRow
                  key={s.id}
                  service={{
                    name: s.nome,
                    description: s.descricao ?? "",
                    icon: s.icone ?? null,
                    duration_minutes: s.minutos,
                    price_cents: s.centavos,
                  }}
                  price={moeda.format(s.centavos / 100)}
                  reserva={{ ...reserva, service: s.id }}
                />
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
