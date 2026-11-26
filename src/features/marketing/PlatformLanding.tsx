import { Link } from "@tanstack/react-router";
import {
  Armchair,
  ArrowRight,
  BellRing,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  Copy,
  Crown,
  Hand,
  Link2,
  Mail,
  Palette,
  PenTool,
  Plus,
  Scissors,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaletaToggle } from "@/components/PaletaToggle";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { AursetLogo } from "./AursetLogo";

/**
 * Temas de cor dos estabelecimentos (famílias do kit, brand/build/cores_leque.json). São as
 * únicas cores fora da marca-mãe nesta página, e aparecem só no bloco "Temas".
 */
const CLIENT_THEMES: {
  name: MessageKey;
  base: string;
  claro: string;
  forma: string;
  ui: string;
  profundo: string;
}[] = [
  {
    name: "landing.themePessego",
    base: "#FEDED2",
    claro: "#F7CDB4",
    forma: "#E1A959",
    ui: "#AC5D3A",
    profundo: "#3D2016",
  },
  {
    name: "landing.themeSol",
    base: "#F2F5CE",
    claro: "#EBE6A0",
    forma: "#A4C061",
    ui: "#8E6E05",
    profundo: "#33280A",
  },
  {
    name: "landing.themeMenta",
    base: "#CFE7C4",
    claro: "#9CDFBE",
    forma: "#96C980",
    ui: "#1C8062",
    profundo: "#093425",
  },
  {
    name: "landing.themeOceano",
    base: "#C3DBF1",
    claro: "#AFCBEE",
    forma: "#2BBFE7",
    ui: "#3870BA",
    profundo: "#0F2340",
  },
  {
    name: "landing.themeLavanda",
    base: "#D7DBF5",
    claro: "#CEC9EE",
    forma: "#8CAEF2",
    ui: "#7367BC",
    profundo: "#211C3D",
  },
];

/** Amostras das dez famílias (tom médio) e dos neutros, só como pontos de cor. */
const FAMILY_DOTS = [
  "#ED6863",
  "#E08A64",
  "#D88A2D",
  "#CFA52E",
  "#7FA84E",
  "#3E9C7C",
  "#4479C4",
  "#7F72C9",
  "#AC65AE",
  "#C95F7A",
  "#838383",
  "#262626",
];

const AUDIENCES: { icon: LucideIcon; label: MessageKey }[] = [
  { icon: Scissors, label: "landing.forSalon" },
  { icon: Armchair, label: "landing.forBarber" },
  { icon: PenTool, label: "landing.forStudio" },
  { icon: Hand, label: "landing.forNails" },
  { icon: Sparkles, label: "landing.forSkin" },
];

const FAQ: { q: MessageKey; a: MessageKey }[] = [
  { q: "landing.faq1Q", a: "landing.faq1A" },
  { q: "landing.faq2Q", a: "landing.faq2A" },
  { q: "landing.faq3Q", a: "landing.faq3A" },
  { q: "landing.faq4Q", a: "landing.faq4A" },
  { q: "landing.faq5Q", a: "landing.faq5A" },
  { q: "landing.faq6Q", a: "landing.faq6A" },
];

function Pill({ tone, children }: { tone: "tinta" | "areia" | "ceu"; children: ReactNode }) {
  return <span className={`au-lp-pill au-lp-pill-${tone}`}>{children}</span>;
}

/** Cabeçalho de seção: rótulo em pílula, título e, se houver, uma frase. */
function SectionHead({
  id,
  eyebrow,
  title,
  lead,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  lead?: string;
}) {
  return (
    <header className="au-lp-head">
      {eyebrow ? <p className="au-lp-eyebrow">{eyebrow}</p> : null}
      <h2 id={id} className="au-lp-h2">
        {title}
      </h2>
      {lead ? <p className="au-lp-sub">{lead}</p> : null}
    </header>
  );
}

