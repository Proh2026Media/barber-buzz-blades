import { CalendarDays, Send, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import {
  numberActivityLevel,
  type NumberActivity as Metrics,
} from "@/lib/whatsapp/number-activity";

export function NumberActivity({ activity }: { activity?: Metrics }) {
  activity = activity?.scope === "groups" ? activity : undefined;
  const { t } = useI18n();
  const level = numberActivityLevel(activity);
  return (
    <span className="wa-number-activity" data-activity={level} title={t("waActivity.rule")}>
      <StatusBadge
        size="sm"
        tone={level === "review" ? "warning" : level === "unknown" ? "neutral" : "info"}
        label={t(("waActivity." + level) as "waActivity.unknown")}
      />
      <span className="wa-number-activity-metrics">
        <span
          role="img"
          aria-label={t("waActivity.accepted", { count: activity?.accepted ?? "—" })}
          title={t("waActivity.accepted", { count: activity?.accepted ?? "—" })}
        >
          <Send aria-hidden className="size-3" />
          {activity?.accepted ?? "—"}
        </span>
        <span
          role="img"
          aria-label={t("waActivity.days", { count: activity?.activeDays ?? "—" })}
          title={t("waActivity.days", { count: activity?.activeDays ?? "—" })}
        >
          <CalendarDays aria-hidden className="size-3" />
          {activity?.activeDays ?? "—"}
        </span>
        <span
          role="img"
          aria-label={t("waActivity.uncertain", { count: activity?.uncertain ?? "—" })}
          title={t("waActivity.uncertain", { count: activity?.uncertain ?? "—" })}
        >
          <AlertTriangle aria-hidden className="size-3" />
          {activity?.uncertain ?? "—"}
        </span>
        <small>30 d</small>
      </span>
      <small>
        {t(activity?.source === "simulation" ? "waActivity.simulated" : "waActivity.internal")}
      </small>
    </span>
  );
}
