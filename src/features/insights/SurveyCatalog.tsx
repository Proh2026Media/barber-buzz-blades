import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { questions } from "./model";

const metadata = {
  discovery: { name: "Origem do cliente", moment: "Depois da primeira reserva", repeat: "Uma vez" },
  satisfaction: {
    name: "Avaliação do atendimento",
    moment: "Após atendimento concluído nos últimos 90 dias",
    repeat: "Até uma vez a cada 180 dias",
  },
  improvement: {
    name: "Ponto de melhoria",
    moment: "Em outra oportunidade, após uma avaliação respondida",
    repeat: "Até uma vez a cada 180 dias",
  },
  period: {
    name: "Período preferido",
    moment: "Depois de existir uma reserva",
    repeat: "Até uma vez a cada 180 dias",
  },
  professional: {
    name: "Escolha do profissional",
    moment: "Depois de existir uma reserva",
    repeat: "Até uma vez a cada 180 dias",
  },
  frequency: {
    name: "Frequência desejada",
    moment: "Depois de existir uma reserva",
    repeat: "Até uma vez a cada 180 dias",
  },
  conversation: {
    name: "Preferência durante o atendimento",
    moment: "Depois de existir uma reserva",
    repeat: "Até uma vez a cada 180 dias",
  },
  service_interest: {
    name: "Interesse em novos serviços",
    moment: "Depois de existir uma reserva",
    repeat: "Até uma vez a cada 180 dias",
  },
} satisfies Record<keyof typeof questions, { name: string; moment: string; repeat: string }>;

export function SurveyCatalog({ compact = false }: { compact?: boolean }) {
  const keys = Object.keys(questions) as (keyof typeof questions)[];
  const [selected, setSelected] = useState<keyof typeof questions>("discovery");
  const question = questions[selected];

  if (compact) {
    return (
      <details className="rounded-xl border border-border bg-background/60 p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Ver as perguntas disponíveis</summary>
        <div className="mt-3 space-y-3">
          {keys.map((key) => (
            <div key={key} className="border-t border-border pt-3 first:border-0 first:pt-0">
              <p className="font-semibold">{metadata[key].name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{questions[key].title}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Ativar pesquisas não mostra todas de uma vez. O sistema escolhe somente uma pergunta
            elegível e respeita pelo menos 30 dias entre exibições.
          </p>
        </div>
      </details>
    );
  }

  return (
    <section
      aria-label="Questionários ativos"
      className="space-y-4 rounded-2xl border border-primary/20 bg-card p-4"
    >
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold">
          <ClipboardList className="size-5 text-primary" /> Questionários ativos
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {keys.length} perguntas padronizadas · uma pergunta por vez · intervalo global mínimo de
          30 dias
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-2" role="list" aria-label="Selecionar questionário">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={selected === key}
              onClick={() => setSelected(key)}
              className="w-full rounded-xl border border-border px-3 py-3 text-left text-sm aria-pressed:border-primary aria-pressed:bg-primary/10"
            >
              <span className="block font-semibold">{metadata[key].name}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {metadata[key].moment}
              </span>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-background p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Prévia · pesquisa opcional
          </p>
          <h3 className="mt-3 text-sm font-bold">{question.title}</h3>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Object.entries(question.options).map(([value, label]) => (
              <div
                key={value}
                className="rounded-xl border border-border bg-background px-3 py-2 text-center text-xs"
              >
                {label}
              </div>
            ))}
          </div>
          <dl className="mt-4 space-y-2 border-t border-border pt-3 text-xs">
            <div>
              <dt className="font-semibold">Quando aparece</dt>
              <dd className="text-muted-foreground">{metadata[selected].moment}</dd>
            </div>
            <div>
              <dt className="font-semibold">Repetição desta pergunta</dt>
              <dd className="text-muted-foreground">{metadata[selected].repeat}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
