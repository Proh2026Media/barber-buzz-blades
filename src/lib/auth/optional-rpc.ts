import { supabase } from "@/integrations/supabase/client";

/**
 * Chamada a uma RPC que pode ainda não existir no banco.
 *
 * O site é publicado antes de as migrations serem aplicadas: enquanto isso, a função nova
 * não existe (PGRST202 no PostgREST, 42883 no Postgres, ou 404). Nesse caso devolvemos
 * `missing: true` e quem chamou segue em silêncio.
 */
export type OptionalRpcResult = {
  ok: boolean;
  missing: boolean;
  error: { code?: string; message?: string } | null;
};

type LooseRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{
  error: { code?: string; message?: string; status?: number } | null;
  status?: number;
}>;

export function isMissingRpcError(
  error: { code?: string; message?: string; status?: number } | null | undefined,
  status?: number,
) {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  if (status === 404 || error.status === 404) return true;
  return /could not find the function|function .* does not exist/i.test(error.message ?? "");
}

export async function callOptionalRpc(
  fn: string,
  args?: Record<string, unknown>,
): Promise<OptionalRpcResult> {
  try {
    const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
    const { error, status } = await rpc(fn, args);
    if (!error) return { ok: true, missing: false, error: null };
    return { ok: false, missing: isMissingRpcError(error, status), error };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, missing: false, error: { message } };
  }
}
