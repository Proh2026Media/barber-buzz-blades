import { Link } from "@tanstack/react-router";
import { ChevronLeft, Scissors } from "lucide-react";
import type { ReactNode } from "react";

type LegalPageShellProps = {
  title: string;
  updatedAt: string;
  children: ReactNode;
};

/** Layout compartilhado das páginas públicas legais (SSR). */
export function LegalPageShell({ title, updatedAt, children }: LegalPageShellProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--control-radius)] border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Voltar ao início"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
          <p className="flex min-w-0 items-center gap-2 text-sm font-bold">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--control-radius)] bg-muted">
              <Scissors className="size-4" aria-hidden="true" />
            </span>
            <span className="truncate">Barba &amp; Cabelo</span>
          </p>
          <span className="w-11" aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {updatedAt}</p>
        <article className="legal-doc mt-8 space-y-6 text-[15px] leading-relaxed text-foreground/90">
          {children}
        </article>
      </main>

      <footer className="border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2" aria-label="Documentos legais">
          <Link to="/privacidade" className="min-h-11 inline-flex items-center font-semibold text-foreground underline-offset-2 hover:underline">
            Política de Privacidade
          </Link>
          <Link to="/termos" className="min-h-11 inline-flex items-center font-semibold text-foreground underline-offset-2 hover:underline">
            Termos de Uso
          </Link>
          <Link to="/" className="min-h-11 inline-flex items-center font-semibold text-foreground underline-offset-2 hover:underline">
            Início
          </Link>
        </nav>
      </footer>
    </div>
  );
}
