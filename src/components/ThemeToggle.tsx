import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/use-theme";

type ThemeToggleProps = {
  className?: string;
  /** Extra classes for the button (defaults to app-icon-button). */
  buttonClassName?: string;
};

/** Toggle claro/escuro compartilhado por cliente, barbearia, plataforma e login. */
export function ThemeToggle({ className, buttonClassName = "app-icon-button" }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useI18n();
  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? t("theme.useLight") : t("theme.useDark")}
        aria-pressed={isDark}
        title={isDark ? t("theme.light") : t("theme.dark")}
        className={buttonClassName}
      >
        {isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}
