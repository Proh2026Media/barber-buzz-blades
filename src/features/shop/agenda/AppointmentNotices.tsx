import { useEffect, useState } from "react";
import { Bell, Mail } from "lucide-react";
import { useDemo } from "@/features/demo/context";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useI18n, type MessageKey } from "@/lib/i18n";

type Rows = Database["public"]["Functions"]["appointment_notice_history"]["Returns"];

const eventKeys: Record<string, MessageKey> = {
  created: "receipt.created",
  confirmed: "receipt.created",
  changed: "receipt.changed",
  rescheduled: "receipt.changed",
  cancelled: "receipt.cancelled",
  reminder: "receipt.reminder",
};

export function AppointmentNotices({ id }: { id: string }) {
  const { t, intlLocale } = useI18n();
  const demo = useDemo();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Rows | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || demo) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setRows(null);
    setFailed(false);
    async function refresh() {
      try {
        const result = await supabase.rpc("appointment_notice_history", { p_appointment: id });
        if (!active) return;
        setFailed(Boolean(result.error));
        if (!result.error) setRows(result.data);
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) timer = setTimeout(refresh, 30000);
      }
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, id, demo]);
  if (demo) return null;
  const format = (date: string) =>
    new Date(date).toLocaleString(intlLocale, { dateStyle: "short", timeStyle: "short" });
  return (
    <details className="w-full px-3 py-2 text-sm" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold">{t("receipt.title")}</summary>
      {open && (
        <div className="mt-2 space-y-2">
          {failed ? (
            <p role="status">{t("receipt.error")}</p>
          ) : !rows ? (
            <p role="status">{t("receipt.loading")}</p>
          ) : !rows.length ? (
            <p>{t("receipt.empty")}</p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {rows.map((r, i) => {
                  const email = r.channel === "email";
                  const Icon = email ? Mail : Bell;
                  const kind = r.kind.replace("booking.", "");
                  const event = eventKeys[kind];
                  const status = r.sent_at
                    ? "receipt.sent"
                    : ["pending", "sending", "queued", "processing"].includes(r.state)
                      ? "receipt.pending"
                      : "receipt.unconfirmed";
                  return (
                    <li key={i} className="py-2">
                      <p className="flex items-center gap-2 font-medium">
                        <Icon aria-hidden size={16} />
                        {email ? "E-mail" : "Push"} · {t(event ?? "receipt.title")}
                      </p>
                      <p>
                        {t(status)} · {format(r.sent_at ?? r.created_at)}
                      </p>
                      {r.opened_at && (
                        <p className="font-semibold">
                          {t(email ? "receipt.signal" : "receipt.opened")} · {format(r.opened_at)}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="text-muted-foreground">{t("receipt.help")}</p>
            </>
          )}
        </div>
      )}
    </details>
  );
}
