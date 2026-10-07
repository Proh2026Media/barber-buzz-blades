import { CalendarClock, Clock3, Scissors, Users } from "lucide-react";
import { StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { BRAND_PALETTE, DEFAULT_LOGIN_IMAGE } from "@/lib/shop/branding";
import { cn } from "@/lib/utils";

function colorName(value: string, t: ReturnType<typeof useI18n>["t"]) {
  const entry = BRAND_PALETTE.find((item) => item.value.toUpperCase() === value.toUpperCase());
  return entry ? t(entry.nameKey) : value.toUpperCase();
}

/** Bolinhas da cor principal e de destaque, com o nome das cores para leitor de tela. */
export function ColorDots({
  primary,
  accent,
  size = "sm",
}: {
  primary: string;
  accent: string;
  size?: "sm" | "md";
}) {
  const { t } = useI18n();
  const dot = size === "md" ? "size-6" : "size-4";
  return (
    <span className="inline-flex items-center">
      <span
        aria-hidden
        className={cn(dot, "rounded-full border border-black/15 shadow-sm")}
        style={{ backgroundColor: primary }}
      />
      <span
        aria-hidden
        className={cn(dot, "-ms-1.5 rounded-full border border-black/15 shadow-sm")}
        style={{ backgroundColor: accent }}
      />
      <span className="sr-only">
        {t("settingsHub.summary.colors", {
          primary: colorName(primary, t),
          accent: colorName(accent, t),
        })}
      </span>
    </span>
  );
}

/** Miniatura da logo no quadrado com o fundo escolhido (ou a tesoura quando não há logo). */
export function LogoChip({
  logoUrl,
  background,
  className,
}: {
  logoUrl?: string | null;
  background?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 shrink-0 place-items-center overflow-hidden rounded-md border border-black/10",
        !background && !logoUrl && "bg-white",
        className,
      )}
      style={{ backgroundColor: background || "#ffffff" }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className="size-full object-contain p-[12%]" />
      ) : (
        <Scissors className="size-1/2 text-[#292925]" />
      )}
    </span>
  );
}

/** Selo de como a página aparece: completa ou só a marca com o botão Entrar. */
export function PageStatusBadge({
  enabled,
  size = "sm",
}: {
  enabled: boolean;
  size?: "sm" | "md";
}) {
  const { t } = useI18n();
  return enabled ? (
    <StatusBadge tone="success" label={t("shopLink.pageFull")} size={size} />
  ) : (
    <StatusBadge tone="neutral" label={t("shopLink.pageBrandOnly")} size={size} />
  );
}

export type PageBlocks = { staff: boolean; today: boolean; services: boolean; hours: boolean };

/**
 * Desenho da página pública (só ilustração, sem texto miúdo): capa com foto, logo e nome e,
 * na página completa, os blocos na ordem real — equipe (com os horários de hoje), serviços e
 * horário de funcionamento. Bloco desligado fica tracejado e apagado.
 */
export function PageSketch({
  full,
  blocks = { staff: true, today: true, services: true, hours: true },
  photo,
  logoUrl,
  logoBackground,
  primary = "#292925",
  size = "sm",
  className,
}: {
  full: boolean;
  blocks?: PageBlocks;
  photo?: string | null;
  logoUrl?: string | null;
  logoBackground?: string | null;
  primary?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const md = size === "md";
  const rows = [
    { key: "staff", icon: Users, on: blocks.staff },
    { key: "services", icon: Scissors, on: blocks.services },
    { key: "hours", icon: Clock3, on: blocks.hours },
  ] as const;
  return (
    <div
      aria-hidden
      className={cn(
        "overflow-hidden rounded-lg border border-black/10 bg-[#eeebe4] text-[#292925]",
        className,
      )}
    >
      <div className={cn("relative", md ? "h-24" : "h-12")}>
        <img
          src={photo || DEFAULT_LOGIN_IMAGE}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />
        <span className="absolute inset-x-2 bottom-1.5 flex items-center gap-1.5">
          <LogoChip
            logoUrl={logoUrl}
            background={logoBackground}
            className={md ? "size-7" : "size-4 rounded-sm"}
          />
          <span className={cn("block rounded-full bg-white/90", md ? "h-2 w-20" : "h-1.5 w-10")} />
        </span>
      </div>
      {full ? (
        <div className={cn("space-y-1", md ? "p-2" : "p-1")}>
          {rows.map(({ key, icon: Icon, on }) => (
            <div
              key={key}
              className={cn(
                "flex items-center gap-1 rounded-md border bg-[#f7f5f0]",
                md ? "px-2 py-1.5" : "px-1 py-0.5",
                on ? "border-black/10" : "border-dashed border-black/20 opacity-40",
              )}
            >
              <Icon className={cn("shrink-0 text-[#8a602f]", md ? "size-3.5" : "size-2.5")} />
              <span
                className={cn("block rounded-full bg-black/15", md ? "h-1.5 w-14" : "h-1 w-6")}
              />
              {key === "staff" && on && blocks.today && (
                <span className="ms-auto flex gap-0.5">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className={cn(
                        "block rounded-sm border border-black/15 bg-white",
                        md ? "h-2.5 w-5" : "h-1.5 w-2.5",
                      )}
                    />
                  ))}
                  <CalendarClock className={cn("text-[#8a602f]", md ? "size-3" : "hidden")} />
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={cn("flex flex-col items-center gap-1", md ? "p-3" : "p-1.5")}>
          <span className={cn("block rounded-full bg-black/15", md ? "h-1.5 w-24" : "h-1 w-10")} />
          <span
            className={cn("block w-3/4 rounded-md", md ? "h-6" : "h-3")}
            style={{ backgroundColor: primary }}
          />
        </div>
      )}
    </div>
  );
}
