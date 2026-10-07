import { Link, useRouter } from "@tanstack/react-router";
import {
  ArrowUp,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Crown,
  FileText,
  Handshake,
  Languages,
  ListOrdered,
  ShieldCheck,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IconTile, StatusBadge, Tag } from "@/components/visual";
import { legalLinkClass } from "@/features/legal/rich-text";
import { INTL_LOCALE, translate, useI18n, type Locale, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Os documentos públicos que se ligam entre si no rodapé "Outros documentos". */
export type LegalDoc = "privacy" | "terms" | "dpa" | "club";

const DOCS: Record<
  LegalDoc,
  {
    icon: LucideIcon;
    to: "/privacidade" | "/termos" | "/acordo-de-dados" | "/politica";
    key: MessageKey;
  }
> = {
  privacy: { icon: ShieldCheck, to: "/privacidade", key: "legal.privacyLink" },
  terms: { icon: FileText, to: "/termos", key: "legal.termsLink" },
  dpa: { icon: Handshake, to: "/acordo-de-dados", key: "legal.dpaLink" },
  club: { icon: Crown, to: "/politica", key: "legal.clubLink" },
};

/** Botões do cabeçalho (voltar, idioma, tema): 44 px, mesmo estilo em todas as páginas públicas. */
export const legalHeaderButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-[var(--control-radius)] border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type LegalPageShellProps = {
  /** Qual documento é (ícone, público e marcação no rodapé). */
  doc: Exclude<LegalDoc, "club">;
  title: string;
  /** Data da versão vigente no formato AAAA-MM-DD. */
  updatedAt: string;
  /** Idioma próprio da página (ex.: detectado do navegador); sem ele, vale o idioma do app. */
  locale?: Locale;
  /** `?lang=` recebido no endereço; mantido nos links do rodapé entre os documentos legais. */
  langParam?: string;
  /** Bloco visual antes do texto (ex.: "Em resumo" da Privacidade). */
  summary?: ReactNode;
  children: ReactNode;
};

/** Idioma e tradução da página legal: o informado pela página ou o idioma do app. */
function useShellI18n(override?: Locale) {
  const app = useI18n();
  const locale = override ?? app.locale;
  return {
    locale,
    intlLocale: INTL_LOCALE[locale],
    t: (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
  };
}

/**
 * Aviso de tradução de cortesia, com ícone e atalho para o original; só aparece fora do pt-BR,
 * que é o texto oficial.
 */
export function LegalCourtesyNotice({
  className = "",
  locale: localeOverride,
  originalHref = "?lang=pt-BR",
}: {
  className?: string;
  locale?: Locale;
  /** Endereço da mesma página em pt-BR (padrão: a página atual com `?lang=pt-BR`). */
  originalHref?: string;
}) {
  const { t, locale } = useShellI18n(localeOverride);
  if (locale === "pt-BR") return null;
  return (
    <div
      role="note"
      className={cn(
        "public-card flex items-start gap-3 rounded-xl border border-border px-4 py-3 text-sm",
        className,
      )}
    >
      <Languages className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="min-w-0 space-y-1">
        <span className="block text-muted-foreground">{t("legal.courtesyNotice")}</span>
        <a href={originalHref} lang="pt-BR" hrefLang="pt-BR" className={legalLinkClass}>
          {translate("pt-BR", "legal.courtesyOriginal")}
        </a>
      </p>
    </div>
  );
}

/**
 * "Voltar": volta à página anterior quando a pessoa chegou navegando dentro do site (ex.: pelo
 * rodapé da página da barbearia). Usa o histórico do roteador, porque a navegação interna não
 * muda o document.referrer. Sem página anterior no site, leva ao endereço de reserva (o início).
 */
export function LegalBackButton({
  label,
  to = "/",
  search,
}: {
  label: string;
  to?: "/" | "/app";
  search?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // __TSR_index é a posição no histórico do roteador: 0 = primeira página aberta no site.
    const index = (router.history.location.state as { __TSR_index?: unknown }).__TSR_index;
    if (typeof index === "number" && index > 0) {
      event.preventDefault();
      router.history.back();
    }
  };
  return (
    <Link
      to={to}
      search={search as never}
      onClick={onClick}
      className={cn(legalHeaderButton, "shrink-0 pl-2 pr-3 text-sm font-semibold")}
    >
      <ChevronLeft className="size-5" aria-hidden="true" />
      <span className="max-[429px]:sr-only">{label}</span>
    </Link>
  );
}

/** Rodapé "Outros documentos": cartões com ícone, o atual marcado. */
export function LegalOtherDocs({
  current,
  locale,
  langParam,
  className,
}: {
  current: LegalDoc;
  locale?: Locale;
  langParam?: string;
  className?: string;
}) {
  const { t } = useShellI18n(locale);
  const search = langParam ? { lang: langParam } : {};
  return (
    <nav aria-label={t("legal.navAria")} className={cn("space-y-3", className)}>
      <h2 className="text-sm font-bold text-muted-foreground">{t("legal.otherDocs")}</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(DOCS) as LegalDoc[]).map((doc) => {
          const { icon: Icon, to, key } = DOCS[doc];
          const isCurrent = doc === current;
          return (
            <li key={doc}>
              <Link
                to={to}
                search={search as never}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "public-card flex h-full min-h-16 items-center gap-2.5 rounded-xl border p-3 text-sm font-semibold leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !isCurrent && "border-border hover:border-foreground/40",
                )}
                // O atual usa o par escuro declarado em .public-card (--primary), igual nos dois
                // temas: no escuro o --primary global é bege e o cartão sumia entre os off-white.
                style={
                  isCurrent
                    ? {
                        backgroundColor: "var(--primary)",
                        borderColor: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }
                    : undefined
                }
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  {t(key)}
                  {isCurrent && (
                    <span className="flex items-center gap-1 text-xs font-medium opacity-90">
                      <Check className="size-3.5 shrink-0" aria-hidden="true" />
                      {t("legal.youAreHere")}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-center">
        <Link to="/" className={`inline-flex min-h-11 items-center text-xs ${legalLinkClass}`}>
          {t("legal.home")}
        </Link>
      </p>
    </nav>
  );
}

/** Divide "3. Para que usamos" em número e texto (o número vira um selo no título e no índice). */
function splitNumbered(title: string) {
  const match = /^(\d+)\.\s*(.+)$/.exec(title.trim());
  return match ? { num: match[1], label: match[2] } : { num: null, label: title };
}

/** Seção numerada de um documento legal; entra no índice "Neste documento". */
export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  const { num, label } = splitNumbered(title);
  return (
    <section
      id={id ?? (num ? `parte-${num}` : undefined)}
      data-legal-section
      data-num={num ?? ""}
      data-label={label}
      className="scroll-mt-24 space-y-3"
    >
      <h2 className="flex items-start gap-3 text-lg font-bold leading-snug text-foreground">
        {num && (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-sm font-extrabold tabular-nums">
            {num}
          </span>
        )}
        <span className="min-w-0 pt-0.5">{label}</span>
      </h2>
      {children}
    </section>
  );
}

type TocItem = { id: string; num: string; label: string };

/**
 * Lê as seções do documento (já renderizadas) para o índice, acompanha a seção visível e o
 * progresso de leitura. Tudo no navegador: o HTML do servidor fica igual.
 */
function useDocumentNav(articleRef: RefObject<HTMLElement | null>, refreshKey: string) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const sections = Array.from(article.querySelectorAll<HTMLElement>("[data-legal-section]"));
    setItems(
      sections
        .filter((section) => section.id)
        .map((section) => ({
          id: section.id,
          num: section.dataset.num ?? "",
          label: section.dataset.label ?? "",
        })),
    );
    const words = (article.textContent ?? "").trim().split(/\s+/).length;
    setMinutes(Math.max(1, Math.round(words / 200)));

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
      // Some perto do fim, para não cobrir os links do rodapé.
      setShowTop(window.scrollY > window.innerHeight * 2 && window.scrollY < max - 160);
      let current: string | null = null;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 140) current = section.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [articleRef, refreshKey]);

  return { items, active, progress, showTop, minutes };
}

