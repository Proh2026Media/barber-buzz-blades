import { useState } from "react";
import { KeyRound, Languages, LogOut, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/visual";
import { ChangePasswordCard } from "@/features/auth/ChangePasswordCard";
import { LanguageSettingsCard } from "@/components/LanguageSettingsCard";
import { MyAreasSection } from "@/features/account/MyAreas";
import { useAreaSwitch } from "@/features/account/useAreas";
import type { AreaItem } from "@/lib/auth/areas";
import { useI18n } from "@/lib/i18n";

const ITEM =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-muted";

function MenuIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-4 shrink-0 text-gold" aria-hidden />;
}

/**
 * Menu da conta do painel da plataforma: quem está conectado, "Minhas áreas" (só as barbearias
 * em que o admin é da equipe, com o papel, e o app do cliente), senha, idioma e sair.
 */
export function PlatformAccountMenu({
  name,
  email,
  areas,
  onSignOut,
}: {
  name: string;
  email?: string | null;
  /** Áreas da conta; sem vínculo de equipe não há atalho para barbearia nenhuma. */
  areas: AreaItem[];
  onSignOut: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const areaSwitch = useAreaSwitch();
  const [panel, setPanel] = useState<"password" | "language" | null>(null);

  function openPanel(next: "password" | "language") {
    setOpen(false);
    window.setTimeout(() => setPanel(next), 0);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("plat.account.menuAria", { name })}
            className="app-icon-button p-0!"
          >
            <PersonAvatar name={name} size="sm" seed={email ?? name} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="z-[70] max-h-[calc(100dvh-6rem)] w-80 max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border-border p-2 shadow-xl"
        >
          <div className="flex items-center gap-3 px-2 pb-2 pt-1">
            <PersonAvatar name={name} size="md" seed={email ?? name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{name}</p>
              {email && email !== name && (
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              )}
              <p className="mt-0.5 text-xs font-semibold text-gold">{t("plat.account.role")}</p>
            </div>
          </div>
          <MyAreasSection
            areas={areas}
            current={{ kind: "platform" }}
            onPick={(area) => {
              setOpen(false);
              if (area.kind !== "platform") areaSwitch.open(area);
            }}
          />
          <div className="space-y-0.5 border-t border-border pt-1">
            <button type="button" className={ITEM} onClick={() => openPanel("password")}>
              <MenuIcon icon={KeyRound} />
              {t("plat.account.password")}
            </button>
            <button type="button" className={ITEM} onClick={() => openPanel("language")}>
              <MenuIcon icon={Languages} />
              {t("language.title")}
            </button>
          </div>
          <div className="mt-1 border-t border-border pt-1">
            <button type="button" className={ITEM} onClick={onSignOut}>
              <LogOut className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("plat.account.signOut")}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {areaSwitch.overlay}

      <Dialog open={panel !== null} onOpenChange={(next) => !next && setPanel(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[92dvh] max-w-md rounded-3xl border-border bg-card p-5"
        >
          <DialogTitle className="flex min-h-11 items-center gap-2 pr-12 text-lg font-bold">
            {panel === "language" ? (
              <Languages className="size-5 text-gold" aria-hidden />
            ) : (
              <KeyRound className="size-5 text-gold" aria-hidden />
            )}
            {panel === "language" ? t("language.title") : t("plat.account.password")}
          </DialogTitle>
          {panel === "password" && <ChangePasswordCard />}
          {panel === "language" && <LanguageSettingsCard hideHeading />}
        </DialogContent>
      </Dialog>
    </>
  );
}
