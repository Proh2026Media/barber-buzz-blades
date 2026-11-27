import { useId, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Sheet } from "lucide-react";
import { DetailList, Notice, SectionHeader, StatusBadge } from "@/components/visual";
import { useDemo } from "@/features/demo/context";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  CONTAGENS,
  HORARIOS,
  LOJA_COM_PLANILHA,
  lerSituacaoPlanilha,
  motivoDaRevisao,
} from "./externa-sync-status";

const PLANILHA =
  "https://docs.google.com/spreadsheets/d/1fqb5vW5Y1vJ7-OCbK6vs8LN2SolXsjjbU5bRt3ESqUc/edit#gid=0";

function observarConexao(mudou: () => void) {
  window.addEventListener("offline", mudou);
  window.addEventListener("online", mudou);
  return () => {
    window.removeEventListener("offline", mudou);
    window.removeEventListener("online", mudou);
  };
}

export function ExternaSyncCard({ shopId, timezone }: { shopId: string; timezone: string }) {
  const { t, intlLocale } = useI18n();
  const demo = useDemo();
  const id = useId();
  const online = useSyncExternalStore(
    observarConexao,
    () => navigator.onLine,
    () => true,
  );
  const habilitado = !demo && shopId === LOJA_COM_PLANILHA;
  const consulta = useQuery({
    queryKey: ["acompanhamento-planilha", shopId],
    enabled: habilitado,
    refetchInterval: 60_000,
    gcTime: 0,
    retry: 1,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("platform_externa_sync_status", { p_shop_id: shopId })
        .abortSignal(signal);
      if (error) throw error;
      return lerSituacaoPlanilha(data);
    },
  });
  if (!habilitado || consulta.data === null) return null;
  const dados = consulta.data;
  const falha = !online || consulta.isError || consulta.fetchStatus === "paused";
  const estado = dados?.estado;
  const tom = { ok: "success", revisar: "warning", atrasado: "warning", erro: "danger" } as const;
  const hora = new Intl.DateTimeFormat(intlLocale, {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  });
  return (
    <section
      className="col-span-full space-y-3 rounded-2xl border border-border bg-card p-4"
      aria-labelledby={id}
    >
      <SectionHeader
        as="h4"
        id={id}
        icon={Sheet}
        title={t("externaSync.titulo")}
        aside={
          estado && !falha ? (
            <StatusBadge tone={tom[estado]} label={t(`externaSync.${estado}`)} />
          ) : undefined
        }
      />
      {falha && (
        <Notice
          tone="warning"
          title={t(online ? "externaSync.indisponivel" : "externaSync.semInternet")}
          action={{
            label: t("visual.retry"),
            icon: RefreshCw,
            onClick: () => void consulta.refetch(),
            disabled: !online,
            busy: consulta.isFetching,
          }}
        />
      )}
      {dados ? (
        <>
          <DetailList
            items={HORARIOS.map((campo) => ({
              label: t(`externaSync.${campo}`),
              value: dados[campo] ? (
                <time dateTime={dados[campo]}>{hora.format(new Date(dados[campo]))}</time>
              ) : (
                "—"
              ),
            }))}
          />
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 sm:grid-cols-3">
            {CONTAGENS.map((campo) => (
              <div key={campo}>
                <dt className="text-xs text-muted-foreground">{t(`externaSync.${campo}`)}</dt>
                <dd className="font-semibold tabular-nums">
                  {dados[campo]?.toLocaleString(intlLocale) ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
          {dados.revisao.length > 0 && (
            <ul className="divide-y divide-border border-t border-border">
              {dados.revisao.map(({ linha, motivo }) => (
                <li
                  key={linha}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1 text-sm"
                >
                  <span>{t(motivoDaRevisao(motivo))}</span>
                  <a
                    className="action-button min-h-11"
                    href={`${PLANILHA}&range=A${linha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("externaSync.linha", { linha })}
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : !falha ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("visual.loading")}
        </p>
      ) : null}
    </section>
  );
}
