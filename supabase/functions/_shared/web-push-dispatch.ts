import type { WebSubscription } from "./web-push.ts";

export const PUSH_BATCH_SIZE = 4;
export type PushJob = { id: string; lease: string };
export type PushContext = WebSubscription & {
  id: string;
  locale: string;
  kind: string;
  target: string;
  shop_name?: string;
  receipt?: string;
  shop_icon?: boolean;
};
export type PushOutcome = "accepted" | "gone" | "failed" | "unknown";

export async function dispatchPushBatch(
  jobs: PushJob[],
  authorize: (job: PushJob) => Promise<PushContext | null>,
  send: (context: PushContext) => Promise<PushOutcome>,
  finish: (job: PushJob, outcome: PushOutcome) => Promise<void>,
) {
  // Não transmitir um lote legado de 20: instalação SQL e Edge precisam corresponder.
  if (jobs.length > PUSH_BATCH_SIZE) throw new Error("PUSH_BATCH_VERSION");
  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        // Revalidar sessão, destinatário e pausa no banco imediatamente antes de cada envio.
        const context = await authorize(job);
        if (!context) return "cancelled";
        let outcome: PushOutcome;
        try {
          outcome = await send(context);
        } catch {
          outcome = "unknown";
        }
        await finish(job, outcome);
        return "processed";
      } catch {
        // Nunca repetir autorização/envio/finish com resultado incerto. O claim em andamento
        // será convertido em unknown pelo banco após 5 min, sem voltar a queued.
        return "uncertain";
      }
    }),
  );
  return {
    processed: results.filter((r) => r === "processed").length,
    cancelled: results.filter((r) => r === "cancelled").length,
    uncertain: results.filter((r) => r === "uncertain").length,
  };
}
