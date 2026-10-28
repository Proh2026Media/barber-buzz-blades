import { useEffect, useState } from "react";
import { useDemo } from "@/features/demo/context";
import { validateOccurrence, type Occurrence } from "@/features/insights/occurrences";
import { supabase } from "@/integrations/supabase/client";
import { t as tNow } from "@/lib/i18n";
import type { DayAppointment } from "./types";

export const MINUTE = 60_000;

/**
 * Ocorrências de um atendimento (atrasos e falta): lê do banco (ou da demonstração) e grava.
 * Cada cartão da Agenda usa o seu, como antes fazia o antigo painel "Ocorrências".
 */
export function useAttendance(row: DayAppointment, enabled: boolean) {
  const demo = useDemo();
  const [facts, setFacts] = useState<Occurrence>({});
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const id = row.id;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (demo) {
      setFacts(demo.attendance[id] ?? {});
      setLoaded(true);
      setFailed(false);
      return;
    }
    setLoaded(false);
    void supabase.rpc("get_appointment_attendance", { p_id: id }).then(({ data, error }) => {
      if (cancelled) return;
      setFailed(!!error);
      if (!error) {
        setFacts((data ?? {}) as Occurrence);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [demo, id, version, enabled]);

  async function save(customer: number | null, shop: number | null, noShow: boolean) {
    validateOccurrence(row, facts, customer, shop, noShow, demo?.now ?? new Date());
    if (demo) demo.dispatch({ type: "occurrence", id, customer, shop, noShow });
    else {
      const result = await supabase.rpc("save_appointment_occurrence", {
        p_id: id,
        p_customer_delay: customer,
        p_shop_delay: shop,
        p_no_show: noShow,
      });
      if (result.error) throw new Error(tNow("ins.att.saveError"));
    }
    setVersion((value) => value + 1);
  }

  return { facts, loaded, failed, save, reload: () => setVersion((value) => value + 1) };
}

export type Attendance = ReturnType<typeof useAttendance>;

/** O que dá para registrar agora (mesmas regras de antes, conferidas também no banco). */
export function occurrenceRules(row: DayAppointment, facts: Occurrence, now: Date) {
  const active = row.status === "pending" || row.status === "confirmed";
  const hasDelay = facts.customer_delay_minutes != null || facts.shop_delay_minutes != null;
  return {
    editable:
      now >= new Date(row.starts_at) && (active || row.status === "completed") && !facts.no_show_at,
    noShowAllowed:
      active && now >= new Date(row.ends_at) && !facts.arrived_at && !facts.started_at && !hasDelay,
    hasDelay,
  };
}

export const CUSTOMER_OPTIONS = [0, 5, 10, 15, 20, 30];

export const SHOP_OPTIONS = [0, 5, 10, 15];