function TocList({
  items,
  active,
  onPick,
  ariaLabel,
}: {
  items: TocItem[];
  active: string | null;
  onPick?: () => void;
  ariaLabel: string;
}) {
  return (
    <ol aria-label={ariaLabel} className="space-y-1">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={onPick}
              aria-current={isActive ? "location" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm leading-snug transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? "bg-muted font-bold text-foreground" : "text-muted-foreground",
              )}
            >
              {item.num && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-extrabold tabular-nums",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  {item.num}
                </span>
              )}
              <span className="min-w-0">{item.label}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

/** Layout compartilhado das páginas públicas legais (SSR). */
export function LegalPageShell({
  doc,
  title,
  updatedAt,
  locale,
  langParam,
  summary,
  children,
}: LegalPageShellProps) {
  const { t, intlLocale } = useShellI18n(locale);
  const articleRef = useRef<HTMLElement>(null);
  const tocRef = useRef<HTMLDetailsElement>(null);
  const { items, active, progress, showTop, minutes } = useDocumentNav(articleRef, locale ?? "");
  const DocIcon = DOCS[doc].icon;
  const forOwners = doc === "dpa";
  const updatedLabel = new Date(`${updatedAt}T12:00:00Z`).toLocaleDateString(intlLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const tocLabel = t("legal.tocTitle");

  return (
    <div className="public-page min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-3 sm:px-6">
          <LegalBackButton label={t("legal.backShort")} />
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold">
            <DocIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="line-clamp-2 leading-tight">{title}</span>
          </p>
          <LanguageSwitcher locale={locale} showCode buttonClassName={legalHeaderButton} />
          <ThemeToggle buttonClassName={legalHeaderButton} />
        </div>
        <div aria-hidden="true" className="h-0.5 w-full bg-transparent">
          <div
            className="legal-progress h-full bg-primary"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
        {items.length > 0 && (
          <aside className="hidden lg:block">
            <nav aria-label={tocLabel} className="sticky top-24 space-y-2">
              <p className="flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <ListOrdered className="size-4" aria-hidden="true" />
                {tocLabel}
              </p>
              <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto pr-1">
                <TocList items={items} active={active} ariaLabel={tocLabel} />
              </div>
            </nav>
          </aside>
        )}

        <main className="mx-auto w-full max-w-3xl space-y-6 lg:col-start-2 lg:mx-0">
          <LegalCourtesyNotice locale={locale} />

          <section className="public-card space-y-4 rounded-2xl border border-border p-5">
            <div className="flex items-start gap-3">
              <IconTile icon={DocIcon} size="lg" tone="muted" />
              <h1 className="min-w-0 pt-1 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                {title}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone="neutral"
                icon={CalendarCheck}
                label={t("legal.updatedOn", { date: updatedLabel })}
              />
              <StatusBadge
                tone={forOwners ? "info" : "neutral"}
                icon={forOwners ? Store : Users}
                label={t(forOwners ? "legal.audienceOwners" : "legal.audienceAll")}
              />
              {minutes && <Tag icon={Clock3}>{t("legal.readingTime", { n: minutes })}</Tag>}
            </div>
          </section>

          {items.length > 0 && (
            <details
              ref={tocRef}
              className="public-card group rounded-2xl border border-border lg:hidden"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2 font-semibold [&::-webkit-details-marker]:hidden">
                <ListOrdered className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  {tocLabel}
                  <span className="text-muted-foreground">
                    {" · "}
                    {t("legal.tocCount", { n: items.length })}
                  </span>
                </span>
                <ChevronDown
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="border-t border-border p-2">
                <TocList
                  items={items}
                  active={active}
                  ariaLabel={tocLabel}
                  onPick={() => tocRef.current?.removeAttribute("open")}
                />
              </div>
            </details>
          )}

          {summary}

          <article
            ref={articleRef}
            className="legal-doc space-y-8 pt-2 text-[15px] leading-relaxed text-foreground/90"
          >
            {children}
          </article>

          <LegalOtherDocs
            current={doc}
            locale={locale}
            langParam={langParam}
            className="border-t border-border/60 pt-6"
          />
        </main>
      </div>

      {showTop && (
        <button
          type="button"
          onClick={() => {
            const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
            window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
          }}
          className="action-button fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 shadow-lg"
        >
          <ArrowUp aria-hidden="true" />
          {t("legal.toTop")}
        </button>
      )}
    </div>
  );
}
