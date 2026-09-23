import { Link } from "@tanstack/react-router";
import {
  Building2,
  Eye,
  FlaskConical,
  Handshake,
  LogIn,
  Scissors,
  Shield,
  Smartphone,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import type { DemoRole } from "@/features/demo/chrome";

export type DemoSceneId = DemoRole | "login";

const scenes: {
  id: DemoSceneId;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    id: "customer",
    label: "App do cliente",
    hint: "Agendar, pontos e perfil como o cliente vê",
    icon: Smartphone,
  },
  {
    id: "owner",
    label: "Dono da loja",
    hint: "Agenda, equipe, ajustes e identidade",
    icon: Building2,
  },
  {
    id: "partner",
    label: "Sócio",
    hint: "Gestão compartilhada da barbearia",
    icon: Handshake,
  },
  {
    id: "associate",
    label: "Parceiro",
    hint: "Carteira e operação do profissional",
    icon: Briefcase,
  },
  {
    id: "employee",
    label: "Contratado",
    hint: "Agenda e atendimento do dia",
    icon: Scissors,
  },
  {
    id: "platform",
    label: "Admin global",
    hint: "Painel da plataforma em modo teste",
    icon: Shield,
  },
  {
    id: "login",
    label: "Página de login",
    hint: "Como a loja aparece antes de entrar",
    icon: LogIn,
  },
];

type DemoTourHubProps = {
  shopId: string;
  shopName?: string;
  disabled?: boolean;
  onPreviewLogin?: () => void;
};

/**
 * Hub do admin: transforma qualquer ambiente (cliente, loja, papéis, login, plataforma)
 * num tour visual isolado, sem alterar a operação real.
 */
export function DemoTourHub({ shopId, shopName, disabled, onPreviewLogin }: DemoTourHubProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-primary/25 bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FlaskConical className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold">Ambiente de teste visual</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Entre em qualquer tela como o usuário final veria — com dados fictícios
            {shopName ? ` baseados em ${shopName}` : ""}. Nada aqui altera a operação real.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {scenes.map((scene) => {
          const Icon = scene.icon;
          if (scene.id === "login") {
            return (
              <button
                key={scene.id}
                type="button"
                disabled={disabled || !shopId}
                onClick={onPreviewLogin}
                className="flex min-h-[4.5rem] items-start gap-3 rounded-2xl border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    {scene.label}
                    <Eye className="size-3.5 text-muted-foreground" aria-hidden />
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {scene.hint}
                  </span>
                </span>
              </button>
            );
          }
          return (
            <Link
              key={scene.id}
              to="/demo"
              search={{ shop: shopId || undefined, view: scene.id }}
              aria-disabled={disabled || !shopId}
              onClick={(event) => {
                if (disabled || !shopId) event.preventDefault();
              }}
              className="flex min-h-[4.5rem] items-start gap-3 rounded-2xl border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 aria-disabled:pointer-events-none aria-disabled:opacity-50"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{scene.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {scene.hint}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
