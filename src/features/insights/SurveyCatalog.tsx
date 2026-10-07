import { useState } from "react";
import { CalendarClock, ClipboardList, Hand, SkipForward } from "lucide-react";
import {
  ChoiceChips,
  IconList,
  MoreDetails,
  PreviewPanel,
  SectionHeader,
  Tag,
} from "@/components/visual";
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
    // Temas em pílulas de escolha: tocar num tema mostra a pergunta exata e as respostas dele
    // (transparência: as 8 perguntas ficam ao alcance, sem depender de dica flutuante).
    return (
      <MoreDetails summary={t("surveys.seeAvailable")} icon={ClipboardList}>
        <div className="space-y-3">
          <ChoiceChips
            label={t("conta.surveys.topics", { count: keys.length })}
            value={selected}
            onChange={(next) => setSelected(next)}
            options={keys.map((key) => ({ value: key, label: t(metadata[key].name) }))}
          />
          <PreviewPanel title={t("conta.surveys.preview")} badge={t("conta.surveys.example")} live>
            <p className="text-sm font-bold">{question.title}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(question.options).map(([value, label]) => (
                <span
                  key={value}
                  className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-3">
              <Tag icon={CalendarClock}>{t(metadata[selected].moment)}</Tag>
            </div>
          </PreviewPanel>
          <IconList
            items={[
              { icon: Hand, text: t("conta.surveys.oneAtATime"), key: "one" },
              { icon: CalendarClock, text: t("conta.surveys.every30"), key: "every" },
              { icon: SkipForward, text: t("conta.surveys.skip"), key: "skip" },
            ]}
          />
        </div>
      </MoreDetails>
    );
  }

  return (
    <section
      aria-label={t("ins.catalog.title")}
      className="space-y-4 rounded-2xl border border-primary/20 bg-card p-4"
    >
      <SectionHeader
        as="h3"
        icon={ClipboardList}
        title={t("ins.catalog.title")}
        description={t("ins.catalog.summary", { count: keys.length })}
      />
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
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-background p-4 md:self-start">
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
