import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Info,
  KeyRound,
  Scissors,
  Store,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IconTile } from "@/components/visual";
import type { MessageKey } from "@/lib/i18n";

type T = (key: MessageKey) => string;

function RoleNode({
  icon,
  title,
  text,
  extra,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  /** Segundo papel do mesmo nó (ex.: responsável pelos dados da conta). */
  extra?: string;
}) {
  return (
    <li className="public-card flex items-center gap-3 rounded-xl border border-border p-3 sm:flex-col sm:text-center">
      <IconTile icon={icon} tone="muted" />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs leading-snug text-muted-foreground">{text}</span>
        {extra && (
          <span className="flex items-start gap-1 pt-1 text-xs font-semibold leading-snug sm:justify-center">
            <KeyRound
              className="mt-px size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            {extra}
          </span>
        )}
      </span>
    </li>
  );
}

function Arrow({ toward }: { toward: "next" | "previous" }) {
  const Mobile = toward === "next" ? ArrowDown : ArrowUp;
  const Wide = toward === "next" ? ArrowRight : ArrowLeft;
  return (
    <li aria-hidden="true" className="flex justify-center text-muted-foreground sm:items-center">
      <Mobile className="size-5 sm:hidden" />
      <Wide className="hidden size-5 sm:block" />
    </li>
  );
}

/**
 * "Quem é quem" em desenho: a barbearia decide, o Barba & Cabelo trata os dados em nome dela e
 * clientes e equipe têm direitos sobre os próprios dados. Resume a seção 1; o texto vale.
 * `withAccount` (Privacidade) mostra também o outro papel do Barba & Cabelo: responsável pelos
 * dados da conta e da plataforma. `showNote` põe sob o desenho a nota "Vale o texto completo";
 * a Privacidade não usa, porque a mesma nota já fica logo abaixo do "Em resumo".
 */
export function LegalRolesDiagram({
  t,
  showTitle = true,
  withAccount = false,
  showNote = false,
}: {
  t: T;
  showTitle?: boolean;
  withAccount?: boolean;
  showNote?: boolean;
}) {
  return (
    <figure className="space-y-2">
      <figcaption
        className={
          showTitle ? "text-xs font-bold uppercase tracking-wide text-muted-foreground" : "sr-only"
        }
      >
        {t("legal.roles.title")}
      </figcaption>
      <ol className="grid gap-1.5 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:gap-2">
        <RoleNode icon={Store} title={t("legal.roles.shop")} text={t("legal.roles.shopDesc")} />
        <Arrow toward="next" />
        <RoleNode
          icon={Scissors}
          title={t("legal.roles.platform")}
          text={t("legal.roles.platformDesc")}
          extra={withAccount ? t("legal.roles.platformOwn") : undefined}
        />
        <Arrow toward="previous" />
        <RoleNode icon={Users} title={t("legal.roles.people")} text={t("legal.roles.peopleDesc")} />
      </ol>
      {showNote && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          {t("legal.summaryNote")}
        </p>
      )}
    </figure>
  );
}