function Feature({
  className,
  icon: Icon,
  title,
  text,
  children,
}: {
  className: string;
  icon: LucideIcon;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <li className={`au-lp-feat ${className}`}>
      <div className="au-lp-feat-text">
        <span className="au-lp-feat-icon" aria-hidden="true">
          <Icon />
        </span>
        <h3 className="au-lp-h3">{title}</h3>
        <p>{text}</p>
      </div>
      <div className="au-lp-feat-art" aria-hidden="true">
        {children}
      </div>
    </li>
  );
}

/**
 * Página inicial da plataforma (aurset): apresenta o produto a quem tem um estabelecimento e
 * leva ao cadastro; quem recebeu um link entra pelo "Entrar". Sem dados e sem JS de leiaute:
 * renderiza igual no servidor (os links legais precisam estar no HTML).
 */
export function PlatformLanding() {
  const { t, intlLocale } = useI18n();
  const price = (value: number) =>
    value.toLocaleString(intlLocale, {
      style: "currency",
      currency: "BRL",
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    });
  const day = [
    {
      time: "09:00",
      service: t("landing.sampleService2"),
      place: t("landing.samplePlace2"),
      tone: "ceu" as const,
      status: t("landing.statusConfirmed"),
    },
    {
      time: "10:30",
      service: t("landing.sampleService1"),
      place: t("landing.samplePlace1"),
      tone: "areia" as const,
      status: t("landing.statusWaiting"),
    },
    {
      time: "13:00",
      service: t("landing.sampleService3"),
      place: t("landing.samplePlace3"),
      tone: "tinta" as const,
      status: t("landing.statusNew"),
    },
  ];

  return (
    <div className="au-lp">
      <header className="au-lp-top">
        <div className="au-lp-top-bar">
          <a href="#inicio" className="au-lp-brand" aria-label={t("landing.home")}>
            <AursetLogo className="au-lp-logo" />
          </a>
          <nav className="au-lp-nav" aria-label={t("landing.navAria")}>
            <a href="#para-quem">{t("landing.navFor")}</a>
            <a href="#como-funciona">{t("landing.navHow")}</a>
            <a href="#recursos">{t("landing.navFeatures")}</a>
            <a href="#temas">{t("landing.navThemes")}</a>
            <a href="#duvidas">{t("landing.navFaq")}</a>
          </nav>
          <div className="au-lp-top-actions">
            <LanguageSwitcher
              showCode
              className="au-lp-top-lang"
              buttonClassName="au-lp-icon-btn"
            />
            <Link
              to="/auth"
              // Sem destino fixo: depois de entrar, cada pessoa vai para a própria área.
              search={{ next: "" }}
              className="au-lp-btn au-lp-btn-ghost au-lp-btn-sm"
            >
              {t("landing.signin")}
            </Link>
            <Link to="/cadastrar" className="au-lp-btn au-lp-btn-primary au-lp-btn-sm">
              {t("landing.cta")}
            </Link>
          </div>
        </div>
      </header>

      <main id="inicio">
        {/* Em telas estreitas o menu do topo não cabe: os mesmos atalhos, em fila que rola. */}
        <nav className="au-lp-jump" aria-label={t("landing.jumpAria")}>
          <a href="#para-quem">{t("landing.navFor")}</a>
          <a href="#como-funciona">{t("landing.navHow")}</a>
          <a href="#recursos">{t("landing.navFeatures")}</a>
          <a href="#temas">{t("landing.navThemes")}</a>
          <a href="#duvidas">{t("landing.navFaq")}</a>
        </nav>
        {/* ---------- Herói ---------- */}
        <section className="au-lp-wrap" aria-labelledby="au-lp-title">
          <div className="au-lp-hero">
            <span className="au-lp-hero-shape" aria-hidden="true" />
            <div className="au-lp-hero-text">
              <p className="au-lp-tag">{t("landing.heroTag")}</p>
              <h1 id="au-lp-title" className="au-lp-h1">
                {t("landing.heroTitle1")} <span>{t("landing.heroTitle2")}</span>
              </h1>
              <p className="au-lp-lead">{t("landing.lead")}</p>
              <div className="au-lp-hero-cta">
                <Link to="/cadastrar" className="au-lp-btn au-lp-btn-primary">
                  {t("landing.cta")}
                </Link>
                <a href="#como-funciona" className="au-lp-link">
                  {t("landing.heroSecondary")}
                  <ArrowRight aria-hidden="true" />
                </a>
              </div>
            </div>

            <figure className="au-lp-scene">
              <figcaption className="sr-only">{t("landing.sceneAria")}</figcaption>
              <span className="au-lp-scene-ring" aria-hidden="true" />
              <span className="au-lp-scene-pill" aria-hidden="true">
                <i />
                {t("landing.scenePill")}
              </span>
              <div className="au-lp-scene-photo">
                <img
                  src="/images/aurset/maos-768.webp"
                  srcSet="/images/aurset/maos-768.webp 768w, /images/aurset/maos.webp 1536w"
                  sizes="(min-width: 1024px) 340px, 60vw"
                  width={768}
                  height={512}
                  alt={t("landing.heroPhotoAlt")}
                  fetchPriority="high"
                  decoding="async"
                />
              </div>

              <div className="au-lp-float au-lp-float-day" aria-hidden="true">
                <p className="au-lp-float-head">
                  <strong>{t("landing.sampleToday")}</strong>
                  <span>{t("landing.sampleCount")}</span>
                </p>
                <ul>
                  {day.map((row) => (
                    <li key={row.time} className="au-lp-day-row">
                      <b>{row.time}</b>
                      <span>
                        {row.service}
                        <small>{row.place}</small>
                      </span>
                      <Pill tone={row.tone}>{row.status}</Pill>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="au-lp-float au-lp-float-ok" aria-hidden="true">
                <span className="au-lp-float-check">
                  <Check />
                </span>
                <p>
                  <b>14:30</b>
                  <span>{t("landing.sampleService1")}</span>
                </p>
                <Pill tone="tinta">{t("landing.statusConfirmed")}</Pill>
              </div>
            </figure>
          </div>
        </section>

        {/* ---------- Para quem é ---------- */}
        <section id="para-quem" className="au-lp-wrap au-lp-for" aria-labelledby="au-lp-for">
          <div className="au-lp-for-text">
            <h2 id="au-lp-for" className="au-lp-h2 au-lp-h2-sm">
              {t("landing.forTitle")}
            </h2>
            <p className="au-lp-sub">{t("landing.forLead")}</p>
          </div>
          <ul className="au-lp-for-list">
            {AUDIENCES.map(({ icon: Icon, label }) => (
              <li key={label}>
                <span aria-hidden="true">
                  <Icon />
                </span>
                {t(label)}
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Como funciona ---------- */}
        <section
          id="como-funciona"
          className="au-lp-wrap au-lp-section"
          aria-labelledby="au-lp-how"
        >
          <SectionHead
            id="au-lp-how"
            eyebrow={t("landing.stepsEyebrow")}
            title={t("landing.stepsTitle")}
          />
          <ol className="au-lp-steps">
            <li className="au-lp-step">
              <div className="au-lp-step-art au-lp-step-art-1" aria-hidden="true">
                <span className="au-lp-shape" />
                <div className="au-lp-mini">
                  <small>{t("landing.step1Field")}</small>
                  <span className="au-lp-mini-field">{t("landing.step1Value")}</span>
                  <span className="au-lp-mini-btn">{t("landing.step1Button")}</span>
                </div>
              </div>
              <div className="au-lp-step-body">
                <span className="au-lp-step-n" aria-hidden="true">
                  1
                </span>
                <h3 className="au-lp-h3">{t("landing.step1")}</h3>
                <p>{t("landing.step1Text")}</p>
              </div>
            </li>
            <li className="au-lp-step">
              <div className="au-lp-step-art au-lp-step-art-2" aria-hidden="true">
                <span className="au-lp-shape" />
                <div className="au-lp-mini">
                  <span className="au-lp-mini-row">
                    <b>{t("landing.sampleService1")}</b>
                    <i>
                      {t("landing.minutes", { n: 45 })} · {price(65)}
                    </i>
                  </span>
                  <span className="au-lp-mini-row">
                    <b>{t("landing.sampleService2")}</b>
                    <i>
                      {t("landing.minutes", { n: 90 })} · {price(180)}
                    </i>
                  </span>
                  <span className="au-lp-avatars">
                    <em>A</em>
                    <em>L</em>
                    <em>R</em>
                  </span>
                </div>
              </div>
              <div className="au-lp-step-body">
                <span className="au-lp-step-n" aria-hidden="true">
                  2
                </span>
                <h3 className="au-lp-h3">{t("landing.step2")}</h3>
                <p>{t("landing.step2Text")}</p>
              </div>
            </li>
            <li className="au-lp-step">
              <div className="au-lp-step-art au-lp-step-art-3" aria-hidden="true">
                <span className="au-lp-shape" />
                <div className="au-lp-mini au-lp-mini-bare">
                  <span className="au-lp-mini-link">
                    <Link2 />
                    <b>{t("landing.step3Link")}</b>
                    <Copy />
                  </span>
                  <span className="au-lp-mini-toast">
                    <BellRing />
                    <span>
                      <b>{t("landing.step3Toast")}</b>
                      <i>14:30 · {t("landing.sampleService1")}</i>
                    </span>
                  </span>
                </div>
              </div>
              <div className="au-lp-step-body">
                <span className="au-lp-step-n" aria-hidden="true">
                  3
                </span>
                <h3 className="au-lp-h3">{t("landing.step3")}</h3>
                <p>{t("landing.step3Text")}</p>
              </div>
            </li>
          </ol>
        </section>

        {/* ---------- Recursos ---------- */}
        <section id="recursos" className="au-lp-wrap au-lp-section" aria-labelledby="au-lp-feats">
          <SectionHead
            id="au-lp-feats"
            eyebrow={t("landing.featuresEyebrow")}
            title={t("landing.featuresTitle")}
          />
          <ul className="au-lp-bento">
            <Feature
              className="au-lp-feat-agenda"
              icon={CalendarDays}
              title={t("landing.featAgenda")}
              text={t("landing.featAgendaText")}
            >
              <div className="au-lp-agenda">
                <p className="au-lp-agenda-days">
                  {[24, 25, 26, 27, 28].map((n) => (
                    <span key={n} data-on={n === 26 ? "" : undefined}>
                      {n}
                    </span>
                  ))}
                </p>
                <ul>
                  {day.map((row, index) => (
                    <li key={row.time} className={`au-lp-slot au-lp-slot-${row.tone}`}>
                      <b>{row.time}</b>
                      <span>
                        {row.service}
                        <small>{row.place}</small>
                      </span>
                      <em>{"ALR"[index]}</em>
                    </li>
                  ))}
                </ul>
              </div>
            </Feature>

            <Feature
              className="au-lp-feat-page"
              icon={Palette}
              title={t("landing.featPage")}
              text={t("landing.featPageText")}
            >
              <div className="au-lp-page">
                <img
                  src="/images/aurset/bancada-768.webp"
                  width={768}
                  height={512}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <p>
                  <b>{t("landing.step1Value")}</b>
                  <span className="au-lp-page-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                </p>
                <span className="au-lp-mini-btn">{t("landing.featPageBook")}</span>
              </div>
            </Feature>

            <Feature
              className="au-lp-feat-club"
              icon={Crown}
              title={t("landing.featClub")}
              text={t("landing.featClubText")}
            >
              <div className="au-lp-club">
                <p>
                  <b>120</b> {t("landing.featClubPoints")}
                </p>
                <span className="au-lp-club-bar">
                  <i />
                </span>
                <span className="au-lp-club-stamps">
                  <i data-on="" />
                  <i data-on="" />
                  <i data-on="" />
                  <i />
                  <i />
                </span>
              </div>
            </Feature>

            <Feature
              className="au-lp-feat-notify"
              icon={BellRing}
              title={t("landing.featNotify")}
              text={t("landing.featNotifyText")}
            >
              <div className="au-lp-notes">
                <p>
                  <Mail />
                  <span>
                    <small>{t("landing.featNotifyMailLabel")}</small>
                    {t("landing.featNotifyMail")}
                  </span>
                </p>
                <p>
                  <BellRing />
                  <span>
                    <small>{t("landing.featNotifyPushLabel")}</small>
                    {t("landing.featNotifyPush")}
                  </span>
                </p>
              </div>
            </Feature>

            <Feature
              className="au-lp-feat-team"
              icon={Users}
              title={t("landing.featTeam")}
              text={t("landing.featTeamText")}
            >
              <div className="au-lp-team">
                <span className="au-lp-avatars au-lp-avatars-lg">
                  <em>A</em>
                  <em>L</em>
                  <em>R</em>
                </span>
                <span className="au-lp-team-roles">
                  <Pill tone="tinta">{t("eq.role.owner")}</Pill>
                  <Pill tone="ceu">{t("eq.role.associate")}</Pill>
                  <Pill tone="areia">{t("eq.role.employee")}</Pill>
                </span>
              </div>
            </Feature>

            <Feature
              className="au-lp-feat-insights"
              icon={ChartNoAxesColumn}
              title={t("landing.featInsights")}
              text={t("landing.featInsightsText")}
            >
              <div className="au-lp-chart">
                <small>{t("landing.featInsightsChart")}</small>
                <span className="au-lp-chart-bars">
                  {[42, 58, 50, 72, 88, 100, 30].map((h, i) => (
                    <i
                      key={i}
                      data-on={i === 5 ? "" : undefined}
                      style={{ "--h": `${h}%` } as CSSProperties}
                    />
                  ))}
                </span>
              </div>
            </Feature>
          </ul>
        </section>

        {/* ---------- Temas dos estabelecimentos ---------- */}
        <section id="temas" className="au-lp-wrap au-lp-section" aria-labelledby="au-lp-themes">
          <div className="au-lp-themes">
            <SectionHead
              id="au-lp-themes"
              eyebrow={t("landing.themesEyebrow")}
              title={t("landing.themesTitle")}
              lead={t("landing.themesLead")}
            />
            <ul
              className="au-lp-theme-list"
              aria-label={t("landing.themesAria")}
              // Em telas estreitas a lista rola de lado: precisa receber foco pelo teclado.
              tabIndex={0}
            >
              {CLIENT_THEMES.map((theme) => (
                <li
                  key={theme.name}
                  className="au-lp-theme"
                  style={
                    {
                      "--t-base": theme.base,
                      "--t-claro": theme.claro,
                      "--t-forma": theme.forma,
                      "--t-ui": theme.ui,
                      "--t-profundo": theme.profundo,
                    } as CSSProperties
                  }
                >
                  <div className="au-lp-theme-screen" aria-hidden="true">
                    <div className="au-lp-theme-cover">
                      <span />
                      <em>L</em>
                    </div>
                    <b>{t("landing.sampleShop")}</b>
                    <small>
                      {t("landing.sampleService1")} · {price(65)}
                    </small>
                    <small className="au-lp-theme-pick">{t("landing.themePick")}</small>
                    <span className="au-lp-theme-times">
                      <i>09:00</i>
                      <i data-on="">09:30</i>
                      <i>10:00</i>
                    </span>
                    <span className="au-lp-theme-btn">{t("landing.featPageBook")}</span>
                  </div>
                  <p className="au-lp-theme-name">
                    <span aria-hidden="true" />
                    {t(theme.name)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="au-lp-theme-more">
              <span className="au-lp-theme-dots" aria-hidden="true">
                {FAMILY_DOTS.map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
              {t("landing.themesMore")}
            </p>
          </div>
        </section>

        {/* ---------- Dúvidas ---------- */}
        <section id="duvidas" className="au-lp-wrap au-lp-section" aria-labelledby="au-lp-faq">
          <div className="au-lp-faq">
            <div className="au-lp-faq-side">
              <SectionHead
                id="au-lp-faq"
                eyebrow={t("landing.faqEyebrow")}
                title={t("landing.faqTitle")}
                lead={t("landing.faqLead")}
              />
              <div className="au-lp-faq-art">
                <span className="au-lp-faq-quarter" aria-hidden="true" />
                <span className="au-lp-faq-ring" aria-hidden="true" />
                <img
                  src="/images/aurset/luz-768.webp"
                  width={512}
                  height={768}
                  alt={t("landing.faqPhotoAlt")}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
            <div className="au-lp-faq-list">
              {FAQ.map(({ q, a }, index) => (
                <details key={q} className="au-lp-faq-item" open={index === 0}>
                  <summary>
                    <span>{t(q)}</span>
                    <Plus aria-hidden="true" />
                  </summary>
                  <p>{t(a)}</p>
                </details>
              ))}
              <p className="au-lp-faq-more">
                {t("landing.faqMore")}{" "}
                <Link to="/cadastrar">
                  {t("landing.cta")}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* ---------- Chamada final ---------- */}
        <section className="au-lp-wrap au-lp-section" aria-labelledby="au-lp-final">
          <div className="au-lp-final">
            <span className="au-lp-final-shape" aria-hidden="true" />
            <div className="au-lp-final-text">
              <h2 id="au-lp-final" className="au-lp-h2">
                {t("landing.finalTitle")}
              </h2>
              <p className="au-lp-sub">{t("landing.finalLead")}</p>
              <Link to="/cadastrar" className="au-lp-btn au-lp-btn-invert">
                {t("landing.finalCta")}
                <ArrowRight aria-hidden="true" />
              </Link>
              <p className="au-lp-final-client">
                {t("landing.finalClient")}{" "}
                <Link to="/auth" search={{ next: "" }}>
                  {t("landing.finalClientCta")}
                </Link>
              </p>
            </div>
            <div className="au-lp-final-art">
              <span className="au-lp-final-ring" aria-hidden="true" />
              <img
                src="/images/aurset/espaco-768.webp"
                srcSet="/images/aurset/espaco-768.webp 768w, /images/aurset/espaco.webp 1536w"
                sizes="(min-width: 1024px) 420px, 80vw"
                width={768}
                height={512}
                alt={t("landing.finalPhotoAlt")}
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="au-lp-wrap au-lp-foot">
        <div className="au-lp-foot-brand">
          <AursetLogo className="au-lp-logo" title="aurset" />
          <p>{t("landing.footTagline")}</p>
        </div>
        <nav className="au-lp-foot-nav" aria-label={t("landing.legalNav")}>
          <Link to="/privacidade">{t("landing.privacy")}</Link>
          <Link to="/termos">{t("landing.terms")}</Link>
          <Link to="/acordo-de-dados">{t("legal.dpaLink")}</Link>
        </nav>
        <div className="au-lp-foot-prefs" role="group" aria-label={t("landing.footPrefs")}>
          <LanguageSwitcher showCode buttonClassName="au-lp-icon-btn" />
          <PaletaToggle buttonClassName="au-lp-icon-btn" />
          <ThemeToggle buttonClassName="au-lp-icon-btn" />
        </div>
      </footer>
    </div>
  );
}
