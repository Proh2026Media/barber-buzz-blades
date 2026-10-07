import { Monitor, Moon, Smartphone, Sun } from "lucide-react";
import { SectionHeader, StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import type { ThemePreference } from "@/lib/theme";
import { setThemePreference } from "@/lib/use-theme";
import { useThemePreference } from "@/lib/use-theme-preference";
import { cn } from "@/lib/utils";
import { CompactChoiceTiles } from "./CompactChoiceTiles";

/** Mini tela clara, escura ou metade/metade (igual ao celular). */
function ThemeSketch({ mode }: { mode: ThemePreference }) {
  const half = mode === "system";
  const dark = mode === "dark";
  return (
    <span className="relative block aspect-[4/3] overflow-hidden rounded-lg border border-black/15">
      <span className={cn("absolute inset-0", dark ? "bg-[#1b1c19]" : "bg-[#eeebe4]")} />
      {half && <span className="absolute inset-y-0 right-0 w-1/2 bg-[#1b1c19]" />}
      <span className="absolute inset-x-2 top-2 h-2 rounded-full bg-[#8a602f]/70" />
      <span
        className={cn(
          "absolute inset-x-2 top-6 bottom-2 rounded-md",
          dark ? "bg-[#2a2b27]" : "bg-[#f7f5f0] shadow-sm",
        )}
      />
      {half && (
        <span className="absolute right-2 top-6 bottom-2 w-[calc(50%-0.5rem)] rounded-e-md bg-[#2a2b27]" />
      )}
    </span>
  );
}

/** Tema claro, escuro ou igual ao celular. A escolha fica só neste aparelho. */
export function ThemeSettingsCard() {
  const { t } = useI18n();
  const preference = useThemePreference();
  const options = (["light", "dark", "system"] as const).map((value) => ({
    value,
    label: t(`theme.choice.${value}` as const),
    media: <ThemeSketch mode={value} />,
  }));
  const Icon = preference === "dark" ? Moon : preference === "light" ? Sun : Monitor;
  return (
    <section className="app-action-card space-y-4 p-4 sm:p-5">
      <SectionHeader
        icon={Icon}
        title={t("theme.title")}
        aside={
          <StatusBadge
            tone="neutral"
            icon={Smartphone}
            size="sm"
            label={t("settingsHub.summary.thisDevice")}
          />
        }
      />
      <CompactChoiceTiles
        legend={t("theme.title")}
        value={preference}
        onChange={(value) => setThemePreference(value)}
        options={options}
      />
    </section>
  );
}
