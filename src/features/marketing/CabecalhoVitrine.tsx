import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export function CabecalhoVitrine({
  identidade,
  children,
  foto,
  topBar,
  mostrarControles = true,
  amplo = true,
}: {
  identidade: ReactNode;
  children: ReactNode;
  foto?: string | null;
  topBar?: ReactNode;
  mostrarControles?: boolean;
  amplo?: boolean;
}) {
  return (
    <header className={cn("shop-hero", foto && "shop-hero-with-photo")}>
      <span className="shop-hero-quarter" aria-hidden>
        {foto && <img src={foto} alt="" />}
      </span>
      <span className="shop-hero-ring" aria-hidden />
      {topBar}
      <div
        className={cn(
          "mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-4",
          amplo && "lg:max-w-6xl",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">{identidade}</div>
        {mostrarControles && (
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher showCode buttonClassName="app-icon-button hero-icon-button" />
            <ThemeToggle buttonClassName="app-icon-button hero-icon-button" />
          </div>
        )}
      </div>
      {children}
    </header>
  );
}
