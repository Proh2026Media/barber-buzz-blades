type Transport = (path: string, init?: RequestInit) => Promise<unknown>;

/** A extensão recusa a trava antes de executar o comando. Reutiliza a operação idempotente. */
export function recoverableGroupTransport(transport: Transport): Transport {
  return async (path, init) => {
    try {
      return await transport(path, init);
    } catch (error) {
      const busy = error as { status?: number; message?: string };
      if (
        busy?.status !== 409 ||
        busy.message !== "Operação em andamento; conferir antes de repetir" ||
        init?.method !== "POST" ||
        !/^\/group\/bcSend(?:Code|Notice)\//.test(path)
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 450));
      return transport(path, init);
    }
  };
}
