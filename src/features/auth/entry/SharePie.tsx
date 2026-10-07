import { cn } from "@/lib/utils";

/**
 * Mini gráfico de pizza da divisão da sociedade: a sua parte na cor principal e a dos sócios
 * em dourado claro. Decorativo (o título do cartão já diz a divisão).
 */
export function SharePie({ share, className }: { share: number; className?: string }) {
  // Circunferência 100 (raio 15,9155): o traço vira porcentagem direto. O traço da largura do
  // diâmetro preenche o círculo inteiro, como uma pizza.
  const radius = 15.9155;
  const mine = Math.max(0, Math.min(100, Math.round(share * 100)));
  return (
    <svg viewBox="0 0 64 64" className={cn("size-9 shrink-0 -rotate-90", className)} aria-hidden>
      <circle cx="32" cy="32" r="31" fill="color-mix(in oklab, var(--gold) 30%, var(--card))" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        strokeWidth={radius * 2}
        stroke="var(--primary)"
        strokeDasharray={`${mine} ${100 - mine}`}
      />
      <circle cx="32" cy="32" r="31" fill="none" stroke="var(--card)" strokeWidth="1.5" />
    </svg>
  );
}
