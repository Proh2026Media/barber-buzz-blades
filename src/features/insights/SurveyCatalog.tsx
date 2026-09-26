import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { questions } from "./model";

const afterBooking = {
  moment: "ins.catalog.momentHasBooking",
  repeat: "ins.catalog.repeat180",
} as const;
const metadata = {
  discovery: {
    name: "ins.catalog.name.discovery",
    moment: "ins.catalog.momentFirstBooking",
    repeat: "ins.catalog.repeatOnce",
  },
  satisfaction: {
    name: "ins.catalog.name.satisfaction",
    moment: "ins.catalog.momentRecentVisit",
    repeat: "ins.catalog.repeat180",
  },
  improvement: {
    name: "ins.catalog.name.improvement",
    moment: "ins.catalog.momentAfterRating",
    repeat: "ins.catalog.repeat180",
  },
  period: { name: "ins.catalog.name.period", ...afterBooking },
  professional: { name: "ins.catalog.name.professional", ...afterBooking },
  frequency: { name: "ins.catalog.name.frequency", ...afterBooking },
  conversation: { name: "ins.catalog.name.conversation", ...afterBooking },
  service_interest: { name: "ins.catalog.name.service_interest", ...afterBooking },
} satisfies Record<
  keyof typeof questions,
  { name: MessageKey; moment: MessageKey; repeat: MessageKey }
>;

export function SurveyCatalog({ compact = false }: { compact?: boolean }) {
  const keys = Object.keys(questions) as (keyof typeof questions)[];
  const [selected, setSelected] = useState<keyof typeof questions>("discovery");
  const question = questions[selected];
  const { t } = useI18n();

  if (compact) {
    return (
      <details className="rounded-xl border border-border bg-background/60 p-3 text-sm">
        <summary className="cursor-pointer py-3 font-semibold">{t("surveys.seeAvailable")}</summary>
        <div className="mt-3 space-y-3">
          {keys.map((key) => (
            <div key={key} className="border-t border-border pt-3 first:border-0 first:pt-0">
              <p className="font-semibold">{t(metadata[key].name)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{questions[key].title}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{t("surveys.oneAtATime")}</p>
        </div>
      </details>
    );
  }

  return (
    <section
      aria-label={t("ins.catalog.title")}
      className="space-y-4 rounded-2xl border border-primary/20 bg-card p-4"
    >
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold">
          <ClipboardList className="size-5 text-primary" /> {t("ins.catalog.title")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("ins.catalog.summary", { count: keys.length })}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-2" role="list" aria-label={t("ins.catalog.selectAria")}>
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={selected === key}
              onClick={() => setSelected(key)}
              className="w-full rounded-xl border border-border px-3 py-3 text-left text-sm aria-pressed:border-primary aria-pressed:bg-primary/10"
            >
              <span className="block font-semibold">{t(metadata[key].name)}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {t(metadata[key].moment)}
              </span>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-background p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            {t("ins.catalog.preview")}
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
              <dt className="font-semibold">{t("ins.catalog.when")}</dt>
              <dd className="text-muted-foreground">{t(metadata[selected].moment)}</dd>
            </div>
            <div>
              <dt className="font-semibold">{t("ins.catalog.repeat")}</dt>
              <dd className="text-muted-foreground">{t(metadata[selected].repeat)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
