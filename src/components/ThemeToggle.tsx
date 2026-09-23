import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/use-theme";

type ThemeToggleProps = {
  className?: string;
  /** Extra classes for the button (defaults to app-icon-button). */
  buttonClassName?: string;
};

/** Toggle claro/escuro compartilhado por cliente, barbearia, plataforma e login. */
export function ThemeToggle({
  className,
  buttonClassName = "app-icon-button",
}: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Usar tema claro" : "Usar tema escuro"}
        aria-pressed={isDark}
        title={isDark ? "Tema claro" : "Tema escuro"}
        className={buttonClassName}
      >
        {isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}
